// FitnessModule.js - Main entry point for the modular fitness feature
import { FitnessView } from './FitnessView.js';
import { Modals } from './FitnessModals.js';
import { Timer } from './TimerModule.js';
import { getState, dispatch, Actions, subscribe } from '../../core/state.js';
import { getLocalMidnightISOString, getLocalISODate } from '../../shared/datetime.js';
import { FitnessCalendar } from './FitnessCalendar.js';
import { getActivitiesForDate, getActivity, recordActivitiesForDate } from './activities.js';
import { recordRoutinesForDate } from './routines.js';
import { renderProgramTile } from './ProgramTile.js';
import { addProgramRoutinesToDate } from './programs.js';
import { showConfirm } from '../../components/ConfirmDialog.js';
import { isCloudBackend } from '../../core/dataBackend.js';

// Flag to prevent double-initialisation when the module is imported twice (eagerly at boot and lazily via navigation)
let _initialized = false;

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
    onTimer: () => Timer.openModal(),
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

  // Clean up any fitness categories that accidentally got mixed into habits categories
  cleanupFitnessFromHabitsCategories();

  // Clear any existing activities to ensure no prepopulated activities
  clearExistingActivities();

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
    onRestToggle: () => {
      // We just need to refresh the calendar and activity list to reflect the changes
      // Refresh the activity list to show rest day message or activities
      FitnessView.renderActivities((activityId, record) => {
        if (record) {
          Modals.openActivityDetailsWithRecord(activityId, record);
        } else {
          handleActivityClick(activityId);
        }
      });
    },
  });

  // After calendar mount and storage-hydration event, center the calendar
  if (FitnessCalendar.ready && FitnessCalendar.scrollToSelected) {
    await FitnessCalendar.ready;
    FitnessCalendar.scrollToSelected({ instant: true });
  }

  // Subscribe to state changes for reactive updates
  let lastFitnessDate = getState().fitnessSelectedDate;
  subscribe(() => {
    FitnessView.renderActivities((activityId, record) => {
      if (record) {
        Modals.openActivityDetailsWithRecord(activityId, record);
      } else {
        handleActivityClick(activityId);
      }
    });
    // A single small template, so a plain re-render on any state change is cheap
    // enough and keeps the tile honest as records, rest days and programs change.
    renderProgramTile();
    // Only update rest toggle if the selected date changed
    if (getState().fitnessSelectedDate !== lastFitnessDate) {
      lastFitnessDate = getState().fitnessSelectedDate;
      FitnessView.updateRestToggle();
    }
  });

  // Initial render
  FitnessView.renderActivities((activityId, record) => {
    if (record) {
      Modals.openActivityDetailsWithRecord(activityId, record);
    } else {
      handleActivityClick(activityId);
    }
  });

  // Render the program tile for the active program, if there is one
  renderProgramTile();

  // Set up responsive behavior
  FitnessView.setupResponsiveBehavior();

  // Initialize timer event handlers
  Timer.bindEvents();

  // Listen for activity recorded events
  document.addEventListener('ActivityRecorded', () => {
    FitnessView.renderActivities((activityId, record) => {
      if (record) {
        Modals.openActivityDetailsWithRecord(activityId, record);
      } else {
        handleActivityClick(activityId);
      }
    });
  });
}

/**
 * Cleans up any fitness categories that accidentally got mixed into habits categories
 */
function cleanupFitnessFromHabitsCategories() {
  if (isCloudBackend()) return;
  if (localStorage.getItem('habitsAppFitnessMigrationV1') === 'true') {
    return;
  }
  
  dispatch((dispatch, getState) => {
    const state = getState();
    const categories = state.categories.filter((cat) => !cat.id.startsWith('fitness-'));
    
    const activityCategories = [
      { id: 'cardio', name: 'Cardio', icon: '❤️', color: '#ef4444' },
      { id: 'strength', name: 'Strength', icon: '💪', color: '#3b82f6' },
      { id: 'stretching', name: 'Stretching', icon: '🧘‍♀️', color: '#10b981' },
      { id: 'sports', name: 'Sports', icon: '⚽', color: '#f59e0b' },
      { id: 'other', name: 'Other', icon: '🎯', color: '#eab308' },
    ];
    
    dispatch(Actions.importData({ categories, activityCategories }));
  });
  
  localStorage.setItem('habitsAppFitnessMigrationV1', 'true');
}

/**
 * Clears only system-generated sample activities while preserving user-created activities
 */
function clearExistingActivities() {
  if (isCloudBackend()) return;
  if (localStorage.getItem('habitsAppFitnessMigrationV1') === 'true') {
    return;
  }
  
  // List of known sample activity names that should be removed
  const sampleActivityNames = ['Running', 'Push-ups', 'Squats', 'Yoga', 'Basketball', 'Swimming'];

  dispatch((dispatch, getState) => {
    const state = getState();
    const activities = state.activities.filter((activity) => !sampleActivityNames.includes(activity.name));
    dispatch(Actions.importData({ activities }));
  });
  
  localStorage.setItem('habitsAppFitnessMigrationV1', 'true');
}

/**
 * Standard init function expected by navigation.js
 */
export async function init() {
  await initializeFitness();
}

export const FitnessModule = {
  init,
};
