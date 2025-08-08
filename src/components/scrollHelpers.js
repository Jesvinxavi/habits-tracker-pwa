/**
 * Scroll helper utilities – pure DOM helpers, no state.
 */

/**
 * Centre a child element horizontally within its scrollable parent
 * @param {HTMLElement} el         – child to centre
 * @param {{instant?:boolean}=} o  – instant = true → no animation
 */
export function centerHorizontally(el, { instant = false } = {}) {
  if (!el) return;
  const parent = el.parentElement;

  // Two rAFs ensure fonts & layout are finished (iOS A2HS needs this)
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const diff = el.offsetLeft - (parent.clientWidth - el.clientWidth) / 2;
      const max = parent.scrollWidth - parent.clientWidth;

      // Compute target scroll position and clamp to bounds
      const scrollLeft = Math.max(0, Math.min(diff, max));

      parent.scrollTo({
        left: scrollLeft,
        behavior: instant ? 'auto' : 'smooth',
      });
    })
  );
}

/** Convenience: centre first element matching selector */
export function centerOnSelector(parent, selector, opts) {
  centerHorizontally(parent.querySelector(selector), opts);
}
