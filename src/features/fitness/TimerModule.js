// TimerModule.js - Orchestrates all timer-related subcomponents for the fitness feature
import { TimerModal } from './Timer/TimerModal.js';
import { ensureFitnessModalMarkup } from './FitnessModalMarkup.js';

/**
 * Main Timer component that orchestrates all timer functionality
 */
export const Timer = {
  /**
   * Opens the timer modal
   */
  openModal() {
    ensureFitnessModalMarkup('timer-modal');
    TimerModal.bindEvents();
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
    ensureFitnessModalMarkup('timer-modal');
    TimerModal.bindEvents();
  },
};
