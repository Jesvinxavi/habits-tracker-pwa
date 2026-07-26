// ActivityPickerModal.js - Multi-select activities to record for the selected day
import { closeModal, openModal, topModalId } from '../../../components/Modal.js';
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

const MODAL_ID = 'activity-picker-modal';

/**
 * ActivityPickerModal - the + dropdown's "Add activity" surface.
 *
 * Deliberately not the Activity Library: there are no stats or edit buttons and
 * tapping a tile selects it rather than recording immediately, so several
 * activities can be added in one go.
 */
export const ActivityPickerModal = {
  _selectedIds: [],
  _onConfirm: null,

  /**
   * Opens the picker with an empty selection.
   * @param {Object} [options] - Open options
   * @param {Function} [options.onConfirm] - Receives the ordered selected activity ids
   * @returns {void}
   */
  open({ onConfirm = null } = {}) {
    this._bindStaticHandlers();
    this._selectedIds = [];
    this._onConfirm = onConfirm;

    const filter = document.getElementById('activity-picker-filter');
    if (filter) filter.value = '';
    this._render('');
    this._updateCount();
    openModal(MODAL_ID);
  },

  /**
   * Closes the picker.
   * @returns {void}
   */
  close() {
    closeModal(MODAL_ID);
  },

  /**
   * Renders the grouped selectable list.
   * @param {string} query - Filter text
   * @returns {void}
   */
  _render(query = '') {
    const list = document.getElementById('activity-picker-list');
    if (!list) return;

    let html = '';
    const section = (category, activities) =>
      category.id === 'strength'
        ? buildSelectableCategorySection(
            category,
            null,
            this._selectedIds,
            groupActivitiesByMuscleGroup(activities),
            'pick-category'
          )
        : buildSelectableCategorySection(
            category,
            activities,
            this._selectedIds,
            null,
            'pick-category'
          );

    if (query.trim() === '') {
      Object.values(getActivitiesByCategory()).forEach(({ category, activities }) => {
        if (activities.length === 0) return;
        html += section(category, activities);
      });
    } else {
      const grouped = {};
      searchActivities(query).forEach((activity) => {
        const category = getActivityCategory(activity.categoryId);
        if (!category) return;
        if (!grouped[category.id]) grouped[category.id] = { category, activities: [] };
        grouped[category.id].activities.push(activity);
      });
      Object.values(grouped).forEach(({ category, activities }) => {
        html += section(category, activities);
      });
    }

    if (html === '') {
      html =
        query.trim() === ''
          ? `
        <div class="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <span class="material-icons text-4xl text-gray-400">fitness_center</span>
          <p class="text-gray-600 dark:text-gray-400">No activities available</p>
          <p class="text-sm text-gray-500">Create an activity from the Activity button first.</p>
        </div>
      `
          : `
        <div class="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <span class="material-icons text-4xl text-gray-400">search_off</span>
          <p class="text-gray-600 dark:text-gray-400">No activities found</p>
        </div>
      `;
    }

    list.innerHTML = html;
    bindSelectableTileEvents(list, (activityId) => this._toggle(activityId));
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

    // Re-render so indicators update; the filter value is preserved, so
    // narrowing the list never drops a selection.
    this._render(document.getElementById('activity-picker-filter')?.value || '');
    this._updateCount();
  },

  /**
   * Updates the counter and the Add button's enabled state.
   * @returns {void}
   */
  _updateCount() {
    const counter = document.getElementById('activity-picker-count');
    if (counter) counter.textContent = `${this._selectedIds.length} selected`;

    const confirmBtn = document.getElementById('confirm-activity-picker');
    if (!confirmBtn) return;
    const enabled = this._selectedIds.length > 0;
    confirmBtn.disabled = !enabled;
    confirmBtn.classList.toggle('opacity-50', !enabled);
  },

  /**
   * Hands the selection back, dropping ids whose activity has been deleted.
   * @returns {void}
   */
  _handleConfirm() {
    const selected = this._selectedIds.filter((id) => Boolean(getActivity(id)));
    if (selected.length === 0) return;
    closeModal(MODAL_ID);
    this._onConfirm?.(selected);
  },

  /**
   * Binds handlers to markup that lives for the page's lifetime.
   * @returns {void}
   */
  _bindStaticHandlers() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.dataset.listenerAttached) return;

    const filter = document.getElementById('activity-picker-filter');
    filter?.addEventListener('input', (event) => this._render(event.target.value));

    document.getElementById('confirm-activity-picker')?.addEventListener('click', () => {
      this._handleConfirm();
    });

    document.getElementById('cancel-activity-picker')?.addEventListener('click', () => {
      this.close();
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.close();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (topModalId() !== MODAL_ID) return;
      event.preventDefault();
      this.close();
    });

    modal.dataset.listenerAttached = 'true';
  },
};
