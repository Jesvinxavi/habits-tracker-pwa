// RoutineBuilderModal.js - Name a routine and multi-select the activities in it
import { closeModal, openModal, topModalId } from '../../../components/Modal.js';
import { showConfirm } from '../../../components/ConfirmDialog.js';
import { hexToRgba } from '../../../shared/color.js';
import { escapeAttribute, escapeHtml, normalizeHexColor } from '../../../shared/sanitize.js';
import { getActivity, getActivityCategory } from '../activities.js';
import { addRoutine, updateRoutine, archiveRoutine, getRoutine, getRoutineActivities } from '../routines.js';
import { ensureFitnessModalMarkup } from '../FitnessModalMarkup.js';

const MODAL_ID = 'routine-builder-modal';

/**
 * RoutineBuilderModal - creates and edits routines. Selection order is routine order.
 */
export const RoutineBuilderModal = {
  _selectedIds: [],
  _editRoutineId: null,
  _onSaved: null,

  /**
   * Opens the builder for a new routine.
   * @param {Object} [options] - Open options
   * @param {string[]} [options.presetActivityIds] - Activities to pre-select, in order
   * @param {string} [options.presetName] - Initial routine name
   * @param {string} [options.title] - Heading text
   * @param {Function} [options.onSaved] - Called after a successful save or delete
   * @returns {void}
   */
  openCreateMode({
    presetActivityIds = [],
    presetName = '',
    title = 'New Routine',
    onSaved = null,
  } = {}) {
    ensureFitnessModalMarkup(MODAL_ID);
    this._bindStaticHandlers();
    this._editRoutineId = null;
    this._onSaved = onSaved;
    // Filter presets so ids of deleted activities never enter the selection.
    this._selectedIds = presetActivityIds.filter((id) => Boolean(getActivity(id)));

    this._setTitle(title);
    this._setName(presetName);
    this._setDeleteVisible(false);
    this._renderSelected();
    this._updateCount();
    this._validate();
    openModal(MODAL_ID);
  },

  /**
   * Opens the builder on an existing routine.
   * @param {string} routineId - Routine client id
   * @param {Object} [options] - Open options
   * @param {Function} [options.onSaved] - Called after a successful save or delete
   * @returns {void}
   */
  openEditMode(routineId, { onSaved = null } = {}) {
    ensureFitnessModalMarkup(MODAL_ID);
    const routine = getRoutine(routineId);
    if (!routine) return;

    this._bindStaticHandlers();
    this._editRoutineId = routineId;
    this._onSaved = onSaved;
    // getRoutineActivities already drops ids whose activity was deleted.
    this._selectedIds = getRoutineActivities(routineId).map((activity) => activity.id);

    this._setTitle('Edit Routine');
    this._setName(routine.name || '');
    this._setDeleteVisible(true);
    this._renderSelected();
    this._updateCount();
    this._validate();
    openModal(MODAL_ID);
  },

  /**
   * Closes the builder.
   * @returns {void}
   */
  close() {
    closeModal(MODAL_ID);
  },

  /**
   * @param {string} text - Heading text
   * @returns {void}
   */
  _setTitle(text) {
    const title = document.getElementById('routine-builder-title');
    if (title) title.textContent = text;
  },

  /**
   * @param {string} value - Routine name
   * @returns {void}
   */
  _setName(value) {
    const input = document.getElementById('routine-name-input');
    if (input) input.value = value;
  },

  /**
   * @returns {string} The trimmed routine name.
   */
  _name() {
    return (document.getElementById('routine-name-input')?.value || '').trim();
  },

  /**
   * @param {boolean} visible - Whether the delete button shows
   * @returns {void}
   */
  _setDeleteVisible(visible) {
    document.getElementById('delete-routine-btn')?.classList.toggle('hidden', !visible);
  },

  /**
   * Renders the chosen activities only. Browsing and selecting happens in the
   * activity picker, reached from the Add activities button.
   * @returns {void}
   */
  _renderSelected() {
    const list = document.getElementById('routine-selected-list');
    if (!list) return;

    if (this._selectedIds.length === 0) {
      list.innerHTML = `
        <div class="flex flex-col items-center justify-center py-6 text-center space-y-1">
          <span class="material-icons text-3xl text-gray-400">fitness_center</span>
          <p class="text-sm text-gray-600 dark:text-gray-400">No activities yet</p>
          <p class="text-xs text-gray-500">Add activities to build this routine.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = this._selectedIds
      .map((activityId, index) => {
        const activity = getActivity(activityId);
        if (!activity) return '';
        const category = getActivityCategory(activity.categoryId);
        const color = normalizeHexColor(category?.color);
        const safeActivityId = escapeAttribute(activityId);
        const safeName = escapeHtml(activity.name);
        return `
        <div class="routine-selected-item flex items-center px-3 py-2 rounded-xl w-full" style="border: 2.5px solid ${color}; background-color: ${hexToRgba(color, 0.05)};" data-activity-id="${safeActivityId}">
          <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 w-4 flex-shrink-0">${index + 1}</span>
          <div class="activity-icon w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center mx-2 text-xl" style="background-color: ${color}20;" aria-hidden="true">
            ${escapeHtml(activity.icon || category?.icon || '')}
          </div>
          <div class="flex-grow text-left min-w-0">
            <div class="font-semibold leading-tight text-gray-900 dark:text-white truncate">${safeName}</div>
          </div>
          <button class="routine-remove-activity w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-2 flex-shrink-0" data-activity-id="${safeActivityId}" aria-label="Remove ${escapeAttribute(activity.name)}">
            <span class="material-icons text-lg">close</span>
          </button>
        </div>
      `;
      })
      .join('');

    list.querySelectorAll('.routine-remove-activity').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        this._remove(btn.dataset.activityId);
      });
    });
  },

  /**
   * Opens the activity picker seeded with the current selection.
   * @returns {void}
   */
  _openActivityPicker() {
    import('./ActivityPickerModal.js').then(({ ActivityPickerModal }) => {
      ActivityPickerModal.open({
        selectedIds: [...this._selectedIds],
        title: 'Select Activities',
        confirmLabel: 'Done',
        onConfirm: (activityIds) => {
          this._selectedIds = activityIds;
          this._renderSelected();
          this._updateCount();
          this._validate();
        },
      });
    });
  },

  /**
   * Removes one activity from the routine.
   * @param {string} activityId - Activity client id
   * @returns {void}
   */
  _remove(activityId) {
    const index = this._selectedIds.indexOf(activityId);
    if (index === -1) return;
    this._selectedIds.splice(index, 1);
    this._renderSelected();
    this._updateCount();
    this._validate();
  },

  /**
   * @returns {void}
   */
  _updateCount() {
    const counter = document.getElementById('routine-selection-count');
    if (counter) counter.textContent = `${this._selectedIds.length} selected`;
  },

  /**
   * Enables Save only with a name and at least one activity.
   * @returns {void}
   */
  _validate() {
    const saveBtn = document.getElementById('save-routine-builder');
    if (!saveBtn) return;
    const valid = this._name().length > 0 && this._selectedIds.length > 0;
    saveBtn.disabled = !valid;
    saveBtn.classList.toggle('opacity-50', !valid);
  },

  /**
   * Persists the routine, keeping the modal open if the durable write fails.
   * @returns {Promise<void>}
   */
  async _handleSave() {
    const name = this._name();
    if (!name || this._selectedIds.length === 0) return;

    const activityIds = [...this._selectedIds];
    const saved = this._editRoutineId
      ? await updateRoutine(this._editRoutineId, { name, activityIds })
      : await addRoutine({ name, activityIds });

    // A falsy result is how the codebase surfaces a failed durable write.
    if (!saved) return;

    closeModal(MODAL_ID);
    this._onSaved?.();
  },

  /**
   * Confirms and archives the routine being edited.
   * @returns {void}
   */
  _handleDelete() {
    if (!this._editRoutineId) return;
    const routineId = this._editRoutineId;
    showConfirm({
      title: 'Delete Routine?',
      message: 'Sessions you have already recorded will be kept.',
      okText: 'Delete',
      cancelText: 'Cancel',
      onOK: async () => {
        const deleted = await archiveRoutine(routineId);
        if (!deleted) return;
        closeModal(MODAL_ID);
        this._onSaved?.();
      },
    });
  },

  /**
   * Binds handlers to markup that lives for the page's lifetime.
   * @returns {void}
   */
  _bindStaticHandlers() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.dataset.listenerAttached) return;

    document.getElementById('routine-name-input')?.addEventListener('input', () => {
      this._validate();
    });

    document.getElementById('routine-add-activities-btn')?.addEventListener('click', () => {
      this._openActivityPicker();
    });

    document.getElementById('save-routine-builder')?.addEventListener('click', () => {
      void this._handleSave();
    });

    document.getElementById('cancel-routine-builder')?.addEventListener('click', () => {
      this.close();
    });

    document.getElementById('delete-routine-btn')?.addEventListener('click', () => {
      this._handleDelete();
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.close();
    });

    // Escape closes only the builder, even with the routines modal behind it.
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (topModalId() !== MODAL_ID) return;
      event.preventDefault();
      this.close();
    });

    modal.dataset.listenerAttached = 'true';
  },
};
