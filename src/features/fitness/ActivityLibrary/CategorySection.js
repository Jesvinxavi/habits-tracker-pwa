// CategorySection.js - Category section with expand/collapse functionality
import { buildMuscleGroupHeader } from '../helpers/muscleHelpers.js';
import { hexToRgba } from '../../../shared/color.js';
import { escapeAttribute, escapeHtml, normalizeHexColor } from '../../../shared/sanitize.js';
import { bindCategoryDisclosureEvents } from './CategoryDisclosure.js';

/**
 * Builds a category section with collapsible header and activities
 * @param {Object} category - The category object
 * @param {Array} activities - Array of activities (null for muscle group mode)
 * @param {Object} muscleGroups - Grouped activities by muscle group (null for regular mode)
 * @param {boolean} [collapsed] - Whether the section starts collapsed
 * @returns {string} HTML string for the category section
 */
export function buildCategorySection(
  category,
  activities = null,
  muscleGroups = null,
  collapsed = false
) {
  const categoryId = `search-category-${category.id}`;
  const safeCategoryId = escapeAttribute(category.id);
  const safeSectionId = escapeAttribute(categoryId);
  const color = normalizeHexColor(category.color);
  const icon = escapeHtml(category.icon || '🎯');
  const name = escapeHtml(category.name || '');
  const nameAttribute = escapeAttribute(category.name || 'category');

  // The chevron's state is class-driven so it follows the same transition clock
  // as the expanding content.
  const expandBtn = `
    <button type="button" class="search-expand-btn h-5 w-5 flex items-center justify-center text-black" data-category-id="${safeCategoryId}" aria-expanded="${!collapsed}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${nameAttribute}">
      <span class="material-icons leading-none">expand_more</span>
    </button>
  `;

  // Build edit button matching habits page style
  const editBtn = `
    <button class="search-edit-category-btn w-8 h-8 rounded-full flex items-center justify-center ml-2" data-category-id="${safeCategoryId}" style="background-color:${color}">
      <span class="material-icons text-white text-lg">edit</span>
    </button>
  `;

  // Build activities content
  let activitiesContent = '';

  if (muscleGroups) {
    // Handle strength training with muscle groups
    activitiesContent = Object.entries(muscleGroups)
      .map(
        ([mg, list]) => `
      <div class="muscle-group mb-2">
        ${buildMuscleGroupHeader(mg)}
        <div class="category-activities pl-2 mt-0.5">
          ${list.map((activity) => buildActivityTile(activity, category)).join('')}
        </div>
      </div>
    `
      )
      .join('');
  } else if (activities) {
    // Handle regular activities
    activitiesContent = `
      <div class="category-activities pl-2 mt-0.5">
        ${activities.map((activity) => buildActivityTile(activity, category)).join('')}
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
          ${expandBtn}
        </div>
        ${editBtn}
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
 * Builds an activity tile for use within category sections
 * @param {Object} activity - The activity object
 * @param {Object} category - The category object
 * @returns {string} HTML string for the activity tile
 */
function buildActivityTile(activity, category) {
  const color = normalizeHexColor(category.color);
  const activityId = escapeAttribute(activity.id);
  const icon = escapeHtml(activity.icon || category.icon || '🎯');
  const name = escapeHtml(activity.name || '');
  // No stats or edit buttons: the whole tile opens the activity's details, and
  // both actions live in there instead.
  return `
    <div style="margin-bottom: 0.125rem;">
      <div class="search-activity-item activity-card flex items-center px-3 py-2 rounded-xl w-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ios-blue" style="border: 2.5px solid ${color}; background-color: ${hexToRgba(color, 0.05)};" data-activity-id="${activityId}" role="button" tabindex="0">
        <div class="activity-icon w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center mr-3 text-xl" style="background-color: ${color}20;" aria-hidden="true">
          ${icon}
        </div>
        <div class="activity-content flex-grow text-left min-w-0">
          <div class="activity-name font-semibold leading-tight text-gray-900 dark:text-white truncate">${name}</div>
        </div>
        <span class="material-icons text-lg text-gray-400 flex-shrink-0 ml-3" aria-hidden="true">chevron_right</span>
      </div>
    </div>
  `;
}

/**
 * Binds event handlers for category sections
 * @param {HTMLElement} content - The search results content container
 * @param {Function} onColorChange - Callback when category color changes
 * @param {Function} [onToggle] - Called with (categoryId, expanded) after a toggle.
 *   Passed explicitly rather than left to a delegated listener, because the
 *   chevron handler stops propagation and a delegated one would never see it.
 */
export function bindCategorySectionEvents(content, onColorChange, onToggle = null) {
  if (!content) return;

  bindCategoryDisclosureEvents(content, onToggle);

  // Category edit buttons
  content.querySelectorAll('.search-edit-category-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onColorChange) {
        onColorChange(btn);
      }
    });
  });
}
