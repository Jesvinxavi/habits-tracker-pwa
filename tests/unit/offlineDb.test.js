import { beforeEach, describe, expect, it } from 'vitest';
import {
  commitOptimisticOperation,
  listCachedEntities,
  listOutbox,
  openOfflineDb,
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
});
