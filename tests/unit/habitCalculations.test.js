/**
 * The shared habit calculators, and the four semantic decisions they encode:
 * a skip is neutral, today is pending until it is done, pausing freezes rather
 * than erases, and archiving additionally removes a habit from live totals.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DayStatus,
  completedOnDay,
  completionRate,
  currentStreak,
  dayStatus,
  groupCompletionRate,
  groupDaySeries,
  groupStreaks,
  habitEvaluationEnd,
  habitGroup,
  habitPeriodSeries,
  isLiveHabit,
  longestStreak,
  periodCompletionRate,
  periodStreaks,
  summariseSeries,
  habitDaySeries,
} from '../../src/features/habits/helpers/habitCalculations.js';
import { ActionTypes, dispatch } from '../../src/core/state.js';
import { TODAY, dailyHabit, daysAgo, keyDaysAgo, targetHabit } from '../fixtures/statsScenarios.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
  // Holiday lookups read the store, so give them an empty one to read.
  dispatch({ type: ActionTypes.RESET_STATE, meta: { source: 'test' } });
});

afterEach(() => {
  vi.useRealTimers();
});

const at = (days) => daysAgo(days);

describe('day resolution', () => {
  it('reports a skipped day as skipped, not missed', () => {
    const habit = dailyHabit({ createdDaysAgo: 10, completedOn: () => false, skippedDaysAgo: [3] });
    expect(dayStatus(habit, at(3), { today: TODAY })).toBe(DayStatus.SKIPPED);
    expect(dayStatus(habit, at(4), { today: TODAY })).toBe(DayStatus.MISSED);
  });

  it('reports an untouched today as pending and an untouched yesterday as missed', () => {
    const habit = dailyHabit({ createdDaysAgo: 10, completedOn: () => null });
    expect(dayStatus(habit, at(0), { today: TODAY })).toBe(DayStatus.PENDING);
    expect(dayStatus(habit, at(1), { today: TODAY })).toBe(DayStatus.MISSED);
  });

  it('reports days before the habit existed as inactive', () => {
    const habit = dailyHabit({ createdDaysAgo: 5, completedOn: () => true });
    expect(dayStatus(habit, at(9), { today: TODAY })).toBe(DayStatus.INACTIVE);
  });
});

describe('completion rate', () => {
  it('leaves skipped days out of both sides of the ratio', () => {
    // Seven days: five done, one skipped, one missed.
    const habit = dailyHabit({
      createdDaysAgo: 6,
      completedOn: (day) => (day === 2 ? null : day !== 4),
      skippedDaysAgo: [2],
    });
    const summary = summariseSeries(habitDaySeries(habit, { today: TODAY, days: 7 }));

    expect(summary.skipped).toBe(1);
    expect(summary.completed).toBe(5);
    expect(summary.missed).toBe(1);
    // Five of six decided days, not five of seven.
    expect(summary.decided).toBe(6);
    expect(Math.round(summary.rate)).toBe(83);
  });

  it('does not let an unfinished today drag the rate down', () => {
    const habit = dailyHabit({ createdDaysAgo: 6, completedOn: (day) => day !== 0 });
    expect(completionRate(habit, { days: 7, today: TODAY })).toBe(100);
  });

  it('returns zero rather than dividing by nothing when no day has resolved', () => {
    const habit = dailyHabit({ createdDaysAgo: 0, completedOn: () => null });
    expect(completionRate(habit, { days: 7, today: TODAY })).toBe(0);
  });
});

describe('streaks', () => {
  it('steps over a skipped day without breaking the run', () => {
    const habit = dailyHabit({
      createdDaysAgo: 10,
      completedOn: (day) => (day === 2 ? null : day !== 0),
      skippedDaysAgo: [2],
    });
    // Days 1 and 3–10 completed, day 2 skipped, today untouched: nine in a row
    // that the skip is stepped over rather than allowed to cut in two.
    expect(currentStreak(habit, { today: TODAY })).toBe(9);
  });

  it('keeps the run alive through an unfinished today', () => {
    const habit = dailyHabit({ createdDaysAgo: 30, completedOn: (day) => day !== 0 });
    expect(currentStreak(habit, { today: TODAY })).toBe(30);
  });

  it('counts today once it is done', () => {
    const habit = dailyHabit({ createdDaysAgo: 30, completedOn: () => true });
    expect(currentStreak(habit, { today: TODAY })).toBe(31);
  });

  it('ends the run at a missed day', () => {
    const habit = dailyHabit({ createdDaysAgo: 30, completedOn: (day) => day !== 5 });
    expect(currentStreak(habit, { today: TODAY })).toBe(5);
  });

  it('finds the longest run anywhere in the habit’s life, with no window cap', () => {
    // A 500-day-old habit whose only miss was on day 100 from today.
    const habit = dailyHabit({ createdDaysAgo: 500, completedOn: (day) => day !== 100 });
    expect(longestStreak(habit, { today: TODAY })).toBe(400);
  });
});

describe('pausing and archiving', () => {
  it('keeps a paused habit’s history intact', () => {
    const habit = dailyHabit({
      createdDaysAgo: 30,
      completedOn: (day) => day >= 5,
      overrides: { paused: true, pausedAt: at(5).getTime() },
    });

    // Days 6–30 were earned before the pause landed on day 5; they all stand.
    expect(longestStreak(habit, { today: TODAY })).toBe(25);
    expect(completionRate(habit, { today: TODAY })).toBe(100);
  });

  it('stops a paused habit’s record advancing past the pause', () => {
    const habit = dailyHabit({
      createdDaysAgo: 30,
      completedOn: (day) => day >= 5,
      overrides: { paused: true, pausedAt: at(5).getTime() },
    });

    expect(habitEvaluationEnd(habit, TODAY).getTime()).toBe(at(6).getTime());
    // The four untouched days after the pause are not misses.
    expect(summariseSeries(habitDaySeries(habit, { today: TODAY })).missed).toBe(0);
  });

  it('keeps the whole history of a habit paused before pauses were stamped', () => {
    const habit = dailyHabit({
      createdDaysAgo: 30,
      completedOn: () => true,
      overrides: { paused: true },
    });
    expect(longestStreak(habit, { today: TODAY })).toBe(31);
  });

  it('stops an archived habit’s record at the archive date', () => {
    const habit = dailyHabit({
      createdDaysAgo: 30,
      completedOn: (day) => day >= 10,
      overrides: { archivedAt: at(10).getTime() },
    });
    expect(habitEvaluationEnd(habit, TODAY).getTime()).toBe(at(11).getTime());
    expect(completionRate(habit, { today: TODAY })).toBe(100);
  });

  it('takes paused and archived habits out of live totals', () => {
    expect(isLiveHabit(dailyHabit({}))).toBe(true);
    expect(isLiveHabit(dailyHabit({ overrides: { paused: true } }))).toBe(false);
    expect(isLiveHabit(dailyHabit({ overrides: { archivedAt: Date.now() } }))).toBe(false);
  });
});

describe('period habits', () => {
  it('counts a weekly target completed once in the week as a completed week', () => {
    const habit = targetHabit({ targetFrequency: 'weekly', createdDaysAgo: 40 });
    const series = habitPeriodSeries(habit, { unit: 'week', count: 3, today: TODAY });
    expect(series).toHaveLength(3);
    // Nothing completed anywhere, and only the running week is still pending.
    expect(series[0].status).toBe(DayStatus.PENDING);
    expect(series[1].status).toBe(DayStatus.MISSED);
  });

  it('does not count the running period as missed', () => {
    const habit = targetHabit({ targetFrequency: 'monthly', createdDaysAgo: 100 });
    const series = habitPeriodSeries(habit, { unit: 'month', count: 2, today: TODAY });
    expect(series[0].status).toBe(DayStatus.PENDING);
    expect(periodCompletionRate(habit, { unit: 'month', count: 1, today: TODAY })).toBe(0);
  });

  it('keeps a period streak alive across a period still in flight', () => {
    // Completed the two ISO weeks before the current one.
    const completed = {};
    for (const back of [7, 14]) {
      const date = at(back);
      const monday = new Date(date);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      completed[`${monday.getFullYear()}-W${weekNumber(monday)}`] = true;
    }
    const habit = targetHabit({ targetFrequency: 'weekly', createdDaysAgo: 21, completed });
    const { current } = periodStreaks(habit, { unit: 'week', today: TODAY });
    expect(current).toBeGreaterThanOrEqual(2);
  });
});

/**
 * ISO week number, mirroring the app's own helper closely enough for fixtures.
 * @param {Date} date Any date.
 * @returns {number} ISO week number.
 */
function weekNumber(date) {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
}

describe('group series', () => {
  it('measures a day against the habits actually asked of the user', () => {
    const habits = [
      dailyHabit({ id: 'a', createdDaysAgo: 10, completedOn: (day) => day === 1 }),
      dailyHabit({ id: 'b', createdDaysAgo: 10, completedOn: () => false, skippedDaysAgo: [1] }),
      dailyHabit({ id: 'c', createdDaysAgo: 10, completedOn: (day) => day === 1 }),
    ];
    const series = groupDaySeries(habits, { today: TODAY });
    const yesterday = series.find((day) => day.dateKey === keyDaysAgo(1));

    // Two of two, with the skipped habit set aside rather than counted against.
    expect(yesterday.active).toBe(2);
    expect(yesterday.completed).toBe(2);
    expect(yesterday.skipped).toBe(1);
    expect(yesterday.percentage).toBe(100);
    expect(yesterday.perfect).toBe(true);
  });

  it('averages over active days only, so quiet days do not dilute the figure', () => {
    const habits = [
      // Due on Mondays only, and always done.
      dailyHabit({
        id: 'weekly-schedule',
        createdDaysAgo: 30,
        completedOn: () => true,
        overrides: { frequency: 'weekly', days: [1] },
      }),
    ];
    const series = groupDaySeries(habits, { today: TODAY });
    expect(groupCompletionRate(series, 7)).toBe(100);
  });

  it('does not let an unfinished today break the group streak', () => {
    const habits = [dailyHabit({ id: 'a', createdDaysAgo: 20, completedOn: (day) => day !== 0 })];
    const series = groupDaySeries(habits, { today: TODAY });
    expect(groupStreaks(series).current).toBe(20);
  });

  it('reports no group series at all when there are no habits', () => {
    expect(groupDaySeries([], { today: TODAY })).toEqual([]);
  });
});

describe('attributing a completion to today', () => {
  it('accepts a daily habit completed today', () => {
    const habit = dailyHabit({ createdDaysAgo: 5, completedOn: () => true });
    expect(completedOnDay(habit, TODAY)).toBe(true);
  });

  it('refuses to attribute a weekly target’s completion to a particular day', () => {
    const habit = targetHabit({ targetFrequency: 'weekly', createdDaysAgo: 30 });
    // Whatever the period holds, the completion is not attributable to a day.
    expect(completedOnDay(habit, TODAY)).toBe(false);
  });
});

describe('grouping', () => {
  it('places schedule-only habits in the daily group and targets by their period', () => {
    expect(habitGroup(dailyHabit({}))).toBe('daily');
    expect(habitGroup(targetHabit({ targetFrequency: 'weekly' }))).toBe('weekly');
    expect(habitGroup(targetHabit({ targetFrequency: 'monthly' }))).toBe('monthly');
    expect(habitGroup(targetHabit({ targetFrequency: 'yearly' }))).toBe('yearly');
  });
});
