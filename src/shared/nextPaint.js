/**
 * Waiting for the browser to paint — or giving up on waiting for one.
 *
 * `requestAnimationFrame` does not fire while the page is hidden. Any startup
 * step that *awaits* a frame therefore stalls indefinitely in a background tab:
 * the app finishes loading its data, then sits behind the loading screen until
 * the tab is looked at. Nothing can flash on a surface that is not painting, so
 * a hidden page skips the wait entirely, and a visible one keeps a timeout as a
 * backstop against a frame loop that never runs.
 *
 * Use this anywhere a paint is awaited. Fire-and-forget `requestAnimationFrame`
 * callbacks — the ones that only reposition something once it is on screen —
 * are fine as they are.
 */

// Long enough that a healthy frame always wins the race, short enough that a
// page which never paints is not held up noticeably.
const PAINT_TIMEOUT_MS = 150;

/**
 * Resolves after the next paint, or immediately when the page is not painting.
 * @returns {Promise<void>} Resolves once it is safe to continue.
 */
export function nextPaint() {
  if (document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, PAINT_TIMEOUT_MS);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}
