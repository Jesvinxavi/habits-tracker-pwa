// HeaderBar.js - Header bar component for the habits view
/**
 * Mounts the header bar with title and reorder button
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onReorder - Callback when reorder button is clicked
 * @returns {HTMLElement} The header bar element
 */
export function mountHeaderBar(callbacks = {}) {
  const headerBar = document.createElement('div');
  headerBar.className =
    'app-header flex justify-between items-center h-11 px-4 sm:px-6 lg:px-8 border-b border-gray-200 dark:border-gray-700 border-opacity-50 w-full pt-1.5';

  headerBar.innerHTML = `
    <h1 class="app-title text-black dark:text-white text-[36px] font-extrabold leading-none flex items-end">Habits</h1>
    <button class="reorder-btn bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Reorder
    </button>
  `;

  // Bind reorder button event
  const reorderBtn = headerBar.querySelector('.reorder-btn');
  if (reorderBtn && callbacks.onReorder) {
    reorderBtn.addEventListener('click', callbacks.onReorder);
  }

  return headerBar;
}
