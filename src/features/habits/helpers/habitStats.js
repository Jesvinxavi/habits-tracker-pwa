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
 * @param {string} habitId - The ID of the habit
 * @returns {Object|null} Statistics object or null if habit not found
 */
export function calculateHabitStatistics(habitId) {
  const habit = getState().habits.find((h) => h.id === habitId);
  if (!habit) return null;

  const today = new Date();
  const stats = {
    totalCompletions: 0,
    currentStreak: 0,
    longestStreak: 0,
    completionRate7d: 0,
    completionRate30d: 0,
    completionRateTotal: 0,
    recentActivity: 0,
    lastCompleted: null,
    targetProgress: null,
    weeklyAverage: 0,
    daysTracked: 0,
    totalSkipped: 0,
    skippedPercentage: 0,
  };

  // Extract creation date from habit ID (timestamp + random string)
  let creationDate = getHabitStartDate(habit);

  // Calculate how many days the habit has existed (ensure it's at least 1)
  const daysSinceCreation = Math.max(
    1,
    Math.floor((today - creationDate) / (1000 * 60 * 60 * 24)) + 1
  );
  stats.daysTracked = daysSinceCreation;

  // Calculate completion rates for different periods
  stats.completionRate7d = calculateRollingCompletionRate(habit, 7);
  stats.completionRate30d = calculateRollingCompletionRate(habit, 30);
  stats.completionRateTotal = calculateHabitCompletionRate(habit, daysSinceCreation);

  // Calculate streaks
  stats.currentStreak = calculateCurrentStreak(habit);
  stats.longestStreak = calculateLongestStreak(habit);

  // Calculate recent activity (last 30 days)
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

  // Calculate total completions and skips
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

  // Calculate skipped percentage against completions
  const totalActions = stats.totalCompletions + stats.totalSkipped;
  stats.skippedPercentage = totalActions > 0 ? (stats.totalSkipped / totalActions) * 100 : 0;

  // Calculate weekly average
  const weeksSinceCreation = daysSinceCreation / 7;
  stats.weeklyAverage = weeksSinceCreation > 0 ? stats.totalCompletions / weeksSinceCreation : 0;

  // Calculate target progress (for target-based habits)
  if (habit.target && typeof habit.target === 'number') {
    const targetFrequency = habit.targetFrequency || habit.frequency || 'daily';
    const completedToday = isHabitCompleted(habit, today);

    if (targetFrequency === 'daily') {
      stats.targetProgress = {
        completed: completedToday ? 1 : 0,
        target: habit.target,
        unit: habit.targetUnit || '',
        isComplete: completedToday,
      };
    }
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