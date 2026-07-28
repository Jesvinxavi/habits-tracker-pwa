import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionTypes, getState, dispatch, Actions } from '../../src/core/state.js';
import {
  addRoutine,
  getRoutine,
  getRoutines,
  getRoutineActivities,
} from '../../src/features/fitness/routines.js';

vi.mock('../../src/components/ConfirmDialog.js', () => ({ showConfirm: vi.fn() }));

// Vitest inherits VITE_DATA_BACKEND=cloud from .env.local, which would route every
// dispatch through the persistence layer with no cloud runtime attached. These
// tests exercise the in-memory reducer, so pin the backend to legacy.
vi.mock('../../src/core/dataBackend.js', () => ({
  DATA_BACKENDS: { LEGACY: 'legacy', CLOUD: 'cloud' },
  isCloudBackend: () => false,
  getDataBackend: () => 'legacy',
  assertCloudConfiguration: () => {},
}));

/**
 * Seeds an activity straight into state, bypassing the durable write path.
 * @param {string} id Activity client id.
 * @param {string} name Activity name.
 * @returns {void}
 */
function seedActivity(id, name) {
  dispatch({
    type: ActionTypes.ADD_ACTIVITY,
    payload: { id, name, categoryId: 'strength', createdAt: '2026-01-01' },
    meta: { source: 'device' },
  });
}

describe('routines', () => {
  beforeEach(() => {
    dispatch(Actions.resetState());
  });

  it('assigns sortOrder from the collection length and a YYYY-MM-DD createdAt', async () => {
    const first = await addRoutine({ name: 'Push', activityIds: [] });
    const second = await addRoutine({ name: 'Pull', activityIds: [] });

    expect(first.sortOrder).toBe(0);
    expect(second.sortOrder).toBe(1);
    expect(first.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.revision).toBe(0);
  });

  it('copies the activity list rather than aliasing the caller\'s array', async () => {
    const activityIds = ['a1'];
    const routine = await addRoutine({ name: 'Push', activityIds });
    activityIds.push('a2');
    expect(getRoutine(routine.id).activityIds).toEqual(['a1']);
  });

  it('returns routines in sortOrder even when state is out of order', async () => {
    await addRoutine({ name: 'First', activityIds: [] });
    await addRoutine({ name: 'Second', activityIds: [] });
    // Reverse the stored order to prove the selector sorts.
    const reversed = [...getState().routines].reverse();
    dispatch(Actions.hydrateCache({ routines: reversed }));
    expect(getRoutines().map((routine) => routine.name)).toEqual(['First', 'Second']);
  });

  it('filters activity ids whose activity is gone or archived', async () => {
    seedActivity('a1', 'Bench Press');
    seedActivity('a2', 'Treadmill Run');
    const routine = await addRoutine({ name: 'Mixed', activityIds: ['a1', 'gone', 'a2'] });

    expect(getRoutineActivities(routine.id).map((activity) => activity.name)).toEqual([
      'Bench Press',
      'Treadmill Run',
    ]);

    dispatch(Actions.updateActivity('a1', { archivedAt: Date.now() }));
    expect(getRoutineActivities(routine.id).map((activity) => activity.name)).toEqual([
      'Treadmill Run',
    ]);
    // The routine itself is untouched: integrity is applied on read, not by rewriting.
    expect(getRoutine(routine.id).activityIds).toEqual(['a1', 'gone', 'a2']);
  });

  it('preserves selection order', async () => {
    seedActivity('a1', 'One');
    seedActivity('a2', 'Two');
    const routine = await addRoutine({ name: 'Ordered', activityIds: ['a2', 'a1'] });
    expect(getRoutineActivities(routine.id).map((activity) => activity.name)).toEqual([
      'Two',
      'One',
    ]);
  });

  it('returns an empty list for an unknown routine', () => {
    expect(getRoutineActivities('nope')).toEqual([]);
    expect(getRoutine('nope')).toBeUndefined();
  });
});
