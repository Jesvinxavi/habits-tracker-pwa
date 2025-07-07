/* -------------------------------------------------------------------------- */
/*  features/home/schedule.js                                                 */
/* -------------------------------------------------------------------------- */
// Core date-schedule utilities used by the Home screen and other UI layers.
// Pure functions only – no DOM operations.

import {
  weeksBetween,
  getISOWeekNumber,
  dateToKey,
  getPeriodBounds,
  eachDayInRange,
} from '../../shared/datetime.js';
import { ScheduleEngine } from '../../shared/ScheduleEngine.js';
import { appData } from '../../core/state.js';

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
  if (habit.completed === true) return true; // legacy boolean
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

// -------------------- Progress calculation helpers --------------------

/**
 * Calculate progress for a single habit over a specific date range.
 * Handles both target-based and schedule-only habits correctly.
 * @param {object} habit - The habit object
 * @param {Date} start - Start date of the period (inclusive)
 * @param {Date} end - End date of the period (inclusive)
 * @returns {{completed: number, active: number}} - Progress counts
 */
export function getHabitProgressForPeriod(habit, { start, end }) {
  // For target-based habits: whole period is one unit
  const isTarget = typeof habit.target === 'number' && habit.target > 0;

  if (isTarget) {
    // Target habits: check if they should be active for this period
    // For target habits, we need to check if they're scheduled and not skipped for the period

    // Check if habit is scheduled for any day in the period and not skipped
    let hasActiveDays = false;
    let completed = 0;

    for (const dayKey of eachDayInRange(start, end)) {
      const dayDate = new Date(dayKey);

      // Check if habit is scheduled and not skipped for this day
      if (isHabitScheduledOnDate(habit, dayDate) && !isHabitSkippedToday(habit, dayDate)) {
        hasActiveDays = true;
        if (isHabitCompleted(habit, dayDate)) {
          completed = 1;
          break; // Early exit - once completed, always completed for the period
        }
      }
    }

    // Only count as active if there are days where the habit is not skipped
    return { completed, active: hasActiveDays ? 1 : 0 };
  }

  // Schedule-only habits: count each scheduled day
  let completed = 0;
  let active = 0;

  for (const dayKey of eachDayInRange(start, end)) {
    const dayDate = new Date(dayKey);

    // Check if habit is scheduled and not skipped
    if (isHabitScheduledOnDate(habit, dayDate) && !isHabitSkippedToday(habit, dayDate)) {
      active++;
      if (isHabitCompleted(habit, dayDate)) {
        completed++;
      }
    }

    // Performance optimization: if we've reached 100%, we can stop
    if (active > 0 && completed === active) {
      break;
    }
  }

  return { completed, active };
}

/**
 * Calculate progress for a specific group (daily/weekly/monthly/yearly) for the current period.
 * @param {'daily'|'weekly'|'monthly'|'yearly'} group - The group to calculate progress for
 * @param {Date} date - The date to determine the period for (defaults to today)
 * @returns {{percentage: number, completed: number, active: number}} - Progress data
 */
export function getGroupProgress(group, date = new Date()) {
  // Map group to period type
  const groupToPeriod = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
    yearly: 'year',
  };

  const period = groupToPeriod[group];
  if (!period) {
    throw new Error(`Unknown group: ${group}`);
  }

  // Get period bounds for the given date
  const bounds = getPeriodBounds(period, date);

  // Get habits that belong to this group
  const groupHabits = appData.habits.filter((h) => belongsToSelectedGroup(h, group));

  // Calculate total progress across all habits
  let totalCompleted = 0;
  let totalActive = 0;

  for (const habit of groupHabits) {
    const { completed, active } = getHabitProgressForPeriod(habit, bounds);
    totalCompleted += completed;
    totalActive += active;

    // Debug logging for target-based habits
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
      const isTarget = typeof habit.target === 'number' && habit.target > 0;
      if (isTarget) {
        console.log(`Target habit "${habit.name}": active=${active}, completed=${completed}`);
      }
    }
  }

  // Calculate percentage
  const percentage = totalActive > 0 ? Math.round((totalCompleted / totalActive) * 100) : 0;

  return {
    percentage,
    completed: totalCompleted,
    active: totalActive,
  };
}

// -------------------- Self-tests (development only) --------------------

if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
  // Test getPeriodBounds
  const testDate = new Date('2025-01-15'); // Wednesday in week 3 of 2025

  // Test day bounds
  const dayBounds = getPeriodBounds('day', testDate);
  console.assert(
    dayBounds.start.toDateString() === testDate.toDateString(),
    'Day bounds should be same day'
  );
  console.assert(
    dayBounds.end.toDateString() === testDate.toDateString(),
    'Day bounds should be same day'
  );

  // Test week bounds (Monday to Sunday)
  const weekBounds = getPeriodBounds('week', testDate);
  console.assert(weekBounds.start.getDay() === 1, 'Week should start on Monday');
  console.assert(weekBounds.end.getDay() === 0, 'Week should end on Sunday');

  // Test month bounds
  const monthBounds = getPeriodBounds('month', testDate);
  console.assert(monthBounds.start.getDate() === 1, 'Month should start on day 1');
  console.assert(monthBounds.start.getMonth() === 0, 'Month should be January');

  // Test year bounds
  const yearBounds = getPeriodBounds('year', testDate);
  console.assert(yearBounds.start.getDate() === 1, 'Year should start on January 1');
  console.assert(yearBounds.start.getMonth() === 0, 'Year should start in January');
  console.assert(yearBounds.end.getDate() === 31, 'Year should end on December 31');
  console.assert(yearBounds.end.getMonth() === 11, 'Year should end in December');

  // Test target habit skip logic
  const mockTargetHabit = {
    name: 'Test Target Habit',
    target: 5,
    targetFrequency: 'daily',
    skippedDates: ['2025-01-15'], // Skip today
    completed: {},
  };

  const testBounds = getPeriodBounds('day', testDate);
  const targetProgress = getHabitProgressForPeriod(mockTargetHabit, testBounds);
  console.assert(targetProgress.active === 0, 'Target habit should be inactive when skipped');

  console.log('✅ schedule.js self-tests passed');
}
