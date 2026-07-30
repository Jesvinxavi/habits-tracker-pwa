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

function isExplicitPwaTestBuild() {
  return import.meta.env.VITE_PWA_TEST === '1';
}

export function isTestHarnessEnabled() {
  return (
    isHarnessRequested() &&
    (import.meta.env.DEV || isExplicitPwaTestBuild())
  );
}

export function assertTestHarnessConfiguration() {
  if (
    isHarnessRequested() &&
    !import.meta.env.DEV &&
    !isExplicitPwaTestBuild()
  ) {
    throw new Error(
      'VITE_TEST_HARNESS=1 is only permitted by the development server or explicit PWA test build.'
    );
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
