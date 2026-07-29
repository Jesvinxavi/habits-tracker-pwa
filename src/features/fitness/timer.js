/**
 * Timer utilities for the fitness tracker
 * Provides start/stop/reset functionality with persistent state
 */

// Timer state
let timerState = {
  isRunning: false,
  elapsedSeconds: 0,
  startTime: null,
  pausedTime: 0,
};

/**
 * Gets the current timer state
 * @returns {object} Timer state with isRunning and elapsedSeconds
 */
export function getTimerState() {
  const elapsedSeconds = timerState.isRunning
    ? Math.floor((Date.now() - timerState.startTime) / 1000)
    : timerState.elapsedSeconds;
  return { ...timerState, elapsedSeconds };
}

/**
 * Starts the timer
 * @param {function} callback - Optional callback to call when timer starts
 */
export function startTimer(callback) {
  if (timerState.isRunning) return;

  timerState.isRunning = true;
  timerState.startTime = Date.now() - timerState.elapsedSeconds * 1000;

  if (callback) callback();
}

/**
 * Stops/pauses the timer
 * @param {function} callback - Optional callback to call when timer stops
 */
export function stopTimer(callback) {
  if (!timerState.isRunning) return;

  timerState.elapsedSeconds = Math.floor((Date.now() - timerState.startTime) / 1000);
  timerState.isRunning = false;

  if (callback) callback();
}

/**
 * Resets the timer to zero
 * @param {function} callback - Optional callback to call when timer resets
 */
export function resetTimer(callback) {
  // Stop the timer if running
  if (timerState.isRunning) {
    stopTimer();
  }

  // Reset state
  timerState.elapsedSeconds = 0;
  timerState.startTime = null;
  timerState.pausedTime = 0;

  if (callback) callback();
}
