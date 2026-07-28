import { describe, expect, it } from 'vitest';
import {
  allocateWeek,
  computeProgramProgress,
  currentWeek,
  inclusiveDayCount,
  plannedSlots,
  programWeeks,
  scheduleSegments,
  weekStart,
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

// One week, Monday 19 Oct to Sunday 25 Oct 2026, with the routines resolved so
// the maths can tell a matching session from an unrelated one.
const ONE_WEEK = {
  startDate: '2026-10-19',
  endDate: '2026-10-25',
  scheduledDays: [
    { dayOfWeek: 1, routineId: 'r1' },
    { dayOfWeek: 3, routineId: 'r2' },
  ],
};
const ROUTINE_ACTIVITIES = { r1: ['push'], r2: ['pull'] };

/**
 * Builds a recordedActivities map from date → activity ids.
 * @param {Object<string, string[]>} byDate Activity ids trained on each date.
 * @returns {Object<string, Array<{activityId: string}>>} Record map.
 */
function records(byDate) {
  return Object.fromEntries(
    Object.entries(byDate).map(([date, ids]) => [date, ids.map((activityId) => ({ activityId }))])
  );
}

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

describe('plannedSlots', () => {
  it('lists one slot per scheduled weekday', () => {
    const slots = plannedSlots(PROGRAM);
    // 20 Oct 2026 is a Tuesday, so the first scheduled day is the 21st.
    expect(slots).toHaveLength(23);
    expect(slots[0]).toMatchObject({ date: '2026-10-21', type: 'routine', id: 'r2' });
    expect(slots.at(-1).date).toBe('2026-12-11');
  });

  it('lists 24 slots for eight whole weeks from a Monday', () => {
    const slots = plannedSlots(MONDAY_PROGRAM);
    expect(slots).toHaveLength(24);
    expect(slots[0].date).toBe('2026-10-19');
    expect(slots.at(-1).date).toBe('2026-12-11');
  });

  it('gives a day pinning two things two slots', () => {
    const slots = plannedSlots({
      startDate: '2026-10-19',
      endDate: '2026-10-19',
      scheduledDays: [
        { dayOfWeek: 1, routineId: 'r1' },
        { dayOfWeek: 1, activityId: 'run' },
      ],
    });
    expect(slots).toHaveLength(2);
    expect(slots[1]).toMatchObject({ date: '2026-10-19', type: 'activity', id: 'run' });
  });

  it('returns nothing without a schedule or with an invalid range', () => {
    expect(plannedSlots({ ...PROGRAM, scheduledDays: [] })).toEqual([]);
    expect(plannedSlots({ ...PROGRAM, startDate: '2026-12-13', endDate: '2026-10-20' })).toEqual([]);
    expect(plannedSlots(null)).toEqual([]);
  });

  it('treats 0 as Sunday', () => {
    const slots = plannedSlots({
      startDate: '2026-10-20',
      endDate: '2026-11-02',
      scheduledDays: [{ dayOfWeek: 0, routineId: 'r1' }],
    });
    expect(slots.map((slot) => slot.date)).toEqual(['2026-10-25', '2026-11-01']);
  });

  it('excludes rest weekdays', () => {
    // Wednesday marked as rest removes it from a Mon/Wed/Fri schedule.
    const slots = plannedSlots({ ...MONDAY_PROGRAM, restDays: [3] });
    expect(slots).toHaveLength(16);
    expect(slots.some((slot) => slot.dayOfWeek === 3)).toBe(false);
  });
});

describe('backdated programs', () => {
  // Created on Wednesday 28 Oct, started the Monday of the week before.
  const BACKDATED = {
    startDate: '2026-10-19',
    endDate: '2026-11-08',
    createdAt: '2026-10-28',
    scheduledDays: [{ dayOfWeek: 1, activityId: 'bench' }],
  };

  it('finds the Monday of a week', () => {
    expect(weekStart('2026-10-28')).toBe('2026-10-26');
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
    // Sunday belongs to the week that opened six days earlier.
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
  });

  it('earns nothing for a week that ended before the program was made', () => {
    const progress = computeProgramProgress({
      program: BACKDATED,
      todayISO: '2026-11-08',
      // Trained on the pinned Monday of every week, including the one before
      // the program existed.
      recordedActivities: records({
        '2026-10-19': ['bench'],
        '2026-10-26': ['bench'],
        '2026-11-02': ['bench'],
      }),
    });

    // Week one is planned but uncreditable; the rest count as usual.
    expect(progress.weeks[0]).toMatchObject({ planned: 1, completed: 0 });
    expect(progress.weeks[1]).toMatchObject({ planned: 1, completed: 1 });
    expect(progress.weeks[2]).toMatchObject({ planned: 1, completed: 1 });
    expect(progress.completedWorkouts).toBe(2);
  });

  it('credits a session earlier in the week the program was created in', () => {
    const progress = computeProgramProgress({
      program: BACKDATED,
      todayISO: '2026-10-28',
      // Monday the 26th: two days before the program was made, same week.
      recordedActivities: records({ '2026-10-26': ['bench'] }),
    });
    expect(progress.weeks[1]).toMatchObject({ planned: 1, completed: 1 });
  });

  it('leaves a program with no creation date crediting everything', () => {
    const { createdAt, ...undated } = BACKDATED;
    expect(createdAt).toBe('2026-10-28');
    const progress = computeProgramProgress({
      program: undated,
      todayISO: '2026-11-08',
      recordedActivities: records({ '2026-10-19': ['bench'] }),
    });
    expect(progress.weeks[0]).toMatchObject({ completed: 1 });
  });
});

describe('schedule history', () => {
  // Pinned to Monday until the 21st, Wednesday from the 22nd on.
  const EDITED = {
    startDate: '2026-10-19',
    endDate: '2026-11-01',
    scheduledDays: [{ dayOfWeek: 3, routineId: 'r2' }],
    schedulePhases: [
      {
        startDate: '2026-10-19',
        endDate: '2026-10-21',
        scheduledDays: [{ dayOfWeek: 1, routineId: 'r1' }],
        restDays: [],
      },
    ],
  };

  it('runs each schedule over the dates it was in force', () => {
    const segments = scheduleSegments(EDITED);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ from: '2026-10-19', to: '2026-10-21' });
    // The live schedule picks up the day after the last phase ends.
    expect(segments[1]).toMatchObject({ from: '2026-10-22', to: null });
  });

  it('treats a program with no history as one schedule from its start', () => {
    expect(scheduleSegments(ONE_WEEK)).toEqual([
      {
        from: '2026-10-19',
        to: null,
        scheduledDays: ONE_WEEK.scheduledDays,
        restDays: [],
        routineSnapshots: [],
      },
    ]);
  });

  it('keeps the old plan on past dates and the new one after', () => {
    const slots = plannedSlots(EDITED);
    // Monday the 19th under the old plan; the 26th is no longer planned.
    expect(slots.filter((slot) => slot.date === '2026-10-19')).toHaveLength(1);
    expect(slots.find((slot) => slot.date === '2026-10-19').id).toBe('r1');
    expect(slots.some((slot) => slot.date === '2026-10-26')).toBe(false);
    // Wednesdays from the 22nd on belong to the new plan; the 21st predates it.
    expect(slots.some((slot) => slot.date === '2026-10-21')).toBe(false);
    expect(slots.filter((slot) => slot.id === 'r2').map((slot) => slot.date)).toEqual([
      '2026-10-28',
    ]);
  });

  it('never lets an edit add work to a week that has already happened', () => {
    const progress = computeProgramProgress({
      program: EDITED,
      todayISO: '2026-11-01',
      recordedActivities: records({ '2026-10-19': ['push'] }),
      routineActivities: ROUTINE_ACTIVITIES,
    });

    // Week one holds only the Monday the old plan asked for, and it is ticked.
    const [first] = progress.weeks;
    expect(first.days.map((day) => day.date)).toEqual(['2026-10-19']);
    expect(first).toMatchObject({ planned: 1, completed: 1 });
    // Week two is the new plan's Wednesday, untouched.
    expect(progress.weeks[1].days.map((day) => day.date)).toEqual(['2026-10-28']);
    expect(progress.plannedWorkouts).toBe(2);
  });

  it('stops planning an archived item from the day it was archived', () => {
    const program = {
      startDate: '2026-10-19',
      endDate: '2026-11-01',
      scheduledDays: [{ dayOfWeek: 1, routineId: 'r1' }],
    };
    // Archived on the Wednesday of week one: that week's Monday keeps it, the
    // following Monday never gets it.
    const slots = plannedSlots(program, { archivedFrom: { r1: '2026-10-21' } });
    expect(slots.map((slot) => slot.date)).toEqual(['2026-10-19']);
  });

  it('keeps a session recorded against an archived routine ticked', () => {
    const program = {
      startDate: '2026-10-19',
      endDate: '2026-10-25',
      scheduledDays: [{ dayOfWeek: 1, routineId: 'r1' }],
    };
    const progress = computeProgramProgress({
      program,
      todayISO: '2026-10-25',
      recordedActivities: records({ '2026-10-19': ['push'] }),
      routineActivities: ROUTINE_ACTIVITIES,
      archivedFrom: { r1: '2026-10-21' },
    });
    expect(progress.plannedWorkouts).toBe(1);
    expect(progress.completedWorkouts).toBe(1);
  });

  it('matches a past slot against the routine as it was, not as it is', () => {
    const program = {
      startDate: '2026-10-19',
      endDate: '2026-11-01',
      scheduledDays: [{ dayOfWeek: 1, routineId: 'r1' }],
      schedulePhases: [
        {
          startDate: '2026-10-19',
          endDate: '2026-10-25',
          scheduledDays: [{ dayOfWeek: 1, routineId: 'r1' }],
          restDays: [],
          // Push Day held Dips back then; it does not any more.
          routineSnapshots: [{ routineId: 'r1', activityIds: ['dips'] }],
        },
      ],
    };
    const progress = computeProgramProgress({
      program,
      todayISO: '2026-11-01',
      recordedActivities: records({ '2026-10-19': ['dips'] }),
      routineActivities: ROUTINE_ACTIVITIES,
    });
    // Week one still counts the session that satisfied it at the time.
    expect(progress.weeks[0]).toMatchObject({ planned: 1, completed: 1 });
    // Week two follows the routine as it stands now.
    expect(progress.weeks[1]).toMatchObject({ planned: 1, completed: 0 });
  });

  it('clamps a phase to the block when the dates move', () => {
    const trimmed = plannedSlots({ ...EDITED, startDate: '2026-10-20' });
    expect(trimmed.some((slot) => slot.date === '2026-10-19')).toBe(false);
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

  it('advances on the calendar week boundary, not seven days from the start', () => {
    // The block starts Tuesday 20 Oct, so week 1 is the four days to Sunday the
    // 25th and week 2 opens on Monday the 26th.
    expect(currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-10-25').week).toBe(1);
    expect(currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-10-26').week).toBe(2);
    expect(currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-11-01').week).toBe(2);
    // Monday 16 Nov opens the fifth calendar week of the block.
    expect(currentWeek(PROGRAM.startDate, PROGRAM.endDate, '2026-11-16').week).toBe(5);
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
      recordedActivities: records({ '2026-11-30': ['push'] }),
    });
    expect(progress.plannedWorkouts).toBe(0);
    expect(progress.percent).toBe(0);
  });

  it('reaches 100 percent when every planned session is done', () => {
    const recordedActivities = records(
      Object.fromEntries(
        plannedSlots(MONDAY_PROGRAM).map((slot) => [slot.date, ROUTINE_ACTIVITIES[slot.id]])
      )
    );
    const progress = computeProgramProgress({
      program: MONDAY_PROGRAM,
      todayISO: '2026-12-13',
      recordedActivities,
      routineActivities: ROUTINE_ACTIVITIES,
    });
    expect(progress.completedWorkouts).toBe(24);
    expect(progress.percent).toBe(100);
  });

  it('handles a missing program without throwing', () => {
    expect(computeProgramProgress({ program: null, todayISO: '2026-12-13' })).toMatchObject({
      plannedWorkouts: 0,
      percent: 0,
      weeks: [],
    });
    expect(computeProgramProgress()).toMatchObject({ percent: 0 });
  });

  it('counts a DST-spanning program correctly', () => {
    // 20 Oct to 20 Nov 2026 crosses the European DST change on 25 Oct.
    const program = {
      startDate: '2026-10-20',
      endDate: '2026-11-20',
      scheduledDays: [{ dayOfWeek: 1, routineId: 'r1' }],
    };
    const progress = computeProgramProgress({ program, todayISO: '2026-11-20' });
    // Mondays: 26 Oct, 2, 9, 16 Nov.
    expect(progress.plannedWorkouts).toBe(4);
    expect(progress.totalWeeks).toBe(5);
  });

  it('never credits a session in the future', () => {
    const progress = computeProgramProgress({
      program: ONE_WEEK,
      todayISO: '2026-10-19',
      recordedActivities: records({ '2026-10-21': ['pull'] }),
      routineActivities: ROUTINE_ACTIVITIES,
    });
    expect(progress.completedWorkouts).toBe(0);
  });

  it('counts a matching session trained on a program rest weekday', () => {
    const progress = computeProgramProgress({
      // Sunday is a program rest day, and 25 Oct 2026 is a Sunday. The program
      // plans nothing there, but work done there still counts for its week.
      program: { ...ONE_WEEK, restDays: [0] },
      todayISO: '2026-10-25',
      recordedActivities: records({ '2026-10-25': ['push'] }),
      routineActivities: ROUTINE_ACTIVITIES,
    });
    expect(progress.completedWorkouts).toBe(1);
    expect(progress.weeks[0].days[0].slots[0]).toMatchObject({
      done: true,
      doneDate: '2026-10-25',
    });
  });

  it('still ignores a session on a day the user marked as rest', () => {
    const progress = computeProgramProgress({
      program: ONE_WEEK,
      todayISO: '2026-10-25',
      recordedActivities: records({ '2026-10-19': ['push'] }),
      restDays: { '2026-10-19': true },
      routineActivities: ROUTINE_ACTIVITIES,
    });
    expect(progress.completedWorkouts).toBe(0);
  });
});

describe('weekly credit', () => {
  it('credits a pinned session done later in its week', () => {
    const progress = computeProgramProgress({
      program: ONE_WEEK,
      todayISO: '2026-10-25',
      // Monday's routine, trained on the Thursday.
      recordedActivities: records({ '2026-10-22': ['push'] }),
      routineActivities: ROUTINE_ACTIVITIES,
    });

    expect(progress.completedWorkouts).toBe(1);
    const monday = progress.weeks[0].days[0];
    expect(monday.date).toBe('2026-10-19');
    expect(monday.slots[0]).toMatchObject({ done: true, doneDate: '2026-10-22' });
  });

  it('keeps credit inside the week it was earned', () => {
    const progress = computeProgramProgress({
      program: { ...ONE_WEEK, endDate: '2026-11-01' },
      todayISO: '2026-11-01',
      // Four sessions in week one; week two is untouched.
      recordedActivities: records({
        '2026-10-19': ['push'],
        '2026-10-20': ['push'],
        '2026-10-21': ['pull'],
        '2026-10-22': ['pull'],
      }),
      routineActivities: ROUTINE_ACTIVITIES,
    });

    expect(progress.plannedWorkouts).toBe(4);
    expect(progress.completedWorkouts).toBe(2);
    expect(progress.weeks[0]).toMatchObject({ planned: 2, completed: 2, percent: 100 });
    expect(progress.weeks[1]).toMatchObject({ planned: 2, completed: 0, percent: 0 });
  });

  it('gives a matching session to the slot that asked for it', () => {
    const progress = computeProgramProgress({
      program: ONE_WEEK,
      todayISO: '2026-10-25',
      // Wednesday's own routine, on Wednesday.
      recordedActivities: records({ '2026-10-21': ['pull'] }),
      routineActivities: ROUTINE_ACTIVITIES,
    });

    const [monday, wednesday] = progress.weeks[0].days;
    expect(monday.slots[0].done).toBe(false);
    expect(wednesday.slots[0]).toMatchObject({ done: true, doneDate: '2026-10-21' });
  });

  it('lets one day satisfy two slots it genuinely trained for', () => {
    const program = {
      startDate: '2026-10-19',
      endDate: '2026-10-25',
      scheduledDays: [
        { dayOfWeek: 1, routineId: 'r1' },
        { dayOfWeek: 1, activityId: 'run' },
      ],
    };
    const progress = computeProgramProgress({
      program,
      todayISO: '2026-10-25',
      recordedActivities: records({ '2026-10-19': ['push', 'run'] }),
      routineActivities: ROUTINE_ACTIVITIES,
    });

    expect(progress.completedWorkouts).toBe(2);
    expect(progress.weeks[0].days[0].slots.every((slot) => slot.done)).toBe(true);
  });

  it('earns nothing for training the program did not ask for', () => {
    const progress = computeProgramProgress({
      program: ONE_WEEK,
      todayISO: '2026-10-25',
      // Trained on both pinned days, but neither session was the pinned work.
      recordedActivities: records({ '2026-10-19': ['yoga'], '2026-10-21': ['swim'] }),
      routineActivities: ROUTINE_ACTIVITIES,
    });

    expect(progress.completedWorkouts).toBe(0);
    expect(progress.weeks[0].days.flatMap((day) => day.slots).every((slot) => !slot.done)).toBe(
      true
    );
  });

  it('credits a session done before the day it was pinned to', () => {
    const progress = computeProgramProgress({
      program: ONE_WEEK,
      todayISO: '2026-10-20',
      // Wednesday's routine, trained on the Tuesday: the pinned day is still to
      // come, and the work is already done.
      recordedActivities: records({ '2026-10-20': ['pull'] }),
      routineActivities: ROUTINE_ACTIVITIES,
    });

    expect(progress.completedWorkouts).toBe(1);
    const wednesday = progress.weeks[0].days[1];
    expect(wednesday.date).toBe('2026-10-21');
    expect(wednesday.slots[0]).toMatchObject({ done: true, doneDate: '2026-10-20' });
  });

  it('moves a rest-marked day\'s session to the rest of its week', () => {
    const progress = computeProgramProgress({
      program: ONE_WEEK,
      todayISO: '2026-10-25',
      recordedActivities: records({ '2026-10-20': ['push'] }),
      // The user took Monday off and trained on the Tuesday instead.
      restDays: { '2026-10-19': true },
      routineActivities: ROUTINE_ACTIVITIES,
    });

    expect(progress.completedWorkouts).toBe(1);
    const monday = progress.weeks[0].days[0];
    expect(monday).toMatchObject({ date: '2026-10-19', isRestDay: true });
    expect(monday.slots[0]).toMatchObject({ done: true, doneDate: '2026-10-20' });
  });

  it('breaks the week down for the details view', () => {
    const progress = computeProgramProgress({
      program: MONDAY_PROGRAM,
      todayISO: '2026-10-21',
      recordedActivities: records({ '2026-10-19': ['push'] }),
      routineActivities: ROUTINE_ACTIVITIES,
    });

    expect(progress.weeks).toHaveLength(8);
    const [first] = progress.weeks;
    expect(first).toMatchObject({ index: 1, start: '2026-10-19', end: '2026-10-25', planned: 3 });
    expect(first.days.map((day) => day.date)).toEqual([
      '2026-10-19',
      '2026-10-21',
      '2026-10-23',
    ]);
    expect(first.completed).toBe(1);
    expect(first.percent).toBe(33);
  });
});

describe('allocateWeek', () => {
  const slots = [
    { date: '2026-10-19', type: 'routine', id: 'r1' },
    { date: '2026-10-21', type: 'routine', id: 'r2' },
  ];

  it('prefers a matching session on the slot\'s own day over one elsewhere', () => {
    const results = allocateWeek(
      slots,
      [
        { date: '2026-10-19', activityIds: new Set(['pull']) },
        { date: '2026-10-21', activityIds: new Set(['pull']) },
      ],
      ROUTINE_ACTIVITIES
    );
    // Wednesday's own session is taken by Wednesday; Monday's slot wanted push,
    // which the week never held, so it stays open rather than eating the spare.
    expect(results[1]).toMatchObject({ done: true, doneDate: '2026-10-21' });
    expect(results[0]).toMatchObject({ done: false, doneDate: null });
  });

  it('leaves a slot open when the week holds nothing', () => {
    expect(allocateWeek(slots, [], ROUTINE_ACTIVITIES)).toEqual([
      { done: false, doneDate: null },
      { done: false, doneDate: null },
    ]);
  });

  it('earns nothing from a session the slots did not ask for', () => {
    const results = allocateWeek(
      slots,
      [{ date: '2026-10-20', activityIds: new Set(['yoga']) }],
      ROUTINE_ACTIVITIES
    );
    expect(results.every((result) => !result.done)).toBe(true);
  });

  it('never spends one session on two slots', () => {
    // Two Push Days in one week, one session: only one of them can tick.
    const twice = [
      { date: '2026-10-19', type: 'routine', id: 'r1' },
      { date: '2026-10-22', type: 'routine', id: 'r1' },
    ];
    const results = allocateWeek(
      twice,
      [{ date: '2026-10-19', activityIds: new Set(['push']) }],
      ROUTINE_ACTIVITIES
    );
    expect(results.filter((result) => result.done)).toHaveLength(1);
    expect(results[0].doneDate).toBe('2026-10-19');
  });
});

describe('programWeeks', () => {
  it('splits the block into Monday-to-Sunday calendar weeks', () => {
    const weeks = programWeeks('2026-10-19', '2026-11-01');
    expect(weeks).toHaveLength(2);
    expect(weeks[0].start).toBe('2026-10-19');
    expect(weeks[0].end).toBe('2026-10-25');
    expect(weeks[1].start).toBe('2026-10-26');
    expect(weeks[1].dates).toHaveLength(7);
  });

  it('leaves a short final week short', () => {
    const weeks = programWeeks('2026-10-19', '2026-10-29');
    expect(weeks).toHaveLength(2);
    expect(weeks[1].dates).toHaveLength(4);
  });

  it('gives a mid-week start a short first week rather than shifting the rest', () => {
    // Starting on Tuesday 20 Oct, week one is Tue–Sun and every later week is a
    // whole calendar week.
    const weeks = programWeeks('2026-10-20', '2026-11-08');
    expect(weeks).toHaveLength(3);
    expect(weeks[0]).toMatchObject({ start: '2026-10-20', end: '2026-10-25' });
    expect(weeks[0].dates).toHaveLength(6);
    expect(weeks[1]).toMatchObject({ start: '2026-10-26', end: '2026-11-01' });
    expect(weeks[2]).toMatchObject({ start: '2026-11-02', end: '2026-11-08' });
    // Every week after the first opens on a Monday.
    weeks.slice(1).forEach((week) => expect(new Date(`${week.start}T00:00:00Z`).getUTCDay()).toBe(1));
  });

  it('treats a Sunday start as a one-day first week', () => {
    const weeks = programWeeks('2026-10-25', '2026-11-01');
    expect(weeks).toHaveLength(2);
    expect(weeks[0].dates).toEqual(['2026-10-25']);
    expect(weeks[1].start).toBe('2026-10-26');
  });
});
