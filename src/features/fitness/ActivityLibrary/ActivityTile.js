// ActivityTile.js - Activity tile with action buttons and keyboard navigation

/**
 * Binds event handlers for activity tiles. The whole tile is the target — stats
 * and edit moved into the activity details modal the tile opens.
 * @param {HTMLElement} content - The search results content container
 * @param {Function} onActivityClick - Callback when an activity tile is activated
 */
export function bindActivityTileEvents(content, onActivityClick) {
  if (!content || !onActivityClick) return;

  content.querySelectorAll('.search-activity-item').forEach((item) => {
    item.addEventListener('click', () => {
      onActivityClick(item.dataset.activityId);
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
