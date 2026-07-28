// FitnessModals.js - Orchestrates all modal dialogs for the fitness feature
import { AddEditActivityModal } from './Modals/AddEditActivityModal.js';
import { ActivityDetailsModal } from './Modals/ActivityDetailsModal.js';
import { ActivityInfoModal } from './Modals/ActivityInfoModal.js';
import { StatsModal } from './Modals/StatsModal.js';
import { ActivityLibraryModal } from './Modals/ActivityLibraryModal.js';
import { RoutinesModal } from './Modals/RoutinesModal.js';
import { RoutineBuilderModal } from './Modals/RoutineBuilderModal.js';
import { RoutinePickerModal } from './Modals/RoutinePickerModal.js';
import { ActivityPickerModal } from './Modals/ActivityPickerModal.js';
import { ProgramBuilderModal } from './Modals/ProgramBuilderModal.js';
import { ProgramDetailsModal } from './Modals/ProgramDetailsModal.js';
import { recordActivitiesForDate } from './activities.js';
import { getState, dispatch, Actions } from '../../core/state.js';
import { getLocalISODate, getLocalMidnightISOString } from '../../shared/datetime.js';

/**
 * Logs an activity onto today's schedule and steps back to it, so the user sees
 * the tile land.
 *
 * Deliberately today rather than whichever day the page is showing: this is the
 * quick "I just did this" path. Logging against a specific date is the + button's
 * job, where the date is the thing the user has already chosen.
 *
 * The record is created without sets or duration on purpose: getting it onto the
 * schedule is one tap, and the card then invites the details.
 * @param {string} activityId - Activity client id
 * @returns {Promise<void>}
 */
async function recordToToday(activityId) {
  const today = getLocalISODate(new Date());
  const result = await recordActivitiesForDate([activityId], today);
  // A rest day or a failed write keeps the modals open, with its own dialog
  // already on screen explaining why.
  if (result.recorded === 0) return;

  // Move the page to today if it was showing another date, or the new card
  // would land somewhere the user cannot see.
  if (getLocalISODate(getState().fitnessSelectedDate || new Date().toISOString()) !== today) {
    await dispatch(Actions.setFitnessSelectedDate(getLocalMidnightISOString(new Date())));
  }

  ActivityInfoModal.close();
  ActivityLibraryModal.close();
}

export const Modals = {
  /**
   * Opens the activity library
   * @param {Object} callbacks - Handlers for activity, stats and edit taps
   */
  openActivityLibrary(callbacks) {
    ActivityLibraryModal.open(callbacks);
  },

  /**
   * Opens the saved-routines list
   */
  openRoutines() {
    RoutinesModal.open();
  },

  /**
   * Opens the routine builder for a new routine
   * @param {Object} [options] - presetActivityIds, presetName, title, onSaved
   */
  openRoutineBuilder(options) {
    RoutineBuilderModal.openCreateMode(options);
  },

  /**
   * Opens the routine builder on an existing routine
   * @param {string} routineId - The routine ID to edit
   * @param {Object} [options] - onSaved callback
   */
  openEditRoutine(routineId, options) {
    RoutineBuilderModal.openEditMode(routineId, options);
  },

  /**
   * Opens the multi-select activity picker for recording on the selected day
   * @param {Object} [options] - onConfirm callback receiving the selected activity IDs
   */
  openActivityPicker(options) {
    ActivityPickerModal.open(options);
  },

  /**
   * Opens the multi-select routine picker for recording on the selected day
   * @param {Object} [options] - onConfirm callback receiving the selected routine IDs
   */
  openRoutinePicker(options) {
    RoutinePickerModal.open(options);
  },

  /**
   * Opens the read-only program overview
   * @param {string} programId - The program ID
   */
  openProgramDetails(programId) {
    ProgramDetailsModal.open(programId);
  },

  /**
   * Opens the program builder for a new program
   * @param {Object} [options] - onSaved callback
   */
  openProgramBuilder(options) {
    ProgramBuilderModal.openCreateMode(options);
  },

  /**
   * Opens the program builder on an existing program
   * @param {string} programId - The program ID to edit
   * @param {Object} [options] - onSaved callback
   */
  openEditProgram(programId, options) {
    ProgramBuilderModal.openEditMode(programId, options);
  },

  /**
   * Opens the add activity modal
   */
  openAddActivity() {
    AddEditActivityModal.openAddMode();
  },

  /**
   * Opens the edit activity modal
   * @param {string} activityId - The activity ID to edit
   */
  openEditActivity(activityId) {
    AddEditActivityModal.openEditMode(activityId);
  },

  /**
   * Opens the read-only activity details view.
   *
   * The navigation handlers default to the standard set, so every surface that
   * opens this modal — the library, the record form's tile — wires it the same
   * way rather than each re-deriving the same three callbacks.
   * @param {string} activityId - The activity ID
   * @param {Object} [callbacks] - Overrides for onRecord, onEdit and onStats
   */
  openActivityInfo(activityId, callbacks = {}) {
    ActivityInfoModal.open(activityId, {
      onRecord: (id) => void recordToToday(id),
      onEdit: (id) => this.openEditActivity(id),
      onStats: (id) => this.openStats(id),
      ...callbacks,
    });
  },

  /**
   * Opens the record modal for logging a session against the selected day
   * @param {string} activityId - The activity ID
   */
  openActivityDetails(activityId) {
    ActivityDetailsModal.open(activityId);
  },

  /**
   * Opens the activity details modal with existing record
   * @param {string} activityId - The activity ID
   * @param {Object} record - The existing activity record
   */
  openActivityDetailsWithRecord(activityId, record) {
    ActivityDetailsModal.openWithRecord(activityId, record);
  },

  /**
   * Opens the statistics modal
   * @param {string} activityId - The activity ID
   */
  openStats(activityId) {
    StatsModal.open(activityId);
  },
};
