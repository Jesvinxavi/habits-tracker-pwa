// RoutinesModal.js - Lists saved routines with create and edit affordances
import { closeModal, openModal, topModalId } from '../../../components/Modal.js';
import { getRoutines, getRoutineActivities } from '../routines.js';
import { RoutineBuilderModal } from './RoutineBuilderModal.js';

const MODAL_ID = 'routines-modal';

/**
 * RoutinesModal - the saved-routine list behind the Routines button.
 *
 * Laid out like the activity library: create sits in the header, and an
 * always-visible search narrows the list in place.
 */
export const RoutinesModal = {
  /**
   * Opens the routines list, with the search cleared.
   * @returns {void}
   */
  open() {
    this._bindStaticHandlers();
    const filter = document.getElementById('routines-filter');
    if (filter) filter.value = '';
    this._toggleClearButton('');
    this._render();
    openModal(MODAL_ID);
  },

  /**
   * Closes the routines list.
   * @returns {void}
   */
  close() {
    closeModal(MODAL_ID);
  },

  /**
   * @returns {string} The current search text.
   */
  _currentQuery() {
    return document.getElementById('routines-filter')?.value || '';
  },

  /**
   * Shows the clear button only when the search holds text.
   * @param {string} value - Current search value
   * @returns {void}
   */
  _toggleClearButton(value) {
    document.getElementById('routines-filter-clear')?.classList.toggle('hidden', value.length === 0);
  },

  /**
   * Renders the routine cards, or the empty state.
   * @returns {void}
   */
  _render() {
    const list = document.getElementById('routines-list');
    if (!list) return;

    const query = this._currentQuery().trim().toLowerCase();
    const all = getRoutines();
    const routines = query
      ? all.filter((routine) => routine.name.toLowerCase().includes(query))
      : all;

    if (routines.length === 0) {
      // Two different empty states: nothing saved yet, or nothing matching.
      list.innerHTML = query
        ? `
        <div class="flex flex-col items-center justify-center py-10 text-center space-y-2">
          <span class="material-icons text-4xl text-gray-400">search_off</span>
          <p class="text-gray-600 dark:text-gray-400 font-medium">No routines match "${query}"</p>
        </div>
      `
        : `
        <div class="flex flex-col items-center justify-center py-10 text-center space-y-2">
          <span class="material-icons text-4xl text-gray-400">repeat</span>
          <p class="text-gray-600 dark:text-gray-400 font-medium">No routines saved</p>
          <p class="text-sm text-gray-500">Create a new routine to group activities you do together.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = routines
      .map((routine) => {
        // Filtered count, so a routine referencing deleted activities reports honestly.
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
          <button class="edit-routine-btn w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ml-3" data-routine-id="${routine.id}" aria-label="Edit routine">
            <span class="material-icons text-lg">edit</span>
          </button>
        </div>
      `;
      })
      .join('');

    this._bindCardEvents(list);
  },

  /**
   * Binds the per-card handlers after each render.
   * @param {HTMLElement} list - The rendered list container
   * @returns {void}
   */
  _bindCardEvents(list) {
    list.querySelectorAll('.edit-routine-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        this._openEditor(btn.dataset.routineId);
      });
    });

    // The card itself is the edit affordance.
    list.querySelectorAll('.routine-card').forEach((card) => {
      card.addEventListener('click', () => this._openEditor(card.dataset.routineId));
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this._openEditor(card.dataset.routineId);
      });
    });
  },

  /**
   * Opens the builder in edit mode and refreshes this list afterwards.
   * @param {string} routineId - Routine client id
   * @returns {void}
   */
  _openEditor(routineId) {
    RoutineBuilderModal.openEditMode(routineId, { onSaved: () => this._render() });
  },

  /**
   * Binds handlers to markup that lives for the page's lifetime.
   * @returns {void}
   */
  _bindStaticHandlers() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal || modal.dataset.listenerAttached) return;

    document.getElementById('new-routine-btn')?.addEventListener('click', () => {
      RoutineBuilderModal.openCreateMode({ onSaved: () => this._render() });
    });

    document.getElementById('close-routines-modal')?.addEventListener('click', () => {
      this.close();
    });

    const filter = document.getElementById('routines-filter');
    filter?.addEventListener('input', () => {
      this._toggleClearButton(filter.value);
      this._render();
    });

    document.getElementById('routines-filter-clear')?.addEventListener('click', () => {
      if (filter) filter.value = '';
      this._toggleClearButton('');
      this._render();
      filter?.focus();
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.close();
    });

    // Escape closes this modal only when it is the topmost one.
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (topModalId() !== MODAL_ID) return;
      event.preventDefault();
      this.close();
    });

    modal.dataset.listenerAttached = 'true';
  },
};
