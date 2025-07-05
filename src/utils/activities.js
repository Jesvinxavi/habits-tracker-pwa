import { appData, mutate } from '../core/state.js';
import { generateUniqueId } from './common.js';

/**
 * Add a new activity to the activities list
 */
export function addActivity(activityData) {
  const newActivity = {
    id: generateUniqueId(),
    name: activityData.name,
    categoryId: activityData.categoryId,
    icon:
      activityData.icon ||
      appData.activityCategories.find((c) => c.id === activityData.categoryId)?.icon ||
      '🎯',
    createdAt: new Date().toISOString(),
    ...activityData,
  };

  mutate((state) => {
    state.activities.push(newActivity);
  });

  return newActivity;
}

/**
 * Record an activity for a specific date
 */
export function recordActivity(activityId, date, data = {}) {
  const activity = appData.activities.find((a) => a.id === activityId);
  if (!activity) return null;

  const isoDate = date.slice(0, 10); // Ensure YYYY-MM-DD format
  const record = {
    id: generateUniqueId(),
    activityId,
    activityName: activity.name,
    categoryId: activity.categoryId,
    date: isoDate,
    timestamp: new Date().toISOString(),
    duration: data.duration || null,
    intensity: data.intensity || null,
    notes: data.notes || '',
    ...data,
  };

  mutate((state) => {
    if (!state.recordedActivities[isoDate]) {
      state.recordedActivities[isoDate] = [];
    }
    state.recordedActivities[isoDate].push(record);
  });

  return record;
}

/**
 * Get activities recorded for a specific date
 */
export function getActivitiesForDate(date) {
  const isoDate = date.slice(0, 10);
  return appData.recordedActivities[isoDate] || [];
}

/**
 * Get all activities grouped by category
 */
export function getActivitiesByCategory() {
  const grouped = {};

  appData.activityCategories.forEach((category) => {
    grouped[category.id] = {
      category,
      activities: appData.activities.filter((activity) => activity.categoryId === category.id),
    };
  });

  return grouped;
}

/**
 * Search activities by name
 */
export function searchActivities(query) {
  if (!query || query.trim() === '') {
    return appData.activities;
  }

  const searchTerm = query.toLowerCase().trim();
  return appData.activities.filter((activity) => activity.name.toLowerCase().includes(searchTerm));
}

/**
 * Delete a recorded activity
 */
export function deleteRecordedActivity(recordId, date) {
  const isoDate = date.slice(0, 10);

  mutate((state) => {
    if (state.recordedActivities[isoDate]) {
      state.recordedActivities[isoDate] = state.recordedActivities[isoDate].filter(
        (record) => record.id !== recordId
      );

      // Remove empty date entries
      if (state.recordedActivities[isoDate].length === 0) {
        delete state.recordedActivities[isoDate];
      }
    }
  });
}

/**
 * Update a recorded activity
 */
export function updateRecordedActivity(recordId, date, data = {}) {
  const isoDate = date.slice(0, 10);

  mutate((state) => {
    if (state.recordedActivities[isoDate]) {
      const recordIndex = state.recordedActivities[isoDate].findIndex(
        (record) => record.id === recordId
      );
      if (recordIndex !== -1) {
        // Update the existing record with new data while preserving ID and timestamp
        state.recordedActivities[isoDate][recordIndex] = {
          ...state.recordedActivities[isoDate][recordIndex],
          ...data,
        };
      }
    }
  });
}

/**
 * Get activity category by ID
 */
export function getActivityCategory(categoryId) {
  return appData.activityCategories.find((cat) => cat.id === categoryId);
}

/**
 * Get activity by ID
 */
export function getActivity(activityId) {
  return appData.activities.find((activity) => activity.id === activityId);
}
