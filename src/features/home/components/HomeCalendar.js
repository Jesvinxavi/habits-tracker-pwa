// HomeCalendar.js - Calendar component for the home view
import '../../../components/hh-calendar.js'; // Ensure custom element is registered
import { setHomeCalendarApi } from '../calendar.js';

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

    // Replace existing container content with <hh-calendar>
    container.innerHTML = '';
    const calEl = document.createElement('hh-calendar');
    calEl.setAttribute('state-key', 'selectedDate');

    // Forward selection event
    calEl.addEventListener('select', (e) => {
      if (this.callbacks.onDateChange) this.callbacks.onDateChange(e.detail.date);
    });

    container.appendChild(calEl);

    this.calendarEl = calEl;

    setHomeCalendarApi(calEl);

    // Return API-compatible reference
    return calEl;
  },

  /**
   * Renders the calendar
   */
  render() {
    this.calendarEl?.refresh?.();
    // Center selected tile using the calendar API; styling is managed in calendar.js
    if (this.calendarEl?.scrollToSelected) {
          setTimeout(() => {
            this.calendarEl.scrollToSelected();
          }, 10);
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
    this.calendarEl = null;
  },
};
