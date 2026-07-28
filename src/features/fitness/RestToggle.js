/**
 * Rest Toggle Component
 *
 * Component for building the rest day toggle functionality
 */

import { isRestDay, toggleRestDay } from './restDays.js';
import { getState } from '../../core/state.js';
import { getLocalISODate } from '../../shared/datetime.js';
import { getActivitiesForDate } from './activities.js';
import { renderActivitiesList } from './ActivityList/ActivitiesList.js';
import { showConfirm } from '../../components/ConfirmDialog.js';
import { mountAddMenu } from './AddMenu.js';

/**
 * Mounts the rest day toggle for the fitness view
 * @param {Object} options - Configuration options
 * @param {Function} options.onToggle - Callback when rest day is toggled
 * @param {Object} [options.addMenu] - Handlers for the + dropdown items
 * @returns {HTMLElement} The rest day toggle element
 */
export function mountRestToggle(options = {}) {
  // Build Rest Day toggle row below calendar
  const restRow = document.createElement('div');
  restRow.className = 'flex items-center justify-between px-4 py-1 rest-toggle-row';
  restRow.innerHTML = `
    <div class="flex items-center gap-2 relative">
      <div id="activities-label" class="bg-blue-50 dark:bg-gray-800 text-gray-900 dark:text-white px-5 py-1.5 rounded-full text-xl font-bold flex items-center justify-center gap-2">
        <span class="material-icons text-xl">event_note</span>
        Schedule
      </div>
      <button id="fitness-timer-btn"
              class="w-9 h-9 rounded-full bg-blue-50 dark:bg-gray-800 text-ios-blue flex items-center justify-center transition-colors hover:bg-blue-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-ios-blue"
              aria-label="Open timer">
        <span class="material-icons text-xl">schedule</span>
      </button>
      <button id="fitness-add-menu-btn"
              class="w-9 h-9 rounded-full bg-blue-50 dark:bg-gray-800 text-ios-blue flex items-center justify-center transition-colors hover:bg-blue-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-ios-blue"
              aria-label="Add to today" aria-haspopup="true" aria-expanded="false">
        <span class="material-icons text-xl">add</span>
      </button>
    </div>
    <button id="rest-toggle" class="relative flex items-center justify-center h-9 bg-gray-200 text-gray-500 rounded-full overflow-hidden select-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ios-orange focus:ring-offset-2 dark:focus:ring-offset-gray-900" style="width: 36px;" aria-label="Toggle rest day for selected date" aria-pressed="false">
      <span class="bed material-icons absolute left-2 top-1/2 -translate-y-1/2 transition-transform text-2xl" aria-hidden="true">bed</span>
      <span class="label whitespace-nowrap ml-1 text-sm font-medium opacity-0 transition-opacity">Rest Day</span>
    </button>
  `;

  // Bind toggle event
  bindRestToggle(restRow, options.onToggle);

  // Mount the + dropdown as a sibling of its anchor, inside the relative wrapper.
  const addMenuBtn = restRow.querySelector('#fitness-add-menu-btn');
  if (addMenuBtn) mountAddMenu(addMenuBtn, options.addMenu || {});

  // The timer is a first-class action rather than a dropdown item: it is reached
  // mid-session, when hunting through a menu is exactly the wrong interaction.
  const timerBtn = restRow.querySelector('#fitness-timer-btn');
  if (timerBtn && options.addMenu?.onTimer) {
    timerBtn.addEventListener('click', options.addMenu.onTimer);
  }

  // Update initial state
  updateRestToggle(restRow);

  return restRow;
}

/**
 * Binds the rest toggle event handler
 * @param {HTMLElement} container - The rest toggle container
 * @param {Function} onToggle - Callback when toggle is clicked
 */
function bindRestToggle(container, onToggle) {
  const restBtn = container.querySelector('#rest-toggle');
  if (!restBtn) return;

  restBtn.addEventListener('click', async () => {
    const selectedDate = getState().fitnessSelectedDate || new Date().toISOString();
    const iso = getLocalISODate(selectedDate);

    // Check if there are activities recorded for this date
    const activitiesForDate = getActivitiesForDate(iso);

    if (activitiesForDate.length > 0) {
      // Show warning dialog similar to holiday period warning
      showConfirm({
        title: 'Activities Already Recorded',
        message: 'You need to delete all activities for this day before it can be a rest day.',
        okText: 'OK',
        cancelText: '',
        onOK: () => {},
      });
      return;
    }

    // Proceed with rest day toggle if no activities are recorded
    const saved = await toggleRestDay(iso);
    if (!saved) return;
    updateRestToggle(container);

    // Refresh the calendar to show/hide rest day styling
    const calEl = document.querySelector(
      '#fitness-view hh-calendar[state-key="fitnessSelectedDate"]'
    );
    calEl?.refresh?.();

    // Refresh the activity list to show rest day message or activities
    renderActivitiesList();

    if (onToggle) {
      onToggle(isRestDay(iso));
    }
  });
}

/**
 * Updates the rest toggle visual state
 * @param {HTMLElement} container - The rest toggle container (optional, will find in DOM if not provided)
 */
export function updateRestToggle(container) {
  let restBtn;

  if (container) {
    restBtn = container.querySelector('#rest-toggle');
  } else {
    // Find the rest toggle in the DOM if container not provided
    restBtn = document.getElementById('rest-toggle');
  }

  if (!restBtn) return;

  const selectedDate = getState().fitnessSelectedDate || new Date().toISOString();
  const iso = getLocalISODate(selectedDate);
  const isOn = isRestDay(iso);

  restBtn.classList.toggle('bg-ios-orange', isOn);
  restBtn.classList.toggle('bg-gray-200', !isOn);
  restBtn.classList.toggle('text-white', isOn);
  restBtn.classList.toggle('text-gray-500', !isOn);
  restBtn.setAttribute('aria-pressed', isOn.toString());

  const bedEl = restBtn.querySelector('.bed');
  const labelEl = restBtn.querySelector('.label');

  if (bedEl) {
    if (isOn) {
      bedEl.style.left = '8px';
      bedEl.style.transform = 'translateY(-50%)';
    } else {
      bedEl.style.left = '50%';
      bedEl.style.transform = 'translate(-50%, -50%)';
    }
  }

  if (labelEl) {
    if (isOn) {
      labelEl.classList.add('opacity-100');
      restBtn.classList.add('pl-9', 'pr-4');
      restBtn.classList.remove('justify-center');
      restBtn.style.width = '110px';
    } else {
      labelEl.classList.remove('opacity-100');
      restBtn.classList.remove('pl-9', 'pr-4');
      restBtn.classList.add('justify-center');
      restBtn.style.width = '36px';
    }
  }
}
