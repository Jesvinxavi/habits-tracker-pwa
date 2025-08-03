import { getState, dispatch, Actions } from '../../core/state.js';
import { updateProgressRing } from '../home/components/ProgressRing.js';
import { getFrequencyText, getFrequencyIcon } from './habits.js';
import { hexToRgba } from '../../shared/color.js';
import {
  isHabitCompleted,
  isHabitScheduledOnDate,
  belongsToSelectedGroup,
  isHabitSkippedToday,
} from '../home/schedule.js';
import { formatLastPerformed } from '../../shared/datetime.js';
import { handleHabitStatsClick } from './modals/HabitStatsModal.js';









// ---------- Home View ----------



// ---------- Home View ----------

export function renderHomeView() {
  // Update collapsed state of completed/skipped sections according to settings
  const completedSection = document.getElementById('completed-section');
  const skippedSection = document.getElementById('skipped-section');
  if (completedSection)
    completedSection.classList.toggle('collapsed', getState().settings.hideCompleted);
  if (skippedSection) skippedSection.classList.toggle('collapsed', getState().settings.hideSkipped);

  // Re-calculate progress ring using the same logic as home view
  // This ensures consistency with the selected group filtering
  const dateObj = new Date(getState().selectedDate);

  // 1) Habits that belong to the currently selected group
  // 2) Are actually scheduled for the selected date (takes holiday mode into account)
  const scheduledHabits = getState().habits.filter(
    (h) => belongsToSelectedGroup(h, getState().selectedGroup) && isHabitScheduledOnDate(h, dateObj)
  );

  // 3) Remove any that the user explicitly skipped
  const activeHabits = scheduledHabits.filter((h) => !isHabitSkippedToday(h, dateObj));

  // 4) Determine how many of the remaining active habits are completed
  const completed = activeHabits.filter((h) => isHabitCompleted(h, dateObj));

  const progress = activeHabits.length ? (completed.length / activeHabits.length) * 100 : 0;
  updateProgressRing(progress);
}

export function toggleHabitCompletion(habitId) {
  const state = getState();
  const dateKey = state.selectedDate.slice(0, 10);
  dispatch(Actions.toggleHabitCompleted(habitId, dateKey));
}

export function toggleSectionVisibility(sectionType) {
  const section = document.getElementById(`${sectionType}-section`);
  if (!section) return;
  const collapsed = !section.classList.toggle('collapsed'); // toggle returns new state
  if (sectionType === 'completed') dispatch(Actions.toggleCompleted(collapsed));
  else if (sectionType === 'skipped') dispatch(Actions.toggleSkipped(collapsed));
  // update toggle text if button exists
  const toggleBtn = section.querySelector('.toggle-section');
  if (toggleBtn) toggleBtn.textContent = collapsed ? 'Show ⌄' : 'Hide ⌄';
}

// ---------- Habits View ----------

function createHabitItem(habit, category, isLast) {
  const borderClass = isLast ? 'rounded-b-2xl' : '';

  // ----- Build meta chips -----
  function buildChip(inner) {
    return `<span class="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-black" style="background-color:${category.color}20; color:#000">${inner}</span>`;
  }

  const chips = [];

  if (habit.paused) {
    chips.push(buildChip('Paused'));
  } else {
    // Frequency chip (without extra parts after •)
    const frequencyText = getFrequencyText(habit).split(' • ')[0];
    chips.push(buildChip(`${getFrequencyIcon(habit)} ${frequencyText}`));

    // Scheduled time chip with clock icon
    if (habit.scheduledTime) {
      const clockIcon =
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      chips.push(buildChip(`${clockIcon} ${habit.scheduledTime}`));
    }

    // Holiday chip
    if (habit.activeOnHolidays) {
      chips.push(buildChip('<span class="material-icons text-base leading-none">flight</span>'));
    }
  }

  const metaHTML = `<div class="habit-meta flex flex-wrap gap-1 text-gray-600 dark:text-gray-400 text-xs -mt-1">${chips.join('')}</div>`;

  return `
    <div class="flex flex-row items-stretch habit-row w-full mb-0.5">
      <div class="habit-drag-handle drag-handle hidden w-7 h-12 flex items-center justify-center cursor-grab text-gray-400 mr-1">
        <span class="material-icons text-2xl leading-none">drag_handle</span>
      </div>
      <div class="habit-item flex items-center px-4 py-1.5 bg-white dark:bg-gray-800 border-[2.5px] rounded-xl ${borderClass} flex-grow w-full" style="border-color: ${category.color}" data-habit-id="${habit.id}">
        <div class="habit-icon w-8 h-8 rounded-lg flex items-center justify-center mr-4 text-xl" style="background-color: ${category.color}20;">
          ${habit.icon || '📋'}
        </div>
        <div class="habit-content flex-grow">
          <div class="habit-name text-sm font-semibold text-gray-900 dark:text-white">${habit.name}</div>
          ${metaHTML}
        </div>
        <div class="habit-actions flex items-center gap-2 ml-2">
          <button class="stats-habit-btn w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors" data-habit-id="${habit.id}" title="View Stats">
            <span class="material-icons text-lg">bar_chart</span>
          </button>
          <button class="edit-habit-btn flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center" data-habit-id="${habit.id}">
            <svg class="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

function createCategorySection(category, habits) {
  // color classes not needed anymore because we inline background and force black text

  let habitsHTML = '';
  if (habits.length) {
    habitsHTML = habits
      .map((h, idx) => createHabitItem(h, category, idx === habits.length - 1))
      .join('');
  } else {
    habitsHTML =
      '<div class="p-6 text-center text-gray-400 dark:text-gray-500">No habits yet</div>';
  }

  const arrowBtn = `<button class="expand-btn h-5 w-5 flex items-center justify-center text-black">
      <span class="material-icons transition-transform leading-none">expand_more</span>
    </button>`;

  const editBtn = `<button class="edit-category-btn w-8 h-8 rounded-full flex items-center justify-center" data-category-id="${category.id}" style="background-color:${category.color}">
      <span class="material-icons text-white text-lg">edit</span>
    </button>`;

  return `<div class="category-section mb-4" data-category-id="${category.id}">
      <div class="flex items-center gap-2">
        <div class="category-drag-handle drag-handle hidden w-7 h-12 flex items-center justify-center cursor-grab text-gray-400">
          <span class="material-icons text-2xl leading-none">drag_handle</span>
        </div>
        <div class="category-header flex items-center justify-between px-4 py-2 rounded-xl cursor-pointer select-none flex-grow" style="background:${hexToRgba(category.color, 0.25)};">
          <div class="category-title flex items-center gap-2">
            <div class="w-4 h-4 rounded-md flex-shrink-0" style="background-color:${category.color}"></div>
            <span class="font-semibold text-base leading-none text-black">${category.name}</span>
          </div>
          ${arrowBtn}
        </div>
        ${editBtn}
      </div>
      <div class="category-habits pl-2 mt-0.5">${habitsHTML}</div>
    </div>`;
}

/**
 * Mounts the habits list container
 * @param {Function} onHabitClick - Callback when habit is clicked
 * @returns {HTMLElement} The habits list container element
 */
export function mountHabitsList(onHabitClick) {
  const listContainer = document.createElement('div');
  listContainer.id = 'habits-list-container';
  listContainer.className = 'habits-list flex-grow overflow-y-auto px-4 pb-8';

  // Store callback for later use
  listContainer._onHabitClick = onHabitClick;

  return listContainer;
}

/**
 * Renders the habits list content
 * @param {Function} onHabitClick - Callback when habit is clicked
 */
export function renderHabitsList(onHabitClick) {
  const listContainer = document.getElementById('habits-list-container');
  if (!listContainer) return;

  // Store callback for later use
  listContainer._onHabitClick = onHabitClick;

  // Clear existing content
  listContainer.innerHTML = '';

  // Build categories map
  const map = new Map();
  getState().categories.forEach((cat) => map.set(cat.id, []));
  getState().habits.forEach((h) => {
    if (map.has(h.categoryId)) map.get(h.categoryId).push(h);
  });

  getState().categories.forEach((cat) => {
    const sectionHTML = createCategorySection(cat, map.get(cat.id));
    listContainer.insertAdjacentHTML('beforeend', sectionHTML);
  });

  // If no categories exist, show CTA placeholder
  if (getState().categories.length === 0) {
    const placeholder = `
      <div class="w-full flex flex-col items-center justify-center py-12 mt-6 text-center space-y-2" id="no-category-cta">
        <span class="material-icons text-5xl text-gray-400">create_new_folder</span>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">No categories yet</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 max-w-xs mx-auto">Start by creating a category to organise your habits.</p>
        <button class="create-first-category-btn bg-ios-orange text-white px-4 py-3 rounded-xl font-medium hover:bg-orange-600 transition-colors">Create Your First Category</button>
      </div>`;
    listContainer.insertAdjacentHTML('beforeend', placeholder);

    listContainer.querySelector('.create-first-category-btn')?.addEventListener('click', () => {
      import('./ui/categories.js').then((m) => {
        m.initializeCategories();
        m.openAddCategoryModal();
      });
    });
  }

  // Attach completion toggle listeners
  listContainer.querySelectorAll('.habit-item').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.habitId;
      if (id) toggleHabitCompletion(id);
    });
  });

  // Edit habit buttons
  listContainer.querySelectorAll('.edit-habit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.habitId;
      if (id) import('./modals/HabitFormModal.js').then((m) => m.openEditHabitModal(id));
    });
  });

  // Stats habit buttons
  listContainer.querySelectorAll('.stats-habit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.habitId;
      if (id) handleHabitStatsClick(id);
    });
  });

  // Expand/collapse handlers (arrow button or header click)
  function toggleCategory(section) {
    if (!section) return;
    const habitsDiv = section.querySelector('.category-habits');
    if (!habitsDiv) return;
    const collapsed = habitsDiv.classList.toggle('hidden');
    const iconEl = section.querySelector('.expand-btn .material-icons');
    if (iconEl) iconEl.classList.toggle('rotate-180', collapsed);
  }

  listContainer.querySelectorAll('.expand-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCategory(btn.closest('.category-section'));
    });
  });

  listContainer.querySelectorAll('.category-header').forEach((hdr) => {
    hdr.addEventListener('click', (e) => {
      if (e.target.closest('.expand-btn') || e.target.closest('.edit-category-btn')) return; // ignore edit/arrow clicks
      toggleCategory(hdr.closest('.category-section'));
    });
  });

  // Initialize category event handlers (for edit category buttons)
  import('./ui/categories.js').then((m) => m.initializeCategories());
}

export function initializeHabitsList() {
  renderHomeView();
  renderHabitsList();

  // Attach toggle buttons (home view)
  document.querySelectorAll('.toggle-section').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.habits-section');
      if (section && section.id) {
        const type = section.id.replace('-section', '');
        toggleSectionVisibility(type);
      }
    });
  });
}
