// CategorySection.js - Category section with expand/collapse functionality
import { formatMuscleName } from '../../../shared/common.js';

/**
 * Builds a category section with collapsible header and activities
 * @param {Object} category - The category object
 * @param {Array} activities - Array of activities (null for muscle group mode)
 * @param {Object} muscleGroups - Grouped activities by muscle group (null for regular mode)
 * @returns {string} HTML string for the category section
 */
export function buildCategorySection(category, activities = null, muscleGroups = null) {
  const categoryId = `search-category-${category.id}`;

  // Build expand/collapse button
  const expandBtn = `
    <button class="search-expand-btn h-5 w-5 flex items-center justify-center text-black" data-category-id="${category.id}">
      <span class="material-icons transition-transform leading-none">expand_more</span>
    </button>
  `;

  // Build edit button matching habits page style
  const editBtn = `
    <button class="search-edit-category-btn w-8 h-8 rounded-full flex items-center justify-center ml-2" data-category-id="${category.id}" style="background-color:${category.color}">
      <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/>
      </svg>
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
        <div class="muscle-header pl-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300">${formatMuscleName(mg)}</div>
        <div class="category-activities pl-6">
          ${list.map((activity) => buildActivityTile(activity, category)).join('')}
        </div>
      </div>
    `
      )
      .join('');
  } else if (activities) {
    // Handle regular activities
    activitiesContent = `
      <div class="category-activities pl-6">
        ${activities.map((activity) => buildActivityTile(activity, category)).join('')}
      </div>
    `;
  }

  return `
    <div class="search-category-section mb-4" data-category-id="${category.id}" id="${categoryId}">
      <div class="search-category-header-wrapper flex items-center">
        <div class="search-category-header flex items-center justify-between px-4 py-1 rounded-t-xl cursor-pointer select-none flex-grow" style="background:${category.color}20;">
          <div class="category-title flex items-center gap-2">
            <span class="text-lg" aria-hidden="true">${category.icon}</span>
            <span class="font-semibold text-gray-900 dark:text-white">${category.name}</span>
          </div>
          ${expandBtn}
        </div>
        <div class="-ml-2">${editBtn}</div>
      </div>
      <div class="search-category-content">
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
  // Import hexToRgba from utils
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return `
    <div style="margin-bottom: 0.25rem;">
      <div class="search-activity-item activity-card flex items-center px-3 py-2 rounded-xl w-full transition-colors focus:outline-none focus:ring-2 focus:ring-ios-blue focus:ring-offset-2 dark:focus:ring-offset-gray-800" style="border: 3px solid ${category.color}; background-color: ${hexToRgba(category.color, 0.05)};" data-activity-id="${activity.id}">
        <div class="activity-icon w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center mr-3 text-xl" style="border: 2px solid ${category.color}; color: ${category.color};" aria-hidden="true">
          ${activity.icon || category.icon}
        </div>
        <div class="activity-content flex-grow text-left">
          <div class="activity-name font-semibold leading-tight text-gray-900 dark:text-white">${activity.name}</div>
        </div>
        <div class="activity-actions flex items-center gap-2 ml-3">
          <button class="stats-btn w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors" data-activity-id="${activity.id}" title="View Stats">
            <span class="material-icons text-lg">bar_chart</span>
          </button>
          <button class="edit-activity-btn w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" data-activity-id="${activity.id}" title="Edit Activity">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </div>
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
 */
export function bindCategorySectionEvents(content, onColorChange) {
  if (!content) return;

  // Category collapse/expand functionality
  content.querySelectorAll('.search-expand-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSearchCategory(btn.dataset.categoryId);
    });
  });

  content.querySelectorAll('.search-category-header').forEach((header) => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.search-expand-btn') || e.target.closest('.search-edit-category-btn'))
        return;
      const categoryId = header.closest('.search-category-section').dataset.categoryId;
      toggleSearchCategory(categoryId);
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
