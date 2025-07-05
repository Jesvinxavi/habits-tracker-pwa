// FitnessModals.js - Orchestrates all modal dialogs for the fitness feature
import { AddEditActivityModal } from './Modals/AddEditActivityModal.js';
import { ActivityDetailsModal } from './Modals/ActivityDetailsModal.js';
import { StatsModal } from './Modals/StatsModal.js';

export const Modals = {
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
