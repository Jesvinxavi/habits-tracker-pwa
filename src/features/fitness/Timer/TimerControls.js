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
          });
        } else {
          // Start/resume the timer
          startTimer(() => {
            if (onUpdate) onUpdate();
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
        });
      });
    }
  },
};
