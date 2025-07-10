/**
 * Action Buttons Component
 *
 * Universal component for building action buttons row
 * Supports both habits (New Category + New Habit) and fitness (New Activity + Timer) use cases
 */

import { getTimerState, setTimerUpdateCallback, initializeTimer } from '../features/fitness/timer.js';

/**
 * Mounts the action buttons row
 * @param {Object} options - Configuration options
 * @param {string} options.type - Type of buttons ('habits' or 'fitness')
 * @param {Object} options.callbacks - Event handlers for buttons
 * @param {Function} options.callbacks.onNewCategory - Handler for new category button (habits)
 * @param {Function} options.callbacks.onNewHabit - Handler for new habit button (habits)
 * @param {Function} options.callbacks.onNewActivity - Handler for new activity button (fitness)
 * @param {Function} options.callbacks.onTimer - Handler for timer button (fitness)
 * @returns {HTMLElement} The action buttons element
 */
export function mountActionButtons(options = {}) {
  const { type = 'habits', callbacks = {} } = options;
  
  const actionButtons = document.createElement('div');
  actionButtons.className = 'action-buttons flex gap-3 mb-1 px-4 pt-1';

  if (type === 'habits') {
    actionButtons.innerHTML = `
      <button class="new-category-btn flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-2 px-4 rounded-xl font-medium flex items-center justify-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" stroke-width="2"/>
        </svg>
        New Category
      </button>
      <button class="new-habit-btn flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-2 px-4 rounded-xl font-medium flex items-center justify-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        New Habit
      </button>
    `;

    // Make button text bold
    actionButtons.querySelectorAll('.new-category-btn, .new-habit-btn').forEach((btn) => {
      btn.classList.add('font-semibold');
    });

    // Bind button events
    const newCategoryBtn = actionButtons.querySelector('.new-category-btn');
    const newHabitBtn = actionButtons.querySelector('.new-habit-btn');

    if (newCategoryBtn && callbacks.onNewCategory) {
      newCategoryBtn.addEventListener('click', callbacks.onNewCategory);
    }

    if (newHabitBtn && callbacks.onNewHabit) {
      newHabitBtn.addEventListener('click', callbacks.onNewHabit);
    }
  } else if (type === 'fitness') {
    actionButtons.innerHTML = `
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

    // Make button text bold
    actionButtons.querySelectorAll('#new-activity-btn, #start-timer-btn').forEach((btn) => {
      btn.classList.add('font-semibold');
    });

    // Bind event handlers
    const newActivityBtn = actionButtons.querySelector('#new-activity-btn');
    const startTimerBtn = actionButtons.querySelector('#start-timer-btn');

    if (newActivityBtn && callbacks.onNewActivity) {
      newActivityBtn.addEventListener('click', callbacks.onNewActivity);
    }

    if (startTimerBtn && callbacks.onTimer) {
      startTimerBtn.addEventListener('click', callbacks.onTimer);
    }

    // Initialize timer and set up update callback
    initializeTimer();
    setTimerUpdateCallback(() => {
      updateTimerButton(startTimerBtn);
    });

    // Update button states initially
    updateTimerButton(startTimerBtn);
  }

  return actionButtons;
}

/**
 * Updates the timer button visual state based on timer status (fitness only)
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