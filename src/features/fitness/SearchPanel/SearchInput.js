// SearchInput.js - Search input field with expand/collapse functionality

let isSearchSectionExpanded = false;
let tapCount = 0;
let tapTimeout = null;
let allowFocus = false; // Flag to control when focus is allowed
let hasExpandedOnce = false; // Track if we've expanded at least once

/**
 * Mounts the search input component
 * @param {Function} onSearchChange - Callback when search query changes
 * @param {Function} onExpand - Callback when search section expands
 * @param {Function} onCollapse - Callback when search section collapses
 * @returns {HTMLElement} The search input container
 */
export function mountSearchInput(onSearchChange, onExpand, onCollapse) {
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container px-4';
  searchContainer.style.position = 'relative';
  searchContainer.innerHTML = `
    <div class="search-input relative border-2 border-gray-300 dark:border-gray-500 rounded-xl bg-gray-100 dark:bg-gray-700 transition-all duration-200 hover:border-gray-400 dark:hover:border-gray-400">
      <svg class="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <input id="fitness-activity-search" type="text" placeholder="Search activities..." class="w-full pl-10 pr-10 py-3 bg-transparent text-gray-700 dark:text-gray-300 rounded-xl border-none outline-none focus:ring-0 transition-colors cursor-pointer placeholder-gray-500 dark:placeholder-gray-400" autocomplete="off" spellcheck="false">
      <button id="close-search-btn" class="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors hidden rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;

  const searchInput = searchContainer.querySelector('#fitness-activity-search');
  const closeBtn = searchContainer.querySelector('#close-search-btn');

  // Handle tap/click with two-tap behavior
  const handleTap = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // If search section is already expanded and we've expanded once before, handle as second tap (show keyboard)
    if (isSearchSectionExpanded && hasExpandedOnce) {
      // Search section is open, this tap should show keyboard
      allowFocus = true;
      searchInput.focus();
      return;
    }

    tapCount++;

    // Clear previous timeout
    if (tapTimeout) {
      clearTimeout(tapTimeout);
    }

    // Set timeout to reset tap count
    tapTimeout = setTimeout(() => {
      tapCount = 0;
      allowFocus = false;
      // Don't remove temp-focus class here as it might interfere with early detection
      // Don't reset hasExpandedOnce - it should persist
    }, 400); // 400ms window for multi-tap

    if (tapCount === 1) {
      // First tap: expand search section without focusing
      if (!isSearchSectionExpanded) {
        expandSearchSection(onExpand);
        hasExpandedOnce = true; // Mark that we've expanded at least once
        // Add temporary focus state for visual feedback
        searchInput.classList.add('temp-focus');
      } else {
        // Search section was already expanded, but this is still the first tap
        hasExpandedOnce = true; // Mark that we've expanded at least once
        // Add temporary focus state for visual feedback
        searchInput.classList.add('temp-focus');
      }
      allowFocus = false; // Don't allow focus on first tap
      // Immediately blur to prevent any focus
      searchInput.blur();
    } else if (tapCount === 2) {
      // Second tap: allow focus and show keyboard
      allowFocus = true; // Allow focus on second tap
      searchInput.classList.remove('temp-focus');
      // Explicitly focus the input
      searchInput.focus();
    }
  };

  // Handle focus separately for keyboard navigation
  const handleFocus = (e) => {
    // Block focus if not explicitly allowed during tap sequence
    if (!allowFocus && (tapCount > 0 || searchInput.classList.contains('temp-focus'))) {
      e.preventDefault();
      searchInput.blur();
      return;
    }

    // Allow focus on second tap or normal focus events
    if (!isSearchSectionExpanded) {
      expandSearchSection(onExpand);
    }
  };

  // Bind event handlers
  searchInput.addEventListener('click', handleTap);
  searchInput.addEventListener('focus', handleFocus);

  // Add search input functionality
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    if (isSearchSectionExpanded && onSearchChange) {
      onSearchChange(query);
    }
  });

  // Bind close button click handler
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Clear search input when closing
      searchInput.value = '';
      collapseSearchSection(onCollapse);
    });
  }

  // Close section when clicking outside
  document.addEventListener('click', (e) => {
    if (
      isSearchSectionExpanded &&
      !searchInput.contains(e.target) &&
      !document.querySelector('#activities-search-section')?.contains(e.target)
    ) {
      // Don't close if clicking on modal elements
      const isModalElement =
        e.target.closest('.modal') ||
        e.target.closest('[data-modal]') ||
        e.target.closest('.modal-backdrop') ||
        e.target.closest('.modal-content');

      if (isModalElement) {
        return;
      }

      // Don't close if clicking on category color picker elements
      const isColorPickerElement =
        e.target.closest('.color-picker') ||
        e.target.closest('.color-option') ||
        e.target.closest('[data-color]');

      if (isColorPickerElement) {
        return;
      }

      collapseSearchSection(onCollapse);
    }
  });

  // Keyboard navigation support
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      collapseSearchSection(onCollapse);
      searchInput.blur();
    } else if (e.key === 'ArrowDown' && isSearchSectionExpanded) {
      e.preventDefault();
      // Focus first activity button in search results
      const firstActivity = document.querySelector(
        '#activities-search-section .search-activity-item'
      );
      if (firstActivity) {
        firstActivity.focus();
      }
    }
  });

  return searchContainer;
}

/**
 * Expands the search section
 */
function expandSearchSection(onExpand) {
  const closeBtn = document.getElementById('close-search-btn');

  // Show the close button
  if (closeBtn) {
    closeBtn.classList.remove('hidden');
  }

  // Update expanded state
  isSearchSectionExpanded = true;

  // Notify parent component
  if (onExpand) {
    onExpand();
  }
}

/**
 * Collapses the search section
 */
function collapseSearchSection(onCollapse) {
  const closeBtn = document.getElementById('close-search-btn');
  const searchInput = document.getElementById('fitness-activity-search');

  // Hide the close button
  if (closeBtn) {
    closeBtn.classList.add('hidden');
  }

  // Clear search input if not already cleared
  if (searchInput && searchInput.value !== '') {
    searchInput.value = '';
  }

  // Clear temporary focus state
  if (searchInput) {
    searchInput.classList.remove('temp-focus');
  }

  // Reset tap count and focus flag
  tapCount = 0;
  allowFocus = false;
  hasExpandedOnce = false; // Reset expansion flag when completely closed
  if (tapTimeout) {
    clearTimeout(tapTimeout);
    tapTimeout = null;
  }

  // Update expanded state
  isSearchSectionExpanded = false;

  // Notify parent component
  if (onCollapse) {
    onCollapse();
  }
}

/**
 * Gets the current search query
 */
export function getSearchQuery() {
  const searchInput = document.getElementById('fitness-activity-search');
  return searchInput ? searchInput.value : '';
}

/**
 * Clears the search input
 */
export function clearSearch() {
  const searchInput = document.getElementById('fitness-activity-search');
  if (searchInput) {
    searchInput.value = '';
  }
}

/**
 * Gets the search expansion state
 */
export function isSearchExpanded() {
  return isSearchSectionExpanded;
}
