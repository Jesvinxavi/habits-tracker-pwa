/**
 * Fitness view controller - manages the fitness tracking page
 */

import { mountCalendar } from './calendar.js';
import { isRestDay, toggleRestDay } from '../utils/restDays.js';
import { appData, mutate, subscribe } from '../core/state.js';
import { openModal, closeModal } from '../components/Modal.js';
import { makeCardSwipable } from '../components/swipeableCard.js';
import { hexToRgba } from '../utils/color.js';
import { getLocalISODate } from '../utils/datetime.js';
import {
  getActivitiesForDate,
  getActivitiesByCategory,
  searchActivities,
  recordActivity,
  getActivityCategory,
  deleteRecordedActivity,
  updateRecordedActivity,
  getActivity,
  addActivity,
} from '../utils/activities.js';
import {
  startTimer,
  stopTimer,
  resetTimer,
  getTimerState,
  formatElapsedTime,
  setTimerUpdateCallback,
  initializeTimer,
} from '../utils/timer.js';

// State for search section expansion
let isSearchSectionExpanded = false;

/**
 * Initializes the fitness view with all its components
 */
export function initializeFitness() {
  // Clean up any fitness categories that accidentally got mixed into habits categories
  cleanupFitnessFromHabitsCategories();

  // Ensure fitness always starts on today when initialized
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to local midnight to avoid timezone issues

  // Create local ISO string to avoid timezone conversion issues
  const localToday = getLocalISODate(today) + 'T00:00:00.000Z';

  mutate((s) => {
    s.fitnessSelectedDate = localToday;
  });
  buildHeader();
  buildCalendar();
  buildActivitiesList();
  bindRestToggle();
  bindActionButtons();
  setupAddActivityModal();
  // setupAddActivityDetailsModal registers once
  setupActivityDetailsModal();

  // Subscribe to state changes for reactive updates
  subscribe(() => {
    renderActivitiesList();
    updateRestToggle();
    updateTimerButton();
  });

  // Initial render
  renderActivitiesList();

  // Update container height on viewport resize and handle responsive behavior
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      adjustActivitiesContainerHeight();
      updateSearchSectionHeight();

      // Handle responsive search section behavior
      if (isSearchSectionExpanded) {
        // Recalculate layout on orientation change
        setTimeout(() => {
          const content = document.querySelector(
            '#activities-search-section .activities-search-content'
          );
          if (content) {
            const maxHeight = calculateAvailableHeight();
            content.style.maxHeight = `${maxHeight}px`;
          }
        }, 100);
      }
    });

    // Handle viewport meta for better mobile experience
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        if (isSearchSectionExpanded) {
          updateSearchSectionHeight();
        }
      }, 500); // Wait for orientation change to complete
    });
  }
}

/**
 * Builds the header for the fitness view
 */
function buildHeader() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Clear any existing content
  fitnessView.innerHTML = '';

  buildHeaderBar();
  buildActionButtons();
  buildSearchBar();
  buildCalendarWrapper();
  buildRestDayRow();
}

/**
 * Builds the header bar with title
 */
function buildHeaderBar() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Create header identical to Habits page
  const header = document.createElement('header');
  header.className =
    'app-header flex justify-between items-center h-11 px-4 sm:px-6 lg:px-8 border-b border-gray-200 dark:border-gray-700 border-opacity-50 w-full';

  header.innerHTML = `
    <div></div>
    <h1 class="app-title text-center flex-grow text-[36px] font-extrabold leading-none flex items-end">Fitness</h1>
    <div></div>
  `;

  fitnessView.appendChild(header);
}

/**
 * Builds the action buttons row (New Activity + Start Timer)
 */
function buildActionButtons() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Add Action Buttons row (like Habits page)
  const actionButtonsRow = document.createElement('div');
  actionButtonsRow.className = 'action-buttons flex gap-3 mb-1 px-4 pt-1';
  actionButtonsRow.innerHTML = `
    <button id="new-activity-btn" class="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-1.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      New Activity
    </button>
    <button id="start-timer-btn" class="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-1.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2">
      <span class="material-icons text-xl">schedule</span>
      Timer
    </button>
  `;
  fitnessView.appendChild(actionButtonsRow);

  // Make button text bold like habits page
  actionButtonsRow.querySelectorAll('#new-activity-btn, #start-timer-btn').forEach((btn) => {
    btn.classList.add('font-semibold');
  });
}

/**
 * Builds the search bar with expandable activities section
 */
function buildSearchBar() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Add Search Bar container with expandable section
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container px-4';
  searchContainer.innerHTML = `
    <div class="search-input relative border-2 border-gray-300 dark:border-gray-500 rounded-xl">
      <svg class="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <input id="fitness-activity-search" type="text" placeholder="Search activities..." class="w-full pl-10 pr-10 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl border-none outline-none focus:bg-white dark:focus:bg-gray-600 transition-colors cursor-pointer" autocomplete="off" spellcheck="false">
      <button id="close-search-btn" class="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors hidden">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    
    <!-- Expandable Activities Section -->
    <div id="activities-search-section" class="activities-search-section hidden bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-500 rounded-xl mt-2 overflow-hidden transition-all duration-300 ease-in-out">
      <div class="activities-search-content overflow-y-auto">
        <!-- Content will be populated dynamically -->
      </div>
    </div>
  `;

  fitnessView.appendChild(searchContainer);

  // Bind search input click handler
  bindSearchExpansion();
}

/**
 * Binds search bar click to expand/collapse functionality
 */
function bindSearchExpansion() {
  const searchInput = document.getElementById('fitness-activity-search');
  const searchSection = document.getElementById('activities-search-section');
  const closeBtn = document.getElementById('close-search-btn');

  if (!searchInput || !searchSection) return;

  // Combined handler for both click and focus - expand on first interaction
  const expandOnInteraction = (e) => {
    if (!isSearchSectionExpanded) {
      e.preventDefault(); // Prevent default only when we're expanding
      expandSearchSection();
    }
  };

  // Bind to both click and focus for reliable expansion
  searchInput.addEventListener('click', expandOnInteraction);
  searchInput.addEventListener('focus', expandOnInteraction);

  // Add search input functionality
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    if (isSearchSectionExpanded) {
      populateSearchSectionContent(query);
    }
  });

  // Bind close button click handler
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // Clear search input when closing
      searchInput.value = '';
      collapseSearchSection();
    });
  }

  // Close section when clicking outside
  document.addEventListener('click', (e) => {
    if (
      isSearchSectionExpanded &&
      !searchInput.contains(e.target) &&
      !searchSection.contains(e.target)
    ) {
      collapseSearchSection();
    }
  });

  // Keyboard navigation support
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      collapseSearchSection();
      searchInput.blur();
    } else if (e.key === 'ArrowDown' && isSearchSectionExpanded) {
      e.preventDefault();
      // Focus first activity button in search results
      const firstActivity = searchSection.querySelector('.search-activity-item');
      if (firstActivity) {
        firstActivity.focus();
      }
    }
  });

  // Add focus management for activity items
  if (isSearchSectionExpanded) {
    bindSearchKeyboardNavigation();
  }
}

/**
 * Expands the search section with dynamic height calculation
 */
function expandSearchSection() {
  const searchSection = document.getElementById('activities-search-section');
  const closeBtn = document.getElementById('close-search-btn');
  if (!searchSection) return;

  // Show the close button
  if (closeBtn) {
    closeBtn.classList.remove('hidden');
  }

  // Show the section
  searchSection.classList.remove('hidden');

  // Calculate available height
  const maxHeight = calculateAvailableHeight();

  // Set the maximum height and enable scrolling
  const content = searchSection.querySelector('.activities-search-content');
  if (content) {
    content.style.maxHeight = `${maxHeight}px`;
    content.style.overflowY = 'auto';
  }

  // Populate content with any existing search query
  const searchInput = document.getElementById('fitness-activity-search');
  const query = searchInput ? searchInput.value : '';
  populateSearchSectionContent(query);

  // Add expanded class for styling
  searchSection.classList.add('expanded');

  // Update expanded state
  isSearchSectionExpanded = true;
}

/**
 * Collapses the search section
 */
function collapseSearchSection() {
  const searchSection = document.getElementById('activities-search-section');
  const closeBtn = document.getElementById('close-search-btn');
  const searchInput = document.getElementById('fitness-activity-search');
  if (!searchSection) return;

  // Hide the close button
  if (closeBtn) {
    closeBtn.classList.add('hidden');
  }

  // Clear search input if not already cleared
  if (searchInput && searchInput.value !== '') {
    searchInput.value = '';
  }

  searchSection.classList.remove('expanded');

  // Use setTimeout to allow CSS transition to complete
  setTimeout(() => {
    searchSection.classList.add('hidden');
  }, 800);

  // Update expanded state
  isSearchSectionExpanded = false;
}

/**
 * Calculates available height for the search section
 * Stops just above the navigation bar
 */
function calculateAvailableHeight() {
  const searchContainer = document.querySelector('#fitness-view .search-container');
  if (!searchContainer) return 300; // Fallback height

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

  // Ensure minimum height and maximum reasonable height
  return Math.max(200, Math.min(availableHeight, 600));
}

/**
 * Populates the search section content with categories and activities
 */
function populateSearchSectionContent(query = '') {
  const content = document.querySelector('#activities-search-section .activities-search-content');
  if (!content) return;

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

  content.innerHTML = html;

  // Bind event handlers
  bindSearchSectionEvents();

  // Enable keyboard navigation for search results
  bindSearchKeyboardNavigation();
}

/**
 * Builds a category section with collapsible header and activities
 */
function buildCategorySection(category, activities = null, muscleGroups = null) {
  const categoryId = `search-category-${category.id}`;

  // Build expand/collapse button
  const expandBtn = `
    <button class="search-expand-btn h-5 w-5 flex items-center justify-center text-black" data-category-id="${category.id}">
      <span class="material-icons transition-transform leading-none">expand_more</span>
    </button>
  `;

  // Build edit button matching habits page style
  const editBtn = `
    <button class="search-edit-category-btn w-8 h-8 rounded-full flex items-center justify-center ml-2" data-category-id="${category.id}" style="background-color:${category.color}">
      <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/>
      </svg>
    </button>
  `;

  // Build activities content
  let activitiesContent = '';

  if (muscleGroups) {
    // Handle strength training with muscle groups
    activitiesContent = Object.entries(muscleGroups)
      .map(
        ([mg, list]) => `
      <div class="muscle-group mb-2">
        <div class="muscle-header pl-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300">${formatMuscleName(mg)}</div>
        <div class="category-activities pl-6">
          ${list.map((activity) => buildSearchActivityItem(activity, category)).join('')}
        </div>
      </div>
    `
      )
      .join('');
  } else if (activities) {
    // Handle regular activities
    activitiesContent = `
      <div class="category-activities pl-6">
        ${activities.map((activity) => buildSearchActivityItem(activity, category)).join('')}
      </div>
    `;
  }

  return `
    <div class="search-category-section mb-4" data-category-id="${category.id}" id="${categoryId}">
      <div class="search-category-header-wrapper flex items-center">
        <div class="search-category-header flex items-center justify-between px-4 py-1 rounded-t-xl cursor-pointer select-none flex-grow" style="background:${category.color}20;">
          <div class="category-title flex items-center gap-2">
            <span class="text-lg" aria-hidden="true">${category.icon}</span>
            <span class="font-semibold text-gray-900 dark:text-white">${category.name}</span>
          </div>
          ${expandBtn}
        </div>
        <div class="-ml-2">${editBtn}</div>
      </div>
      <div class="search-category-content">
        ${activitiesContent}
      </div>
    </div>
  `;
}

/**
 * Builds an activity item with action buttons for the search section
 */
function buildSearchActivityItem(activity, category) {
  return `
    <div style="margin-bottom: 0.25rem;">
      <div class="search-activity-item activity-card flex items-center px-3 py-2 rounded-xl w-full transition-colors focus:outline-none focus:ring-2 focus:ring-ios-blue focus:ring-offset-2 dark:focus:ring-offset-gray-800" style="border: 3px solid ${category.color}; background-color: ${hexToRgba(category.color, 0.05)};" data-activity-id="${activity.id}">
        <div class="activity-icon w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center mr-3 text-xl" style="border: 2px solid ${category.color}; color: ${category.color};" aria-hidden="true">
          ${activity.icon || category.icon}
        </div>
        <div class="activity-content flex-grow text-left">
          <div class="activity-name font-semibold leading-tight text-gray-900 dark:text-white">${activity.name}</div>
        </div>
        <div class="activity-actions flex items-center gap-2 ml-3">
          <button class="stats-btn w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors" data-activity-id="${activity.id}" title="View Stats">
            <span class="material-icons text-lg">bar_chart</span>
          </button>
          <button class="edit-activity-btn w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" data-activity-id="${activity.id}" title="Edit Activity">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Binds event handlers for the search section
 */
function bindSearchSectionEvents() {
  const content = document.querySelector('#activities-search-section .activities-search-content');
  if (!content) return;

  // Category collapse/expand functionality
  content.querySelectorAll('.search-expand-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSearchCategory(btn.dataset.categoryId);
    });
  });

  content.querySelectorAll('.search-category-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.search-expand-btn') || e.target.closest('.search-edit-category-btn'))
        return;
      const categoryId = header.closest('.search-category-section').dataset.categoryId;
      toggleSearchCategory(categoryId);
    });
  });

  // Category edit buttons
  content.querySelectorAll('.search-edit-category-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCategoryColorPicker(btn);
    });
  });

  // Activity action buttons
  content.querySelectorAll('.stats-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleStatsClick(btn.dataset.activityId);
    });
  });

  content.querySelectorAll('.edit-activity-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleEditActivityClick(btn.dataset.activityId);
    });
  });

  // Main activity tile clicks for direct recording
  content.querySelectorAll('.search-activity-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      // Don't trigger if clicking on action buttons
      if (e.target.closest('.activity-actions')) {
        return;
      }

      const activityId = item.dataset.activityId;
      handleSearchActivityClick(activityId);
    });
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

    // Set max height to scroll height for smooth expansion
    contentDiv.style.maxHeight = contentDiv.scrollHeight + 'px';
    iconEl.style.transform = 'rotate(0deg)';
    section.classList.remove('collapsed');

    // Reset max-height after animation completes
    setTimeout(() => {
      if (!section.classList.contains('collapsed')) {
        contentDiv.style.maxHeight = '';
        contentDiv.style.overflow = '';
      }
    }, 800);
  } else {
    // Collapsing
    contentDiv.style.maxHeight = contentDiv.scrollHeight + 'px';
    contentDiv.style.overflow = 'hidden';

    // Force reflow
    contentDiv.offsetHeight;

    // Collapse to 0
    contentDiv.style.maxHeight = '0px';
    iconEl.style.transform = 'rotate(-90deg)';
    section.classList.add('collapsed');

    // Hide after animation completes
    setTimeout(() => {
      if (section.classList.contains('collapsed')) {
        contentDiv.classList.add('hidden');
      }
    }, 800);
  }
}

/**
 * Binds keyboard navigation for search results
 */
function bindSearchKeyboardNavigation() {
  const activityItems = document.querySelectorAll(
    '#activities-search-section .search-activity-item'
  );

  activityItems.forEach((item, index) => {
    // Make items focusable
    item.setAttribute('tabindex', '0');

    item.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          const nextItem = activityItems[index + 1];
          if (nextItem) {
            nextItem.focus();
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (index === 0) {
            // Return focus to search input
            const searchInput = document.getElementById('fitness-activity-search');
            if (searchInput) searchInput.focus();
          } else {
            const prevItem = activityItems[index - 1];
            if (prevItem) {
              prevItem.focus();
            }
          }
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          // Trigger click on the focused activity item
          item.click();
          break;

        case 'Escape':
          e.preventDefault();
          collapseSearchSection();
          const searchInput = document.getElementById('fitness-activity-search');
          if (searchInput) {
            searchInput.focus();
          }
          break;
      }
    });

    // Add focus styles
    item.addEventListener('focus', () => {
      item.style.outline = '2px solid #3B82F6';
      item.style.outlineOffset = '2px';
    });

    item.addEventListener('blur', () => {
      item.style.outline = '';
      item.style.outlineOffset = '';
    });
  });
}

/**
 * Updates search section height on window resize
 */
function updateSearchSectionHeight() {
  if (isSearchSectionExpanded) {
    const content = document.querySelector('#activities-search-section .activities-search-content');
    if (content) {
      const maxHeight = calculateAvailableHeight();
      content.style.maxHeight = `${maxHeight}px`;
    }
  }
}

/**
 * Opens a lightweight color picker popup for category color selection
 */
function openCategoryColorPicker(button) {
  const categoryId = button.dataset.categoryId;
  const category = getActivityCategory(categoryId);
  if (!category) return;

  // Remove any existing color picker
  const existingPicker = document.querySelector('.category-color-picker');
  if (existingPicker) {
    existingPicker.remove();
  }

  // Create color picker popup
  const colorPicker = document.createElement('div');
  colorPicker.className =
    'category-color-picker bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700';
  colorPicker.style.cssText = `
    position: absolute;
    z-index: 1000;
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    width: 180px;
    max-width: 180px;
  `;

  // Available colors with gradients (matching habits page)
  const colorOptions = [
    { hex: '#ef4444', gradient: 'from-red-500 to-red-600', shadow: 'hover:shadow-red-500/25' },
    {
      hex: '#f97316',
      gradient: 'from-orange-500 to-orange-600',
      shadow: 'hover:shadow-orange-500/25',
    },
    {
      hex: '#eab308',
      gradient: 'from-yellow-500 to-yellow-600',
      shadow: 'hover:shadow-yellow-500/25',
    },
    {
      hex: '#22c55e',
      gradient: 'from-green-500 to-green-600',
      shadow: 'hover:shadow-green-500/25',
    },
    { hex: '#06b6d4', gradient: 'from-cyan-500 to-cyan-600', shadow: 'hover:shadow-cyan-500/25' },
    { hex: '#3b82f6', gradient: 'from-blue-500 to-blue-600', shadow: 'hover:shadow-blue-500/25' },
    {
      hex: '#8b5cf6',
      gradient: 'from-violet-500 to-violet-600',
      shadow: 'hover:shadow-violet-500/25',
    },
    { hex: '#ec4899', gradient: 'from-pink-500 to-pink-600', shadow: 'hover:shadow-pink-500/25' },
    {
      hex: '#64748b',
      gradient: 'from-slate-500 to-slate-600',
      shadow: 'hover:shadow-slate-500/25',
    },
    { hex: '#374151', gradient: 'from-gray-700 to-gray-800', shadow: 'hover:shadow-gray-500/25' },
    { hex: '#7c2d12', gradient: 'from-red-900 to-red-950', shadow: 'hover:shadow-red-900/25' },
    {
      hex: '#166534',
      gradient: 'from-green-800 to-green-900',
      shadow: 'hover:shadow-green-800/25',
    },
  ];

  // Create color options
  colorOptions.forEach(({ hex, gradient, shadow }) => {
    const colorOption = document.createElement('button');
    colorOption.className = `color-option w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} shadow-lg hover:scale-110 transition-all duration-200 ${shadow}`;

    // Add selection ring if this is the current color
    if (hex === category.color) {
      colorOption.classList.add(
        'ring-2',
        'ring-black',
        'dark:ring-white',
        'ring-offset-2',
        'ring-offset-white',
        'dark:ring-offset-gray-800'
      );
    }

    colorOption.addEventListener('click', () => {
      updateCategoryColor(categoryId, hex);
      updateSearchCategoryButton(button, hex);
      colorPicker.remove();
    });

    colorPicker.appendChild(colorOption);
  });

  // Position the picker near the button
  const buttonRect = button.getBoundingClientRect();
  const searchContainer = document.querySelector('#activities-search-section');
  const containerRect = searchContainer.getBoundingClientRect();

  // Position to the left of the button
  colorPicker.style.top = `${buttonRect.top - containerRect.top}px`;
  colorPicker.style.right = `${containerRect.right - buttonRect.left + 8}px`;

  // Add to search container
  searchContainer.appendChild(colorPicker);

  // Close picker when clicking outside
  const closePickerOnClick = (e) => {
    if (!colorPicker.contains(e.target) && e.target !== button) {
      colorPicker.remove();
      document.removeEventListener('click', closePickerOnClick);
    }
  };

  // Add delay to prevent immediate closing
  setTimeout(() => {
    document.addEventListener('click', closePickerOnClick);
  }, 100);
}

/**
 * Updates category color in the data and saves
 */
function updateCategoryColor(categoryId, newColor) {
  // Update fitness activity categories (not habits categories)
  const activityCategories = appData.activityCategories || [];
  const category = activityCategories.find((cat) => cat.id === categoryId);
  if (category) {
    category.color = newColor;

    // Save the updated categories
    mutate((s) => {
      s.activityCategories = activityCategories;
    });

    // Trigger refresh of the search section to show updated color
    if (isSearchSectionExpanded) {
      const searchInput = document.getElementById('fitness-activity-search');
      const query = searchInput ? searchInput.value : '';
      populateSearchSectionContent(query);
    }
  }
}

/**
 * Updates the search category button color immediately
 */
function updateSearchCategoryButton(button, newColor) {
  button.style.backgroundColor = newColor;
}

/**
 * Cleans up any fitness categories that accidentally got added to habits categories
 */
function cleanupFitnessFromHabitsCategories() {
  const fitnessCategories = ['cardio', 'strength', 'stretching', 'sports', 'other'];

  mutate((s) => {
    // Remove any fitness categories from habits categories
    const originalLength = s.categories.length;
    s.categories = s.categories.filter((cat) => !fitnessCategories.includes(cat.id));

    const removedCount = originalLength - s.categories.length;
    if (removedCount > 0) {
      // Removed console.log for cleaner code
    }
  });
}

/**
 * Handles direct activity recording from search section tiles
 */
function handleSearchActivityClick(activityId) {
  // Check if it's a rest day and prevent recording
  const selectedDate = appData.fitnessSelectedDate || new Date().toISOString();
  const iso = getLocalISODate(selectedDate);
  if (isRestDay(iso)) {
    return; // Don't record on rest days
  }

  const activity = getActivity(activityId);
  if (!activity) return;

  // Open the activity details modal for all activities (both time-based and sets/reps)
  openActivityDetailsModal(activityId);
}

/**
 * Handles stats button click - opens activity statistics modal
 */
function handleStatsClick(activityId) {
  const activity = getActivity(activityId);
  if (!activity) return;

  // Calculate activity statistics
  const stats = calculateActivityStatistics(activityId);

  // Open stats modal with calculated data
  openActivityStatsModal(activity, stats);
}

/**
 * Calculates comprehensive statistics for an activity
 */
function calculateActivityStatistics(activityId) {
  const activity = getActivity(activityId);
  if (!activity) return null;

  // Get all records for this activity across all dates
  const allRecords = [];
  Object.values(appData.recordedActivities || {}).forEach((dayRecords) => {
    dayRecords.forEach((record) => {
      if (record.activityId === activityId) {
        allRecords.push(record);
      }
    });
  });

  if (allRecords.length === 0) {
    return {
      totalSessions: 0,
      totalDuration: 0,
      totalSets: 0,
      totalReps: 0,
      totalVolume: 0,
      averageDuration: 0,
      averageSets: 0,
      averageReps: 0,
      mostCommonIntensity: null,
      lastPerformed: null,
      bestSession: null,
      recentFrequency: 0,
      weeklyAverage: 0,
    };
  }

  // Sort records by timestamp
  allRecords.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const stats = {
    totalSessions: allRecords.length,
    totalDuration: 0,
    totalSets: 0,
    totalReps: 0,
    totalVolume: 0,
    averageDuration: 0,
    averageSets: 0,
    averageReps: 0,
    mostCommonIntensity: null,
    lastPerformed: allRecords[allRecords.length - 1].timestamp,
    bestSession: null,
    recentFrequency: 0,
    weeklyAverage: 0,
  };

  // Calculate metrics based on tracking type
  if (activity.trackingType === 'sets-reps') {
    let maxVolume = 0;
    let bestSessionRecord = null;

    allRecords.forEach((record) => {
      if (record.sets && record.sets.length > 0) {
        stats.totalSets += record.sets.length;

        record.sets.forEach((set) => {
          if (set.reps) stats.totalReps += parseInt(set.reps) || 0;
          if (set.value && set.unit && set.unit !== 'none') {
            const weight = parseFloat(set.value) || 0;
            const reps = parseInt(set.reps) || 0;
            const volume = weight * reps;
            stats.totalVolume += volume;

            // Track best session by total volume
            if (volume > maxVolume) {
              maxVolume = volume;
              bestSessionRecord = record;
            }
          }
        });
      }
    });

    stats.averageSets = stats.totalSets / stats.totalSessions;
    stats.averageReps = stats.totalReps / stats.totalSessions;
    stats.bestSession = bestSessionRecord;
  } else {
    // Time-based tracking
    const intensities = {};
    let maxDuration = 0;
    let bestSessionRecord = null;

    allRecords.forEach((record) => {
      if (record.duration) {
        let durationInMinutes = parseInt(record.duration) || 0;

        // Convert to minutes for consistency
        if (record.durationUnit === 'hours') {
          durationInMinutes *= 60;
        } else if (record.durationUnit === 'seconds') {
          durationInMinutes /= 60;
        }

        stats.totalDuration += durationInMinutes;

        // Track best session by duration
        if (durationInMinutes > maxDuration) {
          maxDuration = durationInMinutes;
          bestSessionRecord = record;
        }
      }

      if (record.intensity) {
        intensities[record.intensity] = (intensities[record.intensity] || 0) + 1;
      }
    });

    stats.averageDuration = stats.totalDuration / stats.totalSessions;
    stats.bestSession = bestSessionRecord;

    // Find most common intensity
    if (Object.keys(intensities).length > 0) {
      stats.mostCommonIntensity = Object.entries(intensities).sort(([, a], [, b]) => b - a)[0][0];
    }
  }

  // Calculate recent frequency (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentRecords = allRecords.filter((record) => new Date(record.timestamp) > thirtyDaysAgo);
  stats.recentFrequency = recentRecords.length;

  // Calculate weekly average (total sessions / weeks since first session)
  const firstSession = new Date(allRecords[0].timestamp);
  const now = new Date();
  const daysSinceFirst = Math.max(1, (now - firstSession) / (1000 * 60 * 60 * 24));
  const weeksSinceFirst = daysSinceFirst / 7;
  stats.weeklyAverage = stats.totalSessions / weeksSinceFirst;

  return stats;
}

/**
 * Opens activity statistics modal with calculated data
 */
function openActivityStatsModal(activity, stats) {
  const category = getActivityCategory(activity.categoryId);

  // Create modal HTML
  const modalHTML = `
    <div id="activity-stats-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
      <div class="modal-content bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
        <div class="modal-header flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="activity-icon w-10 h-10 rounded-full flex items-center justify-center text-xl" style="background-color: ${category.color}20; color: ${category.color};">
              ${activity.icon || category.icon}
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${activity.name}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">Activity Statistics</p>
            </div>
          </div>
          <button id="close-stats-modal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        
        <div class="modal-body p-4 overflow-y-auto">
          ${buildStatsContent(activity, stats, category)}
        </div>
      </div>
    </div>
  `;

  // Remove existing modal if present
  const existingModal = document.getElementById('activity-stats-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Add modal to document
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Bind close handlers
  const modal = document.getElementById('activity-stats-modal');
  const closeIcon = document.getElementById('close-stats-modal');

  const closeModal = () => {
    if (modal) {
      modal.classList.add('hidden');
      setTimeout(() => modal.remove(), 300);
    }
  };

  if (closeIcon) closeIcon.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Show modal
  if (modal) {
    modal.classList.remove('hidden');
  }
}

/**
 * Builds the statistics content HTML
 */
function buildStatsContent(activity, stats, category) {
  if (stats.totalSessions === 0) {
    return `
      <div class="text-center py-8">
        <span class="material-icons text-4xl text-gray-400 mb-4">bar_chart</span>
        <p class="text-gray-600 dark:text-gray-400">No recorded sessions yet</p>
        <p class="text-sm text-gray-500 mt-2">Start tracking this activity to see statistics</p>
      </div>
    `;
  }

  let content = `
    <div class="stats-grid space-y-4">
      <!-- Overview Stats -->
      <div class="stats-section">
        <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Overview</h4>
        <div class="grid grid-cols-2 gap-4">
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-2xl font-bold text-gray-900 dark:text-white">${stats.totalSessions}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Total Sessions</div>
          </div>
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-2xl font-bold text-gray-900 dark:text-white">${stats.weeklyAverage.toFixed(1)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Per Week Average</div>
          </div>
        </div>
      </div>
  `;

  // Activity-specific stats
  if (activity.trackingType === 'sets-reps') {
    content += `
      <div class="stats-section">
        <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Strength Metrics</h4>
        <div class="grid grid-cols-2 gap-4">
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.totalSets}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Total Sets</div>
          </div>
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.totalReps}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Total Reps</div>
          </div>
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.averageSets.toFixed(1)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Avg Sets/Session</div>
          </div>
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.averageReps.toFixed(1)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Avg Reps/Session</div>
          </div>
        </div>
        ${
          stats.totalVolume > 0
            ? `
        <div class="mt-4">
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.totalVolume.toFixed(1)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Total Volume (weight × reps)</div>
          </div>
        </div>
      `
            : ''
        }
      </div>
    `;
  } else {
    content += `
      <div class="stats-section">
        <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Duration Metrics</h4>
        <div class="grid grid-cols-2 gap-4">
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${formatDuration(stats.totalDuration)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Total Duration</div>
          </div>
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${formatDuration(stats.averageDuration)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Avg Duration</div>
          </div>
        </div>
        ${
          stats.mostCommonIntensity
            ? `
          <div class="mt-4">
            <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <div class="stat-value text-lg font-bold text-gray-900 dark:text-white capitalize">${stats.mostCommonIntensity}</div>
              <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Most Common Intensity</div>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  // Recent activity
  content += `
    <div class="stats-section">
      <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Recent Activity</h4>
      <div class="grid grid-cols-2 gap-4">
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.recentFrequency}</div>
          <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Last 30 Days</div>
        </div>
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="stat-value text-sm font-bold text-gray-900 dark:text-white">${formatLastPerformed(stats.lastPerformed)}</div>
          <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Last Performed</div>
        </div>
      </div>
    </div>
  `;

  // Best session
  if (stats.bestSession) {
    content += `
      <div class="stats-section">
        <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Best Session</h4>
        <div class="stat-card bg-gradient-to-r from-${category.color.slice(1)} to-${category.color.slice(1)} bg-opacity-10 p-4 rounded-lg border-2" style="border-color: ${category.color}40;">
          ${formatBestSession(stats.bestSession, activity)}
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
            ${new Date(stats.bestSession.timestamp).toLocaleDateString()}
          </div>
        </div>
      </div>
    `;
  }

  content += '</div>';
  return content;
}

/**
 * Helper function to format duration in minutes to readable format
 */
function formatDuration(minutes) {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
}

/**
 * Helper function to format last performed date
 */
function formatLastPerformed(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

/**
 * Helper function to format best session details
 */
function formatBestSession(session, activity) {
  if (activity.trackingType === 'sets-reps' && session.sets) {
    const totalVolume = session.sets.reduce((sum, set) => {
      const weight = parseFloat(set.value) || 0;
      const reps = parseInt(set.reps) || 0;
      return sum + weight * reps;
    }, 0);

    const maxWeight = Math.max(...session.sets.map((set) => parseFloat(set.value) || 0));

    return `
      <div class="text-sm font-semibold text-gray-900 dark:text-white">
        ${session.sets.length} sets • ${totalVolume.toFixed(1)} volume
      </div>
      <div class="text-xs text-gray-600 dark:text-gray-300">
        Max weight: ${maxWeight}${session.sets[0]?.unit !== 'none' ? session.sets[0]?.unit || '' : ''}
      </div>
    `;
  } else {
    let durationText = '';
    if (session.duration) {
      let duration = session.duration;
      let unit = session.durationUnit || 'minutes';

      if (unit === 'hours') {
        duration = duration * 60;
        unit = 'minutes';
      } else if (unit === 'seconds') {
        duration = Math.round(duration / 60);
        unit = 'minutes';
      }

      durationText = `${duration} ${unit === 'minutes' ? 'min' : unit}`;
    }

    return `
      <div class="text-sm font-semibold text-gray-900 dark:text-white">
        ${durationText}${session.intensity ? ` • ${session.intensity} intensity` : ''}
      </div>
      <div class="text-xs text-gray-600 dark:text-gray-300">
        Longest duration session
      </div>
    `;
  }
}

/**
 * Handles edit activity button click
 */
function handleEditActivityClick(activityId) {
  const activity = getActivity(activityId);
  if (!activity) return;

  // Close search section
  collapseSearchSection();

  // Open edit activity modal with pre-populated data
  openEditActivityModal(activityId);
}

/**
 * Handles delete activity button click
 */
function handleDeleteActivityClick(activityId) {
  const activity = getActivity(activityId);
  if (!activity) return;

  import('../components/ConfirmDialog.js').then((module) => {
    module.showConfirm({
      title: 'Delete Activity?',
      message: `Are you sure you want to delete "${activity.name}"? This action cannot be undone.`,
      okText: 'Delete',
      onOK: () => {
        deleteActivity(activityId);

        // Close edit modal if it's open
        const editModal = document.getElementById('add-activity-modal');
        if (editModal && editModal.dataset.editMode === 'true') {
          import('../components/Modal.js').then((modalModule) => {
            modalModule.closeModal('add-activity-modal');
          });
        }

        // Refresh search section content
        populateSearchSectionContent();
        // Refresh the main fitness view
        if (typeof renderActivitiesList === 'function') {
          renderActivitiesList();
        }
      },
    });
  });
}

/**
 * Opens edit activity modal with pre-populated data
 */
function openEditActivityModal(activityId) {
  const activity = getActivity(activityId);
  if (!activity) return;

  // Reset form first
  const form = document.getElementById('add-activity-form');
  if (form) form.reset();

  // Populate form with activity data
  const nameInput = document.getElementById('activity-name-input');
  const categorySelect = document.getElementById('activity-category-select');
  const muscleGroupSelect = document.getElementById('muscle-group-select');
  const muscleGroupSection = document.getElementById('muscle-group-section');

  if (nameInput) nameInput.value = activity.name;

  // Populate category dropdown and select current category
  if (categorySelect) {
    categorySelect.innerHTML =
      '<option value="" disabled>Select a category</option>' +
      appData.activityCategories
        .map(
          (cat) =>
            `<option value="${cat.id}" ${cat.id === activity.categoryId ? 'selected' : ''}>${cat.icon} ${cat.name}</option>`
        )
        .join('');
  }

  // Handle muscle group for strength training
  if (activity.categoryId === 'strength' && activity.muscleGroup) {
    if (muscleGroupSection) muscleGroupSection.classList.remove('hidden');
    if (muscleGroupSelect) muscleGroupSelect.value = activity.muscleGroup;
  } else {
    if (muscleGroupSection) muscleGroupSection.classList.add('hidden');
  }

  // Set icon
  setSelectedActivityIcon(activity.icon || '🏃‍♂️');
  const iconDisplay = document.getElementById('activity-selected-icon-display');
  if (iconDisplay) iconDisplay.textContent = getSelectedActivityIcon();

  // Set tracking type and units
  const trackingType = activity.trackingType || 'time-intensity';
  activateTrackingToggle(trackingType);

  if (activity.units) {
    const unitsSelect = document.getElementById('units-select');
    const unitsSection = document.getElementById('units-section');
    if (unitsSelect) unitsSelect.value = activity.units;
    if (unitsSection && trackingType === 'sets-reps') {
      unitsSection.classList.remove('hidden');
    }
  }

  // Change modal title and button text
  const modalTitle = document.querySelector('#add-activity-modal h2');
  if (modalTitle) modalTitle.textContent = 'Edit Activity';

  const saveBtn = document.getElementById('save-add-activity');
  if (saveBtn) saveBtn.textContent = 'Update Activity';

  // Store activity ID for updating
  const modal = document.getElementById('add-activity-modal');
  if (modal) {
    modal.dataset.editActivityId = activityId;
    modal.dataset.editMode = 'true';
  }

  // Show delete button for edit mode
  const delBtn = ensureActivityDeleteBtn();
  if (delBtn) delBtn.classList.remove('hidden');

  // Show modal
  openModal('add-activity-modal');

  // Setup components after modal is shown
  setTimeout(() => {
    setupActivityIconPicker();
    initializeTrackingTypeToggles();
    updateActivityIconFromCategory();
    if (typeof validateAddActivityForm === 'function') validateAddActivityForm();
  }, 50);
}

/**
 * Deletes an activity
 */
function deleteActivity(activityId) {
  mutate((s) => {
    // Remove from activities array
    s.activities = s.activities?.filter((a) => a.id !== activityId) || [];

    // Remove any recorded activities with this activity ID
    Object.keys(s.recordedActivities || {}).forEach((date) => {
      s.recordedActivities[date] = s.recordedActivities[date].filter(
        (record) => record.activityId !== activityId
      );
      if (s.recordedActivities[date].length === 0) {
        delete s.recordedActivities[date];
      }
    });
  });
}

/**
 * Ensure delete button exists in activity modal footer
 */
function ensureActivityDeleteBtn() {
  const modal = document.getElementById('add-activity-modal');
  if (!modal) return null;

  const modalContent = modal.querySelector('.flex.flex-col');
  if (!modalContent) return null;

  let btn = document.getElementById('delete-activity-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'delete-activity-btn';
    btn.textContent = 'Delete Activity';
    btn.className =
      'w-full py-3 px-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200 mt-4';
    btn.addEventListener('click', () => {
      const modal = document.getElementById('add-activity-modal');
      if (modal && modal.dataset.editActivityId) {
        handleDeleteActivityClick(modal.dataset.editActivityId);
      }
    });

    // Insert before the last form padding div
    const form = modal.querySelector('#add-activity-form');
    if (form) {
      const paddingDiv = form.querySelector('.h-4:last-child');
      if (paddingDiv) {
        paddingDiv.before(btn);
      } else {
        form.appendChild(btn);
      }
    }
  }
  return btn;
}

/**
 * Builds the calendar wrapper and navigation
 */
function buildCalendarWrapper() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Add horizontal calendar container below header
  const calendarWrapper = document.createElement('div');
  calendarWrapper.className = 'week-calendar overflow-x-auto no-scrollbar m-0 p-0';
  calendarWrapper.id = 'fitness-calendar';

  fitnessView.appendChild(calendarWrapper);
}

/**
 * Adds navigation buttons to the calendar after mountCalendar creates the week-days
 */
function addCalendarNavigation() {
  const calendarWrapper = document.getElementById('fitness-calendar');
  if (!calendarWrapper) return;

  // Check if navigation already exists
  if (calendarWrapper.querySelector('.calendar-nav')) return;

  // Add navigation buttons below the calendar (after week-days)
  const navContainer = document.createElement('div');
  navContainer.className =
    'calendar-nav flex justify-center items-center gap-4 lg:gap-6 relative -top-1.5';
  navContainer.innerHTML = `
    <button class="nav-arrow prev-week text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">‹‹</button>
    <button class="nav-arrow prev-day text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">‹</button>
    <button class="today-btn bg-ios-blue text-white rounded-full font-medium hover:bg-blue-600 transition-colors spring lg:px-6 lg:text-lg">Today</button>
    <button class="nav-arrow next-day text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">›</button>
    <button class="nav-arrow next-week text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">››</button>
  `;

  // Try to insert after week-days if it exists, otherwise append to wrapper
  const weekDays = calendarWrapper.querySelector('.week-days');
  if (weekDays) {
    weekDays.insertAdjacentElement('afterend', navContainer);
  } else {
    calendarWrapper.appendChild(navContainer);
  }
}

function bindCalendarNavigation(container) {
  // Replicate the navigation binding logic from mountCalendar with bounds checking

  function getStateDate() {
    return new Date(appData.fitnessSelectedDate);
  }

  function setStateDate(dateObj) {
    mutate((s) => {
      // Create ISO string manually without timezone conversion for fitness dates
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const localISOString = `${year}-${month}-${day}T00:00:00.000Z`;
      s.fitnessSelectedDate = localISOString;
    });
    // Trigger the date change callback
    renderActivitiesList();
    // Refresh the calendar display
    if (window.fitnessCalendarApi) {
      window.fitnessCalendarApi.refresh();
    }
  }

  function getFirstAvailableDate() {
    // Get the first tile's date from the calendar
    const firstTile = container.querySelector('.week-days .day-item');
    if (firstTile && firstTile.dataset.date) {
      return new Date(firstTile.dataset.date);
    }
    // Fallback to current date if no tiles exist
    return new Date();
  }

  // Bind navigation arrows
  container.querySelectorAll('.nav-arrow').forEach((arrow) => {
    arrow.addEventListener('click', () => {
      let cur = getStateDate();
      const originalDate = new Date(cur);
      const grp = appData.selectedGroup || 'daily';
      const isPrev = arrow.classList.contains('prev-week');
      const isNext = arrow.classList.contains('next-week');
      const isPrevDay = arrow.classList.contains('prev-day');
      const isNextDay = arrow.classList.contains('next-day');

      // Calculate new date based on navigation type
      if (isPrev || isNext) {
        const dir = isPrev ? -1 : +1;
        switch (grp) {
          case 'weekly':
            cur.setDate(cur.getDate() + dir * 28); // 4 weeks
            break;
          case 'monthly':
            cur.setMonth(cur.getMonth() + dir * 6); // 6 months
            break;
          case 'yearly':
            cur.setFullYear(cur.getFullYear() + dir * 5); // 5 years
            break;
          case 'daily':
          default:
            cur.setDate(cur.getDate() + dir * 7); // 1 week
            break;
        }
      } else if (isPrevDay || isNextDay) {
        const dirDay = isPrevDay ? -1 : +1;
        switch (grp) {
          case 'weekly':
            cur.setDate(cur.getDate() + dirDay * 7);
            break;
          case 'monthly':
            cur.setMonth(cur.getMonth() + dirDay);
            break;
          case 'yearly':
            cur.setFullYear(cur.getFullYear() + dirDay);
            break;
          case 'daily':
          default:
            cur.setDate(cur.getDate() + dirDay);
        }
      }

      // Apply bounds checking - prevent going before first available date
      const firstDate = getFirstAvailableDate();
      if (cur < firstDate) {
        // Special logic for prev-week when current is < 7 days from first tile
        if (isPrev && grp === 'daily') {
          const daysDiff = Math.floor((originalDate - firstDate) / (1000 * 60 * 60 * 24));
          if (daysDiff < 7) {
            // If less than 7 days from first tile, go to first tile
            cur = new Date(firstDate);
          } else {
            // Otherwise just prevent going before first tile
            cur = new Date(firstDate);
          }
        } else {
          // For any other case where we'd go before first date, stay at first date
          cur = new Date(firstDate);
        }
      }

      setStateDate(cur);
    });
  });

  // Bind today button
  const todayBtn = container.querySelector('.today-btn');
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const today = new Date();
      setStateDate(today);
    });
  }
}

/**
 * Builds the rest day row with Activities label and rest toggle
 */
function buildRestDayRow() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Add Rest Day toggle row below calendar
  const restRow = document.createElement('div');
  restRow.className = 'flex items-center justify-between px-4 py-2';
  restRow.innerHTML = `
    <div id="activities-label" class="bg-blue-50 dark:bg-gray-800 text-gray-900 dark:text-white px-6 py-1.5 rounded-full text-xl font-bold flex items-center justify-center gap-2">
      <span class="material-icons text-xl">fitness_center</span>
      Activities
    </div>
    <button id="rest-toggle" class="relative flex items-center justify-center h-9 bg-gray-200 text-gray-500 rounded-full overflow-hidden select-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ios-orange focus:ring-offset-2 dark:focus:ring-offset-gray-900" style="width: 36px;" aria-label="Toggle rest day for selected date" aria-pressed="false">
      <span class="bed material-icons absolute left-2 top-1/2 -translate-y-1/2 transition-transform text-2xl" aria-hidden="true">bed</span>
      <span class="label whitespace-nowrap ml-1 text-sm font-medium opacity-0 transition-opacity">Rest Day</span>
    </button>
  `;
  fitnessView.appendChild(restRow);
}

function buildCalendar() {
  const calendarWrapper = document.getElementById('fitness-calendar');
  if (!calendarWrapper) return;

  window.fitnessCalendarApi = mountCalendar({
    container: calendarWrapper,
    stateKey: 'fitnessSelectedDate',
    onDateChange: () => {
      renderActivitiesList();
    },
  });

  // Add navigation buttons AFTER mountCalendar creates .week-days element
  // The updated addCalendarNavigation will position them correctly below the calendar
  addCalendarNavigation();

  // Since navigation was added after mountCalendar, we need to manually bind the events
  // that mountCalendar would normally handle
  bindCalendarNavigation(calendarWrapper);
}

function buildActivitiesList() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Add activities list container
  const activitiesContainer = document.createElement('div');
  activitiesContainer.className = 'activities-container flex-grow overflow-y-auto px-4 pb-8';
  activitiesContainer.style.overflowX = 'visible';
  activitiesContainer.id = 'activities-list';
  fitnessView.appendChild(activitiesContainer);
}

/**
 * Ensures the activities container takes remaining viewport height and becomes the sole scrollable region
 * Mirrors adjustHabitsContainerHeight() from home.js for consistent scroll behavior
 * Header, calendar, and rest-day row stay fixed while only activities list scrolls
 */
function adjustActivitiesContainerHeight() {
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

function renderActivitiesList() {
  const activitiesContainer = document.getElementById('activities-list');
  if (!activitiesContainer) return;

  const selectedDate = appData.fitnessSelectedDate || new Date().toISOString();
  const iso = getLocalISODate(selectedDate);
  const isRestDayActive = isRestDay(iso);
  const activities = getActivitiesForDate(iso); // Use local ISO date instead of full ISO string

  if (activities.length === 0) {
    if (isRestDayActive) {
      // Show rest day message with bed icon
      activitiesContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center space-y-2">
          <span class="material-icons text-5xl text-orange-500">bed</span>
          <h2 class="text-lg font-bold text-gray-900 dark:text-white">Enjoy your rest day</h2>
        </div>
      `;
    } else {
      // Show normal no activities message
      activitiesContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center space-y-2">
          <span class="material-icons text-5xl text-gray-400">fitness_center</span>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">No activities recorded</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">Tap "Record Activity" to log your fitness activities for this day.</p>
        </div>
      `;
    }
    return;
  }

  // Group activities by category
  const groupedActivities = {};
  activities.forEach((record) => {
    const category = getActivityCategory(record.categoryId);
    if (!groupedActivities[category.id]) {
      groupedActivities[category.id] = {
        category,
        records: [],
      };
    }
    groupedActivities[category.id].records.push(record);
  });

  let html = '';
  Object.values(groupedActivities).forEach(({ category, records }) => {
    if (records.length === 0) return;

    // Special handling for Strength Training – show muscle group sub-headers
    if (category.id === 'strength') {
      const groupedByMG = groupActivitiesByMuscleGroup(records);
      html += `
        <div class="category-group mb-4">
          <div class="category-header flex items-center gap-2 px-4 py-2 rounded-t-xl" style="background:${category.color}20;">
            <div class="category-title flex items-center gap-2">
              <span class="text-lg" aria-hidden="true">${category.icon}</span>
              <span class="font-semibold text-gray-900 dark:text-white">${category.name}</span>
            </div>
          </div>
          ${Object.entries(groupedByMG)
            .map(
              ([mg, list]) => `
            <div class="muscle-group mb-2">
              <div class="muscle-header pl-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300">${formatMuscleName(mg)}</div>
              <div class="category-activities pl-6">
                ${list.map((act) => createActivityItem(act, category)).join('')}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    } else {
      html += `
        <div class="category-group mb-4" style="overflow: visible;">
          <div class="category-header flex items-center gap-2 px-4 py-2 rounded-t-xl" style="background:${category.color}20;">
            <div class="category-title flex items-center gap-2">
              <span class="text-lg" aria-hidden="true">${category.icon}</span>
              <span class="font-semibold text-gray-900 dark:text-white">${category.name}</span>
            </div>
          </div>
          <div class="category-activities pl-6" style="overflow: visible;">
            ${records
              .map((record) => {
                const item = createActivityItem(record, category);
                return `<div style="margin-bottom: 0.25rem; overflow: visible;">${item}</div>`;
              })
              .join('')}
          </div>
        </div>
      `;
    }
  });

  activitiesContainer.innerHTML = html;

  // Attach swipe behavior to each activity card using shared swipeableCard helper
  // This provides the same swipe-to-delete interaction as habit cards on the home page
  activitiesContainer.querySelectorAll('.swipe-container').forEach((swipeContainer) => {
    const slideEl = swipeContainer.querySelector('.swipe-slide');
    const recordId = swipeContainer.dataset.recordId;
    const record = activities.find((a) => a.id === recordId);

    if (slideEl && record) {
      // Use shared makeCardSwipable helper for consistent behavior across views
      makeCardSwipable(swipeContainer, slideEl, record, {
        onRestore: () => {
          // Delete the activity record and refresh the list
          deleteRecordedActivity(recordId, iso); // Use local ISO date instead of full ISO string
          renderActivitiesList();
        },
      });

      // Add click functionality to open activity details modal with existing data
      const activityCard = slideEl.querySelector('.activity-card');
      if (activityCard && record.activityId) {
        activityCard.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openActivityDetailsModalWithRecord(record.activityId, record);
        });
        activityCard.style.cursor = 'pointer';
      }
    }
  });

  // Recalculate scrollable area height after any UI change
  adjustActivitiesContainerHeight();
}

/**
 * Creates an activity item with swipe-to-delete functionality matching habit cards
 * Uses the same DOM hierarchy as home page habit tiles for visual consistency
 * @param {Object} record - The activity record to display
 * @param {Object} category - The category object containing color and icon
 * @returns {string} HTML string for the activity item
 */
function createActivityItem(record, category) {
  const time = new Date(record.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Generate activity pills based on tracking type
  const pillsMarkup = generateActivityPills(record, category);

  // DOM structure mirrors habit cards for consistency:
  // swipe-container → restore-btn (hidden delete action) + swipe-slide → activity-card
  return `
    <div class="swipe-container relative overflow-visible" data-record-id="${record.id}">
      <button class="restore-btn absolute top-0 right-0 h-full bg-red-600 text-white font-semibold rounded-xl w-1/5 touch-manipulation" aria-label="Delete ${record.activityName} activity">Delete</button>
      <div class="swipe-slide transition-transform bg-white dark:bg-gray-800 rounded-xl w-full relative z-1 touch-pan-y">
        <div class="activity-card relative flex items-start px-3 py-2 rounded-xl w-full mb-0" style="border: 3px solid ${category.color}; background-color: ${hexToRgba(category.color, 0.05)};">
          <div class="activity-icon w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center mr-3 text-xl" style="border: 2px solid ${category.color}; color: ${category.color};" aria-hidden="true">
            ${category.icon}
          </div>
          <div class="activity-content flex-grow text-left">
            <div class="activity-name font-semibold leading-tight text-gray-900 dark:text-white mb-1">${record.activityName}</div>
            ${record.notes ? `<div class="activity-notes text-xs text-gray-500 dark:text-gray-400 my-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit max-w-full">${record.notes}</div>` : ''}
            ${pillsMarkup}
          </div>
          <!-- Time placed absolutely so it doesn't restrict content width -->
          <div class="activity-meta absolute top-2 right-3 text-xs text-gray-500 dark:text-gray-400" aria-label="Activity recorded at ${time}">${time}</div>
        </div>
      </div>
    </div>
  `;
}

function generateActivityPills(record, category) {
  if (record.sets && record.sets.length > 0) {
    const n = record.sets.length;
    const col1Count = Math.ceil(n / 2);

    // Build ordered index list: col1 row-wise first, then matching col2 item if exists
    const orderedIndices = [];
    for (let i = 0; i < col1Count; i++) {
      // Left column
      orderedIndices.push(i);
      // Right column (if any)
      const rightIdx = col1Count + i;
      if (rightIdx < n) orderedIndices.push(rightIdx);
    }

    const pillsMarkup = orderedIndices
      .map((idx) => {
        const set = record.sets[idx];
        let setDisplay = `Set ${idx + 1}: ${set.reps} reps`;
        if (set.value && set.unit && set.unit !== 'none') {
          let unitDisplay = '';
          if (set.unit === 'seconds') {
            unitDisplay = 's';
          } else if (set.unit === 'minutes') {
            unitDisplay = ' Mins';
          } else if (set.unit === 'kg') {
            unitDisplay = 'kg';
          } else {
            unitDisplay = set.unit;
          }
          setDisplay += ` × ${set.value}${unitDisplay}`;
        } else if (set.value) {
          setDisplay += ` × ${set.value}`;
        }
        return `<span class="inline-block text-white text-xs px-2 py-1 rounded-lg mr-1 mb-1 font-medium" style="background-color: ${category.color};">${setDisplay}</span>`;
      })
      .join('');

    // Wrap pills in a 2-column grid so they utilise horizontal space predictably
    return `<div class="set-pills grid grid-cols-2 gap-1">${pillsMarkup}</div>`;
  } else {
    // Time-based tracking - show duration and intensity pills
    let pills = [];

    if (record.duration) {
      const durationUnit = record.durationUnit || 'minutes';
      let unitShort = '';
      if (durationUnit === 'minutes') {
        unitShort = record.duration > 1 ? 'Mins' : 'Min';
      } else if (durationUnit === 'hours') {
        unitShort = record.duration > 1 ? 'Hrs' : 'Hr';
      } else {
        unitShort = 's';
      }
      pills.push(
        `<span class="inline-block text-white text-xs px-2 py-1 rounded-lg mr-1 mb-1 font-medium" style="background-color: ${category.color};">${record.duration} ${unitShort}</span>`
      );
    }

    if (record.intensity) {
      const capitalizedIntensity =
        record.intensity.charAt(0).toUpperCase() + record.intensity.slice(1);
      pills.push(
        `<span class="inline-block text-white text-xs px-2 py-1 rounded-lg mr-1 mb-1 font-medium" style="background-color: ${category.color};">${capitalizedIntensity}</span>`
      );
    }

    return pills.join('');
  }
}

function bindRestToggle() {
  const restBtn = document.getElementById('rest-toggle');
  if (!restBtn) return;
  updateRestToggle();
  restBtn.addEventListener('click', () => {
    const selectedDate = appData.fitnessSelectedDate || new Date().toISOString();
    const iso = getLocalISODate(selectedDate);
    toggleRestDay(iso);
    updateRestToggle();
    updateTimerButton();
    renderActivitiesList();
    // Re-render calendar to show rest day
    if (window.fitnessCalendarApi && typeof window.fitnessCalendarApi.refresh === 'function') {
      window.fitnessCalendarApi.refresh();
    }
  });
}

function bindActionButtons() {
  // New Activity button
  const newActivityBtn = document.getElementById('new-activity-btn');
  if (newActivityBtn) {
    newActivityBtn.addEventListener('click', () => {
      openAddActivityModal();
    });
  }

  // Start Timer button - now opens timer modal
  const startTimerBtn = document.getElementById('start-timer-btn');
  if (startTimerBtn) {
    startTimerBtn.addEventListener('click', () => {
      openTimerModal();
    });
  }

  // Initialize timer and set up update callback
  initializeTimer();
  setTimerUpdateCallback(() => {
    updateTimerButton();
  });

  // Update button states initially
  updateTimerButton();

  // Initialize timer modal event handlers
  bindTimerModalEvents();
}

function updateTimerButton() {
  const timerBtn = document.getElementById('start-timer-btn');

  if (!timerBtn) return;

  const timerState = getTimerState();

  // Update visual state based on timer status, but keep text and icon static
  if (timerState.isRunning) {
    // Change to orange/red visual state when timer is running
    timerBtn.classList.remove(
      'bg-blue-100',
      'dark:bg-blue-900',
      'text-blue-600',
      'dark:text-blue-300'
    );
    timerBtn.classList.add(
      'bg-orange-100',
      'dark:bg-orange-900',
      'text-orange-600',
      'dark:text-orange-300'
    );
  } else {
    // Restore original blue styling when timer is stopped
    timerBtn.classList.remove(
      'bg-orange-100',
      'dark:bg-orange-900',
      'text-orange-600',
      'dark:text-orange-300'
    );
    timerBtn.classList.add(
      'bg-blue-100',
      'dark:bg-blue-900',
      'text-blue-600',
      'dark:text-blue-300'
    );
  }
}

/**
 * Opens the comprehensive timer modal
 */
function openTimerModal() {
  // Clear any existing lap times when opening modal (fresh session)
  if (getTimerState().elapsedSeconds === 0) {
    sessionLapTimes = [];
  }

  // Update display before showing
  updateTimerDisplay();

  // Show modal using existing modal system
  openModal('timer-modal');

  // Set up update interval for display (every second)
  startTimerModalUpdateInterval();
}

/**
 * Closes the timer modal
 */
function closeTimerModal() {
  // Stop update interval
  stopTimerModalUpdateInterval();

  // Remove escape key listener if it exists
  const modal = document.getElementById('timer-modal');
  if (modal && modal._escapeHandler) {
    document.removeEventListener('keydown', modal._escapeHandler);
    modal._escapeHandler = null;
  }

  // Close modal
  closeModal('timer-modal');
}

// Timer modal update interval
let timerModalUpdateInterval = null;

// Lap times storage for current session
let sessionLapTimes = [];

function startTimerModalUpdateInterval() {
  // Clear any existing interval
  stopTimerModalUpdateInterval();

  // Update immediately
  updateTimerDisplay();

  // Set up interval to update every second
  timerModalUpdateInterval = setInterval(() => {
    updateTimerDisplay();
  }, 1000);
}

function stopTimerModalUpdateInterval() {
  if (timerModalUpdateInterval) {
    clearInterval(timerModalUpdateInterval);
    timerModalUpdateInterval = null;
  }
}

/**
 * Updates timer display and statistics in the modal
 */
function updateTimerDisplay() {
  const timerState = getTimerState();
  const timeDisplay = document.getElementById('timer-time-display');
  const statusDisplay = document.getElementById('timer-status');
  const startStopBtn = document.getElementById('timer-start-stop-btn');

  // Update time display - show current lap time
  if (timeDisplay) {
    const currentLapTime = getCurrentLapTime();
    timeDisplay.textContent = formatElapsedTime(currentLapTime);
  }

  // Update status
  if (statusDisplay) {
    if (timerState.isRunning) {
      statusDisplay.textContent = 'Running...';
    } else if (timerState.elapsedSeconds > 0) {
      statusDisplay.textContent = 'Paused';
    } else {
      statusDisplay.textContent = 'Ready to start';
    }
  }

  // Update start/stop button
  if (startStopBtn) {
    const icon = startStopBtn.querySelector('.material-icons');
    if (timerState.isRunning) {
      icon.textContent = 'pause';
      startStopBtn.classList.remove('bg-ios-blue');
      startStopBtn.classList.add('bg-red-500');
    } else {
      icon.textContent = 'play_arrow';
      startStopBtn.classList.remove('bg-red-500');
      startStopBtn.classList.add('bg-ios-blue');
    }
  }

  // Update lap button
  const recordLapBtn = document.getElementById('record-lap-btn');

  if (recordLapBtn) {
    recordLapBtn.disabled = timerState.elapsedSeconds === 0;
  }

  // Update lap times list
  renderLapTimesList();
}

/**
 * Renders the lap times list
 */
function renderLapTimesList() {
  const container = document.getElementById('lap-times-container');
  const lapList = document.getElementById('lap-times-list');
  const totalTimeEl = document.getElementById('total-session-time');

  if (!container || !lapList) return;

  // Update total time
  if (totalTimeEl) {
    const totalTime = getTotalSessionTime();
    totalTimeEl.textContent = formatElapsedTime(totalTime);
  }

  // Show/hide container based on whether we have laps
  if (sessionLapTimes.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  // Clear existing list
  lapList.innerHTML = '';

  // Organize lap times in 2-column grid like activity set pills
  const n = sessionLapTimes.length;
  const col1Count = Math.ceil(n / 2);

  // Build ordered index list: col1 row-wise first, then matching col2 item if exists
  const orderedIndices = [];
  for (let i = 0; i < col1Count; i++) {
    // Left column
    orderedIndices.push(i);
    // Right column (if any)
    const rightIdx = col1Count + i;
    if (rightIdx < n) orderedIndices.push(rightIdx);
  }

  // Create container with 2-column grid
  const gridContainer = document.createElement('div');
  gridContainer.className = 'lap-times-grid grid grid-cols-2 gap-2';

  // Add each lap time in the calculated order
  orderedIndices.forEach((lapIndex) => {
    const lap = sessionLapTimes[lapIndex];
    const lapItem = document.createElement('div');
    lapItem.className =
      'flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500';

    lapItem.innerHTML = `
      <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Lap ${lap.number}</span>
      <div class="flex items-center gap-2">
        <span class="text-sm font-mono text-gray-900 dark:text-white">${formatElapsedTime(lap.duration)}</span>
        <button class="delete-lap-btn text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded transition-colors" data-lap-index="${lapIndex}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
          </div>
        `;

    gridContainer.appendChild(lapItem);
  });

  lapList.appendChild(gridContainer);

  // Add scroll indicators if content overflows
  setTimeout(() => {
    const isOverflowing = lapList.scrollHeight > lapList.clientHeight;
    if (isOverflowing) {
      // Add subtle fade at bottom to indicate more content
      if (!lapList.querySelector('.scroll-fade')) {
        const fadeIndicator = document.createElement('div');
        fadeIndicator.className =
          'scroll-fade absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-50 dark:from-gray-700 to-transparent pointer-events-none';
        lapList.appendChild(fadeIndicator);
      }
    } else {
      // Remove fade if no overflow
      const existingFade = lapList.querySelector('.scroll-fade');
      if (existingFade) {
        existingFade.remove();
      }
    }
  }, 0);

  // Bind delete button events
  const deleteButtons = lapList.querySelectorAll('.delete-lap-btn');
  deleteButtons.forEach((button) => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const lapIndex = parseInt(button.dataset.lapIndex);
      deleteLap(lapIndex);
    });
  });
}

/**
 * Records a lap time
 */
function recordLap() {
  const timerState = getTimerState();

  if (!timerState.isRunning && timerState.elapsedSeconds === 0) {
    return; // Can't record lap if timer isn't running or hasn't started
  }

  const currentTime = timerState.elapsedSeconds;
  const lastLapTotal = sessionLapTimes.reduce((sum, lap) => sum + lap.duration, 0);
  const currentLapTime = currentTime - lastLapTotal;

  // Record the lap
  const lapData = {
    number: sessionLapTimes.length + 1,
    duration: currentLapTime,
    totalTime: currentTime,
    timestamp: new Date().toISOString(),
  };

  sessionLapTimes.push(lapData);

  // Update display
  renderLapTimesList();
}

/**
 * Deletes a specific lap time by index
 */
function deleteLap(lapIndex) {
  if (lapIndex < 0 || lapIndex >= sessionLapTimes.length) {
    return; // Invalid index
  }

  // Remove the lap
  sessionLapTimes.splice(lapIndex, 1);

  // Renumber remaining laps
  sessionLapTimes.forEach((lap, index) => {
    lap.number = index + 1;
  });

  // Update display
  renderLapTimesList();
}

/**
 * Gets current lap time in seconds
 */
function getCurrentLapTime() {
  const timerState = getTimerState();
  const totalLapTime = sessionLapTimes.reduce((sum, lap) => sum + lap.duration, 0);
  return timerState.elapsedSeconds - totalLapTime;
}

/**
 * Gets total session time including all laps
 */
function getTotalSessionTime() {
  const timerState = getTimerState();
  return timerState.elapsedSeconds;
}

/**
 * Binds all event handlers for the timer modal
 */
function bindTimerModalEvents() {
  // Close button
  const closeBtn = document.getElementById('close-timer-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeTimerModal);
  }

  // Start/Stop button in modal
  const startStopBtn = document.getElementById('timer-start-stop-btn');
  if (startStopBtn) {
    startStopBtn.addEventListener('click', () => {
      const timerState = getTimerState();

      if (timerState.isRunning) {
        // Stop/pause the timer
        stopTimer(() => {
          updateTimerDisplay();
          updateTimerButton(); // Update main button too
        });
      } else {
        // Start/resume the timer
        startTimer(() => {
          updateTimerDisplay();
          updateTimerButton(); // Update main button too
        });
      }
    });
  }

  // Reset button
  const resetBtn = document.getElementById('timer-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetTimer(() => {
        // Also clear lap times when resetting
        sessionLapTimes = [];

        updateTimerDisplay();
        updateTimerButton(); // Update main button too
        renderLapTimesList(); // Update lap list display
      });
    });
  }

  // Record lap button
  const recordLapBtn = document.getElementById('record-lap-btn');
  if (recordLapBtn) {
    recordLapBtn.addEventListener('click', recordLap);
  }

  // Modal backdrop click to close
  const modal = document.getElementById('timer-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      // Only close if clicking the overlay, not the modal content
      if (e.target === modal) {
        closeTimerModal();
      }
    });
  }

  // Escape key to close modal
  const handleEscapeKey = (e) => {
    if (e.key === 'Escape') {
      const timerModal = document.getElementById('timer-modal');
      if (timerModal && !timerModal.classList.contains('hidden')) {
        closeTimerModal();
      }
    }
  };

  // Add escape key listener (will be removed when modal closes)
  document.addEventListener('keydown', handleEscapeKey);

  // Store reference to remove listener later
  modal._escapeHandler = handleEscapeKey;
}

function updateRestToggle() {
  const restBtn = document.getElementById('rest-toggle');
  if (!restBtn) return;
  const selectedDate = appData.fitnessSelectedDate || new Date().toISOString();
  const iso = getLocalISODate(selectedDate);
  const isOn = isRestDay(iso);

  restBtn.classList.toggle('bg-ios-orange', isOn);
  restBtn.classList.toggle('bg-gray-200', !isOn);
  restBtn.classList.toggle('text-white', isOn);
  restBtn.classList.toggle('text-gray-500', !isOn);
  restBtn.setAttribute('aria-pressed', isOn.toString());
  const bedEl = restBtn.querySelector('.bed');
  const labelEl = restBtn.querySelector('.label');
  if (bedEl) {
    if (isOn) {
      bedEl.style.left = '8px';
      bedEl.style.transform = 'translateY(-50%)';
    } else {
      bedEl.style.left = '50%';
      bedEl.style.transform = 'translate(-50%, -50%)';
    }
  }
  if (labelEl) {
    if (isOn) {
      labelEl.classList.add('opacity-100');
      restBtn.classList.add('pl-9', 'pr-4');
      restBtn.classList.remove('justify-center');
      restBtn.style.width = '110px';
    } else {
      labelEl.classList.remove('opacity-100');
      restBtn.classList.remove('pl-9', 'pr-4');
      restBtn.classList.add('justify-center');
      restBtn.style.width = '36px';
    }
  }
}

function formatMuscleName(raw) {
  if (!raw) return 'Other';
  // Capitalize first letter of each word
  return raw.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/_/g, ' ');
}

let validateAddActivityForm = null;
let selectedActivityIcon = '🏃‍♂️';

function getSelectedActivityIcon() {
  return selectedActivityIcon;
}

function setSelectedActivityIcon(icon) {
  selectedActivityIcon = icon;
}

function getSelectedTrackingType() {
  const setsRepsToggle = document.getElementById('sets-reps-toggle');
  const timeToggle = document.getElementById('time-toggle');

  if (!setsRepsToggle || !timeToggle) return 'time';

  // Check which toggle is active by looking for the active classes
  if (
    setsRepsToggle.classList.contains('bg-white') ||
    setsRepsToggle.classList.contains('dark:bg-gray-700')
  ) {
    return 'sets-reps';
  } else {
    return 'time';
  }
}

function buildActivityIconGrid(modal) {
  const grid = modal.querySelector('#icon-grid');
  if (!grid) return;

  // Clear existing grid
  grid.innerHTML = '';

  const ICONS = [
    '💪',
    '🏃',
    '🚴',
    '🏊',
    '🧘',
    '⚖️', // Health & Fitness
    '🍎',
    '🥗',
    '💧',
    '☕',
    '🥛',
    '🍊', // Food & Drink
    '📚',
    '📖',
    '✏️',
    '🎓',
    '💡',
    '🧠', // Education & Reading
    '💼',
    '💻',
    '📱',
    '📊',
    '📝',
    '📋', // Work & Productivity
    '😴',
    '🛏️',
    '🌙',
    '⏰',
    '🕐',
    '⏱️', // Sleep & Rest
    '🎵',
    '🎸',
    '🎨',
    '📷',
    '🎮',
    '🎯', // Hobbies & Entertainment
    '🌱',
    '🌳',
    '🌸',
    '🌞',
    '🌍',
    '♻️', // Nature & Environment
    '👥',
    '👪',
    '❤️',
    '🤝',
    '📞',
    '💬', // Social & Family
    '🧼',
    '🪥',
    '🚿',
    '💊',
    '🧴',
    '🎯', // Personal Care
    '✈️',
    '🚗',
    '🚶',
    '🗺️',
    '🎒',
    '📍', // Travel
    '💰',
    '💳',
    '💎',
    '📈',
    '🏦',
    '💸', // Money
    '⭐',
    '🎉',
    '🔥',
    '⚡',
    '✨',
    '🚀', // General Symbols
  ];

  const fragment = document.createDocumentFragment();
  ICONS.forEach((icon) => {
    const btn = document.createElement('button');
    btn.className =
      'icon-option w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl hover:bg-ios-blue hover:text-white transition-all duration-200 hover:scale-105';
    btn.dataset.icon = icon;
    btn.textContent = icon;
    fragment.appendChild(btn);
  });
  grid.appendChild(fragment);
}

function updateActivityIconFromCategory() {
  const categorySelect = document.getElementById('activity-category-select');
  const display = document.getElementById('activity-selected-icon-display');
  const muscleGroupSection = document.getElementById('muscle-group-section');
  const muscleGroupSelect = document.getElementById('muscle-group-select');

  if (!categorySelect || !display) return;

  const selectedCategoryId = categorySelect.value;
  if (selectedCategoryId) {
    const category = appData.activityCategories.find((cat) => cat.id === selectedCategoryId);
    if (category) {
      setSelectedActivityIcon(category.icon);
      display.textContent = getSelectedActivityIcon();
    }

    // Show muscle group section if strength training is selected
    if (selectedCategoryId === 'strength') {
      muscleGroupSection?.classList.remove('hidden');
    } else {
      muscleGroupSection?.classList.add('hidden');
      if (muscleGroupSelect) muscleGroupSelect.value = '';
    }

    // Handle tracking type for sports category
    updateTrackingTypeForCategory(selectedCategoryId);
  } else {
    // If no category selected, default to running icon
    setSelectedActivityIcon('🏃‍♂️');
    display.textContent = getSelectedActivityIcon();
    // Hide muscle group section
    muscleGroupSection?.classList.add('hidden');
    if (muscleGroupSelect) muscleGroupSelect.value = '';
    // Reset tracking type
    updateTrackingTypeForCategory(null);
  }

  // Revalidate form after category change
  if (typeof validateAddActivityForm === 'function') validateAddActivityForm();
}

function updateTrackingTypeForCategory(categoryId) {
  const setsRepsToggle = document.getElementById('sets-reps-toggle');
  const timeToggle = document.getElementById('time-toggle');
  const unitsSection = document.getElementById('units-section');
  const unitsSelect = document.getElementById('units-select');

  if (!setsRepsToggle || !timeToggle || !unitsSection) return;

  if (categoryId === 'sports') {
    // For sports, permanently set to Time
    activateTrackingToggle('time');
    // Disable the sets/reps toggle for sports
    setsRepsToggle.disabled = true;
    setsRepsToggle.classList.add('opacity-50', 'cursor-not-allowed');
    setsRepsToggle.classList.remove('hover:text-gray-900', 'dark:hover:text-white');
  } else {
    // For other categories, enable both toggles
    setsRepsToggle.disabled = false;
    setsRepsToggle.classList.remove('opacity-50', 'cursor-not-allowed');
    setsRepsToggle.classList.add('hover:text-gray-900', 'dark:hover:text-white');
    // Default to Time for all other categories
    activateTrackingToggle('time');
  }

  // Reset units selection when category changes
  if (unitsSelect) unitsSelect.value = 'none';
}

function activateTrackingToggle(type) {
  const setsRepsToggle = document.getElementById('sets-reps-toggle');
  const timeToggle = document.getElementById('time-toggle');
  const unitsSection = document.getElementById('units-section');

  if (!setsRepsToggle || !timeToggle || !unitsSection) return;

  const activeClasses = [
    'bg-white',
    'dark:bg-gray-700',
    'text-gray-900',
    'dark:text-white',
    'border',
    'border-gray-200',
    'dark:border-gray-600',
    'shadow-sm',
  ];
  const inactiveClasses = ['text-gray-600', 'dark:text-gray-400'];

  if (type === 'sets-reps') {
    // Activate Sets/Reps
    setsRepsToggle.classList.add(...activeClasses);
    setsRepsToggle.classList.remove(...inactiveClasses);
    timeToggle.classList.remove(...activeClasses);
    timeToggle.classList.add(...inactiveClasses);
    // Show units section
    unitsSection.classList.remove('hidden');
  } else {
    // Activate Time
    timeToggle.classList.add(...activeClasses);
    timeToggle.classList.remove(...inactiveClasses);
    setsRepsToggle.classList.remove(...activeClasses);
    setsRepsToggle.classList.add(...inactiveClasses);
    // Hide units section
    unitsSection.classList.add('hidden');
  }
}

function initializeTrackingTypeToggles() {
  const setsRepsToggle = document.getElementById('sets-reps-toggle');
  const timeToggle = document.getElementById('time-toggle');

  if (!setsRepsToggle || !timeToggle) return;

  // Add click handlers
  setsRepsToggle.addEventListener('click', () => {
    if (!setsRepsToggle.disabled) {
      activateTrackingToggle('sets-reps');
    }
  });

  timeToggle.addEventListener('click', () => {
    activateTrackingToggle('time');
  });

  // Initialize to Time by default
  activateTrackingToggle('time');
}

function openAddActivityModal() {
  // Reset form
  const form = document.getElementById('add-activity-form');
  if (form) form.reset();

  // Hide delete button for add mode
  const delBtn = document.getElementById('delete-activity-btn');
  if (delBtn) delBtn.classList.add('hidden');

  // Reset modal title and save button text
  const modalTitle = document.querySelector('#add-activity-modal h2');
  if (modalTitle) modalTitle.textContent = 'New Activity';

  const saveBtn = document.getElementById('save-add-activity');
  if (saveBtn) saveBtn.textContent = 'Add';

  // Clear edit mode data
  const modal = document.getElementById('add-activity-modal');
  if (modal) {
    delete modal.dataset.editActivityId;
    delete modal.dataset.editMode;
  }

  // Reset icon selection to default running icon
  setSelectedActivityIcon('🏃‍♂️');
  let iconDisplay = document.getElementById('activity-selected-icon-display');
  if (iconDisplay) iconDisplay.textContent = getSelectedActivityIcon();

  // Reset muscle group section
  const muscleGroupSection = document.getElementById('muscle-group-section');
  const muscleGroupSelect = document.getElementById('muscle-group-select');
  if (muscleGroupSection) muscleGroupSection.classList.add('hidden');
  if (muscleGroupSelect) muscleGroupSelect.value = '';

  // Reset tracking type and units sections
  const unitsSection = document.getElementById('units-section');
  const unitsSelect = document.getElementById('units-select');
  if (unitsSection) unitsSection.classList.add('hidden');
  if (unitsSelect) unitsSelect.value = 'none';

  // Populate category dropdown
  const categorySelect = document.getElementById('activity-category-select');
  if (categorySelect) {
    categorySelect.innerHTML =
      '<option value="" disabled selected>Select a category</option>' +
      appData.activityCategories
        .map((cat) => `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`)
        .join('');
  }

  // Show modal
  openModal('add-activity-modal');

  // Setup components after modal is shown (ensure DOM elements exist)
  setTimeout(() => {
    setupActivityIconPicker();
    initializeTrackingTypeToggles();
  }, 50);

  // Validate form to set Add button state
  if (typeof validateAddActivityForm === 'function') validateAddActivityForm();
}

function setupAddActivityModal() {
  // Cancel button
  const cancelAddBtn = document.getElementById('cancel-add-activity');
  if (cancelAddBtn) {
    cancelAddBtn.addEventListener('click', () => {
      closeModal('add-activity-modal');
    });
  }
}

function setupActivityIconPicker() {
  const iconSelectorBtn = document.getElementById('activity-icon-selector-btn');
  const iconModal = document.getElementById('icon-selection-modal');
  let iconDisplay = document.getElementById('activity-selected-icon-display');

  if (!iconSelectorBtn || !iconModal || !iconDisplay) {
    return;
  }

  // Remove any existing listeners to avoid duplicates
  const newIconSelectorBtn = iconSelectorBtn.cloneNode(true);
  iconSelectorBtn.parentNode.replaceChild(newIconSelectorBtn, iconSelectorBtn);

  // Re-query the icon display inside the newly cloned button to ensure we reference the live element
  const updatedIconDisplay =
    newIconSelectorBtn.querySelector('#activity-selected-icon-display') ||
    document.getElementById('activity-selected-icon-display');

  // Replace the old reference
  iconDisplay = updatedIconDisplay;

  newIconSelectorBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Build the icon grid before opening the modal (ensures content is ready)
    buildActivityIconGrid(iconModal);

    // Use the shared modal helper so all animation/display logic is consistent
    openModal('icon-selection-modal');
  });

  // Close when clicking outside content
  iconModal.addEventListener('click', (e) => {
    if (e.target === iconModal) {
      closeModal('icon-selection-modal');
    }
  });

  const selectIconBtn = document.getElementById('select-icon');
  const cancelIconBtn = document.getElementById('cancel-icon');

  function clearIconHighlights() {
    iconModal
      .querySelectorAll('.icon-option')
      .forEach((btn) => btn.classList.remove('ring', 'ring-ios-blue', 'ring-2'));
  }

  iconModal.addEventListener('click', (e) => {
    const opt = e.target.closest('.icon-option');
    if (!opt) return;
    const chosen = opt.dataset.icon || '🏃‍♂️';
    setSelectedActivityIcon(chosen);
    iconDisplay.textContent = chosen; // Update immediately for instant feedback
    clearIconHighlights();
    opt.classList.add('ring', 'ring-ios-blue', 'ring-2');
    if (selectIconBtn) selectIconBtn.disabled = false;
  });

  if (selectIconBtn) {
    selectIconBtn.addEventListener('click', () => {
      iconDisplay.textContent = getSelectedActivityIcon();
      closeModal('icon-selection-modal');
    });
  }

  if (cancelIconBtn) {
    cancelIconBtn.addEventListener('click', () => {
      closeModal('icon-selection-modal');
    });
  }

  // Form validation and enable Add button
  const form = document.getElementById('add-activity-form');
  const nameInput = document.getElementById('activity-name-input');
  const categorySelect = document.getElementById('activity-category-select');
  const addBtn = document.getElementById('save-add-activity');

  validateAddActivityForm = function validateForm() {
    const nameValid = nameInput && nameInput.value.trim().length > 0;
    const categoryValid = categorySelect && categorySelect.value;

    // Check if muscle group is required and valid
    const isStrengthTraining = categorySelect && categorySelect.value === 'strength';
    const muscleGroupSelect = document.getElementById('muscle-group-select');
    const muscleGroupValid = !isStrengthTraining || (muscleGroupSelect && muscleGroupSelect.value);

    const allValid = nameValid && categoryValid && muscleGroupValid;
    if (addBtn) {
      addBtn.disabled = !allValid;
      addBtn.classList.toggle('opacity-50', addBtn.disabled);
    }
  };

  if (nameInput) nameInput.addEventListener('input', validateAddActivityForm);
  if (categorySelect) {
    categorySelect.addEventListener('change', validateAddActivityForm);
    categorySelect.addEventListener('change', updateActivityIconFromCategory);
  }

  // Add muscle group validation
  const muscleGroupSelect = document.getElementById('muscle-group-select');
  if (muscleGroupSelect) {
    muscleGroupSelect.addEventListener('change', validateAddActivityForm);
  }

  // Add activity on submit
  if (form && !form.dataset.listenerAttached) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!nameInput || !categorySelect) return;
      const name = nameInput.value.trim();
      const categoryId = categorySelect.value;
      const icon = getSelectedActivityIcon();

      // Get muscle group if strength training
      const muscleGroup =
        categoryId === 'strength' && muscleGroupSelect ? muscleGroupSelect.value : null;

      // Get tracking type and units
      const trackingType = getSelectedTrackingType();
      const units =
        trackingType === 'sets-reps'
          ? document.getElementById('units-select')?.value || 'none'
          : null;

      if (!name || !categoryId) return;
      // Validate muscle group for strength training
      if (categoryId === 'strength' && !muscleGroup) return;

      // Add activity with tracking type and units
      addActivity({
        name,
        categoryId,
        icon,
        muscleGroup,
        trackingType,
        units,
      });
      closeModal('add-activity-modal');
    });
    form.dataset.listenerAttached = 'true';
  }

  // Add button click
  if (addBtn && !addBtn.dataset.listenerAttached) {
    addBtn.addEventListener('click', (e) => {
      if (form) form.requestSubmit();
    });
    addBtn.dataset.listenerAttached = 'true';
  }
}

function openActivityDetailsModal(activityId) {
  const activity = getActivity(activityId);
  if (!activity) return;

  const category = getActivityCategory(activity.categoryId);

  // Populate activity info
  const iconEl = document.getElementById('activity-details-icon');
  const nameEl = document.getElementById('activity-details-name');
  const categoryEl = document.getElementById('activity-details-category');

  if (iconEl) {
    iconEl.textContent = activity.icon || category.icon;
    iconEl.style.backgroundColor = `${category.color}20`;
  }
  if (nameEl) nameEl.textContent = activity.name;
  if (categoryEl) categoryEl.textContent = category.name;

  // Reset form
  const form = document.getElementById('activity-details-form');
  if (form) form.reset();

  // Show appropriate tracking section based on activity's tracking type
  setupActivityDetailsTracking(activity);

  // Store activity ID for recording
  const modal = document.getElementById('activity-details-modal');
  if (modal) modal.dataset.activityId = activityId;

  // Open details modal
  openModal('activity-details-modal');
}

function openActivityDetailsModalWithRecord(activityId, record) {
  const activity = getActivity(activityId);
  if (!activity) return;

  const category = getActivityCategory(activity.categoryId);

  // Populate activity info
  const iconEl = document.getElementById('activity-details-icon');
  const nameEl = document.getElementById('activity-details-name');
  const categoryEl = document.getElementById('activity-details-category');

  if (iconEl) {
    iconEl.textContent = activity.icon || category.icon;
    iconEl.style.backgroundColor = `${category.color}20`;
  }
  if (nameEl) nameEl.textContent = activity.name;
  if (categoryEl) categoryEl.textContent = category.name;

  // Reset form
  const form = document.getElementById('activity-details-form');
  if (form) form.reset();

  // Show appropriate tracking section based on activity's tracking type
  setupActivityDetailsTracking(activity);

  // Store activity ID and record ID for editing
  const modal = document.getElementById('activity-details-modal');
  if (modal) {
    modal.dataset.activityId = activityId;
    modal.dataset.recordId = record.id;
    modal.dataset.editMode = 'true';
  }

  // Pre-fill with existing record data
  if (record.sets && record.sets.length > 0) {
    // Sets/Reps data
    record.sets.forEach((setData, index) => {
      if (index === 0) {
        // Update the first set that's automatically created
        const firstSet = document.querySelector('[data-set-id="set-1"]');
        if (firstSet) {
          const repsInput = firstSet.querySelector('input[name="reps-set-1"]');
          const valueInput = firstSet.querySelector('input[name="value-set-1"]');
          const unitSelect = firstSet.querySelector('select[name="unit-set-1"]');

          if (repsInput) repsInput.value = setData.reps || '';
          if (valueInput) valueInput.value = setData.value || '';
          if (unitSelect) unitSelect.value = setData.unit || 'none';
        }
      } else {
        // Add additional sets
        addNewSet(setData.unit || 'none');
        const newSetId = `set-${index + 1}`;
        const newSet = document.querySelector(`[data-set-id="${newSetId}"]`);
        if (newSet) {
          const repsInput = newSet.querySelector(`input[name="reps-${newSetId}"]`);
          const valueInput = newSet.querySelector(`input[name="value-${newSetId}"]`);
          const unitSelect = newSet.querySelector(`select[name="unit-${newSetId}"]`);

          if (repsInput) repsInput.value = setData.reps || '';
          if (valueInput) valueInput.value = setData.value || '';
          if (unitSelect) unitSelect.value = setData.unit || 'none';
        }
      }
    });
  } else {
    // Time-based data
    const durationInput = document.getElementById('activity-duration-input');
    const durationUnitSelect = document.getElementById('duration-unit-select');
    const intensitySelect = document.getElementById('activity-intensity-select');

    if (durationInput) durationInput.value = record.duration || '';
    if (durationUnitSelect) durationUnitSelect.value = record.durationUnit || 'minutes';
    if (intensitySelect) intensitySelect.value = record.intensity || '';
  }

  // Pre-fill notes
  const notesInput = document.getElementById('activity-notes-input');
  if (notesInput) notesInput.value = record.notes || '';

  // Change modal header to indicate editing
  const modalTitle = document.querySelector('#activity-details-modal .modal-header span');
  if (modalTitle) modalTitle.textContent = 'Edit Activity';

  const saveBtn = document.getElementById('save-activity-details');
  if (saveBtn) saveBtn.textContent = 'Update';

  openModal('activity-details-modal');
}

function setupActivityDetailsTracking(activity) {
  const timeSection = document.getElementById('time-tracking-section');
  const setsSection = document.getElementById('sets-reps-tracking-section');

  if (!timeSection || !setsSection) return;

  if (activity.trackingType === 'sets-reps') {
    // Show sets/reps section
    timeSection.classList.add('hidden');
    setsSection.classList.remove('hidden');

    // Clear existing sets and add one set
    clearSets();
    addNewSet(activity.units || 'none');
  } else {
    // Show time-based section (default)
    setsSection.classList.add('hidden');
    timeSection.classList.remove('hidden');
  }
}

function clearSets() {
  const setsContainer = document.getElementById('sets-container');
  if (setsContainer) {
    setsContainer.innerHTML = '';
  }
}

function addNewSet(defaultUnit = 'none') {
  const setsContainer = document.getElementById('sets-container');
  if (!setsContainer) return;

  const setNumber = setsContainer.children.length + 1;
  const setId = `set-${setNumber}`;

  const setElement = document.createElement('div');
  setElement.className = 'set-item p-4 bg-gray-50 dark:bg-gray-700 rounded-xl space-y-3';
  setElement.dataset.setId = setId;

  setElement.innerHTML = `
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Set ${setNumber}</label>
      ${
        setNumber > 1
          ? `<button type="button" class="remove-set-btn text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 p-1" data-set-id="${setId}">
        <span class="material-icons text-red-600 text-base">delete</span>
      </button>`
          : ''
      }
    </div>
    <div class="grid grid-cols-3 gap-2">
      <div>
        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Reps</label>
        <input type="number" name="reps-${setId}" min="1" max="999" placeholder="12" class="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50 h-10 text-center">
      </div>
      <div>
        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Value</label>
        <input type="number" name="value-${setId}" min="0" step="0.1" placeholder="50" class="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50 h-10 text-center">
      </div>
      <div>
        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Unit</label>
        <select name="unit-${setId}" class="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50 h-10" style="text-align: center; text-align-last: center;">
          <option value="none" ${defaultUnit === 'none' ? 'selected' : ''}>None</option>
          <option value="kg" ${defaultUnit === 'kg' ? 'selected' : ''}>Kg</option>
          <option value="seconds" ${defaultUnit === 'seconds' ? 'selected' : ''}>s</option>
          <option value="minutes" ${defaultUnit === 'minutes' ? 'selected' : ''}>Mins</option>
        </select>
      </div>
    </div>
  `;

  setsContainer.appendChild(setElement);

  // Bind remove button if it exists
  const removeBtn = setElement.querySelector('.remove-set-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      removeSet(setId);
    });
  }
}

function removeSet(setId) {
  const setElement = document.querySelector(`[data-set-id="${setId}"]`);
  if (setElement) {
    setElement.remove();
    // Renumber remaining sets
    renumberSets();
  }
}

function renumberSets() {
  const setsContainer = document.getElementById('sets-container');
  if (!setsContainer) return;

  const setElements = setsContainer.querySelectorAll('.set-item');
  setElements.forEach((setElement, index) => {
    const setNumber = index + 1;
    const newSetId = `set-${setNumber}`;

    // Update set ID
    setElement.dataset.setId = newSetId;

    // Update label
    const label = setElement.querySelector('label');
    if (label) label.textContent = `Set ${setNumber}`;

    // Update input names
    const repsInput = setElement.querySelector('input[name^="reps-"]');
    const valueInput = setElement.querySelector('input[name^="value-"]');
    const unitSelect = setElement.querySelector('select[name^="unit-"]');

    if (repsInput) repsInput.name = `reps-${newSetId}`;
    if (valueInput) valueInput.name = `value-${newSetId}`;
    if (unitSelect) unitSelect.name = `unit-${newSetId}`;

    // Update remove button data-set-id
    const removeBtn = setElement.querySelector('.remove-set-btn');
    if (removeBtn) removeBtn.dataset.setId = newSetId;

    // Show/hide remove button (first set shouldn't have remove button)
    if (setNumber === 1) {
      if (removeBtn) removeBtn.style.display = 'none';
    } else {
      if (removeBtn) removeBtn.style.display = 'block';
    }
  });
}

function setupActivityDetailsModal() {
  // Cancel button
  const cancelBtn = document.getElementById('cancel-activity-details');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      closeModal('activity-details-modal');
    });
  }

  // Add Set button
  const addSetBtn = document.getElementById('add-set-btn');
  if (addSetBtn) {
    addSetBtn.addEventListener('click', () => {
      const modal = document.getElementById('activity-details-modal');
      const activityId = modal ? modal.dataset.activityId : null;
      if (!activityId) return;

      const activity = getActivity(activityId);
      if (activity) {
        addNewSet(activity.units || 'none');
      }
    });
  }

  // Save button
  const saveBtn = document.getElementById('save-activity-details');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const modal = document.getElementById('activity-details-modal');
      const activityId = modal ? modal.dataset.activityId : null;
      const recordId = modal ? modal.dataset.recordId : null;
      const isEditMode = modal ? modal.dataset.editMode === 'true' : false;

      if (!activityId) return;

      const activity = getActivity(activityId);
      if (!activity) return;

      const notesInput = document.getElementById('activity-notes-input');
      const notes = notesInput && notesInput.value.trim() ? notesInput.value.trim() : '';

      let recordData = { notes };

      if (activity.trackingType === 'sets-reps') {
        // Collect sets data
        const sets = collectSetsData();
        if (sets.length === 0) return; // Don't save if no sets
        recordData.sets = sets;
      } else {
        // Collect time-based data
        const durationInput = document.getElementById('activity-duration-input');
        const durationUnitSelect = document.getElementById('duration-unit-select');
        const intensitySelect = document.getElementById('activity-intensity-select');

        const duration =
          durationInput && durationInput.value ? parseInt(durationInput.value) : null;
        const durationUnit = durationUnitSelect ? durationUnitSelect.value : 'minutes';
        const intensity = intensitySelect && intensitySelect.value ? intensitySelect.value : null;

        if (!duration) return; // Don't save if no duration

        recordData.duration = duration;
        recordData.durationUnit = durationUnit;
        recordData.intensity = intensity;
      }

      if (isEditMode && recordId) {
        // Update existing record
        const selectedDate = appData.fitnessSelectedDate || new Date().toISOString();
        const iso = getLocalISODate(selectedDate);
        updateRecordedActivity(recordId, iso, recordData);
      } else {
        // Create new record
        const selectedDate = appData.fitnessSelectedDate || new Date().toISOString();
        const iso = getLocalISODate(selectedDate);
        recordActivity(activityId, iso, recordData);
      }

      // Reset modal state
      if (modal) {
        delete modal.dataset.recordId;
        delete modal.dataset.editMode;
      }

      // Reset modal UI
      const modalTitle = document.querySelector('#activity-details-modal .modal-header span');
      if (modalTitle) modalTitle.textContent = 'Activity Details';
      if (saveBtn) saveBtn.textContent = 'Record';

      closeModal('activity-details-modal');
      renderActivitiesList();
    });
  }

  // Form submission
  const form = document.getElementById('activity-details-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (saveBtn) saveBtn.click();
    });
  }
}

function collectSetsData() {
  const setsContainer = document.getElementById('sets-container');
  if (!setsContainer) return [];

  const sets = [];
  const setElements = setsContainer.querySelectorAll('.set-item');

  setElements.forEach((setElement, index) => {
    const setId = `set-${index + 1}`;
    const repsInput = setElement.querySelector(`input[name="reps-${setId}"]`);
    const valueInput = setElement.querySelector(`input[name="value-${setId}"]`);
    const unitSelect = setElement.querySelector(`select[name="unit-${setId}"]`);

    const reps = repsInput && repsInput.value ? parseInt(repsInput.value) : null;
    const value = valueInput && valueInput.value ? parseFloat(valueInput.value) : null;
    const unit = unitSelect ? unitSelect.value : 'none';

    // Only include sets with at least reps filled
    if (reps) {
      sets.push({
        reps,
        value,
        unit,
      });
    }
  });

  return sets;
}

function groupActivitiesByMuscleGroup(items) {
  const grouped = {};
  items.forEach((it) => {
    let mg = it.muscleGroup;
    if (!mg && it.activityId) {
      // item is a record – lookup original activity
      const act = getActivity(it.activityId);
      mg = act?.muscleGroup;
    }
    if (!mg) mg = 'Other';
    if (!grouped[mg]) grouped[mg] = [];
    grouped[mg].push(it);
  });
  return grouped;
}
