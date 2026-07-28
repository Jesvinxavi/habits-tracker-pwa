// ActivityDetailsModal.js - Record modal for logging sets/reps or duration
import { openModal, closeModal } from '../../../components/Modal.js';
import {
  getActivity,
  getActivityCategory,
  recordActivity,
  updateRecordedActivity,
} from '../activities.js';
import { getState } from '../../../core/state.js';
import { isRestDay } from '../restDays.js';
import { showConfirm } from '../../../components/ConfirmDialog.js';
import { getLocalISODate } from '../../../shared/datetime.js';
import { bestValue, extractProgressionSeries, shortDateLabel } from '../helpers/activityStats.js';

// Kept in step with the sets-table header in index.html: set label, reps, value,
// unit, remove.
const SET_ROW_COLUMNS = '3.25rem 1fr 1fr 4.25rem 1.5rem';

/**
 * Reducer picking the later of two progression points by date, preferring the
 * one entered later when both fall on the same day.
 * @param {{date: string}} left Current pick.
 * @param {{date: string}} right Candidate.
 * @returns {{date: string}} The later point.
 */
function byLatestDate(left, right) {
  return String(right.date).slice(0, 10) >= String(left.date).slice(0, 10) ? right : left;
}

export const ActivityDetailsModal = {
  /**
   * Opens the record modal for logging a new session against the selected day.
   *
   * The rest-day guard lives here rather than in each caller, so every route to
   * recording — the library, the details modal, the record form's own tile —
   * refuses a rest day the same way.
   * @param {string} activityId - The activity ID
   */
  open(activityId) {
    const activity = getActivity(activityId);
    if (!activity) return;

    const iso = getLocalISODate(getState().fitnessSelectedDate || new Date().toISOString());
    if (isRestDay(iso)) {
      showConfirm({
        title: 'Rest Day',
        message: 'Unable to record activity as selected day is a rest day.',
        okText: 'OK',
        cancelText: '',
        onOK: () => {},
      });
      return;
    }

    const category = getActivityCategory(activity.categoryId);
    this._populateActivityInfo(activity, category);
    this._setupTrackingSection(activity);
    this._storeActivityId(activityId);
    // A previous visit may have left edit state behind; without clearing it the
    // next save would overwrite that record instead of creating a new one.
    this._clearEditState();

    // Set up event handlers BEFORE opening the modal
    this._setupEventHandlers();

    // Reset form AFTER storing activity ID
    this._resetForm();

    // Show modal using common modal system
    openModal('activity-details-modal');
  },

  /**
   * Drops the edit-mode markers left by openWithRecord().
   * @private
   */
  _clearEditState() {
    const modal = document.getElementById('activity-details-modal');
    if (!modal) return;
    delete modal.dataset.recordId;
    modal.dataset.editMode = 'false';
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
    // Reset first: a record added from the + picker carries no sets, and without
    // a clean form the sets section would show whatever the last visit left in
    // the DOM — or nothing at all to type into.
    this._resetForm();
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

    this._renderHighlights(activity);
  },

  /**
   * Shows what this activity has been hit at before: the best figure and the
   * most recent one, so the user has something to aim at without leaving the
   * form. Hidden entirely until there is history to show.
   * @private
   */
  _renderHighlights(activity) {
    const host = document.getElementById('activity-details-highlights');
    if (!host) return;

    const { points, unit } = extractProgressionSeries(activity);
    const usable = points.filter((point) => point.value > 0);
    if (usable.length === 0) {
      host.classList.add('hidden');
      return;
    }

    const best = bestValue(usable.map((point) => point.value), activity);

    // "Last" means the most recent day this was actually trained, not whichever
    // entry happened to be typed last. Records are ordered by the timestamp they
    // were entered, which is a different thing entirely once you backfill a day
    // — and a session dated ahead of today has not happened yet.
    const today = getLocalISODate(new Date());
    const past = usable.filter((point) => String(point.date).slice(0, 10) <= today);
    const latest = past.length > 0 ? past.reduce(byLatestDate) : usable.reduce(byLatestDate);
    const suffix = unit && unit !== 'none' ? ` ${unit}` : '';
    const format = (value) => `${Number(value.toFixed(2))}${suffix}`;

    const bestEl = document.getElementById('activity-details-best');
    if (bestEl) bestEl.textContent = format(best);

    const lastEl = document.getElementById('activity-details-last');
    if (lastEl) lastEl.textContent = format(latest.value);

    const lastLabel = document.getElementById('activity-details-last-label');
    if (lastLabel) {
      const on = shortDateLabel(latest.date);
      lastLabel.textContent = on ? `Last · ${on}` : 'Last';
    }

    host.classList.remove('hidden');
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
    saveBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this._handleSave();
    });
  },

  /**
   * Binds cancel button handler
   * @private
   */
  _bindCancelHandler() {
    const cancelBtn = document.getElementById('cancel-activity-details');
    cancelBtn?.addEventListener('click', () => {
      closeModal('activity-details-modal');
    });
  },

  /**
   * Sends the user from the record form to the activity's details view. When the
   * details modal is the surface they arrived from, closing this one is enough —
   * reopening it would stack a second copy underneath.
   * @private
   */
  _bindInfoTileHandler() {
    const tile = document.getElementById('activity-details-info-tile');
    tile?.addEventListener('click', async () => {
      const modal = document.getElementById('activity-details-modal');
      const activityId = modal?.dataset.activityId;
      if (!activityId) return;

      const { isModalOpen } = await import('../../../components/Modal.js');
      const alreadyOpen = isModalOpen('activity-info-modal');
      closeModal('activity-details-modal');
      if (alreadyOpen) return;

      const { Modals } = await import('../FitnessModals.js');
      Modals.openActivityInfo(activityId);
    });
  },

  /**
   * Binds sets management handlers
   * @private
   */
  _bindSetsHandlers() {
    // Add set button
    const addSetBtn = document.getElementById('add-set-btn');
    addSetBtn?.addEventListener('click', () => {
      const modal = document.getElementById('activity-details-modal');
      const activityId = modal ? modal.dataset.activityId : null;
      if (!activityId) return;

      const activity = getActivity(activityId);
      this._addNewSet(activity?.units || 'none');
    });

    // Remove set buttons (delegated)
    const setsContainer = document.getElementById('sets-container');
    setsContainer?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.remove-set-btn');
      if (removeBtn) this._removeSet(removeBtn.dataset.setId);
    });
  },

  /**
   * Handles saving the activity record
   * @private
   */
  async _handleSave() {
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
    const { getLocalISODate } = await import('../../../shared/datetime.js');
    const selectedDate = getState().fitnessSelectedDate || new Date().toISOString();
    const dateString = getLocalISODate(selectedDate); // Use consistent date conversion

    let saved;
    if (isEdit && recordId) {
      // Update existing record
      saved = await updateRecordedActivity(recordId, dateString, recordData);
    } else {
      // Create new record
      saved = await recordActivity(activityId, dateString, recordData);
    }
    if (!saved) return;

    closeModal('activity-details-modal');

    // Trigger activity list refresh
    const event = new CustomEvent('ActivityRecorded', {
      detail: { activityId, recordData },
    });
    document.dispatchEvent(event);
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

      const numericDuration = Number(duration);
      if (duration && duration.trim() !== '' && Number.isFinite(numericDuration) && numericDuration > 0) {
        recordData.duration = numericDuration;
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
      if (Number.isFinite(reps) && reps > 0) {
        const set = { reps, unit };
        if (Number.isFinite(value) && value > 0) set.value = value;
        sets.push(set);
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

    // One table row. The column widths match the header in index.html, and the
    // inputs keep the same look as before, only shorter and without their own
    // labels — the table header names the columns once.
    const setElement = document.createElement('div');
    setElement.className = 'set-item grid items-center gap-2';
    setElement.style.gridTemplateColumns = SET_ROW_COLUMNS;
    setElement.dataset.setId = setId;

    const field =
      'w-full px-2 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-ios-blue/50 h-9 text-center';

    setElement.innerHTML = `
      <span class="set-label text-sm font-medium text-gray-700 dark:text-gray-300">Set ${setNumber}</span>
      <input type="number" name="reps-${setId}" min="1" max="999" placeholder="12" aria-label="Set ${setNumber} reps" class="${field}">
      <input type="number" name="value-${setId}" min="0" step="0.1" placeholder="50" aria-label="Set ${setNumber} value" class="${field}">
      <select name="unit-${setId}" aria-label="Set ${setNumber} unit" class="${field} px-1" style="text-align: center; text-align-last: center;">
        <option value="none" ${defaultUnit === 'none' ? 'selected' : ''}>None</option>
        <option value="kg" ${defaultUnit === 'kg' ? 'selected' : ''}>Kg</option>
        <option value="seconds" ${defaultUnit === 'seconds' ? 'selected' : ''}>s</option>
        <option value="minutes" ${defaultUnit === 'minutes' ? 'selected' : ''}>Mins</option>
      </select>
      <button type="button" class="remove-set-btn flex items-center justify-center text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 disabled:opacity-0 disabled:pointer-events-none" data-set-id="${setId}" aria-label="Remove set ${setNumber}"${setNumber === 1 ? ' disabled' : ''}>
        <span class="material-icons text-base">delete</span>
      </button>
    `;

    // Removal is handled by the delegated listener on #sets-container. Binding
    // the button here as well fired _removeSet twice for one click, and since
    // the first call renumbers the rows the second one took a second row with it.
    setsContainer.appendChild(setElement);
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
      const label = setElement.querySelector('.set-label');
      if (label) label.textContent = `Set ${setNumber}`;

      // Update input names
      const repsInput = setElement.querySelector('input[name^="reps-"]');
      const valueInput = setElement.querySelector('input[name^="value-"]');
      const unitSelect = setElement.querySelector('select[name^="unit-"]');

      if (repsInput) {
        repsInput.name = `reps-${newSetId}`;
        repsInput.setAttribute('aria-label', `Set ${setNumber} reps`);
      }
      if (valueInput) {
        valueInput.name = `value-${newSetId}`;
        valueInput.setAttribute('aria-label', `Set ${setNumber} value`);
      }
      if (unitSelect) {
        unitSelect.name = `unit-${newSetId}`;
        unitSelect.setAttribute('aria-label', `Set ${setNumber} unit`);
      }

      // The first row keeps its button as a spacer so the columns stay aligned;
      // disabling hides it without collapsing the grid.
      const removeBtn = setElement.querySelector('.remove-set-btn');
      if (removeBtn) {
        removeBtn.dataset.setId = newSetId;
        removeBtn.disabled = setNumber === 1;
        removeBtn.setAttribute('aria-label', `Remove set ${setNumber}`);
      }
    });
  },

  /**
   * Sets up all modal event handlers, once for the page's lifetime.
   *
   * Guarded on the modal element rather than per button: these all attach to
   * markup in index.html that outlives every open, so rebinding on each open
   * stacked a listener per visit — which is why "Add set" grew a row for every
   * time the modal had been opened.
   */
  _setupEventHandlers() {
    const modal = document.getElementById('activity-details-modal');
    if (!modal || modal.dataset.listenerAttached) return;

    this._bindSaveHandler();
    this._bindCancelHandler();
    this._bindSetsHandlers();
    this._bindInfoTileHandler();

    modal.dataset.listenerAttached = 'true';
  },
};
