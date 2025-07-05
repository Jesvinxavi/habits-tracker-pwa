// CategoryGroup.js - Category group component with muscle group support
import { formatMuscleName } from '../../utils/common.js';
import { groupActivitiesByMuscleGroup } from '../../utils/activities.js';
import { ActivityCard } from './ActivityCard.js';

/**
 * CategoryGroup component for organizing activities by category
 */
export const CategoryGroup = {
  /**
   * Builds a category group section
   * @param {Object} category - The category object
   * @param {Array} records - Array of activity records
   * @param {Object} callbacks - Event callbacks
   * @returns {string} HTML string for the category group
   */
  build(category, records, callbacks = {}) {
    if (records.length === 0) return '';

    // Special handling for Strength Training – show muscle group sub-headers
    if (category.id === 'strength') {
      const groupedByMG = groupActivitiesByMuscleGroup(records);
      return `
        <div class="category-group mb-4">
          <div class="category-header flex items-center gap-2 px-4 py-2 rounded-t-xl" style="background:${category.color}20;">
            <div class="category-title flex items-center gap-2">
              <span class="text-lg" aria-hidden="true">${category.icon}</span>
              <span class="font-semibold text-gray-900 dark:text-white">${category.name}</span>
            </div>
          </div>
          ${Object.entries(groupedByMG)
            .map(
              ([mg, list]) => `
            <div class="muscle-group mb-2">
              <div class="muscle-header pl-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300">${formatMuscleName(mg)}</div>
              <div class="category-activities pl-6">
                ${list.map((record) => ActivityCard.build(record, category, callbacks)).join('')}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    } else {
      // Regular category group
      return `
        <div class="category-group mb-4" style="overflow: visible;">
          <div class="category-header flex items-center gap-2 px-4 py-2 rounded-t-xl" style="background:${category.color}20;">
            <div class="category-title flex items-center gap-2">
              <span class="text-lg" aria-hidden="true">${category.icon}</span>
              <span class="font-semibold text-gray-900 dark:text-white">${category.name}</span>
            </div>
          </div>
          <div class="category-activities pl-6" style="overflow: visible;">
            ${records
              .map((record) => {
                const item = ActivityCard.build(record, category, callbacks);
                return `<div style="margin-bottom: 0.25rem; overflow: visible;">${item}</div>`;
              })
              .join('')}
          </div>
        </div>
      `;
    }
  },

  /**
   * Binds events for category groups
   * @param {HTMLElement} container - The activities container
   * @param {Array} activities - Array of all activities for the day
   * @param {Object} callbacks - Event callbacks
   */
  bindEvents(container, activities, callbacks = {}) {
    if (!container) return;

    // Bind ActivityCard events
    ActivityCard.bindEvents(container, activities, callbacks);
  },
};
