// HabitsView.js - Main HabitsView component that orchestrates all sub-components
import { mountHeaderBar } from '../../components/HeaderBar.js';
import { mountActionButtons } from '../../components/ActionButtons.js';
import { mountSearchPanel, initializeSearch } from './HabitsSearchModule.js';
import { mountHabitsList, renderHabitsList } from './HabitsListModule.js';

/**
 * Main HabitsView component that orchestrates all habits sub-components
 */
export const HabitsView = {
  /**
   * Mounts the complete habits view with all components
   * @param {HTMLElement} container - The container element to mount the view in
   * @param {Object} callbacks - Callback functions for various interactions
   * @returns {HTMLElement} The complete habits view
   */
  mount(container, callbacks = {}) {
    if (!container) return null;

    // Clear any existing content
    container.innerHTML = '';

    // Mount header bar (title + reorder button)
    const headerBar = mountHeaderBar({
      title: 'Habits',
      extraButtons: [{
        id: 'reorder',
        text: 'Reorder',
        icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      }],
      callbacks: {
        onReorder: callbacks.onReorder,
      },
    });
    container.appendChild(headerBar);

    // Mount action buttons (new category + new habit)
    const actionButtons = mountActionButtons({
      type: 'habits',
      callbacks: {
        onNewCategory: callbacks.onNewCategory,
        onNewHabit: callbacks.onNewHabit,
      },
    });
    container.appendChild(actionButtons);

    // Mount search panel
    const searchPanel = mountSearchPanel({
      onSearch: callbacks.onSearch,
    });
    container.appendChild(searchPanel);

    // Activate live filtering once the panel is in the document tree.
    initializeSearch();

    // Mount habits list container
    const habitsList = mountHabitsList(callbacks.onHabitClick);
    container.appendChild(habitsList);

    return container;
  },

  /**
   * Renders the habits list content
   * @param {Function} onHabitClick - Callback when habit is clicked
   */
  renderHabits(onHabitClick) {
    renderHabitsList(onHabitClick);
  },

  /**
   * Updates the reorder button state
   */
  updateReorderButton() {
    // This will be implemented when we extract the reorder functionality
  },

  /**
   * Sets up responsive behavior and event handlers
   */
  setupResponsiveBehavior() {
    // Update container height on viewport resize and handle responsive behavior
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        // Handle responsive behavior for habits view
        // This will be implemented as needed
      });

      // Handle viewport meta for better mobile experience
      window.addEventListener('orientationchange', () => {
        // Handle orientation changes
        setTimeout(() => {
          // Refresh layout if needed
        }, 500);
      });
    }
  },
};
