// SelectableActivityTile.js - Multi-select variant of the category/activity list
import { buildMuscleGroupHeader } from '../helpers/muscleHelpers.js';
import { hexToRgba } from '../../../shared/color.js';

/**
 * Builds a category section whose tiles are selection targets instead of
 * record/stats/edit targets. Visual structure matches buildCategorySection().
 * @param {Object} category - The category object
 * @param {Array|null} activities - Activities for a regular category
 * @param {string[]} selectedIds - Currently selected activity ids
 * @param {Object|null} muscleGroups - Activities grouped by muscle group (strength only)
 * @param {string} [idPrefix] - Section id prefix, so two pickers can be in the DOM at once
 * @returns {string} HTML string for the selectable category section
 */
export function buildSelectableCategorySection(
  category,
  activities = null,
  selectedIds = [],
  muscleGroups = null,
  idPrefix = 'select-category'
) {
  const categoryId = `${idPrefix}-${category.id}`;

  let activitiesContent = '';

  if (muscleGroups) {
    activitiesContent = Object.entries(muscleGroups)
      .map(
        ([mg, list]) => `
      <div class="muscle-group mb-2">
        ${buildMuscleGroupHeader(mg)}
        <div class="category-activities pl-2 mt-0.5">
          ${list.map((activity) => buildSelectableTile(activity, category, selectedIds)).join('')}
        </div>
      </div>
    `
      )
      .join('');
  } else if (activities) {
    activitiesContent = `
      <div class="category-activities pl-2 mt-0.5">
        ${activities.map((activity) => buildSelectableTile(activity, category, selectedIds)).join('')}
      </div>
    `;
  }

  return `
    <div class="search-category-section mb-4" data-category-id="${category.id}" id="${categoryId}">
      <div class="flex items-center gap-2">
        <div class="search-category-header flex items-center justify-between px-4 py-2 rounded-xl select-none flex-grow" style="background:${hexToRgba(category.color, 0.25)};">
          <div class="category-title flex items-center gap-2">
            <span class="text-base" aria-hidden="true">${category.icon}</span>
            <span class="font-semibold text-base leading-none text-gray-900 dark:text-white">${category.name}</span>
          </div>
        </div>
      </div>
      <div class="search-category-content mt-0.5">
        ${activitiesContent}
      </div>
    </div>
  `;
}

/**
 * Builds a single selectable activity tile.
 * @param {Object} activity - The activity object
 * @param {Object} category - The category object
 * @param {string[]} selectedIds - Currently selected activity ids
 * @returns {string} HTML string for the tile
 */
function buildSelectableTile(activity, category, selectedIds) {
  const isSelected = selectedIds.includes(activity.id);
  const ring = isSelected ? ' ring-2 ring-ios-blue' : '';
  return `
    <div style="margin-bottom: 0.125rem;">
      <div class="selectable-activity-item activity-card flex items-center px-3 py-2 rounded-xl w-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ios-blue focus:ring-offset-2 dark:focus:ring-offset-gray-800${ring}" style="border: 2.5px solid ${category.color}; background-color: ${hexToRgba(category.color, 0.05)};" data-activity-id="${activity.id}" role="checkbox" aria-checked="${isSelected}" tabindex="0">
        <div class="activity-icon w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center mr-3 text-xl" style="background-color: ${category.color}20;" aria-hidden="true">
          ${activity.icon || category.icon}
        </div>
        <div class="activity-content flex-grow text-left min-w-0">
          <div class="activity-name font-semibold leading-tight text-gray-900 dark:text-white truncate">${activity.name}</div>
        </div>
        <span class="selection-indicator w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3"
              style="border-color:${category.color};${isSelected ? `background-color:${category.color};` : ''}">
          <span class="material-icons text-base text-white" style="display:${isSelected ? 'block' : 'none'};">check</span>
        </span>
      </div>
    </div>
  `;
}

/**
 * Binds selection toggling to every tile in a container.
 * @param {HTMLElement} container - Container holding the rendered tiles
 * @param {Function} onToggle - Called with the activity id when a tile is activated
 * @returns {void}
 */
export function bindSelectableTileEvents(container, onToggle) {
  if (!container || !onToggle) return;

  container.querySelectorAll('.selectable-activity-item').forEach((item) => {
    item.addEventListener('click', () => {
      onToggle(item.dataset.activityId);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onToggle(item.dataset.activityId);
    });
  });
}
