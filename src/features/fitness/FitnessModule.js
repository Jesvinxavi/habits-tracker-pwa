// FitnessModule.js - Main entry point for the modular fitness feature
import { FitnessView } from './FitnessView.js';
import { Modals } from './FitnessModals.js';
import { Timer } from './TimerModule.js';
import { getState, dispatch, Actions, subscribe } from '../../core/state.js';
import { getLocalMidnightISOString } from '../../shared/datetime.js';
import { FitnessCalendar } from './FitnessCalendar.js';

// Flag to prevent double-initialisation when the module is imported twice (eagerly at boot and lazily via navigation)
let _initialized = false;

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
    onNewActivity: () => Modals.openAddActivity(),
    onSearchActivityClick: (activityId) => Modals.openActivityDetails(activityId),
    onStatsClick: (activityId) => Modals.openStats(activityId),
    onEditClick: (activityId) => Modals.openEditActivity(activityId),
    onActivityClick: (activityId) => Modals.openActivityDetails(activityId),
    onDateChange: (date) => {
      dispatch(Actions.setFitnessSelectedDate(date.toISOString()));
      // Refresh the calendar and rest toggle after date change
      if (FitnessCalendar.ready && FitnessCalendar.scrollToSelected) {
        FitnessCalendar.ready.then(() => {
          FitnessCalendar.scrollToSelected({ instant: true });
        });
      }
      FitnessView.updateRestToggle();
    },
    onRestToggle: () => {
      // We just need to refresh the calendar and activity list to reflect the changes

      // Refresh the calendar to show/hide rest day styling
      if (FitnessCalendar.ready && FitnessCalendar.scrollToSelected) {
        FitnessCalendar.ready.then(() => {
          FitnessCalendar.scrollToSelected({ instant: true });
        });
      }

      // Refresh the activity list to show rest day message or activities
      FitnessView.renderActivities((activityId, record) => {
        if (record) {
          Modals.openActivityDetailsWithRecord(activityId, record);
        } else {
          Modals.openActivityDetails(activityId);
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
        Modals.openActivityDetails(activityId);
      }
    });
    FitnessView.updateTimerButton();
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
      Modals.openActivityDetails(activityId);
    }
  });

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
        Modals.openActivityDetails(activityId);
      }
    });
  });
}

/**
 * Cleans up any fitness categories that accidentally got mixed into habits categories
 */
function cleanupFitnessFromHabitsCategories() {
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
