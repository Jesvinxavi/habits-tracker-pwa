import { Actions, dispatch, getState } from './state.js';
import { initializeAccountAuth } from './auth.js';
import { functionReference, getConvexClient } from './convexClient.js';
import { SyncEngine } from './syncEngine.js';
import { setCloudRuntime } from './cloudRuntime.js';
import {
  applyConfirmedEntityChanges,
  getSyncMetadata,
  listCachedEntities,
  listOutbox,
  putSyncMetadata,
  replaceConfirmedEntities,
} from './offlineDb.js';
import {
  hydrateCompatibilityState,
  overlayPendingOperations,
} from './stateHydration.js';
import { markStartup } from './startupMetrics.js';

const CORE_ENTITY_TYPES = [
  'profile',
  'preferences',
  'habitCategories',
  'habits',
  'holidayPeriods',
  'holidaySingles',
  'activityCategories',
  'activities',
  'routines',
  'programs',
];

const HISTORY_ENTITY_TYPES = [
  'habitEntries',
  'activityRecords',
  'restDays',
];

const ENTITY_TYPES = [...CORE_ENTITY_TYPES, ...HISTORY_ENTITY_TYPES];
const PAGE_SIZE = 500;

function emptyCache() {
  return {
    profile: null,
    preferences: null,
    habitCategories: [],
    habits: [],
    habitEntries: [],
    holidayPeriods: [],
    holidaySingles: [],
    activityCategories: [],
    activities: [],
    activityRecords: [],
    routines: [],
    programs: [],
    restDays: [],
  };
}

function recordsForCoreType(core, entityType) {
  if (entityType === 'profile') return core.profile ? [core.profile] : [];
  if (entityType === 'preferences') {
    return core.preferences ? [core.preferences] : [];
  }
  return core[entityType] || [];
}

function hasCacheChanges(result) {
  return Boolean(
    result?.inserted ||
      result?.updated ||
      result?.deleted
  );
}

async function loadCachedAccount(ownerKey, generation) {
  const cache = emptyCache();
  const recordsByType = await Promise.all(
    ENTITY_TYPES.map((type) => listCachedEntities(ownerKey, generation, type))
  );
  ENTITY_TYPES.forEach((type, index) => {
    const records = recordsByType[index];
    if (type === 'profile' || type === 'preferences') {
      cache[type] = records[0] || null;
    } else {
      cache[type] = records;
    }
  });
  return cache;
}

function mergeCoreIntoCache(cache, core) {
  return CORE_ENTITY_TYPES.reduce(
    (result, entityType) => ({
      ...result,
      [entityType]:
        entityType === 'profile' || entityType === 'preferences'
          ? recordsForCoreType(core, entityType)[0] || null
          : recordsForCoreType(core, entityType),
    }),
    { ...cache }
  );
}

async function loadAccountWithPendingOperations(ownerKey, generation) {
  const [cache, operations] = await Promise.all([
    loadCachedAccount(ownerKey, generation),
    listOutbox(ownerKey, ['pending', 'retry', 'syncing', 'conflict']),
  ]);
  return overlayPendingOperations(
    cache,
    operations.filter((operation) => operation.generation === generation)
  );
}

async function cacheCore(ownerKey, core) {
  const results = await Promise.all(
    CORE_ENTITY_TYPES.map((entityType) =>
      replaceConfirmedEntities(
        ownerKey,
        core.generation,
        entityType,
        recordsForCoreType(core, entityType)
      )
    )
  );
  return results.some(hasCacheChanges);
}

/**
 * Reads every page from a Convex paginated query. When the endpoint includes a
 * generation, every page must belong to the expected generation or the caller
 * discards the entire result.
 */
export async function queryAllPages(
  client,
  reference,
  args,
  { expectedGeneration } = {}
) {
  let cursor = null;
  const records = [];
  do {
    // Paging is intentionally sequential because Convex cursors are opaque and
    // each continuation is defined by the preceding page.
    // eslint-disable-next-line no-await-in-loop
    const result = await client.query(functionReference(reference), {
      ...args,
      paginationOpts: { numItems: PAGE_SIZE, cursor },
    });
    if (
      expectedGeneration !== undefined &&
      result.generation !== undefined &&
      result.generation !== expectedGeneration
    ) {
      throw new Error('REMOTE_GENERATION_CHANGED');
    }
    records.push(...result.page);
    cursor = result.isDone ? null : result.continueCursor;
  } while (cursor !== null);
  return records;
}

async function queryHistoryWindow(client, fromDate, toDate) {
  const [habitEntries, activityRecords, restDays] = await Promise.all([
    queryAllPages(
      client,
      'habitEntries:listByDateRange',
      { fromDate, toDate }
    ),
    queryAllPages(
      client,
      'history:listActivityRecordsByDateRange',
      { fromDate, toDate }
    ),
    client.query(functionReference('history:listRestDaysByDateRange'), {
      fromDate,
      toDate,
    }),
  ]);
  return { habitEntries, activityRecords, restDays };
}

function recordDateKey(entityType, record) {
  return entityType === 'habitEntries'
    ? record.periodSortDate
    : record.dateKey;
}

function isRecordInWindow(entityType, record, fromDate, toDate) {
  const dateKey = recordDateKey(entityType, record);
  return typeof dateKey === 'string' && dateKey >= fromDate && dateKey <= toDate;
}

function maximumUpdatedAt(records = []) {
  return records.reduce(
    (maximum, record) =>
      Number.isFinite(record.updatedAt)
        ? Math.max(maximum, record.updatedAt)
        : maximum,
    0
  );
}

/**
 * The lower bound stays inclusive. A write that shares a millisecond with the
 * previous maximum must be read again; revision/equality checks make duplicates
 * cheap and prevent the timestamp watermark from skipping a record.
 */
export function nextInclusiveWatermark(current = 0, signal, records = []) {
  return Math.max(
    current,
    Number.isFinite(signal?.updatedAt) ? signal.updatedAt : 0,
    maximumUpdatedAt(records)
  );
}

function signalMap(signals = []) {
  return Object.fromEntries(
    signals.map((signal) => [signal.entityType, signal])
  );
}

function createDeviceState(syncStatus) {
  const state = getState();
  return {
    currentDate: state.currentDate,
    selectedDate: state.selectedDate,
    fitnessSelectedDate: state.fitnessSelectedDate,
    selectedGroup: state.selectedGroup,
    ...(syncStatus ? { syncStatus } : {}),
  };
}

/**
 * One remote queue owns ordering for core and history changes. Callbacks merely
 * record the latest demand. A newly observed generation invalidates in-flight
 * work synchronously, while same-generation signals arriving during a fetch are
 * handled by the next loop before the queue emits one coalesced state delivery.
 */
export function createCoalescedRemoteQueue({
  initialGeneration,
  processCore,
  processSignals,
  afterBatch,
  retryDelayMs = 1000,
  onError = (error) => console.warn('Remote refresh failed:', error),
}) {
  let generation = initialGeneration;
  let version = 0;
  let pendingCore;
  let needsCore = false;
  const pendingSignals = new Map();
  let running;
  let retryTimer;
  let closed = false;

  const observeGeneration = (nextGeneration) => {
    if (nextGeneration === generation) return;
    generation = nextGeneration;
    version += 1;
    pendingSignals.clear();
  };

  const guard = (capturedVersion, expectedGeneration) =>
    !closed &&
    capturedVersion === version &&
    expectedGeneration === generation;

  const mergeSignals = (signals) => {
    signals.forEach((signal) => {
      const current = pendingSignals.get(signal.entityType);
      if (!current || signal.revision > current.revision) {
        pendingSignals.set(signal.entityType, signal);
      }
    });
  };

  const drain = async () => {
    let shouldDeliver = false;
    let deliveryVersion = null;
    while (
      !closed &&
      (pendingCore !== undefined || needsCore || pendingSignals.size)
    ) {
      const core = pendingCore;
      const loadCore = needsCore && core === undefined;
      pendingCore = undefined;
      needsCore = false;
      const signals = [...pendingSignals.values()];
      pendingSignals.clear();
      const capturedVersion = version;
      const expectedGeneration = generation;
      const isCurrent = () => guard(capturedVersion, expectedGeneration);

      try {
        let changed = false;
        if (core !== undefined || loadCore) {
          // eslint-disable-next-line no-await-in-loop
          changed =
            (await processCore(core, {
              expectedGeneration,
              isCurrent,
            })) || changed;
        }
        if (signals.length && isCurrent()) {
          // eslint-disable-next-line no-await-in-loop
          changed =
            (await processSignals(signals, {
              expectedGeneration,
              isCurrent,
            })) || changed;
        }
        // A generation callback can arrive while either handler awaits. Its
        // data belongs to a discarded generation, so never deliver that stale
        // batch after the queue catches up with the newer generation.
        if (changed && isCurrent()) {
          shouldDeliver = true;
          deliveryVersion = capturedVersion;
        }
      } catch (error) {
        if (isCurrent()) {
          if (core !== undefined) pendingCore = core;
          else if (loadCore) needsCore = true;
          mergeSignals(signals);
        }
        throw error;
      }
    }
    if (
      shouldDeliver &&
      !closed &&
      deliveryVersion === version
    ) {
      await afterBatch({ generation });
    }
  };

  const schedule = () => {
    if (!running && !retryTimer && !closed) {
      // Let a synchronous onUpdate burst settle before beginning I/O. Later
      // callbacks that arrive while I/O is pending are still handled by the
      // next drain iteration, in arrival order.
      running = Promise.resolve()
        .then(drain)
        .catch((error) => {
          onError(error);
          if (!closed) {
            retryTimer = setTimeout(() => {
              retryTimer = undefined;
              schedule();
            }, retryDelayMs);
          }
        })
        .finally(() => {
          running = undefined;
          if (
            !closed &&
            !retryTimer &&
            (pendingCore !== undefined || needsCore || pendingSignals.size)
          ) {
            schedule();
          }
        });
    }
    return running;
  };

  return {
    requestCore(core) {
      if (closed) return;
      observeGeneration(core.generation);
      pendingCore = core;
      schedule();
    },
    requestSignals(update) {
      if (closed) return;
      if (update.generation !== generation) {
        observeGeneration(update.generation);
        needsCore = true;
      }
      mergeSignals(update.signals || []);
      schedule();
    },
    async whenIdle() {
      while (running) {
        // A completed drain can schedule one follow-up in its finally block.
        // eslint-disable-next-line no-await-in-loop
        await running;
      }
    },
    close() {
      closed = true;
      version += 1;
      clearTimeout(retryTimer);
      retryTimer = undefined;
      pendingCore = undefined;
      needsCore = false;
      pendingSignals.clear();
    },
  };
}

async function hydrateEarlyConfirmedCache(account) {
  markStartup('earlyCacheStart');
  const metadata = await getSyncMetadata(account.ownerKey);
  if (!metadata?.activeGeneration) {
    markStartup('earlyCacheMetadataUnavailable');
    return null;
  }
  markStartup('earlyCacheMetadataReady');
  const cache = await loadAccountWithPendingOperations(
    account.ownerKey,
    metadata.activeGeneration
  );
  if (!cache.profile) {
    markStartup('earlyCacheRecordsUnavailable');
    return null;
  }

  const syncEngine = new SyncEngine({
    ownerKey: account.ownerKey,
    generation: metadata.activeGeneration,
    deviceId: account.deviceId,
    client: getConvexClient(),
  });
  syncEngine.setAuthenticated(false);
  setCloudRuntime({
    ...account,
    generation: metadata.activeGeneration,
    preferences: cache.preferences,
    collectionRevisions: metadata.collectionRevisions || {},
    syncEngine,
    writeBlocked: false,
  });
  hydrateCompatibilityState(cache, createDeviceState('syncing'));
  markStartup('earlyCacheHydrated');
  return {
    ...account,
    mode: 'cloud_connecting',
    generation: metadata.activeGeneration,
  };
}

export async function bootstrapCloudPersistence() {
  let resolveEarlyCache;
  const earlyCacheReady = new Promise((resolve) => {
    resolveEarlyCache = resolve;
  });
  const accountPromise = initializeAccountAuth({
    onAuthenticatedSession: async (cachedAccount) => {
      const result = await hydrateEarlyConfirmedCache(cachedAccount);
      if (result) resolveEarlyCache({ kind: 'cache', result });
    },
  });
  const winner = await Promise.race([
    accountPromise.then((account) => ({ kind: 'account', account })),
    earlyCacheReady,
  ]);

  if (winner.kind === 'cache') {
    void accountPromise
      .then((account) => finishCloudPersistence(account))
      .catch((error) => {
        console.warn('Background cloud connection failed:', error);
        dispatch(Actions.setSyncStatus(navigator.onLine ? 'failed' : 'offline'));
      });
    return winner.result;
  }

  return finishCloudPersistence(winner.account);
}

async function finishCloudPersistence(account) {
  markStartup('authComplete');
  if (account.access === 'blocked') return account;

  if (account.access === 'offline') {
    const metadata = await getSyncMetadata(account.ownerKey);
    if (!metadata?.activeGeneration) {
      throw new Error('No confirmed account cache is available on this device');
    }
    const cache = await loadAccountWithPendingOperations(
      account.ownerKey,
      metadata.activeGeneration
    );
    const syncEngine = new SyncEngine({
      ownerKey: account.ownerKey,
      generation: metadata.activeGeneration,
      deviceId: metadata.deviceId,
    });
    syncEngine.setAuthenticated(false);
    setCloudRuntime({
      ...account,
      generation: metadata.activeGeneration,
      deviceId: metadata.deviceId,
      preferences: cache.preferences,
      collectionRevisions: metadata.collectionRevisions || {},
      syncEngine,
      writeBlocked: false,
    });
    hydrateCompatibilityState(cache, createDeviceState('offline'));
    return { ...account, mode: 'cloud_offline' };
  }

  const client = getConvexClient();
  const metadataPromise = getSyncMetadata(account.ownerKey);
  let core = await client.query(functionReference('bootstrap:getCore'), {});
  markStartup('coreReady');
  const existingMetadata = await metadataPromise;
  let syncEngine = new SyncEngine({
    ownerKey: account.ownerKey,
    generation: core.generation,
    deviceId: account.deviceId,
    client,
  });
  const runtime = {
    ...account,
    generation: core.generation,
    preferences: core.preferences,
    collectionRevisions: core.collectionRevisions || {},
    syncEngine,
    writeBlocked: false,
  };
  setCloudRuntime(runtime);

  const today = new Date();
  const fromDate = `${today.getUTCFullYear() - 1}-01-01`;
  const toDate = `${today.getUTCFullYear() + 1}-12-31`;
  const historyWatermarks = {
    ...(existingMetadata?.historyWatermarks || {}),
  };
  const historySignalRevisions = {
    ...(existingMetadata?.historySignalRevisions || {}),
  };

  const rehydrateFromConfirmedCache = async (syncStatus, expectedGeneration) => {
    const generation = expectedGeneration ?? runtime.generation;
    const cached = await loadAccountWithPendingOperations(
      account.ownerKey,
      generation
    );
    if (generation !== runtime.generation) return false;
    hydrateCompatibilityState(cached, createDeviceState(syncStatus));
    return true;
  };

  const replaceHistoryWindow = async (generation, history) => {
    const results = await Promise.all(
      HISTORY_ENTITY_TYPES.map((entityType) =>
        replaceConfirmedEntities(
          account.ownerKey,
          generation,
          entityType,
          history[entityType],
          {
            isInScope: (record) =>
              isRecordInWindow(entityType, record, fromDate, toDate),
          }
        )
      )
    );
    return results.some(hasCacheChanges);
  };

  const refreshAuthoritativeData = async (
    targetCore,
    { isCurrent = () => targetCore.generation === runtime.generation } = {}
  ) => {
    const expectedGeneration = targetCore.generation;
    const signalsBefore = await client.query(
      functionReference('sync:getHistorySignals'),
      {}
    );
    if (signalsBefore.generation !== expectedGeneration) {
      throw new Error('REMOTE_GENERATION_CHANGED');
    }
    const history = await queryHistoryWindow(client, fromDate, toDate);
    const signalsAfter = await client.query(
      functionReference('sync:getHistorySignals'),
      {}
    );
    if (
      signalsAfter.generation !== expectedGeneration ||
      !isCurrent()
    ) {
      throw new Error('REMOTE_GENERATION_CHANGED');
    }

    const [coreChanged, historyChanged] = await Promise.all([
      cacheCore(account.ownerKey, targetCore),
      replaceHistoryWindow(expectedGeneration, history),
    ]);
    if (!isCurrent()) return false;

    const beforeByType = signalMap(signalsBefore.signals);
    HISTORY_ENTITY_TYPES.forEach((entityType) => {
      const before = beforeByType[entityType];
      historyWatermarks[entityType] = nextInclusiveWatermark(
        historyWatermarks[entityType],
        before,
        history[entityType]
      );
      historySignalRevisions[entityType] = Math.max(
        historySignalRevisions[entityType] || 0,
        before?.revision || 0
      );
    });
    await putSyncMetadata(account.ownerKey, {
      activeGeneration: expectedGeneration,
      deviceId: account.deviceId,
      cachedSchemaVersion: targetCore.schemaVersion,
      lastCompletedSyncTimestamp: Date.now(),
      subscriptionWindows: { fromDate, toDate },
      collectionRevisions: targetCore.collectionRevisions || {},
      historyWatermarks,
      historySignalRevisions,
    });
    return coreChanged || historyChanged;
  };

  const installGeneration = async (updatedCore, isCurrent) => {
    const changedGeneration = updatedCore.generation !== runtime.generation;
    if (changedGeneration) {
      runtime.writeBlocked = true;
      syncEngine.close();
      syncEngine = new SyncEngine({
        ownerKey: account.ownerKey,
        generation: updatedCore.generation,
        deviceId: account.deviceId,
        client,
      });
      runtime.generation = updatedCore.generation;
      runtime.syncEngine = syncEngine;
      Object.keys(historyWatermarks).forEach((key) => delete historyWatermarks[key]);
      Object.keys(historySignalRevisions).forEach(
        (key) => delete historySignalRevisions[key]
      );
    }
    runtime.preferences = updatedCore.preferences;
    runtime.collectionRevisions = updatedCore.collectionRevisions || {};
    core = updatedCore;
    let changed = false;
    if (changedGeneration) {
      changed = await refreshAuthoritativeData(updatedCore, { isCurrent });
      if (!isCurrent()) return false;
      runtime.writeBlocked = false;
      syncEngine.requestReplay();
      return true;
    }

    changed = await cacheCore(account.ownerKey, updatedCore);
    if (!isCurrent()) return false;
    await putSyncMetadata(account.ownerKey, {
      collectionRevisions: runtime.collectionRevisions,
    });
    return changed;
  };

  const processHistorySignals = async (
    signals,
    { expectedGeneration, isCurrent }
  ) => {
    let changed = false;
    let metadataChanged = false;
    for (const signal of signals) {
      if (
        !HISTORY_ENTITY_TYPES.includes(signal.entityType) ||
        signal.revision <= (historySignalRevisions[signal.entityType] || 0)
      ) {
        continue;
      }
      const sinceUpdatedAt = historyWatermarks[signal.entityType] || 0;
      // The inclusive lower bound is intentional; never add one here.
      // eslint-disable-next-line no-await-in-loop
      const records = await queryAllPages(
        client,
        'sync:listChangedEntities',
        {
          entityType: signal.entityType,
          sinceUpdatedAt,
        },
        { expectedGeneration }
      );
      if (!isCurrent()) return false;
      const recordsInWindow = records.filter((record) =>
        isRecordInWindow(signal.entityType, record, fromDate, toDate)
      );
      // eslint-disable-next-line no-await-in-loop
      const result = await applyConfirmedEntityChanges(
        account.ownerKey,
        expectedGeneration,
        signal.entityType,
        recordsInWindow
      );
      if (!isCurrent()) return false;
      changed = hasCacheChanges(result) || changed;
      historyWatermarks[signal.entityType] = nextInclusiveWatermark(
        sinceUpdatedAt,
        signal,
        records
      );
      historySignalRevisions[signal.entityType] = signal.revision;
      metadataChanged = true;
    }
    if (metadataChanged && isCurrent()) {
      await putSyncMetadata(account.ownerKey, {
        historyWatermarks,
        historySignalRevisions,
        lastCompletedSyncTimestamp: Date.now(),
      });
    }
    return changed;
  };

  const remoteQueue = createCoalescedRemoteQueue({
    initialGeneration: core.generation,
    processCore: async (updatedCore, { expectedGeneration, isCurrent }) => {
      const latestCore =
        updatedCore ||
        (await client.query(functionReference('bootstrap:getCore'), {}));
      if (latestCore.generation !== expectedGeneration || !isCurrent()) {
        return false;
      }
      return installGeneration(latestCore, isCurrent);
    },
    processSignals: processHistorySignals,
    afterBatch: ({ generation }) =>
      rehydrateFromConfirmedCache(undefined, generation),
    onError: (error) => {
      if (error?.message === 'REMOTE_GENERATION_CHANGED') {
        void client
          .query(functionReference('bootstrap:getCore'), {})
          .then((updatedCore) => remoteQueue.requestCore(updatedCore))
          .catch((refreshError) => {
            console.warn('Generation refresh failed:', refreshError);
            dispatch(
              Actions.setSyncStatus(navigator.onLine ? 'failed' : 'offline')
            );
          });
        return;
      }
      console.warn('Remote refresh failed:', error);
      dispatch(Actions.setSyncStatus(navigator.onLine ? 'failed' : 'offline'));
    },
  });

  const subscribeToCloudUpdates = () => {
    if (typeof client.onUpdate !== 'function') return [];
    return [
      client.onUpdate(
        functionReference('bootstrap:getCore'),
        {},
        (updatedCore) => remoteQueue.requestCore(updatedCore)
      ),
      client.onUpdate(
        functionReference('sync:getHistorySignals'),
        {},
        (update) => remoteQueue.requestSignals(update)
      ),
    ];
  };

  const initializeRemoteState = async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await refreshAuthoritativeData(core);
        await rehydrateFromConfirmedCache('synced', core.generation);
        runtime.subscriptionUnsubscribers = subscribeToCloudUpdates();
        return;
      } catch (error) {
        if (error?.message !== 'REMOTE_GENERATION_CHANGED' || attempt === 2) {
          throw error;
        }
        const latestCore = await client.query(
          functionReference('bootstrap:getCore'),
          {}
        );
        if (latestCore.generation !== runtime.generation) {
          runtime.writeBlocked = true;
          syncEngine.close();
          syncEngine = new SyncEngine({
            ownerKey: account.ownerKey,
            generation: latestCore.generation,
            deviceId: account.deviceId,
            client,
          });
          runtime.generation = latestCore.generation;
          runtime.syncEngine = syncEngine;
          Object.keys(historyWatermarks).forEach(
            (key) => delete historyWatermarks[key]
          );
          Object.keys(historySignalRevisions).forEach(
            (key) => delete historySignalRevisions[key]
          );
        }
        core = latestCore;
        runtime.preferences = latestCore.preferences;
        runtime.collectionRevisions = latestCore.collectionRevisions || {};
      }
    }
  };

  const hasCompatibleCache =
    existingMetadata?.activeGeneration === core.generation;
  const cachedAccount = hasCompatibleCache
    ? await loadAccountWithPendingOperations(account.ownerKey, core.generation)
    : null;

  if (cachedAccount?.profile) {
    hydrateCompatibilityState(mergeCoreIntoCache(cachedAccount, core), {
      ...createDeviceState('syncing'),
    });
    markStartup('cacheHydrated');
    syncEngine.requestReplay();
    void initializeRemoteState()
      .then(() => {
        runtime.writeBlocked = false;
      })
      .catch((error) => {
        console.warn('Background account refresh failed:', error);
        dispatch(
          Actions.setSyncStatus(navigator.onLine ? 'failed' : 'offline')
        );
      });
    return {
      ...account,
      mode: 'cloud_cached',
      generation: core.generation,
    };
  }

  await initializeRemoteState();
  runtime.writeBlocked = false;
  markStartup('cloudHydrated');
  syncEngine.requestReplay();
  return { ...account, mode: 'cloud', generation: core.generation };
}
