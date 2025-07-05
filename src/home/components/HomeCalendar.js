// HomeCalendar.js - Calendar component for the home view
import { mountCalendar } from '../calendar.js';

/**
 * HomeCalendar component that manages the calendar integration
 */
export const HomeCalendar = {
  /**
   * Mounts the calendar component
   */
  mount(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this._createCalendar();
    this._mountCalendar();

    // Return the calendar API for external access
    return this.calendarApi;
  },

  /**
   * Creates the calendar structure
   */
  _createCalendar() {
    // The container is already the .week-calendar element
    // We just need to mount the calendar to the existing structure
    this.calendarContainer = this.container;
    this.weekDaysContainer = this.container.querySelector('.week-days');
  },

  /**
   * Mounts the calendar using the existing calendar API
   */
  _mountCalendar() {
    if (!this.calendarContainer) return;

    this.calendarApi = mountCalendar({
      container: this.calendarContainer,
      stateKey: 'selectedDate',
      onDateChange: (date) => {
        if (this.callbacks.onDateChange) {
          this.callbacks.onDateChange(date);
        }
      },
    });
  },

  /**
   * Renders the calendar
   */
  render() {
    if (this.calendarApi && typeof this.calendarApi.refresh === 'function') {
      this.calendarApi.refresh();
    }
  },

  /**
   * Unmounts the calendar component
   */
  unmount() {
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }

    // Clear API reference
    this.calendarApi = null;
  },
};
