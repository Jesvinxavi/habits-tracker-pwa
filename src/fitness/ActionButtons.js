/**
 * Fitness Action Buttons Component
 *
 * Component for building the action buttons row (New Activity + Timer)
 * Extracted from src/ui/fitness.js for better modularity
 */

import { getTimerState, setTimerUpdateCallback, initializeTimer } from '../utils/timer.js';

/**
 * Mounts the action buttons row for the fitness view
 * @param {Object} handlers - Event handlers for buttons
 * @param {Function} handlers.onNewActivity - Handler for new activity button
 * @param {Function} handlers.onTimer - Handler for timer button
 * @returns {HTMLElement} The action buttons element
 */
export function mountActionButtons(handlers = {}) {
  // Add Action Buttons row (like Habits page)
  const actionButtonsRow = document.createElement('div');
  actionButtonsRow.className = 'action-buttons flex gap-3 mb-1 px-4 pt-1';
  actionButtonsRow.innerHTML = `
    <button id="new-activity-btn" class="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-1.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      New Activity
    </button>
    <button id="start-timer-btn" class="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-1.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2">
      <span class="material-icons text-xl">schedule</span>
      Timer
    </button>
  `;

  // Make button text bold like habits page
  actionButtonsRow.querySelectorAll('#new-activity-btn, #start-timer-btn').forEach((btn) => {
    btn.classList.add('font-semibold');
  });

  // Bind event handlers
  const newActivityBtn = actionButtonsRow.querySelector('#new-activity-btn');
  const startTimerBtn = actionButtonsRow.querySelector('#start-timer-btn');

  if (newActivityBtn && handlers.onNewActivity) {
    newActivityBtn.addEventListener('click', handlers.onNewActivity);
  }

  if (startTimerBtn && handlers.onTimer) {
    startTimerBtn.addEventListener('click', handlers.onTimer);
  }

  // Initialize timer and set up update callback
  initializeTimer();
  setTimerUpdateCallback(() => {
    updateTimerButton(startTimerBtn);
  });

  // Update button states initially
  updateTimerButton(startTimerBtn);

  return actionButtonsRow;
}

/**
 * Updates the timer button visual state based on timer status
 * @param {HTMLElement} timerBtn - The timer button element
 */
export function updateTimerButton(timerBtn) {
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
}
