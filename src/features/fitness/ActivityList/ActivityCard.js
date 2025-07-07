// ActivityCard.js - Activity card component with swipe-to-delete functionality
import { hexToRgba } from '../../../shared/color.js';
import { makeCardSwipable } from '../../../components/swipeableCard.js';
import { generateActivityPills } from '../helpers/activityPills.js';

/**
 * ActivityCard component for individual activity records
 */
export const ActivityCard = {
  /**
   * Builds an activity card with swipe-to-delete functionality
   * @param {Object} record - The activity record
   * @param {Object} category - The category object
   * @param {Object} callbacks - Event callbacks
   * @returns {string} HTML string for the activity card
   */
  build(record, category, callbacks = {}) {
    const time = new Date(record.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Generate activity pills based on tracking type
    const pillsMarkup = generateActivityPills(record, category);

    // DOM structure mirrors habit cards for consistency:
    // swipe-container → restore-btn (hidden delete action) + swipe-slide → activity-card
    return `
      <div class="swipe-container relative overflow-visible" data-record-id="${record.id}">
        <button class="restore-btn absolute top-0 right-0 h-full bg-red-600 text-white font-semibold rounded-xl w-1/5 touch-manipulation" aria-label="Delete ${record.activityName} activity">Delete</button>
        <div class="swipe-slide transition-transform bg-white dark:bg-gray-800 rounded-xl w-full relative z-1 touch-pan-y">
          <div class="activity-card relative flex items-start px-3 py-2 rounded-xl w-full mb-0" style="border: 3px solid ${category.color}; background-color: ${hexToRgba(category.color, 0.05)};">
            <div class="activity-icon w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center mr-3 text-xl" style="border: 2px solid ${category.color}; color: ${category.color};" aria-hidden="true">
              ${category.icon}
            </div>
            <div class="activity-content flex-grow text-left">
              <div class="activity-name font-semibold leading-tight text-gray-900 dark:text-white mb-1">${record.activityName}</div>
              ${record.notes ? `<div class="activity-notes text-xs text-gray-500 dark:text-gray-400 my-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit max-w-full">${record.notes}</div>` : ''}
              ${pillsMarkup}
            </div>
            <!-- Time placed absolutely so it doesn't restrict content width -->
            <div class="activity-meta absolute top-2 right-3 text-xs text-gray-500 dark:text-gray-400" aria-label="Activity recorded at ${time}">${time}</div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Binds events for activity cards including swipe behavior
   * @param {HTMLElement} container - The activities container
   * @param {Array} activities - Array of all activities for the day
   * @param {Object} callbacks - Event callbacks
   */
  bindEvents(container, activities, callbacks = {}) {
    if (!container) return;

    // Attach swipe behavior to each activity card using shared swipeableCard helper
    // This provides the same swipe-to-delete interaction as habit cards on the home page
    container.querySelectorAll('.swipe-container').forEach((swipeContainer) => {
      const slideEl = swipeContainer.querySelector('.swipe-slide');
      const recordId = swipeContainer.dataset.recordId;
      const record = activities.find((a) => a.id === recordId);

      if (slideEl && record) {
        // Use shared makeCardSwipable helper for consistent behavior across views
        makeCardSwipable(swipeContainer, slideEl, record, {
          onRestore: () => {
            // Delete the activity record and refresh the list
            if (callbacks.onActivityDelete) {
              callbacks.onActivityDelete(recordId);
            }
          },
        });

        // Add click functionality to open activity details modal with existing data
        const activityCard = slideEl.querySelector('.activity-card');
        if (activityCard && record.activityId) {
          activityCard.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (callbacks.onActivityClick) {
              callbacks.onActivityClick(record.activityId, record);
            }
          });
          activityCard.style.cursor = 'pointer';
        }
      }
    });
  },
};
