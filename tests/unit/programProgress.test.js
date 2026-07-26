import { describe, expect, it } from 'vitest';
import {
  computeProgramProgress,
  currentWeek,
  inclusiveDayCount,
  plannedDates,
} from '../../src/features/fitness/helpers/programProgress.js';

const MON_WED_FRI = [
  { dayOfWeek: 1, routineId: 'r1' },
  { dayOfWeek: 3, routineId: 'r2' },
  { dayOfWeek: 5, routineId: 'r1' },
];

// The plan's worked example: 20 Oct – 13 Dec 2026, Mon/Wed/Fri. 55 days spans
// eight calendar weeks, but 20 Oct 2026 is a **Tuesday**, so the first Monday
// falls on the 21st and the range holds 23 sessions rather than the 24 the plan
// states. The maths below is anchored to the real calendar.
const PROGRAM = {
  startDate: '2026-10-20',
  endDate: '2026-12-13',
  scheduledDays: MON_WED_FRI,
};

// Monday-anchored: 19 Oct – 13 Dec 2026 is exactly 56 days, so eight whole
// weeks at three sessions each — the 24 the plan was reaching for.
const MONDAY_PROGRAM = {
  startDate: '2026-10-19',
  endDate: '2026-12-13',
  scheduledDays: MON_WED_FRI,
};

describe('inclusiveDayCount', () => {
  it('counts both ends of the range', () => {
    expect(inclusiveDayCount('2026-10-20', '2026-10-20')).toBe(1);
    expect(inclusiveDayCount('2026-10-20', '2026-10-21')).toBe(2);
    expect(inclusiveDayCount('2026-10-20', '2026-12-13')).toBe(55);
  });

  it('returns 0 for inverted or malformed ranges', () => {
    expect(inclusiveDayCount('2026-12-13', '2026-10-20')).toBe(0);
    expect(inclusiveDayCount('', '2026-10-20')).toBe(0);
    expect(inclusiveDayCount('not-a-date', 'nope')).toBe(0);
  });

  it('is unaffected by a DST boundary inside the range', () => {
    // Europe/Malta ends DST on 25 Oct 2026; a naive local-time diff would give 30.958 days.
    expect(inclusiveDayCount('2026-10-20', '2026-11-20')).toBe(32);
    // Northern-hemisphere spring forward, 29 Mar 2026.
    expect(inclusiveDayCount('2026-03-20', '2026-04-10')).toBe(22);
  });
});

describe('plannedDates', () => {
  it('lists one date per scheduled weekday', () => {
    const dates = plannedDates(PROGRAM.startDate, PROGRAM.endDate, MON_WED_FRI);
    // 20 Oct 2026 is a Tuesday, so the first scheduled day is the 21st.
    expect(dates).toHaveLength(23);
    expect(dates[0]).toBe('2026-10-21');
    expect(dates.at(-1)).toBe('2026-12-11');
  });

  it('lists 24 sessions for eight whole weeks from a Monday', () => {
    const dates = plannedDates(MONDAY_PROGRAM.startDate, MONDAY_PROGRAM.endDate, MON_WED_FRI);
    expect(dates).toHaveLength(24);
    expect(dates[0]).toBe('2026-10-19');
    expect(dates.at(-1)).toBe('2026-12-11');
  });

  it('returns nothing without a schedule or with an invalid range', () => {
    expect(plannedDates(PROGRAM.startDate, PROGRAM.endDate, [])).toEqual([]);
    expect(plannedDates('2026-12-13', '2026-10-20', MON_WED_FRI)).toEqual([]);
  });

  it('treats 0 as Sunday', () => {
    const sundays = plannedDates('2026-10-20', '2026-11-02', [{ dayOfWeek: 0 }]);
    expect(sundays).toEqual(['2026-10-25', '2026-11-01']);
  });
});

describe('currentWeek', () => {
  it('reports eight weeks for the reference program', () => {
    expect(currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-10-20').totalWeeks).toBe(8);
  });

  it('is week 1 on the start date', () => {
    const position = currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-10-20');
    expect(position).toMatchObject({ week: 1, phase: 'during' });
  });

  it('advances a week every seven days', () => {
    expect(currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-10-26').week).toBe(1);
    expect(currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-10-27').week).toBe(2);
    // 20 Oct + 27 days = 16 Nov, which is week 4.
    expect(currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-11-16').week).toBe(4);
  });

  it('is the final week on the end date', () => {
    const position = currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-12-13');
    expect(position).toMatchObject({ week: 8, totalWeeks: 8, phase: 'during' });
  });

  it('reports the after phase past the end date', () => {
    const position = currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-12-14');
    expect(position).toMatchObject({ week: 8, phase: 'after' });
  });

  it('reports the before phase and a countdown ahead of the start', () => {
    const position = currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-10-10');
    expect(position).toMatchObject({ week: 1, phase: 'before', daysUntilStart: 10 });
  });
});

describe('computeProgramProgress', () => {
  it('counts 24 planned workouts for eight whole weeks at three a week', () => {
    const progress = computeProgramProgress({
      program: MONDAY_PROGRAM,
      todayISO: '2026-12-13',
    });
    expect(progress.plannedWorkouts).toBe(24);
    expect(progress.totalWeeks).toBe(8);
  });

  it('counts 23 for the plan\'s Tuesday-start range', () => {
    const progress = computeProgramProgress({ program: PROGRAM, todayISO: '2026-12-13' });
    expect(progress.plannedWorkouts).toBe(23);
    expect(progress.totalWeeks).toBe(8);
  });

  it('counts only planned dates on or before today that have records', () => {
    const progress = computeProgramProgress({
      program: PROGRAM,
      todayISO: '2026-10-23',
      recordedActivities: {
        '2026-10-20': [{ id: 'a' }],
        '2026-10-21': [{ id: 'b' }], // not a scheduled weekday
        '2026-10-23': [{ id: 'c' }],
        '2026-10-26': [{ id: 'd' }], // in the future
      },
    });
    expect(progress.completedWorkouts).toBe(2);
    expect(progress.percent).toBe(9); // 2/23 rounded
  });

  it('skips rest days even when records exist', () => {
    const withoutRest = computeProgramProgress({
      program: PROGRAM,
      todayISO: '2026-10-23',
      recordedActivities: { '2026-10-20': [{ id: 'a' }], '2026-10-21': [{ id: 'b' }] },
    });
    expect(withoutRest.completedWorkouts).toBe(1);

    const withRest = computeProgramProgress({
      program: PROGRAM,
      todayISO: '2026-10-23',
      recordedActivities: { '2026-10-20': [{ id: 'a' }] },
      restDays: { '2026-10-20': true },
    });
    expect(withRest.completedWorkouts).toBe(0);
  });

  it('ignores planned dates with no records', () => {
    const progress = computeProgramProgress({
      program: PROGRAM,
      todayISO: '2026-11-30',
      recordedActivities: {},
    });
    expect(progress.completedWorkouts).toBe(0);
    expect(progress.percent).toBe(0);
  });

  it('never divides by zero when nothing is scheduled', () => {
    const progress = computeProgramProgress({
      program: { ...PROGRAM, scheduledDays: [] },
      todayISO: '2026-11-30',
      recordedActivities: { '2026-11-30': [{ id: 'a' }] },
    });
    expect(progress.plannedWorkouts).toBe(0);
    expect(progress.percent).toBe(0);
  });

  it('reaches 100 percent when every planned session is done', () => {
    const planned = plannedDates(
      MONDAY_PROGRAM.startDate,
      MONDAY_PROGRAM.endDate,
      MON_WED_FRI
    );
    const recordedActivities = Object.fromEntries(planned.map((date) => [date, [{ id: date }]]));
    const progress = computeProgramProgress({
      program: MONDAY_PROGRAM,
      todayISO: '2026-12-13',
      recordedActivities,
    });
    expect(progress.completedWorkouts).toBe(24);
    expect(progress.percent).toBe(100);
  });

  it('handles a missing program without throwing', () => {
    expect(computeProgramProgress({ program: null, todayISO: '2026-12-13' })).toMatchObject({
      plannedWorkouts: 0,
      percent: 0,
    });
    expect(computeProgramProgress()).toMatchObject({ percent: 0 });
  });

  it('counts a DST-spanning program correctly', () => {
    // 20 Oct to 20 Nov 2026 crosses the European DST change on 25 Oct.
    const program = {
      startDate: '2026-10-20',
      endDate: '2026-11-20',
      scheduledDays: [{ dayOfWeek: 1 }],
    };
    const progress = computeProgramProgress({ program, todayISO: '2026-11-20' });
    // Mondays: 26 Oct, 2, 9, 16 Nov.
    expect(progress.plannedWorkouts).toBe(4);
    expect(progress.totalWeeks).toBe(5);
  });
});
