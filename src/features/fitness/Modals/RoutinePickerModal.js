// RoutinePickerModal.js - Pick a saved routine to record for the selected day
import { closeModal, openModal, topModalId } from '../../../components/Modal.js';
import { getRoutines, getRoutineActivities } from '../routines.js';
import { RoutineBuilderModal } from './RoutineBuilderModal.js';

const MODAL_ID = 'routine-picker-modal';

/**
 * RoutinePickerModal - a read-only routine list whose cards record the routine.
 */
export const RoutinePickerModal = {
  _onPick: null,

  /**
   * Opens the picker.
   * @param {Object} [options] - Open options
   * @param {Function} [options.onPick] - Called with the chosen routine id
   * @returns {void}
   */
  open({ onPick = null } = {}) {
    this._onPick = onPick;
    this._bindStaticHandlers();
    this._render();
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
        return `
        <div class="routine-card flex items-center px-3 py-3 rounded-xl w-full bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600" data-routine-id="${routine.id}" tabindex="0">
          <div class="w-9 h-9 flex-shrink-0 rounded-lg bg-ios-blue/10 flex items-center justify-center mr-3">
            <span class="material-icons text-ios-blue text-xl">repeat</span>
          </div>
          <div class="flex-grow text-left min-w-0">
            <div class="font-semibold leading-tight text-gray-900 dark:text-white truncate">${routine.name}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${count} ${count === 1 ? 'activity' : 'activities'}</div>
          </div>
        </div>
      `;
      })
      .join('');

    list.querySelectorAll('.routine-card').forEach((card) => {
      const pick = () => {
        const routineId = card.dataset.routineId;
        closeModal(MODAL_ID);
        this._onPick?.(routineId);
      };
      card.addEventListener('click', pick);
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        pick();
      });
    });
  },

  /**
   * Binds handlers to markup that lives for the page's lifetime.
   * @returns {void}
   */
  _bindStaticHandlers() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.dataset.listenerAttached) return;

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
