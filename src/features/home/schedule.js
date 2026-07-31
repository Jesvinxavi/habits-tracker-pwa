/* -------------------------------------------------------------------------- */
/*  features/home/schedule.js                                                 */
/* -------------------------------------------------------------------------- */
// Core date-schedule utilities used by the Home screen and other UI layers.
// Pure functions only – no DOM operations.

import {
  weeksBetween,
  getISOWeekNumber,
  getISOWeekYear,
  dateFromStoredValue,
} from '../../shared/datetime.js';
import { ScheduleEngine } from '../../shared/ScheduleEngine.js';

/**
 * Return the first date that should be treated as this habit's "anchor" – the
 * reference point from which week / month / year intervals are calculated.
 * – If the habit explicitly stores a `createdAt` or `anchorDate`, that is used.
 * – Otherwise we try to extract the unix-ms timestamp prefix that `generateUniqueId()`
 *   stores at the beginning of the habit.id string.
 * – As a final fallback we return the Unix epoch so that maths still work.
 *
 * @param {object} habit
 * @returns {Date}
 */
function getAnchorDate(habit) {
  if (habit.anchorDate) {
    const d = new Date(habit.anchorDate);
    if (!isNaN(d)) return d;
  }

  if (habit.createdAt) {
    const d = new Date(habit.createdAt);
    if (!isNaN(d)) return d;
  }

  // Heuristic: id generated via generateUniqueId() – first 13 chars are Date.now()
  if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) return new Date(ts);
  }

  return new Date(0); // epoch fallback – keeps maths deterministic
}

// The derived start date depends only on fields that cannot change without the
// habit object being replaced, because state updates are immutable. Object
// identity is therefore a complete invalidation key, and this memo turns a
// per-call scan of every completion entry into a single scan per habit version.
// That scan sat inside every scheduling check, which is what made the Stats
// page quadratic in history length.
const startDateCache = new WeakMap();

/**
 * Derives the earliest date a habit can meaningfully be evaluated from.
 *
 * Preference order is explicit creation date, then the timestamp prefix legacy
 * ids carry, then the earliest date the habit has any recorded evidence for.
 * @param {object} habit The habit.
 * @returns {Date|null} Local midnight start date, or null when nothing is known.
 */
export function getEarliestStartDate(habit) {
  if (!habit || typeof habit !== 'object') return null;
  if (startDateCache.has(habit)) return startDateCache.get(habit);

  let earliest = null;
  const consider = (value) => {
    const parsed = dateFromStoredValue(value);
    if (!parsed) return;
    const local = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    if (earliest === null || local < earliest) earliest = local;
  };

  consider(habit.createdAt);

  if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const timestamp = Number.parseInt(habit.id.slice(0, 13), 10);
    if (Number.isFinite(timestamp)) consider(new Date(timestamp));
  }

  if (habit.completed && typeof habit.completed === 'object') {
    for (const key of Object.keys(habit.completed)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) consider(key);
    }
  }
  if (Array.isArray(habit.skippedDates)) {
    for (const key of habit.skippedDates) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) consider(key);
    }
  }

  startDateCache.set(habit, earliest);
  return earliest;
}

/**
 * Reports the local midnight from which a lifecycle stamp takes effect.
 * @param {unknown} stamp Epoch millis or an ISO string.
 * @returns {Date|null} Local midnight, or null when absent or unparsable.
 */
function lifecycleCutoff(stamp) {
  if (stamp == null) return null;
  const parsed = stamp instanceof Date ? stamp : new Date(stamp);
  if (Number.isNaN(parsed.valueOf())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Reports whether a habit is due on a date.
 *
 * @param {object} habit The habit.
 * @param {Date|string} date The date to test.
 * @param {object} [options] Evaluation options.
 * @param {boolean} [options.ignorePause] Evaluate as though the habit were not
 *   paused. Statistics pass this so a pause stops the record advancing without
 *   retroactively erasing the days already earned; everyday surfaces do not, so
 *   a paused habit still disappears from today's list.
 * @returns {boolean} True when the habit is due.
 */
export function isHabitScheduledOnDate(habit, date, options = {}) {
  // First check if the date is before the habit was created
  const checkDate = new Date(date);
  if (isNaN(checkDate)) return false;

  const normalizedCheck = new Date(
    checkDate.getFullYear(),
    checkDate.getMonth(),
    checkDate.getDate()
  );

  // Archived habits remain available for historical dates but stop appearing
  // from the local calendar day on which they were removed.
  const archivedFrom = lifecycleCutoff(habit?.archivedAt);
  if (archivedFrom && normalizedCheck >= archivedFrom) return false;

  // A pause is the same shape of event: everything up to it stands, nothing
  // after it accrues. Habits paused before this was recorded have no stamp, so
  // their history stays whole and only the live pause flag hides them.
  const pausedFrom = lifecycleCutoff(habit?.pausedAt);
  if (habit?.paused && pausedFrom && normalizedCheck >= pausedFrom) return false;

  // Compute effective creation/start date as the earliest available evidence
  const creationDate = getEarliestStartDate(habit);

  // If we have a valid creation date, check if the requested date is before it
  // Period-aware guard: reject only when the ENTIRE period precedes habit creation.
  if (creationDate && !isNaN(creationDate)) {
    // Normalise to local-midnight for consistent comparisons
    const normalizedCreationDate = creationDate;
    const normalizedCheckDate = normalizedCheck;

    // Determine effective frequency (targetFrequency takes precedence)
    const freqRaw = habit.targetFrequency || habit.frequency || 'daily';
    const freq = typeof freqRaw === 'string' ? freqRaw.toLowerCase() : freqRaw;

    let periodPrecedesCreation = false;
    switch (freq) {
      case 'weekly':
      case 'biweekly':
        // Reject when the check week is *earlier* than the creation week
        periodPrecedesCreation = weeksBetween(normalizedCheckDate, normalizedCreationDate) > 0;
        break;
      case 'monthly':
        periodPrecedesCreation =
          normalizedCheckDate.getFullYear() < normalizedCreationDate.getFullYear() ||
          (normalizedCheckDate.getFullYear() === normalizedCreationDate.getFullYear() &&
            normalizedCheckDate.getMonth() < normalizedCreationDate.getMonth());
        break;
      case 'yearly':
        periodPrecedesCreation = normalizedCheckDate.getFullYear() < normalizedCreationDate.getFullYear();
        break;
      case 'daily':
      default:
        periodPrecedesCreation = normalizedCheckDate < normalizedCreationDate;
    }

    if (periodPrecedesCreation) return false;
  }

  // Proceed with normal scheduling logic
  return ScheduleEngine.isDue(habit, date, options);
}

export function belongsToSelectedGroup(habit, group) {
  // Determine whether habit is a target-based habit (completion goal) or purely schedule-based.
  const isTarget = typeof habit.target === 'number' && habit.target > 0;

  // Normalise frequency strings to lowercase for robust matching
  const rawTargetFreq = habit.targetFrequency || habit.frequency || 'daily';
  const tgtFreq = typeof rawTargetFreq === 'string' ? rawTargetFreq.toLowerCase() : rawTargetFreq;

  const rawFreq = habit.frequency || habit.targetFrequency || 'daily';
  const freq = typeof rawFreq === 'string' ? rawFreq.toLowerCase() : rawFreq;

  if (group === 'daily') {
    // All schedule-only habits except yearly belong here.
    if (!isTarget) return ['daily', 'weekly', 'biweekly', 'monthly'].includes(freq);
    // Target-based habits that are explicitly daily.
    return tgtFreq === 'daily';
  }

  if (group === 'weekly') {
    // Weekly group when:
    //  • Target-based habits whose targetFrequency is weekly or biweekly
    if (isTarget) return tgtFreq === 'weekly' || tgtFreq === 'biweekly';
    return false; // Weekly scheduled habits (non-target) belong in daily group only
  }

  if (group === 'monthly') {
    // 1) Monthly target habits.
    // 2) Yearly scheduled habits (no target).
    if (isTarget) return tgtFreq === 'monthly';
    return freq === 'yearly';
  }

  if (group === 'yearly') {
    return isTarget && tgtFreq === 'yearly';
  }

  return false;
}

export function getPeriodKey(habit, dateObj) {
  const d = new Date(dateObj);

  // Distinguish between target-based habits (which aggregate progress over a
  // period) and schedule-only habits (which should track completion for the
  // exact calendar day the action happened).
  const isTarget = typeof habit.target === 'number' && habit.target > 0;
  const freq = habit.targetFrequency || habit.frequency || 'daily';

  /* --------------------------------------------------------------------- */
  /*  SCHEDULE-ONLY HABITS  →  ALWAYS USE EXACT CALENDAR DATE KEY          */
  /* --------------------------------------------------------------------- */
  if (!isTarget) {
    // Example output: 2025-07-06
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /* --------------------------------------------------------------------- */
  /*  TARGET-BASED HABITS  – retain original period semantics              */
  /* --------------------------------------------------------------------- */

  if (freq === 'daily') {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`; // e.g. 2025-06-17
  }
  if (freq === 'weekly') {
    // Paired with the ISO week-**year**, not the calendar year: the week
    // straddling New Year would otherwise split into two keys, so a habit
    // completed on 31 December read as untouched on 1 January.
    const week = getISOWeekNumber(d);
    return `${getISOWeekYear(d)}-W${week}`;
  }
  if (freq === 'monthly') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  }
  if (freq === 'yearly') {
    return `${d.getFullYear()}`;
  }
  if (freq === 'biweekly') {
    // Determine bi-weekly period relative to the habit's anchor week.
    const anchor = getAnchorDate(habit);
    const weekDiff = weeksBetween(anchor, d);
    const periodStart = new Date(anchor);
    periodStart.setDate(anchor.getDate() + Math.floor(weekDiff / 2) * 14);
    const week = getISOWeekNumber(periodStart);
    return `${periodStart.getFullYear()}-BW${week}`; // e.g. 2025-BW34
  }

  // Fallback – default to calendar date.
  return d.toISOString().slice(0, 10);
}

// -------------------- Completion helpers --------------------
export function isHabitCompleted(habit, dateObj) {
  if (habit.completed === true) return true;
  if (typeof habit.completed !== 'object' || habit.completed === null) return false;
  const key = getPeriodKey(habit, dateObj);
  return habit.completed[key] === true;
}

/**
 * Return true when the given habit is explicitly skipped on the provided date.
 * Helper centralised here so UI layers can share one source-of-truth.
 * @param {object} habit
 * @param {Date|string} [date] – date object or ISO string (defaults to today)
 * @returns {boolean}
 */
export function isHabitSkippedToday(habit, date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const key = getPeriodKey(habit, d);
  return Array.isArray(habit.skippedDates) && habit.skippedDates.includes(key);
}
