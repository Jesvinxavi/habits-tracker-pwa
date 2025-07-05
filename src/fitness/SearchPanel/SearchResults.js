// SearchResults.js - Expandable search results container

/**
 * Mounts the search results container
 * @returns {HTMLElement} The search results container
 */
export function mountSearchResults() {
  const searchSection = document.createElement('div');
  searchSection.id = 'activities-search-section';
  searchSection.className = 'activities-search-section hidden';

  searchSection.innerHTML = `
    <div class="activities-search-content">
      <!-- Content will be populated dynamically -->
    </div>
  `;

  return searchSection;
}

/**
 * Shows the search results section with smooth animation
 */
export function showSearchResults() {
  const searchSection = document.getElementById('activities-search-section');
  if (!searchSection) {
    return;
  }

  // Remove hidden class first to enable transitions
  searchSection.classList.remove('hidden');

  // Force a reflow to ensure the transition works
  searchSection.offsetHeight;

  // Add expanded class to trigger animation
  searchSection.classList.add('expanded');

  // Calculate and set max height to extend to navigation bar
  const viewportHeight = window.innerHeight;
  const tabBarHeight = 83; // Approximate tab bar height
  const maxHeight = viewportHeight - tabBarHeight - 40; // Account for tab bar and padding
  const content = searchSection.querySelector('.activities-search-content');
  if (content) {
    content.style.maxHeight = `${maxHeight}px`;
  }
}

/**
 * Hides the search results section with smooth animation
 */
export function hideSearchResults() {
  const searchSection = document.getElementById('activities-search-section');
  if (!searchSection) {
    return;
  }

  // Remove expanded class to trigger collapse animation
  searchSection.classList.remove('expanded');

  // Wait for animation to complete before hiding
  setTimeout(() => {
    searchSection.classList.add('hidden');
  }, 400); // Match the CSS transition duration
}

/**
 * Updates the search results content
 * @param {string} html - The HTML content to display
 */
export function updateSearchResults(html) {
  const content = document.querySelector('#activities-search-section .activities-search-content');
  if (!content) {
    return;
  }

  content.innerHTML = html;
}

/**
 * Gets the search results content container
 * @returns {HTMLElement} The content container
 */
export function getSearchResultsContent() {
  return document.querySelector('#activities-search-section .activities-search-content');
}
