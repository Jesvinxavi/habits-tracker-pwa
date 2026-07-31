/**
 * Whole-collection habit statistics for the Stats page.
 *
 * Where the per-habit modal answers "how is this habit going", this answers
 * "how am I going": the daily group taken together, which habits are carrying
 * the average and which are dragging it, and what the categories look like.
 *
 * Archived and paused habits are kept out of everything forward-looking. They
 * keep their own records — that is the modal's job — but a habit archived two
 * months ago scoring 0% for every window since is not information, it is an
 * artefact of asking a question about something that no longer exists.
 */

import { getState } from '../../core/state.js';
import { belongsToSelectedGroup } from '../home/schedule.js';
import { isHoliday } from '../holidays/holidays.js';
import { dateToKey } from '../../shared/datetime.js';
import {
  DayStatus,
  completedOnDay,
  currentStreak,
  dayStatus,
  groupCompletionPeriods,
  groupCompletionRate,
  groupDaySeries,
  groupStreaks,
  habitDaySeries,
  habitReliability,
  isLiveHabit,
  periodCompletionRate,
  periodStreaks,
  summariseSeries,
} from '../habits/helpers/habitCalculations.js';

/** A habit with the shape the calculators rely on, however it arrived. */
function normaliseHabit(habit) {
  if (!habit || typeof habit.id !== 'string' || typeof habit.name !== 'string') return null;
  // A missing pause flag used to drop the habit out of every statistic in
  // silence. Coercing it keeps the habit visible and costs nothing.
  return typeof habit.paused === 'boolean' ? habit : { ...habit, paused: Boolean(habit.paused) };
}

/**
 * Calculates the habit half of the Stats page.
 * @param {Date} [today] The current date.
 * @returns {object} Habit statistics.
 */
export function calculateHabitStatistics(today = new Date()) {
  const state = getState();
  const allHabits = (state.habits || []).map(normaliseHabit).filter(Boolean);
  const liveHabits = allHabits.filter(isLiveHabit);
  const categoriesById = new Map((state.categories || []).map((entry) => [entry.id, entry]));

  const stats = {
    totalHabits: liveHabits.length,
    historicalHabits: allHabits.length,
    pausedHabits: allHabits.filter((habit) => habit.paused && !habit.archivedAt).length,
    archivedHabits: allHabits.filter((habit) => habit.archivedAt).length,
    completedToday: 0,
    onTrackThisPeriod: 0,
    dueToday: 0,
    categoryBreakdown: [],
    completionRates: [],
    dailyHabits: [],
    weeklyHabits: [],
    monthlyHabits: [],
    yearlyHabits: [],
    holidayDaysThisYear: 0,
  };

  for (const habit of liveHabits) {
    for (const group of ['daily', 'weekly', 'monthly', 'yearly']) {
      if (belongsToSelectedGroup(habit, group)) {
        stats[`${group}Habits`].push(habit);
        break;
      }
    }

    // "Completed today" means today, not "this habit's period contains a
    // completion" — a weekly habit done on Monday used to count all week.
    if (completedOnDay(habit, today)) stats.completedToday += 1;
    else if (isCompletedForPeriod(habit, today)) stats.onTrackThisPeriod += 1;

    // Everything asked of the user today, whether or not it has been done yet.
    // Reading this off the day series would miss exactly the habits still
    // outstanding, since a pending habit deliberately carries no weight there.
    const status = dayStatus(habit, today, { today });
    if (status === DayStatus.PENDING || status === DayStatus.COMPLETED) stats.dueToday += 1;
  }

  // The daily group is the one that has a meaningful day-by-day shape; the
  // others are period habits and are summarised through their own windows.
  const dailySeries = groupDaySeries(stats.dailyHabits, { today });
  stats.dailySeries = dailySeries;
  stats.dailyCompletionPeriods = groupCompletionPeriods(dailySeries);
  const streaks = groupStreaks(dailySeries);
  stats.longestStreak = streaks.longest;
  stats.currentStreak = streaks.current;
  stats.averageCompletionRate = groupCompletionRate(dailySeries, 30);
  stats.allTimeCompletionRate = groupCompletionRate(dailySeries);
  stats.perfectDaysThisMonth = countPerfectDaysThisMonth(dailySeries, today);
  stats.totalSkipsThisMonth = countSkipsThisMonth(dailySeries, today);

  stats.weeklyCompletionRate = averageRate(stats.weeklyHabits, (habit) =>
    periodCompletionRate(habit, { unit: 'week', count: 4, today })
  );
  stats.monthlyCompletionRate = averageRate(stats.monthlyHabits, (habit) =>
    periodCompletionRate(habit, { unit: 'month', count: 3, today })
  );

  // Per-habit 30-day rates, which drive both the category averages and the
  // "most consistent / needs attention" cards.
  stats.completionRates = liveHabits
    .map((habit) => {
      const reliability = habitReliability(habit, { today });
      return {
        habitId: habit.id,
        habitName: habit.name,
        categoryId: habit.categoryId,
        icon: habit.icon,
        rate: reliability.rate,
        decided: reliability.decided,
        unit: reliability.unit,
        currentStreak:
          reliability.unit === 'day'
            ? currentStreak(habit, { today })
            : periodStreaks(habit, { unit: reliability.unit, today }).current,
        streakUnit: reliability.unit,
      };
    })
    // A habit with nothing to judge yet is not "0% consistent".
    .filter((entry) => entry.decided > 0)
    .sort((left, right) => right.rate - left.rate);

  stats.categoryBreakdown = buildCategoryBreakdown(liveHabits, stats.completionRates, categoriesById);
  stats.holidayDaysThisYear = countHolidays(today);
  stats.mostSkipped = mostSkippedHabit(liveHabits, today);

  return stats;
}

/**
 * The habit standing down most often this month, if any is.
 *
 * Skips are neutral by design, which is exactly why they deserve to be visible:
 * a habit skipped every week is one the schedule is wrong about, and nothing
 * else on the page would ever say so.
 * @param {object[]} habits Live habits.
 * @param {Date} today The current date.
 * @returns {{name: string, icon: string, count: number}|null} The habit, or null.
 */
function mostSkippedHabit(habits, today) {
  let worst = null;
  for (const habit of habits) {
    const skipped = summariseSeries(habitDaySeries(habit, { today, days: 30 })).skipped;
    if (skipped > 0 && (!worst || skipped > worst.count)) {
      worst = { name: habit.name, icon: habit.icon || '', count: skipped };
    }
  }
  return worst;
}

/**
 * Averages a rate across habits, ignoring the ones with nothing to say.
 * @param {object[]} habits Habits to average over.
 * @param {(habit: object) => number} measure The rate for one habit.
 * @returns {number} 0–100.
 */
function averageRate(habits, measure) {
  if (habits.length === 0) return 0;
  const rates = habits.map(measure);
  return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
}

/**
 * Whether a period habit's current period already holds a completion.
 * @param {object} habit The habit.
 * @param {Date} today The current date.
 * @returns {boolean} True when this period is satisfied.
 */
function isCompletedForPeriod(habit, today) {
  const series = groupDaySeries([habit], { today, days: 1 });
  return series.length > 0 && series[0].completed > 0;
}

/**
 * Days this month on which everything due was done.
 * @param {Array<object>} series A group day series.
 * @param {Date} today The current date.
 * @returns {number} Perfect days.
 */
function countPerfectDaysThisMonth(series, today) {
  return series.filter(
    (day) =>
      day.perfect &&
      day.date.getMonth() === today.getMonth() &&
      day.date.getFullYear() === today.getFullYear()
  ).length;
}

/**
 * Skips this month, across the daily group.
 * @param {Array<object>} series A group day series.
 * @param {Date} today The current date.
 * @returns {number} Skips.
 */
function countSkipsThisMonth(series, today) {
  return series
    .filter(
      (day) =>
        day.date.getMonth() === today.getMonth() && day.date.getFullYear() === today.getFullYear()
    )
    .reduce((sum, day) => sum + day.skipped, 0);
}

/**
 * Habit counts and average reliability per category.
 * @param {object[]} habits Live habits.
 * @param {Array<{categoryId: string, rate: number}>} rates Per-habit rates.
 * @param {Map<string, object>} categoriesById Categories.
 * @returns {Array<object>} Categories, busiest first.
 */
function buildCategoryBreakdown(habits, rates, categoriesById) {
  const byCategory = new Map();
  for (const habit of habits) {
    const entry = byCategory.get(habit.categoryId) || { count: 0, rates: [] };
    entry.count += 1;
    byCategory.set(habit.categoryId, entry);
  }
  for (const rate of rates) {
    const entry = byCategory.get(rate.categoryId);
    if (entry) entry.rates.push(rate.rate);
  }

  return [...byCategory.entries()]
    .map(([categoryId, entry]) => {
      const category = categoriesById.get(categoryId);
      return {
        id: categoryId,
        name: category?.name || 'Uncategorised',
        color: category?.color || '#64748B',
        count: entry.count,
        // Only habits with a judged day contribute, so one brand-new habit
        // cannot halve a category's average on its first morning.
        completionRate:
          entry.rates.length > 0
            ? entry.rates.reduce((sum, rate) => sum + rate, 0) / entry.rates.length
            : null,
      };
    })
    .sort((left, right) => right.count - left.count);
}

/**
 * Holiday days marked in the current calendar year.
 * @param {Date} today The current date.
 * @returns {number} Days.
 */
function countHolidays(today) {
  let count = 0;
  const cursor = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  while (cursor <= yearEnd) {
    if (isHoliday(dateToKey(cursor))) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export { DayStatus };
