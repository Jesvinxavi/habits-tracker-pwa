import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ActionTypes,
  Actions,
  dispatch,
  getState,
  listeners,
  subscribe,
} from '../../src/core/state.js';

describe('state snapshots and selector subscriptions', () => {
  beforeEach(() => {
    listeners.clear();
    dispatch({ type: ActionTypes.RESET_STATE, meta: { source: 'test' } });
  });

  it('returns one stable, development-frozen snapshot between actions', () => {
    const first = getState();
    expect(getState()).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.settings)).toBe(true);
    expect(() => {
      first.settings.darkMode = true;
    }).toThrow(TypeError);
  });

  it('replaces the root only for a real transition', () => {
    const initial = getState();
    expect(dispatch(Actions.setFitnessSelectedDate(initial.fitnessSelectedDate))).toBe(true);
    expect(getState()).toBe(initial);

    expect(dispatch(Actions.setFitnessSelectedDate('2026-07-30T00:00:00.000Z'))).toBe(true);
    expect(getState()).not.toBe(initial);
  });

  it('notifies a selector only when its selected reference changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe((state) => state.activities, listener);

    dispatch(Actions.setFitnessSelectedDate('2026-07-30T00:00:00.000Z'));
    expect(listener).not.toHaveBeenCalled();

    dispatch({
      ...Actions.addActivity({
        id: 'activity-state-test',
        name: 'State Test',
        categoryId: 'other',
      }),
      meta: { source: 'test' },
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toBe(getState().activities);
    unsubscribe();
  });

  it('isolates subscriber exceptions after committing valid state', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const healthyListener = vi.fn();
    subscribe(() => {
      throw new Error('render failed');
    });
    subscribe(healthyListener);

    expect(dispatch(Actions.setSyncStatus('offline'))).toBe(true);
    expect(getState().syncStatus).toBe('offline');
    expect(healthyListener).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('Error in state subscriber:', expect.any(Error));
    errorSpy.mockRestore();
  });
});
