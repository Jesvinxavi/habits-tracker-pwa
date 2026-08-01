/**
 * Per-habit statistics for the habit statistics modal.
 *
 * All the arithmetic lives in `habitCalculations.js`; this module's job is to
 * ask it the questions this particular screen asks — which differ by the habit's
 * period, since "days tracked" means nothing for a yearly habit — and to hand
 * back one flat object the modal can render.
 */

import { getState } from '../../../core/state.js';
import { calendarDaysBetween, dateToKey, startOfLocalDay } from '../../../shared/datetime.js';
import { getPeriodKey } from '../../home/schedule.js';
import {
  DayStatus,
  completionRate,
  currentStreak,
  groupDaySeries,
  habitDaySeries,
  habitEvaluationEnd,
  habitGroup,
  habitPeriodSeries,
  habitStartDate,
  longestStreak,
  periodCompletionRate,
  periodsSinceStart,
  periodStreaks,
  summariseSeries,
} from './habitCalculations.js';

/** How each group's windows are labelled and sized. */
const GROUP_WINDOWS = {
  daily: {
    unit: 'day',
    trackedLabel: 'Days tracked',
    recentLabel: 'Last 30 days',
    short: { label: '7d', size: 7 },
    long: { label: '30d', size: 30 },
    recent: 30,
  },
  weekly: {
    unit: 'week',
    trackedLabel: 'Weeks tracked',
    recentLabel: 'Last 12 weeks',
    short: { label: '4w', size: 4 },
    long: { label: '12w', size: 12 },
    recent: 12,
  },
  monthly: {
    unit: 'month',
    trackedLabel: 'Months tracked',
    recentLabel: 'Last 6 months',
    short: { label: '3m', size: 3 },
    long: { label: '12m', size: 12 },
    recent: 6,
  },
  yearly: {
    unit: 'year',
    trackedLabel: 'Years tracked',
    recentLabel: 'Last 3 years',
    short: { label: '3y', size: 3 },
    long: { label: '10y', size: 10 },
    recent: 3,
  },
};

/**
 * Calculates the statistics the habit modal shows.
 * @param {string} habitId The habit's client id.
 * @param {Date} [today] The current date, injectable for tests.
 * @returns {object|null} Statistics, or null when the habit does not exist.
 */
export function calculateHabitStatistics(habitId, today = new Date()) {
  const habit = getState().habits.find((candidate) => candidate.id === habitId);
  if (!habit) return null;

  const group = habitGroup(habit);
  const windows = GROUP_WINDOWS[group];
  const start = habitStartDate(habit, today);
  const end = habitEvaluationEnd(habit, today);

  const stats = {
    group,
    habitId,
    trackedUnitLabel: windows.trackedLabel,
    recentLabel: windows.recentLabel,
    periodLabels: [windows.short.label, windows.long.label, 'All Time'],
    isPaused: Boolean(habit.paused),
    isArchived: Boolean(habit.archivedAt),
    frozenOn: end < startOfLocalDay(today) ? dateToKey(end) : null,
    target: typeof habit.target === 'number' && habit.target > 0 ? habit.target : null,
    targetUnit: habit.targetUnit || '',
  };

  if (group === 'daily') {
    const series = habitDaySeries(habit, { today });
    const summary = summariseSeries(series);

    stats.daysTracked = series.length;
    stats.totalCompletions = summary.completed;
    stats.totalMissed = summary.missed;
    stats.totalSkipped = summary.skipped;
    stats.completionRateShort = completionRate(habit, { days: windows.short.size, today });
    stats.completionRateLong = completionRate(habit, { days: windows.long.size, today });
    stats.completionRateTotal = summary.rate;
    stats.currentStreak = currentStreak(habit, { today });
    stats.longestStreak = longestStreak(habit, { today });
    stats.daySeries = series;

    const recent = series.slice(0, windows.recent);
    stats.recentActivity = summariseSeries(recent).completed;

    const lastCompleted = series.find((day) => day.status === DayStatus.COMPLETED);
    stats.lastCompleted = lastCompleted ? lastCompleted.dateKey : null;

    // Per week, over the weeks the habit has actually been running.
    const weeks = Math.max(1, (calendarDaysBetween(end, start) + 1) / 7);
    stats.periodAverage = summary.completed / weeks;
    stats.periodAverageLabel = 'Completions per week';
    stats.weekdayBreakdown = weekdayBreakdown(series);
  } else {
    const unit = windows.unit;
    const series = habitPeriodSeries(habit, { unit, today });
    const summary = summariseSeries(series);

    stats.daysTracked = periodsSinceStart(habit, unit, today);
    stats.totalCompletions = summary.completed;
    stats.totalMissed = summary.missed;
    stats.totalSkipped = summary.skipped;
    stats.completionRateShort = periodCompletionRate(habit, {
      unit,
      count: windows.short.size,
      today,
    });
    stats.completionRateLong = periodCompletionRate(habit, {
      unit,
      count: windows.long.size,
      today,
    });
    stats.completionRateTotal = summary.rate;

    const streaks = periodStreaks(habit, { unit, today });
    stats.currentStreak = streaks.current;
    stats.longestStreak = streaks.longest;

    stats.recentActivity = summariseSeries(series.slice(0, windows.recent)).completed;

    // The day the user actually acted, not the period boundary: a period end is
    // usually in the future, which is how "last completed" came to read as
    // "-2 days ago".
    const lastCompleted = series.find((period) => period.completedOn);
    stats.lastCompleted = lastCompleted ? dateToKey(lastCompleted.completedOn) : null;

    stats.periodAverage = stats.daysTracked > 0 ? summary.completed / stats.daysTracked : 0;
    stats.periodAverageLabel = `Completions per ${unit}`;
    stats.periodSeries = series;
    stats.daySeries = groupDaySeries([habit], { today });
  }

  stats.decidedTotal = stats.totalCompletions + stats.totalMissed;
  stats.skippedPercentage =
    stats.decidedTotal + stats.totalSkipped > 0
      ? (stats.totalSkipped / (stats.decidedTotal + stats.totalSkipped)) * 100
      : 0;
  // The modal's empty state hangs off this: a habit that has never resolved a
  // single period has nothing to show but zeroes.
  stats.hasData = stats.totalCompletions > 0 || stats.totalMissed > 0 || stats.totalSkipped > 0;
  stats.targetProgress = buildTargetProgress(habit, today);

  return stats;
}

/**
 * Completion rate by weekday, so a habit that only ever fails on Fridays says so.
 * @param {Array<{date: Date, status: string}>} series A day series.
 * @returns {Array<{label: string, completed: number, decided: number, rate: number}>}
 *   Monday first.
 */
function weekdayBreakdown(series) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const buckets = labels.map((label) => ({ label, completed: 0, decided: 0, rate: 0 }));

  for (const day of series) {
    if (day.status !== DayStatus.COMPLETED && day.status !== DayStatus.MISSED) continue;
    const index = (day.date.getDay() + 6) % 7;
    buckets[index].decided += 1;
    if (day.status === DayStatus.COMPLETED) buckets[index].completed += 1;
  }

  for (const bucket of buckets) {
    bucket.rate = bucket.decided > 0 ? (bucket.completed / bucket.decided) * 100 : 0;
  }
  return buckets;
}

/**
 * Progress against a numeric target, for the habits that carry one.
 *
 * The app has always recorded how much of a target was reached each period —
 * eight of ten glasses, three of five runs — and no statistics surface has ever
 * shown it.
 * @param {object} habit The habit.
 * @param {Date} today The current date.
 * @returns {object|null} Target statistics, or null when the habit has no target.
 */
function buildTargetProgress(habit, today) {
  const target = typeof habit.target === 'number' && habit.target > 0 ? habit.target : null;
  if (!target) return null;

  const entries = Object.entries(habit.progress || {}).filter(([, value]) =>
    Number.isFinite(Number(value))
  );
  if (entries.length === 0) {
    return { target, unit: habit.targetUnit || '', recorded: 0, total: 0, average: 0, best: 0, current: 0 };
  }

  const values = entries.map(([, value]) => Number(value));
  const total = values.reduce((sum, value) => sum + value, 0);
  const best = Math.max(...values);
  const current = Number(habit.progress?.[getPeriodKey(habit, today)] || 0);

  return {
    target,
    unit: habit.targetUnit || '',
    recorded: entries.length,
    total,
    average: total / entries.length,
    best,
    current,
    // How often the target was actually reached, not merely progressed toward.
    hitRate: (values.filter((value) => value >= target).length / values.length) * 100,
  };
}

