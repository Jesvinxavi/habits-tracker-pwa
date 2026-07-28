// StatsModal.js - Statistics modal for displaying activity statistics
import { getActivityCategory } from '../activities.js';
import { calculateActivityStatistics, buildStatsContent } from '../helpers/activityStats.js';
import { getState } from '../../../core/state.js';
import { closeModal, openModal, topModalId } from '../../../components/Modal.js';

const MODAL_ID = 'activity-stats-modal';

export const StatsModal = {
  /**
   * Opens the statistics modal for an activity
   * @param {string} activityId - The activity ID
   */
  open(activityId) {
    const activity = this._getActivity(activityId);
    if (!activity) return;

    const stats = calculateActivityStatistics(activityId);
    const category = getActivityCategory(activity.categoryId);

    this._createModal(activity, stats, category);
    this._bindCloseHandlers();
    openModal(MODAL_ID);
  },

  /**
   * Gets activity by ID (placeholder - should use proper selector)
   * @private
   */
  _getActivity(activityId) {
    // This should use a proper selector from the state management
    return getState().activities?.find((a) => a.id === activityId);
  },

  /**
   * Creates the modal HTML and adds it to the document
   * @private
   */
  _createModal(activity, stats, category) {
    // z-[1004] rather than the old z-50: this modal is opened from the activity
    // details modal (z-[1002]) and the library beneath it, so anything under
    // that ladder renders behind them and looks like nothing happened.
    const modalHTML = `
      <div id="${MODAL_ID}" class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[1004] hidden">
        <div class="modal-content bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
          <div class="modal-header flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3">
              <div class="activity-icon w-10 h-10 rounded-full flex items-center justify-center text-xl" style="background-color: ${category.color}20; color: ${category.color};">
                ${activity.icon || category.icon}
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${activity.name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">Activity Statistics</p>
              </div>
            </div>
            <button id="close-stats-modal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          
          <div class="modal-body flex-1 overflow-y-auto p-4">
            ${buildStatsContent(activity, stats, category)}
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if present
    const existingModal = document.getElementById(MODAL_ID);
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  /**
   * Closes the modal and takes it back out of the DOM, leaving whichever modal
   * opened it on top of the stack.
   * @returns {void}
   */
  close() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    closeModal(MODAL_ID);
    modal.remove();
  },

  /**
   * Binds close event handlers
   * @private
   */
  _bindCloseHandlers() {
    const modal = document.getElementById(MODAL_ID);
    const closeIcon = document.getElementById('close-stats-modal');

    if (closeIcon) closeIcon.addEventListener('click', () => this.close());
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.close();
      });
    }

    if (!this._escapeBound) {
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (topModalId() !== MODAL_ID) return;
        event.preventDefault();
        this.close();
      });
      this._escapeBound = true;
    }
  },

  _escapeBound: false,
};
