/**
 * Categories Management - Migrated to use Enhanced State Management
 *
 * This file demonstrates the migration from direct state mutations
 * to the new action-based state management system.
 *
 * Key Changes:
 * - Replace mutate() calls with dispatch(Actions.*)
 * - Use Selectors instead of direct appData access
 * - Leverage StateHelpers for common operations
 * - Better error handling and validation
 */

import { dispatch, Actions, Selectors } from '../core/state.js';
import { StateHelpers, UISelectors } from '../utils/state-helpers.js';
import { generateUniqueId } from '../utils/common.js';
import { openModal, closeModal } from '../components/Modal.js';
import { showConfirm } from '../components/ConfirmDialog.js';

// Color palette for categories
const COLOR_PALETTE = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#22C55E',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#0EA5E9',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#D946EF',
  '#EC4899',
  '#F43F5E',
  '#6B7280',
];

// -------------------- UI Rendering --------------------

function buildColorGrids() {
  // Build color grid for add modal
  const addGrid = document.getElementById('category-color-grid');
  if (addGrid) {
    addGrid.innerHTML = '';
    COLOR_PALETTE.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'color-option w-8 h-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform';
      btn.style.backgroundColor = color;
      btn.dataset.color = color;
      addGrid.appendChild(btn);
    });
  }

  // Build color grid for edit modal
  const editGrid = document.getElementById('edit-category-color-grid');
  if (editGrid) {
    editGrid.innerHTML = '';
    COLOR_PALETTE.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'edit-color-option w-8 h-8 rounded-full border-2 border-gray-300 hover:scale-110 transition-transform';
      btn.style.backgroundColor = color;
      btn.dataset.color = color;
      editGrid.appendChild(btn);
    });
  }
}

function resetCategoryForm() {
  const nameInput = document.getElementById('category-name-input');
  if (nameInput) nameInput.value = '';

  // Remove selection from color options
  document.querySelectorAll('.color-option').forEach((btn) => {
    btn.classList.remove('ring-2', 'ring-black', 'ring-offset-2');
  });

  updateAddSaveState();
}

export function populateCategoryDropdown() {
  const select = document.getElementById('habit-category-select');
  const msg = document.getElementById('no-categories-message');
  if (!select) return;

  select.innerHTML = '<option value="" disabled selected>Select Category</option>';

  // Use selector instead of direct appData access
  const categories = Selectors.getCategories();

  categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });

  const hasCats = categories.length > 0;
  select.classList.toggle('hidden', !hasCats);

  // Hide dropdown chevron SVG (assumed next sibling) when select is hidden
  const chevron = select.nextElementSibling;
  if (chevron && chevron.tagName.toLowerCase() === 'svg') {
    chevron.classList.toggle('hidden', !hasCats);
  }
  if (msg) msg.classList.toggle('hidden', hasCats);
}

// -------------------- Modal Management --------------------

export function openAddCategoryModal() {
  buildColorGrids();
  resetCategoryForm();
  openModal('add-category-modal');
}

export function closeAddCategoryModal() {
  closeModal('add-category-modal');
}

function openEditCategoryModal(catId) {
  buildColorGrids();

  // Use selector to get category
  const category = Selectors.getCategoryById(undefined, catId);
  if (!category) return;

  const nameInput = document.getElementById('edit-category-name-input');
  if (nameInput) nameInput.value = category.name;

  document.getElementById('edit-category-modal').dataset.categoryId = catId;

  // Highlight selected color
  document.querySelectorAll('.edit-color-option').forEach((btn) => {
    btn.classList.toggle('ring-2', btn.dataset.color === category.color);
  });

  openModal('edit-category-modal');
}

function closeEditCategoryModal() {
  closeModal('edit-category-modal');
}

// -------------------- CRUD Operations (Migrated) --------------------

function addNewCategory() {
  const nameInput = document.getElementById('category-name-input');
  const selectedBtn = document.querySelector('.color-option.ring-2');

  if (!nameInput || !selectedBtn) return;

  const name = nameInput.value.trim();
  if (!name) return;

  const newCategory = {
    id: generateUniqueId(),
    name,
    color: selectedBtn.dataset.color,
  };

  // MIGRATION: Replace mutate() with StateHelpers.addCategory()
  StateHelpers.addCategory(newCategory);

  // Remember this category for preselection
  window._preselectCategoryId = newCategory.id;

  closeAddCategoryModal();
  populateCategoryDropdown();

  // Refresh habits view
  import('./habits/list.js').then((m) => m.renderHabitsView());

  if (window._returnToHabit) {
    window._returnToHabit = false;
    import('./habits/form.js').then((m) => m.openAddHabitModal());
  }
}

function updateCategory() {
  const modal = document.getElementById('edit-category-modal');
  const catId = modal?.dataset.categoryId;
  if (!catId) return;

  const nameInput = document.getElementById('edit-category-name-input');
  const selectedBtn = document.querySelector('.edit-color-option.ring-2');

  if (!nameInput || !selectedBtn) return;

  const name = nameInput.value.trim();
  if (!name) return;

  const updates = {
    name,
    color: selectedBtn.dataset.color,
  };

  // MIGRATION: Replace mutate() with StateHelpers.updateCategory()
  StateHelpers.updateCategory(catId, updates);

  closeEditCategoryModal();
  populateCategoryDropdown();

  // Refresh habits view
  import('./habits/list.js').then((m) => m.renderHabitsView());
}

function deleteCategory() {
  const modal = document.getElementById('edit-category-modal');
  const catId = modal?.dataset.categoryId;
  if (!catId) return;

  // Get category info for confirmation
  const category = Selectors.getCategoryById(undefined, catId);
  const habitsInCategory = Selectors.getHabitsByCategory(undefined, catId);

  const message =
    habitsInCategory.length > 0
      ? `Deleting "${category?.name}" will also remove ${habitsInCategory.length} habit(s) it contains. This action cannot be undone.`
      : `Are you sure you want to delete "${category?.name}"?`;

  showConfirm({
    title: 'Delete Category?',
    message,
    okText: 'Delete',
    onOK: () => {
      // MIGRATION: Use multiple actions instead of single mutate

      // First, delete all habits in this category
      const habitsToDelete = Selectors.getHabitsByCategory(undefined, catId);
      habitsToDelete.forEach((habit) => {
        StateHelpers.deleteHabit(habit.id);
      });

      // Then delete the category
      StateHelpers.deleteCategory(catId);

      closeEditCategoryModal();
      populateCategoryDropdown();

      // Refresh habits view
      import('./habits/list.js').then((m) => m.renderHabitsView());
    },
  });
}

// -------------------- Advanced Operations --------------------

// Batch operation example - move all habits from one category to another
function moveCategoryHabits(fromCategoryId, toCategoryId) {
  const habitsToMove = Selectors.getHabitsByCategory(undefined, fromCategoryId);

  // Use batch update pattern
  dispatch((dispatch) => {
    habitsToMove.forEach((habit) => {
      dispatch(Actions.updateHabit(habit.id, { category: toCategoryId }));
    });
  });
}

// Get category statistics
function getCategoryStats(categoryId) {
  const habits = Selectors.getHabitsByCategory(undefined, categoryId);
  const activeHabits = habits.filter((h) => !h.paused);

  return {
    totalHabits: habits.length,
    activeHabits: activeHabits.length,
    pausedHabits: habits.length - activeHabits.length,
  };
}

// -------------------- Event Handlers --------------------

export function initializeCategories() {
  buildColorGrids();

  // Open buttons
  const newBtn = document.querySelector('.new-category-btn');
  if (newBtn) newBtn.addEventListener('click', openAddCategoryModal);

  // Live validation for add modal
  const nameInputAdd = document.getElementById('category-name-input');
  if (nameInputAdd) nameInputAdd.addEventListener('input', updateAddSaveState);

  const cancelAdd = document.getElementById('cancel-category');
  const saveAdd = document.getElementById('save-category');
  if (cancelAdd) cancelAdd.addEventListener('click', closeAddCategoryModal);
  if (saveAdd) saveAdd.addEventListener('click', addNewCategory);

  // Live validation for edit modal
  const nameInputEdit = document.getElementById('edit-category-name-input');
  if (nameInputEdit) nameInputEdit.addEventListener('input', updateEditSaveState);

  // Edit modal buttons
  const cancelEdit = document.getElementById('cancel-edit-category');
  const saveEdit = document.getElementById('save-edit-category');
  const deleteBtn = document.getElementById('delete-category-btn');
  if (cancelEdit) cancelEdit.addEventListener('click', closeEditCategoryModal);
  if (saveEdit) saveEdit.addEventListener('click', updateCategory);
  if (deleteBtn) deleteBtn.addEventListener('click', deleteCategory);

  // Color selection
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-option')) {
      document
        .querySelectorAll('.color-option')
        .forEach((btn) => btn.classList.remove('ring-2', 'ring-black', 'ring-offset-2'));
      e.target.classList.add('ring-2', 'ring-black', 'ring-offset-2');
      updateAddSaveState();
    } else if (e.target.classList.contains('edit-color-option')) {
      document
        .querySelectorAll('.edit-color-option')
        .forEach((btn) => btn.classList.remove('ring-2', 'ring-black', 'ring-offset-2'));
      e.target.classList.add('ring-2', 'ring-black', 'ring-offset-2');
      updateEditSaveState();
    }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-category-btn');
    if (btn) {
      const catId = btn.dataset.categoryId;
      if (catId) openEditCategoryModal(catId);
    }
  });

  populateCategoryDropdown();
}

// -------------------- Validation --------------------

function updateAddSaveState() {
  const saveAdd = document.getElementById('save-category');
  const nameInput = document.getElementById('category-name-input');
  const hasName = nameInput && nameInput.value.trim().length > 0;
  const hasColor = !!document.querySelector('.color-option.ring-2');
  const enable = hasName && hasColor;

  if (saveAdd) {
    saveAdd.disabled = !enable;
    saveAdd.classList.toggle('opacity-50', !enable);
  }
}

function updateEditSaveState() {
  const saveEdit = document.getElementById('save-edit-category');
  const nameInput = document.getElementById('edit-category-name-input');
  const hasName = nameInput && nameInput.value.trim().length > 0;
  const hasColor = !!document.querySelector('.edit-color-option.ring-2');
  const enable = hasName && hasColor;

  if (saveEdit) {
    saveEdit.disabled = !enable;
    saveEdit.classList.toggle('opacity-50', !enable);
  }
}

// -------------------- Export Additional Utilities --------------------

export { moveCategoryHabits, getCategoryStats, buildColorGrids, resetCategoryForm };

// Development utilities
if (typeof window !== 'undefined' && process.env?.NODE_ENV === 'development') {
  window.CategoriesUtils = {
    moveCategoryHabits,
    getCategoryStats,
    getCategories: () => Selectors.getCategories(),
    getCategoriesWithStats: () => UISelectors.getCategoriesWithCounts(),
  };
}
