import { generateUuid } from '../shared/common.js';

const DB_NAME = 'habitsConvexCache';
const DB_VERSION = 1;
const LEASE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
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

export async function commitOptimisticOperation({
  operation,
  optimisticEntity,
  confirmedBase,
}) {
  if (!operation?.operationId || !operation.ownerKey) {
    throw new Error('A durable operation ID and owner are required');
  }
  const db = await openOfflineDb();
  const transaction = db.transaction(['entities', 'outbox'], 'readwrite');
  const outbox = transaction.objectStore('outbox');
  const related = await requestResult(
    outbox
      .index('by_owner_entity')
      .getAll([operation.ownerKey, operation.entityType, operation.clientId])
  );
  const activeRelated = related
    .filter((candidate) =>
      ['pending', 'retry', 'syncing', 'conflict'].includes(candidate.status)
    )
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

  outbox.add({
    ...operation,
    ...(predecessor ? { dependsOnOperationId: predecessor.operationId } : {}),
    baseRecord: effectiveBase,
    attemptedRecord: optimisticEntity ?? null,
    status: 'pending',
    createdAt: operation.createdAt || Date.now(),
    retryCount: 0,
  });
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
  await transactionDone(transaction);
}

export async function putConfirmedEntities(ownerKey, generation, entityType, records) {
  const db = await openOfflineDb();
  const transaction = db.transaction('entities', 'readwrite');
  const store = transaction.objectStore('entities');
  records.forEach((record) => {
    store.put({
      ...record,
      ownerKey,
      generation,
      entityType,
      clientId: record.clientId || entityType,
      optimistic: false,
      updatedAt: record.updatedAt || Date.now(),
    });
  });
  await transactionDone(transaction);
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

export async function listOutbox(ownerKey, statuses = ['pending', 'retry', 'conflict']) {
  const db = await openOfflineDb();
  const transaction = db.transaction('outbox', 'readonly');
  const all = await requestResult(transaction.objectStore('outbox').getAll());
  await transactionDone(transaction);
  return all
    .filter((operation) => operation.ownerKey === ownerKey && statuses.includes(operation.status))
    .sort((left, right) => left.createdAt - right.createdAt);
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
      ['pending', 'retry', 'syncing', 'conflict'].includes(candidate.status)
  );
  if (canonicalRecord) {
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
  outbox.delete(operationId);
  await transactionDone(transaction);
  return {
    confirmed: true,
    hasPendingSuccessor: activeSuccessors.length > 0,
  };
}

export async function saveMigrationBackup(backup) {
  const db = await openOfflineDb();
  const transaction = db.transaction('migrationBackups', 'readwrite');
  transaction.objectStore('migrationBackups').put({
    ...backup,
    backupId: backup.backupId || generateUuid(),
    createdAt: backup.createdAt || Date.now(),
    verificationState: backup.verificationState || 'unverified',
  });
  await transactionDone(transaction);
}

export async function purgeAccountCache(ownerKey) {
  const db = await openOfflineDb();
  const transaction = db.transaction(
    ['entities', 'outbox', 'syncMetadata'],
    'readwrite'
  );
  const entities = transaction.objectStore('entities');
  const outbox = transaction.objectStore('outbox');
  const entityRecords = await requestResult(entities.getAll());
  const operations = await requestResult(outbox.getAll());
  entityRecords
    .filter((record) => record.ownerKey === ownerKey)
    .forEach((record) =>
      entities.delete([record.ownerKey, record.generation, record.entityType, record.clientId])
    );
  operations
    .filter((operation) => operation.ownerKey === ownerKey)
    .forEach((operation) => outbox.delete(operation.operationId));
  transaction.objectStore('syncMetadata').delete(ownerKey);
  await transactionDone(transaction);
}
