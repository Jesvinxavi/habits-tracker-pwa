// SelectableActivityTile.js - Multi-select variant of the category/activity list
import { buildMuscleGroupHeader } from '../helpers/muscleHelpers.js';
import { hexToRgba } from '../../../shared/color.js';
import { escapeAttribute, escapeHtml, normalizeHexColor } from '../../../shared/sanitize.js';

/**
 * Builds a category section whose tiles are selection targets instead of
 * record/stats/edit targets. Visual structure matches buildCategorySection().
 * @param {Object} category - The category object
 * @param {Array|null} activities - Activities for a regular category
 * @param {string[]} selectedIds - Currently selected activity ids
 * @param {Object|null} muscleGroups - Activities grouped by muscle group (strength only)
 * @param {string} [idPrefix] - Section id prefix, so two pickers can be in the DOM at once
 * @param {boolean} [collapsed] - Whether the category starts collapsed
 * @returns {string} HTML string for the selectable category section
 */
export function buildSelectableCategorySection(
  category,
  activities = null,
  selectedIds = [],
  muscleGroups = null,
  idPrefix = 'select-category',
  collapsed = false
) {
  const categoryId = `${idPrefix}-${category.id}`;
  const safeCategoryId = escapeAttribute(category.id);
  const safeSectionId = escapeAttribute(categoryId);
  const color = normalizeHexColor(category.color);
  const icon = escapeHtml(category.icon || '🎯');
  const name = escapeHtml(category.name || '');
  const nameAttribute = escapeAttribute(category.name || 'category');

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
    <div class="search-category-section is-collapsible mb-4${collapsed ? ' collapsed' : ''}" data-category-id="${safeCategoryId}" id="${safeSectionId}">
      <div class="flex items-center gap-2">
        <div class="search-category-header flex items-center justify-between px-4 py-2 rounded-xl cursor-pointer select-none flex-grow" style="background:${hexToRgba(color, 0.25)};">
          <div class="category-title flex items-center gap-2">
            <span class="text-base" aria-hidden="true">${icon}</span>
            <span class="font-semibold text-base leading-none text-gray-900 dark:text-white">${name}</span>
          </div>
          <button type="button" class="search-expand-btn h-5 w-5 flex items-center justify-center text-black" data-category-id="${safeCategoryId}" aria-expanded="${!collapsed}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${nameAttribute}">
            <span class="material-icons leading-none">expand_more</span>
          </button>
        </div>
      </div>
      <div class="search-category-content mt-0.5" aria-hidden="${collapsed}"${collapsed ? ' inert' : ''}>
        <div class="search-category-content-inner">
          ${activitiesContent}
        </div>
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
  const color = normalizeHexColor(category.color);
  const activityId = escapeAttribute(activity.id);
  const icon = escapeHtml(activity.icon || category.icon || '🎯');
  const name = escapeHtml(activity.name || '');
  // Selection thickens the border inwards rather than adding an outer ring. An
  // outer ring is painted outside the tile, where the picker's vertically
  // scrolling list clips it on the right and it reads as a second, thinner
  // border. An inset shadow stays within the tile's own box on every side.
  const selectedEdge = isSelected ? ` box-shadow: inset 0 0 0 2px ${color};` : '';
  return `
    <div style="margin-bottom: 0.125rem;">
      <div class="selectable-activity-item activity-card flex items-center px-3 py-2 rounded-xl w-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ios-blue" style="border: 2.5px solid ${color}; background-color: ${hexToRgba(color, 0.05)};${selectedEdge}" data-activity-id="${activityId}" role="checkbox" aria-checked="${isSelected}" tabindex="0">
        <div class="activity-icon w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center mr-3 text-xl" style="background-color: ${color}20;" aria-hidden="true">
          ${icon}
        </div>
        <div class="activity-content flex-grow text-left min-w-0">
          <div class="activity-name font-semibold leading-tight text-gray-900 dark:text-white truncate">${name}</div>
        </div>
        <span class="selection-indicator w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3"
              style="border-color:${color};${isSelected ? `background-color:${color};` : ''}">
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
