/**
 * HeaderBar Component
 *
 * Universal header bar component that supports habits, fitness, and home use cases
 * Accepts props: title, showBack, extraButtons
 */

/**
 * Mounts the header bar
 * @param {Object} options - Configuration options
 * @param {string} options.title - The title to display
 * @param {boolean} options.showBack - Whether to show a back button
 * @param {Array} options.extraButtons - Array of extra button configurations
 * @param {Object} options.callbacks - Event handlers for buttons
 * @returns {HTMLElement} The header bar element
 */
export function mountHeaderBar(options = {}) {
  const { title = '', showBack = false, extraButtons = [], callbacks = {} } = options;
  
  const headerBar = document.createElement('div');
  headerBar.className =
    'app-header flex justify-between items-center h-11 px-4 sm:px-6 lg:px-8 w-full pt-1.5';

  // Build header content based on configuration
  let headerContent = '';
  
  if (showBack) {
    headerContent += `
      <button class="back-btn bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Back
      </button>
    `;
  }

  // Title section
  if (title) {
    headerContent += `<h1 class="app-title text-black dark:text-white text-[36px] font-extrabold leading-none flex items-end">${title}</h1>`;
  } else {
    // For fitness view with centered title
    headerContent += `
      <div></div>
      <h1 class="app-title text-center flex-grow text-[36px] font-extrabold leading-none flex items-end">Fitness</h1>
      <div></div>
    `;
  }

  // Extra buttons section
  if (extraButtons.length > 0) {
    const buttonsHtml = extraButtons.map(button => `
      <button class="${button.className || 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5'}" data-button-id="${button.id || ''}">
        ${button.icon || ''}
        ${button.text || ''}
      </button>
    `).join('');
    headerContent += buttonsHtml;
  }

  headerBar.innerHTML = headerContent;

  // Bind event handlers
  if (showBack && callbacks.onBack) {
    const backBtn = headerBar.querySelector('.back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', callbacks.onBack);
    }
  }

  // Bind extra button events
  extraButtons.forEach(button => {
    if (button.id && callbacks[`on${button.id.charAt(0).toUpperCase() + button.id.slice(1)}`]) {
      const btn = headerBar.querySelector(`[data-button-id="${button.id}"]`);
      if (btn) {
        btn.addEventListener('click', callbacks[`on${button.id.charAt(0).toUpperCase() + button.id.slice(1)}`]);
      }
    }
  });

  return headerBar;
} 