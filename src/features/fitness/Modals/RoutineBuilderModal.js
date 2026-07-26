// RoutineBuilderModal.js - Name a routine and multi-select the activities in it
import { closeModal, openModal, topModalId } from '../../../components/Modal.js';
import { showConfirm } from '../../../components/ConfirmDialog.js';
import {
  buildSelectableCategorySection,
  bindSelectableTileEvents,
} from '../ActivityLibrary/SelectableActivityTile.js';
import {
  getActivitiesByCategory,
  searchActivities,
  getActivity,
  getActivityCategory,
  groupActivitiesByMuscleGroup,
} from '../activities.js';
import { addRoutine, updateRoutine, deleteRoutine, getRoutine, getRoutineActivities } from '../routines.js';

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
    this._bindStaticHandlers();
    this._editRoutineId = null;
    this._onSaved = onSaved;
    // Filter presets so ids of deleted activities never enter the selection.
    this._selectedIds = presetActivityIds.filter((id) => Boolean(getActivity(id)));

    this._setTitle(title);
    this._setName(presetName);
    this._setDeleteVisible(false);
    this._resetFilter();
    this._renderPicker('');
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
    this._resetFilter();
    this._renderPicker('');
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
   * @returns {void}
   */
  _resetFilter() {
    const filter = document.getElementById('routine-activity-filter');
    if (filter) filter.value = '';
  },

  /**
   * Renders the grouped selectable activity list.
   * @param {string} query - Filter text
   * @returns {void}
   */
  _renderPicker(query = '') {
    const picker = document.getElementById('routine-activity-picker');
    if (!picker) return;

    let html = '';

    if (query.trim() === '') {
      Object.values(getActivitiesByCategory()).forEach(({ category, activities }) => {
        if (activities.length === 0) return;
        if (category.id === 'strength') {
          html += buildSelectableCategorySection(
            category,
            null,
            this._selectedIds,
            groupActivitiesByMuscleGroup(activities)
          );
        } else {
          html += buildSelectableCategorySection(category, activities, this._selectedIds);
        }
      });
    } else {
      const matches = searchActivities(query);
      const grouped = {};
      matches.forEach((activity) => {
        const category = getActivityCategory(activity.categoryId);
        if (!category) return;
        if (!grouped[category.id]) grouped[category.id] = { category, activities: [] };
        grouped[category.id].activities.push(activity);
      });
      Object.values(grouped).forEach(({ category, activities }) => {
        if (category.id === 'strength') {
          html += buildSelectableCategorySection(
            category,
            null,
            this._selectedIds,
            groupActivitiesByMuscleGroup(activities)
          );
        } else {
          html += buildSelectableCategorySection(category, activities, this._selectedIds);
        }
      });
    }

    if (html === '') {
      html =
        query.trim() === ''
          ? `
        <div class="flex flex-col items-center justify-center py-6 text-center space-y-2">
          <span class="material-icons text-3xl text-gray-400">fitness_center</span>
          <p class="text-sm text-gray-600 dark:text-gray-400">No activities available</p>
          <p class="text-xs text-gray-500">Create an activity before building a routine.</p>
        </div>
      `
          : `
        <div class="flex flex-col items-center justify-center py-6 text-center space-y-2">
          <span class="material-icons text-3xl text-gray-400">search_off</span>
          <p class="text-sm text-gray-600 dark:text-gray-400">No activities found</p>
        </div>
      `;
    }

    picker.innerHTML = html;
    bindSelectableTileEvents(picker, (activityId) => this._toggle(activityId));
  },

  /**
   * Adds or removes an activity from the ordered selection.
   * @param {string} activityId - Activity client id
   * @returns {void}
   */
  _toggle(activityId) {
    const index = this._selectedIds.indexOf(activityId);
    if (index === -1) this._selectedIds.push(activityId);
    else this._selectedIds.splice(index, 1);

    // Re-render so the ring and checkmark reflect the new selection. The filter
    // value is preserved, so filtering never loses selections.
    this._renderPicker(document.getElementById('routine-activity-filter')?.value || '');
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
   * Confirms and deletes the routine being edited.
   * @returns {void}
   */
  _handleDelete() {
    if (!this._editRoutineId) return;
    const routineId = this._editRoutineId;
    showConfirm({
      title: 'Delete Routine?',
      message: 'This routine will be permanently removed. This action cannot be undone.',
      okText: 'Delete',
      cancelText: 'Cancel',
      onOK: async () => {
        const deleted = await deleteRoutine(routineId);
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

    document.getElementById('routine-activity-filter')?.addEventListener('input', (event) => {
      this._renderPicker(event.target.value);
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
