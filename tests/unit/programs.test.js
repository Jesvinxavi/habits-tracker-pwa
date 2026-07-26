import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionTypes, dispatch, Actions } from '../../src/core/state.js';
import {
  addProgram,
  getActiveProgram,
  getProgram,
  getPrograms,
  getProgramAnytimeRoutines,
  getProgramScheduledDays,
  getRoutineIdsForWeekday,
  getScheduledRoutineIdsForDate,
  setActiveProgram,
  FREEFORM,
  PRESCRIPTIVE,
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

describe('programs', () => {
  beforeEach(() => {
    dispatch(Actions.resetState());
    seedRoutine('r1', 'Push');
    seedRoutine('r2', 'Pull');
  });

  it('defaults a new program to prescriptive, active, with normalised fields', async () => {
    const program = await addProgram({
      name: 'Block',
      startDate: '2026-10-19T00:00:00.000',
      endDate: '2026-12-13',
      scheduledDays: [{ dayOfWeek: '1', routineId: 'r1' }],
      restDays: [6, 0, 6],
    });

    expect(program.scheduleMode).toBe(PRESCRIPTIVE);
    expect(program.active).toBe(true);
    expect(program.startDate).toBe('2026-10-19');
    // Rest days are de-duplicated, coerced to numbers and sorted.
    expect(program.restDays).toEqual([0, 6]);
    expect(program.scheduledDays).toEqual([{ dayOfWeek: 1, routineId: 'r1' }]);
    expect(program.anytimeRoutines).toEqual([]);
    expect(program.sortOrder).toBe(0);
  });

  it('clamps anytime counts to at least one', async () => {
    const program = await addProgram({
      name: 'Flex',
      startDate: '2026-10-19',
      endDate: '2026-11-01',
      scheduleMode: FREEFORM,
      anytimeRoutines: [
        { routineId: 'r1', count: 0 },
        { routineId: 'r2', count: 3 },
      ],
    });
    expect(program.anytimeRoutines).toEqual([
      { routineId: 'r1', count: 1 },
      { routineId: 'r2', count: 3 },
    ]);
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

  it('drops scheduled days whose routine no longer exists', async () => {
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

    dispatch(Actions.deleteRoutine('r1'));
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

  it('drops anytime entries whose routine no longer exists', async () => {
    const program = await addProgram({
      name: 'Flex',
      startDate: '2026-10-19',
      endDate: '2026-11-01',
      scheduleMode: FREEFORM,
      anytimeRoutines: [
        { routineId: 'r1', count: 2 },
        { routineId: 'gone', count: 1 },
      ],
    });
    expect(getProgramAnytimeRoutines(program.id)).toEqual([{ routineId: 'r1', count: 2 }]);
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
    expect(getActiveProgram()).toBeNull();
  });
});
