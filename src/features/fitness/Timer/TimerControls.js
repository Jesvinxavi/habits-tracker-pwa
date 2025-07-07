// TimerControls.js - Timer controls component for start/stop/reset functionality
import { getTimerState, startTimer, stopTimer, resetTimer } from '../timer.js';
import { LapList } from './LapList.js';

/**
 * TimerControls component for managing timer control buttons
 */
export const TimerControls = {
  /**
   * Updates the timer controls based on current state
   */
  update() {
    const timerState = getTimerState();
    const startStopBtn = document.getElementById('timer-start-stop-btn');
    const recordLapBtn = document.getElementById('record-lap-btn');

    // Update start/stop button
    if (startStopBtn) {
      const icon = startStopBtn.querySelector('.material-icons');
      if (timerState.isRunning) {
        icon.textContent = 'pause';
        startStopBtn.classList.remove('bg-ios-blue');
        startStopBtn.classList.add('bg-red-500');
      } else {
        icon.textContent = 'play_arrow';
        startStopBtn.classList.remove('bg-red-500');
        startStopBtn.classList.add('bg-ios-blue');
      }
    }

    // Update lap button
    if (recordLapBtn) {
      recordLapBtn.disabled = timerState.elapsedSeconds === 0;
    }
  },

  /**
   * Binds event handlers for timer controls
   * @param {Function} onUpdate - Callback to trigger when timer state changes
   */
  bindEvents(onUpdate) {
    // Start/Stop button in modal
    const startStopBtn = document.getElementById('timer-start-stop-btn');
    if (startStopBtn) {
      startStopBtn.addEventListener('click', () => {
        const timerState = getTimerState();

        if (timerState.isRunning) {
          // Stop/pause the timer
          stopTimer(() => {
            if (onUpdate) onUpdate();
            updateTimerButtonState();
          });
        } else {
          // Start/resume the timer
          startTimer(() => {
            if (onUpdate) onUpdate();
            updateTimerButtonState();
          });
        }
      });
    }

    // Reset button
    const resetBtn = document.getElementById('timer-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetTimer(() => {
          // Also clear lap times when resetting
          LapList.clearLaps();
          if (onUpdate) onUpdate();

          // Update timer button state after reset
          updateTimerButtonState();
        });
      });
    }
  },
};

/**
 * Updates the timer button visual state based on timer status
 */
function updateTimerButtonState() {
  const timerBtn = document.getElementById('start-timer-btn');
  if (!timerBtn) return;

  const timerState = getTimerState();

  // Update visual state based on timer status
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
}
