/**
 * Shared fixtures for the statistics suites.
 *
 * Dates are built relative to a pinned "today" so a test reads as "three days
 * ago" rather than as a literal date that silently becomes meaningless when the
 * suite is next run.
 */

/** The day every stats fixture is anchored to: a Wednesday, mid-month, mid-year. */
export const TODAY = new Date(2026, 6, 15, 12, 0, 0);

/**
 * Formats a date as the local YYYY-MM-DD key the app stores completions under.
 * @param {Date} date Any date.
 * @returns {string} Local calendar key.
 */
export function key(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the date N days before the fixture's today.
 * @param {number} days Days back; 0 is today.
 * @param {Date} [from] Anchor, defaulting to the fixture today.
 * @returns {Date} Local midnight date.
 */
export function daysAgo(days, from = TODAY) {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Returns the local key N days before the fixture's today.
 * @param {number} days Days back.
 * @returns {string} Local calendar key.
 */
export function keyDaysAgo(days) {
  return key(daysAgo(days));
}

/**
 * Builds a daily habit whose completion map is described by a predicate.
 * @param {Object} options Habit options.
 * @param {string} [options.id] Client id.
 * @param {number} [options.createdDaysAgo] Age of the habit in days.
 * @param {(dayIndex: number) => boolean|null} [options.completedOn] True to
 *   complete that day, false to miss it, null to leave no entry at all.
 * @param {number[]} [options.skippedDaysAgo] Days to mark skipped.
 * @param {Object} [options.overrides] Extra habit fields.
 * @returns {Object} A habit shaped like the ones in state.
 */
export function dailyHabit({
  id = 'habit-daily',
  createdDaysAgo = 30,
  completedOn = () => true,
  skippedDaysAgo = [],
  overrides = {},
} = {}) {
  const completed = {};
  for (let day = 0; day <= createdDaysAgo; day += 1) {
    const value = completedOn(day);
    if (value === true) completed[keyDaysAgo(day)] = true;
    else if (value === false) completed[keyDaysAgo(day)] = false;
  }
  return {
    id,
    name: 'Daily habit',
    categoryId: 'cat-health',
    icon: '🧘',
    paused: false,
    activeOnHolidays: false,
    frequency: 'daily',
    createdAt: `${keyDaysAgo(createdDaysAgo)}T00:00:00.000`,
    completed,
    skippedDates: skippedDaysAgo.map((day) => keyDaysAgo(day)),
    ...overrides,
  };
}

/**
 * Builds a target-based habit (one whose completion aggregates over a period).
 * @param {Object} options Habit options.
 * @param {string} [options.id] Client id.
 * @param {string} [options.targetFrequency] daily|weekly|biweekly|monthly|yearly.
 * @param {number} [options.createdDaysAgo] Age in days.
 * @param {Object<string, boolean>} [options.completed] Period key → completed.
 * @param {Object} [options.overrides] Extra habit fields.
 * @returns {Object} A habit shaped like the ones in state.
 */
export function targetHabit({
  id = 'habit-target',
  targetFrequency = 'weekly',
  createdDaysAgo = 60,
  completed = {},
  overrides = {},
} = {}) {
  return {
    id,
    name: 'Target habit',
    categoryId: 'cat-health',
    icon: '📞',
    paused: false,
    activeOnHolidays: false,
    frequency: targetFrequency,
    targetFrequency,
    target: 1,
    createdAt: `${keyDaysAgo(createdDaysAgo)}T00:00:00.000`,
    completed,
    skippedDates: [],
    ...overrides,
  };
}

/**
 * Builds a recorded fitness session.
 * @param {Object} options Record options.
 * @returns {Object} A record shaped like the ones in state.
 */
export function record({
  id = 'rec-1',
  activityId = 'act-run',
  daysBack = 0,
  duration = null,
  durationUnit = 'minutes',
  intensity = null,
  sets = null,
  loggedDaysBack = null,
} = {}) {
  const performed = daysAgo(daysBack);
  const logged = daysAgo(loggedDaysBack === null ? daysBack : loggedDaysBack);
  const entry = {
    id,
    activityId,
    activityName: 'Activity',
    categoryId: 'cat-cardio',
    date: key(performed),
    timestamp: new Date(logged.getFullYear(), logged.getMonth(), logged.getDate(), 9).toISOString(),
    notes: '',
  };
  if (duration !== null) {
    entry.duration = duration;
    entry.durationUnit = durationUnit;
  }
  if (intensity !== null) entry.intensity = intensity;
  if (sets !== null) entry.sets = sets;
  return entry;
}

/**
 * Groups records into the by-date map the store holds.
 * @param {Object[]} records Records in any order.
 * @returns {Object<string, Object[]>} recordedActivities map.
 */
export function recordedActivities(records) {
  const byDate = {};
  for (const entry of records) {
    if (!byDate[entry.date]) byDate[entry.date] = [];
    byDate[entry.date].push(entry);
  }
  return byDate;
}

/** A time-tracked activity. */
export const TIME_ACTIVITY = {
  id: 'act-run',
  name: 'Running',
  categoryId: 'cat-cardio',
  icon: '🏃',
  trackingType: 'time',
  createdAt: `${keyDaysAgo(120)}T00:00:00.000`,
};

/** A sets-and-reps activity. */
export const STRENGTH_ACTIVITY = {
  id: 'act-bench',
  name: 'Bench Press',
  categoryId: 'cat-strength',
  icon: '🏋️',
  trackingType: 'sets-reps',
  muscleGroup: 'Chest',
  createdAt: `${keyDaysAgo(120)}T00:00:00.000`,
};
