// src/selectors/progress.js
// Centralised progress / statistics helpers extracted from
// features/home/schedule.js so multiple views can share one implementation.
// Phase-6 task sel-1

import { appData } from '../core/state.js';
import { eachDayInRange, getPeriodBounds } from '../shared/datetime.js';

// Re-use existing helpers from schedule.js to avoid duplication
import {
  isHabitScheduledOnDate,
  isHabitSkippedToday,
  isHabitCompleted,
  belongsToSelectedGroup,
} from '../features/home/schedule.js';

/**
 * Calculate progress for a single habit over a specific date range.
 * Returns count of completed units and total active units.
 * Logic identical to original implementation in schedule.js.
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
  const groupHabits = appData.habits.filter((h) => belongsToSelectedGroup(h, group));

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
