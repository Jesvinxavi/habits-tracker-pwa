/**
 * Layout Helper Functions
 *
 * Pure functions for calculating layout dimensions and heights
 * Extracted from src/ui/fitness.js for better modularity
 */

/**
 * Calculates the available height for expandable search section
 * @returns {number} Available height in pixels
 */
export function calculateAvailableHeight() {
  const searchContainer = document.querySelector('#fitness-view .search-container');
  if (!searchContainer) return 500; // Increased fallback height

  const containerRect = searchContainer.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  // Get navigation bar height from CSS variable
  const tabBarHeight =
    parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--tab-bar-height')
        .replace('px', '')
    ) || 83;

  // Get safe area bottom padding
  const safeAreaBottom =
    parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue('padding-bottom')
        .replace('px', '')
    ) || 0;

  // Calculate available space: viewport - search container bottom - nav bar - safe area - padding
  const searchContainerBottom = containerRect.bottom;
  const availableHeight =
    viewportHeight - searchContainerBottom - tabBarHeight - safeAreaBottom - 20;

  // Ensure minimum height and maximum reasonable height - increased both values
  return Math.max(300, Math.min(availableHeight, 700));
}

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

/**
 * Updates the search section height based on available space
 */
export function updateSearchSectionHeight() {
  const content = document.querySelector('#activities-search-section .activities-search-content');
  if (!content) return;

  // Calculate height to extend to navigation bar
  const viewportHeight = window.innerHeight;
  const tabBarHeight = 83; // Approximate tab bar height
  const maxHeight = viewportHeight - tabBarHeight - 40; // Account for tab bar and padding
  content.style.maxHeight = `${maxHeight}px`;
}
