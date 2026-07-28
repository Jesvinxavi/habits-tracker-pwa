import { getState, dispatch, Actions } from '../../core/state.js';
import { generateUniqueId } from '../../shared/common.js';
import { getLocalISODate, getLocalMidnightISOString } from '../../shared/datetime.js';
import { getRoutine, getRoutineActivities } from './routines.js';
import { getActivitiesForDate, getActivity, recordActivitiesForDate } from './activities.js';
import { isRestDay } from './restDays.js';
import { computeProgramProgress } from './helpers/programProgress.js';

/**
 * Normalises one scheduled-day entry. An entry pins either a routine or a single
 * activity; the unused key is left off entirely rather than stored as null, so
 * the record round-trips through the optional Convex fields unchanged.
 * @param {{dayOfWeek: number, routineId?: string, activityId?: string}} day Raw entry.
 * @returns {{dayOfWeek: number, routineId?: string, activityId?: string}} Normalised entry.
 */
function scheduledDayEntry(day) {
  const entry = { dayOfWeek: Number(day.dayOfWeek) };
  if (day.activityId) entry.activityId = day.activityId;
  else entry.routineId = day.routineId;
  return entry;
}

/**
 * Shifts a date key by one day, staying on the UTC anchor the rest of the
 * program maths uses.
 * @param {string} iso Date key, YYYY-MM-DD.
 * @returns {string} The following day's key.
 */
function dayAfter(iso) {
  return new Date(Date.parse(`${String(iso).slice(0, 10)}T00:00:00.000Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
}

/**
 * @param {string} iso Date key, YYYY-MM-DD.
 * @returns {string} The previous day's key.
 */
function dayBefore(iso) {
  return new Date(Date.parse(`${String(iso).slice(0, 10)}T00:00:00.000Z`) - 86400000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Creates a training program — a named block of time with a weekly routine schedule.
 * A new program is active by default, since the user just chose to plan it.
 * @param {{name: string, startDate: string, endDate: string,
 *   restDays?: number[], notes?: string,
 *   scheduledDays?: Array<{dayOfWeek: number, routineId?: string, activityId?: string}>,
 *   active?: boolean}} data
 *   Program details, dates as YYYY-MM-DD. A scheduled day pins either a routine
 *   or a single activity, never both.
 * @returns {Promise<object|null>} The created program, or null if the durable write failed.
 */
export async function addProgram(data) {
  const program = {
    id: generateUniqueId(),
    name: data.name,
    startDate: String(data.startDate).slice(0, 10),
    endDate: String(data.endDate).slice(0, 10),
    restDays: [...new Set((data.restDays || []).map(Number))].sort((a, b) => a - b),
    scheduledDays: (data.scheduledDays || []).map(scheduledDayEntry),
    notes: data.notes || '',
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
 * Reads every routine's current activity ids.
 * @returns {Object<string, string[]>} Activity ids by routine id.
 */
function routineActivityMap() {
  return Object.fromEntries(
    (getState().routines || []).map((routine) => [routine.id, routine.activityIds || []])
  );
}

/**
 * The date each archived routine or activity stopped being planned from.
 *
 * Archiving is a schedule event, not a rewrite: an item is planned right up to
 * the day it was archived and not after, so the days it was already pinned to
 * — and any session recorded against them — stay exactly as they were.
 * @returns {Object<string, string>} Date key by routine or activity id.
 */
function archivedFromMap() {
  const state = getState();
  const archived = {};
  [...(state.routines || []), ...(state.activities || [])].forEach((entity) => {
    if (entity.archivedAt) archived[entity.id] = getLocalISODate(new Date(entity.archivedAt));
  });
  return archived;
}

/**
 * Compares two schedules for the purpose of deciding whether an edit changed
 * anything worth remembering. Order within a day counts as a change, since it
 * is what the day rows show.
 * @param {{scheduledDays: Array, restDays: Array}} left One schedule.
 * @param {{scheduledDays: Array, restDays: Array}} right The other.
 * @returns {boolean} True when they plan the same week.
 */
function sameSchedule(left, right) {
  const days = (schedule) =>
    JSON.stringify(
      (schedule.scheduledDays || []).map((day) => [
        Number(day.dayOfWeek),
        day.activityId || '',
        day.routineId || '',
      ])
    );
  const rest = (schedule) =>
    JSON.stringify([...new Set((schedule.restDays || []).map(Number))].sort((a, b) => a - b));
  return days(left) === days(right) && rest(left) === rest(right);
}

/**
 * Works out what to store when a program's plan is edited, so the edit only
 * applies from today onwards.
 *
 * A block that is already running has a past: weeks that have happened were
 * measured against the schedule in force at the time, and the sessions recorded
 * against them are history. Rewriting the whole block would move that history —
 * removing a routine would erase the days it was completed on, and adding one
 * would invent sessions the user never had a chance to do. So the outgoing
 * schedule is closed off as a phase ending yesterday, and the new one takes
 * effect today.
 *
 * Pure and exported for testing; callers use updateProgramPlan().
 * @param {object} program The program as stored.
 * @param {object} updates The edit about to be applied.
 * @param {string} todayISO Today's date key.
 * @param {Object<string, string[]>} [routineActivities] Activity ids by routine id,
 *   snapshotted into the closed phase so editing a routine's contents later
 *   cannot change whether a week that has already happened was completed.
 * @returns {object} The updates, with `schedulePhases` set when a split is needed.
 */
export function planUpdateWithHistory(program, updates, todayISO, routineActivities = {}) {
  const phases = [...(program.schedulePhases || [])];
  const current = { scheduledDays: program.scheduledDays, restDays: program.restDays };
  const next = { scheduledDays: updates.scheduledDays, restDays: updates.restDays };

  const liveFrom =
    phases.length > 0
      ? dayAfter(phases[phases.length - 1].endDate)
      : String(program.startDate).slice(0, 10);
  const today = String(todayISO).slice(0, 10);

  // Nothing to preserve when the block has not started, when the current
  // schedule has not yet been in force for a day, or when nothing changed.
  const splitNeeded = today > liveFrom && !sameSchedule(current, next);
  if (!splitNeeded) return { ...updates, schedulePhases: phases };

  const routineIds = [
    ...new Set((program.scheduledDays || []).map((day) => day.routineId).filter(Boolean)),
  ];

  return {
    ...updates,
    schedulePhases: [
      ...phases,
      {
        startDate: liveFrom,
        endDate: dayBefore(today),
        scheduledDays: (program.scheduledDays || []).map(scheduledDayEntry),
        restDays: [...(program.restDays || [])].map(Number),
        routineSnapshots: routineIds.map((routineId) => ({
          routineId,
          activityIds: [...(routineActivities[routineId] || [])],
        })),
      },
    ],
  };
}

/**
 * Applies an edit to a program's plan, keeping what was planned before today.
 * @param {string} programId Program client id.
 * @param {object} updates Fields to merge into the program.
 * @returns {Promise<boolean>} True when the durable write succeeded.
 */
export async function updateProgramPlan(programId, updates) {
  const program = getProgram(programId);
  if (!program) return false;
  return updateProgram(
    programId,
    planUpdateWithHistory(program, updates, getLocalISODate(new Date()), routineActivityMap())
  );
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
 * Resolves a program's weekly schedule, dropping entries whose routine or
 * activity has been deleted, or whose weekday the program marks as rest.
 * Read-time integrity filter — deleting a routine never rewrites programs.
 * @param {string} programId Program client id.
 * @returns {Array<{dayOfWeek: number, routineId?: string, activityId?: string}>}
 *   Schedule entries whose target still exists.
 */
export function getProgramScheduledDays(programId, { includeArchived = false } = {}) {
  const program = getProgram(programId);
  if (!program) return [];
  const rest = new Set(program.restDays || []);
  return (program.scheduledDays || []).filter((day) => {
    if (rest.has(Number(day.dayOfWeek))) return false;
    const target = day.activityId ? getActivity(day.activityId) : getRoutine(day.routineId);
    if (!target) return false;
    // Archived targets are gone from the plan the builder edits and from what
    // today asks for, but progress keeps them: dropping them outright erased
    // the days they were pinned to *before* they were archived, which is the
    // history the archive was meant to protect. plannedSlots() applies the
    // date cutoff instead.
    return includeArchived || !target.archivedAt;
  });
}

/**
 * Resolves a program's superseded schedules, applying the same read-time
 * integrity filter as the live one.
 * @param {string} programId Program client id.
 * @returns {Array<{startDate: string, endDate: string, scheduledDays: Array, restDays: number[]}>}
 *   Past phases whose entries still resolve.
 */
export function getProgramSchedulePhases(programId) {
  const program = getProgram(programId);
  if (!program) return [];
  return (program.schedulePhases || []).map((phase) => ({
    ...phase,
    scheduledDays: (phase.scheduledDays || []).filter((day) =>
      day.activityId ? Boolean(getActivity(day.activityId)) : Boolean(getRoutine(day.routineId))
    ),
  }));
}

/**
 * Measures a program against what has actually been recorded.
 *
 * The maths itself is pure and lives in helpers/programProgress.js; this is the
 * one place that feeds it from state, so the tile and the details modal can
 * never disagree about a figure.
 * @param {object} program The program to measure.
 * @returns {object} Progress figures, including the per-week breakdown.
 */
export function getProgramProgress(program) {
  const state = getState();
  return computeProgramProgress({
    // Measured against the live schedule, so a routine deleted mid-block stops
    // counting against the user instead of leaving an unfillable slot. Past
    // phases get the same filter: what they planned still stands, but only the
    // parts of it that still exist can be drawn or ticked.
    program: program && {
      ...program,
      scheduledDays: getProgramScheduledDays(program.id, { includeArchived: true }),
      schedulePhases: getProgramSchedulePhases(program.id),
    },
    todayISO: getLocalISODate(new Date()),
    recordedActivities: state.recordedActivities,
    restDays: state.restDays,
    // A routine slot is satisfied by any of the routine's activities, so the
    // maths needs the membership its pure signature cannot look up itself.
    routineActivities: routineActivityMap(),
    archivedFrom: archivedFromMap(),
  });
}

/**
 * Lists the routine ids scheduled for a given weekday, in schedule order.
 * @param {string} programId Program client id.
 * @param {number} dayOfWeek 0 = Sunday.
 * @returns {string[]} Routine client ids.
 */
export function getRoutineIdsForWeekday(programId, dayOfWeek) {
  return getProgramScheduledDays(programId)
    .filter((day) => Number(day.dayOfWeek) === Number(dayOfWeek) && day.routineId)
    .map((day) => day.routineId);
}

/**
 * Lists the activity ids pinned directly to a given weekday, in schedule order.
 * @param {string} programId Program client id.
 * @param {number} dayOfWeek 0 = Sunday.
 * @returns {string[]} Activity client ids.
 */
export function getActivityIdsForWeekday(programId, dayOfWeek) {
  return getProgramScheduledDays(programId)
    .filter((day) => Number(day.dayOfWeek) === Number(dayOfWeek) && day.activityId)
    .map((day) => day.activityId);
}

/**
 * Lists the programs whose date block overlaps a candidate range.
 *
 * Two blocks overlap when each starts on or before the other ends — the standard
 * inclusive interval test, which also catches one range fully containing another.
 * @param {string} startISO Candidate start date key.
 * @param {string} endISO Candidate end date key.
 * @param {string|null} [excludeProgramId] Program to ignore, when editing one.
 * @returns {object[]} Overlapping programs in display order.
 */
export function findOverlappingPrograms(startISO, endISO, excludeProgramId = null) {
  const start = String(startISO).slice(0, 10);
  const end = String(endISO).slice(0, 10);
  if (!start || !end) return [];

  return getPrograms().filter(
    (program) =>
      program.id !== excludeProgramId && start <= program.endDate && end >= program.startDate
  );
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
  const weekday = scheduledWeekday(isoDate);
  if (weekday === null) return [];
  return getRoutineIdsForWeekday(getActiveProgram().id, weekday);
}

/**
 * Returns the activity ids the active program pins directly to a date, under the
 * same rest-day and range rules as getScheduledRoutineIdsForDate.
 * @param {string} isoDate Date key, YYYY-MM-DD.
 * @returns {string[]} Activity client ids.
 */
export function getScheduledActivityIdsForDate(isoDate) {
  const weekday = scheduledWeekday(isoDate);
  if (weekday === null) return [];
  return getActivityIdsForWeekday(getActiveProgram().id, weekday);
}

/**
 * Resolves the weekday a date should be scheduled against, or null when the
 * active program does not schedule that date at all.
 * @param {string} isoDate Date key, YYYY-MM-DD.
 * @returns {number|null} Weekday index, 0 = Sunday, or null.
 */
function scheduledWeekday(isoDate) {
  const program = getActiveProgram();
  if (!program) return null;

  const date = String(isoDate).slice(0, 10);
  if (!withinProgram(program, date)) return null;
  if (isRestDay(date)) return null;

  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  if ((program.restDays || []).map(Number).includes(weekday)) return null;

  return weekday;
}

/**
 * Records what the active program schedules for a date and is not on it yet —
 * routines and individually pinned activities alike.
 *
 * Only the missing pieces are written, so a day where the user trained
 * something else, or did half the session by hand, can still be topped up
 * without stacking a second copy of what is already there. `scheduled` reports
 * how much the program wanted for that day, which is how a caller tells "there
 * was nothing to add" from "it was all already done".
 * @param {string} isoDate Date key, YYYY-MM-DD.
 * @returns {Promise<{recorded: number, failed: number, blocked: boolean, scheduled: number}>}
 *   Attempt counts, plus the size of the day's plan.
 */
export async function addProgramRoutinesToDate(isoDate) {
  const date = String(isoDate).slice(0, 10);

  // Routines are flattened here rather than delegated to recordRoutinesForDate,
  // since the already-recorded filter works on activities.
  const wanted = [
    ...getScheduledRoutineIdsForDate(date).flatMap((routineId) =>
      getRoutineActivities(routineId).map((activity) => activity.id)
    ),
    ...getScheduledActivityIdsForDate(date),
  ];
  const scheduled = wanted.length;
  if (scheduled === 0) return { recorded: 0, failed: 0, blocked: false, scheduled };

  const alreadyThere = new Set(
    getActivitiesForDate(date).map((record) => record.activityId)
  );
  const missing = [...new Set(wanted)].filter((activityId) => !alreadyThere.has(activityId));
  if (missing.length === 0) return { recorded: 0, failed: 0, blocked: false, scheduled };

  const result = await recordActivitiesForDate(missing, date);
  return { ...result, scheduled };
}
