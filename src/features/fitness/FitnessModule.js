// FitnessModule.js - Main entry point for the modular fitness feature
import { FitnessView } from './FitnessView.js';
import { Modals, prefetchFitnessModal } from './FitnessModals.js';
import { getState, dispatch, Actions, subscribe } from '../../core/state.js';
import { getLocalMidnightISOString, getLocalISODate } from '../../shared/datetime.js';
import { FitnessCalendar } from './FitnessCalendar.js';
import { getActivitiesForDate, getActivity, recordActivitiesForDate } from './activities.js';
import { recordRoutinesForDate } from './routines.js';
import { renderProgramTile } from './ProgramTile.js';
import { addProgramRoutinesToDate } from './programs.js';
import { showConfirm } from '../../components/ConfirmDialog.js';
import { shallowArrayEqual } from '../../shared/equality.js';

// Flag to prevent double-initialisation when the module is imported twice (eagerly at boot and lazily via navigation)
let _initialized = false;
let _active = false;
let _unsubscribe = null;

function renderFitnessState() {
  FitnessView.renderActivities((activityId, record) => {
    if (record) {
      Modals.openActivityDetailsWithRecord(activityId, record);
    } else {
      handleActivityClick(activityId);
    }
  });
  renderProgramTile();
  FitnessView.updateRestToggle();
}

/**
 * Opens the record modal. The rest-day guard lives inside that modal, so every
 * route to recording refuses a rest day identically.
 * @param {string} activityId - The activity ID
 * @returns {void}
 */
function handleActivityClick(activityId) {
  Modals.openActivityDetails(activityId);
}



/**
 * Opens the routine builder pre-filled with the activities recorded on the
 * selected date, so the user can trim the selection and name it.
 * @returns {void}
 */
function openSaveTodayAsRoutine() {
  const iso = getLocalISODate(getState().fitnessSelectedDate || new Date().toISOString());
  const records = getActivitiesForDate(iso);
  // The same activity recorded three times in a day becomes one routine entry.
  const activityIds = [...new Set(records.map((record) => record.activityId))].filter((id) =>
    Boolean(getActivity(id))
  );

  if (activityIds.length === 0) {
    showConfirm({
      title: 'Nothing to Save',
      message: 'Record at least one activity before saving it as a routine.',
      okText: 'OK',
      cancelText: '',
      onOK: () => {},
    });
    return;
  }

  Modals.openRoutineBuilder({
    presetActivityIds: activityIds,
    title: 'Save as Routine',
    onSaved: () => {},
  });
}

/**
 * Records the active program's routines for the selected date, explaining itself
 * when there is nothing to add.
 * @returns {Promise<void>}
 */
async function addProgramDayToSelectedDate() {
  const iso = getLocalISODate(getState().fitnessSelectedDate || new Date().toISOString());

  const result = await addProgramRoutinesToDate(iso);
  if (result.recorded > 0 || result.blocked) return;

  // Nothing was written: either the program plans nothing for this day, or
  // everything it plans is already on it.
  showConfirm({
    title: result.scheduled > 0 ? 'Already Logged' : 'Nothing Scheduled',
    message:
      result.scheduled > 0
        ? 'Everything this program schedules for this day is already recorded.'
        : 'No active program schedules routines for this day.',
    okText: 'OK',
    cancelText: '',
    onOK: () => {},
  });
}

/**
 * Builds the handlers for the + dropdown beside the Activities pill.
 * @returns {Object} Handlers keyed by menu intent.
 */
function buildAddMenuActions() {
  const selectedDateISO = () =>
    getLocalISODate(getState().fitnessSelectedDate || new Date().toISOString());

  return {
    // A selection surface rather than the library: no stats or edit buttons, and
    // several activities can be added in one action.
    onAddActivity: () =>
      Modals.openActivityPicker({
        onConfirm: (activityIds) => {
          void recordActivitiesForDate(activityIds, selectedDateISO());
        },
      }),
    onAddRoutine: () =>
      Modals.openRoutinePicker({
        onConfirm: (routineIds) => {
          void recordRoutinesForDate(routineIds, selectedDateISO());
        },
      }),
    onAddProgramDay: () => void addProgramDayToSelectedDate(),
    onSaveAsRoutine: () => openSaveTodayAsRoutine(),
    onNewProgram: () => Modals.openProgramBuilder({ onSaved: () => renderProgramTile() }),
    onTimer: () =>
      import('./TimerModule.js').then(({ Timer }) => {
        Timer.bindEvents();
        Timer.openModal();
      }),
  };
}

/**
 * Initializes the fitness view with all its modular components
 * This replaces the legacy initializeFitness function from src/ui/fitness.js
 */
export async function initializeFitness() {
  // Skip if we've already mounted everything
  if (_initialized) {
    return;
  }
  _initialized = true;

  // Ensure fitness always starts on today when initialized
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to local midnight to avoid timezone issues

  // Create local ISO string to avoid timezone conversion issues
  const localToday = getLocalMidnightISOString(today);

  dispatch(Actions.setFitnessSelectedDate(localToday));

  // Get the fitness view container
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) {
    return;
  }

  // Mount the complete fitness view with all components
  await FitnessView.mount(fitnessView, {
    // A library tile opens the activity's details rather than recording it
    // outright; recording is one explicit button further in.
    onActivityLibrary: () =>
      Modals.openActivityLibrary({
        onActivityClick: (activityId) => Modals.openActivityInfo(activityId),
      }),
    onRoutines: () => Modals.openRoutines(),
    addMenu: buildAddMenuActions(),
    onActivityClick: (activityId) => handleActivityClick(activityId),
    onDateChange: () => {
      // The calendar owns the date state update; this callback handles
      // dependent controls only.
      FitnessView.updateRestToggle();
    },
    onRestToggle: () => {},
  });

  [
    ['fitness-activity-btn', 'activityLibrary'],
    ['fitness-routines-btn', 'routines'],
    ['fitness-add-menu-btn', 'activityPicker'],
  ].forEach(([id, modalName]) => {
    const trigger = document.getElementById(id);
    trigger?.addEventListener('pointerdown', () => prefetchFitnessModal(modalName), {
      once: true,
    });
    trigger?.addEventListener('pointerenter', () => prefetchFitnessModal(modalName), {
      once: true,
    });
  });

  // After calendar mount and storage-hydration event, center the calendar
  if (FitnessCalendar.ready && FitnessCalendar.scrollToSelected) {
    await FitnessCalendar.ready;
    FitnessCalendar.scrollToSelected({ instant: true });
  }

  // Initial render
  renderFitnessState();

}

/**
 * Standard init function expected by navigation.js
 */
export async function init() {
  await initializeFitness();
}

export function activate() {
  _active = true;
  if (!_initialized || _unsubscribe) return;
  _unsubscribe = subscribe(
    (state) => [
      state.activities,
      state.activityCategories,
      state.recordedActivities,
      state.routines,
      state.programs,
      state.restDays,
      state.fitnessSelectedDate,
    ],
    () => {
      if (_active) renderFitnessState();
    },
    { equalityFn: shallowArrayEqual }
  );
  renderFitnessState();
}

export function deactivate() {
  _active = false;
  _unsubscribe?.();
  _unsubscribe = null;
}

export const FitnessModule = {
  init,
  activate,
  deactivate,
};
