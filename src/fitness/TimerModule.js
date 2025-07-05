// TimerModule.js - Orchestrates all timer-related subcomponents for the fitness feature
import { TimerButton } from './Timer/TimerButton.js';
import { TimerModal } from './Timer/TimerModal.js';
import { TimerControls } from './Timer/TimerControls.js';
import { LapList } from './Timer/LapList.js';

/**
 * Main Timer component that orchestrates all timer functionality
 */
export const Timer = {
  /**
   * Updates the timer button state
   */
  updateButton() {
    TimerButton.update();
  },

  /**
   * Opens the timer modal
   */
  openModal() {
    TimerModal.open();
  },

  /**
   * Closes the timer modal
   */
  closeModal() {
    TimerModal.close();
  },

  /**
   * Binds all timer event handlers
   */
  bindEvents() {
    TimerModal.bindEvents();
  },
};

// Re-export individual components for convenience
export { TimerButton, TimerModal, TimerControls, LapList };
