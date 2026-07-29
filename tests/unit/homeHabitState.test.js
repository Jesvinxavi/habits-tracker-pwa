import { describe, expect, it } from 'vitest';
import { ActionTypes, initialState, reducer } from '../../src/core/state.js';
import {
  getPeriodKey,
  isHabitScheduledOnDate,
  isHabitSkippedToday,
} from '../../src/features/home/schedule.js';

function stateWith(habit) {
  return {
    ...structuredClone(initialState),
    habits: [habit],
  };
}

describe('Home habit entry invariants', () => {
  const selectedDate = new Date(2026, 6, 30, 12);
  const periodKey = '2026-W31';
  const targetHabit = {
    id: 'weekly-water',
    categoryId: 'health',
    name: 'Water',
    frequency: 'daily',
    target: 8,
    targetFrequency: 'weekly',
    createdAt: '2026-01-01',
    completed: {},
    progress: { [periodKey]: 4 },
    skippedDates: [],
  };

  it('uses the target period key consistently when checking skipped state', () => {
    expect(getPeriodKey(targetHabit, selectedDate)).toBe(periodKey);
    expect(
      isHabitSkippedToday({ ...targetHabit, skippedDates: [periodKey] }, selectedDate)
    ).toBe(true);
  });

  it('skipping clears completion and progress for the same entry', () => {
    const habit = {
      ...targetHabit,
      completed: { [periodKey]: true },
      progress: { [periodKey]: 8 },
    };
    const result = reducer(stateWith(habit), {
      type: ActionTypes.SKIP_HABIT,
      payload: { habitId: habit.id, date: periodKey },
    });
    expect(result.habits[0]).toMatchObject({
      completed: {},
      progress: { [periodKey]: 0 },
      skippedDates: [periodKey],
    });
  });

  it('completing removes a stale skip for the same entry', () => {
    const habit = { ...targetHabit, skippedDates: [periodKey] };
    const result = reducer(stateWith(habit), {
      type: ActionTypes.TOGGLE_HABIT_COMPLETED,
      payload: { habitId: habit.id, date: periodKey },
    });
    expect(result.habits[0].completed[periodKey]).toBe(true);
    expect(result.habits[0].skippedDates).toEqual([]);
  });

  it('reaching a target completes the entry atomically', () => {
    const result = reducer(stateWith(targetHabit), {
      type: ActionTypes.SET_HABIT_PROGRESS,
      payload: { habitId: targetHabit.id, date: periodKey, progress: 8 },
    });
    expect(result.habits[0]).toMatchObject({
      completed: { [periodKey]: true },
      progress: { [periodKey]: 8 },
      skippedDates: [],
    });
  });
});

describe('archived habit history', () => {
  const archivedAt = Date.parse('2026-07-30T12:00:00Z');
  const habit = {
    id: 'walk',
    categoryId: 'health',
    name: 'Walk',
    frequency: 'daily',
    createdAt: '2026-01-01',
    completed: { '2026-07-29': true },
    progress: {},
    skippedDates: [],
  };

  it('archives a habit without removing its embedded history', () => {
    const result = reducer(stateWith(habit), {
      type: ActionTypes.DELETE_HABIT,
      payload: { habitId: habit.id, archivedAt },
    });
    expect(result.habits).toHaveLength(1);
    expect(result.habits[0].archivedAt).toBe(archivedAt);
    expect(result.habits[0].completed).toEqual({ '2026-07-29': true });
  });

  it('shows an archived habit before removal but not on or after removal day', () => {
    const archived = { ...habit, archivedAt };
    expect(isHabitScheduledOnDate(archived, new Date('2026-07-29T12:00:00'))).toBe(true);
    expect(isHabitScheduledOnDate(archived, new Date('2026-07-30T12:00:00'))).toBe(false);
    expect(isHabitScheduledOnDate(archived, new Date('2026-07-31T12:00:00'))).toBe(false);
  });

  it('keeps archived definitions when active habits are reordered', () => {
    const active = { ...habit, id: 'active' };
    const archived = { ...habit, id: 'archived', archivedAt };
    const result = reducer(
      { ...structuredClone(initialState), habits: [archived, active] },
      { type: ActionTypes.REORDER_HABITS, payload: ['active'] }
    );
    expect(result.habits.map((item) => item.id)).toEqual(['active', 'archived']);
  });

  it('applies the server habit when conflict resolution rejects an optimistic archive', () => {
    const result = reducer(
      stateWith({ ...habit, archivedAt }),
      {
        type: ActionTypes.CONFIRM_OPERATION,
        payload: {
          entityType: 'habits',
          canonicalRecord: {
            clientId: 'walk',
            categoryClientId: 'health',
            name: 'Walk',
            frequency: 'daily',
            createdAtISO: '2026-01-01',
            paused: false,
            activeOnHolidays: false,
            icon: '🚶',
            sortOrder: 0,
            revision: 4,
          },
        },
      }
    );
    expect(result.habits[0].archivedAt).toBeUndefined();
    expect(result.habits[0].completed).toEqual({ '2026-07-29': true });
    expect(result.habits[0].revision).toBe(4);
  });
});
