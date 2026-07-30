import { getState, dispatch, Actions } from '../../core/state.js';
import { generateUniqueId } from '../../shared/common.js';
import { showConfirm } from '../../components/ConfirmDialog.js';
import { isRestDay } from '../../shared/restDays.js';
import { getLocalMidnightISOString } from '../../shared/datetime.js';

let indexedActivities = null;
let activitiesById = new Map();
let indexedCategories = null;
let categoriesById = new Map();
let indexedSearchActivities = null;
let searchableActivities = [];

function ensureActivityIndex() {
  const activities = getState().activities;
  if (activities !== indexedActivities) {
    indexedActivities = activities;
    activitiesById = new Map(activities.map((activity) => [activity.id, activity]));
  }
  return activitiesById;
}

function ensureCategoryIndex() {
  const categories = getState().activityCategories;
  if (categories !== indexedCategories) {
    indexedCategories = categories;
    categoriesById = new Map(categories.map((category) => [category.id, category]));
  }
  return categoriesById;
}


/**
 * Add a new activity to the activities list
 */
export async function addActivity(activityData) {
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
  const activity = ensureActivityIndex().get(activityId);
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

  // Resolve one immutable batch before dispatching. The reducer applies all
  // records in one state transition and the persistence router durably queues
  // all corresponding operations before the UI is notified.
  const live = activityIds.map((activityId) => getActivity(activityId)).filter(Boolean);
  const timestamp = new Date().toISOString();
  const records = live.map((activity) => ({
    id: generateUniqueId(),
    activityId: activity.id,
    activityName: activity.name,
    categoryId: activity.categoryId,
    date: dateKey,
    timestamp,
    duration: null,
    intensity: null,
    notes: '',
  }));
  const saved = records.length > 0 && (await dispatch(Actions.recordActivities(dateKey, records)));
  const recorded = saved ? records.length : 0;
  const failed = saved ? 0 : records.length;

  if (failed > 0) {
    showConfirm({
      title: 'Some Activities Not Added',
      message: `${failed} of ${live.length} activities could not be added. Check your connection and try again.`,
      okText: 'OK',
      cancelText: '',
      onOK: () => {},
    });
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
      activities: [],
    };
  });
  listActivities().forEach((activity) => {
    grouped[activity.categoryId]?.activities.push(activity);
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
  const activities = getState().activities;
  if (activities !== indexedSearchActivities) {
    indexedSearchActivities = activities;
    searchableActivities = activities
      .filter((activity) => !isArchivedActivity(activity))
      .map((activity) => ({ activity, normalizedName: activity.name.toLowerCase() }));
  }
  return searchableActivities
    .filter(({ normalizedName }) => normalizedName.includes(searchTerm))
    .map(({ activity }) => activity);
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
  return ensureCategoryIndex().get(categoryId);
}

/**
 * Get activity by ID
 */
export function getActivity(activityId) {
  return ensureActivityIndex().get(activityId);
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
function listActivities() {
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
