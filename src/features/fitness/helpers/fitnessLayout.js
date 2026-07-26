/**
 * Layout Helper Functions
 *
 * Sizes the recorded-activities list to the available viewport height.
 */

/**
 * Adjusts the activities container height to fit the viewport
 */
export function adjustActivitiesContainerHeight() {
  if (typeof window === 'undefined') return;
  const container = document.querySelector('#activities-list');
  if (!container) return;

  const rect = container.getBoundingClientRect();
  // Subtract bottom padding (e.g. from pb-8 on .activities-container) so last items are fully visible
  let bottomPadding = 0;
  const content = document.querySelector('#fitness-view').closest('.content-area');
  if (content) {
    const cs = window.getComputedStyle(content);
    bottomPadding = parseFloat(cs.paddingBottom) || 0;
  }

  const available = window.innerHeight - rect.top - bottomPadding;
  if (available > 0) {
    container.style.maxHeight = available + 'px';
    container.style.overflowY = 'auto';
  }
}
