/**
 * Scroll helper utilities – pure DOM helpers, no state.
 */

/**
 * Smooth-scroll the parent horizontally so that `el` ends up centred.
 * @param {HTMLElement} el
 */
export function centerHorizontally(el) {
  if (!el) return;
  const container = el.parentElement;
  if (!container) return;
  const containerRect = container.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const offset = rect.left - containerRect.left - (containerRect.width / 2 - rect.width / 2);
  let targetLeft = container.scrollLeft + offset;
  if (targetLeft < 0) {
    // Not enough items to the left – extend leading padding so we can still center
    const currentPad = parseFloat(getComputedStyle(container).paddingLeft) || 0;
    container.style.paddingLeft = `${currentPad + Math.abs(targetLeft)}px`;
    targetLeft = 0;
  }
  container.scrollTo({ left: targetLeft, behavior: 'smooth' });
}
