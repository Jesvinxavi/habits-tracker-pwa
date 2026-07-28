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

  it('archiving an activity keeps all of its recorded history', () => {
    const state = {
      ...structuredClone(initialState),
      activities: [{ id: 'run' }, { id: 'lift' }],
      recordedActivities: {
        '2025-01-01': [{ id: 'r1', activityId: 'run' }, { id: 'r2', activityId: 'lift' }],
        '2025-01-02': [{ id: 'r3', activityId: 'run' }],
      },
    };
    // Removing an activity from the library is an update, not a delete: the
    // sessions are the only record that the training happened.
    const result = reducer(state, {
      type: ActionTypes.UPDATE_ACTIVITY,
      payload: { activityId: 'run', updates: { archivedAt: 1735689600000 } },
    });
    expect(result.activities.map((activity) => activity.id)).toEqual(['run', 'lift']);
    expect(result.activities[0].archivedAt).toBe(1735689600000);
    expect(result.recordedActivities).toEqual(state.recordedActivities);
  });

  it('leaves a record\'s name snapshot alone when the activity is renamed', () => {
    const state = {
      ...structuredClone(initialState),
      activities: [{ id: 'run', name: 'Run' }],
      recordedActivities: { '2025-01-01': [{ id: 'r1', activityId: 'run', activityName: 'Run' }] },
    };
    // Display resolves the live activity by id, so rows are never rewritten —
    // the client used to patch them while the server did not, and the two
    // disagreed after a reload.
    const result = reducer(state, {
      type: ActionTypes.UPDATE_ACTIVITY,
      payload: { activityId: 'run', updates: { name: 'Treadmill Run' } },
    });
    expect(result.activities[0].name).toBe('Treadmill Run');
    expect(result.recordedActivities['2025-01-01'][0].activityName).toBe('Run');
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
