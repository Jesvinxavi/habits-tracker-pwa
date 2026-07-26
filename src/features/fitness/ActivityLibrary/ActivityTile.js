// ActivityTile.js - Activity tile with action buttons and keyboard navigation

/**
 * Binds event handlers for activity tiles
 * @param {HTMLElement} content - The search results content container
 * @param {Function} onActivityClick - Callback when activity is clicked
 * @param {Function} onStatsClick - Callback when stats button is clicked
 * @param {Function} onEditClick - Callback when edit button is clicked
 */
export function bindActivityTileEvents(content, onActivityClick, onStatsClick, onEditClick) {
  if (!content) return;

  // Activity action buttons
  content.querySelectorAll('.stats-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onStatsClick) {
        onStatsClick(btn.dataset.activityId);
      }
    });
  });

  content.querySelectorAll('.edit-activity-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onEditClick) {
        onEditClick(btn.dataset.activityId);
      }
    });
  });

  // Main activity tile clicks for direct recording
  content.querySelectorAll('.search-activity-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      // Don't trigger if clicking on action buttons
      if (e.target.closest('.activity-actions')) {
        return;
      }

      const activityId = item.dataset.activityId;
      if (onActivityClick) {
        onActivityClick(activityId);
      }
    });
  });
}

/**
 * Binds keyboard navigation across the activity tiles inside a container.
 * Escape is deliberately not handled here — it belongs to the surrounding modal,
 * which decides between clearing the filter and closing itself.
 * @param {HTMLElement} container - The container holding the rendered activity tiles
 * @param {HTMLElement} [filterInput] - Input that receives focus when arrowing up past the first tile
 */
export function bindSearchKeyboardNavigation(container, filterInput = null) {
  if (!container) return;
  const activityItems = container.querySelectorAll('.search-activity-item');

  activityItems.forEach((item, index) => {
    // Make items focusable
    item.setAttribute('tabindex', '0');

    item.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          activityItems[index + 1]?.focus();
          break;
        }

        case 'ArrowUp': {
          e.preventDefault();
          if (index === 0) {
            filterInput?.focus();
          } else {
            activityItems[index - 1]?.focus();
          }
          break;
        }

        case 'Enter':
        case ' ': {
          e.preventDefault();
          // Trigger click on the focused activity item
          item.click();
          break;
        }
      }
    });

    // Add focus styles
    item.addEventListener('focus', () => {
      item.style.outline = '2px solid #3B82F6';
      item.style.outlineOffset = '2px';
    });

    item.addEventListener('blur', () => {
      item.style.outline = '';
      item.style.outlineOffset = '';
    });
  });
}
