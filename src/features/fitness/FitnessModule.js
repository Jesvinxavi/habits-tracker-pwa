// FitnessModule.js - Main entry point for the modular fitness feature
import { FitnessView } from './FitnessView.js';
import { Modals } from './FitnessModals.js';
import { Timer } from './TimerModule.js';
import { mutate, subscribe, appData } from '../../core/state.js';
import { getLocalMidnightISOString } from '../../shared/datetime.js';
import { FitnessCalendar } from './FitnessCalendar.js';

/**
 * Initializes the fitness view with all its modular components
 * This replaces the legacy initializeFitness function from src/ui/fitness.js
 */
export async function initializeFitness() {
  // Clean up any fitness categories that accidentally got mixed into habits categories
  cleanupFitnessFromHabitsCategories();

  // Clear any existing activities to ensure no prepopulated activities
  clearExistingActivities();

  // Ensure fitness always starts on today when initialized
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to local midnight to avoid timezone issues

  // Create local ISO string to avoid timezone conversion issues
  const localToday = getLocalMidnightISOString(today);

  mutate((s) => {
    s.fitnessSelectedDate = localToday;
  });

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
      mutate((s) => {
        s.fitnessSelectedDate = date.toISOString();
      });
      // Refresh the calendar and rest toggle after date change
      if (FitnessCalendar.ready && FitnessCalendar.scrollToSelected) {
        FitnessCalendar.ready.then(() => {
          FitnessCalendar.scrollToSelected({ instant: true });
        });
      }
      FitnessView.updateRestToggle();
    },
    onRestToggle: () => {
      // The rest day toggle functionality is already handled in RestToggle.js
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
  let lastFitnessDate = appData.fitnessSelectedDate;
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
    if (appData.fitnessSelectedDate !== lastFitnessDate) {
      lastFitnessDate = appData.fitnessSelectedDate;
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
  mutate((s) => {
    // Remove any fitness-related categories from habits categories
    s.categories = s.categories.filter((cat) => !cat.id.startsWith('fitness-'));

    // Ensure activity categories exist
    if (!s.activityCategories) {
      s.activityCategories = [
        { id: 'cardio', name: 'Cardio', icon: '❤️', color: '#ef4444' },
        { id: 'strength', name: 'Strength', icon: '💪', color: '#3b82f6' },
        { id: 'stretching', name: 'Stretching', icon: '🧘‍♀️', color: '#10b981' },
        { id: 'sports', name: 'Sports', icon: '⚽', color: '#f59e0b' },
        { id: 'yoga', name: 'Yoga', icon: '🧘', color: '#8b5cf6' },
        { id: 'swimming', name: 'Swimming', icon: '🏊‍♂️', color: '#06b6d4' },
      ];
    }
  });
}

/**
 * Clears only system-generated sample activities while preserving user-created activities
 */
function clearExistingActivities() {
  // List of known sample activity names that should be removed
  const sampleActivityNames = ['Running', 'Push-ups', 'Squats', 'Yoga', 'Basketball', 'Swimming'];

  mutate((s) => {
    // Filter out only the sample activities, keep user-created ones
    s.activities = s.activities.filter((activity) => !sampleActivityNames.includes(activity.name));
  });
}
