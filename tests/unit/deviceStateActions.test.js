import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ActionTypes,
  Actions,
  dispatch,
  getState,
} from '../../src/core/state.js';
import { clearCloudRuntime } from '../../src/core/cloudRuntime.js';

afterEach(() => {
  dispatch({ type: ActionTypes.RESET_STATE, meta: { source: 'test' } });
  vi.unstubAllEnvs();
});

describe('device-only state actions', () => {
  it('mark calendar navigation as device-only', () => {
    expect(Actions.setSelectedDate('2026-07-27').meta).toEqual({ source: 'device' });
    expect(Actions.setSelectedGroup('weekly').meta).toEqual({ source: 'device' });
    expect(Actions.setGroupAndDate('monthly', '2026-07-01').meta).toEqual({
      source: 'device',
    });
    expect(Actions.setFitnessSelectedDate('2026-07-28').meta).toEqual({
      source: 'device',
    });
  });

  it('updates the fitness date synchronously in cloud mode', () => {
    vi.stubEnv('VITE_DATA_BACKEND', 'cloud');
    const selectedDate = '2026-07-28T00:00:00.000';

    const result = dispatch(Actions.setFitnessSelectedDate(selectedDate));

    expect(result).toBe(true);
    expect(getState().fitnessSelectedDate).toBe(selectedDate);
  });

  it('fails closed for a cloud domain write before persistence is ready', async () => {
    vi.stubEnv('VITE_DATA_BACKEND', 'cloud');
    clearCloudRuntime();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const before = getState().activities;

    await expect(
      dispatch(
        Actions.addActivity({
          id: 'blocked-until-runtime-ready',
          name: 'Blocked',
          categoryId: 'cardio',
        })
      )
    ).resolves.toBe(false);
    expect(getState().activities).toBe(before);
    expect(errorSpy).toHaveBeenCalledWith(
      '[persistence] Local durable write failed:',
      expect.objectContaining({ message: 'Cloud persistence is not ready' })
    );
    errorSpy.mockRestore();
  });
});
