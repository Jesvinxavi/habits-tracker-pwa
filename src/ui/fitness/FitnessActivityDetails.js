/**
 * FitnessActivityDetails - Activity details modal component
 * Handles activity recording, editing, and sets/reps tracking
 */

import { openModal, closeModal } from '../../components/Modal.js';
import { appData } from '../../core/state.js';
import {
  getActivity,
  getActivityCategory,
  recordActivity,
  updateRecordedActivity,
} from '../../utils/activities.js';
import { getLocalISODate } from '../../utils/datetime.js';

/**
 * Opens activity details modal for new recording
 */
export function openActivityDetailsModal(activityId) {
  const activity = getActivity(activityId);
  if (!activity) return;

  const category = getActivityCategory(activity.categoryId);

  // Populate activity info
  populateActivityInfo(activity, category);

  // Reset form
  const form = document.getElementById('activity-details-form');
  if (form) form.reset();

  // Show appropriate tracking section based on activity's tracking type
  setupActivityDetailsTracking(activity);

  // Store activity ID for recording
  const modal = document.getElementById('activity-details-modal');
  if (modal) {
    modal.dataset.activityId = activityId;
    delete modal.dataset.recordId;
    delete modal.dataset.editMode;
  }

  // Reset modal UI
  resetModalUI();

  // Open details modal
  openModal('activity-details-modal');
}

/**
 * Opens activity details modal for editing existing record
 */
export function openActivityDetailsModalWithRecord(activityId, record) {
  const activity = getActivity(activityId);
  if (!activity) return;

  const category = getActivityCategory(activity.categoryId);

  // Populate activity info
  populateActivityInfo(activity, category);

  // Reset form
  const form = document.getElementById('activity-details-form');
  if (form) form.reset();

  // Show appropriate tracking section based on activity's tracking type
  setupActivityDetailsTracking(activity);

  // Store activity ID and record ID for editing
  const modal = document.getElementById('activity-details-modal');
  if (modal) {
    modal.dataset.activityId = activityId;
    modal.dataset.recordId = record.id;
    modal.dataset.editMode = 'true';
  }

  // Pre-fill with existing record data
  prefillRecordData(record);

  // Change modal header to indicate editing
  const modalTitle = document.querySelector('#activity-details-modal .modal-header span');
  if (modalTitle) modalTitle.textContent = 'Edit Activity';

  const saveBtn = document.getElementById('save-activity-details');
  if (saveBtn) saveBtn.textContent = 'Update';

  openModal('activity-details-modal');
}

/**
 * Populates activity info in the modal header
 */
function populateActivityInfo(activity, category) {
  const iconEl = document.getElementById('activity-details-icon');
  const nameEl = document.getElementById('activity-details-name');
  const categoryEl = document.getElementById('activity-details-category');

  if (iconEl) {
    iconEl.textContent = activity.icon || category.icon;
    iconEl.style.backgroundColor = `${category.color}20`;
  }
  if (nameEl) nameEl.textContent = activity.name;
  if (categoryEl) categoryEl.textContent = category.name;
}

/**
 * Sets up tracking section based on activity type
 */
function setupActivityDetailsTracking(activity) {
  const timeSection = document.getElementById('time-tracking-section');
  const setsSection = document.getElementById('sets-reps-tracking-section');

  if (!timeSection || !setsSection) return;

  if (activity.trackingType === 'sets-reps') {
    // Show sets/reps section
    timeSection.classList.add('hidden');
    setsSection.classList.remove('hidden');

    // Clear existing sets and add one set
    clearSets();
    addNewSet(activity.units || 'none');
  } else {
    // Show time-based section (default)
    setsSection.classList.add('hidden');
    timeSection.classList.remove('hidden');
  }
}

/**
 * Pre-fills form with existing record data
 */
function prefillRecordData(record) {
  if (record.sets && record.sets.length > 0) {
    // Sets/Reps data
    record.sets.forEach((setData, index) => {
      if (index === 0) {
        // Update the first set that's automatically created
        const firstSet = document.querySelector('[data-set-id="set-1"]');
        if (firstSet) {
          updateSetInputs(firstSet, setData, 'set-1');
        }
      } else {
        // Add additional sets
        addNewSet(setData.unit || 'none');
        const newSetId = `set-${index + 1}`;
        const newSet = document.querySelector(`[data-set-id="${newSetId}"]`);
        if (newSet) {
          updateSetInputs(newSet, setData, newSetId);
        }
      }
    });
  } else {
    // Time-based data
    const durationInput = document.getElementById('activity-duration-input');
    const durationUnitSelect = document.getElementById('duration-unit-select');
    const intensitySelect = document.getElementById('activity-intensity-select');

    if (durationInput) durationInput.value = record.duration || '';
    if (durationUnitSelect) durationUnitSelect.value = record.durationUnit || 'minutes';
    if (intensitySelect) intensitySelect.value = record.intensity || '';
  }

  // Pre-fill notes
  const notesInput = document.getElementById('activity-notes-input');
  if (notesInput) notesInput.value = record.notes || '';
}

/**
 * Updates set inputs with data
 */
function updateSetInputs(setElement, setData, setId) {
  const repsInput = setElement.querySelector(`input[name="reps-${setId}"]`);
  const valueInput = setElement.querySelector(`input[name="value-${setId}"]`);
  const unitSelect = setElement.querySelector(`select[name="unit-${setId}"]`);

  if (repsInput) repsInput.value = setData.reps || '';
  if (valueInput) valueInput.value = setData.value || '';
  if (unitSelect) unitSelect.value = setData.unit || 'none';
}

/**
 * Resets modal UI to default state
 */
function resetModalUI() {
  const modalTitle = document.querySelector('#activity-details-modal .modal-header span');
  if (modalTitle) modalTitle.textContent = 'Activity Details';

  const saveBtn = document.getElementById('save-activity-details');
  if (saveBtn) saveBtn.textContent = 'Record';
}

/**
 * Clears all sets from the container
 */
function clearSets() {
  const setsContainer = document.getElementById('sets-container');
  if (setsContainer) {
    setsContainer.innerHTML = '';
  }
}

/**
 * Adds a new set to the container
 */
function addNewSet(defaultUnit = 'none') {
  const setsContainer = document.getElementById('sets-container');
  if (!setsContainer) return;

  const setNumber = setsContainer.children.length + 1;
  const setId = `set-${setNumber}`;

  const setElement = document.createElement('div');
  setElement.className = 'set-item p-4 bg-gray-50 dark:bg-gray-700 rounded-xl space-y-3';
  setElement.dataset.setId = setId;

  setElement.innerHTML = `
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Set ${setNumber}</label>
      ${
        setNumber > 1
          ? `<button type="button" class="remove-set-btn text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 p-1" data-set-id="${setId}">
        <span class="material-icons text-red-600 text-base">delete</span>
      </button>`
          : ''
      }
    </div>
    <div class="grid grid-cols-3 gap-2">
      <div>
        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Reps</label>
        <input type="number" name="reps-${setId}" min="1" max="999" placeholder="12" class="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50 h-10 text-center">
      </div>
      <div>
        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Value</label>
        <input type="number" name="value-${setId}" min="0" step="0.1" placeholder="50" class="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50 h-10 text-center">
      </div>
      <div>
        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Unit</label>
        <select name="unit-${setId}" class="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50 h-10" style="text-align: center; text-align-last: center;">
          <option value="none" ${defaultUnit === 'none' ? 'selected' : ''}>None</option>
          <option value="kg" ${defaultUnit === 'kg' ? 'selected' : ''}>Kg</option>
          <option value="seconds" ${defaultUnit === 'seconds' ? 'selected' : ''}>s</option>
          <option value="minutes" ${defaultUnit === 'minutes' ? 'selected' : ''}>Mins</option>
        </select>
      </div>
    </div>
  `;

  setsContainer.appendChild(setElement);

  // Bind remove button if it exists
  const removeBtn = setElement.querySelector('.remove-set-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      removeSet(setId);
    });
  }
}

/**
 * Removes a set from the container
 */
function removeSet(setId) {
  const setElement = document.querySelector(`[data-set-id="${setId}"]`);
  if (setElement) {
    setElement.remove();
    // Renumber remaining sets
    renumberSets();
  }
}

/**
 * Renumbers all sets after removal
 */
function renumberSets() {
  const setsContainer = document.getElementById('sets-container');
  if (!setsContainer) return;

  const setElements = setsContainer.querySelectorAll('.set-item');
  setElements.forEach((setElement, index) => {
    const setNumber = index + 1;
    const newSetId = `set-${setNumber}`;

    // Update set ID
    setElement.dataset.setId = newSetId;

    // Update label
    const label = setElement.querySelector('label');
    if (label) label.textContent = `Set ${setNumber}`;

    // Update input names
    const repsInput = setElement.querySelector('input[name^="reps-"]');
    const valueInput = setElement.querySelector('input[name^="value-"]');
    const unitSelect = setElement.querySelector('select[name^="unit-"]');

    if (repsInput) repsInput.name = `reps-${newSetId}`;
    if (valueInput) valueInput.name = `value-${newSetId}`;
    if (unitSelect) unitSelect.name = `unit-${newSetId}`;

    // Update remove button data-set-id
    const removeBtn = setElement.querySelector('.remove-set-btn');
    if (removeBtn) removeBtn.dataset.setId = newSetId;

    // Show/hide remove button (first set shouldn't have remove button)
    if (setNumber === 1) {
      if (removeBtn) removeBtn.style.display = 'none';
    } else {
      if (removeBtn) removeBtn.style.display = 'block';
    }
  });
}

/**
 * Collects sets data from the form
 */
function collectSetsData() {
  const setsContainer = document.getElementById('sets-container');
  if (!setsContainer) return [];

  const sets = [];
  const setElements = setsContainer.querySelectorAll('.set-item');

  setElements.forEach((setElement, index) => {
    const setId = `set-${index + 1}`;
    const repsInput = setElement.querySelector(`input[name="reps-${setId}"]`);
    const valueInput = setElement.querySelector(`input[name="value-${setId}"]`);
    const unitSelect = setElement.querySelector(`select[name="unit-${setId}"]`);

    const reps = repsInput && repsInput.value ? parseInt(repsInput.value) : null;
    const value = valueInput && valueInput.value ? parseFloat(valueInput.value) : null;
    const unit = unitSelect ? unitSelect.value : 'none';

    // Only include sets with at least reps filled
    if (reps) {
      sets.push({
        reps,
        value,
        unit,
      });
    }
  });

  return sets;
}

/**
 * Saves the activity record
 */
export function saveActivityRecord() {
  const modal = document.getElementById('activity-details-modal');
  const activityId = modal ? modal.dataset.activityId : null;
  const recordId = modal ? modal.dataset.recordId : null;
  const isEditMode = modal ? modal.dataset.editMode === 'true' : false;

  if (!activityId) return;

  const activity = getActivity(activityId);
  if (!activity) return;

  const notesInput = document.getElementById('activity-notes-input');
  const notes = notesInput && notesInput.value.trim() ? notesInput.value.trim() : '';

  let recordData = { notes };

  if (activity.trackingType === 'sets-reps') {
    // Collect sets data
    const sets = collectSetsData();
    if (sets.length === 0) return; // Don't save if no sets
    recordData.sets = sets;
  } else {
    // Collect time-based data
    const durationInput = document.getElementById('activity-duration-input');
    const durationUnitSelect = document.getElementById('duration-unit-select');
    const intensitySelect = document.getElementById('activity-intensity-select');

    const duration = durationInput && durationInput.value ? parseInt(durationInput.value) : null;
    const durationUnit = durationUnitSelect ? durationUnitSelect.value : 'minutes';
    const intensity = intensitySelect && intensitySelect.value ? intensitySelect.value : null;

    if (!duration) return; // Don't save if no duration

    recordData.duration = duration;
    recordData.durationUnit = durationUnit;
    recordData.intensity = intensity;
  }

  if (isEditMode && recordId) {
    // Update existing record
    const selectedDate = appData.fitnessSelectedDate || new Date().toISOString();
    const iso = getLocalISODate(selectedDate);
    updateRecordedActivity(recordId, iso, recordData);
  } else {
    // Create new record
    const selectedDate = appData.fitnessSelectedDate || new Date().toISOString();
    const iso = getLocalISODate(selectedDate);
    recordActivity(activityId, iso, recordData);
  }

  // Reset modal state
  if (modal) {
    delete modal.dataset.recordId;
    delete modal.dataset.editMode;
  }

  // Reset modal UI
  resetModalUI();

  closeModal('activity-details-modal');

  // Trigger re-render of activities list
  const event = new CustomEvent('fitnessDataChanged');
  document.dispatchEvent(event);
}

/**
 * Initializes the activity details modal
 */
export function initializeActivityDetailsModal() {
  // Cancel button
  const cancelBtn = document.getElementById('cancel-activity-details');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      closeModal('activity-details-modal');
    });
  }

  // Add Set button
  const addSetBtn = document.getElementById('add-set-btn');
  if (addSetBtn) {
    addSetBtn.addEventListener('click', () => {
      const modal = document.getElementById('activity-details-modal');
      const activityId = modal ? modal.dataset.activityId : null;
      if (!activityId) return;

      const activity = getActivity(activityId);
      if (activity) {
        addNewSet(activity.units || 'none');
      }
    });
  }

  // Save button
  const saveBtn = document.getElementById('save-activity-details');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveActivityRecord);
  }

  // Form submission
  const form = document.getElementById('activity-details-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveActivityRecord();
    });
  }
}
