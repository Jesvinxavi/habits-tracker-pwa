/**
 * Action Buttons Component
 *
 * Universal component for building action buttons row
 * Supports both habits (New Category + New Habit) and fitness (Activity + Routines) use cases
 */

import { getState, subscribe } from '../core/state.js';

/**
 * Mounts the action buttons row
 * @param {Object} options - Configuration options
 * @param {string} options.type - Type of buttons ('habits' or 'fitness')
 * @param {Object} options.callbacks - Event handlers for buttons
 * @param {Function} options.callbacks.onNewCategory - Handler for new category button (habits)
 * @param {Function} options.callbacks.onNewHabit - Handler for new habit button (habits)
 * @param {Function} options.callbacks.onActivityLibrary - Handler for the Activity button (fitness)
 * @param {Function} options.callbacks.onRoutines - Handler for the Routines button (fitness)
 * @returns {HTMLElement} The action buttons element
 */
export function mountActionButtons(options = {}) {
  const { type = 'habits', callbacks = {} } = options;
  
  const actionButtons = document.createElement('div');
  actionButtons.className = 'action-buttons flex gap-3 mb-1 px-4 pt-2';

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

    // Function to update New Habit button state based on categories
    const updateNewHabitButtonState = () => {
      if (!newHabitBtn) return;
      
      const hasCategories = getState().categories.length > 0;
      newHabitBtn.disabled = !hasCategories;
      
      if (hasCategories) {
        newHabitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        newHabitBtn.title = '';
      } else {
        newHabitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        newHabitBtn.title = 'Create a category first before adding habits';
      }
    };

    // Initial state update
    updateNewHabitButtonState();

    // Subscribe to state changes to update button when categories change
    subscribe(() => {
      updateNewHabitButtonState();
    });
  } else if (type === 'fitness') {
    actionButtons.innerHTML = `
      <button id="fitness-activity-btn" class="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-1.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2" aria-label="Open activity library">
        <span class="material-icons text-xl">fitness_center</span>
        Activity
      </button>
      <button id="fitness-routines-btn" class="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-1.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2" aria-label="Open routines">
        <span class="material-icons text-xl">repeat</span>
        Routines
      </button>
    `;

    // Make button text bold
    actionButtons
      .querySelectorAll('#fitness-activity-btn, #fitness-routines-btn')
      .forEach((btn) => {
        btn.classList.add('font-semibold');
      });

    // Bind event handlers
    const activityBtn = actionButtons.querySelector('#fitness-activity-btn');
    const routinesBtn = actionButtons.querySelector('#fitness-routines-btn');

    if (activityBtn && callbacks.onActivityLibrary) {
      activityBtn.addEventListener('click', callbacks.onActivityLibrary);
    }

    if (routinesBtn && callbacks.onRoutines) {
      routinesBtn.addEventListener('click', callbacks.onRoutines);
    }
  }

  return actionButtons;
}
