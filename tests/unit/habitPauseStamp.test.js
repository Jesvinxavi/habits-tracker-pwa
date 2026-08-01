/**
 * Pausing a habit has to record *when*, or statistics cannot tell a habit that
 * was never kept from one kept for a year and then deliberately put down.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionTypes, dispatch, getState } from '../../src/core/state.js';
import { persistStateAction } from '../../src/core/persistenceRouter.js';

const committed = [];

vi.mock('../../src/core/offlineDb.js', () => ({
  commitOptimisticOperations: vi.fn(async (entries) => {
    committed.push(...entries);
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

/**
 * Applies a habit update through the reducer, which is what the screen renders
 * from.
 * @param {object} updates Fields to change.
 * @returns {void}
 */
function updateHabit(updates) {
  dispatch({
    type: ActionTypes.UPDATE_HABIT,
    payload: { habitId: 'habit-1', updates },
    meta: { source: 'device' },
  });
}

/**
 * Applies the same update through the persistence router, which is what gets
 * written to the outbox and synced.
 *
 * Testing only the reducer is how this went wrong: `dispatch` persists *before*
 * it commits the reducer, so whatever the reducer stamps is invisible to the
 * write. Both paths have to be asserted, and they have to agree.
 *
 * @param {object} updates Fields to change.
 * @param {object} habit The habit as it stands before the update.
 * @returns {Promise<object>} The queued habits payload.
 */
async function persistUpdate(updates, habit = HABIT) {
  committed.length = 0;
  await persistStateAction(
    { type: ActionTypes.UPDATE_HABIT, payload: { habitId: habit.id, updates } },
    { habits: [habit], categories: [] }
  );
  return committed[0].operation.payload;
}

const HABIT = {
  id: 'habit-1',
  name: 'Meditate',
  categoryId: 'cat-health',
  icon: '🧘',
  paused: false,
  activeOnHolidays: false,
  frequency: 'daily',
  createdAt: '2026-01-01T00:00:00.000',
  completed: {},
  skippedDates: [],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 15, 12));
  dispatch({ type: ActionTypes.RESET_STATE, meta: { source: 'test' } });
  dispatch({
    type: ActionTypes.HYDRATE_CACHE,
    payload: { habits: [HABIT], categories: [] },
    meta: { source: 'test' },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/** @returns {object} The habit under test, as it currently stands. */
const habit = () => getState().habits.find((entry) => entry.id === 'habit-1');

describe('pausing a habit', () => {
  it('records the moment the pause began', () => {
    updateHabit({ paused: true });

    expect(habit().paused).toBe(true);
    expect(habit().pausedAt).toBe(Date.now());
  });

  it('clears the stamp when the habit starts again', () => {
    updateHabit({ paused: true });
    updateHabit({ paused: false });

    expect(habit().paused).toBe(false);
    expect(habit().pausedAt).toBeUndefined();
  });

  it('does not move the stamp when an already-paused habit is edited', () => {
    updateHabit({ paused: true });
    const pausedAt = habit().pausedAt;

    vi.setSystemTime(new Date(2026, 6, 20, 12));
    updateHabit({ name: 'Meditate daily' });

    expect(habit().pausedAt).toBe(pausedAt);
  });

  it('respects a stamp supplied explicitly, as a sync would', () => {
    const supplied = new Date(2026, 5, 1).getTime();
    updateHabit({ paused: true, pausedAt: supplied });

    expect(habit().pausedAt).toBe(supplied);
  });

  it('stamps a habit that is created already paused', () => {
    dispatch({
      type: ActionTypes.ADD_HABIT,
      payload: { ...HABIT, id: 'habit-2', paused: true },
      meta: { source: 'device' },
    });

    const created = getState().habits.find((entry) => entry.id === 'habit-2');
    expect(created.pausedAt).toBe(Date.now());
  });

  it('stamps afresh when a habit is paused, resumed and paused again', () => {
    updateHabit({ paused: true });
    updateHabit({ paused: false });

    vi.setSystemTime(new Date(2026, 6, 20, 12));
    updateHabit({ paused: true });

    expect(habit().pausedAt).toBe(Date.now());
  });
});

describe('pausing a habit, as written to the outbox', () => {
  it('carries the stamp into the queued operation', async () => {
    const payload = await persistUpdate({ paused: true });

    expect(payload.paused).toBe(true);
    expect(payload.pausedAt).toBe(Date.now());
  });

  it('agrees with what the reducer put on screen', async () => {
    updateHabit({ paused: true });
    const payload = await persistUpdate({ paused: true });

    expect(payload.pausedAt).toBe(habit().pausedAt);
  });

  it('omits the stamp when the habit starts again', async () => {
    const paused = { ...HABIT, paused: true, pausedAt: new Date(2026, 5, 1).getTime() };
    const payload = await persistUpdate({ paused: false }, paused);

    expect(payload.paused).toBe(false);
    expect(payload.pausedAt).toBeUndefined();
  });

  it('stamps a habit that is created already paused', async () => {
    committed.length = 0;
    await persistStateAction(
      {
        type: ActionTypes.ADD_HABIT,
        payload: { ...HABIT, id: 'habit-2', paused: true },
      },
      { habits: [HABIT], categories: [] }
    );

    expect(committed[0].operation.payload.pausedAt).toBe(Date.now());
  });

  it('leaves a habit created running without a stamp', async () => {
    committed.length = 0;
    await persistStateAction(
      { type: ActionTypes.ADD_HABIT, payload: { ...HABIT, id: 'habit-2' } },
      { habits: [HABIT], categories: [] }
    );

    expect(committed[0].operation.payload.pausedAt).toBeUndefined();
  });

  it('re-stamps rather than trusting a stamp left over from an earlier pause', async () => {
    // The backend keeps the old value through a resume — `db.patch` cannot
    // remove a field the payload omits — so a habit paused again would
    // otherwise be dated to the pause before last.
    const resumed = { ...HABIT, paused: false, pausedAt: new Date(2026, 5, 1).getTime() };
    const payload = await persistUpdate({ paused: true }, resumed);

    expect(payload.pausedAt).toBe(Date.now());
  });
});
