import { getState, dispatch, Actions } from '../../core/state.js';
import { generateUniqueId } from '../../shared/common.js';



/**
 * Add a new activity to the activities list
 */
export async function addActivity(activityData) {
  // Import timezone-safe date helper
  const { getLocalMidnightISOString } = await import('../../shared/datetime.js');
  
  const newActivity = {
    id: generateUniqueId(),
    name: activityData.name,
    categoryId: activityData.categoryId,
    icon:
      activityData.icon ||
      getState().activityCategories.find((c) => c.id === activityData.categoryId)?.icon ||
      '🎯',
    createdAt: getLocalMidnightISOString(new Date()), // Use timezone-safe creation timestamp
    ...activityData,
  };

  const saved = await dispatch(Actions.addActivity(newActivity));
  if (!saved) return null;

  return newActivity;
}

/**
 * Record an activity for a specific date
 */
export async function recordActivity(activityId, date, data = {}) {
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

  const saved = await dispatch(Actions.recordActivity(activityId, date, record));
  if (!saved) return null;

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
export async function deleteRecordedActivity(recordId, date) {
  const isoDate = date.slice(0, 10);
  return dispatch(Actions.deleteRecordedActivity(recordId, isoDate));
}

/**
 * Update a recorded activity
 */
export async function updateRecordedActivity(recordId, date, data = {}) {
  const isoDate = date.slice(0, 10);
  const updates = { ...data };
  if (Array.isArray(updates.sets)) {
    updates.duration = null;
    updates.durationUnit = null;
    updates.intensity = null;
  } else if (updates.duration != null) {
    updates.sets = null;
  }
  return dispatch(Actions.updateRecordedActivity(recordId, isoDate, updates));
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
export async function deleteActivity(activityId) {
  return dispatch(Actions.deleteActivity(activityId));
}

/**
 * Update an existing activity
 */
export async function updateActivity(activityId, updates) {
  return dispatch(Actions.updateActivity(activityId, updates));
}
