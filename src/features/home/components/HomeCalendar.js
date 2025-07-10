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
    this._updateSelectedDay();
  },

  /**
   * Updates the selected day highlighting
   */
  _updateSelectedDay() {
    if (!this.calendarEl) return;

    // Import datetime utility for date comparison
    import('../../../shared/datetime.js').then(({ isSameDay }) => {
      import('../../../core/state.js').then(({ getState }) => {
        const dayItems = this.calendarEl.querySelectorAll('.day-item');
        dayItems.forEach((el) => {
          const match = isSameDay(new Date(el.dataset.date), new Date(getState().selectedDate));
          el.classList.toggle('current-day', match);

          const isToday = isSameDay(new Date(el.dataset.date), new Date());
          el.classList.toggle('today', isToday && !match);
        });

        // Center selected day using calendar API
        if (this.calendarEl.scrollToSelected) {
          // Small delay to ensure DOM updates are complete
          setTimeout(() => {
            this.calendarEl.scrollToSelected();
          }, 10);
        }
      });
    });
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
