import { Actions, dispatch, getState } from './state.js';
import { initializeAccountAuth } from './auth.js';
import { functionReference, getConvexClient } from './convexClient.js';
import { SyncEngine } from './syncEngine.js';
import { setCloudRuntime } from './cloudRuntime.js';
import {
  getSyncMetadata,
  listCachedEntities,
  listOutbox,
  putConfirmedEntities,
  putSyncMetadata,
} from './offlineDb.js';
import {
  hydrateCompatibilityState,
  overlayPendingOperations,
} from './stateHydration.js';
import {
  readLegacySources,
  selectLegacyDefault,
  summarizeLegacySources,
} from './migration/sourceReader.js';
import {
  meaningfulLegacySnapshot,
  normalizeLegacySnapshot,
} from './migration/normalizeLegacy.js';
import { checksum } from './migration/canonical.js';
import { mergeLegacySnapshots } from './migration/mergeLegacy.js';
import { mergeNormalizedTables } from './migration/mergeNormalized.js';
import { exportCloudData } from './dataManagement.js';
import {
  backUpLegacySources,
  renderMigrationPreview,
  uploadAndActivateMigration,
} from './migration/coordinator.js';
import { markStartup } from './startupMetrics.js';

const ENTITY_TYPES = [
  'profile',
  'preferences',
  'habitCategories',
  'habits',
  'habitEntries',
  'holidayPeriods',
  'holidaySingles',
  'activityCategories',
  'activities',
  'activityRecords',
  'routines',
  'programs',
  'restDays',
  'legacyData',
];

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
    legacyData: null,
  };
}

async function loadCachedAccount(ownerKey, generation) {
  const cache = emptyCache();
  const recordsByType = await Promise.all(
    ENTITY_TYPES.map((type) => listCachedEntities(ownerKey, generation, type))
  );
  ENTITY_TYPES.forEach((type, index) => {
    const records = recordsByType[index];
    if (['profile', 'preferences', 'legacyData'].includes(type)) {
      cache[type] = records[0] || null;
    } else {
      cache[type] = records;
    }
  });
  return cache;
}

function mergeCoreIntoCache(cache, core) {
  return {
    ...cache,
    profile: core.profile,
    preferences: core.preferences,
    habitCategories: core.habitCategories,
    habits: core.habits,
    holidayPeriods: core.holidayPeriods,
    holidaySingles: core.holidaySingles,
    activityCategories: core.activityCategories,
    activities: core.activities,
    routines: core.routines,
    programs: core.programs,
    legacyData: core.legacyData,
  };
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
  const generation = core.generation;
  await Promise.all([
    putConfirmedEntities(ownerKey, generation, 'profile', [core.profile]),
    putConfirmedEntities(ownerKey, generation, 'preferences', core.preferences ? [core.preferences] : []),
    putConfirmedEntities(ownerKey, generation, 'habitCategories', core.habitCategories),
    putConfirmedEntities(ownerKey, generation, 'habits', core.habits),
    putConfirmedEntities(ownerKey, generation, 'holidayPeriods', core.holidayPeriods),
    putConfirmedEntities(ownerKey, generation, 'holidaySingles', core.holidaySingles),
    putConfirmedEntities(ownerKey, generation, 'activityCategories', core.activityCategories),
    putConfirmedEntities(ownerKey, generation, 'activities', core.activities),
    putConfirmedEntities(ownerKey, generation, 'routines', core.routines || []),
    putConfirmedEntities(ownerKey, generation, 'programs', core.programs || []),
    putConfirmedEntities(ownerKey, generation, 'legacyData', core.legacyData ? [core.legacyData] : []),
  ]);
}

async function queryHistoryWindow(client, fromDate, toDate) {
  const loadAll = async (reference, args) => {
    let cursor = null;
    const records = [];
    do {
      const result = await client.query(functionReference(reference), {
        ...args,
        paginationOpts: { numItems: 500, cursor },
      });
      records.push(...result.page);
      cursor = result.isDone ? null : result.continueCursor;
    } while (cursor);
    return records;
  };
  const [habitEntries, activityRecords, restDays] = await Promise.all([
    loadAll('habitEntries:listByDateRange', { fromDate, toDate }),
    loadAll('history:listActivityRecordsByDateRange', { fromDate, toDate }),
    client.query(functionReference('history:listRestDaysByDateRange'), { fromDate, toDate }),
  ]);
  return { habitEntries, activityRecords, restDays };
}

function hasMeaningfulLegacyData(snapshot) {
  if (!snapshot) return false;
  const meaningful = meaningfulLegacySnapshot(snapshot);
  return Boolean(
    meaningful.categories?.length ||
      meaningful.habits?.length ||
      meaningful.holidayDates?.length ||
      meaningful.holidayPeriods?.length ||
      meaningful.activities?.length ||
      Object.keys(meaningful.recordedActivities || {}).length ||
      Object.keys(meaningful.restDays || {}).length ||
      meaningful.foodLog?.length ||
      Object.keys(meaningful.stats || {}).length
  );
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
  if (
    !metadata.migrationVerified &&
    cache.profile.migrationStatus !== 'completed'
  ) {
    const sources = await readLegacySources();
    const selected = selectLegacyDefault(sources);
    const merged = mergeLegacySnapshots(
      sources.local.snapshot,
      sources.indexed.snapshot
    );
    if (hasMeaningfulLegacyData(merged.snapshot || selected.snapshot)) {
      markStartup('earlyCacheMigrationUnresolved');
      return null;
    }
    await putSyncMetadata(account.ownerKey, { migrationVerified: true });
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
  hydrateCompatibilityState(cache, {
    currentDate: getState().currentDate,
    selectedDate: getState().selectedDate,
    fitnessSelectedDate: getState().fitnessSelectedDate,
    selectedGroup: getState().selectedGroup,
    syncStatus: 'syncing',
  });
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
    });
    hydrateCompatibilityState(cache, {
      currentDate: getState().currentDate,
      selectedDate: getState().selectedDate,
      fitnessSelectedDate: getState().fitnessSelectedDate,
      selectedGroup: getState().selectedGroup,
      syncStatus: 'offline',
    });
    return { ...account, mode: 'cloud_offline' };
  }

  const client = getConvexClient();
  const metadataPromise = getSyncMetadata(account.ownerKey);
  let core = await client.query(functionReference('bootstrap:getCore'), {});
  markStartup('coreReady');
  const existingMetadata = await metadataPromise;
  const syncEngine = new SyncEngine({
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

  let sources;
  let selected;
  let mergedSources;
  let migrationSnapshot = null;
  let legacySummary = null;
  const shouldInspectLegacySources =
    core.profile.migrationStatus !== 'completed' ||
    !existingMetadata?.migrationVerified;
  if (shouldInspectLegacySources) {
    sources = await readLegacySources();
    selected = selectLegacyDefault(sources);
    mergedSources = mergeLegacySnapshots(
      sources.local.snapshot,
      sources.indexed.snapshot
    );
    migrationSnapshot = mergedSources.snapshot || selected.snapshot;
    legacySummary = summarizeLegacySources(sources);
  }
  if (
    core.profile.migrationStatus !== 'completed' &&
    hasMeaningfulLegacyData(migrationSnapshot)
  ) {
    runtime.writeBlocked = true;
    await backUpLegacySources(account.ownerKey, sources);
    const normalized = normalizeLegacySnapshot(
      migrationSnapshot,
      sources.local.sideKeys
    );
    normalized.warnings.push(...mergedSources.conflicts);
    dispatch(
      Actions.hydrateCache({
        ...migrationSnapshot,
        manualHolidayDates: normalized.tables.holidaySingles.map(
          (single) => single.dateKey
        ),
        currentDate: getState().currentDate,
        selectedDate: getState().selectedDate,
        fitnessSelectedDate: getState().fitnessSelectedDate,
        selectedGroup: getState().selectedGroup,
        syncStatus: 'migration_required',
      })
    );
    const sourceFingerprint = checksum(meaningfulLegacySnapshot(migrationSnapshot));
    renderMigrationPreview({
      normalized,
      selectedSource:
        sources.local.snapshot && sources.indexed.snapshot
          ? 'merged localStorage + IndexedDB (IndexedDB wins matching-ID conflicts)'
          : selected.selected,
      onMigrate: async (onProgress) => {
        const result = await uploadAndActivateMigration({
          normalized,
          sourceFingerprint,
          deviceId: account.deviceId,
          onProgress,
          client,
        });
        core = result.core;
        runtime.generation = core.generation;
        runtime.preferences = core.preferences;
        runtime.writeBlocked = false;
        await cacheCore(account.ownerKey, core);
        await putSyncMetadata(account.ownerKey, {
          activeGeneration: core.generation,
          deviceId: account.deviceId,
          cachedSchemaVersion: core.schemaVersion,
          lastCompletedSyncTimestamp: Date.now(),
          legacyFingerprint: sourceFingerprint,
          migrationVerified: true,
        });
        window.location.reload();
      },
    });
    return {
      ...account,
      mode: 'migration_required',
      preview: normalized,
      legacySummary,
    };
  }

  const localFingerprint = migrationSnapshot
    ? checksum(meaningfulLegacySnapshot(migrationSnapshot))
    : null;
  if (
    core.profile.migrationStatus === 'completed' &&
    hasMeaningfulLegacyData(migrationSnapshot) &&
    localFingerprint &&
    existingMetadata?.legacyFingerprint !== localFingerprint
  ) {
    const pending = await listOutbox(account.ownerKey);
    if (pending.length) {
      runtime.writeBlocked = true;
      throw new Error(
        'Pending offline changes must sync before this device can merge its legacy data'
      );
    }
    await backUpLegacySources(account.ownerKey, sources);
    const localNormalized = normalizeLegacySnapshot(
      migrationSnapshot,
      sources.local.sideKeys
    );
    const cloudExport = await exportCloudData(client);
    const merged = mergeNormalizedTables(cloudExport.tables, localNormalized.tables);
    runtime.writeBlocked = true;
    renderMigrationPreview({
      normalized: merged,
      selectedSource:
        'cloud data + this device (cloud wins displayed matching-ID conflicts)',
      onMigrate: async (onProgress) => {
        const result = await uploadAndActivateMigration({
          normalized: merged,
          sourceFingerprint: localFingerprint,
          deviceId: account.deviceId,
          onProgress,
          client,
        });
        runtime.generation = result.core.generation;
        runtime.preferences = result.core.preferences;
        runtime.writeBlocked = false;
        await putSyncMetadata(account.ownerKey, {
          activeGeneration: result.core.generation,
          legacyFingerprint: localFingerprint,
          migrationVerified: true,
          lastCompletedSyncTimestamp: Date.now(),
        });
        window.location.reload();
      },
    });
    return {
      ...account,
      mode: 'additional_device_merge_required',
      preview: merged,
    };
  }

  const today = new Date();
  const fromDate = `${today.getUTCFullYear() - 1}-01-01`;
  const toDate = `${today.getUTCFullYear() + 1}-12-31`;
  const rehydrateFromConfirmedCache = async (syncStatus) => {
    const cached = await loadAccountWithPendingOperations(
      account.ownerKey,
      runtime.generation
    );
    hydrateCompatibilityState(cached, {
      currentDate: getState().currentDate,
      selectedDate: getState().selectedDate,
      fitnessSelectedDate: getState().fitnessSelectedDate,
      selectedGroup: getState().selectedGroup,
      ...(syncStatus ? { syncStatus } : {}),
    });
  };

  const refreshConfirmedData = async () => {
    const history = await queryHistoryWindow(client, fromDate, toDate);
    await cacheCore(account.ownerKey, core);
    await Promise.all([
      putConfirmedEntities(
        account.ownerKey,
        core.generation,
        'habitEntries',
        history.habitEntries
      ),
      putConfirmedEntities(
        account.ownerKey,
        core.generation,
        'activityRecords',
        history.activityRecords
      ),
      putConfirmedEntities(
        account.ownerKey,
        core.generation,
        'restDays',
        history.restDays
      ),
      putSyncMetadata(account.ownerKey, {
        activeGeneration: core.generation,
        deviceId: account.deviceId,
        cachedSchemaVersion: core.schemaVersion,
        lastCompletedSyncTimestamp: Date.now(),
        subscriptionWindows: { fromDate, toDate },
        collectionRevisions: core.collectionRevisions || {},
      }),
    ]);
    await rehydrateFromConfirmedCache('synced');
  };

  const subscribeToCloudUpdates = () => {
    if (typeof client.onUpdate !== 'function') return;
    client.onUpdate(functionReference('bootstrap:getCore'), {}, async (updatedCore) => {
      if (updatedCore.generation !== runtime.generation) {
        runtime.generation = updatedCore.generation;
      }
      runtime.preferences = updatedCore.preferences;
      runtime.collectionRevisions = updatedCore.collectionRevisions || {};
      await cacheCore(account.ownerKey, updatedCore);
      await putSyncMetadata(account.ownerKey, {
        collectionRevisions: runtime.collectionRevisions,
      });
      await rehydrateFromConfirmedCache();
    });
    client.onUpdate(
      functionReference('habitEntries:listByDateRange'),
      {
        fromDate,
        toDate,
        paginationOpts: { numItems: 500, cursor: null },
      },
      async (page) => {
        await putConfirmedEntities(
          account.ownerKey,
          runtime.generation,
          'habitEntries',
          page.page
        );
        await rehydrateFromConfirmedCache();
      }
    );
    client.onUpdate(
      functionReference('history:listActivityRecordsByDateRange'),
      {
        fromDate,
        toDate,
        paginationOpts: { numItems: 500, cursor: null },
      },
      async (page) => {
        await putConfirmedEntities(
          account.ownerKey,
          runtime.generation,
          'activityRecords',
          page.page
        );
        await rehydrateFromConfirmedCache();
      }
    );
    client.onUpdate(
      functionReference('history:listRestDaysByDateRange'),
      { fromDate, toDate },
      async (records) => {
        await putConfirmedEntities(
          account.ownerKey,
          runtime.generation,
          'restDays',
          records
        );
        await rehydrateFromConfirmedCache();
      }
    );
  };

  const hasCompatibleCache =
    existingMetadata?.activeGeneration === core.generation;
  const cachedAccount = hasCompatibleCache
    ? await loadAccountWithPendingOperations(account.ownerKey, core.generation)
    : null;

  if (cachedAccount?.profile) {
    hydrateCompatibilityState(mergeCoreIntoCache(cachedAccount, core), {
      currentDate: getState().currentDate,
      selectedDate: getState().selectedDate,
      fitnessSelectedDate: getState().fitnessSelectedDate,
      selectedGroup: getState().selectedGroup,
      syncStatus: 'syncing',
    });
    markStartup('cacheHydrated');
    syncEngine.requestReplay();
    subscribeToCloudUpdates();
    void refreshConfirmedData().catch((error) => {
      console.warn('Background account refresh failed:', error);
      dispatch(Actions.setSyncStatus(navigator.onLine ? 'failed' : 'offline'));
    });
    return {
      ...account,
      mode: 'cloud_cached',
      generation: core.generation,
    };
  }

  await refreshConfirmedData();
  markStartup('cloudHydrated');
  syncEngine.requestReplay();
  subscribeToCloudUpdates();
  return { ...account, mode: 'cloud', generation: core.generation };
}
