import { getState, dispatch, Actions } from '../../core/state.js';
import { generateUniqueId } from '../../shared/common.js';
import { getLocalMidnightISOString } from '../../shared/datetime.js';
import { getActivity, isArchivedActivity, recordActivitiesForDate } from './activities.js';

let indexedRoutines = null;
let routinesById = new Map();

function ensureRoutineIndex() {
  const routines = getState().routines;
  if (routines !== indexedRoutines) {
    indexedRoutines = routines;
    routinesById = new Map(routines.map((routine) => [routine.id, routine]));
  }
  return routinesById;
}

/**
 * Creates a new routine — a named, ordered set of activities performed together.
 * @param {{name: string, activityIds?: string[]}} data Routine details.
 * @returns {Promise<object|null>} The created routine, or null if the durable write failed.
 */
export async function addRoutine(data) {
  const routine = {
    id: generateUniqueId(),
    name: data.name,
    activityIds: [...(data.activityIds || [])],
    createdAt: getLocalMidnightISOString(new Date()).slice(0, 10),
    sortOrder: getState().routines.length,
    revision: 0,
  };

  const saved = await dispatch(Actions.addRoutine(routine));
  if (!saved) return null;

  return routine;
}

/**
 * Applies a partial update to an existing routine.
 * @param {string} routineId Routine client id.
 * @param {object} updates Fields to merge into the routine.
 * @returns {Promise<boolean>} True when the durable write succeeded.
 */
export async function updateRoutine(routineId, updates) {
  return dispatch(Actions.updateRoutine(routineId, updates));
}

/**
 * Deletes a routine. Programs referencing it are left untouched; the dangling
 * reference is filtered at read time by getProgramScheduledDays().
 * @param {string} routineId Routine client id.
 * @returns {Promise<boolean>} True when the durable write succeeded.
 */
export async function archiveRoutine(routineId) {
  return dispatch(Actions.updateRoutine(routineId, { archivedAt: Date.now() }));
}

/**
 * Reports whether a routine has been archived.
 * @param {object} routine Routine, or undefined.
 * @returns {boolean} True when it has been removed from the list.
 */
function isArchivedRoutine(routine) {
  return Boolean(routine?.archivedAt);
}

/**
 * Lists every saved routine in display order.
 * @returns {object[]} Routines sorted by sortOrder.
 */
export function getRoutines() {
  return getState()
    .routines.filter((routine) => !isArchivedRoutine(routine))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

/**
 * Looks up a single routine.
 * @param {string} routineId Routine client id.
 * @returns {object|undefined} The routine, or undefined when it does not exist.
 */
export function getRoutine(routineId) {
  return ensureRoutineIndex().get(routineId);
}

/**
 * Resolves a routine's activities, dropping ids whose activity has been deleted.
 * This read-time integrity filter is the only place the UI should read a
 * routine's activities from — deleting an activity never rewrites routines.
 * @param {string} routineId Routine client id.
 * @returns {object[]} Live activities in the routine's saved order.
 */
export function getRoutineActivities(routineId) {
  const routine = getRoutine(routineId);
  if (!routine) return [];
  return (routine.activityIds || [])
    .map((activityId) => getActivity(activityId))
    .filter((activity) => activity !== undefined && !isArchivedActivity(activity));
}

/**
 * Records every activity in one or more routines for the given date.
 *
 * The rest-day guard, the sequential outbox writes and the failure dialog all
 * live in recordActivitiesForDate, so adding two routines shows one dialog
 * rather than one per routine.
 *
 * @param {string[]} routineIds Routine client ids, in the order to record them.
 * @param {string} isoDate YYYY-MM-DD
 * @returns {Promise<{recorded: number, failed: number, blocked: boolean}>} Counts for the attempt.
 */
export async function recordRoutinesForDate(routineIds, isoDate) {
  const activityIds = routineIds.flatMap((routineId) =>
    getRoutineActivities(routineId).map((activity) => activity.id)
  );
  return recordActivitiesForDate(activityIds, isoDate);
}
