// src/selectors/progress.js

import { getState } from '../core/state.js';
import { eachDayInRange, getPeriodBounds } from '../shared/datetime.js';

// Re-use existing helpers from schedule.js to avoid duplication
import {
  isHabitScheduledOnDate,
  isHabitSkippedToday,
  isHabitCompleted,
  belongsToSelectedGroup,
} from '../features/home/schedule.js';

// Simple memoization cache for progress calculation
let _progressCache = {
  selectedDate: null,
  selectedGroup: null,
  habitsHash: null,
  result: null
};

/**
 * Calculate progress for a single habit over a specific date range.
 * Returns count of completed units and total active units.
 *
 * @param {object} habit - Habit object
 * @param {{start:Date,end:Date}} period - Inclusive date range
 * @returns {{completed:number, active:number}}
 */
export function getHabitProgressForPeriod(habit, { start, end }) {
  const isTarget = typeof habit.target === 'number' && habit.target > 0;

  if (isTarget) {
    let hasActiveDays = false;
    let completed = 0;
    for (const dayKey of eachDayInRange(start, end)) {
      const dayDate = new Date(dayKey);
      if (isHabitScheduledOnDate(habit, dayDate) && !isHabitSkippedToday(habit, dayDate)) {
        hasActiveDays = true;
        if (isHabitCompleted(habit, dayDate)) {
          completed = 1;
          break;
        }
      }
    }
    return { completed, active: hasActiveDays ? 1 : 0 };
  }

  let completed = 0;
  let active = 0;
  for (const dayKey of eachDayInRange(start, end)) {
    const dayDate = new Date(dayKey);
    if (isHabitScheduledOnDate(habit, dayDate) && !isHabitSkippedToday(habit, dayDate)) {
      active++;
      if (isHabitCompleted(habit, dayDate)) completed++;
      if (active > 0 && completed === active) break; // 100%
    }
  }
  return { completed, active };
}

/**
 * Aggregate progress across all habits that belong to a selected group
 * (daily / weekly / monthly / yearly) for the current period containing `date`.
 *
 * @param {'daily'|'weekly'|'monthly'|'yearly'} group
 * @param {Date} [date=new Date()]
 * @returns {{percentage:number,completed:number,active:number}}
 */
export function getGroupProgress(group, date = new Date()) {
  const groupToPeriod = {
    daily: 'day',
    weekly: 'week',
    monthly: 'month',
    yearly: 'year',
  };
  const period = groupToPeriod[group];
  if (!period) throw new Error(`Unknown group: ${group}`);

  const bounds = getPeriodBounds(period, date);
  const groupHabits = getState().habits.filter((h) => belongsToSelectedGroup(h, group));

  let totalCompleted = 0;
  let totalActive = 0;

  for (const habit of groupHabits) {
    const { completed, active } = getHabitProgressForPeriod(habit, bounds);
    totalCompleted += completed;
    totalActive += active;
  }

  const percentage = totalActive > 0 ? Math.round((totalCompleted / totalActive) * 100) : 0;
  return { percentage, completed: totalCompleted, active: totalActive };
}

/**
 * Calculate progress for the current context (selected date and group)
 * with simple memoization to avoid unnecessary re-computation
 */
export function getCurrentContextProgress() {
  const dateObj = new Date(getState().selectedDate);
  const habitsHash = JSON.stringify(getState().habits.map(h => ({ id: h.id, completed: h.completed, skipped: h.skipped })));
  
  // Check if we can use cached result
  if (_progressCache.selectedDate === getState().selectedDate &&
      _progressCache.selectedGroup === getState().selectedGroup &&
      _progressCache.habitsHash === habitsHash) {
    return _progressCache.result;
  }

  // 1) Habits that belong to the currently selected group
  // 2) Are actually scheduled for the selected date (takes holiday mode into account)
  const scheduledHabits = getState().habits.filter(
    (h) => belongsToSelectedGroup(h, getState().selectedGroup) && isHabitScheduledOnDate(h, dateObj)
  );

  // 3) Remove any that the user explicitly skipped
  const activeHabits = scheduledHabits.filter((h) => !isHabitSkippedToday(h, dateObj));

  // 4) Determine how many of the remaining active habits are completed
  const completed = activeHabits.filter((h) => isHabitCompleted(h, dateObj));

  const progress = activeHabits.length ? (completed.length / activeHabits.length) * 100 : 0;
  
  // Cache the result
  _progressCache = {
    selectedDate: getState().selectedDate,
    selectedGroup: getState().selectedGroup,
    habitsHash: habitsHash,
    result: progress
  };
  
  return progress;
}
