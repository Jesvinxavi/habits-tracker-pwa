import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyConfirmedEntityChanges,
  commitOptimisticOperation,
  commitOptimisticOperations,
  confirmOperation,
  getSyncMetadata,
  listCachedEntities,
  listOutbox,
  openOfflineDb,
  patchOutboxOperation,
  purgeAccountCache,
  putSyncMetadata,
  readOfflineLease,
  replaceConfirmedEntities,
  renewOfflineLease,
  resetOfflineDbConnectionForTests,
  revokeOfflineLease,
} from '../../src/core/offlineDb.js';

function deleteOfflineDatabase() {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('habitsConvexCache');
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = transaction.onabort = () =>
      reject(transaction.error || new Error('Test transaction failed'));
  });
}

beforeEach(async () => {
  await resetOfflineDbConnectionForTests();
  await deleteOfflineDatabase();
  await openOfflineDb();
});

describe('offline database upgrades', () => {
  it('adds owner indexes to version 1 without deleting existing data or backups', async () => {
    await resetOfflineDbConnectionForTests();
    await deleteOfflineDatabase();
    const versionOne = await new Promise((resolve, reject) => {
      const request = indexedDB.open('habitsConvexCache', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const entities = db.createObjectStore('entities', {
          keyPath: ['ownerKey', 'generation', 'entityType', 'clientId'],
        });
        entities.createIndex(
          'by_owner_generation_type',
          ['ownerKey', 'generation', 'entityType']
        );
        entities.createIndex(
          'by_owner_generation_updatedAt',
          ['ownerKey', 'generation', 'updatedAt']
        );
        const outbox = db.createObjectStore('outbox', { keyPath: 'operationId' });
        outbox.createIndex('by_owner_status_createdAt', [
          'ownerKey',
          'status',
          'createdAt',
        ]);
        outbox.createIndex('by_owner_entity', [
          'ownerKey',
          'entityType',
          'clientId',
        ]);
        outbox.createIndex('by_dependency', 'dependsOnOperationId');
        db.createObjectStore('syncMetadata', { keyPath: 'ownerKey' });
        db.createObjectStore('deviceMetadata');
        db.createObjectStore('migrationBackups', { keyPath: 'backupId' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const seed = versionOne.transaction(
      ['entities', 'outbox', 'migrationBackups'],
      'readwrite'
    );
    seed.objectStore('entities').put({
      ownerKey: 'owner',
      generation: 1,
      entityType: 'habits',
      clientId: 'habit-1',
      updatedAt: 1,
    });
    seed.objectStore('outbox').put({
      operationId: 'pending-1',
      ownerKey: 'owner',
      status: 'pending',
      createdAt: 1,
      entityType: 'habits',
      clientId: 'habit-1',
    });
    seed.objectStore('migrationBackups').put({
      backupId: 'backup-1',
      ownerKey: 'owner',
    });
    await transactionComplete(seed);
    versionOne.close();

    const upgraded = await openOfflineDb();
    expect(upgraded.version).toBe(2);
    expect(
      upgraded.transaction('entities').objectStore('entities').indexNames.contains('by_owner')
    ).toBe(true);
    expect(
      upgraded.transaction('outbox').objectStore('outbox').indexNames.contains('by_owner')
    ).toBe(true);
    expect(await listCachedEntities('owner', 1, 'habits')).toHaveLength(1);
    expect(await listOutbox('owner')).toHaveLength(1);
    const readBackup = upgraded.transaction('migrationBackups', 'readonly');
    const backup = await new Promise((resolve, reject) => {
      const request = readBackup.objectStore('migrationBackups').get('backup-1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await transactionComplete(readBackup);
    expect(backup).toMatchObject({ backupId: 'backup-1', ownerKey: 'owner' });
  });
});

describe('offline authorization lease', () => {
  it('expires after thirty days and is revoked by sign-out', async () => {
    const now = Date.parse('2025-01-01T00:00:00Z');
    await renewOfflineLease({ ownerKey: 'owner', clerkUserId: 'user', now });
    expect((await readOfflineLease(now + 29 * 86400000)).valid).toBe(true);
    expect((await readOfflineLease(now + 31 * 86400000)).valid).toBe(false);
    await revokeOfflineLease();
    expect((await readOfflineLease(now)).valid).toBe(false);
  });
});

describe('offline transactions', () => {
  it('durably stores the operation and optimistic entity together', async () => {
    await commitOptimisticOperation({
      operation: {
        operationId: 'op-1',
        ownerKey: 'owner',
        generation: 2,
        entityType: 'habits',
        clientId: 'habit-1',
        mutationName: 'habits:create',
      },
      confirmedBase: null,
      optimisticEntity: { clientId: 'habit-1', name: 'Walk', revision: 0 },
    });
    expect(await listOutbox('owner')).toHaveLength(1);
    expect(await listCachedEntities('owner', 2, 'habits')).toEqual([
      expect.objectContaining({ clientId: 'habit-1', optimistic: true }),
    ]);
  });

  it('counts an in-flight operation as unconfirmed by default', async () => {
    await commitOptimisticOperation({
      operation: {
        operationId: 'in-flight',
        ownerKey: 'owner',
        generation: 2,
        entityType: 'habits',
        clientId: 'habit-1',
        mutationName: 'habits:update',
      },
      confirmedBase: { clientId: 'habit-1', revision: 1 },
      optimisticEntity: { clientId: 'habit-1', revision: 1 },
    });
    await patchOutboxOperation('in-flight', { status: 'syncing' });

    expect(await listOutbox('owner')).toEqual([
      expect.objectContaining({ operationId: 'in-flight', status: 'syncing' }),
    ]);
  });

  it('commits every operation from one action atomically', async () => {
    await commitOptimisticOperations([
      {
        operation: {
          operationId: 'batch-1',
          ownerKey: 'owner',
          generation: 2,
          entityType: 'activityRecords',
          clientId: 'record-1',
          mutationName: 'activityRecords:create',
        },
        confirmedBase: null,
        optimisticEntity: { clientId: 'record-1', revision: 0 },
      },
      {
        operation: {
          operationId: 'batch-2',
          ownerKey: 'owner',
          generation: 2,
          entityType: 'activityRecords',
          clientId: 'record-2',
          mutationName: 'activityRecords:create',
        },
        confirmedBase: null,
        optimisticEntity: { clientId: 'record-2', revision: 0 },
      },
    ]);

    expect((await listOutbox('owner')).map((operation) => operation.operationId)).toEqual([
      'batch-1',
      'batch-2',
    ]);
    expect(
      (await listCachedEntities('owner', 2, 'activityRecords')).map(
        (record) => record.clientId
      )
    ).toEqual(['record-1', 'record-2']);
  });

  it('rolls back the whole action when a later outbox write fails', async () => {
    await commitOptimisticOperation({
      operation: {
        operationId: 'already-durable',
        ownerKey: 'owner',
        generation: 2,
        entityType: 'activities',
        clientId: 'existing',
        mutationName: 'activities:create',
      },
      confirmedBase: null,
      optimisticEntity: { clientId: 'existing', revision: 0 },
    });

    await expect(
      commitOptimisticOperations([
        {
          operation: {
            operationId: 'would-be-partial',
            ownerKey: 'owner',
            generation: 2,
            entityType: 'activities',
            clientId: 'new',
            mutationName: 'activities:create',
          },
          confirmedBase: null,
          optimisticEntity: { clientId: 'new', revision: 0 },
        },
        {
          operation: {
            operationId: 'already-durable',
            ownerKey: 'owner',
            generation: 2,
            entityType: 'activities',
            clientId: 'duplicate',
            mutationName: 'activities:create',
          },
          confirmedBase: null,
          optimisticEntity: { clientId: 'duplicate', revision: 0 },
        },
      ])
    ).rejects.toBeTruthy();

    expect((await listOutbox('owner')).map((operation) => operation.operationId)).toEqual([
      'already-durable',
    ]);
    expect(
      (await listCachedEntities('owner', 2, 'activities')).map((record) => record.clientId)
    ).toEqual(['existing']);
  });

  it('skips unchanged remote rows and preserves an optimistic successor', async () => {
    const first = await applyConfirmedEntityChanges('owner', 2, 'habits', [
      { clientId: 'confirmed', name: 'Walk', revision: 1, updatedAt: 100 },
    ]);
    const unchanged = await applyConfirmedEntityChanges('owner', 2, 'habits', [
      { updatedAt: 100, revision: 1, name: 'Walk', clientId: 'confirmed' },
    ]);
    await commitOptimisticOperation({
      operation: {
        operationId: 'optimistic-edit',
        ownerKey: 'owner',
        generation: 2,
        entityType: 'habits',
        clientId: 'optimistic',
        mutationName: 'habits:update',
      },
      confirmedBase: { clientId: 'optimistic', name: 'Old', revision: 1 },
      optimisticEntity: { clientId: 'optimistic', name: 'Local', revision: 1 },
    });
    const preserved = await applyConfirmedEntityChanges('owner', 2, 'habits', [
      { clientId: 'optimistic', name: 'Remote', revision: 2, updatedAt: 200 },
    ]);

    expect(first.inserted).toBe(1);
    expect(unchanged.unchanged).toBe(1);
    expect(preserved.preservedOptimistic).toBe(1);
    expect(
      (await listCachedEntities('owner', 2, 'habits')).find(
        (record) => record.clientId === 'optimistic'
      )
    ).toMatchObject({ name: 'Local', optimistic: true });
  });

  it('authoritatively replaces a scope without deleting optimistic rows', async () => {
    await applyConfirmedEntityChanges('owner', 2, 'activityRecords', [
      { clientId: 'keep', dateKey: '2026-07-30', revision: 1 },
      { clientId: 'stale', dateKey: '2026-07-30', revision: 1 },
      { clientId: 'outside', dateKey: '2026-07-29', revision: 1 },
    ]);
    await commitOptimisticOperation({
      operation: {
        operationId: 'local-record',
        ownerKey: 'owner',
        generation: 2,
        entityType: 'activityRecords',
        clientId: 'optimistic',
        mutationName: 'activityRecords:create',
      },
      confirmedBase: null,
      optimisticEntity: {
        clientId: 'optimistic',
        dateKey: '2026-07-30',
        revision: 0,
      },
    });

    const result = await replaceConfirmedEntities(
      'owner',
      2,
      'activityRecords',
      [{ clientId: 'keep', dateKey: '2026-07-30', revision: 2 }],
      {
        isInScope: (record) => record.dateKey === '2026-07-30',
      }
    );
    const cachedIds = (await listCachedEntities('owner', 2, 'activityRecords'))
      .map((record) => record.clientId)
      .sort();

    expect(result).toMatchObject({
      updated: 1,
      deleted: 1,
      preservedOptimistic: 1,
    });
    expect(cachedIds).toEqual(['keep', 'optimistic', 'outside']);
  });

  it('purges only the selected owner through owner indexes', async () => {
    const entry = (ownerKey) => ({
      operation: {
        operationId: `operation-${ownerKey}`,
        ownerKey,
        generation: 2,
        entityType: 'habits',
        clientId: `habit-${ownerKey}`,
        mutationName: 'habits:create',
      },
      confirmedBase: null,
      optimisticEntity: { clientId: `habit-${ownerKey}`, revision: 0 },
    });
    await commitOptimisticOperation(entry('owner-a'));
    await commitOptimisticOperation(entry('owner-b'));
    await putSyncMetadata('owner-a', { revision: 1 });
    await putSyncMetadata('owner-b', { revision: 2 });

    await purgeAccountCache('owner-a');

    expect(await listOutbox('owner-a')).toEqual([]);
    expect(await listCachedEntities('owner-a', 2, 'habits')).toEqual([]);
    expect(await getSyncMetadata('owner-a')).toBeNull();
    expect(await listOutbox('owner-b')).toHaveLength(1);
    expect(await listCachedEntities('owner-b', 2, 'habits')).toHaveLength(1);
    expect(await getSyncMetadata('owner-b')).toMatchObject({ revision: 2 });
  });

  it('coalesces unsent habit-entry writes into the latest desired state', async () => {
    const operation = (operationId, skipped) => ({
      operation: {
        operationId,
        ownerKey: 'owner',
        generation: 2,
        entityType: 'habitEntries',
        clientId: 'habit-entry:walk:2026-07-30',
        mutationName: 'habitEntries:setDesiredState',
      },
      confirmedBase: null,
      optimisticEntity: {
        clientId: 'habit-entry:walk:2026-07-30',
        habitClientId: 'walk',
        periodKey: '2026-07-30',
        progress: 0,
        completed: false,
        skipped,
        revision: 0,
      },
    });

    await commitOptimisticOperation(operation('skip', true));
    await commitOptimisticOperation(operation('restore', false));

    const queued = await listOutbox('owner');
    expect(queued).toHaveLength(1);
    expect(queued[0].operationId).toBe('restore');
    expect(queued[0].dependsOnOperationId).toBeUndefined();
    expect(queued[0].attemptedRecord.skipped).toBe(false);
  });

  it('removes superseded history after its successor is confirmed', async () => {
    const operation = (operationId, skipped) => ({
      operation: {
        operationId,
        ownerKey: 'owner',
        generation: 2,
        entityType: 'habitEntries',
        clientId: 'habit-entry:walk:2026-07-30',
        mutationName: 'habitEntries:setDesiredState',
      },
      confirmedBase: null,
      optimisticEntity: {
        clientId: 'habit-entry:walk:2026-07-30',
        skipped,
        revision: 0,
      },
    });
    await commitOptimisticOperation(operation('old-state', true));
    await commitOptimisticOperation(operation('middle-state', false));
    await commitOptimisticOperation(operation('latest-state', true));

    expect(
      (await listOutbox('owner', ['superseded']))
        .map((item) => item.operationId)
        .sort()
    ).toEqual(['middle-state', 'old-state']);
    await confirmOperation('latest-state', {
      clientId: 'habit-entry:walk:2026-07-30',
      skipped: true,
      revision: 1,
    });

    expect(await listOutbox('owner', ['superseded'])).toEqual([]);
    expect(await listOutbox('owner')).toEqual([]);
  });

  it('chains behind an in-flight habit entry and rebases on its confirmation', async () => {
    const operation = (operationId, skipped) => ({
      operation: {
        operationId,
        ownerKey: 'owner',
        generation: 2,
        entityType: 'habitEntries',
        clientId: 'habit-entry:walk:2026-07-30',
        mutationName: 'habitEntries:setDesiredState',
      },
      confirmedBase: null,
      optimisticEntity: {
        clientId: 'habit-entry:walk:2026-07-30',
        habitClientId: 'walk',
        periodKey: '2026-07-30',
        progress: 0,
        completed: false,
        skipped,
        revision: 0,
      },
    });

    await commitOptimisticOperation(operation('skip', true));
    await patchOutboxOperation('skip', { status: 'syncing' });
    await commitOptimisticOperation(operation('restore', false));

    let queued = await listOutbox('owner', ['pending', 'syncing']);
    expect(queued.find((item) => item.operationId === 'restore').dependsOnOperationId).toBe(
      'skip'
    );

    const firstConfirmation = await confirmOperation('skip', {
      ...queued.find((item) => item.operationId === 'skip').attemptedRecord,
      revision: 1,
    });
    expect(firstConfirmation.hasPendingSuccessor).toBe(true);

    queued = await listOutbox('owner');
    expect(queued).toHaveLength(1);
    expect(queued[0].operationId).toBe('restore');
    expect(queued[0].dependsOnOperationId).toBeUndefined();
    expect(queued[0].baseRecord).toMatchObject({ skipped: true, revision: 1 });
    expect(await listCachedEntities('owner', 2, 'habitEntries')).toEqual([
      expect.objectContaining({ skipped: false, optimistic: true }),
    ]);

    const finalConfirmation = await confirmOperation('restore', {
      ...queued[0].attemptedRecord,
      revision: 2,
    });
    expect(finalConfirmation.hasPendingSuccessor).toBe(false);
    expect(await listOutbox('owner')).toHaveLength(0);
  });

  it('supersedes a conflicted habit entry using the latest server revision', async () => {
    const baseOperation = {
      operation: {
        operationId: 'conflicted-skip',
        ownerKey: 'owner',
        generation: 2,
        entityType: 'habitEntries',
        clientId: 'habit-entry:walk:2026-07-30',
        mutationName: 'habitEntries:setDesiredState',
      },
      confirmedBase: null,
      optimisticEntity: {
        clientId: 'habit-entry:walk:2026-07-30',
        habitClientId: 'walk',
        periodKey: '2026-07-30',
        progress: 0,
        completed: false,
        skipped: true,
        revision: 0,
      },
    };
    await commitOptimisticOperation(baseOperation);
    await patchOutboxOperation('conflicted-skip', {
      status: 'conflict',
      conflict: {
        serverRecord: {
          ...baseOperation.optimisticEntity,
          skipped: true,
          revision: 4,
        },
      },
    });
    await commitOptimisticOperation({
      ...baseOperation,
      operation: { ...baseOperation.operation, operationId: 'latest-restore' },
      optimisticEntity: { ...baseOperation.optimisticEntity, skipped: false },
    });

    const queued = await listOutbox('owner');
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      operationId: 'latest-restore',
      baseRecord: { skipped: true, revision: 4 },
      attemptedRecord: { skipped: false },
    });
  });
});
