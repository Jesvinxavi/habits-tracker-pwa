// FitnessModals.js - Orchestrates all modal dialogs for the fitness feature
import { AddEditActivityModal } from './Modals/AddEditActivityModal.js';
import { ActivityDetailsModal } from './Modals/ActivityDetailsModal.js';
import { StatsModal } from './Modals/StatsModal.js';
import { ActivityLibraryModal } from './Modals/ActivityLibraryModal.js';
import { RoutinesModal } from './Modals/RoutinesModal.js';
import { RoutineBuilderModal } from './Modals/RoutineBuilderModal.js';
import { RoutinePickerModal } from './Modals/RoutinePickerModal.js';
import { ProgramBuilderModal } from './Modals/ProgramBuilderModal.js';

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
   * Opens the routine picker for recording a routine on the selected day
   * @param {Object} [options] - onPick callback receiving the routine ID
   */
  openRoutinePicker(options) {
    RoutinePickerModal.open(options);
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
   * Opens the activity details modal
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
