import { getState, dispatch, Actions } from '../../core/state.js';
import { generateUniqueId } from '../../shared/common.js';
import { showConfirm } from '../../components/ConfirmDialog.js';
import { isRestDay } from './restDays.js';



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
 * Records several activities for one date in a single user action.
 *
 * Records are created with no duration, intensity or sets: the cards render
 * without metric pills and the user taps one to fill details in through the
 * existing activity-details flow. This is deliberate, not a missing field.
 *
 * @param {string[]} activityIds Activity client ids, in the order to record them.
 * @param {string} isoDate Target date, YYYY-MM-DD.
 * @returns {Promise<{recorded: number, failed: number, blocked: boolean}>} Attempt counts.
 */
export async function recordActivitiesForDate(activityIds, isoDate) {
  const dateKey = String(isoDate).slice(0, 10);

  if (isRestDay(dateKey)) {
    showConfirm({
      title: 'Rest Day',
      message: 'Unable to record activity as selected day is a rest day.',
      okText: 'OK',
      cancelText: '',
      onOK: () => {},
    });
    return { recorded: 0, failed: 0, blocked: true };
  }

  // Drop ids whose activity has since been deleted rather than failing the batch.
  const live = activityIds.filter((activityId) => Boolean(getActivity(activityId)));
  let recorded = 0;
  let failed = 0;

  for (const activityId of live) {
    // Sequential, not Promise.all: each call commits an operation to the
    // IndexedDB outbox, and serialising keeps outbox ordering deterministic.
    // eslint-disable-next-line no-await-in-loop
    const saved = await recordActivity(activityId, dateKey, {});
    if (saved) recorded += 1;
    else failed += 1;
  }

  if (failed > 0) {
    showConfirm({
      title: 'Some Activities Not Added',
      message: `${failed} of ${live.length} activities could not be added. Check your connection and try again.`,
      okText: 'OK',
      cancelText: '',
      onOK: () => {},
    });
  }

  if (recorded > 0 && typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('ActivityRecorded', { detail: { dateKey, recorded } }));
  }

  return { recorded, failed, blocked: false };
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
      activities: listActivities().filter((activity) => activity.categoryId === category.id),
    };
  });

  return grouped;
}

/**
 * Search activities by name
 */
export function searchActivities(query) {
  if (!query || query.trim() === '') {
    return listActivities();
  }

  const searchTerm = query.toLowerCase().trim();
  return listActivities().filter((activity) => activity.name.toLowerCase().includes(searchTerm));
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
export async function archiveActivity(activityId) {
  return dispatch(Actions.updateActivity(activityId, { archivedAt: Date.now() }));
}

/**
 * Reports whether an activity has been archived.
 * @param {object} activity Activity, or undefined.
 * @returns {boolean} True when it has been removed from the library.
 */
export function isArchivedActivity(activity) {
  return Boolean(activity?.archivedAt);
}

/**
 * Lists the activities still in the library, newest definition order preserved.
 * @returns {object[]} Live activities.
 */
export function listActivities() {
  return getState().activities.filter((activity) => !isArchivedActivity(activity));
}

/**
 * Resolves how a recorded session should be labelled and grouped.
 *
 * A record snapshots the activity's name and category when it is written, but
 * the **activity is the identity**: renaming it, or moving it to another
 * category, applies to every session of it, past ones included. The snapshot is
 * only a fallback, for a record whose activity is not in state at all.
 * @param {{activityId?: string, activityName?: string, categoryId?: string}} record A recorded session.
 * @returns {{name: string, categoryId: string|undefined, activity: object|undefined}} Display data.
 */
export function recordActivityView(record) {
  const activity = getActivity(record?.activityId);
  return {
    name: activity?.name || record?.activityName || '',
    categoryId: activity?.categoryId || record?.categoryId,
    activity,
  };
}

/**
 * Update an existing activity
 */
export async function updateActivity(activityId, updates) {
  return dispatch(Actions.updateActivity(activityId, updates));
}
