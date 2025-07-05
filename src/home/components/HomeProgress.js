// HomeProgress.js - Progress component for the home view
import * as scheduleUtils from '../schedule.js';
import { appData } from '../../core/state.js';
import { updateProgressRing } from '../../components/ProgressRing.js';
import { updateProgressPills } from '../../components/HomeProgressPills.js';

// Re-export for external use
export { updateProgressRing, updateProgressPills };

// Local aliases for schedule helpers
const { belongsToSelectedGroup, isHabitScheduledOnDate, isHabitCompleted, isHabitSkippedToday } =
  scheduleUtils;

/**
 * HomeProgress component that manages progress ring and pills
 */
export const HomeProgress = {
  /**
   * Mounts the progress component
   */
  mount(container) {
    this.container = container;

    // The progress ring is already in the DOM from the HTML template
    // We just need to update it
    this.render();
  },

  /**
   * Renders the progress components
   */
  render() {
    // Calculate and update progress ring
    const progress = this._calculateProgressForCurrentContext();
    updateProgressRing(progress);

    // Update progress pills
    updateProgressPills();
  },

  /**
   * Calculates progress for the current context
   */
  _calculateProgressForCurrentContext() {
    const dateObj = new Date(appData.selectedDate);

    // 1) Habits that belong to the currently selected group
    // 2) Are actually scheduled for the selected date (takes holiday mode into account)
    const scheduledHabits = appData.habits.filter(
      (h) => belongsToSelectedGroup(h, appData.selectedGroup) && isHabitScheduledOnDate(h, dateObj)
    );

    // 3) Remove any that the user explicitly skipped
    const activeHabits = scheduledHabits.filter((h) => !isHabitSkippedToday(h, dateObj));

    // 4) Determine how many of the remaining active habits are completed
    const completed = activeHabits.filter((h) => isHabitCompleted(h, dateObj));

    const progress = activeHabits.length ? (completed.length / activeHabits.length) * 100 : 0;
    return progress;
  },

  /**
   * Unmounts the progress component
   */
  unmount() {
    // No cleanup needed for progress components
    // They are part of the main DOM structure
  },
};
