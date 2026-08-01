/**
 * Characterisation tests: what the statistics calculators do **today**.
 *
 * Assertions tagged `BUG(<finding>)` encode behaviour the stats audit
 * (docs/stats/STATS_FORENSIC_AUDIT_AND_PLAN.md) identified as wrong. They exist
 * so the corrective phase has to change them deliberately rather than by
 * accident, and so any *other* drift shows up as a failure. When a finding is
 * fixed, its assertion is flipped to the corrected value and the tag removed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionTypes, dispatch } from '../../src/core/state.js';
import {
  calculateActivityStatistics,
  extractProgressionSeries,
} from '../../src/features/fitness/helpers/activityStats.js';
import { calculateHabitStatistics } from '../../src/features/habits/helpers/habitStats.js';
import {
  STRENGTH_ACTIVITY,
  TIME_ACTIVITY,
  TODAY,
  dailyHabit,
  daysAgo,
  keyDaysAgo,
  record,
  recordedActivities,
  targetHabit,
} from '../fixtures/statsScenarios.js';

/**
 * Replaces the whole store with a snapshot, the way the test harness seeds it.
 * @param {Object} snapshot Partial state.
 * @returns {void}
 */
function seed(snapshot) {
  dispatch({ type: ActionTypes.RESET_STATE, meta: { source: 'test' } });
  dispatch({ type: ActionTypes.HYDRATE_CACHE, payload: snapshot, meta: { source: 'test' } });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('activity statistics', () => {
  it('keeps the fraction of a decimal duration', () => {
    seed({
      activities: [TIME_ACTIVITY],
      recordedActivities: recordedActivities([
        record({ id: 'a', daysBack: 40, duration: 1.5, durationUnit: 'hours' }),
        record({ id: 'b', daysBack: 10, duration: 30, durationUnit: 'minutes' }),
      ]),
    });

    const stats = calculateActivityStatistics('act-run', TODAY);

    // FIXED(C1): ninety minutes plus thirty, not sixty plus thirty.
    expect(stats.totalDuration).toBe(120);
    expect(stats.bestSession.id).toBe('a');
  });

  it('averages duration over the sessions that have one', () => {
    seed({
      activities: [TIME_ACTIVITY],
      recordedActivities: recordedActivities([
        record({ id: 'a', daysBack: 6, duration: 90 }),
        record({ id: 'b', daysBack: 4, duration: 30 }),
        // A quick-record: deliberately logged with no metrics at all.
        record({ id: 'c', daysBack: 2 }),
      ]),
    });

    const stats = calculateActivityStatistics('act-run', TODAY);

    expect(stats.totalSessions).toBe(3);
    expect(stats.unloggedSessions).toBe(1);
    // FIXED(C3): 120 over the two timed sessions, not over all three.
    expect(stats.averageDuration).toBe(60);
  });

  it('picks the best strength session by the work it did in total', () => {
    seed({
      activities: [STRENGTH_ACTIVITY],
      recordedActivities: recordedActivities([
        record({
          id: 'volume',
          activityId: 'act-bench',
          daysBack: 6,
          sets: [
            { reps: '10', value: '50', unit: 'kg' },
            { reps: '10', value: '50', unit: 'kg' },
            { reps: '10', value: '50', unit: 'kg' },
          ],
        }),
        record({
          id: 'single-heavy',
          activityId: 'act-bench',
          daysBack: 2,
          sets: [{ reps: '10', value: '60', unit: 'kg' }],
        }),
      ]),
    });

    const stats = calculateActivityStatistics('act-bench', TODAY);

    // FIXED(C2): 1500 kg of volume beats 600.
    expect(stats.bestSession.id).toBe('volume');
    expect(stats.totalVolume).toBe(2100);
    // The heaviest single lift is still reported, as its own record.
    expect(stats.personalBests.heaviest.value).toBe(60);
  });

  it('counts a session on the day it was performed, not the day it was typed in', () => {
    seed({
      activities: [TIME_ACTIVITY],
      recordedActivities: recordedActivities([
        // Performed 60 days ago, back-filled into the app today.
        record({ id: 'backdated', daysBack: 60, loggedDaysBack: 0, duration: 30 }),
      ]),
    });

    const stats = calculateActivityStatistics('act-run', TODAY);

    // FIXED(C4): outside the 30-day window, where it belongs.
    expect(stats.recentFrequency).toBe(0);
    expect(stats.lastPerformed).toBe(keyDaysAgo(60));
  });

  it('does not extrapolate a week from a single day', () => {
    seed({
      activities: [TIME_ACTIVITY],
      recordedActivities: recordedActivities([
        record({ id: 'a', daysBack: 1, duration: 30 }),
        record({ id: 'b', daysBack: 0, duration: 30 }),
      ]),
    });

    const stats = calculateActivityStatistics('act-run', TODAY);

    // FIXED(C5): two sessions in the first week reads as two a week.
    expect(stats.weeklyAverage).toBe(2);
  });

  it('leaves bodyweight sessions out of the weight progression', () => {
    seed({
      activities: [STRENGTH_ACTIVITY],
      recordedActivities: recordedActivities([
        record({
          id: 'weighted',
          activityId: 'act-bench',
          daysBack: 6,
          sets: [{ reps: '8', value: '60', unit: 'kg' }],
        }),
        record({
          id: 'bodyweight',
          activityId: 'act-bench',
          daysBack: 3,
          sets: [{ reps: '20', value: '', unit: 'none' }],
        }),
      ]),
    });

    const { points } = extractProgressionSeries({ ...STRENGTH_ACTIVITY });

    // FIXED(C8): one point, not a second one plotted at zero.
    expect(points).toHaveLength(1);
    expect(points[0].value).toBe(60);
  });
});

describe('habit statistics', () => {
  it('leaves a skipped day out of the completion rate', () => {
    const habit = dailyHabit({
      createdDaysAgo: 6,
      completedOn: (day) => (day === 3 ? null : true),
      skippedDaysAgo: [3],
    });
    seed({ categories: [{ id: 'cat-health', name: 'Health', color: '#34C759' }], habits: [habit] });

    const stats = calculateHabitStatistics(habit.id, TODAY);

    // FIXED(H1): six of six decided days. The skip is in neither side.
    expect(stats.completionRateTotal).toBe(100);
    expect(stats.totalSkipped).toBe(1);
  });

  it('steps over a skipped day rather than breaking the streak', () => {
    const habit = dailyHabit({
      createdDaysAgo: 10,
      completedOn: (day) => (day === 2 ? null : true),
      skippedDaysAgo: [2],
    });
    seed({ categories: [], habits: [habit] });

    const stats = calculateHabitStatistics(habit.id, TODAY);

    // FIXED(H1): eleven days, one of them stood down, none of them broken.
    expect(stats.currentStreak).toBe(10);
  });

  it('keeps the streak alive until today has actually been missed', () => {
    const habit = dailyHabit({
      createdDaysAgo: 30,
      // Everything done except today, which has not happened yet.
      completedOn: (day) => day !== 0,
    });
    seed({ categories: [], habits: [habit] });

    const stats = calculateHabitStatistics(habit.id, TODAY);

    // FIXED(H2): thirty days, still standing, all morning.
    expect(stats.currentStreak).toBe(30);
  });

  it('keeps a paused habit’s history', () => {
    const habit = dailyHabit({
      id: 'habit-paused',
      createdDaysAgo: 30,
      completedOn: () => true,
      overrides: { paused: true },
    });
    seed({ categories: [], habits: [habit] });

    const stats = calculateHabitStatistics('habit-paused', TODAY);

    // FIXED(H6): thirty-one completed days, all still there.
    expect(stats.totalCompletions).toBe(31);
    expect(stats.longestStreak).toBe(31);
  });

  it('shows an empty state for a habit that has nothing to report', () => {
    const habit = dailyHabit({ id: 'habit-new', createdDaysAgo: 0, completedOn: () => null });
    seed({ categories: [], habits: [habit] });

    const stats = calculateHabitStatistics('habit-new', TODAY);

    // FIXED(U3): today is pending, nothing has resolved, so there is no data.
    expect(stats.hasData).toBe(false);
  });

  it('reports the day a period habit was completed, never a future boundary', () => {
    const monday = daysAgo(TODAY.getDay() === 0 ? 6 : TODAY.getDay() - 1);
    const habit = targetHabit({
      id: 'habit-weekly',
      targetFrequency: 'weekly',
      createdDaysAgo: 30,
      completed: { [weekKeyFor(monday)]: true },
    });
    seed({ categories: [], habits: [habit] });

    const stats = calculateHabitStatistics('habit-weekly', TODAY);

    // FIXED(H9): a real day in the past, so "last completed" cannot read as
    // "-2 days ago" from a period end that has not arrived.
    expect(stats.lastCompleted).not.toBeNull();
    expect(stats.lastCompleted <= keyDaysAgo(0)).toBe(true);
  });
});

/**
 * The weekly period key the app stores completions under.
 * @param {Date} date Any date in the week.
 * @returns {string} Period key.
 */
function weekKeyFor(date) {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  const week = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getFullYear()}-W${week}`;
}
