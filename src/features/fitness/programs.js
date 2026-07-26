import { getState, dispatch, Actions } from '../../core/state.js';
import { generateUniqueId } from '../../shared/common.js';
import { getLocalMidnightISOString } from '../../shared/datetime.js';
import { getRoutine, recordRoutinesForDate } from './routines.js';
import { getActivitiesForDate } from './activities.js';
import { isRestDay } from './restDays.js';

/** Weekly schedule with routines pinned to specific weekdays. */
export const PRESCRIPTIVE = 'prescriptive';
/** Weekly targets: some routines pinned to days, others doable any day that week. */
export const FREEFORM = 'freeform';

/**
 * Creates a training program — a named block of time with a weekly routine schedule.
 * A new program is active by default, since the user just chose to plan it.
 * @param {{name: string, startDate: string, endDate: string,
 *   scheduleMode?: string, restDays?: number[],
 *   scheduledDays?: Array<{dayOfWeek: number, routineId: string}>,
 *   anytimeRoutines?: Array<{routineId: string, count: number}>, active?: boolean}} data
 *   Program details, dates as YYYY-MM-DD.
 * @returns {Promise<object|null>} The created program, or null if the durable write failed.
 */
export async function addProgram(data) {
  const program = {
    id: generateUniqueId(),
    name: data.name,
    startDate: String(data.startDate).slice(0, 10),
    endDate: String(data.endDate).slice(0, 10),
    scheduleMode: data.scheduleMode === FREEFORM ? FREEFORM : PRESCRIPTIVE,
    restDays: [...new Set((data.restDays || []).map(Number))].sort((a, b) => a - b),
    scheduledDays: (data.scheduledDays || []).map((day) => ({
      dayOfWeek: Number(day.dayOfWeek),
      routineId: day.routineId,
    })),
    anytimeRoutines: (data.anytimeRoutines || []).map((entry) => ({
      routineId: entry.routineId,
      count: Math.max(1, Number(entry.count) || 1),
    })),
    active: data.active === undefined ? true : Boolean(data.active),
    createdAt: getLocalMidnightISOString(new Date()).slice(0, 10),
    sortOrder: getState().programs.length,
    revision: 0,
  };

  const saved = await dispatch(Actions.addProgram(program));
  if (!saved) return null;

  return program;
}

/**
 * Applies a partial update to an existing program.
 * @param {string} programId Program client id.
 * @param {object} updates Fields to merge into the program.
 * @returns {Promise<boolean>} True when the durable write succeeded.
 */
export async function updateProgram(programId, updates) {
  return dispatch(Actions.updateProgram(programId, updates));
}

/**
 * Deletes a program.
 * @param {string} programId Program client id.
 * @returns {Promise<boolean>} True when the durable write succeeded.
 */
export async function deleteProgram(programId) {
  return dispatch(Actions.deleteProgram(programId));
}

/**
 * Makes one program active, deactivating every other program. Pass null to
 * deactivate all of them.
 * @param {string|null} programId Program client id, or null.
 * @returns {Promise<boolean>} True when the durable write succeeded.
 */
export async function setActiveProgram(programId) {
  return dispatch(Actions.setActiveProgram(programId));
}

/**
 * Lists every saved program in display order.
 * @returns {object[]} Programs sorted by sortOrder.
 */
export function getPrograms() {
  return [...getState().programs].sort((left, right) => left.sortOrder - right.sortOrder);
}

/**
 * Looks up a single program.
 * @param {string} programId Program client id.
 * @returns {object|undefined} The program, or undefined when it does not exist.
 */
export function getProgram(programId) {
  return getState().programs.find((program) => program.id === programId);
}

/**
 * Returns the active program. At most one program is ever active.
 * @returns {object|null} The active program, or null when none is active.
 */
export function getActiveProgram() {
  return getState().programs.find((program) => program.active === true) || null;
}

/**
 * Resolves a program's weekly schedule, dropping entries whose routine has been
 * deleted or whose weekday the program marks as rest. Read-time integrity
 * filter — deleting a routine never rewrites programs.
 * @param {string} programId Program client id.
 * @returns {Array<{dayOfWeek: number, routineId: string}>} Schedule entries with live routines.
 */
export function getProgramScheduledDays(programId) {
  const program = getProgram(programId);
  if (!program) return [];
  const rest = new Set(program.restDays || []);
  return (program.scheduledDays || []).filter(
    (day) => Boolean(getRoutine(day.routineId)) && !rest.has(Number(day.dayOfWeek))
  );
}

/**
 * Resolves a program's anytime targets, dropping entries whose routine has been deleted.
 * @param {string} programId Program client id.
 * @returns {Array<{routineId: string, count: number}>} Anytime entries with live routines.
 */
export function getProgramAnytimeRoutines(programId) {
  const program = getProgram(programId);
  if (!program) return [];
  return (program.anytimeRoutines || []).filter((entry) => Boolean(getRoutine(entry.routineId)));
}

/**
 * Lists the routine ids scheduled for a given weekday, in schedule order.
 * @param {string} programId Program client id.
 * @param {number} dayOfWeek 0 = Sunday.
 * @returns {string[]} Routine client ids.
 */
export function getRoutineIdsForWeekday(programId, dayOfWeek) {
  return getProgramScheduledDays(programId)
    .filter((day) => Number(day.dayOfWeek) === Number(dayOfWeek))
    .map((day) => day.routineId);
}

/**
 * Reports whether a date sits inside the active program's block.
 * @param {object} program Program to test.
 * @param {string} isoDate Date key.
 * @returns {boolean} True when the date is within the block.
 */
function withinProgram(program, isoDate) {
  const date = String(isoDate).slice(0, 10);
  return date >= program.startDate && date <= program.endDate;
}

/**
 * Returns the routine ids the active program schedules for a date, or an empty
 * array when the date is outside the block, on a program rest weekday, or on a
 * calendar rest day.
 * @param {string} isoDate Date key, YYYY-MM-DD.
 * @returns {string[]} Routine client ids.
 */
export function getScheduledRoutineIdsForDate(isoDate) {
  const program = getActiveProgram();
  if (!program) return [];

  const date = String(isoDate).slice(0, 10);
  if (!withinProgram(program, date)) return [];
  if (isRestDay(date)) return [];

  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  if ((program.restDays || []).map(Number).includes(weekday)) return [];

  return getRoutineIdsForWeekday(program.id, weekday);
}

/**
 * Records the active program's routines for a date, unless something is already
 * logged there. Used both by the manual "add to day" action and by the preload
 * preference, so a day is never filled twice.
 * @param {string} isoDate Date key, YYYY-MM-DD.
 * @returns {Promise<{recorded: number, failed: number, blocked: boolean}>} Attempt counts.
 */
export async function addProgramRoutinesToDate(isoDate) {
  const date = String(isoDate).slice(0, 10);
  const routineIds = getScheduledRoutineIdsForDate(date);
  if (routineIds.length === 0) return { recorded: 0, failed: 0, blocked: false };
  // Never stack a second copy on a day the user has already logged.
  if (getActivitiesForDate(date).length > 0) return { recorded: 0, failed: 0, blocked: false };
  return recordRoutinesForDate(routineIds, date);
}

/**
 * Fills a day with its scheduled routines when the preload preference is on.
 * Runs on opening a day rather than up front, so nothing is written for days the
 * user never visits and the whole block never syncs as one burst.
 * @param {string} isoDate Date key, YYYY-MM-DD.
 * @returns {Promise<boolean>} True when routines were recorded.
 */
export async function preloadProgramDayIfEnabled(isoDate) {
  if (!getState().settings?.programPreload) return false;
  const result = await addProgramRoutinesToDate(isoDate);
  return result.recorded > 0;
}
