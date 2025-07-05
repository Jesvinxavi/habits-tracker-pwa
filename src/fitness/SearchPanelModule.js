// SearchPanelModule.js - Orchestrates the search panel and related logic for the fitness feature
import {
  mountSearchInput,
  getSearchQuery,
  clearSearch,
  isSearchExpanded,
} from './SearchPanel/SearchInput.js';
import {
  mountSearchResults,
  showSearchResults,
  hideSearchResults,
  updateSearchResults,
  getSearchResultsContent,
} from './SearchPanel/SearchResults.js';
import { buildCategorySection, bindCategorySectionEvents } from './SearchPanel/CategorySection.js';
import {
  bindActivityTileEvents,
  bindSearchKeyboardNavigation,
} from './SearchPanel/ActivityTile.js';
import { openCategoryColorPicker, updateSearchCategoryButton } from './SearchPanel/ColorPicker.js';

// Import fitness utilities
import {
  getActivitiesByCategory,
  searchActivities,
  getActivityCategory,
  groupActivitiesByMuscleGroup,
} from '../utils/activities.js';
import { mutate } from '../core/state.js';

/**
 * Mounts the complete search panel with input and results
 * @param {Object} callbacks - Object containing callback functions
 * @param {Function} callbacks.onActivityClick - Called when activity is clicked
 * @param {Function} callbacks.onStatsClick - Called when stats button is clicked
 * @param {Function} callbacks.onEditClick - Called when edit button is clicked
 * @returns {HTMLElement} The complete search panel container
 */
export function mountSearchPanel(callbacks = {}) {
  const container = document.createElement('div');
  container.className = 'search-panel';

  // Mount search input (which is the .search-container)
  const searchInput = mountSearchInput(
    handleSearchChange,
    handleSearchExpand,
    handleSearchCollapse
  );

  // Mount search results
  const searchResults = mountSearchResults();

  // Append search results directly to searchInput (the .search-container)
  searchInput.appendChild(searchResults);

  // Append the search input to the main container
  container.appendChild(searchInput);

  // Store callbacks for later use
  container._callbacks = callbacks;

  // Listen for activity deletion events to refresh the search panel
  document.addEventListener('ActivityDeleted', () => {
    if (isSearchExpanded()) {
      const query = getSearchQuery();
      populateSearchSectionContent(query);
    }
  });

  // Listen for modal close events to automatically close search section
  setupModalCloseListeners();

  return container;
}

/**
 * Handles search input changes
 * @param {string} query - The search query
 */
function handleSearchChange(query) {
  populateSearchSectionContent(query);
}

/**
 * Handles search section expansion
 */
function handleSearchExpand() {
  showSearchResults();

  // Populate content with any existing search query
  const query = getSearchQuery();
  populateSearchSectionContent(query);
}

/**
 * Handles search section collapse
 */
function handleSearchCollapse() {
  hideSearchResults();
}

/**
 * Populates the search section content with categories and activities
 * @param {string} query - The search query
 */
function populateSearchSectionContent(query = '') {
  let html = '';

  if (query.trim() === '') {
    // Show all activities grouped by category
    const groupedActivities = getActivitiesByCategory();

    Object.values(groupedActivities).forEach(({ category, activities }) => {
      if (activities.length === 0) return;

      // Special handling for Strength Training – show muscle group sub-headers
      if (category.id === 'strength') {
        const groupedByMG = groupActivitiesByMuscleGroup(activities);
        html += buildCategorySection(category, null, groupedByMG);
      } else {
        html += buildCategorySection(category, activities);
      }
    });
  } else {
    // Search and filter activities
    const searchResults = searchActivities(query);

    if (searchResults.length > 0) {
      // Group search results by category
      const filteredGrouped = {};
      searchResults.forEach((activity) => {
        const category = getActivityCategory(activity.categoryId);
        if (!filteredGrouped[category.id]) {
          filteredGrouped[category.id] = {
            category,
            activities: [],
          };
        }
        filteredGrouped[category.id].activities.push(activity);
      });

      Object.values(filteredGrouped).forEach(({ category, activities }) => {
        // Special handling for Strength Training – show muscle group sub-headers
        if (category.id === 'strength') {
          const groupedByMG = groupActivitiesByMuscleGroup(activities);
          html += buildCategorySection(category, null, groupedByMG);
        } else {
          html += buildCategorySection(category, activities);
        }
      });
    }
  }

  // Handle empty states
  if (html === '') {
    if (query.trim() === '') {
      html = `
        <div class="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <span class="material-icons text-4xl text-gray-400">fitness_center</span>
          <p class="text-gray-600 dark:text-gray-400">No activities available</p>
          <p class="text-sm text-gray-500">Tap "New Activity" to create your first activity</p>
        </div>
      `;
    } else {
      html = `
        <div class="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <span class="material-icons text-4xl text-gray-400">search_off</span>
          <p class="text-gray-600 dark:text-gray-400">No activities found</p>
          <p class="text-sm text-gray-500">Try a different search term or create a new activity</p>
        </div>
      `;
    }
  }

  // Update the search results content
  updateSearchResults(html);

  // Bind event handlers
  bindSearchSectionEvents();
}

/**
 * Binds event handlers for the search section
 */
function bindSearchSectionEvents() {
  const content = getSearchResultsContent();
  if (!content) return;

  // Get callbacks from the container
  const container = document.querySelector('.search-panel');
  const callbacks = container?._callbacks || {};

  // Bind category section events
  bindCategorySectionEvents(content, handleCategoryColorChange);

  // Bind activity tile events
  bindActivityTileEvents(
    content,
    callbacks.onActivityClick,
    callbacks.onStatsClick,
    callbacks.onEditClick
  );

  // Enable keyboard navigation for search results
  bindSearchKeyboardNavigation(handleSearchCollapse);
}

/**
 * Handles category color change
 * @param {HTMLElement} button - The category edit button
 */
function handleCategoryColorChange(button) {
  openCategoryColorPicker(button, (categoryId, newColor, buttonElement) => {
    updateCategoryColor(categoryId, newColor);
    updateSearchCategoryButton(buttonElement, newColor);

    // Don't close search section - let user see the updated color
    // The search section will refresh to show the new color
  });
}

/**
 * Updates category color in the data and saves
 * @param {string} categoryId - The category ID
 * @param {string} newColor - The new color hex value
 */
function updateCategoryColor(categoryId, newColor) {
  // Update fitness activity categories (not habits categories)
  mutate((state) => {
    const activityCategories = state.activityCategories || [];
    const category = activityCategories.find((cat) => cat.id === categoryId);
    if (category) {
      category.color = newColor;
    }
  });

  // Trigger refresh of the search section to show updated color
  if (isSearchExpanded()) {
    const query = getSearchQuery();
    populateSearchSectionContent(query);
  }
}

/**
 * Updates the search panel content (useful for external refresh)
 */
export function refreshSearchPanel() {
  if (isSearchExpanded()) {
    const query = getSearchQuery();
    populateSearchSectionContent(query);
  }
}

/**
 * Clears the search panel
 */
export function clearSearchPanel() {
  clearSearch();
  if (isSearchExpanded()) {
    populateSearchSectionContent('');
  }
}

/**
 * Sets up event listeners for modal close events
 */
function setupModalCloseListeners() {
  // Only listen for specific modal close events via custom events
  document.addEventListener('modalClosed', (e) => {
    const modalId = e.detail?.modalId;

    // Only close search section for specific modals that should trigger this behavior
    const modalsThatShouldCloseSearch = ['activity-stats-modal'];

    if (modalsThatShouldCloseSearch.includes(modalId) && isSearchExpanded()) {
      handleSearchCollapse();
    }
  });

  // Remove the click event listener for close buttons - let the click outside handler manage this
  // The click outside handler is now properly configured to not close when clicking on modal elements
}
