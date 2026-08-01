/**
 * The one place habit statistics are calculated.
 *
 * Three surfaces used to answer the same questions with three sets of
 * arithmetic — the Stats page, the per-habit modal and the home progress ring —
 * and they had drifted far enough apart that a single skipped day produced
 * three different completion rates. Everything they need now lives here, so a
 * change to what a number *means* happens once.
 *
 * The semantics, settled with the product owner:
 *
 * - **A skip is neutral.** It leaves both sides of the ratio and never breaks a
 *   streak. Skipping is a deliberate act of planning, not a failure, and it is
 *   already reported on its own terms.
 * - **Today is pending until it is done.** An untouched day that has not
 *   finished yet is not a miss, so a streak survives the morning.
 * - **Pausing freezes, it does not erase.** Days earned before a pause stand;
 *   nothing accrues after it.
 * - **Archiving is the same shape of event**, and additionally takes the habit
 *   out of every forward-looking aggregate.
 *
 * Functions here are pure: they take habits and dates, never read the store,
 * and never touch the DOM.
 */

import {
  calendarDaysBetween,
  dateToKey,
  getPeriodBounds,
  mondayStart,
  startOfLocalDay,
} from '../../../shared/datetime.js';
import {
  belongsToSelectedGroup,
  getEarliestStartDate,
  getPeriodKey,
  isHabitCompleted,
  isHabitScheduledOnDate,
  isHabitSkippedToday,
} from '../../home/schedule.js';

/** How a single day resolved for one habit. */
export const DayStatus = {
  /** Not due, or outside the habit's active life. Carries no weight either way. */
  INACTIVE: 'inactive',
  /** Due, and deliberately stood down. Neutral by decision. */
  SKIPPED: 'skipped',
  /** Due and done. */
  COMPLETED: 'completed',
  /** Due, not done, and the day is over. */
  MISSED: 'missed',
  /** Due and not done yet, but the day has not finished. */
  PENDING: 'pending',
};

/** Statistics evaluate paused habits' history, unlike everyday surfaces. */
const STATS_SCHEDULE_OPTIONS = { ignorePause: true };

/**
 * The date a habit's record begins.
 * @param {object} habit The habit.
 * @param {Date} [fallback] Used when the habit carries no evidence at all.
 * @returns {Date} Local midnight.
 */
export function habitStartDate(habit, fallback = new Date()) {
  return getEarliestStartDate(habit) || startOfLocalDay(fallback);
}

/**
 * The last date a habit's record can advance to.
 *
 * Pausing and archiving both stop the clock; the day before the stamp is the
 * last one that counts. Absent either, the record runs to today.
 * @param {object} habit The habit.
 * @param {Date} [today] The current date.
 * @returns {Date} Local midnight, inclusive.
 */
export function habitEvaluationEnd(habit, today = new Date()) {
  let end = startOfLocalDay(today);
  const stamps = [];
  if (habit?.archivedAt != null) stamps.push(habit.archivedAt);
  if (habit?.paused && habit?.pausedAt != null) stamps.push(habit.pausedAt);
  for (const stamp of stamps) {
    const parsed = stamp instanceof Date ? stamp : new Date(stamp);
    if (Number.isNaN(parsed.valueOf())) continue;
    const cutoff = startOfLocalDay(parsed);
    cutoff.setDate(cutoff.getDate() - 1);
    if (cutoff < end) end = cutoff;
  }
  return end;
}

/**
 * Reports whether a habit still counts toward forward-looking totals.
 *
 * Archived and paused habits keep their own record and their place in history,
 * but they no longer represent something the user is currently doing, so they
 * are left out of averages and counts that describe the present.
 * @param {object} habit The habit.
 * @returns {boolean} True when the habit is live.
 */
export function isLiveHabit(habit) {
  return Boolean(habit) && !habit.archivedAt && !habit.paused;
}

/**
 * Resolves how one day went for one habit.
 * @param {object} habit The habit.
 * @param {Date} date The day.
 * @param {object} [options] Evaluation options.
 * @param {Date} [options.today] The current date, which decides what is pending.
 * @param {Date} [options.evaluationEnd] Precomputed end, to avoid recomputing
 *   it inside a loop.
 * @returns {string} A {@link DayStatus}.
 */
export function dayStatus(habit, date, { today = new Date(), evaluationEnd } = {}) {
  const day = startOfLocalDay(date);
  const end = evaluationEnd || habitEvaluationEnd(habit, today);
  if (day > end) return DayStatus.INACTIVE;

  if (!isHabitScheduledOnDate(habit, day, STATS_SCHEDULE_OPTIONS)) return DayStatus.INACTIVE;
  if (isHabitSkippedToday(habit, day)) return DayStatus.SKIPPED;
  if (isHabitCompleted(habit, day)) return DayStatus.COMPLETED;

  // An unfinished day is not yet a failure. Only the current day can be
  // pending: yesterday had its chance.
  return calendarDaysBetween(day, startOfLocalDay(today)) === 0
    ? DayStatus.PENDING
    : DayStatus.MISSED;
}

/**
 * Walks a habit's days, newest first, resolving each one.
 * @param {object} habit The habit.
 * @param {object} [options] Walk options.
 * @param {Date} [options.today] The current date.
 * @param {number} [options.days] How many days back to walk; all of them when
 *   omitted.
 * @returns {Array<{date: Date, dateKey: string, status: string}>} Newest first.
 */
export function habitDaySeries(habit, { today = new Date(), days } = {}) {
  const end = habitEvaluationEnd(habit, today);
  const start = habitStartDate(habit, today);
  const series = [];
  if (end < start) return series;

  const span = calendarDaysBetween(end, start) + 1;
  const limit = days == null ? span : Math.min(days, span);

  const cursor = new Date(end);
  for (let index = 0; index < limit; index += 1) {
    series.push({
      date: new Date(cursor),
      dateKey: dateToKey(cursor),
      status: dayStatus(habit, cursor, { today, evaluationEnd: end }),
    });
    cursor.setDate(cursor.getDate() - 1);
  }
  return series;
}

/**
 * Totals a resolved series.
 * @param {Array<{status: string}>} series Days in any order.
 * @returns {{completed: number, missed: number, skipped: number, pending: number, decided: number, rate: number}}
 *   `decided` is the denominator: days that resolved either way.
 */
export function summariseSeries(series) {
  let completed = 0;
  let missed = 0;
  let skipped = 0;
  let pending = 0;
  for (const day of series) {
    if (day.status === DayStatus.COMPLETED) completed += 1;
    else if (day.status === DayStatus.MISSED) missed += 1;
    else if (day.status === DayStatus.SKIPPED) skipped += 1;
    else if (day.status === DayStatus.PENDING) pending += 1;
  }
  const decided = completed + missed;
  return {
    completed,
    missed,
    skipped,
    pending,
    decided,
    rate: decided > 0 ? (completed / decided) * 100 : 0,
  };
}

/**
 * Completion rate over the last N days, as a percentage.
 * @param {object} habit The habit.
 * @param {object} [options] Options.
 * @param {number} [options.days] Window length; whole life when omitted.
 * @param {Date} [options.today] The current date.
 * @returns {number} 0–100.
 */
export function completionRate(habit, { days, today = new Date() } = {}) {
  return summariseSeries(habitDaySeries(habit, { today, days })).rate;
}

/**
 * The run of completed days ending now.
 *
 * Skipped days are stepped over without breaking it, and an unfinished today
 * neither extends nor ends it.
 * @param {object} habit The habit.
 * @param {object} [options] Options.
 * @param {Date} [options.today] The current date.
 * @returns {number} Consecutive completed days.
 */
export function currentStreak(habit, { today = new Date() } = {}) {
  const end = habitEvaluationEnd(habit, today);
  const start = habitStartDate(habit, today);
  if (end < start) return 0;

  // Walked day by day rather than over a materialised series: a streak ends at
  // the first miss, so building years of history to read the last few days of
  // it is work thrown away.
  let streak = 0;
  const cursor = new Date(end);
  while (cursor >= start) {
    const status = dayStatus(habit, cursor, { today, evaluationEnd: end });
    if (status === DayStatus.COMPLETED) streak += 1;
    else if (status === DayStatus.MISSED) break;
    // Inactive, skipped and pending days are stepped over.
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * The longest run of completed days in the habit's whole life.
 * @param {object} habit The habit.
 * @param {object} [options] Options.
 * @param {Date} [options.today] The current date.
 * @returns {number} Consecutive completed days.
 */
export function longestStreak(habit, { today = new Date() } = {}) {
  let longest = 0;
  let current = 0;
  for (const day of habitDaySeries(habit, { today })) {
    if (day.status === DayStatus.COMPLETED) {
      current += 1;
      if (current > longest) longest = current;
    } else if (day.status === DayStatus.MISSED) {
      current = 0;
    }
  }
  return longest;
}

/* -------------------------------------------------------------------------- */
/*  Period-based habits (weekly, monthly, yearly targets)                      */
/* -------------------------------------------------------------------------- */

/**
 * Steps a date back by one period.
 * @param {Date} date Start point.
 * @param {'week'|'month'|'year'} unit Period unit.
 * @param {number} count How many periods back.
 * @returns {Date} A date inside the earlier period.
 */
function stepBack(date, unit, count) {
  const result = new Date(date);
  if (unit === 'week') result.setDate(result.getDate() - count * 7);
  else if (unit === 'month') result.setMonth(result.getMonth() - count);
  else result.setFullYear(result.getFullYear() - count);
  return result;
}

/**
 * How many periods a habit has existed for.
 * @param {object} habit The habit.
 * @param {'week'|'month'|'year'} unit Period unit.
 * @param {Date} today The current date.
 * @returns {number} At least one.
 */
export function periodsSinceStart(habit, unit, today = new Date()) {
  const start = habitStartDate(habit, today);
  const end = habitEvaluationEnd(habit, today);
  if (end < start) return 0;
  if (unit === 'week') {
    return Math.floor(calendarDaysBetween(mondayStart(end), mondayStart(start)) / 7) + 1;
  }
  if (unit === 'month') {
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  }
  return end.getFullYear() - start.getFullYear() + 1;
}

/**
 * Resolves a habit's periods, newest first.
 *
 * A period counts as active if the habit was due on any day inside it, as
 * completed if it was done on any of them, and as skipped only when every
 * active day in it was stood down.
 * @param {object} habit The habit.
 * @param {object} options Options.
 * @param {'week'|'month'|'year'} options.unit Period unit.
 * @param {number} [options.count] How many periods; all of them when omitted.
 * @param {Date} [options.today] The current date.
 * @returns {Array<{start: Date, end: Date, status: string, completedOn: Date|null}>}
 */
export function habitPeriodSeries(habit, { unit, count, today = new Date() }) {
  const periodName = unit === 'week' ? 'week' : unit === 'month' ? 'month' : 'year';
  const total = periodsSinceStart(habit, unit, today);
  const limit = count == null ? total : Math.min(count, total);
  const start = habitStartDate(habit, today);
  const evaluationEnd = habitEvaluationEnd(habit, today);
  const todayStart = startOfLocalDay(today);
  const series = [];

  for (let index = 0; index < limit; index += 1) {
    const bounds = getPeriodBounds(periodName, stepBack(evaluationEnd, unit, index));
    const from = bounds.start < start ? start : bounds.start;
    const to = bounds.end > evaluationEnd ? evaluationEnd : bounds.end;

    let active = 0;
    let skipped = 0;
    let completedOn = null;
    const cursor = new Date(from);
    while (cursor <= to) {
      if (isHabitScheduledOnDate(habit, cursor, STATS_SCHEDULE_OPTIONS)) {
        active += 1;
        if (isHabitSkippedToday(habit, cursor)) skipped += 1;
        else if (!completedOn && isHabitCompleted(habit, cursor)) completedOn = new Date(cursor);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    let status;
    if (active === 0) status = DayStatus.INACTIVE;
    else if (completedOn) status = DayStatus.COMPLETED;
    else if (skipped === active) status = DayStatus.SKIPPED;
    // A period still running has not been missed yet.
    else if (bounds.end >= todayStart) status = DayStatus.PENDING;
    else status = DayStatus.MISSED;

    series.push({ start: bounds.start, end: bounds.end, status, completedOn });
  }
  return series;
}

/**
 * Completion rate across periods, as a percentage.
 * @param {object} habit The habit.
 * @param {object} options Options; see {@link habitPeriodSeries}.
 * @returns {number} 0–100.
 */
export function periodCompletionRate(habit, options) {
  return summariseSeries(habitPeriodSeries(habit, options)).rate;
}

/**
 * Current and longest run of completed periods.
 * @param {object} habit The habit.
 * @param {object} options Options; see {@link habitPeriodSeries}.
 * @returns {{current: number, longest: number}} Streaks in periods.
 */
export function periodStreaks(habit, options) {
  const series = habitPeriodSeries(habit, { ...options, count: undefined });
  let current = 0;
  let longest = 0;
  let run = 0;
  let currentSettled = false;

  for (const period of series) {
    if (period.status === DayStatus.COMPLETED) {
      run += 1;
      if (run > longest) longest = run;
    } else if (period.status === DayStatus.MISSED) {
      if (!currentSettled) {
        current = run;
        currentSettled = true;
      }
      run = 0;
    }
    // Inactive, skipped and in-flight periods are stepped over.
  }
  if (!currentSettled) current = run;
  return { current, longest };
}

/* -------------------------------------------------------------------------- */
/*  Group-level series (all the daily habits together)                         */
/* -------------------------------------------------------------------------- */

/**
 * Resolves every day across a set of habits at once.
 *
 * A day's percentage is over the habits that were actually asked of the user
 * that day: not due, skipped and still-pending habits are all left out, so a
 * quiet day reads as having no data rather than as a total failure.
 * @param {object[]} habits The habits to combine.
 * @param {object} [options] Options.
 * @param {Date} [options.today] The current date.
 * @param {number} [options.days] Limit the walk; all history when omitted.
 * @returns {Array<{dateKey: string, date: Date, active: number, completed: number, skipped: number, percentage: number}>}
 *   Newest first.
 */
export function groupDaySeries(habits, { today = new Date(), days } = {}) {
  if (!habits || habits.length === 0) return [];

  const todayStart = startOfLocalDay(today);
  let earliest = null;
  let latest = null;
  const ends = new Map();

  for (const habit of habits) {
    const start = habitStartDate(habit, today);
    const end = habitEvaluationEnd(habit, today);
    ends.set(habit, end);
    if (end < start) continue;
    if (earliest === null || start < earliest) earliest = start;
    if (latest === null || end > latest) latest = end;
  }
  if (earliest === null) return [];

  const span = calendarDaysBetween(latest, earliest) + 1;
  const limit = days == null ? span : Math.min(days, span);

  const series = [];
  const cursor = new Date(latest);
  for (let index = 0; index < limit; index += 1) {
    let active = 0;
    let completed = 0;
    let skipped = 0;
    for (const habit of habits) {
      const status = dayStatus(habit, cursor, { today, evaluationEnd: ends.get(habit) });
      if (status === DayStatus.SKIPPED) skipped += 1;
      else if (status === DayStatus.COMPLETED) {
        active += 1;
        completed += 1;
      } else if (status === DayStatus.MISSED) active += 1;
      // Pending and inactive habits carry no weight.
    }
    series.push({
      date: new Date(cursor),
      dateKey: dateToKey(cursor),
      active,
      completed,
      skipped,
      percentage: active > 0 ? (completed / active) * 100 : 0,
      // A day nobody was asked to do anything is not a perfect day.
      perfect: active > 0 && completed === active,
      isToday: calendarDaysBetween(cursor, todayStart) === 0,
    });
    cursor.setDate(cursor.getDate() - 1);
  }
  return series;
}

/**
 * Averages a group series over the last N days that actually asked something.
 *
 * Counting days on which nothing was due would dilute the figure toward zero
 * for anyone whose habits are not daily, which is why the window is measured in
 * active days rather than calendar days.
 * @param {Array<{active: number, percentage: number}>} series From {@link groupDaySeries}.
 * @param {number} [windowDays] How many active days; all of them when omitted.
 * @returns {number} 0–100.
 */
export function groupCompletionRate(series, windowDays) {
  const active = series.filter((day) => day.active > 0);
  const selected = windowDays == null ? active : active.slice(0, windowDays);
  if (selected.length === 0) return 0;
  return selected.reduce((sum, day) => sum + day.percentage, 0) / selected.length;
}

/**
 * The current and longest runs of days on which everything due was done.
 * @param {Array<{active: number, perfect: boolean, isToday: boolean}>} series From {@link groupDaySeries}.
 * @returns {{current: number, longest: number}} Streaks in days.
 */
export function groupStreaks(series) {
  let current = 0;
  let longest = 0;
  let run = 0;
  let currentSettled = false;

  for (const day of series) {
    // A day with nothing due neither extends nor breaks a run, and today only
    // counts once it is actually perfect.
    if (day.active === 0) continue;
    if (day.perfect) {
      run += 1;
      if (run > longest) longest = run;
    } else if (day.isToday) {
      continue;
    } else {
      if (!currentSettled) {
        current = run;
        currentSettled = true;
      }
      run = 0;
    }
  }
  if (!currentSettled) current = run;
  return { current, longest };
}

/**
 * The completion-rate windows the carousels show.
 * @param {Array<object>} series From {@link groupDaySeries}.
 * @returns {Array<{label: string, rate: number}>} Newest window first.
 */
export function groupCompletionPeriods(series) {
  return [
    { label: '7d', rate: groupCompletionRate(series, 7) },
    { label: '30d', rate: groupCompletionRate(series, 30) },
    { label: 'All Time', rate: groupCompletionRate(series) },
  ];
}

/* -------------------------------------------------------------------------- */
/*  Classification helpers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The period unit a habit's statistics should be expressed in.
 * @param {object} habit The habit.
 * @returns {'daily'|'weekly'|'monthly'|'yearly'} Group name.
 */
export function habitGroup(habit) {
  for (const group of ['daily', 'weekly', 'monthly', 'yearly']) {
    if (belongsToSelectedGroup(habit, group)) return group;
  }
  return 'daily';
}

/**
 * A habit's recent reliability, measured in whatever unit it is kept in.
 *
 * Asking a weekly habit how many of the last thirty *days* it was completed on
 * is a category error: its completion is recorded against the week, so every
 * day of a kept week would read as a success. Each habit is judged over its own
 * periods instead, which is what makes a mixed list comparable.
 * @param {object} habit The habit.
 * @param {object} [options] Options.
 * @param {Date} [options.today] The current date.
 * @returns {{rate: number, decided: number, unit: string}} Rate and how much
 *   evidence it rests on.
 */
export function habitReliability(habit, { today = new Date() } = {}) {
  const group = habitGroup(habit);
  if (group === 'daily') {
    const summary = summariseSeries(habitDaySeries(habit, { today, days: 30 }));
    return { rate: summary.rate, decided: summary.decided, unit: 'day' };
  }

  const unit = group === 'weekly' ? 'week' : group === 'monthly' ? 'month' : 'year';
  const count = unit === 'week' ? 12 : unit === 'month' ? 6 : 3;
  const summary = summariseSeries(habitPeriodSeries(habit, { unit, count, today }));
  return { rate: summary.rate, decided: summary.decided, unit };
}

/**
 * Reports whether a habit's completion is recorded against calendar days.
 *
 * Target habits with a weekly or longer period store one flag for the whole
 * period, so there is no way to know which day inside it the user acted on.
 * Anything asking "did this happen today" has to be limited to habits that
 * record days.
 * @param {object} habit The habit.
 * @param {Date} [date] The date to test.
 * @returns {boolean} True when the habit's period key is a calendar day.
 */
export function tracksCalendarDays(habit, date = new Date()) {
  return /^\d{4}-\d{2}-\d{2}$/.test(getPeriodKey(habit, date));
}

/**
 * Reports whether a habit was completed on a specific calendar day.
 *
 * For period habits this is unknowable, and answering "yes" for every day of a
 * completed week is how "Completed Today" came to count Monday's run all week.
 * @param {object} habit The habit.
 * @param {Date} date The day.
 * @returns {boolean} True only when the completion is attributable to that day.
 */
export function completedOnDay(habit, date) {
  return tracksCalendarDays(habit, date) && isHabitCompleted(habit, date);
}
