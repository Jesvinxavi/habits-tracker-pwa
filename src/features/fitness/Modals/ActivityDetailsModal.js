// ActivityDetailsModal.js - Activity details modal for recording sets/reps/time
import { openModal, closeModal } from '../../../components/Modal.js';
import {
  getActivity,
  getActivityCategory,
  recordActivity,
  updateRecordedActivity,
} from '../activities.js';
import { getState } from '../../../core/state.js';

export const ActivityDetailsModal = {
  /**
   * Opens the activity details modal for recording
   * @param {string} activityId - The activity ID
   */
  open(activityId) {
    const activity = getActivity(activityId);
    if (!activity) return;

    const category = getActivityCategory(activity.categoryId);
    this._populateActivityInfo(activity, category);
    this._setupTrackingSection(activity);
    this._storeActivityId(activityId);

    // Set up event handlers BEFORE opening the modal
    this._setupEventHandlers();

    // Reset form AFTER storing activity ID
    this._resetForm();

    // Show modal using common modal system
    openModal('activity-details-modal');
  },

  /**
   * Opens the activity details modal for editing an existing record
   * @param {string} activityId - The activity ID
   * @param {Object} record - The existing activity record
   */
  openWithRecord(activityId, record) {
    const activity = getActivity(activityId);
    if (!activity) return;

    const category = getActivityCategory(activity.categoryId);
    this._populateActivityInfo(activity, category);
    this._setupTrackingSection(activity);
    this._storeActivityId(activityId);
    this._storeRecordId(record.id);
    this._setEditMode(true);
    this._populateRecordData(record);

    // Set up event handlers BEFORE opening the modal
    this._setupEventHandlers();

    // Show modal using common modal system
    openModal('activity-details-modal');
  },

  /**
   * Populates activity information in the modal
   * @private
   */
  _populateActivityInfo(activity, category) {
    const iconEl = document.getElementById('activity-details-icon');
    const nameEl = document.getElementById('activity-details-name');
    const categoryEl = document.getElementById('activity-details-category');

    if (iconEl) {
      iconEl.textContent = activity.icon || category.icon;
      iconEl.style.backgroundColor = `${category.color}20`;
    }
    if (nameEl) nameEl.textContent = activity.name;
    if (categoryEl) categoryEl.textContent = category.name;
  },

  /**
   * Sets up the appropriate tracking section based on activity type
   * @private
   */
  _setupTrackingSection(activity) {
    const setsRepsSection = document.getElementById('sets-reps-tracking-section');
    const timeSection = document.getElementById('time-tracking-section');

    if (activity.trackingType === 'sets-reps') {
      if (setsRepsSection) setsRepsSection.classList.remove('hidden');
      if (timeSection) timeSection.classList.add('hidden');
    } else {
      if (setsRepsSection) setsRepsSection.classList.add('hidden');
      if (timeSection) timeSection.classList.remove('hidden');
    }
  },

  /**
   * Stores the activity ID in the modal
   * @private
   */
  _storeActivityId(activityId) {
    const modal = document.getElementById('activity-details-modal');
    if (modal) modal.dataset.activityId = activityId;
  },

  /**
   * Stores the record ID in the modal
   * @private
   */
  _storeRecordId(recordId) {
    const modal = document.getElementById('activity-details-modal');
    if (modal) modal.dataset.recordId = recordId;
  },

  /**
   * Sets edit mode flag
   * @private
   */
  _setEditMode(isEdit) {
    const modal = document.getElementById('activity-details-modal');
    if (modal) modal.dataset.editMode = isEdit.toString();
  },

  /**
   * Populates form with existing record data
   * @private
   */
  _populateRecordData(record) {
    // Populate sets data
    if (record.sets && record.sets.length > 0) {
      this._clearSets();
      record.sets.forEach((set, index) => {
        if (index === 0) {
          // Update the first set that's automatically created
          this._addNewSet(set.unit || 'none');
          const firstSet = document.querySelector('[data-set-id="set-1"]');
          if (firstSet) {
            const repsInput = firstSet.querySelector('input[name="reps-set-1"]');
            const valueInput = firstSet.querySelector('input[name="value-set-1"]');
            const unitSelect = firstSet.querySelector('select[name="unit-set-1"]');

            if (repsInput) repsInput.value = set.reps || '';
            if (valueInput) valueInput.value = set.value || '';
            if (unitSelect) unitSelect.value = set.unit || 'none';
          }
        } else {
          // Add additional sets
          this._addNewSet(set.unit || 'none');
          const newSetId = `set-${index + 1}`;
          const newSet = document.querySelector(`[data-set-id="${newSetId}"]`);
          if (newSet) {
            const repsInput = newSet.querySelector(`input[name="reps-${newSetId}"]`);
            const valueInput = newSet.querySelector(`input[name="value-${newSetId}"]`);
            const unitSelect = newSet.querySelector(`select[name="unit-${newSetId}"]`);

            if (repsInput) repsInput.value = set.reps || '';
            if (valueInput) valueInput.value = set.value || '';
            if (unitSelect) unitSelect.value = set.unit || 'none';
          }
        }
      });
    } else {
      // Populate time-based data
      const durationInput = document.getElementById('activity-duration-input');
      const durationUnitSelect = document.getElementById('duration-unit-select');
      const intensitySelect = document.getElementById('activity-intensity-select');

      if (durationInput) durationInput.value = record.duration || '';
      if (durationUnitSelect) durationUnitSelect.value = record.durationUnit || 'minutes';
      if (intensitySelect) intensitySelect.value = record.intensity || '';
    }

    // Populate notes
    const notesInput = document.getElementById('activity-notes-input');
    if (notesInput) notesInput.value = record.notes || '';
  },

  /**
   * Resets the form
   * @private
   */
  _resetForm() {
    const form = document.getElementById('activity-details-form');
    if (form) form.reset();
    this._clearSets();

    // Get the current activity to determine if we need to add a default set
    const modal = document.getElementById('activity-details-modal');
    const activityId = modal?.dataset.activityId;

    if (activityId) {
      const activity = getActivity(activityId);
      if (activity && activity.trackingType === 'sets-reps') {
        this._addNewSet(activity.units || 'none');
      }
    }
  },

  /**
   * Binds save button handler
   * @private
   */
  _bindSaveHandler() {
    const saveBtn = document.getElementById('save-activity-details');
    if (saveBtn && !saveBtn.dataset.listenerAttached) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this._handleSave();
      });
      saveBtn.dataset.listenerAttached = 'true';
    }
  },

  /**
   * Binds cancel button handler
   * @private
   */
  _bindCancelHandler() {
    const cancelBtn = document.getElementById('cancel-activity-details');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        closeModal('activity-details-modal');
      });
    }
  },

  /**
   * Binds sets management handlers
   * @private
   */
  _bindSetsHandlers() {
    // Add set button
    const addSetBtn = document.getElementById('add-set-btn');
    if (addSetBtn) {
      addSetBtn.addEventListener('click', () => {
        const modal = document.getElementById('activity-details-modal');
        const activityId = modal ? modal.dataset.activityId : null;
        if (!activityId) return;

        const activity = getActivity(activityId);
        if (activity) {
          this._addNewSet(activity.units || 'none');
        } else {
          this._addNewSet('none');
        }
      });
    }

    // Remove set buttons (delegated)
    const setsContainer = document.getElementById('sets-container');
    if (setsContainer) {
      setsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-set-btn')) {
          const setId = e.target.dataset.setId;
          this._removeSet(setId);
        }
      });
    }
  },

  /**
   * Handles saving the activity record
   * @private
   */
  _handleSave() {
    const modal = document.getElementById('activity-details-modal');
    if (!modal) return;

    const activityId = modal.dataset.activityId;
    const recordId = modal.dataset.recordId;
    const isEdit = modal.dataset.editMode === 'true';

    const activity = getActivity(activityId);
    if (!activity) return;

    const recordData = this._collectRecordData(activity);

    // Don't save if no valid data was collected
    if (!recordData) {
      console.warn('No valid data collected, not saving activity');
      return;
    }

    // Get the selected fitness date from state instead of using today
    import('../../../shared/datetime.js').then(({ getLocalISODate }) => {
      const selectedDate = getState().fitnessSelectedDate || new Date().toISOString();
      const dateString = getLocalISODate(selectedDate); // Use consistent date conversion

      if (isEdit && recordId) {
        // Update existing record
        updateRecordedActivity(recordId, dateString, recordData);
      } else {
        // Create new record
        recordActivity(activityId, dateString, recordData);
      }

      closeModal('activity-details-modal');

      // Trigger activity list refresh
      const event = new CustomEvent('ActivityRecorded', {
        detail: { activityId, recordData },
      });
      document.dispatchEvent(event);
    });
  },

  /**
   * Collects form data into record object
   * @private
   */
  _collectRecordData(activity) {
    const recordData = {
      timestamp: new Date().toISOString(),
      notes: document.getElementById('activity-notes-input')?.value || '',
    };

    if (activity.trackingType === 'sets-reps') {
      recordData.sets = this._collectSetsData();
      // Ensure we have at least one valid set
      if (!recordData.sets || recordData.sets.length === 0) {
        console.warn('No valid sets found for sets-reps activity');
        return null;
      }
    } else {
      const duration = document.getElementById('activity-duration-input')?.value;
      const durationUnit = document.getElementById('duration-unit-select')?.value;
      const intensity = document.getElementById('activity-intensity-select')?.value;

      if (duration && duration.trim() !== '') {
        recordData.duration = duration;
        recordData.durationUnit = durationUnit || 'minutes';
      } else {
        // For time-based activities, require at least duration
        console.warn('No duration provided for time-based activity');
        return null;
      }
      if (intensity) {
        recordData.intensity = intensity;
      }
    }

    return recordData;
  },

  /**
   * Collects sets data from form
   * @private
   */
  _collectSetsData() {
    const sets = [];
    const setElements = document.querySelectorAll('.set-item');

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
  },

  /**
   * Clears all sets
   * @private
   */
  _clearSets() {
    const setsContainer = document.getElementById('sets-container');
    if (setsContainer) {
      setsContainer.innerHTML = '';
    }
  },

  /**
   * Adds a new set row
   * @private
   */
  _addNewSet(defaultUnit = 'none') {
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
        this._removeSet(setId);
      });
    }
  },

  /**
   * Removes a set
   * @private
   */
  _removeSet(setId) {
    const setElement = document.querySelector(`[data-set-id="${setId}"]`);
    if (setElement) {
      setElement.remove();
      // Renumber remaining sets
      this._renumberSets();
    }
  },

  /**
   * Renumbers sets after removal
   * @private
   */
  _renumberSets() {
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
  },

  /**
   * Sets up all modal event handlers
   */
  _setupEventHandlers() {
    this._bindSaveHandler();
    this._bindCancelHandler();
    this._bindSetsHandlers();
  },
};
