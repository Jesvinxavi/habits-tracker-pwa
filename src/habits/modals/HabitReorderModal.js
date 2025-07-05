// Reorder / drag-n-drop functionality for Habits & Categories
// ----------------------------------------------------------
// This module relies on SortableJS (loaded on-demand via CDN).
// The high-level flow:
// 1. User taps a .reorder-btn in the Habits view.
// 2. We ensure SortableJS is loaded, then create sortable instances
//    for every category section and its child habits list.
// 3. While in "reorder mode" we add CSS class .dragging to give visual cues.
// 4. Tapping the button again (now labelled "Done") destroys sortables
//    and persists the new order via state.mutate.
//
// NOTE: Persistence to appData is TODO – we only emit console logs so far.

import { mutate } from '../../core/state.js';

let SortableLib = null;
let sortables = [];
let reorderActive = false;

export async function ensureSortableLoaded() {
  if (SortableLib) return SortableLib;
  // Dynamically import the ESM build from jsDelivr (works without CORS/TS hassles)
  try {
    SortableLib = (await import('https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/+esm')).default;
    return SortableLib;
  } catch (err) {
    console.error('[reorder] failed to load SortableJS', err);
    return null;
  }
}

export async function initSortables() {
  const Sortable = await ensureSortableLoaded();
  if (!Sortable) return;

  destroySortables();
  sortables = [];

  // Make categories draggable (only one Sortable on the main list wrapper)
  const container = document.querySelector('#habits-view #habits-list-container');
  if (container) {
    const sortableCats = new Sortable(container, {
      animation: 150,
      handle: '.category-drag-handle',
      draggable: '.category-section',
      ghostClass: 'sortable-ghost',
    });
    sortables.push(sortableCats);
  }

  // Make habits within each category draggable (using row & handle)
  document.querySelectorAll('#habits-view .category-habits').forEach((listEl) => {
    const sortable = new Sortable(listEl, {
      animation: 150,
      handle: '.habit-drag-handle',
      draggable: '.habit-row',
      ghostClass: 'sortable-ghost',
    });
    sortables.push(sortable);
  });
}

export function destroySortables() {
  sortables.forEach((s) => s.destroy());
  sortables = [];
}

export function toggleReorderMode() {
  reorderActive = !reorderActive;
  const btns = document.querySelectorAll('.reorder-btn');
  setReorderBtnLabel(reorderActive);

  if (reorderActive) {
    initSortables();
    document.body.classList.add('reorder-mode');
    btns.forEach((b) => b.classList.add('bg-purple-200'));

    // show drag handles & hide edit / stats buttons
    document.querySelectorAll('.drag-handle').forEach((el) => el.classList.remove('hidden'));
    document
      .querySelectorAll('.edit-category-btn, .habit-actions, .edit-habit-btn')
      .forEach((el) => el.classList.add('hidden'));

    // Disable add buttons and search bar (grey out)
    const addBtns = document.querySelectorAll('.new-category-btn, .new-habit-btn');
    addBtns.forEach((btn) => {
      btn.disabled = true;
      btn.classList.add('pointer-events-none', 'opacity-60', 'brightness-95');
    });
    const searchInput = document.querySelector('.search-container input');
    if (searchInput) {
      searchInput.disabled = true;
      searchInput.classList.add('pointer-events-none', 'opacity-60', 'brightness-95');
    }

    // Disable bottom tab navigation
    document.querySelectorAll('.tab-item').forEach((tab) => {
      tab.classList.add('pointer-events-none', 'opacity-50');
    });

    // Collapse all categories for clearer list while reordering
    document.querySelectorAll('.category-section').forEach((section) => {
      const habitsDiv = section.querySelector('.category-habits');
      const arrowSvg = section.querySelector('.expand-btn svg');
      if (habitsDiv) habitsDiv.classList.add('hidden');
      if (arrowSvg) arrowSvg.classList.add('rotate-180');
    });
  } else {
    destroySortables();
    document.body.classList.remove('reorder-mode');
    btns.forEach((b) => b.classList.remove('bg-purple-200'));

    // hide handles again & restore buttons
    document.querySelectorAll('.drag-handle').forEach((el) => el.classList.add('hidden'));
    document
      .querySelectorAll('.edit-category-btn, .habit-actions, .edit-habit-btn')
      .forEach((el) => el.classList.remove('hidden'));

    // Re-enable add buttons and search bar
    const addBtns = document.querySelectorAll('.new-category-btn, .new-habit-btn');
    addBtns.forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove('pointer-events-none', 'opacity-60', 'brightness-95');
    });
    const searchInput = document.querySelector('.search-container input');
    if (searchInput) {
      searchInput.disabled = false;
      searchInput.classList.remove('pointer-events-none', 'opacity-60', 'brightness-95');
    }

    // Re-enable tab navigation
    document.querySelectorAll('.tab-item').forEach((tab) => {
      tab.classList.remove('pointer-events-none', 'opacity-50');
    });

    persistOrderToState();
  }
}

export function setReorderBtnLabel(isDone) {
  const iconHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
  const label = isDone ? 'Done' : 'Reorder';
  document.querySelectorAll('.reorder-btn').forEach((btn) => {
    btn.innerHTML = `${iconHTML}<span class="ml-1.5">${label}</span>`;
    btn.classList.add('font-semibold');
    if (!btn.style.minWidth) btn.style.minWidth = '90px';
  });
}

// Wire the buttons when this module is imported.
// (initializeReorder in main.js just calls this function.)
export function initializeReorder() {
  // Ensure initial styling for reorder buttons (bold & fixed width)
  document.querySelectorAll('.reorder-btn').forEach((btn) => {
    btn.classList.add('font-semibold');
    if (!btn.style.minWidth) btn.style.minWidth = '90px';
  });
}

function persistOrderToState() {
  const newCategoriesOrder = [];
  const newHabitsOrder = [];

  document.querySelectorAll('#habits-view .category-section').forEach((section) => {
    const catId = section.dataset.categoryId;
    if (catId) newCategoriesOrder.push(catId);

    // capture habits inside
    section.querySelectorAll('.habit-item').forEach((item) => {
      const hid = item.dataset.habitId;
      if (hid) newHabitsOrder.push(hid);
    });
  });

  if (!newCategoriesOrder.length && !newHabitsOrder.length) return;

  mutate((state) => {
    // reorder categories
    state.categories.sort(
      (a, b) => newCategoriesOrder.indexOf(a.id) - newCategoriesOrder.indexOf(b.id)
    );
    // reorder habits
    state.habits.sort((a, b) => newHabitsOrder.indexOf(a.id) - newHabitsOrder.indexOf(b.id));
  });

  import('../HabitsListModule.js').then((m) => m.renderHabitsList());
}
