// ActivitiesList.js - Main activities list container component
import { getLocalISODate } from '../../../shared/datetime.js';
import {
  getActivitiesForDate,
  getActivityCategory,
  deleteRecordedActivity,
} from '../activities.js';
import { isRestDay } from '../restDays.js';
import { appData } from '../../../core/state.js';
import { adjustActivitiesContainerHeight } from '../helpers/fitnessLayout.js';
import { CategoryGroup } from './CategoryGroup.js';

/**
 * Mounts the activities list container
 * @param {Function} onActivityClick - Callback when activity is clicked
 * @returns {HTMLElement} The activities list container
 */
export function mountActivitiesList(onActivityClick) {
  const activitiesContainer = document.createElement('div');
  activitiesContainer.className = 'activities-container flex-grow overflow-y-auto px-4 pb-8';
  activitiesContainer.style.overflowX = 'visible';
  activitiesContainer.id = 'activities-list';

  // Store callback for later use
  activitiesContainer._onActivityClick = onActivityClick;

  return activitiesContainer;
}

/**
 * Renders the activities list content
 * @param {Function} onActivityClick - Callback when activity is clicked
 */
export function renderActivitiesList(onActivityClick) {
  const activitiesContainer = document.getElementById('activities-list');
  if (!activitiesContainer) return;

  const selectedDate = appData.fitnessSelectedDate || new Date().toISOString();
  const iso = getLocalISODate(selectedDate);
  const isRestDayActive = isRestDay(iso);
  const activities = getActivitiesForDate(iso);

  // Handle empty states
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

  // Generate HTML for category groups
  let html = '';
  Object.values(groupedActivities).forEach(({ category, records }) => {
    if (records.length === 0) return;

    html += CategoryGroup.build(category, records, {
      onActivityClick: onActivityClick || activitiesContainer._onActivityClick,
      onActivityDelete: (recordId) => {
        deleteRecordedActivity(recordId, iso);
        renderActivitiesList(onActivityClick || activitiesContainer._onActivityClick);
      },
    });
  });

  activitiesContainer.innerHTML = html;

  // Bind events for category groups
  CategoryGroup.bindEvents(activitiesContainer, activities, {
    onActivityClick: onActivityClick || activitiesContainer._onActivityClick,
    onActivityDelete: (recordId) => {
      deleteRecordedActivity(recordId, iso);
      renderActivitiesList(onActivityClick || activitiesContainer._onActivityClick);
    },
  });

  // Recalculate scrollable area height after any UI change
  adjustActivitiesContainerHeight();
}

/**
 * Gets the activities list container element
 * @returns {HTMLElement} The activities list container
 */
export function getActivitiesListContainer() {
  return document.getElementById('activities-list');
}
