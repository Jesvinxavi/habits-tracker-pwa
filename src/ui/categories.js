import { appData, mutate } from '../core/state.js';
import { openModal, closeModal } from '../components/Modal.js';
import { generateUniqueId } from '../utils/uid.js';
import { showConfirm } from '../components/ConfirmDialog.js';
import { CATEGORY_COLOR_PALETTE } from '../utils/constants.js';

// -------------------- Colour grid injection --------------------

let _colorGridBuilt = false;

function buildColorGrids() {
  if (_colorGridBuilt) return;
  const addGrid = document.querySelector('.color-grid');
  const editGrid = document.querySelector('.edit-color-grid');
  if (!addGrid && !editGrid) return;

  CATEGORY_COLOR_PALETTE.forEach(({ hex, gradient, shadow }) => {
    const addBtn = document.createElement('button');
    addBtn.className = `color-option w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} shadow-lg hover:scale-110 transition-all duration-200 ${shadow}`;
    addBtn.dataset.color = hex;
    if (addGrid) addGrid.appendChild(addBtn);

    const editBtn = document.createElement('button');
    editBtn.className = `edit-color-option w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} shadow-lg hover:scale-110 transition-all duration-200 ${shadow}`;
    editBtn.dataset.color = hex;
    if (editGrid) editGrid.appendChild(editBtn);
  });

  _colorGridBuilt = true;
}

// -------------------- Helpers --------------------

function resetCategoryForm() {
  const nameInput = document.getElementById('category-name-input');
  const colorBtns = document.querySelectorAll('.color-option');
  if (nameInput) nameInput.value = '';
  colorBtns.forEach((btn) => btn.classList.remove('ring-2', 'ring-black', 'ring-offset-2'));
  // no colour pre-selected; user must pick
}

export function populateCategoryDropdown() {
  const select = document.getElementById('habit-category-select');
  const msg = document.getElementById('no-categories-message');
  if (!select) return;

  select.innerHTML = '<option value="" disabled selected>Select Category</option>';

  appData.categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });

  const hasCats = appData.categories.length > 0;
  select.classList.toggle('hidden', !hasCats);
  // Hide dropdown chevron SVG (assumed next sibling) when select is hidden
  const chevron = select.nextElementSibling;
  if (chevron && chevron.tagName.toLowerCase() === 'svg') {
    chevron.classList.toggle('hidden', !hasCats);
  }
  if (msg) msg.classList.toggle('hidden', hasCats);
}

// -------------------- Modal open/close --------------------

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
  const category = appData.categories.find((c) => c.id === catId);
  if (!category) return;
  const nameInput = document.getElementById('edit-category-name-input');
  if (nameInput) nameInput.value = category.name;
  document.getElementById('edit-category-modal').dataset.categoryId = catId;
  // highlight selected colour
  document.querySelectorAll('.edit-color-option').forEach((btn) => {
    btn.classList.toggle('ring-2', btn.dataset.color === category.color);
  });
  openModal('edit-category-modal');
}

function closeEditCategoryModal() {
  closeModal('edit-category-modal');
}

// -------------------- CRUD --------------------

function addNewCategory() {
  const nameInput = document.getElementById('category-name-input');
  const selectedBtn = document.querySelector('.color-option.ring-2');
  if (!nameInput || !selectedBtn) return;
  const newCat = {
    id: generateUniqueId(),
    name: nameInput.value.trim(),
    color: selectedBtn.dataset.color,
  };
  mutate((s) => s.categories.push(newCat));
  // Remember this category for preselection
  window._preselectCategoryId = newCat.id;
  closeAddCategoryModal();
  populateCategoryDropdown();
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
  mutate((s) => {
    const cat = s.categories.find((c) => c.id === catId);
    if (!cat) return;
    cat.name = nameInput.value.trim();
    cat.color = selectedBtn.dataset.color;
  });
  closeEditCategoryModal();
  populateCategoryDropdown();
  import('./habits/list.js').then((m) => m.renderHabitsView());
}

function deleteCategory() {
  const modal = document.getElementById('edit-category-modal');
  const catId = modal?.dataset.categoryId;
  if (!catId) return;

  showConfirm({
    title: 'Delete Category?',
    message:
      'Deleting this category will also remove all habits it contains. This action cannot be undone.',
    okText: 'Delete',
    onOK: () => {
      mutate((s) => {
        s.categories = s.categories.filter((c) => c.id !== catId);
        s.habits = s.habits.filter((h) => h.categoryId !== catId);
      });
      closeEditCategoryModal();
      populateCategoryDropdown();
      import('./habits/list.js').then((m) => m.renderHabitsView());
    },
  });
}

// -------------------- Event wiring --------------------

export function initializeCategories() {
  buildColorGrids();
  // open buttons
  const newBtn = document.querySelector('.new-category-btn');
  if (newBtn) newBtn.addEventListener('click', openAddCategoryModal);

  // live validation for add modal
  const nameInputAdd = document.getElementById('category-name-input');
  if (nameInputAdd) nameInputAdd.addEventListener('input', updateAddSaveState);

  const cancelAdd = document.getElementById('cancel-category');
  const saveAdd = document.getElementById('save-category');
  if (cancelAdd) cancelAdd.addEventListener('click', closeAddCategoryModal);
  if (saveAdd) saveAdd.addEventListener('click', addNewCategory);

  // live validation for edit modal
  const nameInputEdit = document.getElementById('edit-category-name-input');
  if (nameInputEdit) nameInputEdit.addEventListener('input', updateEditSaveState);

  // edit modal buttons
  const cancelEdit = document.getElementById('cancel-edit-category');
  const saveEdit = document.getElementById('save-edit-category');
  const deleteBtn = document.getElementById('delete-category-btn');
  if (cancelEdit) cancelEdit.addEventListener('click', closeEditCategoryModal);
  if (saveEdit) saveEdit.addEventListener('click', updateCategory);
  if (deleteBtn) deleteBtn.addEventListener('click', deleteCategory);

  // colour selection
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

function updateAddSaveState() {
  const saveAdd = document.getElementById('save-category');
  const nameInput = document.getElementById('category-name-input');
  const hasName = nameInput && nameInput.value.trim().length > 0;
  const hasColour = !!document.querySelector('.color-option.ring-2');
  const enable = hasName && hasColour;
  if (saveAdd) {
    saveAdd.disabled = !enable;
    saveAdd.classList.toggle('opacity-50', !enable);
  }
}

function updateEditSaveState() {
  const saveEdit = document.getElementById('save-edit-category');
  const nameInput = document.getElementById('edit-category-name-input');
  const hasName = nameInput && nameInput.value.trim().length > 0;
  const hasColour = !!document.querySelector('.edit-color-option.ring-2');
  const enable = hasName && hasColour;
  if (saveEdit) {
    saveEdit.disabled = !enable;
    saveEdit.classList.toggle('opacity-50', !enable);
  }
}
