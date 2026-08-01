/**
 * A budget for the Stats page's arithmetic.
 *
 * This calculation used to be quadratic in history length, because deriving a
 * habit's start date scanned every completion it had ever recorded and sat
 * inside a per-day scheduling check. Two years of a dozen habits took most of a
 * second to work out, on every state change while the page was open.
 *
 * The gate is deliberately loose relative to the measured figure: this runs on
 * whatever machine CI gives it, and the failure worth catching is a return to
 * quadratic growth, not a few milliseconds of drift.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionTypes, dispatch } from '../../src/core/state.js';
import { calculateHabitStatistics } from '../../src/features/stats/habitPageStats.js';
import { calculateFitnessStatistics } from '../../src/features/stats/fitnessStats.js';
import { TODAY, dailyHabit } from '../fixtures/statsScenarios.js';

/** What a large-but-real account looks like. */
const HABITS = 12;
const DAYS = 730;
const BUDGET_MS = 400;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Stats page calculation cost', () => {
  it('works out two years of a dozen habits well inside a frame budget', () => {
    const habits = Array.from({ length: HABITS }, (_, index) =>
      dailyHabit({
        id: `habit-${index}`,
        createdDaysAgo: DAYS,
        completedOn: (day) => (day + index) % 5 !== 0,
        skippedDaysAgo: Array.from({ length: 40 }, (_, skip) => skip * 17 + index),
      })
    );

    dispatch({ type: ActionTypes.RESET_STATE, meta: { source: 'test' } });
    dispatch({
      type: ActionTypes.HYDRATE_CACHE,
      payload: { habits, categories: [{ id: 'cat-health', name: 'Health', color: '#34C759' }] },
      meta: { source: 'test' },
    });

    // One warm run, so the measurement is of steady state rather than of the
    // first-touch caches every real render after the first also enjoys.
    calculateHabitStatistics(TODAY);

    // Best of several, because this shares a machine with whatever else is
    // running. A single sample can be descheduled mid-measurement and report a
    // number that says more about the CPU it competed for than about this code;
    // a quadratic regression is slow in every sample, so the best one still
    // catches it.
    let elapsed = Infinity;
    let stats = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const started = performance.now();
      stats = calculateHabitStatistics(TODAY);
      calculateFitnessStatistics(TODAY);
      elapsed = Math.min(elapsed, performance.now() - started);
    }

    // The work was actually done, not skipped by an empty-state short circuit.
    expect(stats.dailySeries.length).toBeGreaterThan(DAYS - 2);
    expect(stats.completionRates).toHaveLength(HABITS);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it('grows with history rather than with history squared', () => {
    const build = (days) => {
      const habits = Array.from({ length: 6 }, (_, index) =>
        dailyHabit({
          id: `habit-${index}`,
          createdDaysAgo: days,
          completedOn: (day) => (day + index) % 4 !== 0,
        })
      );
      dispatch({ type: ActionTypes.RESET_STATE, meta: { source: 'test' } });
      dispatch({
        type: ActionTypes.HYDRATE_CACHE,
        payload: { habits, categories: [] },
        meta: { source: 'test' },
      });
      calculateHabitStatistics(TODAY);
      const started = performance.now();
      calculateHabitStatistics(TODAY);
      return performance.now() - started;
    };

    // Best of three for the same reason as above: the ratio is only meaningful
    // if both halves were measured on a machine that was paying attention.
    const bestOf = (days) => Math.min(build(days), build(days), build(days));
    const short = Math.max(bestOf(180), 0.5);
    const long = bestOf(720);

    // Four times the history should cost roughly four times as much. Ten times
    // as much would mean the per-day work had started scanning the history
    // again, which is the regression this guards.
    expect(long / short).toBeLessThan(10);
  });
});
