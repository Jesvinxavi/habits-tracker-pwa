// FitnessView.js - Main FitnessView component that orchestrates all sub-components
import { mountHeaderBar } from '../../shared/HeaderBar.js';
import { mountActionButtons } from '../../shared/ActionButtons.js';
import { mountFitnessCalendar } from './FitnessCalendar.js';
import { mountActivitiesList as mountActivityList, renderActivitiesList as renderActivityList } from './ActivityList/ActivitiesList.js';

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
        onActivityLibrary: callbacks.onActivityLibrary,
        onRoutines: callbacks.onRoutines,
      },
    });
    container.appendChild(actionButtons);

    // Host for the program tile. Stays empty when no program is active, which
    // renders as zero height because it has no padding-producing children.
    const programHost = document.createElement('div');
    programHost.id = 'fitness-program-host';
    programHost.className = 'px-4';
    container.appendChild(programHost);

    // Mount calendar wrapper
    const calendarWrapper = this._buildCalendarWrapper(callbacks.onDateChange);
    container.appendChild(calendarWrapper);

    // Mount rest toggle. mountRestToggle takes an options object; passing the
    // callback directly meant onToggle never fired.
    const restToggle = await import('./RestToggle.js').then((m) =>
      m.mountRestToggle({
        onToggle: callbacks.onRestToggle,
        addMenu: callbacks.addMenu,
      })
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

};
