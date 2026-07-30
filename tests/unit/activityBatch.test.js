import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ActionTypes,
  Actions,
  dispatch,
  getState,
  listeners,
  subscribe,
} from '../../src/core/state.js';
import { recordActivitiesForDate } from '../../src/features/fitness/activities.js';

vi.mock('../../src/core/testHarness.js', () => ({
  installTestHarnessApi: vi.fn(),
  isTestHarnessEnabled: () => true,
}));
vi.mock('../../src/components/ConfirmDialog.js', () => ({ showConfirm: vi.fn() }));

describe('multi-activity recording', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TEST_HARNESS', '1');
    listeners.clear();
    dispatch({ type: ActionTypes.RESET_STATE, meta: { source: 'test' } });
    ['a1', 'a2'].forEach((id, index) => {
      dispatch({
        ...Actions.addActivity({
          id,
          name: `Activity ${index + 1}`,
          categoryId: 'other',
        }),
        meta: { source: 'test' },
      });
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it('commits a batch with one notification and preserves selection order', async () => {
    const listener = vi.fn();
    subscribe(listener);

    const result = await recordActivitiesForDate(['a2', 'missing', 'a1'], '2026-07-29');

    expect(result).toEqual({ recorded: 2, failed: 0, blocked: false });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getState().recordedActivities['2026-07-29'].map((record) => record.activityId)).toEqual([
      'a2',
      'a1',
    ]);
  });
});
