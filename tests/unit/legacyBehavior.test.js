import { describe, expect, it } from 'vitest';
import { ActionTypes, initialState, reducer } from '../../src/core/state.js';
import { getPeriodKey } from '../../src/features/home/schedule.js';

describe('legacy cascade behavior', () => {
  it('deleting a habit category removes its habits and embedded history', () => {
    const state = {
      ...structuredClone(initialState),
      categories: [{ id: 'health' }, { id: 'work' }],
      habits: [
        {
          id: 'walk',
          categoryId: 'health',
          completed: { '2025-01-01': true },
          progress: { '2025-01-01': 1 },
          skippedDates: [],
        },
        { id: 'read', categoryId: 'work' },
      ],
    };
    const result = reducer(state, {
      type: ActionTypes.DELETE_CATEGORY,
      payload: 'health',
    });
    expect(result.categories).toEqual([{ id: 'work' }]);
    expect(result.habits).toEqual([{ id: 'read', categoryId: 'work' }]);
  });

  it('deleting an activity removes all of its recorded history', () => {
    const state = {
      ...structuredClone(initialState),
      activities: [{ id: 'run' }, { id: 'lift' }],
      recordedActivities: {
        '2025-01-01': [{ id: 'r1', activityId: 'run' }, { id: 'r2', activityId: 'lift' }],
        '2025-01-02': [{ id: 'r3', activityId: 'run' }],
      },
    };
    const result = reducer(state, {
      type: ActionTypes.DELETE_ACTIVITY,
      payload: 'run',
    });
    expect(result.activities).toEqual([{ id: 'lift' }]);
    expect(result.recordedActivities).toEqual({
      '2025-01-01': [{ id: 'r2', activityId: 'lift' }],
    });
  });
});

describe('legacy period-key output', () => {
  const date = new Date(2025, 0, 8, 12);

  it.each([
    ['daily', '2025-01-08'],
    ['weekly', '2025-W2'],
    ['monthly', '2025-01'],
    ['yearly', '2025'],
  ])('keeps %s target keys stable', (targetFrequency, expected) => {
    expect(getPeriodKey({ target: 1, targetFrequency }, date)).toBe(expected);
  });

  it('keeps schedule-only completion tied to the exact calendar date', () => {
    expect(getPeriodKey({ frequency: 'monthly' }, date)).toBe('2025-01-08');
  });
});
