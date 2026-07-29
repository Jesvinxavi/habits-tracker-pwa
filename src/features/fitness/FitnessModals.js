// FitnessModals.js - Orchestrates lazily loaded dialogs for the fitness feature
import { recordActivitiesForDate } from './activities.js';
import { getState, dispatch, Actions } from '../../core/state.js';
import { getLocalISODate, getLocalMidnightISOString } from '../../shared/datetime.js';
import { showConfirm } from '../../components/ConfirmDialog.js';

const loaders = {
  addEditActivity: () => import('./Modals/AddEditActivityModal.js').then((m) => m.AddEditActivityModal),
  activityDetails: () => import('./Modals/ActivityDetailsModal.js').then((m) => m.ActivityDetailsModal),
  activityInfo: () => import('./Modals/ActivityInfoModal.js').then((m) => m.ActivityInfoModal),
  stats: () => import('./Modals/StatsModal.js').then((m) => m.StatsModal),
  activityLibrary: () => import('./Modals/ActivityLibraryModal.js').then((m) => m.ActivityLibraryModal),
  routines: () => import('./Modals/RoutinesModal.js').then((m) => m.RoutinesModal),
  routineBuilder: () => import('./Modals/RoutineBuilderModal.js').then((m) => m.RoutineBuilderModal),
  routinePicker: () => import('./Modals/RoutinePickerModal.js').then((m) => m.RoutinePickerModal),
  activityPicker: () => import('./Modals/ActivityPickerModal.js').then((m) => m.ActivityPickerModal),
  programBuilder: () => import('./Modals/ProgramBuilderModal.js').then((m) => m.ProgramBuilderModal),
  programDetails: () => import('./Modals/ProgramDetailsModal.js').then((m) => m.ProgramDetailsModal),
};
const loaded = new Map();
const pendingOpens = new Map();

function loadModal(name) {
  if (!loaded.has(name)) loaded.set(name, loaders[name]());
  return loaded.get(name);
}

function openLazyModal(name, open) {
  if (pendingOpens.has(name)) return pendingOpens.get(name);
  const opener = document.activeElement;
  const isButton = opener instanceof HTMLButtonElement;
  opener?.setAttribute?.('aria-busy', 'true');
  if (isButton) opener.disabled = true;

  const pending = loadModal(name)
    .then(open)
    .catch((error) => {
      loaded.delete(name);
      console.error(`Unable to open ${name}:`, error);
      showConfirm({
        title: 'Unable to Open',
        message: 'This screen could not be loaded. Check your connection and try again.',
        okText: 'OK',
        cancelText: '',
      });
      return null;
    })
    .finally(() => {
      opener?.removeAttribute?.('aria-busy');
      if (isButton) opener.disabled = false;
      pendingOpens.delete(name);
    });
  pendingOpens.set(name, pending);
  return pending;
}

export function prefetchFitnessModal(name) {
  const connection = navigator.connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
  if (loaders[name]) void loadModal(name).catch(() => loaded.delete(name));
}

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

  const [activityInfo, activityLibrary] = await Promise.all([
    loadModal('activityInfo'),
    loadModal('activityLibrary'),
  ]);
  activityInfo.close();
  activityLibrary.close();
}

export const Modals = {
  /**
   * Opens the activity library
   * @param {Object} callbacks - Handlers for activity, stats and edit taps
   */
  openActivityLibrary(callbacks) {
    return openLazyModal('activityLibrary', (modal) => modal.open(callbacks));
  },

  /**
   * Opens the saved-routines list
   */
  openRoutines() {
    return openLazyModal('routines', (modal) => modal.open());
  },

  /**
   * Opens the routine builder for a new routine
   * @param {Object} [options] - presetActivityIds, presetName, title, onSaved
   */
  openRoutineBuilder(options) {
    return openLazyModal('routineBuilder', (modal) => modal.openCreateMode(options));
  },

  /**
   * Opens the routine builder on an existing routine
   * @param {string} routineId - The routine ID to edit
   * @param {Object} [options] - onSaved callback
   */
  openEditRoutine(routineId, options) {
    return openLazyModal('routineBuilder', (modal) => modal.openEditMode(routineId, options));
  },

  /**
   * Opens the multi-select activity picker for recording on the selected day
   * @param {Object} [options] - onConfirm callback receiving the selected activity IDs
   */
  openActivityPicker(options) {
    return openLazyModal('activityPicker', (modal) => modal.open(options));
  },

  /**
   * Opens the multi-select routine picker for recording on the selected day
   * @param {Object} [options] - onConfirm callback receiving the selected routine IDs
   */
  openRoutinePicker(options) {
    return openLazyModal('routinePicker', (modal) => modal.open(options));
  },

  /**
   * Opens the read-only program overview
   * @param {string} programId - The program ID
   */
  openProgramDetails(programId) {
    return openLazyModal('programDetails', (modal) => modal.open(programId));
  },

  /**
   * Opens the program builder for a new program
   * @param {Object} [options] - onSaved callback
   */
  openProgramBuilder(options) {
    return openLazyModal('programBuilder', (modal) => modal.openCreateMode(options));
  },

  /**
   * Opens the program builder on an existing program
   * @param {string} programId - The program ID to edit
   * @param {Object} [options] - onSaved callback
   */
  openEditProgram(programId, options) {
    return openLazyModal('programBuilder', (modal) => modal.openEditMode(programId, options));
  },

  /**
   * Opens the add activity modal
   */
  openAddActivity() {
    return openLazyModal('addEditActivity', (modal) => modal.openAddMode());
  },

  /**
   * Opens the edit activity modal
   * @param {string} activityId - The activity ID to edit
   */
  openEditActivity(activityId) {
    return openLazyModal('addEditActivity', (modal) => modal.openEditMode(activityId));
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
    return openLazyModal('activityInfo', (modal) =>
      modal.open(activityId, {
        onRecord: (id) => void recordToToday(id),
        onEdit: (id) => this.openEditActivity(id),
        onStats: (id) => this.openStats(id),
        ...callbacks,
      })
    );
  },

  /**
   * Opens the record modal for logging a session against the selected day
   * @param {string} activityId - The activity ID
   */
  openActivityDetails(activityId) {
    return openLazyModal('activityDetails', (modal) => modal.open(activityId));
  },

  /**
   * Opens the activity details modal with existing record
   * @param {string} activityId - The activity ID
   * @param {Object} record - The existing activity record
   */
  openActivityDetailsWithRecord(activityId, record) {
    return openLazyModal('activityDetails', (modal) => modal.openWithRecord(activityId, record));
  },

  /**
   * Opens the statistics modal
   * @param {string} activityId - The activity ID
   */
  openStats(activityId) {
    return openLazyModal('stats', (modal) => modal.open(activityId));
  },
};
