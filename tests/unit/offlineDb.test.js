import { beforeEach, describe, expect, it } from 'vitest';
import {
  commitOptimisticOperation,
  confirmOperation,
  listCachedEntities,
  listOutbox,
  openOfflineDb,
  patchOutboxOperation,
  readOfflineLease,
  renewOfflineLease,
  resetOfflineDbConnectionForTests,
  revokeOfflineLease,
} from '../../src/core/offlineDb.js';

beforeEach(async () => {
  await resetOfflineDbConnectionForTests();
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('habitsConvexCache');
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
  await openOfflineDb();
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
