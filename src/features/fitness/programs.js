import { getState, dispatch, Actions } from '../../core/state.js';
import { generateUniqueId } from '../../shared/common.js';
import { getLocalMidnightISOString } from '../../shared/datetime.js';
import { getRoutine } from './routines.js';

/**
 * Creates a training program — a named block of time with a weekly routine schedule.
 * A new program is active by default, since the user just chose to plan it.
 * @param {{name: string, startDate: string, endDate: string,
 *   scheduledDays?: Array<{dayOfWeek: number, routineId: string}>, active?: boolean}} data
 *   Program details, dates as YYYY-MM-DD.
 * @returns {Promise<object|null>} The created program, or null if the durable write failed.
 */
export async function addProgram(data) {
  const program = {
    id: generateUniqueId(),
    name: data.name,
    startDate: String(data.startDate).slice(0, 10),
    endDate: String(data.endDate).slice(0, 10),
    scheduledDays: (data.scheduledDays || []).map((day) => ({
      dayOfWeek: Number(day.dayOfWeek),
      routineId: day.routineId,
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
 * deleted. Read-time integrity filter — deleting a routine never rewrites programs.
 * @param {string} programId Program client id.
 * @returns {Array<{dayOfWeek: number, routineId: string}>} Schedule entries with live routines.
 */
export function getProgramScheduledDays(programId) {
  const program = getProgram(programId);
  if (!program) return [];
  return (program.scheduledDays || []).filter((day) => Boolean(getRoutine(day.routineId)));
}
