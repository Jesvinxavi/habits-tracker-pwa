/**
 * FitnessSearch - Search component for fitness activities
 * Handles expandable search section, activity search, and category management
 */

import { appData } from '../../core/state.js';
import { getActivitiesByCategory, searchActivities } from '../../utils/activities.js';

// State for search section expansion
let isSearchSectionExpanded = false;

/**
 * Initializes the search functionality
 */
export function initializeSearch() {
  bindSearchExpansion();
  bindSearchSectionEvents();
  bindSearchKeyboardNavigation();
}

/**
 * Binds search expansion events
 */
function bindSearchExpansion() {
  const searchInput = document.getElementById('fitness-activity-search');
  const closeBtn = document.getElementById('close-search-btn');

  if (!searchInput || !closeBtn) return;

  const expandOnInteraction = (e) => {
    if (!isSearchSectionExpanded) {
      e.preventDefault();
      expandSearchSection();
    }
  };

  // Expand on focus, click, or typing
  searchInput.addEventListener('focus', expandOnInteraction);
  searchInput.addEventListener('click', expandOnInteraction);
  searchInput.addEventListener('input', (e) => {
    if (!isSearchSectionExpanded) {
      expandSearchSection();
    }
    // Debounce search
    clearTimeout(searchInput._searchTimeout);
    searchInput._searchTimeout = setTimeout(() => {
      populateSearchSectionContent(e.target.value);
    }, 300);
  });

  // Close button
  closeBtn.addEventListener('click', () => {
    collapseSearchSection();
  });

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSearchSectionExpanded) {
      collapseSearchSection();
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (isSearchSectionExpanded && !e.target.closest('.search-container')) {
      collapseSearchSection();
    }
  });
}

/**
 * Expands the search section
 */
function expandSearchSection() {
  const searchSection = document.getElementById('activities-search-section');
  const searchInput = document.getElementById('fitness-activity-search');
  const closeBtn = document.getElementById('close-search-btn');

  if (!searchSection || !searchInput || !closeBtn) return;

  isSearchSectionExpanded = true;

  // Show section
  searchSection.classList.remove('hidden');

  // Calculate and set height
  const maxHeight = calculateAvailableHeight();
  const content = searchSection.querySelector('.activities-search-content');
  if (content) {
    content.style.maxHeight = `${maxHeight}px`;
  }

  // Update UI
  searchInput.placeholder = 'Search activities...';
  closeBtn.classList.remove('hidden');

  // Populate content
  populateSearchSectionContent(searchInput.value);

  // Focus and select all text
  searchInput.focus();
  searchInput.select();
}

/**
 * Collapses the search section
 */
function collapseSearchSection() {
  const searchSection = document.getElementById('activities-search-section');
  const searchInput = document.getElementById('fitness-activity-search');
  const closeBtn = document.getElementById('close-search-btn');

  if (!searchSection || !searchInput || !closeBtn) return;

  isSearchSectionExpanded = false;

  // Hide section
  searchSection.classList.add('hidden');

  // Reset UI
  searchInput.value = '';
  searchInput.placeholder = 'Search activities...';
  searchInput.blur();
  closeBtn.classList.add('hidden');
}

/**
 * Calculates available height for the search section
 */
function calculateAvailableHeight() {
  const searchContainer = document.querySelector('#fitness-view .search-container');
  if (!searchContainer) return 300;

  const containerRect = searchContainer.getBoundingClientRect();
  const viewportHeight = window.innerHeight;

  // Get navigation bar height
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

  // Calculate available space
  const searchContainerBottom = containerRect.bottom;
  const availableHeight =
    viewportHeight - searchContainerBottom - tabBarHeight - safeAreaBottom - 20;

  return Math.max(200, Math.min(availableHeight, 600));
}

/**
 * Populates the search section with content
 */
function populateSearchSectionContent(query = '') {
  const content = document.querySelector('#activities-search-section .activities-search-content');
  if (!content) return;

  if (query.trim()) {
    // Show search results
    const results = searchActivities(query);
    const groupedResults = groupActivitiesByCategory(results);

    if (Object.keys(groupedResults).length === 0) {
      content.innerHTML = `
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          <div class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <p class="text-lg font-medium">No activities found</p>
          <p class="text-sm">Try a different search term</p>
        </div>
      `;
      return;
    }

    let html = '<div class="search-results">';
    Object.entries(groupedResults).forEach(([categoryName, activities]) => {
      html += buildCategorySection(categoryName, activities);
    });
    html += '</div>';
    content.innerHTML = html;
  } else {
    // Show all categories
    const categories = getActivitiesByCategory();

    if (Object.keys(categories).length === 0) {
      content.innerHTML = `
        <div class="text-center py-8 text-gray-500 dark:text-gray-400">
          <div class="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <p class="text-lg font-medium">No activities yet</p>
          <p class="text-sm">Add your first activity to get started</p>
        </div>
      `;
      return;
    }

    let html = '<div class="categories-list">';
    Object.entries(categories).forEach(([categoryName, data]) => {
      html += buildCategorySection(categoryName, data.activities, data.muscleGroups);
    });
    html += '</div>';
    content.innerHTML = html;
  }
}

/**
 * Builds a category section
 */
function buildCategorySection(categoryName, activities = null, muscleGroups = null) {
  const categoryId = categoryName.toLowerCase().replace(/\s+/g, '-');
  const category = appData.fitnessCategories.find((c) => c.name === categoryName);
  const categoryColor = category?.color || '#6B7280';

  const activitiesHtml = activities
    ? activities.map((activity) => buildSearchActivityItem(activity, categoryName)).join('')
    : '';

  return `
    <div class="search-category mb-4" id="search-category-${categoryId}">
      <div class="search-category-header flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer" onclick="toggleSearchCategory('${categoryId}')">
        <div class="flex items-center gap-3">
          <div class="w-4 h-4 rounded-full" style="background-color: ${categoryColor}"></div>
          <span class="font-medium text-gray-900 dark:text-white">${categoryName}</span>
          <span class="text-sm text-gray-500 dark:text-gray-400">(${activities?.length || 0})</span>
        </div>
        <div class="flex items-center gap-2">
          <button class="search-expand-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <span class="material-icons text-lg">expand_more</span>
          </button>
        </div>
      </div>
      <div class="search-category-content mt-2">
        ${activitiesHtml}
      </div>
    </div>
  `;
}

/**
 * Builds a search activity item
 */
function buildSearchActivityItem(activity, categoryName) {
  return `
    <div class="search-activity-item p-3 bg-white dark:bg-gray-800 rounded-lg mb-2 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors" onclick="handleSearchActivityClick('${activity.id}')">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <span class="material-icons text-gray-600 dark:text-gray-300">${activity.icon || 'fitness_center'}</span>
          </div>
          <div>
            <div class="font-medium text-gray-900 dark:text-white">${activity.name}</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">${categoryName}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="text-blue-500 hover:text-blue-700 text-sm" onclick="event.stopPropagation(); handleStatsClick('${activity.id}')">Stats</button>
          <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" onclick="event.stopPropagation(); handleEditActivityClick('${activity.id}')">
            <span class="material-icons text-sm">edit</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Binds search section events
 */
function bindSearchSectionEvents() {
  // Category color picker events will be bound when categories are created
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('category-color-btn')) {
      // TODO: Implement category color picker
      // console.log('Category color picker not implemented yet');
    }
  });
}

/**
 * Toggles category collapse/expand in search section
 */
function toggleSearchCategory(categoryId) {
  const section = document.querySelector(`#search-category-${categoryId}`);
  if (!section) return;

  const contentDiv = section.querySelector('.search-category-content');
  const iconEl = section.querySelector('.search-expand-btn .material-icons');

  if (!contentDiv || !iconEl) return;

  const isCollapsed = section.classList.contains('collapsed');

  if (isCollapsed) {
    // Expanding
    contentDiv.style.maxHeight = '0px';
    contentDiv.style.overflow = 'hidden';
    contentDiv.classList.remove('hidden');

    // Force reflow
    contentDiv.offsetHeight;

    // Set max height for smooth expansion
    contentDiv.style.maxHeight = contentDiv.scrollHeight + 'px';
    iconEl.style.transform = 'rotate(0deg)';
    section.classList.remove('collapsed');

    // Reset after animation
    setTimeout(() => {
      if (!section.classList.contains('collapsed')) {
        contentDiv.style.maxHeight = '';
        contentDiv.style.overflow = '';
      }
    }, 300);
  } else {
    // Collapsing
    contentDiv.style.maxHeight = contentDiv.scrollHeight + 'px';
    contentDiv.style.overflow = 'hidden';

    // Force reflow
    contentDiv.offsetHeight;

    // Collapse
    contentDiv.style.maxHeight = '0px';
    iconEl.style.transform = 'rotate(-90deg)';
    section.classList.add('collapsed');

    // Hide after animation
    setTimeout(() => {
      if (section.classList.contains('collapsed')) {
        contentDiv.classList.add('hidden');
      }
    }, 300);
  }
}

/**
 * Binds search keyboard navigation
 */
function bindSearchKeyboardNavigation() {
  const searchInput = document.getElementById('fitness-activity-search');
  if (!searchInput) return;

  searchInput.addEventListener('keydown', (e) => {
    if (!isSearchSectionExpanded) return;

    const items = document.querySelectorAll('.search-activity-item');
    const currentIndex = Array.from(items).findIndex((item) =>
      item.classList.contains('highlighted')
    );

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        highlightNextItem(items, currentIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        highlightPrevItem(items, currentIndex);
        break;
      case 'Enter':
        e.preventDefault();
        const highlighted = document.querySelector('.search-activity-item.highlighted');
        if (highlighted) {
          highlighted.click();
        }
        break;
    }
  });
}

/**
 * Highlights the next item in search results
 */
function highlightNextItem(items, currentIndex) {
  if (items.length === 0) return;

  // Remove current highlight
  items.forEach((item) => item.classList.remove('highlighted'));

  // Highlight next item
  const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
  items[nextIndex].classList.add('highlighted');
  items[nextIndex].scrollIntoView({ block: 'nearest' });
}

/**
 * Highlights the previous item in search results
 */
function highlightPrevItem(items, currentIndex) {
  if (items.length === 0) return;

  // Remove current highlight
  items.forEach((item) => item.classList.remove('highlighted'));

  // Highlight previous item
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
  items[prevIndex].classList.add('highlighted');
  items[prevIndex].scrollIntoView({ block: 'nearest' });
}

/**
 * Updates search section height on window resize
 */
export function updateSearchSectionHeight() {
  if (isSearchSectionExpanded) {
    const content = document.querySelector('#activities-search-section .activities-search-content');
    if (content) {
      const maxHeight = calculateAvailableHeight();
      content.style.maxHeight = `${maxHeight}px`;
    }
  }
}

/**
 * Groups activities by category
 */
function groupActivitiesByCategory(activities) {
  const grouped = {};

  activities.forEach((activity) => {
    const category = appData.fitnessCategories.find((c) => c.id === activity.categoryId);
    const categoryName = category ? category.name : 'Uncategorized';

    if (!grouped[categoryName]) {
      grouped[categoryName] = [];
    }
    grouped[categoryName].push(activity);
  });

  return grouped;
}

/**
 * Handles search activity click
 */
function handleSearchActivityClick(activityId) {
  collapseSearchSection();

  // Import and open activity details modal
  import('./FitnessActivityDetails.js').then((module) => {
    module.openActivityDetailsModal(activityId);
  });
}

/**
 * Handles stats click
 */
function handleStatsClick(activityId) {
  // Import and open stats modal
  import('./FitnessActivityStats.js').then((module) => {
    module.openActivityStatsModal(activityId);
  });
}

/**
 * Handles edit activity click
 */
function handleEditActivityClick(activityId) {
  // Import and open edit modal
  import('./FitnessActivityForm.js').then((module) => {
    module.openEditActivityModal(activityId);
  });
}

// Make functions available globally for onclick handlers
window.toggleSearchCategory = toggleSearchCategory;
window.handleSearchActivityClick = handleSearchActivityClick;
window.handleStatsClick = handleStatsClick;
window.handleEditActivityClick = handleEditActivityClick;
