import { getState, dispatch, Actions } from '../../core/state.js';
import { generateUniqueId } from '../../shared/common.js';



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
      getState().activityCategories.find((c) => c.id === activityData.categoryId)?.icon ||
      '🎯',
    createdAt: new Date().toISOString(),
    ...activityData,
  };

  dispatch(Actions.addActivity(newActivity));

  return newActivity;
}

/**
 * Record an activity for a specific date
 */
export function recordActivity(activityId, date, data = {}) {
  const activity = getState().activities.find((a) => a.id === activityId);
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

  dispatch(Actions.recordActivity(activityId, date, data));

  return record;
}

/**
 * Get activities recorded for a specific date
 */
export function getActivitiesForDate(date) {
  const isoDate = date.slice(0, 10);
  return getState().recordedActivities[isoDate] || [];
}

/**
 * Get all activities grouped by category
 */
export function getActivitiesByCategory() {
  const grouped = {};

  getState().activityCategories.forEach((category) => {
    grouped[category.id] = {
      category,
      activities: getState().activities.filter((activity) => activity.categoryId === category.id),
    };
  });

  return grouped;
}

/**
 * Search activities by name
 */
export function searchActivities(query) {
  if (!query || query.trim() === '') {
    return getState().activities;
  }

  const searchTerm = query.toLowerCase().trim();
  return getState().activities.filter((activity) => activity.name.toLowerCase().includes(searchTerm));
}

/**
 * Delete a recorded activity
 */
export function deleteRecordedActivity(recordId, date) {
  const isoDate = date.slice(0, 10);

  // Use a thunk-style action since we don't have a specific action for this
  dispatch((dispatch, getState) => {
    const state = getState();
    const updatedRecordedActivities = { ...state.recordedActivities };
    
    if (updatedRecordedActivities[isoDate]) {
      updatedRecordedActivities[isoDate] = updatedRecordedActivities[isoDate].filter(
        (record) => record.id !== recordId
      );

      // Remove empty date entries
      if (updatedRecordedActivities[isoDate].length === 0) {
        delete updatedRecordedActivities[isoDate];
      }
    }
    
    dispatch(Actions.importData({ recordedActivities: updatedRecordedActivities }));
  });
}

/**
 * Update a recorded activity
 */
export function updateRecordedActivity(recordId, date, data = {}) {
  const isoDate = date.slice(0, 10);

  // Use a thunk-style action since we don't have a specific action for this
  dispatch((dispatch, getState) => {
    const state = getState();
    const updatedRecordedActivities = { ...state.recordedActivities };
    
    if (updatedRecordedActivities[isoDate]) {
      const recordIndex = updatedRecordedActivities[isoDate].findIndex(
        (record) => record.id === recordId
      );
      if (recordIndex !== -1) {
        // Update the existing record with new data while preserving ID and timestamp
        updatedRecordedActivities[isoDate][recordIndex] = {
          ...updatedRecordedActivities[isoDate][recordIndex],
          ...data,
        };
      }
    }
    
    dispatch(Actions.importData({ recordedActivities: updatedRecordedActivities }));
  });
}

/**
 * Get activity category by ID
 */
export function getActivityCategory(categoryId) {
  return getState().activityCategories.find((cat) => cat.id === categoryId);
}

/**
 * Get activity by ID
 */
export function getActivity(activityId) {
  return getState().activities.find((activity) => activity.id === activityId);
}

/**
 * Group activities by muscle group (for strength training)
 * @param {Array} items - Array of activities or records
 * @returns {Object} Activities grouped by muscle group
 */
export function groupActivitiesByMuscleGroup(items) {
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

/**
 * Delete an activity and all its recorded instances
 */
export function deleteActivity(activityId) {
  dispatch(Actions.deleteActivity(activityId));
}

/**
 * Update an existing activity
 */
export function updateActivity(activityId, updates) {
  dispatch(Actions.updateActivity(activityId, updates));
}
