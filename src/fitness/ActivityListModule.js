// ActivityListModule.js - Orchestrates the activity list and related logic for the fitness feature
import {
  mountActivitiesList,
  renderActivitiesList,
  getActivitiesListContainer,
} from './ActivityList/ActivitiesList.js';

/**
 * Mounts the complete activity list with container and rendering
 * @param {Function} onActivityClick - Callback when activity is clicked (activityId, record)
 * @returns {HTMLElement} The complete activity list container
 */
export function mountActivityList(onActivityClick) {
  return mountActivitiesList(onActivityClick);
}

/**
 * Renders the activity list content
 * @param {Function} onActivityClick - Callback when activity is clicked (activityId, record)
 */
export function renderActivityList(onActivityClick) {
  renderActivitiesList(onActivityClick);
}

/**
 * Gets the activity list container element
 * @returns {HTMLElement} The activity list container
 */
export function getActivityListContainer() {
  return getActivitiesListContainer();
}

// Re-export for convenience
export { mountActivitiesList, renderActivitiesList, getActivitiesListContainer };
