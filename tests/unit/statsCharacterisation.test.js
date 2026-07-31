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
import { calculateActivityStatistics } from '../../src/features/fitness/helpers/activityStats.js';
import {
  calculateHabitStatistics,
  calculateCurrentStreak,
  calculateHabitCompletionRate,
} from '../../src/features/habits/helpers/habitStats.js';
import {
  STRENGTH_ACTIVITY,
  TIME_ACTIVITY,
  TODAY,
  dailyHabit,
  record,
  recordedActivities,
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

describe('activity statistics as they behave today', () => {
  it('truncates a decimal duration, disagreeing with its own best-session card', () => {
    seed({
      activities: [TIME_ACTIVITY],
      recordedActivities: recordedActivities([
        record({ id: 'a', daysBack: 40, duration: 1.5, durationUnit: 'hours' }),
        record({ id: 'b', daysBack: 10, duration: 30, durationUnit: 'minutes' }),
      ]),
    });

    const stats = calculateActivityStatistics('act-run');

    // BUG(C1): parseInt('1.5') === 1, so 90 minutes is banked as 60.
    expect(stats.totalDuration).toBe(90);
    // ...while the record chosen as "best" still holds its true 90 minutes.
    expect(stats.bestSession.duration).toBe(1.5);
  });

  it('dilutes the duration average with sessions that carry no duration', () => {
    seed({
      activities: [TIME_ACTIVITY],
      recordedActivities: recordedActivities([
        record({ id: 'a', daysBack: 6, duration: 90 }),
        record({ id: 'b', daysBack: 4, duration: 30 }),
        // A quick-record: deliberately logged with no metrics at all.
        record({ id: 'c', daysBack: 2 }),
      ]),
    });

    const stats = calculateActivityStatistics('act-run');

    expect(stats.totalDuration).toBe(120);
    expect(stats.totalSessions).toBe(3);
    // BUG(C3): divided by every session, not by the two that have a duration.
    expect(stats.averageDuration).toBe(40);
  });

  it('picks the best strength session by its best single set', () => {
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

    const stats = calculateActivityStatistics('act-bench');

    // BUG(C2): 1500 kg of total volume loses to a session of 600.
    expect(stats.bestSession.id).toBe('single-heavy');
  });

  it('treats the day a session was logged as the day it was performed', () => {
    seed({
      activities: [TIME_ACTIVITY],
      recordedActivities: recordedActivities([
        // Performed 60 days ago, back-filled into the app today.
        record({ id: 'backdated', daysBack: 60, loggedDaysBack: 0, duration: 30 }),
      ]),
    });

    const stats = calculateActivityStatistics('act-run');

    // BUG(C4): counted inside the 30-day window because it was *logged* today.
    expect(stats.recentFrequency).toBe(1);
  });

  it('reports an implausible weekly average for a brand-new activity', () => {
    seed({
      activities: [TIME_ACTIVITY],
      recordedActivities: recordedActivities([
        record({ id: 'a', daysBack: 1, duration: 30 }),
        record({ id: 'b', daysBack: 0, duration: 30 }),
      ]),
    });

    const stats = calculateActivityStatistics('act-run');

    // BUG(C5): two sessions across one day extrapolates to fourteen a week.
    expect(stats.weeklyAverage).toBeGreaterThan(10);
  });
});

describe('habit statistics as they behave today', () => {
  it('counts a skipped day as a missed day', () => {
    seed({
      categories: [{ id: 'cat-health', name: 'Health', color: '#34C759' }],
      // Six days old, completed every day except the one that was skipped.
      habits: [
        dailyHabit({
          createdDaysAgo: 6,
          completedOn: (day) => day !== 3,
          skippedDaysAgo: [3],
        }),
      ],
    });

    const habit = { ...dailyHabit({ createdDaysAgo: 6, completedOn: (day) => day !== 3, skippedDaysAgo: [3] }) };
    const rate = calculateHabitCompletionRate(habit, 7);

    // BUG(H1): 6 completions over 7 scheduled days. The skipped day belongs in
    // neither numerator nor denominator, which would read 100%.
    expect(Math.round(rate)).toBe(86);
  });

  it('breaks the current streak on a skipped day', () => {
    const habit = dailyHabit({
      createdDaysAgo: 10,
      completedOn: (day) => day !== 2,
      skippedDaysAgo: [2],
    });
    seed({ categories: [], habits: [habit] });

    // BUG(H1): the skip stops the walk, so a ten-day run reads as two days.
    expect(calculateCurrentStreak(habit)).toBe(2);
  });

  it('reports a zero current streak until today is completed', () => {
    const habit = dailyHabit({
      createdDaysAgo: 30,
      // Everything done except today, which has not happened yet.
      completedOn: (day) => day !== 0,
    });
    seed({ categories: [], habits: [habit] });

    // BUG(H2): a 30-day run reads as 0 from midnight until today is ticked.
    expect(calculateCurrentStreak(habit)).toBe(0);
  });

  it('erases a paused habit’s entire history', () => {
    const habit = dailyHabit({
      id: 'habit-paused',
      createdDaysAgo: 30,
      completedOn: () => true,
      overrides: { paused: true },
    });
    seed({ categories: [], habits: [habit] });

    const stats = calculateHabitStatistics('habit-paused');

    // BUG(H6): thirty completed days, all invisible, because pause applies to
    // every past date rather than from the moment of pausing.
    expect(stats.totalCompletions).toBe(0);
    expect(stats.longestStreak).toBe(0);
  });

  it('never shows its empty state, however new the habit is', () => {
    const habit = dailyHabit({ id: 'habit-new', createdDaysAgo: 0, completedOn: () => null });
    seed({ categories: [], habits: [habit] });

    const stats = calculateHabitStatistics('habit-new');

    // BUG(U3): the modal's empty state is gated on daysTracked === 0, and every
    // group floors the count at 1.
    expect(stats.daysTracked).toBeGreaterThanOrEqual(1);
  });
});
