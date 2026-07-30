import { generateUuid } from '../shared/common.js';

const DB_NAME = 'habitsConvexCache';
const DB_VERSION = 2;
const LEASE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVE_OUTBOX_STATUSES = ['pending', 'retry', 'syncing', 'conflict'];
const DEFAULT_OUTBOX_STATUSES = ACTIVE_OUTBOX_STATUSES;
let openPromise;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

function createStore(db, name, options, indexes = []) {
  if (db.objectStoreNames.contains(name)) return;
  const store = db.createObjectStore(name, options);
  indexes.forEach(([indexName, keyPath, indexOptions]) => {
    store.createIndex(indexName, keyPath, indexOptions);
  });
}

function ensureIndex(store, indexName, keyPath, options = { unique: false }) {
  if (!store.indexNames.contains(indexName)) {
    store.createIndex(indexName, keyPath, options);
  }
}

function deleteByIndex(store, indexName, key) {
  return new Promise((resolve, reject) => {
    const request = store.index(indexName).openCursor(IDBKeyRange.only(key));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    request.onerror = () =>
      reject(request.error || new Error(`IndexedDB ${indexName} cursor failed`));
  });
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableValue(value[key]);
        return result;
      }, {});
  }
  return value;
}

function recordsEqual(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function confirmedEntity(ownerKey, generation, entityType, record, current) {
  return {
    ...record,
    ownerKey,
    generation,
    entityType,
    clientId: record.clientId || entityType,
    optimistic: false,
    updatedAt: record.updatedAt ?? current?.updatedAt ?? Date.now(),
  };
}

export function openOfflineDb(factory = indexedDB) {
  if (openPromise) return openPromise;
  openPromise = new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      createStore(
        db,
        'entities',
        { keyPath: ['ownerKey', 'generation', 'entityType', 'clientId'] },
        [
          [
            'by_owner_generation_type',
            ['ownerKey', 'generation', 'entityType'],
            { unique: false },
          ],
          [
            'by_owner_generation_updatedAt',
            ['ownerKey', 'generation', 'updatedAt'],
            { unique: false },
          ],
        ]
      );
      createStore(db, 'outbox', { keyPath: 'operationId' }, [
        ['by_owner_status_createdAt', ['ownerKey', 'status', 'createdAt'], { unique: false }],
        ['by_owner_entity', ['ownerKey', 'entityType', 'clientId'], { unique: false }],
        ['by_dependency', 'dependsOnOperationId', { unique: false }],
      ]);
      createStore(db, 'syncMetadata', { keyPath: 'ownerKey' });
      createStore(db, 'deviceMetadata');
      createStore(db, 'migrationBackups', { keyPath: 'backupId' }, [
        ['by_owner_createdAt', ['ownerKey', 'createdAt'], { unique: false }],
        ['by_fingerprint', 'fingerprint', { unique: false }],
      ]);
      // Version 2 adds owner-only indexes to existing version-1 stores. Creating
      // them in place retains every cache, outbox, lease, and migration backup.
      const upgrade = request.transaction;
      ensureIndex(upgrade.objectStore('entities'), 'by_owner', 'ownerKey');
      ensureIndex(upgrade.objectStore('outbox'), 'by_owner', 'ownerKey');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Offline database unavailable'));
  });
  return openPromise;
}

export async function resetOfflineDbConnectionForTests() {
  if (openPromise) {
    try {
      const db = await openPromise;
      db.close();
    } catch (_) {
      // A failed open has no connection to close.
    }
  }
  openPromise = undefined;
}

export async function getDeviceId() {
  const db = await openOfflineDb();
  const transaction = db.transaction('deviceMetadata', 'readwrite');
  const store = transaction.objectStore('deviceMetadata');
  let deviceId = await requestResult(store.get('deviceId'));
  if (!deviceId) {
    deviceId = generateUuid();
    store.put(deviceId, 'deviceId');
  }
  await transactionDone(transaction);
  return deviceId;
}

export async function renewOfflineLease({ ownerKey, clerkUserId, now = Date.now() }) {
  if (!ownerKey || !clerkUserId) throw new Error('Lease identity is required');
  const lease = {
    ownerKey,
    clerkUserId,
    issuedAt: now,
    expiresAt: now + LEASE_DURATION_MS,
    explicitlySignedOut: false,
  };
  const db = await openOfflineDb();
  const transaction = db.transaction('deviceMetadata', 'readwrite');
  transaction.objectStore('deviceMetadata').put(lease, 'offlineLease');
  await transactionDone(transaction);
  return lease;
}

export async function readOfflineLease(now = Date.now()) {
  const db = await openOfflineDb();
  const transaction = db.transaction('deviceMetadata', 'readonly');
  const lease = await requestResult(transaction.objectStore('deviceMetadata').get('offlineLease'));
  await transactionDone(transaction);
  return {
    lease: lease || null,
    valid: Boolean(lease && !lease.explicitlySignedOut && lease.expiresAt > now),
  };
}

export async function revokeOfflineLease() {
  const db = await openOfflineDb();
  const transaction = db.transaction('deviceMetadata', 'readwrite');
  const store = transaction.objectStore('deviceMetadata');
  const current = await requestResult(store.get('offlineLease'));
  if (current) store.put({ ...current, explicitlySignedOut: true, expiresAt: Date.now() }, 'offlineLease');
  await transactionDone(transaction);
}

function validateOptimisticEntry({ operation } = {}) {
  if (!operation?.operationId || !operation.ownerKey) {
    throw new Error('A durable operation ID and owner are required');
  }
  if (!operation.entityType || !operation.clientId || operation.generation == null) {
    throw new Error('A durable operation entity and generation are required');
  }
}

async function enqueueOptimisticEntry(
  transaction,
  { operation, optimisticEntity, confirmedBase }
) {
  const outbox = transaction.objectStore('outbox');
  const related = await requestResult(
    outbox
      .index('by_owner_entity')
      .getAll([operation.ownerKey, operation.entityType, operation.clientId])
  );
  const activeRelated = related
    .filter((candidate) => ACTIVE_OUTBOX_STATUSES.includes(candidate.status))
    .sort((left, right) => left.createdAt - right.createdAt);
  let predecessor = activeRelated[activeRelated.length - 1];
  let effectiveBase = confirmedBase ?? null;

  if (operation.mutationName === 'habitEntries:setDesiredState' && activeRelated.length) {
    const syncingOperations = activeRelated.filter(
      (candidate) => candidate.status === 'syncing'
    );
    const syncingPredecessor = syncingOperations[syncingOperations.length - 1];

    if (syncingPredecessor) {
      predecessor = syncingPredecessor;
      activeRelated
        .filter((candidate) => candidate.operationId !== syncingPredecessor.operationId)
        .forEach((candidate) =>
          outbox.put({
            ...candidate,
            status: 'superseded',
            supersededBy: operation.operationId,
          })
        );
    } else {
      const conflicted = [...activeRelated]
        .reverse()
        .find((candidate) => candidate.status === 'conflict');
      effectiveBase = conflicted
        ? (conflicted.conflict?.serverRecord ?? null)
        : (activeRelated[0].baseRecord ?? effectiveBase);
      activeRelated.forEach((candidate) =>
        outbox.put({
          ...candidate,
          status: 'superseded',
          supersededBy: operation.operationId,
        })
      );
      predecessor = null;
    }
  }

  await requestResult(
    outbox.add({
      ...operation,
      ...(predecessor ? { dependsOnOperationId: predecessor.operationId } : {}),
      baseRecord: effectiveBase,
      attemptedRecord: optimisticEntity ?? null,
      status: 'pending',
      createdAt: operation.createdAt || Date.now(),
      retryCount: 0,
    })
  );
  if (optimisticEntity) {
    transaction.objectStore('entities').put({
      ...optimisticEntity,
      ownerKey: operation.ownerKey,
      generation: operation.generation,
      entityType: operation.entityType,
      clientId: operation.clientId,
      optimistic: true,
      updatedAt: optimisticEntity.updatedAt || Date.now(),
    });
  }
}

/**
 * Commits every optimistic entity and outbox operation produced by one state
 * action in a single IndexedDB transaction. If any entry fails, none of the
 * action becomes durable.
 */
export async function commitOptimisticOperations(entries) {
  if (!Array.isArray(entries)) throw new Error('Optimistic operations must be an array');
  if (!entries.length) return;
  entries.forEach(validateOptimisticEntry);

  const operationIds = new Set();
  entries.forEach(({ operation }) => {
    if (operationIds.has(operation.operationId)) {
      throw new Error(`Duplicate durable operation ID: ${operation.operationId}`);
    }
    operationIds.add(operation.operationId);
  });

  const db = await openOfflineDb();
  const transaction = db.transaction(['entities', 'outbox'], 'readwrite');
  const done = transactionDone(transaction);
  try {
    for (const entry of entries) {
      // IndexedDB keeps a transaction active while its queued request resolves.
      // Sequential processing also preserves predecessor order within a batch.
      // eslint-disable-next-line no-await-in-loop
      await enqueueOptimisticEntry(transaction, entry);
    }
  } catch (error) {
    try {
      transaction.abort();
    } catch (_) {
      // The request that failed may already have aborted the transaction.
    }
    try {
      await done;
    } catch (_) {
      // Preserve the original request or validation error.
    }
    throw error;
  }
  await done;
}

export async function commitOptimisticOperation(entry) {
  await commitOptimisticOperations([entry]);
}

/**
 * Applies a remote delta without rewriting byte-identical cache records.
 * Optimistic rows win until their durable outbox successor is confirmed.
 */
export async function applyConfirmedEntityChanges(
  ownerKey,
  generation,
  entityType,
  records,
  { preserveOptimistic = true } = {}
) {
  const db = await openOfflineDb();
  const transaction = db.transaction('entities', 'readwrite');
  const store = transaction.objectStore('entities');
  const done = transactionDone(transaction);
  const keys = records.map((record) => [
    ownerKey,
    generation,
    entityType,
    record.clientId || entityType,
  ]);
  const currentRecords = await Promise.all(
    keys.map((key) => requestResult(store.get(key)))
  );
  const result = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    preservedOptimistic: 0,
  };
  records.forEach((record, index) => {
    const current = currentRecords[index];
    if (preserveOptimistic && current?.optimistic) {
      result.preservedOptimistic += 1;
      return;
    }
    const next = confirmedEntity(ownerKey, generation, entityType, record, current);
    if (current && recordsEqual(current, next)) {
      result.unchanged += 1;
      return;
    }
    store.put(next);
    if (current) result.updated += 1;
    else result.inserted += 1;
  });
  await done;
  return result;
}

/**
 * Reconciles an authoritative whole-type or caller-defined window. Confirmed
 * cache rows absent from the result are removed, while optimistic rows survive.
 * `isInScope` must describe the same window used to obtain `records`.
 */
export async function replaceConfirmedEntities(
  ownerKey,
  generation,
  entityType,
  records,
  { preserveOptimistic = true, isInScope = () => true } = {}
) {
  const db = await openOfflineDb();
  const transaction = db.transaction('entities', 'readwrite');
  const store = transaction.objectStore('entities');
  const done = transactionDone(transaction);
  const currentRecords = await requestResult(
    store.index('by_owner_generation_type').getAll([ownerKey, generation, entityType])
  );
  const currentById = new Map(currentRecords.map((record) => [record.clientId, record]));
  const incomingIds = new Set();
  const result = {
    inserted: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    preservedOptimistic: 0,
  };

  try {
    records.forEach((record) => {
      const clientId = record.clientId || entityType;
      incomingIds.add(clientId);
      const current = currentById.get(clientId);
      if (preserveOptimistic && current?.optimistic) {
        result.preservedOptimistic += 1;
        return;
      }
      const next = confirmedEntity(ownerKey, generation, entityType, record, current);
      if (current && recordsEqual(current, next)) {
        result.unchanged += 1;
        return;
      }
      store.put(next);
      if (current) result.updated += 1;
      else result.inserted += 1;
    });

    currentRecords.forEach((current) => {
      if (!isInScope(current) || incomingIds.has(current.clientId)) return;
      if (preserveOptimistic && current.optimistic) {
        result.preservedOptimistic += 1;
        return;
      }
      store.delete([ownerKey, generation, entityType, current.clientId]);
      result.deleted += 1;
    });
  } catch (error) {
    try {
      transaction.abort();
    } catch (_) {
      // The transaction may already have aborted.
    }
    try {
      await done;
    } catch (_) {
      // Preserve the caller's scope or record error.
    }
    throw error;
  }
  await done;
  return result;
}

export async function getSyncMetadata(ownerKey) {
  const db = await openOfflineDb();
  const transaction = db.transaction('syncMetadata', 'readonly');
  const value = await requestResult(
    transaction.objectStore('syncMetadata').get(ownerKey)
  );
  await transactionDone(transaction);
  return value || null;
}

export async function putSyncMetadata(ownerKey, patch) {
  const db = await openOfflineDb();
  const transaction = db.transaction('syncMetadata', 'readwrite');
  const store = transaction.objectStore('syncMetadata');
  const current = (await requestResult(store.get(ownerKey))) || { ownerKey };
  store.put({ ...current, ...patch, ownerKey });
  await transactionDone(transaction);
}

export async function listCachedEntities(ownerKey, generation, entityType) {
  const db = await openOfflineDb();
  const transaction = db.transaction('entities', 'readonly');
  const index = transaction.objectStore('entities').index('by_owner_generation_type');
  const result = await requestResult(index.getAll([ownerKey, generation, entityType]));
  await transactionDone(transaction);
  return result;
}

export async function listOutbox(ownerKey, statuses = DEFAULT_OUTBOX_STATUSES) {
  if (!statuses.length) return [];
  const db = await openOfflineDb();
  const transaction = db.transaction('outbox', 'readonly');
  const done = transactionDone(transaction);
  const index = transaction.objectStore('outbox').index('by_owner_status_createdAt');
  const uniqueStatuses = [...new Set(statuses)];
  const queries = uniqueStatuses.map((status) =>
    requestResult(
      index.getAll(
        IDBKeyRange.bound(
          [ownerKey, status, 0],
          [ownerKey, status, Number.MAX_SAFE_INTEGER]
        )
      )
    )
  );
  const results = (await Promise.all(queries)).flat();
  await done;
  return results.sort(
    (left, right) =>
      left.createdAt - right.createdAt ||
      String(left.operationId).localeCompare(String(right.operationId))
  );
}

export async function patchOutboxOperation(operationId, patch) {
  const db = await openOfflineDb();
  const transaction = db.transaction('outbox', 'readwrite');
  const store = transaction.objectStore('outbox');
  const current = await requestResult(store.get(operationId));
  if (current) store.put({ ...current, ...patch });
  await transactionDone(transaction);
}

export async function confirmOperation(operationId, canonicalRecord) {
  const db = await openOfflineDb();
  const transaction = db.transaction(['entities', 'outbox'], 'readwrite');
  const outbox = transaction.objectStore('outbox');
  const operation = await requestResult(outbox.get(operationId));
  if (!operation) {
    await transactionDone(transaction);
    return { confirmed: false, hasPendingSuccessor: false };
  }
  const related = await requestResult(
    outbox
      .index('by_owner_entity')
      .getAll([operation.ownerKey, operation.entityType, operation.clientId])
  );
  const activeSuccessors = related.filter(
    (candidate) =>
      candidate.operationId !== operationId &&
      ACTIVE_OUTBOX_STATUSES.includes(candidate.status)
  );
  if (canonicalRecord && !activeSuccessors.length) {
    transaction.objectStore('entities').put({
      ...canonicalRecord,
      ownerKey: operation.ownerKey,
      generation: operation.generation,
      entityType: operation.entityType,
      clientId: operation.clientId,
      optimistic: false,
      updatedAt: canonicalRecord.updatedAt || Date.now(),
    });
  }
  activeSuccessors
    .filter((candidate) => candidate.dependsOnOperationId === operationId)
    .forEach((candidate) => {
      const rebased = { ...candidate };
      delete rebased.dependsOnOperationId;
      outbox.put({
        ...rebased,
        baseRecord: canonicalRecord ?? null,
      });
    });
  const activelyDependedOnIds = new Set(
    related
      .filter(
        (candidate) =>
          candidate.operationId !== operationId &&
          ACTIVE_OUTBOX_STATUSES.includes(candidate.status)
      )
      .map((candidate) => candidate.dependsOnOperationId)
      .filter(Boolean)
  );
  const confirmedChain = new Set([operationId]);
  let foundAncestor = true;
  while (foundAncestor) {
    foundAncestor = false;
    related.forEach((candidate) => {
      if (
        candidate.status === 'superseded' &&
        confirmedChain.has(candidate.supersededBy) &&
        !activelyDependedOnIds.has(candidate.operationId) &&
        !confirmedChain.has(candidate.operationId)
      ) {
        confirmedChain.add(candidate.operationId);
        foundAncestor = true;
      }
    });
  }
  confirmedChain.forEach((confirmedOperationId) => {
    if (confirmedOperationId !== operationId) outbox.delete(confirmedOperationId);
  });
  outbox.delete(operationId);
  await transactionDone(transaction);
  return {
    confirmed: true,
    hasPendingSuccessor: activeSuccessors.length > 0,
  };
}

export async function purgeAccountCache(ownerKey) {
  const db = await openOfflineDb();
  const transaction = db.transaction(
    ['entities', 'outbox', 'syncMetadata'],
    'readwrite'
  );
  const entities = transaction.objectStore('entities');
  const outbox = transaction.objectStore('outbox');
  const done = transactionDone(transaction);
  transaction.objectStore('syncMetadata').delete(ownerKey);
  await Promise.all([
    deleteByIndex(entities, 'by_owner', ownerKey),
    deleteByIndex(outbox, 'by_owner', ownerKey),
  ]);
  await done;
}
