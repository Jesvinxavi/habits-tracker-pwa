// ActionButtons.js - Action buttons component for the habits view
/**
 * Mounts the action buttons (new category + new habit)
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onNewCategory - Callback when new category button is clicked
 * @param {Function} callbacks.onNewHabit - Callback when new habit button is clicked
 * @returns {HTMLElement} The action buttons element
 */
export function mountActionButtons(callbacks = {}) {
  const actionButtons = document.createElement('div');
  actionButtons.className = 'action-buttons flex gap-3 mb-1 px-4 pt-1';

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

  // Make button text bold like fitness page
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

  return actionButtons;
}
