// ActivityCard.js - Activity card component with swipe-to-delete functionality
import { hexToRgba } from '../../../shared/color.js';
import { makeCardSwipable } from '../../../components/swipeableCard.js';
import { generateActivityPills } from '../helpers/activityPills.js';
import { escapeAttribute, escapeHtml, normalizeHexColor } from '../../../shared/sanitize.js';

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

    // Get the activity to access its individual icon
    const activity = callbacks.getActivity ? callbacks.getActivity(record.activityId) : null;
    const activityIcon = escapeHtml(activity?.icon || category.icon || '🎯');
    // The activity is the identity: renaming it renames every session of it,
    // this one included. The record's snapshot is the fallback for a session
    // whose activity is not in state at all.
    const name = activity?.name || record.activityName || '';
    const safeName = escapeHtml(name);
    const safeNameAttribute = escapeAttribute(name);
    const safeNotes = escapeHtml(record.notes || '');
    const color = normalizeHexColor(category.color);
    const recordId = escapeAttribute(record.id);
    // An archived activity keeps its sessions on the day they were done, but
    // there is nothing left to open: the card says so and stops being a tap
    // target. Swiping it away still works — the session is the user's to remove.
    const archived = Boolean(activity?.archivedAt);
    const cardTag = archived ? 'div' : 'button';
    const cardAttributes = archived
      ? ''
      : `type="button" aria-label="Open ${safeNameAttribute} activity details"`;

    // Generate activity pills based on tracking type
    const pillsMarkup = generateActivityPills(record, category, { archived });

    // DOM structure mirrors habit cards for consistency:
    // swipe-container → restore-btn (hidden delete action) + swipe-slide → activity-card
    return `
      <div class="swipe-container relative overflow-visible" data-record-id="${recordId}">
        <button class="restore-btn absolute top-0 right-0 h-full bg-red-600 text-white font-semibold rounded-xl w-1/5 touch-manipulation" aria-label="Delete ${safeNameAttribute} activity">Delete</button>
        <div class="swipe-slide transition-transform bg-white dark:bg-gray-800 rounded-xl w-full relative z-1 touch-pan-y">
          <${cardTag} ${cardAttributes} class="activity-card relative flex items-start px-3 py-2 rounded-xl w-full mb-0" style="border: 3px solid ${color}; background-color: ${hexToRgba(color, 0.05)};">
            <div class="activity-icon w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center mr-3 text-xl" style="background-color: ${color}20;" aria-hidden="true">
              ${activityIcon}
            </div>
            <div class="activity-content flex-grow text-left">
              <div class="activity-name font-semibold leading-tight text-gray-900 dark:text-white mb-1">${safeName}</div>
              ${archived ? '<div class="mb-1"><span class="activity-archived-pill inline-block px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Deleted</span></div>' : ''}
              ${record.notes ? `<div class="activity-notes text-xs text-gray-500 dark:text-gray-400 my-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit max-w-full">${safeNotes}</div>` : ''}
              ${pillsMarkup}
            </div>
            <!-- Time placed absolutely so it doesn't restrict content width -->
            <div class="activity-meta absolute top-2 right-3 text-xs text-gray-500 dark:text-gray-400" aria-label="Activity recorded at ${time}">${time}</div>
          </${cardTag}>
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

        // Add click functionality to open activity details modal with existing
        // data. An archived activity has no details left to show, so its card
        // is left inert rather than opening an empty modal.
        const activityCard = slideEl.querySelector('.activity-card');
        const isArchived = Boolean(
          callbacks.getActivity ? callbacks.getActivity(record.activityId)?.archivedAt : false
        );
        if (activityCard && record.activityId && !isArchived) {
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
