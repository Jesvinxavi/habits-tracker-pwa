import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistStateAction } from '../../src/core/persistenceRouter.js';
import { ActionTypes } from '../../src/core/state.js';

const committed = [];

vi.mock('../../src/core/offlineDb.js', () => ({
  commitOptimisticOperation: vi.fn(async (entry) => {
    committed.push(entry);
  }),
}));

vi.mock('../../src/core/cloudRuntime.js', () => ({
  getCloudRuntime: () => ({
    ownerKey: 'owner',
    generation: 1,
    deviceId: 'device',
    writeBlocked: false,
    syncEngine: { requestReplay: () => {} },
  }),
}));

describe('SET_ACTIVE_PROGRAM operations', () => {
  beforeEach(() => {
    committed.length = 0;
  });

  const baseState = {
    programs: [
      {
        id: 'p1',
        name: 'One',
        startDate: '2026-01-01',
        endDate: '2026-02-01',
        scheduledDays: [{ dayOfWeek: 1, routineId: 'r1' }],
        active: true,
        createdAt: '2026-01-01',
        revision: 4,
      },
      {
        id: 'p2',
        name: 'Two',
        startDate: '2026-03-01',
        endDate: '2026-04-01',
        scheduledDays: [],
        active: false,
        createdAt: '2026-01-01',
        revision: 2,
      },
      {
        id: 'p3',
        name: 'Three',
        startDate: '2026-05-01',
        endDate: '2026-06-01',
        scheduledDays: [],
        active: false,
        createdAt: '2026-01-01',
        revision: 1,
      },
    ],
  };

  it('writes only the two programs whose active flag flips', async () => {
    await persistStateAction(
      { type: ActionTypes.SET_ACTIVE_PROGRAM, payload: 'p2' },
      baseState
    );
    expect(committed).toHaveLength(2);
    const byId = Object.fromEntries(
      committed.map((entry) => [entry.operation.clientId, entry])
    );
    expect(Object.keys(byId).sort()).toEqual(['p1', 'p2']);
    expect(byId.p1.operation.payload.active).toBe(false);
    expect(byId.p1.confirmedBase.revision).toBe(4);
    expect(byId.p2.operation.payload.active).toBe(true);
    expect(byId.p2.confirmedBase.revision).toBe(2);
    expect(byId.p2.operation.mutationName).toBe('programs:update');
    expect(byId.p2.operation.payload.scheduledDays).toEqual([]);
  });

  it('writes nothing when the flag is already correct', async () => {
    await persistStateAction(
      { type: ActionTypes.SET_ACTIVE_PROGRAM, payload: 'p1' },
      baseState
    );
    expect(committed).toHaveLength(0);
  });

  it('deactivates only the active program for a null payload', async () => {
    await persistStateAction(
      { type: ActionTypes.SET_ACTIVE_PROGRAM, payload: null },
      baseState
    );
    expect(committed).toHaveLength(1);
    expect(committed[0].operation.clientId).toBe('p1');
    expect(committed[0].operation.payload.active).toBe(false);
  });

  it('emits create and update operations for routines, archiving included', async () => {
    const state = {
      routines: [
        {
          id: 'r1',
          name: 'Push',
          activityIds: ['a1'],
          createdAt: '2026-01-01',
          revision: 7,
        },
      ],
    };
    await persistStateAction(
      { type: ActionTypes.ADD_ROUTINE, payload: { id: 'r2', name: 'Pull', activityIds: [], createdAt: '2026-02-02' } },
      state
    );
    await persistStateAction(
      { type: ActionTypes.UPDATE_ROUTINE, payload: { routineId: 'r1', updates: { name: 'Push A' } } },
      state
    );
    // Removing a routine from the list archives it: an update carrying
    // archivedAt, never routines:removeCascade, which would take the days it
    // was planned on with it.
    await persistStateAction(
      {
        type: ActionTypes.UPDATE_ROUTINE,
        payload: { routineId: 'r1', updates: { archivedAt: 1767225600000 } },
      },
      state
    );

    expect(committed.map((entry) => entry.operation.mutationName)).toEqual([
      'routines:create',
      'routines:update',
      'routines:update',
    ]);
    expect(committed[2].operation.payload.archivedAt).toBe(1767225600000);
    // A routine that has never been archived leaves the field unset.
    expect(committed[1].operation.payload).not.toHaveProperty('archivedAt');
    expect(committed[0].operation.payload.revision).toBeUndefined();
    expect(committed[0].operation.payload.sortOrder).toBe(1);
    expect(committed[1].operation.payload.name).toBe('Push A');
    expect(committed[1].confirmedBase.revision).toBe(7);
    expect(committed[2].optimisticEntity.deletedAt).toBeUndefined();
  });

  it('queues every record from a multi-activity action in deterministic order', async () => {
    const records = [
      {
        id: 'record-1',
        activityId: 'activity-1',
        date: '2026-07-29',
        timestamp: '2026-07-29T10:00:00.000Z',
      },
      {
        id: 'record-2',
        activityId: 'activity-2',
        date: '2026-07-29',
        timestamp: '2026-07-29T10:00:00.000Z',
      },
    ];

    await persistStateAction(
      {
        type: ActionTypes.RECORD_ACTIVITIES,
        payload: { date: '2026-07-29', records },
      },
      {}
    );

    expect(committed).toHaveLength(2);
    expect(committed.map((entry) => entry.operation.clientId)).toEqual(['record-1', 'record-2']);
    expect(committed.every((entry) => entry.operation.mutationName === 'activityRecords:create')).toBe(
      true
    );
  });
});
