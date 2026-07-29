import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ActionTypes,
  Actions,
  dispatch,
  getState,
  listeners,
  subscribe,
} from '../../src/core/state.js';
import { getRecordedHistoryIndex } from '../../src/features/fitness/helpers/recordedHistory.js';

vi.mock('../../src/core/dataBackend.js', () => ({
  DATA_BACKENDS: { LEGACY: 'legacy', CLOUD: 'cloud' },
  isCloudBackend: () => false,
  getDataBackend: () => 'legacy',
  assertCloudConfiguration: () => {},
}));

function syntheticAccount() {
  const activities = Array.from({ length: 100 }, (_, index) => ({
    id: `activity-${index}`,
    name: `Synthetic activity ${index}`,
    categoryId: ['cardio', 'strength', 'stretching', 'sports', 'other'][index % 5],
    trackingType: index % 2 ? 'sets-reps' : 'duration',
  }));
  const recordedActivities = {};
  for (let day = 0; day < 250; day += 1) {
    const date = new Date(Date.UTC(2025, 0, 1 + day)).toISOString().slice(0, 10);
    recordedActivities[date] = Array.from({ length: 14 }, (_, index) => ({
      id: `record-${day}-${index}`,
      activityId: `activity-${(day + index) % activities.length}`,
      activityName: `Synthetic activity ${(day + index) % activities.length}`,
      categoryId: activities[(day + index) % activities.length].categoryId,
      date,
      timestamp: `${date}T12:00:00.000Z`,
      duration: index % 2 ? null : 30 + index,
      durationUnit: 'minutes',
      notes: 'Deterministic benchmark record',
    }));
  }
  const habits = Array.from({ length: 80 }, (_, index) => ({
    id: `habit-${index}`,
    name: `Synthetic habit ${index}`,
    categoryId: `habit-category-${index % 8}`,
    frequency: 'daily',
    completed: {},
    progress: {},
    skippedDates: [],
  }));
  return { activities, recordedActivities, habits };
}

describe('large-account Fitness work-count harness', () => {
  beforeEach(() => {
    listeners.clear();
    dispatch({ type: ActionTypes.RESET_STATE, meta: { source: 'test' } });
  });

  it('keeps reads, unrelated actions, history indexing and batches bounded', () => {
    const account = syntheticAccount();
    const bytes = JSON.stringify(account).length;
    expect(bytes).toBeGreaterThan(650000);
    expect(bytes).toBeLessThan(925000);
    dispatch(Actions.hydrateCache(account));

    const snapshot = getState();
    for (let index = 0; index < 50; index += 1) expect(getState()).toBe(snapshot);

    const activityRender = vi.fn();
    subscribe((state) => state.activities, activityRender);
    for (let day = 1; day <= 25; day += 1) {
      dispatch(Actions.setFitnessSelectedDate(`2026-08-${String(day).padStart(2, '0')}T00:00:00.000Z`));
    }
    expect(activityRender).not.toHaveBeenCalled();

    const firstIndex = getRecordedHistoryIndex();
    expect(getRecordedHistoryIndex()).toBe(firstIndex);
    expect(firstIndex.allRecords).toHaveLength(3500);

    const records = getState().activities.slice(0, 20).map((activity, index) => ({
      id: `batch-${index}`,
      activityId: activity.id,
      date: '2026-08-26',
      timestamp: '2026-08-26T12:00:00.000Z',
    }));
    dispatch({
      ...Actions.recordActivities('2026-08-26', records),
      meta: { source: 'test' },
    });
    expect(activityRender).not.toHaveBeenCalled();
    expect(getRecordedHistoryIndex()).not.toBe(firstIndex);
  });
});
