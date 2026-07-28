import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionTypes, dispatch, Actions } from '../../src/core/state.js';
import {
  addProgram,
  getActiveProgram,
  getProgram,
  getPrograms,
  getProgramProgress,
  getProgramScheduledDays,
  planUpdateWithHistory,
  getActivityIdsForWeekday,
  getRoutineIdsForWeekday,
  getScheduledActivityIdsForDate,
  getScheduledRoutineIdsForDate,
  setActiveProgram,
} from '../../src/features/fitness/programs.js';

vi.mock('../../src/components/ConfirmDialog.js', () => ({ showConfirm: vi.fn() }));

// See routines.test.js: .env.local sets VITE_DATA_BACKEND=cloud, which these
// reducer-level tests must not route through.
vi.mock('../../src/core/dataBackend.js', () => ({
  DATA_BACKENDS: { LEGACY: 'legacy', CLOUD: 'cloud' },
  isCloudBackend: () => false,
  getDataBackend: () => 'legacy',
  assertCloudConfiguration: () => {},
}));

/**
 * Seeds a routine straight into state.
 * @param {string} id Routine client id.
 * @param {string} name Routine name.
 * @returns {void}
 */
function seedRoutine(id, name) {
  dispatch({
    type: ActionTypes.ADD_ROUTINE,
    payload: { id, name, activityIds: [], createdAt: '2026-01-01', sortOrder: 0 },
    meta: { source: 'device' },
  });
}

/**
 * Seeds an activity straight into state.
 * @param {string} id Activity client id.
 * @param {string} name Activity name.
 * @returns {void}
 */
function seedActivity(id, name) {
  dispatch({
    type: ActionTypes.ADD_ACTIVITY,
    payload: { id, name, categoryId: 'strength', trackingType: 'sets-reps', createdAt: '2026-01-01' },
    meta: { source: 'device' },
  });
}

describe('programs', () => {
  beforeEach(() => {
    dispatch(Actions.resetState());
    seedRoutine('r1', 'Push');
    seedRoutine('r2', 'Pull');
    seedActivity('a1', 'Bench Press');
  });

  it('defaults a new program to active, with normalised fields', async () => {
    const program = await addProgram({
      name: 'Block',
      startDate: '2026-10-19T00:00:00.000',
      endDate: '2026-12-13',
      scheduledDays: [{ dayOfWeek: '1', routineId: 'r1' }],
      restDays: [6, 0, 6],
    });

    expect(program.active).toBe(true);
    expect(program.startDate).toBe('2026-10-19');
    // Rest days are de-duplicated, coerced to numbers and sorted.
    expect(program.restDays).toEqual([0, 6]);
    expect(program.scheduledDays).toEqual([{ dayOfWeek: 1, routineId: 'r1' }]);
    // The two-mode scheme is gone: a program is its pinned days and nothing else.
    expect(program.scheduleMode).toBeUndefined();
    expect(program.anytimeRoutines).toBeUndefined();
    expect(program.sortOrder).toBe(0);
  });

  it('keeps exactly one program active', async () => {
    const first = await addProgram({ name: 'One', startDate: '2026-01-01', endDate: '2026-02-01' });
    const second = await addProgram({ name: 'Two', startDate: '2026-03-01', endDate: '2026-04-01' });

    // Each new program arrives active, so activating the second must clear the first.
    await setActiveProgram(second.id);
    const active = getPrograms().filter((program) => program.active);
    expect(active).toHaveLength(1);
    expect(getActiveProgram().name).toBe('Two');

    await setActiveProgram(first.id);
    expect(getActiveProgram().name).toBe('One');

    await setActiveProgram(null);
    expect(getActiveProgram()).toBeNull();
    expect(getPrograms().filter((program) => program.active)).toHaveLength(0);
  });

  it('drops scheduled days whose routine is gone or archived', async () => {
    const program = await addProgram({
      name: 'Block',
      startDate: '2026-10-19',
      endDate: '2026-12-13',
      scheduledDays: [
        { dayOfWeek: 1, routineId: 'r1' },
        { dayOfWeek: 3, routineId: 'gone' },
      ],
    });

    expect(getProgramScheduledDays(program.id)).toEqual([{ dayOfWeek: 1, routineId: 'r1' }]);
    // The stored schedule is untouched — filtering happens on read.
    expect(getProgram(program.id).scheduledDays).toHaveLength(2);

    // Archiving a routine takes it out of the plan going forward.
    dispatch(Actions.updateRoutine('r1', { archivedAt: Date.now() }));
    expect(getProgramScheduledDays(program.id)).toEqual([]);
  });

  it('drops scheduled days that fall on a program rest weekday', async () => {
    const program = await addProgram({
      name: 'Block',
      startDate: '2026-10-19',
      endDate: '2026-12-13',
      restDays: [3],
      scheduledDays: [
        { dayOfWeek: 1, routineId: 'r1' },
        { dayOfWeek: 3, routineId: 'r2' },
      ],
    });
    expect(getProgramScheduledDays(program.id)).toEqual([{ dayOfWeek: 1, routineId: 'r1' }]);
  });

  it('measures progress against the live schedule and routine membership', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T12:00:00'));
    try {
      dispatch({
        type: ActionTypes.ADD_ROUTINE,
        payload: {
          id: 'r3',
          name: 'Legs',
          activityIds: ['a1'],
          createdAt: '2026-01-01',
          sortOrder: 2,
        },
        meta: { source: 'device' },
      });

      const program = await addProgram({
        name: 'Block',
        startDate: '2026-10-19',
        endDate: '2026-10-25',
        scheduledDays: [
          { dayOfWeek: 1, routineId: 'r3' },
          { dayOfWeek: 3, routineId: 'gone' },
        ],
      });

      // Monday's routine was trained on the Wednesday; the deleted routine's
      // day never counted against the plan in the first place.
      dispatch(
        Actions.recordActivity('a1', '2026-10-21', {
          id: 'rec1',
          activityId: 'a1',
          date: '2026-10-21',
        })
      );

      const progress = getProgramProgress(getProgram(program.id));
      expect(progress.plannedWorkouts).toBe(1);
      expect(progress.completedWorkouts).toBe(1);
      expect(progress.weeks[0].days[0].slots[0]).toMatchObject({ doneDate: '2026-10-21' });
    } finally {
      vi.useRealTimers();
    }
  });

  describe('editing a running program', () => {
    const program = {
      startDate: '2026-10-19',
      endDate: '2026-11-15',
      scheduledDays: [{ dayOfWeek: 1, routineId: 'r1' }],
      restDays: [0],
    };
    const edit = {
      scheduledDays: [{ dayOfWeek: 3, routineId: 'r2' }],
      restDays: [0],
    };

    it('closes the outgoing schedule off at yesterday', () => {
      const updates = planUpdateWithHistory(program, edit, '2026-10-28');
      expect(updates.schedulePhases).toEqual([
        {
          startDate: '2026-10-19',
          endDate: '2026-10-27',
          scheduledDays: [{ dayOfWeek: 1, routineId: 'r1' }],
          restDays: [0],
          routineSnapshots: [{ routineId: 'r1', activityIds: [] }],
        },
      ]);
      expect(updates.scheduledDays).toEqual(edit.scheduledDays);
    });

    it('keeps no history when the block has not started', () => {
      const updates = planUpdateWithHistory(program, edit, '2026-10-01');
      expect(updates.schedulePhases).toEqual([]);
    });

    it('keeps no history when the schedule did not change', () => {
      const unchanged = { scheduledDays: [{ dayOfWeek: 1, routineId: 'r1' }], restDays: [0] };
      expect(planUpdateWithHistory(program, unchanged, '2026-10-28').schedulePhases).toEqual([]);
      // Rest days are part of the plan, so changing those alone does split it.
      const restOnly = { scheduledDays: program.scheduledDays, restDays: [0, 6] };
      expect(planUpdateWithHistory(program, restOnly, '2026-10-28').schedulePhases).toHaveLength(1);
    });

    it('does not split twice in one day', () => {
      const once = planUpdateWithHistory(program, edit, '2026-10-28');
      const edited = { ...program, ...once };
      const again = planUpdateWithHistory(
        edited,
        { scheduledDays: [{ dayOfWeek: 5, routineId: 'r1' }], restDays: [0] },
        '2026-10-28'
      );
      // The live schedule only took effect today, so there is no day of it to keep.
      expect(again.schedulePhases).toHaveLength(1);
    });

    it('chains a second phase off the first', () => {
      const first = planUpdateWithHistory(program, edit, '2026-10-28');
      const edited = { ...program, ...first };
      const second = planUpdateWithHistory(
        edited,
        { scheduledDays: [{ dayOfWeek: 5, routineId: 'r1' }], restDays: [0] },
        '2026-11-02'
      );
      expect(second.schedulePhases).toHaveLength(2);
      expect(second.schedulePhases[1]).toMatchObject({
        startDate: '2026-10-28',
        endDate: '2026-11-01',
        scheduledDays: [{ dayOfWeek: 3, routineId: 'r2' }],
      });
    });
  });

  it('keeps an archived activity in the days it was already planned on', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T12:00:00'));
    try {
      const program = await addProgram({
        name: 'Block',
        startDate: '2026-10-19',
        endDate: '2026-10-25',
        scheduledDays: [{ dayOfWeek: 1, activityId: 'a1' }],
      });
      dispatch(
        Actions.recordActivity('a1', '2026-10-19', {
          id: 'rec1',
          activityId: 'a1',
          date: '2026-10-19',
        })
      );
      // Archived today, after Monday's session was done.
      dispatch(Actions.updateActivity('a1', { archivedAt: Date.parse('2026-10-23T09:00:00') }));

      const progress = getProgramProgress(getProgram(program.id));
      // Monday keeps its slot and its tick; the plan going forward loses it.
      expect(progress.plannedWorkouts).toBe(1);
      expect(progress.completedWorkouts).toBe(1);
      expect(getProgramScheduledDays(program.id)).toEqual([]);
      expect(getProgramScheduledDays(program.id, { includeArchived: true })).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lists every routine pinned to a weekday, in order', async () => {
    const program = await addProgram({
      name: 'Block',
      startDate: '2026-10-19',
      endDate: '2026-12-13',
      scheduledDays: [
        { dayOfWeek: 1, routineId: 'r2' },
        { dayOfWeek: 1, routineId: 'r1' },
        { dayOfWeek: 5, routineId: 'r1' },
      ],
    });
    expect(getRoutineIdsForWeekday(program.id, 1)).toEqual(['r2', 'r1']);
    expect(getRoutineIdsForWeekday(program.id, 5)).toEqual(['r1']);
    expect(getRoutineIdsForWeekday(program.id, 2)).toEqual([]);
  });

  it('resolves the routines due on a date, honouring both kinds of rest day', async () => {
    // 19 Oct 2026 is a Monday, 21 Oct a Wednesday.
    await addProgram({
      name: 'Block',
      startDate: '2026-10-19',
      endDate: '2026-10-25',
      scheduledDays: [
        { dayOfWeek: 1, routineId: 'r1' },
        { dayOfWeek: 3, routineId: 'r2' },
      ],
    });

    expect(getScheduledRoutineIdsForDate('2026-10-19')).toEqual(['r1']);
    expect(getScheduledRoutineIdsForDate('2026-10-21')).toEqual(['r2']);
    // Outside the block.
    expect(getScheduledRoutineIdsForDate('2026-10-18')).toEqual([]);
    expect(getScheduledRoutineIdsForDate('2026-10-26')).toEqual([]);
    // A calendar rest day suppresses the schedule for that date.
    dispatch(Actions.setRestDay('2026-10-19', true));
    expect(getScheduledRoutineIdsForDate('2026-10-19')).toEqual([]);
  });

  it('resolves nothing when no program is active', () => {
    expect(getScheduledRoutineIdsForDate('2026-10-19')).toEqual([]);
    expect(getScheduledActivityIdsForDate('2026-10-19')).toEqual([]);
    expect(getActiveProgram()).toBeNull();
  });

  it('pins individual activities to days alongside routines', async () => {
    const program = await addProgram({
      name: 'Block',
      startDate: '2026-10-19',
      endDate: '2026-10-25',
      scheduledDays: [
        { dayOfWeek: 1, routineId: 'r1' },
        { dayOfWeek: 1, activityId: 'a1' },
      ],
    });

    // Only the key in use is stored, so a routine entry never carries an empty
    // activity id through to the backend and back.
    expect(getProgram(program.id).scheduledDays).toEqual([
      { dayOfWeek: 1, routineId: 'r1' },
      { dayOfWeek: 1, activityId: 'a1' },
    ]);
    expect(getRoutineIdsForWeekday(program.id, 1)).toEqual(['r1']);
    expect(getActivityIdsForWeekday(program.id, 1)).toEqual(['a1']);
    expect(getScheduledRoutineIdsForDate('2026-10-19')).toEqual(['r1']);
    expect(getScheduledActivityIdsForDate('2026-10-19')).toEqual(['a1']);
  });

  it('drops scheduled days whose activity is gone or archived', async () => {
    const program = await addProgram({
      name: 'Block',
      startDate: '2026-10-19',
      endDate: '2026-12-13',
      scheduledDays: [
        { dayOfWeek: 1, activityId: 'a1' },
        { dayOfWeek: 3, activityId: 'gone' },
      ],
    });

    expect(getProgramScheduledDays(program.id)).toEqual([{ dayOfWeek: 1, activityId: 'a1' }]);

    dispatch(Actions.updateActivity('a1', { archivedAt: Date.now() }));
    expect(getProgramScheduledDays(program.id)).toEqual([]);
  });
});
