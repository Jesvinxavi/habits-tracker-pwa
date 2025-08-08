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

      // Handle edge cases for first few tiles
      let scrollLeft = Math.max(0, Math.min(diff, max));

      // If the tile is one of the first few and we can't center it properly,
      // scroll to the beginning but ensure the tile is still visible
      if (diff < 0 && el.offsetLeft < parent.clientWidth / 2) {
        // For first few tiles, ensure they're visible but don't try to center beyond what's possible
        scrollLeft = 0;
      }

      // Avoid starting a new smooth scroll if we're already very close to target to prevent jitter
      const near = Math.abs(parent.scrollLeft - scrollLeft) < 2;
      parent.scrollTo({
        left: near ? parent.scrollLeft : scrollLeft,
        behavior: instant || near ? 'auto' : 'smooth',
      });
    })
  );
}

/** Convenience: centre first element matching selector */
export function centerOnSelector(parent, selector, opts) {
  centerHorizontally(parent.querySelector(selector), opts);
}
