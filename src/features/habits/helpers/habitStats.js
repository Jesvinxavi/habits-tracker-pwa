/**
 * Habit Statistics Helper Functions
 *
 * Pure functions for calculating habit statistics and analytics
 * Extracted from HabitsListModule.js for better modularity
 */

import { getState } from '../../../core/state.js';
import {
  isHabitCompleted,
  isHabitScheduledOnDate,
  isHabitSkippedToday,
} from '../../home/schedule.js';

// Group derivation based on habit definition
function getHabitGroup(habit) {
  const isTarget = typeof habit.target === 'number' && habit.target > 0;
  const raw = (habit.targetFrequency || habit.frequency || 'daily').toLowerCase();
  if (raw === 'daily') return 'daily';
  if (raw === 'weekly' || raw === 'biweekly') return 'weekly';
  if (raw === 'monthly') return 'monthly';
  if (raw === 'yearly') return 'yearly';
  return isTarget ? 'daily' : 'daily';
}

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfWeek(weekStart) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
function startOfMonth(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfMonth(d) {
  const date = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return date;
}
function startOfYear(d) {
  const date = new Date(d.getFullYear(), 0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfYear(d) {
  const date = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
  return date;
}

function forEachDayInRange(start, end, cb) {
  const cur = new Date(start);
  while (cur <= end) {
    cb(cur);
    cur.setDate(cur.getDate() + 1);
  }
}

function periodScheduledInRange(habit, start, end, creationDate) {
  let scheduled = false;
  forEachDayInRange(start, end, (d) => {
    if (!scheduled && d >= creationDate && isHabitScheduledOnDate(habit, d)) scheduled = true;
  });
  return scheduled;
}
function periodCompletedInRange(habit, start, end, creationDate) {
  let completed = false;
  forEachDayInRange(start, end, (d) => {
    if (!completed && d >= creationDate && isHabitCompleted(habit, d)) completed = true;
  });
  return completed;
}

function countWeeksSinceCreation(creationDate, today) {
  const w0 = startOfWeek(creationDate);
  const wT = startOfWeek(today);
  const diffMs = wT - w0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)) + 1;
}
function countMonthsSinceCreation(creationDate, today) {
  return (
    (today.getFullYear() - creationDate.getFullYear()) * 12 +
    (today.getMonth() - creationDate.getMonth()) +
    1
  );
}
function countYearsSinceCreation(creationDate, today) {
  return today.getFullYear() - creationDate.getFullYear() + 1;
}

function calculateWeeklyCompletionRate(habit, weeks, creationDate) {
  const today = new Date();
  const weeksToCheck = Math.min(weeks, countWeeksSinceCreation(creationDate, today));
  let scheduled = 0;
  let completed = 0;
  for (let i = 0; i < weeksToCheck; i++) {
    const ws = startOfWeek(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 7));
    const we = endOfWeek(ws);
    const hasSched = periodScheduledInRange(habit, ws, we, creationDate);
    if (hasSched) {
      scheduled++;
      if (periodCompletedInRange(habit, ws, we, creationDate)) completed++;
    }
  }
  return scheduled > 0 ? (completed / scheduled) * 100 : 0;
}

function calculateMonthlyCompletionRate(habit, months, creationDate) {
  const today = new Date();
  const monthsToCheck = Math.min(months, countMonthsSinceCreation(creationDate, today));
  let scheduled = 0;
  let completed = 0;
  let cursor = new Date(today);
  cursor.setDate(1);
  for (let i = 0; i < monthsToCheck; i++) {
    const ms = startOfMonth(cursor);
    const me = endOfMonth(cursor);
    const hasSched = periodScheduledInRange(habit, ms, me, creationDate);
    if (hasSched) {
      scheduled++;
      if (periodCompletedInRange(habit, ms, me, creationDate)) completed++;
    }
    // move to previous month
    cursor = new Date(ms);
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return scheduled > 0 ? (completed / scheduled) * 100 : 0;
}

function calculateYearlyCompletionRate(habit, years, creationDate) {
  const today = new Date();
  const yearsToCheck = Math.min(years, countYearsSinceCreation(creationDate, today));
  let scheduled = 0;
  let completed = 0;
  for (let i = 0; i < yearsToCheck; i++) {
    const y = today.getFullYear() - i;
    const ys = startOfYear(new Date(y, 0, 1));
    const ye = endOfYear(new Date(y, 0, 1));
    const hasSched = periodScheduledInRange(habit, ys, ye, creationDate);
    if (hasSched) {
      scheduled++;
      if (periodCompletedInRange(habit, ys, ye, creationDate)) completed++;
    }
  }
  return scheduled > 0 ? (completed / scheduled) * 100 : 0;
}

function calculateWeeklyStreaks(habit, creationDate) {
  const today = new Date();
  let longest = 0;
  let current = 0;
  const totalWeeks = Math.min(260, countWeeksSinceCreation(creationDate, today));
  for (let i = totalWeeks - 1; i >= 0; i--) {
    const ws = startOfWeek(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 7));
    const we = endOfWeek(ws);
    const hasSched = periodScheduledInRange(habit, ws, we, creationDate);
    if (!hasSched) continue; // skip non-active weeks
    const done = periodCompletedInRange(habit, ws, we, creationDate);
    if (done) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return { current, longest };
}

function calculateMonthlyStreaks(habit, creationDate) {
  const today = new Date();
  let longest = 0;
  let current = 0;
  const totalMonths = Math.min(120, countMonthsSinceCreation(creationDate, today));
  let cursor = new Date(today);
  cursor.setDate(1);
  for (let i = totalMonths - 1; i >= 0; i--) {
    const ms = startOfMonth(cursor);
    const me = endOfMonth(cursor);
    const hasSched = periodScheduledInRange(habit, ms, me, creationDate);
    if (!hasSched) {
      cursor.setMonth(cursor.getMonth() - 1);
      continue;
    }
    const done = periodCompletedInRange(habit, ms, me, creationDate);
    if (done) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return { current, longest };
}

function calculateYearlyStreaks(habit, creationDate) {
  const today = new Date();
  let longest = 0;
  let current = 0;
  const totalYears = Math.min(20, countYearsSinceCreation(creationDate, today));
  for (let i = totalYears - 1; i >= 0; i--) {
    const y = today.getFullYear() - i;
    const ys = startOfYear(new Date(y, 0, 1));
    const ye = endOfYear(new Date(y, 0, 1));
    const hasSched = periodScheduledInRange(habit, ys, ye, creationDate);
    if (!hasSched) continue;
    const done = periodCompletedInRange(habit, ys, ye, creationDate);
    if (done) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return { current, longest };
}

/**
 * Try to determine the earliest meaningful date for this habit.
 * Preference order: createdAt -> id timestamp -> earliest date present in completed/skipped data.
 * Falls back to today if nothing can be derived.
 * @param {Object} habit
 * @returns {Date}
 */
function getHabitStartDate(habit) {
  // 1) createdAt
  if (habit?.createdAt) {
    const d = new Date(habit.createdAt);
    if (!isNaN(d)) return d;
  }

  // 2) id timestamp prefix
  if (typeof habit?.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) return new Date(ts);
  }

  // 3) earliest date from habit data (completed keys or skippedDates)
  let earliest = null;

  // completed keys: expect YYYY-MM-DD for daily keys; ignore non-daily formats
  if (habit && typeof habit.completed === 'object' && habit.completed !== null) {
    for (const key of Object.keys(habit.completed)) {
      // Only parse YYYY-MM-DD keys
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        const d = new Date(key);
        if (!isNaN(d) && (earliest === null || d < earliest)) earliest = d;
      }
    }
  }

  // skippedDates are expected to be YYYY-MM-DD
  if (Array.isArray(habit?.skippedDates)) {
    for (const key of habit.skippedDates) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        const d = new Date(key);
        if (!isNaN(d) && (earliest === null || d < earliest)) earliest = d;
      }
    }
  }

  return earliest || new Date();
}

/**
 * Calculate statistics for a specific habit
 */
export function calculateHabitStatistics(habitId) {
  const habit = getState().habits.find((h) => h.id === habitId);
  if (!habit) return null;

  const group = getHabitGroup(habit);
  const today = new Date();
  const stats = {
    group,
    totalCompletions: 0,
    currentStreak: 0,
    longestStreak: 0,
    completionRate7d: 0, // repurposed per group (e.g. 4w/3m)
    completionRate30d: 0, // repurposed per group (e.g. 12w/12m)
    completionRateTotal: 0,
    recentActivity: 0,
    lastCompleted: null,
    targetProgress: null,
    weeklyAverage: 0, // for daily this is completions per week; for others it's per corresponding period
    daysTracked: 0, // repurposed per group as periods tracked
    trackedUnitLabel: 'Days Tracked',
    totalSkipped: 0,
    skippedPercentage: 0,
  };

  // Determine creation date
  let creationDate = getHabitStartDate(habit);

  // Compute depending on group
  if (group === 'daily') {
    // Days tracked based on wall-clock days since creation
    const daysSinceCreation = Math.max(
      1,
      Math.floor((today - creationDate) / (1000 * 60 * 60 * 24)) + 1
    );
    stats.daysTracked = daysSinceCreation;
    stats.trackedUnitLabel = 'Days Tracked';

    // Completion rates
    stats.completionRate7d = calculateHabitCompletionRate(habit, 7);
    stats.completionRate30d = calculateHabitCompletionRate(habit, 30);
    stats.completionRateTotal = calculateHabitCompletionRate(habit, daysSinceCreation);

    // Streaks (existing daily)
    stats.currentStreak = calculateCurrentStreak(habit);
    stats.longestStreak = calculateLongestStreak(habit);

    // Recent activity (last 30 days)
    let recentCompletions = 0;
    for (let i = 0; i < Math.min(30, daysSinceCreation); i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      if (date < creationDate) continue;
      if (isHabitScheduledOnDate(habit, date) && isHabitCompleted(habit, date)) {
        recentCompletions++;
        if (!stats.lastCompleted || date > new Date(stats.lastCompleted)) {
          stats.lastCompleted = date.toISOString();
        }
      }
    }
    stats.recentActivity = recentCompletions;

    // Total completions & skips (per scheduled day)
    let totalSkipped = 0;
    for (let i = 0; i < daysSinceCreation; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      if (date < creationDate) continue;
      if (isHabitScheduledOnDate(habit, date)) {
        if (isHabitCompleted(habit, date)) {
          stats.totalCompletions++;
        } else if (isHabitSkippedToday(habit, date)) {
          totalSkipped++;
        }
      }
    }
    stats.totalSkipped = totalSkipped;

    const totalActions = stats.totalCompletions + stats.totalSkipped;
    stats.skippedPercentage = totalActions > 0 ? (stats.totalSkipped / totalActions) * 100 : 0;

    // Weekly average
    const weeksSinceCreation = stats.daysTracked / 7;
    stats.weeklyAverage = weeksSinceCreation > 0 ? stats.totalCompletions / weeksSinceCreation : 0;
  } else if (group === 'weekly') {
    const weeksSince = countWeeksSinceCreation(creationDate, today);
    stats.daysTracked = weeksSince;
    stats.trackedUnitLabel = 'Weeks Tracked';

    // Completion rates: 4w, 12w, total
    stats.completionRate7d = calculateWeeklyCompletionRate(habit, 4, creationDate);
    stats.completionRate30d = calculateWeeklyCompletionRate(habit, 12, creationDate);
    stats.completionRateTotal = calculateWeeklyCompletionRate(habit, weeksSince, creationDate);

    // Streaks
    const { current, longest } = calculateWeeklyStreaks(habit, creationDate);
    stats.currentStreak = current;
    stats.longestStreak = longest;

    // Recent activity: last 12 weeks
    let recent = 0;
    const checkWeeks = Math.min(12, weeksSince);
    for (let i = 0; i < checkWeeks; i++) {
      const ws = startOfWeek(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 7));
      const we = endOfWeek(ws);
      if (periodCompletedInRange(habit, ws, we, creationDate)) {
        recent++;
        // Capture a representative last completed date
        if (!stats.lastCompleted || we > new Date(stats.lastCompleted)) {
          stats.lastCompleted = we.toISOString();
        }
      }
    }
    stats.recentActivity = recent;

    // Total completions = number of completed weeks
    let completedWeeks = 0;
    for (let i = 0; i < weeksSince; i++) {
      const ws = startOfWeek(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 7));
      const we = endOfWeek(ws);
      if (periodScheduledInRange(habit, ws, we, creationDate) && periodCompletedInRange(habit, ws, we, creationDate)) {
        completedWeeks++;
      }
    }
    stats.totalCompletions = completedWeeks;

    // Weekly average (per week)
    stats.weeklyAverage = weeksSince > 0 ? completedWeeks / weeksSince : 0;
  } else if (group === 'monthly') {
    const monthsSince = countMonthsSinceCreation(creationDate, today);
    stats.daysTracked = monthsSince;
    stats.trackedUnitLabel = 'Months Tracked';

    // Completion rates: 3m, 12m, total
    stats.completionRate7d = calculateMonthlyCompletionRate(habit, 3, creationDate);
    stats.completionRate30d = calculateMonthlyCompletionRate(habit, 12, creationDate);
    stats.completionRateTotal = calculateMonthlyCompletionRate(habit, monthsSince, creationDate);

    // Streaks
    const { current, longest } = calculateMonthlyStreaks(habit, creationDate);
    stats.currentStreak = current;
    stats.longestStreak = longest;

    // Recent activity: last 6 months
    let recent = 0;
    let cursor = startOfMonth(today);
    for (let i = 0; i < Math.min(6, monthsSince); i++) {
      const ms = startOfMonth(cursor);
      const me = endOfMonth(cursor);
      if (periodCompletedInRange(habit, ms, me, creationDate)) {
        recent++;
        if (!stats.lastCompleted || me > new Date(stats.lastCompleted)) stats.lastCompleted = me.toISOString();
      }
      cursor.setMonth(cursor.getMonth() - 1);
    }
    stats.recentActivity = recent;

    // Total completions = number of completed months
    let completedMonths = 0;
    cursor = startOfMonth(today);
    for (let i = 0; i < monthsSince; i++) {
      const ms = startOfMonth(cursor);
      const me = endOfMonth(cursor);
      if (periodScheduledInRange(habit, ms, me, creationDate) && periodCompletedInRange(habit, ms, me, creationDate)) {
        completedMonths++;
      }
      cursor.setMonth(cursor.getMonth() - 1);
    }
    stats.totalCompletions = completedMonths;

    // Average per month
    stats.weeklyAverage = monthsSince > 0 ? completedMonths / monthsSince : 0;
  } else if (group === 'yearly') {
    const yearsSince = countYearsSinceCreation(creationDate, today);
    stats.daysTracked = yearsSince;
    stats.trackedUnitLabel = 'Years Tracked';

    // Completion rates: 3y window, 10y window, total
    stats.completionRate7d = calculateYearlyCompletionRate(habit, Math.min(3, yearsSince), creationDate);
    stats.completionRate30d = calculateYearlyCompletionRate(habit, Math.min(10, yearsSince), creationDate);
    stats.completionRateTotal = calculateYearlyCompletionRate(habit, yearsSince, creationDate);

    // Streaks
    const { current, longest } = calculateYearlyStreaks(habit, creationDate);
    stats.currentStreak = current;
    stats.longestStreak = longest;

    // Recent activity: last 3 years
    let recent = 0;
    for (let i = 0; i < Math.min(3, yearsSince); i++) {
      const y = today.getFullYear() - i;
      const ys = startOfYear(new Date(y, 0, 1));
      const ye = endOfYear(new Date(y, 0, 1));
      if (periodCompletedInRange(habit, ys, ye, creationDate)) {
        recent++;
        if (!stats.lastCompleted || ye > new Date(stats.lastCompleted)) stats.lastCompleted = ye.toISOString();
      }
    }
    stats.recentActivity = recent;

    // Total completions = number of completed years
    let completedYears = 0;
    for (let i = 0; i < yearsSince; i++) {
      const y = today.getFullYear() - i;
      const ys = startOfYear(new Date(y, 0, 1));
      const ye = endOfYear(new Date(y, 0, 1));
      if (periodScheduledInRange(habit, ys, ye, creationDate) && periodCompletedInRange(habit, ys, ye, creationDate)) {
        completedYears++;
      }
    }
    stats.totalCompletions = completedYears;

    // Average per year
    stats.weeklyAverage = yearsSince > 0 ? completedYears / yearsSince : 0;
  }

  return stats;
}

/**
 * Calculate completion rate for a specific habit over the last N days
 * @param {Object} habit - The habit object
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {number} Completion rate as a percentage
 */
export function calculateHabitCompletionRate(habit, days = 30) {
  const today = new Date();
  let completed = 0;
  let scheduled = 0;
  let creationDate = getHabitStartDate(habit);

  const daysToCheck = Math.min(
    days,
    Math.floor((today - creationDate) / (1000 * 60 * 60 * 24)) + 1
  );

  for (let i = 0; i < daysToCheck; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    if (date < creationDate) continue;

    if (isHabitScheduledOnDate(habit, date)) {
      scheduled++;
      if (isHabitCompleted(habit, date)) {
        completed++;
      }
    }
  }

  return scheduled > 0 ? (completed / scheduled) * 100 : 0;
}

/**
 * Calculate rolling-average completion for a habit over the last `windowDays` considering:
 * - Always includes the current day if it is on/after creation date
 * - Fills the remainder with the most recent past days that were completed
 * - Stops once it has `windowDays` days or reaches creation boundary
 * - Denominator is the count of selected days (today + completed past days)
 * - Numerator is count of selected days that are completed
 *
 * If there are zero selected days, returns 0.
 *
 * @param {Object} habit
 * @param {number} windowDays
 * @returns {number}
 */
export function calculateRollingCompletionRate(habit, windowDays) {
  const today = new Date();
  // Determine creation date (using broader heuristics)
  let creationDate = getHabitStartDate(habit);

  const includeToday = today >= creationDate && isHabitScheduledOnDate(habit, today);

  // Count number of past COMPLETED days (before today)
  let completedBeforeToday = 0;
  const maxLookbackDays = Math.floor((today - creationDate) / (1000 * 60 * 60 * 24));
  for (let i = 1; i <= maxLookbackDays; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    if (date < creationDate) break;
    if (isHabitCompleted(habit, date)) completedBeforeToday++;
  }

  // If we have enough completed days to fill the window (with today if scheduled), switch to standard last-N-days calc
  if ((includeToday ? 1 : 0) + completedBeforeToday >= windowDays) {
    return calculateHabitCompletionRate(habit, windowDays);
  }

  // Otherwise, build set: today (if scheduled) + most recent COMPLETED past days until we reach windowDays
  const selectedDates = [];
  if (includeToday) selectedDates.push(new Date(today));

  for (let i = 1; i <= maxLookbackDays && selectedDates.length < windowDays; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    if (date < creationDate) break;
    if (isHabitCompleted(habit, date)) selectedDates.push(date);
  }

  const denominator = selectedDates.length;
  if (denominator === 0) return 0;

  let completedCount = 0;
  for (const date of selectedDates) {
    if (isHabitCompleted(habit, date)) completedCount++;
  }

  return (completedCount / denominator) * 100;
}

/**
 * Calculate current streak for a habit
 * @param {Object} habit - The habit object
 * @returns {number} Current streak count
 */
export function calculateCurrentStreak(habit) {
  const today = new Date();
  let streak = 0;
  let date = new Date(today);
  let creationDate = getHabitStartDate(habit);

  while (date >= creationDate) {
    if (isHabitScheduledOnDate(habit, date)) {
      if (isHabitCompleted(habit, date)) {
        streak++;
      } else {
        break;
      }
    }
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

/**
 * Calculate longest streak for a habit
 * @param {Object} habit - The habit object
 * @returns {number} Longest streak count
 */
export function calculateLongestStreak(habit) {
  const today = new Date();
  let longestStreak = 0;
  let currentStreak = 0;
  let date = new Date(today);
  let creationDate = getHabitStartDate(habit);

  while (date >= creationDate) {
    if (isHabitScheduledOnDate(habit, date)) {
      if (isHabitCompleted(habit, date)) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    date.setDate(date.getDate() - 1);
  }

  return longestStreak;
} 