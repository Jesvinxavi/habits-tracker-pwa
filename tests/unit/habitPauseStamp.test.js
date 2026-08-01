/**
 * Pausing a habit has to record *when*, or statistics cannot tell a habit that
 * was never kept from one kept for a year and then deliberately put down.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionTypes, dispatch, getState } from '../../src/core/state.js';

/**
 * Applies a habit update straight through the reducer, which is where the
 * stamping lives; the full dispatch path needs a persistence runtime that a
 * unit test has no business standing up.
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
});
