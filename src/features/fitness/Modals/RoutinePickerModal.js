// RoutinePickerModal.js - Multi-select routines to record for the selected day
import { closeModal, openModal, topModalId } from '../../../components/Modal.js';
import { getRoutines, getRoutineActivities, getRoutine } from '../routines.js';
import { RoutineBuilderModal } from './RoutineBuilderModal.js';

const MODAL_ID = 'routine-picker-modal';
const INDICATOR_COLOR = '#0060C7';

/**
 * RoutinePickerModal - the + dropdown's "Add routine" surface. Selecting one or
 * more routines records every activity in them for the selected day.
 */
export const RoutinePickerModal = {
  _selectedIds: [],
  _onConfirm: null,

  /**
   * Opens the picker with an empty selection.
   * @param {Object} [options] - Open options
   * @param {Function} [options.onConfirm] - Receives the ordered selected routine ids
   * @returns {void}
   */
  open({ onConfirm = null } = {}) {
    this._bindStaticHandlers();
    this._selectedIds = [];
    this._onConfirm = onConfirm;
    this._render();
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
   * Renders the routine cards, or an empty state that offers to create one.
   * @returns {void}
   */
  _render() {
    const list = document.getElementById('routine-picker-list');
    if (!list) return;

    const routines = getRoutines();

    if (routines.length === 0) {
      list.innerHTML = `
        <div class="flex flex-col items-center justify-center py-10 text-center space-y-3">
          <span class="material-icons text-4xl text-gray-400">repeat</span>
          <p class="text-gray-600 dark:text-gray-400 font-medium">No routines saved</p>
          <button id="picker-create-routine-btn" class="py-2 px-4 bg-ios-blue/10 text-ios-blue rounded-xl font-semibold hover:bg-ios-blue/20 transition-colors">
            Create a routine
          </button>
        </div>
      `;
      list.querySelector('#picker-create-routine-btn')?.addEventListener('click', () => {
        closeModal(MODAL_ID);
        RoutineBuilderModal.openCreateMode();
      });
      return;
    }

    list.innerHTML = routines
      .map((routine) => {
        const count = getRoutineActivities(routine.id).length;
        const isSelected = this._selectedIds.includes(routine.id);
        const ring = isSelected ? ' ring-2 ring-ios-blue' : '';
        return `
        <div class="routine-card selectable-routine-item flex items-center px-3 py-3 rounded-xl w-full bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600${ring}" data-routine-id="${routine.id}" role="checkbox" aria-checked="${isSelected}" tabindex="0">
          <div class="w-9 h-9 flex-shrink-0 rounded-lg bg-ios-blue/10 flex items-center justify-center mr-3">
            <span class="material-icons text-ios-blue text-xl">repeat</span>
          </div>
          <div class="flex-grow text-left min-w-0">
            <div class="font-semibold leading-tight text-gray-900 dark:text-white truncate">${routine.name}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${count} ${count === 1 ? 'activity' : 'activities'}</div>
          </div>
          <span class="selection-indicator w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3"
                style="border-color:${INDICATOR_COLOR};${isSelected ? `background-color:${INDICATOR_COLOR};` : ''}">
            <span class="material-icons text-base text-white" style="display:${isSelected ? 'block' : 'none'};">check</span>
          </span>
        </div>
      `;
      })
      .join('');

    list.querySelectorAll('.selectable-routine-item').forEach((card) => {
      const toggle = () => this._toggle(card.dataset.routineId);
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
      });
    });
  },

  /**
   * Adds or removes a routine from the ordered selection.
   * @param {string} routineId - Routine client id
   * @returns {void}
   */
  _toggle(routineId) {
    const index = this._selectedIds.indexOf(routineId);
    if (index === -1) this._selectedIds.push(routineId);
    else this._selectedIds.splice(index, 1);
    this._render();
    this._updateCount();
  },

  /**
   * Updates the counter and the Add button's enabled state.
   * @returns {void}
   */
  _updateCount() {
    const counter = document.getElementById('routine-picker-count');
    if (counter) counter.textContent = `${this._selectedIds.length} selected`;

    const confirmBtn = document.getElementById('confirm-routine-picker');
    if (!confirmBtn) return;
    const enabled = this._selectedIds.length > 0;
    confirmBtn.disabled = !enabled;
    confirmBtn.classList.toggle('opacity-50', !enabled);
  },

  /**
   * Hands the selection back, dropping routines that have since been deleted.
   * @returns {void}
   */
  _handleConfirm() {
    const selected = this._selectedIds.filter((id) => Boolean(getRoutine(id)));
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

    document.getElementById('confirm-routine-picker')?.addEventListener('click', () => {
      this._handleConfirm();
    });

    document.getElementById('cancel-routine-picker')?.addEventListener('click', () => {
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
