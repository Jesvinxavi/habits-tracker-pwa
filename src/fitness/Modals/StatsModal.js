// StatsModal.js - Statistics modal for displaying activity statistics
import { getActivityCategory } from '../../utils/activities.js';
import { calculateActivityStatistics, buildStatsContent } from '../helpers/activityStats.js';

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
    this._showModal();
  },

  /**
   * Gets activity by ID (placeholder - should use proper selector)
   * @private
   */
  _getActivity(activityId) {
    // This should use a proper selector from the state management
    return window.appData?.activities?.find((a) => a.id === activityId);
  },

  /**
   * Creates the modal HTML and adds it to the document
   * @private
   */
  _createModal(activity, stats, category) {
    const modalHTML = `
      <div id="activity-stats-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
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
    const existingModal = document.getElementById('activity-stats-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  },

  /**
   * Binds close event handlers
   * @private
   */
  _bindCloseHandlers() {
    const modal = document.getElementById('activity-stats-modal');
    const closeIcon = document.getElementById('close-stats-modal');

    const closeModal = () => {
      if (modal) {
        modal.classList.add('hidden');
        setTimeout(() => modal.remove(), 300);
      }
    };

    if (closeIcon) closeIcon.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }
  },

  /**
   * Shows the modal
   * @private
   */
  _showModal() {
    const modal = document.getElementById('activity-stats-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  },
};
