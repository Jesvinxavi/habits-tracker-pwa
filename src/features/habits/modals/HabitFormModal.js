import { openModal, closeModal } from '../../../components/Modal.js';
import { initializeTimePicker } from '../utils/HabitFormPickers.js';
import { dispatch, Actions } from '../../../core/state.js';
import { generateUniqueId } from '../../../shared/common.js';
import { renderHabitsList } from '../HabitsListModule.js';
import { getState } from '../../../core/state.js';
import { initIconPicker, getSelectedIcon, setSelectedIcon } from './HabitIconPicker.js';
import {
  initFrequencySection,
  selectedWeeklyDays,
  selectedBiweeklyDays,
  selectedMonthlyDates,
  selectedCombinations,
  selectedMonths,
  selectedYearlyDates,
  monthlyMode,
  setMonthlyMode,
  handleFrequencyChange,
  updateCombinationsList,
  buildMonthlyDateGrid,
  buildMonthGrid,
} from '../utils/HabitFrequencySection.js';
import { initTargetSection, updateTargetExample } from '../utils/HabitTargetSection.js';
import { showConfirm } from '../../../components/ConfirmDialog.js';

let editingHabitId = null;

// ---------- Icon Picker ----------

export function openAddHabitModal() {
  // Check if categories exist before opening modal
  if (getState().categories.length === 0) {
    // If no categories, show a confirmation dialog to create one first
    import('../../../components/ConfirmDialog.js').then(({ showConfirm }) => {
      showConfirm({
        title: 'No Categories',
        message: 'You need to create at least one category before adding habits. Would you like to create a category now?',
        okText: 'Create Category',
        cancelText: 'Cancel',
        onOK: () => {
          import('../ui/categories.js').then((m) => {
            m.initializeCategories();
            m.openAddCategoryModal();
          });
        },
      });
    });
    return;
  }

  editingHabitId = null;
  resetHabitFormUI();
  // hide delete button
  const btn = document.getElementById('delete-habit-btn');
  if (btn) btn.classList.add('hidden');
  openModal('add-habit-modal');
}

export function closeAddHabitModal() {
  closeModal('add-habit-modal');
  editingHabitId = null;
}

export function openEditHabitModal(habitId) {
  const habit = getState().habits.find((h) => h.id === habitId);
  if (!habit) return;
  editingHabitId = habitId;
  resetHabitFormUI();
  // show delete button
  const delBtn = ensureDeleteBtn();
  if (delBtn) delBtn.classList.remove('hidden');

  document.getElementById('habit-modal-title').textContent = 'Edit Habit';
  document.getElementById('habit-modal-desc').textContent = 'Update habit details';

  document.getElementById('habit-name-input').value = habit.name;
  document.getElementById('frequency-select').value = habit.frequency;

  // If the habit currently uses a Completion Target, its schedule-section should reset to Daily.
  const freqSel = document.getElementById('frequency-select');
  if (freqSel) {
    const shouldResetFreq = typeof habit.target === 'number' && habit.target > 0;
    freqSel.value = shouldResetFreq ? 'daily' : habit.frequency;
  }

  // days selections
  if (habit.days) {
    const targetSet = habit.frequency === 'biweekly' ? selectedBiweeklyDays : selectedWeeklyDays;
    habit.days.forEach((d) => targetSet.add(d));
    document.querySelectorAll('.day-button').forEach((btn) => {
      if (habit.days.includes(parseInt(btn.dataset.day, 10))) btn.classList.add('selected');
    });
  }

  // monthly / yearly
  if (habit.monthly) {
    setMonthlyMode(habit.monthly.mode || 'each');
    document.getElementById('month-interval-select').value = habit.monthly.interval || 1;
    if (habit.monthly.mode === 'each' && habit.monthly.dates) {
      habit.monthly.dates.forEach((d) => selectedMonthlyDates.add(d));
      document.querySelectorAll('.date-button').forEach((btn) => {
        if (habit.monthly.dates.includes(parseInt(btn.dataset.date, 10)))
          btn.classList.add('selected');
      });
    } else if (habit.monthly.mode === 'on' && habit.monthly.combinations) {
      habit.monthly.combinations.forEach((c) => selectedCombinations.add(c));
      updateCombinationsList();
    }
  }

  if (habit.months) {
    habit.months.forEach((m) => selectedMonths.add(m));
    document.querySelectorAll('.month-button').forEach((btn) => {
      if (habit.months.includes(parseInt(btn.dataset.month, 10))) btn.classList.add('selected');
    });
    document.getElementById('year-interval-select').value = habit.yearInterval || 1;
  }

  // scheduled time
  if (habit.scheduledTime) {
    document.getElementById('anytime-toggle').checked = false;
    const [h, min] = habit.scheduledTime.split(':');
    document.getElementById('hour-select').value = h;
    document.getElementById('minute-select').value = min;
    document.getElementById('selected-time').textContent = habit.scheduledTime;
    document.getElementById('time-selection').classList.remove('hidden');
  }

  // paused / holidays toggles
  document.getElementById('pause-habit-toggle').checked = !!habit.paused;
  document.getElementById('holidays-toggle').checked = !!habit.activeOnHolidays;

  // icon
  setSelectedIcon(habit.icon || '📋');
  const display = document.getElementById('selected-icon-display');
  if (display) display.textContent = getSelectedIcon();

  // target
  if (habit.target) {
    document.getElementById('completion-target-section').classList.remove('hidden');
    document.getElementById('target-frequency-select').value =
      habit.targetFrequency || habit.frequency;
    document.getElementById('target-value-input').value = habit.target;
    document.getElementById('target-unit-select').value = habit.targetUnit || 'none';
    const incInput = document.getElementById('default-increment-input');
    if (incInput) {
      incInput.value = habit.defaultIncrement || 1;
    }

    // activate Target tab UI
    document.getElementById('completion-target-tab')?.click();
  }

  // Set category after ensuring dropdown is populated
  import('../ui/categories.js').then((m) => {
    m.populateCategoryDropdown();
    // Set the category value after dropdown is populated
    const categorySelect = document.getElementById('habit-category-select');
    if (categorySelect) {
      categorySelect.value = habit.categoryId;
      // Validate form after category is set
      checkHabitFormValidity();
    }
  });

  handleFrequencyChange();
  updateTargetExample();

  // Update counters for initial values to ensure UI reflects selected state
  setTimeout(() => {
    const freq = document.getElementById('frequency-select')?.value;
    if (freq === 'monthly') {
      // Force monthly counter update by triggering a re-count
      const selectedDates = document.querySelectorAll('.date-button.selected');
      const countEl = document.getElementById('selected-dates-count');
      if (countEl) countEl.textContent = selectedDates.length;
    }
    if (freq === 'yearly') {
      // Force yearly counter updates
      const selectedMonths = document.querySelectorAll('.month-button.selected');
      const selectedDates = document.querySelectorAll('.yearly-date-button.selected');
      const monthCountEl = document.getElementById('selected-months-count');
      const dateCountEl = document.getElementById('selected-yearly-dates-count');
      if (monthCountEl) monthCountEl.textContent = selectedMonths.length;
      if (dateCountEl) dateCountEl.textContent = selectedDates.length;
    }
  }, 100);

  openModal('add-habit-modal');
}

function resetHabitFormUI() {
  // clear selects and sets like earlier reset function quick
  document.getElementById('habit-modal-title').textContent = 'New Habit';
  document.getElementById('habit-modal-desc').textContent =
    'Add a new habit to track your progress';
  document.getElementById('habit-name-input').value = '';
  document.getElementById('habit-category-select').value = '';
  document.getElementById('frequency-select').value = 'daily';
  document.getElementById('anytime-toggle').checked = true;
  document.getElementById('time-selection').classList.add('hidden');
  document.getElementById('selected-time').textContent = '09:00';
  document.getElementById('hour-select').value = '09';
  document.getElementById('minute-select').value = '00';

  // clear sets and UI selections
  selectedWeeklyDays.clear();
  selectedBiweeklyDays.clear();
  selectedMonthlyDates.clear();
  selectedCombinations.clear();
  selectedMonths.clear();
  selectedYearlyDates.clear();
  document
    .querySelectorAll('.day-button, .date-button, .month-button, .yearly-date-button')
    .forEach((btn) => btn.classList.remove('selected'));
  updateCombinationsList();

  setMonthlyMode('each');
  document.getElementById('month-interval-select').value = '1';
  document.getElementById('year-interval-select').value = '1';

  document.getElementById('completion-target-section').classList.add('hidden');
  document.getElementById('target-frequency-select').value = 'daily';
  document.getElementById('target-value-input').value = '1';
  document.getElementById('target-unit-select').value = 'none';
  document.getElementById('default-increment-input').value = '1';

  // reset toggles
  document.getElementById('pause-habit-toggle').checked = false;
  document.getElementById('holidays-toggle').checked = false;

  // reset icon
  setSelectedIcon('📋');
  const display = document.getElementById('selected-icon-display');
  if (display) display.textContent = getSelectedIcon();

  // revert tabs to Schedule default
  document.getElementById('schedule-tab')?.click();

  // If a category was just created, preselect it
  if (window._preselectCategoryId) {
    const sel = document.getElementById('habit-category-select');
    if (sel) sel.value = window._preselectCategoryId;
    window._preselectCategoryId = undefined;
  }

  // Refresh category dropdown visibility (also hides chevron when none)
  import('../ui/categories.js').then((m) => m.populateCategoryDropdown());
}

export function initializeHabitsForm() {
  import('../ui/categories.js').then((m) => m.populateCategoryDropdown());
  initializeTimePicker();

  // Ensure dynamic grids are present (in case form initializes before frequencySection did)
  buildMonthlyDateGrid();
  buildMonthGrid();

  // Button wiring
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.new-habit-btn');
    if (btn) {
      e.preventDefault();
      // Check if button is disabled (no categories)
      if (btn.disabled) {
        return;
      }
      openAddHabitModal();
    }
  });
  document.getElementById('cancel-habit')?.addEventListener('click', closeAddHabitModal);
  document.getElementById('save-habit')?.addEventListener('click', handleSaveHabit);



  // Validation wiring
  const nameInput = document.getElementById('habit-name-input');
  const categorySelect = document.getElementById('habit-category-select');
  nameInput?.addEventListener('input', checkHabitFormValidity);
  categorySelect?.addEventListener('change', checkHabitFormValidity);

  // Initialise frequency & target sub-modules
  initFrequencySection();
  initTargetSection();

  // Anytime toggle → show/hide time picker
  function handleAnytimeToggle() {
    const checked = document.getElementById('anytime-toggle')?.checked ?? true;
    document.getElementById('time-selection')?.classList.toggle('hidden', checked);
  }

  document.getElementById('anytime-toggle')?.addEventListener('change', handleAnytimeToggle);

  // Initial section visibility (frequency handled inside initFrequencySection)
  handleAnytimeToggle();

  // Tab switching (Schedule vs Target)
  const scheduleTab = document.getElementById('schedule-tab');
  const targetTab = document.getElementById('completion-target-tab');
  const scheduleSec = document.getElementById('schedule-section');
  const targetSec = document.getElementById('completion-target-section');

  function activateTab(tab) {
    if (!scheduleTab || !targetTab || !scheduleSec || !targetSec) return;
    const activeClasses = [
      'bg-white',
      'dark:bg-gray-600',
      'text-gray-900',
      'dark:text-white',
      'shadow-sm',
    ];
    const inactiveClasses = ['text-gray-600', 'dark:text-gray-400'];

    if (tab === 'schedule') {
      scheduleTab.classList.add(...activeClasses);
      scheduleTab.classList.remove(...inactiveClasses);
      targetTab.classList.remove(...activeClasses);
      targetTab.classList.add(...inactiveClasses);
      scheduleSec.classList.remove('hidden');
      targetSec.classList.add('hidden');
    } else {
      targetTab.classList.add(...activeClasses);
      targetTab.classList.remove(...inactiveClasses);
      scheduleTab.classList.remove(...activeClasses);
      scheduleTab.classList.add(...inactiveClasses);
      targetSec.classList.remove('hidden');
      scheduleSec.classList.add('hidden');
    }
  }

  scheduleTab?.addEventListener('click', () => activateTab('schedule'));
  targetTab?.addEventListener('click', () => activateTab('target'));

  // Ensure default state
  activateTab('schedule');

  checkHabitFormValidity();

  // Icon picker
  initIconPicker();
}

// ---------------- internal helpers ----------------

function checkHabitFormValidity() {
  const saveBtn = document.getElementById('save-habit');
  const nameInput = document.getElementById('habit-name-input');
  const categorySelect = document.getElementById('habit-category-select');
  if (!saveBtn || !nameInput || !categorySelect) return;

  // Always enable save button if required fields are filled (like activity modal)
  const valid = nameInput.value.trim().length > 0 && categorySelect.value !== '';

  saveBtn.disabled = !valid;
  saveBtn.classList.toggle('opacity-50', !valid);
}

function gatherFormData() {
  return {
    name: document.getElementById('habit-name-input')?.value.trim(),
    categoryId: document.getElementById('habit-category-select')?.value || null,
    frequency: document.getElementById('frequency-select')?.value || 'daily',
    anytime: document.getElementById('anytime-toggle')?.checked ?? true,
    hour: document.getElementById('hour-select')?.value || '09',
    minute: document.getElementById('minute-select')?.value || '00',
    monthInterval: parseInt(document.getElementById('month-interval-select')?.value || '1', 10),
    yearInterval: parseInt(document.getElementById('year-interval-select')?.value || '1', 10),
    paused: document.getElementById('pause-habit-toggle')?.checked ?? false,
    activeOnHolidays: document.getElementById('holidays-toggle')?.checked ?? false,
    icon: getSelectedIcon(),
    progress: {},
    skippedDates: [],
  };
}

async function handleSaveHabit() {
  const data = gatherFormData();
  if (!data.name || !data.categoryId) return;

  // Determine if the user enabled the Completion Target pane
  const targetSection = document.getElementById('completion-target-section');
  const targetValInput = document.getElementById('target-value-input');
  const includeTarget =
    targetSection &&
    !targetSection.classList.contains('hidden') &&
    targetValInput &&
    parseInt(targetValInput.value || '0', 10) > 0;
  const defaultIncInput = document.getElementById('default-increment-input');
  const defaultIncVal = defaultIncInput ? parseInt(defaultIncInput.value || '1', 10) : 1;

  // Import timezone-safe date helper
  const { getLocalMidnightISOString } = await import('../../../shared/datetime.js');
  
  const habitObj = {
    id: generateUniqueId(),
    name: data.name,
    categoryId: data.categoryId,
    frequency: data.frequency,
    createdAt: getLocalMidnightISOString(new Date()), // Add timezone-safe creation timestamp
    days:
      data.frequency === 'weekly'
        ? Array.from(selectedWeeklyDays)
        : data.frequency === 'biweekly'
          ? Array.from(selectedBiweeklyDays)
          : undefined,
    scheduledTime: data.anytime ? null : `${data.hour}:${data.minute}`,
    monthly:
      data.frequency === 'monthly'
        ? {
            interval: data.monthInterval,
            mode: monthlyMode,
            dates: monthlyMode === 'each' ? Array.from(selectedMonthlyDates) : undefined,
            combinations: monthlyMode === 'on' ? Array.from(selectedCombinations) : undefined,
          }
        : undefined,
    months: data.frequency === 'yearly' ? Array.from(selectedMonths) : undefined,
    yearInterval: data.frequency === 'yearly' ? data.yearInterval : undefined,
    completed: false,
    paused: data.paused,
    activeOnHolidays: data.activeOnHolidays,
    icon: getSelectedIcon(),
    progress: data.progress,
    skippedDates: data.skippedDates,
  };

  if (includeTarget) {
    habitObj.target = parseInt(document.getElementById('target-value-input')?.value || '1', 10);
    habitObj.targetFrequency =
      document.getElementById('target-frequency-select')?.value || undefined;
    habitObj.targetUnit = document.getElementById('target-unit-select')?.value || 'none';
    habitObj.defaultIncrement = defaultIncVal;

    // Clear schedule-specific data to enforce exclusivity
    delete habitObj.days;
    delete habitObj.monthly;
    delete habitObj.months;
    delete habitObj.yearInterval;
  } else {
    // Ensure no lingering target data when in schedule-only mode
    delete habitObj.target;
    delete habitObj.targetFrequency;
    delete habitObj.targetUnit;
    delete habitObj.defaultIncrement;
  }

  if (editingHabitId) {
    dispatch(Actions.updateHabit(editingHabitId, habitObj));
  } else {
    dispatch(Actions.addHabit(habitObj));
  }

  closeAddHabitModal();
  renderHabitsList();
}

// Ensure delete button exists in modal footer
function ensureDeleteBtn() {
  const btn = document.getElementById('delete-habit-btn');
  if (!btn) return null;

  // Set up event listener if not already attached
  if (!btn.dataset.listenerAttached) {
    btn.addEventListener('click', deleteHabit);
    btn.dataset.listenerAttached = 'true';
  }

  return btn;
}

function deleteHabit() {
  if (!editingHabitId) return;

  showConfirm({
    title: 'Delete Habit?',
    message: 'This habit will be permanently removed. This action cannot be undone.',
    okText: 'Delete',
    onOK: () => {
      dispatch(Actions.deleteHabit(editingHabitId));
      closeAddHabitModal();
      renderHabitsList();
    },
  });
}
