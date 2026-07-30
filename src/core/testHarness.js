/**
 * Explicit, development-only runtime used by browser UI tests.
 *
 * This is intentionally not a persistence implementation: no browser storage,
 * Clerk, Convex, sync engine, or migration code is started when it is enabled.
 * Keeping the flag separate from a missing cloud runtime prevents a broken
 * production bootstrap from accidentally behaving like a successful test run.
 */
function isHarnessRequested() {
  return import.meta.env.VITE_TEST_HARNESS === '1';
}

export function isTestHarnessEnabled() {
  return import.meta.env.DEV && isHarnessRequested();
}

export function assertTestHarnessConfiguration() {
  if (isHarnessRequested() && !import.meta.env.DEV) {
    throw new Error('VITE_TEST_HARNESS=1 is only permitted by the development server.');
  }
  // The rest of the UI deliberately uses the cloud predicate to suppress old
  // localStorage side effects (theme, selected tab, rest-day import, etc.).
  // The harness replaces cloud bootstrap itself, so this does not contact
  // Clerk or Convex; it is simply the only storage-free test configuration.
  if (isTestHarnessEnabled() && import.meta.env.VITE_DATA_BACKEND !== 'cloud') {
    throw new Error('VITE_TEST_HARNESS=1 requires VITE_DATA_BACKEND=cloud.');
  }
}

/**
 * Installs the intentionally narrow browser API that Playwright uses to inspect
 * and seed the in-memory state. It is never installed by cloud or production
 * builds, even if they happen to have a missing persistence runtime.
 */
export function installTestHarnessApi({ getState, dispatch, actionTypes }) {
  if (!isTestHarnessEnabled() || typeof window === 'undefined') return;

  const seed = (snapshot = {}) => {
    dispatch({ type: actionTypes.RESET_STATE, meta: { source: 'test' } });
    dispatch({
      type: actionTypes.HYDRATE_CACHE,
      payload: snapshot,
      meta: { source: 'test' },
    });
    return getState();
  };

  window.__APP_TEST__ = Object.freeze({
    getState,
    dispatch,
    seed,
    reset: () => seed(),
  });
}
