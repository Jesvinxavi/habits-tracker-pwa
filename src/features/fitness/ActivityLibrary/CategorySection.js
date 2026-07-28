// CategorySection.js - Category section with expand/collapse functionality
import { buildMuscleGroupHeader } from '../helpers/muscleHelpers.js';
import { hexToRgba } from '../../../shared/color.js';

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

  // Build expand/collapse button. The chevron points right while collapsed, the
  // same -90deg rotation toggleSearchCategory animates to.
  const expandBtn = `
    <button class="search-expand-btn h-5 w-5 flex items-center justify-center text-black" data-category-id="${category.id}" aria-expanded="${!collapsed}">
      <span class="material-icons transition-transform leading-none"${collapsed ? ' style="transform: rotate(-90deg);"' : ''}>expand_more</span>
    </button>
  `;

  // Build edit button matching habits page style
  const editBtn = `
    <button class="search-edit-category-btn w-8 h-8 rounded-full flex items-center justify-center ml-2" data-category-id="${category.id}" style="background-color:${category.color}">
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
    <div class="search-category-section mb-4${collapsed ? ' collapsed' : ''}" data-category-id="${category.id}" id="${categoryId}">
      <div class="flex items-center gap-2">
        <div class="search-category-header flex items-center justify-between px-4 py-2 rounded-xl cursor-pointer select-none flex-grow" style="background:${hexToRgba(category.color, 0.25)};">
          <div class="category-title flex items-center gap-2">
            <span class="text-base" aria-hidden="true">${category.icon}</span>
            <span class="font-semibold text-base leading-none text-gray-900 dark:text-white">${category.name}</span>
          </div>
          ${expandBtn}
        </div>
        ${editBtn}
      </div>
      <div class="search-category-content mt-0.5${collapsed ? ' hidden' : ''}">
        ${activitiesContent}
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
  // No stats or edit buttons: the whole tile opens the activity's details, and
  // both actions live in there instead.
  return `
    <div style="margin-bottom: 0.125rem;">
      <div class="search-activity-item activity-card flex items-center px-3 py-2 rounded-xl w-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ios-blue" style="border: 2.5px solid ${category.color}; background-color: ${hexToRgba(category.color, 0.05)};" data-activity-id="${activity.id}">
        <div class="activity-icon w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center mr-3 text-xl" style="background-color: ${category.color}20;" aria-hidden="true">
          ${activity.icon || category.icon}
        </div>
        <div class="activity-content flex-grow text-left min-w-0">
          <div class="activity-name font-semibold leading-tight text-gray-900 dark:text-white truncate">${activity.name}</div>
        </div>
        <span class="material-icons text-lg text-gray-400 flex-shrink-0 ml-3" aria-hidden="true">chevron_right</span>
      </div>
    </div>
  `;
}

/**
 * Toggles category collapse/expand in search section
 * @param {string} categoryId - The category ID to toggle
 */
export function toggleSearchCategory(categoryId) {
  const section = document.querySelector(`#search-category-${categoryId}`);
  if (!section) return;

  const contentDiv = section.querySelector('.search-category-content');
  const iconEl = section.querySelector('.search-expand-btn .material-icons');

  if (!contentDiv || !iconEl) return;

  const isCollapsed = section.classList.contains('collapsed');
  section.querySelector('.search-expand-btn')?.setAttribute('aria-expanded', String(isCollapsed));

  if (isCollapsed) {
    // Expanding
    contentDiv.style.maxHeight = '0px';
    contentDiv.style.overflow = 'hidden';
    contentDiv.classList.remove('hidden');

    // Force reflow
    contentDiv.offsetHeight;

    // Set max height to scroll height for smooth expansion
    contentDiv.style.maxHeight = contentDiv.scrollHeight + 'px';
    iconEl.style.transform = 'rotate(0deg)';
    section.classList.remove('collapsed');

    // Reset max-height after animation completes
    setTimeout(() => {
      if (!section.classList.contains('collapsed')) {
        contentDiv.style.maxHeight = '';
        contentDiv.style.overflow = '';
      }
    }, 300);
  } else {
    // Collapsing
    contentDiv.style.maxHeight = contentDiv.scrollHeight + 'px';
    contentDiv.style.overflow = 'hidden';

    // Force reflow
    contentDiv.offsetHeight;

    // Collapse to 0
    contentDiv.style.maxHeight = '0px';
    iconEl.style.transform = 'rotate(-90deg)';
    section.classList.add('collapsed');

    // Hide after animation completes
    setTimeout(() => {
      if (section.classList.contains('collapsed')) {
        contentDiv.classList.add('hidden');
      }
    }, 300);
  }
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

  /**
   * Toggles a section and reports the resulting state.
   * @param {string} categoryId - The category to toggle
   * @returns {void}
   */
  const toggle = (categoryId) => {
    toggleSearchCategory(categoryId);
    if (!onToggle) return;
    const section = content.querySelector(`#search-category-${categoryId}`);
    onToggle(categoryId, !section?.classList.contains('collapsed'));
  };

  // Category collapse/expand functionality
  content.querySelectorAll('.search-expand-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle(btn.dataset.categoryId);
    });
  });

  content.querySelectorAll('.search-category-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.search-expand-btn') || e.target.closest('.search-edit-category-btn'))
        return;
      toggle(header.closest('.search-category-section').dataset.categoryId);
    });
  });

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
