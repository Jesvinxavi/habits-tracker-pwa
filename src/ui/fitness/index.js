/**
 * Fitness Module - Main entry point for fitness functionality
 * Coordinates all fitness components and provides a clean interface
 */

import { mountCalendar } from '../calendar.js';
import { isRestDay, toggleRestDay } from '../../utils/restDays.js';
import { appData, mutate, subscribe } from '../../core/state.js';
import { getLocalISODate } from '../../utils/datetime.js';
import { buildHeader, bindActionButtons } from './FitnessHeader.js';
import { initializeSearch, updateSearchSectionHeight } from './FitnessSearch.js';
import { updateTimerButton } from './FitnessTimer.js';
import { initializeActivityDetailsModal } from './FitnessActivityDetails.js';
import { getActivitiesForDate } from '../../utils/activities.js';
import { makeCardSwipable } from '../../components/swipeableCard.js';
import { hexToRgba } from '../../utils/color.js';
import { formatDuration, formatLastPerformed } from '../../utils/datetime.js';

/**
 * Initializes the fitness view with all its components
 */
export function initializeFitness() {
  // Clean up any fitness categories that accidentally got mixed into habits categories
  cleanupFitnessFromHabitsCategories();

  // Ensure fitness always starts on today when initialized
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const localToday = getLocalISODate(today) + 'T00:00:00.000Z';

  mutate((s) => {
    s.fitnessSelectedDate = localToday;
  });

  // Build UI components
  buildHeader();
  buildCalendarWrapper();
  buildRestDayRow();
  buildCalendar();
  buildActivitiesList();

  // Initialize component functionality
  bindRestToggle();
  bindActionButtons();
  initializeSearch();

  // Setup modals
  setupAddActivityModal();
  initializeActivityDetailsModal();

  // Subscribe to state changes for reactive updates
  subscribe(() => {
    renderActivitiesList();
    updateRestToggle();
    updateTimerButton();
  });

  // Initial render
  renderActivitiesList();

  // Handle responsive behavior
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      adjustActivitiesContainerHeight();
      updateSearchSectionHeight();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        updateSearchSectionHeight();
      }, 500);
    });
  }
}

/**
 * Builds the calendar wrapper
 */
function buildCalendarWrapper() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  const calendarWrapper = document.createElement('div');
  calendarWrapper.className = 'calendar-wrapper px-4 mb-4';
  calendarWrapper.innerHTML = `
    <div id="fitness-calendar" class="calendar-container"></div>
  `;
  fitnessView.appendChild(calendarWrapper);

  addCalendarNavigation();
}

/**
 * Adds calendar navigation functionality
 */
function addCalendarNavigation() {
  const calendarContainer = document.getElementById('fitness-calendar');
  if (!calendarContainer) return;

  const navContainer = document.createElement('div');
  navContainer.className = 'calendar-nav flex justify-between items-center mb-3';
  navContainer.innerHTML = `
    <button id="fitness-prev-btn" class="nav-btn p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
      <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M15 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <h3 id="fitness-calendar-title" class="text-lg font-semibold text-gray-900 dark:text-white"></h3>
    <button id="fitness-next-btn" class="nav-btn p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
      <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;

  calendarContainer.appendChild(navContainer);
  bindCalendarNavigation(calendarContainer);
}

/**
 * Binds calendar navigation events
 */
function bindCalendarNavigation(container) {
  const prevBtn = container.querySelector('#fitness-prev-btn');
  const nextBtn = container.querySelector('#fitness-next-btn');

  function getStateDate() {
    return new Date(appData.fitnessSelectedDate);
  }

  function setStateDate(dateObj) {
    const isoString = getLocalISODate(dateObj) + 'T00:00:00.000Z';
    mutate((s) => {
      s.fitnessSelectedDate = isoString;
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const currentDate = getStateDate();
      const prevDate = new Date(currentDate);
      prevDate.setDate(currentDate.getDate() - 1);
      setStateDate(prevDate);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const currentDate = getStateDate();
      const nextDate = new Date(currentDate);
      nextDate.setDate(currentDate.getDate() + 1);
      setStateDate(nextDate);
    });
  }
}

/**
 * Builds the rest day toggle row
 */
function buildRestDayRow() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  const restDayRow = document.createElement('div');
  restDayRow.className =
    'rest-day-row flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl mx-4 mb-4';
  restDayRow.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="material-icons text-gray-600 dark:text-gray-300">hotel</span>
      <span class="text-gray-900 dark:text-white font-medium">Rest Day</span>
    </div>
    <button id="rest-day-toggle" class="toggle-switch">
      <div class="toggle-track"></div>
      <div class="toggle-thumb"></div>
    </button>
  `;
  fitnessView.appendChild(restDayRow);
}

/**
 * Builds the calendar component
 */
function buildCalendar() {
  const calendarContainer = document.getElementById('fitness-calendar');
  if (!calendarContainer) return;

  // Mount calendar with fitness-specific configuration
  mountCalendar(calendarContainer, {
    selectedDate: appData.fitnessSelectedDate,
    onDateSelect: (date) => {
      const isoString = getLocalISODate(date) + 'T00:00:00.000Z';
      mutate((s) => {
        s.fitnessSelectedDate = isoString;
      });
    },
    showRestDays: true,
    context: 'fitness',
  });
}

/**
 * Builds the activities list container
 */
function buildActivitiesList() {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  const activitiesContainer = document.createElement('div');
  activitiesContainer.className = 'activities-container flex-1 overflow-y-auto px-4 pb-8';
  activitiesContainer.id = 'fitness-activities-container';
  fitnessView.appendChild(activitiesContainer);

  // Adjust height for proper scrolling
  adjustActivitiesContainerHeight();
}

/**
 * Adjusts the activities container height
 */
function adjustActivitiesContainerHeight() {
  const container = document.getElementById('fitness-activities-container');
  if (!container) return;

  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  const viewHeight = fitnessView.clientHeight;
  const containerTop = container.offsetTop;
  const availableHeight = viewHeight - containerTop - 20; // 20px padding

  container.style.height = `${Math.max(200, availableHeight)}px`;
}

/**
 * Renders the activities list
 */
function renderActivitiesList() {
  const container = document.getElementById('fitness-activities-container');
  if (!container) return;

  const selectedDate = new Date(appData.fitnessSelectedDate);
  const dateKey = getLocalISODate(selectedDate);
  const activities = getActivitiesForDate(dateKey);

  if (activities.length === 0) {
    // Show empty state
    container.innerHTML = `
      <div class="empty-state text-center py-16">
        <div class="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center">
          <span class="material-icons text-3xl text-gray-400">fitness_center</span>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Activities Yet</h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">Start tracking your fitness activities</p>
        <button class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl font-medium" onclick="document.getElementById('new-activity-btn').click()">
          Add Your First Activity
        </button>
      </div>
    `;
    return;
  }

  // Render activities
  const activitiesHtml = activities.map((activity) => createActivityItem(activity)).join('');
  container.innerHTML = `
    <div class="activities-list space-y-3">
      ${activitiesHtml}
    </div>
  `;

  // Make cards swipeable
  container.querySelectorAll('.activity-card').forEach((card) => {
    const activityId = card.dataset.activityId;
    const record = activities.find((a) => a.id === activityId);

    makeCardSwipable(card, {
      onSwipeLeft: () => {
        // Handle edit action
        if (activityId && record) {
          import('./FitnessActivityDetails.js').then((module) => {
            module.openActivityDetailsModalWithRecord(record.activityId, record);
          });
        }
      },
      onSwipeRight: () => {
        // Handle delete action
        const activityId = card.dataset.activityId;
        if (activityId) {
          // Show confirmation dialog
          import('../../components/ConfirmDialog.js').then((module) => {
            module.showConfirm({
              title: 'Delete Activity',
              message: 'Are you sure you want to delete this activity record?',
              onOK: () => {
                // Delete the activity record
                import('../../utils/activities.js').then((utils) => {
                  utils.deleteRecordedActivity(activityId);
                  renderActivitiesList(); // Refresh the list
                });
              },
            });
          });
        }
      },
    });
  });
}

/**
 * Creates an activity item HTML
 */
function createActivityItem(record) {
  const activity = appData.fitnessActivities.find((a) => a.id === record.activityId);
  if (!activity) return '';

  const category = appData.fitnessCategories.find((c) => c.id === activity.categoryId);
  const categoryColor = category?.color || '#6B7280';

  return `
    <div class="activity-card bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700" data-activity-id="${record.id}">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background-color: ${hexToRgba(categoryColor, 0.1)}">
            <span class="material-icons text-xl" style="color: ${categoryColor}">${activity.icon || 'fitness_center'}</span>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-white">${activity.name}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">${category?.name || 'Uncategorized'}</p>
          </div>
        </div>
        <div class="text-right">
          <div class="text-sm text-gray-500 dark:text-gray-400">${formatDuration(record.duration)}</div>
          <div class="text-xs text-gray-400 dark:text-gray-500">${formatLastPerformed(record.timestamp)}</div>
        </div>
      </div>
      
      <div class="activity-pills flex flex-wrap gap-2">
        ${generateActivityPills(record, category)}
      </div>
    </div>
  `;
}

/**
 * Generates activity pills based on tracking data
 */
function generateActivityPills(record, category) {
  const pills = [];

  if (record.sets && record.sets.length > 0) {
    const totalSets = record.sets.length;
    const totalVolume = record.sets.reduce((sum, set) => {
      const weight = parseFloat(set.value) || 0;
      const reps = parseInt(set.reps) || 0;
      return sum + weight * reps;
    }, 0);

    pills.push(`
      <div class="pill bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm font-medium">
        ${totalSets} sets
      </div>
    `);

    if (totalVolume > 0) {
      pills.push(`
        <div class="pill bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm font-medium">
          ${totalVolume.toFixed(1)} volume
        </div>
      `);
    }
  }

  if (record.duration) {
    pills.push(`
      <div class="pill bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-sm font-medium">
        ${formatDuration(record.duration)}
      </div>
    `);
  }

  if (record.intensity) {
    pills.push(`
      <div class="pill bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-3 py-1 rounded-full text-sm font-medium">
        ${record.intensity} intensity
      </div>
    `);
  }

  return pills.join('');
}

/**
 * Binds rest day toggle functionality
 */
function bindRestToggle() {
  const toggle = document.getElementById('rest-day-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const selectedDate = new Date(appData.fitnessSelectedDate);
    const dateKey = getLocalISODate(selectedDate);
    toggleRestDay(dateKey);
    updateRestToggle();
  });
}

/**
 * Updates the rest day toggle state
 */
function updateRestToggle() {
  const toggle = document.getElementById('rest-day-toggle');
  if (!toggle) return;

  const selectedDate = new Date(appData.fitnessSelectedDate);
  const dateKey = getLocalISODate(selectedDate);
  const isRest = isRestDay(dateKey);

  toggle.classList.toggle('active', isRest);
}

/**
 * Cleans up fitness categories from habits categories
 */
function cleanupFitnessFromHabitsCategories() {
  const fitnessKeywords = [
    'fitness',
    'workout',
    'exercise',
    'gym',
    'cardio',
    'strength',
    'yoga',
    'running',
  ];

  mutate((s) => {
    s.categories = s.categories.filter((category) => {
      const name = category.name.toLowerCase();
      return !fitnessKeywords.some((keyword) => name.includes(keyword));
    });
  });
}

/**
 * Sets up the add activity modal (lazy loaded)
 */
function setupAddActivityModal() {
  // Modal will be set up when first opened
  // This keeps the initial bundle size smaller
}
