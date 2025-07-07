// TimerButton.js - Timer button component with state management
import { getTimerState } from '../timer.js';

/**
 * TimerButton component for managing timer button state
 */
export const TimerButton = {
  /**
   * Updates the timer button visual state based on timer status
   */
  update() {
    const timerBtn = document.getElementById('start-timer-btn');
    if (!timerBtn) return;

    const timerState = getTimerState();

    // Update visual state based on timer status, but keep text and icon static
    if (timerState.isRunning) {
      // Change to orange/red visual state when timer is running
      timerBtn.classList.remove(
        'bg-blue-100',
        'dark:bg-blue-900',
        'text-blue-600',
        'dark:text-blue-300'
      );
      timerBtn.classList.add(
        'bg-orange-100',
        'dark:bg-orange-900',
        'text-orange-600',
        'dark:text-orange-300'
      );
    } else {
      // Restore original blue styling when timer is stopped
      timerBtn.classList.remove(
        'bg-orange-100',
        'dark:bg-orange-900',
        'text-orange-600',
        'dark:text-orange-300'
      );
      timerBtn.classList.add(
        'bg-blue-100',
        'dark:bg-blue-900',
        'text-blue-600',
        'dark:text-blue-300'
      );
    }
  },
};
