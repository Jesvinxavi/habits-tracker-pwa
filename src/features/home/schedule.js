/* -------------------------------------------------------------------------- */
/*  features/home/schedule.js                                                 */
/* -------------------------------------------------------------------------- */
// Core date-schedule utilities used by the Home screen and other UI layers.
// Pure functions only – no DOM operations.

import {
  weeksBetween,
  getISOWeekNumber,
  dateToKey,
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

export function isHabitScheduledOnDate(habit, date) {
  // First check if the date is before the habit was created
  const checkDate = new Date(date);
  if (isNaN(checkDate)) return false;

  // Extract creation date from habit
  let creationDate = null;
  
  // Try to get creation date from createdAt field
  if (habit.createdAt) {
    creationDate = new Date(habit.createdAt);
  } 
  // Fallback: extract from habit ID (timestamp + random string)
  else if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) {
      creationDate = new Date(ts);
    }
  }

  // If we have a valid creation date, check if the requested date is before it
  // Period-aware guard: reject only when the ENTIRE period precedes habit creation.
  if (creationDate && !isNaN(creationDate)) {
    // Normalise to local-midnight for consistent comparisons
    const normalizedCreationDate = new Date(creationDate);
    normalizedCreationDate.setHours(0, 0, 0, 0);
    
    const normalizedCheckDate = new Date(checkDate);
    normalizedCheckDate.setHours(0, 0, 0, 0);
    
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
  return ScheduleEngine.isDue(habit, date);
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
    const week = getISOWeekNumber(d);
    return `${d.getFullYear()}-W${week}`;
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

export function setHabitCompleted(habit, dateObj, val) {
  const key = getPeriodKey(habit, dateObj);
  if (typeof habit.completed !== 'object' || habit.completed === null) habit.completed = {};
  habit.completed[key] = val;
}

export function toggleHabitCompleted(habit, dateObj) {
  const cur = isHabitCompleted(habit, dateObj);
  setHabitCompleted(habit, dateObj, !cur);
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
  const key = dateToKey(d);
  return Array.isArray(habit.skippedDates) && habit.skippedDates.includes(key);
}




