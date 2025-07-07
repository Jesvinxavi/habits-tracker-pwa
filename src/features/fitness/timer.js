/**
 * Timer utilities for the fitness tracker
 * Provides start/stop/reset functionality with persistent state
 */

// formatElapsedTime import removed - function moved to datetime.js but not used in timer.js

// Timer state
let timerState = {
  isRunning: false,
  elapsedSeconds: 0,
  startTime: null,
  pausedTime: 0,
};

// Timer interval and callbacks
let timerInterval = null;
let updateCallback = null;

// formatElapsedTime function moved to datetime.js for centralization

/**
 * Gets the current timer state
 * @returns {object} Timer state with isRunning and elapsedSeconds
 */
export function getTimerState() {
  return { ...timerState };
}

/**
 * Starts the timer
 * @param {function} callback - Optional callback to call when timer starts
 */
export function startTimer(callback) {
  if (timerState.isRunning) return;

  timerState.isRunning = true;
  timerState.startTime = Date.now() - timerState.elapsedSeconds * 1000;

  // Start the timer interval
  timerInterval = setInterval(() => {
    const now = Date.now();
    timerState.elapsedSeconds = Math.floor((now - timerState.startTime) / 1000);

    // Call update callback if set
    if (updateCallback) {
      updateCallback();
    }
  }, 1000);

  if (callback) callback();
}

/**
 * Stops/pauses the timer
 * @param {function} callback - Optional callback to call when timer stops
 */
export function stopTimer(callback) {
  if (!timerState.isRunning) return;

  timerState.isRunning = false;

  // Clear the interval
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

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

/**
 * Sets the update callback function
 * @param {function} callback - Function to call on timer updates
 */
export function setTimerUpdateCallback(callback) {
  updateCallback = callback;
}

/**
 * Initializes the timer system
 */
export function initializeTimer() {
  // Reset to clean state
  timerState = {
    isRunning: false,
    elapsedSeconds: 0,
    startTime: null,
    pausedTime: 0,
  };

  // Clear any existing interval
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  updateCallback = null;
}

/**
 * Gets elapsed time for recording purposes
 * @returns {number} Current elapsed seconds
 */
export function getElapsedForRecording() {
  return timerState.elapsedSeconds;
}
