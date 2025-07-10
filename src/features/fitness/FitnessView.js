// FitnessView.js - Main FitnessView component that orchestrates all sub-components
import { mountHeaderBar } from '../../shared/HeaderBar.js';
import { mountActionButtons } from '../../shared/ActionButtons.js';
import { mountSearchPanel } from './SearchPanelModule.js';
import { mountFitnessCalendar } from './FitnessCalendar.js';
import { mountActivitiesList as mountActivityList, renderActivitiesList as renderActivityList } from './ActivityList/ActivitiesList.js';
import { Timer } from './TimerModule.js';
import {
  adjustActivitiesContainerHeight,
  updateSearchSectionHeight,
  calculateAvailableHeight,
} from './helpers/fitnessLayout.js';

/**
 * Main FitnessView component that orchestrates all fitness sub-components
 */
export const FitnessView = {
  /**
   * Mounts the complete fitness view with all components
   * @param {HTMLElement} container - The container element to mount the view in
   * @param {Object} callbacks - Callback functions for various interactions
   * @returns {HTMLElement} The complete fitness view
   */
  async mount(container, callbacks = {}) {
    if (!container) return null;

    // Clear any existing content
    container.innerHTML = '';

    // Mount header bar
    const headerBar = mountHeaderBar({
      // Fitness uses the default centered layout with no title parameter
    });
    container.appendChild(headerBar);

    // Mount action buttons
    const actionButtons = mountActionButtons({
      type: 'fitness',
      callbacks: {
        onNewActivity: callbacks.onNewActivity,
        onTimer: () => Timer.openModal(),
      },
    });
    container.appendChild(actionButtons);

    // Mount search panel
    const searchPanel = mountSearchPanel({
      onActivityClick: callbacks.onSearchActivityClick,
      onStatsClick: callbacks.onStatsClick,
      onEditClick: callbacks.onEditClick,
    });
    container.appendChild(searchPanel);

    // Mount calendar wrapper
    const calendarWrapper = this._buildCalendarWrapper(callbacks.onDateChange);
    container.appendChild(calendarWrapper);

    // Mount rest toggle
    const restToggle = await import('./RestToggle.js').then((m) =>
      m.mountRestToggle(callbacks.onRestToggle)
    );
    container.appendChild(restToggle);

    // Mount activity list
    const activityList = mountActivityList(callbacks.onActivityClick);
    container.appendChild(activityList);

    return container;
  },

  /**
   * Renders the activity list content
   * @param {Function} onActivityClick - Callback when activity is clicked
   */
  renderActivities(onActivityClick) {
    renderActivityList(onActivityClick);
  },

  /**
   * Updates the timer button state
   */
  updateTimerButton() {
    Timer.updateButton();
  },

  /**
   * Updates the rest toggle state
   */
  updateRestToggle() {
    import('./RestToggle.js').then(({ updateRestToggle }) => {
      updateRestToggle();
    });
  },

  /**
   * Builds the calendar wrapper
   * @param {Function} onDateChange - Callback when date changes
   * @returns {HTMLElement} The calendar wrapper element
   */
  _buildCalendarWrapper(onDateChange) {
    const calendarWrapper = document.createElement('div');
    calendarWrapper.className = 'calendar-wrapper mb-2';

    // Mount fitness calendar
    const calendar = mountFitnessCalendar(onDateChange);
    calendarWrapper.appendChild(calendar);

    return calendarWrapper;
  },

  /**
   * Sets up responsive behavior and event handlers
   */
  setupResponsiveBehavior() {
    // Update container height on viewport resize and handle responsive behavior
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        adjustActivitiesContainerHeight();
        updateSearchSectionHeight();

        // Handle responsive search section behavior - SearchPanel handles its own responsive behavior
        setTimeout(() => {
          const content = document.querySelector(
            '#activities-search-section .activities-search-content'
          );
          if (content) {
            const maxHeight = calculateAvailableHeight();
            content.style.maxHeight = `${maxHeight}px`;
          }
        }, 100);
      });

      // Handle viewport meta for better mobile experience
      window.addEventListener('orientationchange', () => {
        setTimeout(() => {
          updateSearchSectionHeight();
        }, 500); // Wait for orientation change to complete
      });
    }
  },
};
