/**
 * FitnessTimer - Timer component for fitness activities
 * Handles timer modal, lap tracking, and timer controls
 */

// Timer functionality for fitness activities
import {
  startTimer,
  stopTimer,
  resetTimer,
  getTimerState,
  setTimerUpdateCallback,
  initializeTimer,
} from '../../utils/timer.js';
import { formatElapsedTime } from '../../utils/datetime.js';

// Timer modal update interval
let timerModalUpdateInterval = null;

/**
 * Updates the timer button text based on current state
 */
export function updateTimerButton() {
  const timerBtn = document.getElementById('start-timer-btn');
  if (!timerBtn) return;

  const state = getTimerState();
  const icon = timerBtn.querySelector('.material-icons');
  const textNode = timerBtn.childNodes[timerBtn.childNodes.length - 1];

  if (state.isRunning) {
    icon.textContent = 'pause';
    textNode.textContent = 'Pause';
    timerBtn.classList.add('bg-red-100', 'dark:bg-red-900', 'text-red-600', 'dark:text-red-300');
    timerBtn.classList.remove(
      'bg-blue-100',
      'dark:bg-blue-900',
      'text-blue-600',
      'dark:text-blue-300'
    );
  } else if (state.elapsedTime > 0) {
    icon.textContent = 'play_arrow';
    textNode.textContent = 'Resume';
    timerBtn.classList.add(
      'bg-green-100',
      'dark:bg-green-900',
      'text-green-600',
      'dark:text-green-300'
    );
    timerBtn.classList.remove(
      'bg-blue-100',
      'dark:bg-blue-900',
      'text-blue-600',
      'dark:text-blue-300'
    );
  } else {
    icon.textContent = 'schedule';
    textNode.textContent = 'Timer';
    timerBtn.classList.add(
      'bg-blue-100',
      'dark:bg-blue-900',
      'text-blue-600',
      'dark:text-blue-300'
    );
    timerBtn.classList.remove('bg-red-100', 'dark:bg-red-900', 'text-red-600', 'dark:text-red-300');
    timerBtn.classList.remove(
      'bg-green-100',
      'dark:bg-green-900',
      'text-green-600',
      'dark:text-green-300'
    );
  }
}

/**
 * Opens the timer modal
 */
export function openTimerModal() {
  // Initialize timer if not already done
  initializeTimer();

  // Set up timer update callback for modal
  setTimerUpdateCallback(() => {
    updateTimerDisplay();
  });

  // Create and show timer modal
  const modal = document.createElement('div');
  modal.id = 'timer-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4">
      <div class="text-center">
        <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Workout Timer</h2>
        <div id="timer-display" class="text-6xl font-mono font-bold mb-6 text-gray-900 dark:text-white">00:00</div>
        <div class="flex gap-3 mb-4">
          <button id="timer-start-stop" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-xl font-medium">Start</button>
          <button id="timer-lap" class="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-medium">Lap</button>
          <button id="timer-reset" class="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-xl font-medium">Reset</button>
        </div>
        <div id="lap-times" class="max-h-32 overflow-y-auto mb-4"></div>
        <button id="close-timer-modal" class="w-full bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-xl font-medium">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Initial display update
  updateTimerDisplay();
  renderLapTimesList();

  // Start update interval
  startTimerModalUpdateInterval();

  // Bind events
  bindTimerModalEvents();
}

/**
 * Closes the timer modal
 */
export function closeTimerModal() {
  const modal = document.getElementById('timer-modal');
  if (modal) {
    modal.remove();
  }

  // Stop update interval
  stopTimerModalUpdateInterval();

  // Clear timer update callback
  setTimerUpdateCallback(null);
}

/**
 * Starts the timer modal update interval
 */
function startTimerModalUpdateInterval() {
  if (timerModalUpdateInterval) {
    clearInterval(timerModalUpdateInterval);
  }

  timerModalUpdateInterval = setInterval(() => {
    updateTimerDisplay();
  }, 100); // Update every 100ms for smooth display
}

/**
 * Stops the timer modal update interval
 */
function stopTimerModalUpdateInterval() {
  if (timerModalUpdateInterval) {
    clearInterval(timerModalUpdateInterval);
    timerModalUpdateInterval = null;
  }
}

/**
 * Updates the timer display in the modal
 */
function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  const startStopBtn = document.getElementById('timer-start-stop');
  const lapBtn = document.getElementById('timer-lap');

  if (!display || !startStopBtn || !lapBtn) return;

  const state = getTimerState();
  const currentTime = state.isRunning ? Date.now() : state.lastUpdateTime;
  const totalElapsed = state.elapsedTime + (state.isRunning ? currentTime - state.startTime : 0);

  display.textContent = formatElapsedTime(totalElapsed);

  // Update button states
  if (state.isRunning) {
    startStopBtn.textContent = 'Pause';
    startStopBtn.className =
      'flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-xl font-medium';
    lapBtn.disabled = false;
    lapBtn.className =
      'flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-4 rounded-xl font-medium';
  } else {
    startStopBtn.textContent = totalElapsed > 0 ? 'Resume' : 'Start';
    startStopBtn.className =
      'flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-xl font-medium';
    lapBtn.disabled = true;
    lapBtn.className =
      'flex-1 bg-gray-400 text-gray-200 py-3 px-4 rounded-xl font-medium cursor-not-allowed';
  }
}

/**
 * Renders the lap times list
 */
function renderLapTimesList() {
  const container = document.getElementById('lap-times');
  if (!container) return;

  const state = getTimerState();
  if (!state.lapTimes || state.lapTimes.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lapItems = state.lapTimes
    .map((lapTime, index) => {
      const lapNumber = index + 1;
      const lapDuration = index === 0 ? lapTime : lapTime - state.lapTimes[index - 1];
      return `
      <div class="flex justify-between items-center py-1 px-2 bg-gray-100 dark:bg-gray-700 rounded mb-1">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Lap ${lapNumber}</span>
        <div class="flex items-center gap-2">
          <span class="text-sm font-mono text-gray-600 dark:text-gray-400">${formatElapsedTime(lapDuration)}</span>
          <button class="text-red-500 hover:text-red-700 text-xs" onclick="deleteLap(${index})">×</button>
        </div>
      </div>
    `;
    })
    .join('');

  container.innerHTML = lapItems;
}

/**
 * Records a new lap time
 */
function recordLap() {
  const state = getTimerState();
  if (!state.isRunning) return;

  const currentTime = Date.now();
  const totalElapsed = state.elapsedTime + (currentTime - state.startTime);

  // Add lap time to state
  if (!state.lapTimes) {
    state.lapTimes = [];
  }
  state.lapTimes.push(totalElapsed);

  // Update display
  renderLapTimesList();
}

/**
 * Deletes a lap time
 */
function deleteLap(lapIndex) {
  const state = getTimerState();
  if (!state.lapTimes || lapIndex < 0 || lapIndex >= state.lapTimes.length) return;

  state.lapTimes.splice(lapIndex, 1);
  renderLapTimesList();
}

/**
 * Gets the current lap time
 */
function getCurrentLapTime() {
  const state = getTimerState();
  if (!state.isRunning) return 0;

  const currentTime = Date.now();
  const totalElapsed = state.elapsedTime + (currentTime - state.startTime);
  const lastLapTime =
    state.lapTimes && state.lapTimes.length > 0 ? state.lapTimes[state.lapTimes.length - 1] : 0;

  return totalElapsed - lastLapTime;
}

/**
 * Gets the total session time
 */
function getTotalSessionTime() {
  const state = getTimerState();
  const currentTime = state.isRunning ? Date.now() : state.lastUpdateTime;
  return state.elapsedTime + (state.isRunning ? currentTime - state.startTime : 0);
}

/**
 * Binds timer modal events
 */
function bindTimerModalEvents() {
  const startStopBtn = document.getElementById('timer-start-stop');
  const lapBtn = document.getElementById('timer-lap');
  const resetBtn = document.getElementById('timer-reset');
  const closeBtn = document.getElementById('close-timer-modal');

  if (startStopBtn) {
    startStopBtn.addEventListener('click', () => {
      const state = getTimerState();
      if (state.isRunning) {
        stopTimer();
      } else {
        startTimer();
      }
      updateTimerDisplay();
      updateTimerButton(); // Update main timer button
    });
  }

  if (lapBtn) {
    lapBtn.addEventListener('click', recordLap);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetTimer();
      updateTimerDisplay();
      renderLapTimesList();
      updateTimerButton(); // Update main timer button
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeTimerModal);
  }

  // Handle escape key
  const handleEscapeKey = (e) => {
    if (e.key === 'Escape') {
      closeTimerModal();
      document.removeEventListener('keydown', handleEscapeKey);
    }
  };
  document.addEventListener('keydown', handleEscapeKey);

  // Handle click outside modal
  const modal = document.getElementById('timer-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeTimerModal();
      }
    });
  }
}

// Make functions available globally for onclick handlers
window.deleteLap = deleteLap;
