/**
 * Fitness Calendar Component
 *
 * Component for building the fitness calendar with navigation
 * Extracted from src/ui/fitness.js for better modularity
 */

import '../../components/hh-calendar.js';

/**
 * @typedef {Object} CalendarController
 * @prop {Promise<void>} ready            Resolves after DOM & fonts ready
 * @prop {(d:Date)=>void} setDate         Selects new date, re-renders
 * @prop {(o?:{instant?:boolean})=>void} scrollToSelected
 */

export const FitnessCalendar = {
  ready: null,
  setDate: null,
  scrollToSelected: null,
};

/** @internal Exported for the calendar binding regression test. */
export function setFitnessCalendarApi(api, ready = api.ready) {
  FitnessCalendar.ready = ready;
  FitnessCalendar.setDate = api.setDate.bind(api);
  FitnessCalendar.scrollToSelected = api.scrollToSelected.bind(api);
}

/**
 * Mounts the calendar wrapper for the fitness view
 * @param {Object} options - Configuration options
 * @param {Function} options.onDateChange - Callback when date changes
 * @returns {HTMLElement} The calendar wrapper element
 */
export function mountFitnessCalendar(onDateChange) {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Create custom element
  const calendarWrapper = document.createElement('hh-calendar');
  // The date strip inside hh-calendar owns horizontal scrolling. Making the
  // host scroll as well creates a second, always-visible scrollbar on mobile.
  calendarWrapper.className = 'week-calendar m-0 p-0';
  calendarWrapper.classList.add('calendar-initializing');
  calendarWrapper.id = 'fitness-calendar';
  calendarWrapper.setAttribute('state-key', 'fitnessSelectedDate');
  calendarWrapper.style.minHeight = '120px';
  calendarWrapper.style.overflowY = 'visible';
  calendarWrapper.style.overflowX = 'visible';
  calendarWrapper.style.width = '100%';

  // Forward selection event
  calendarWrapper.addEventListener('select', (e) => {
    if (typeof onDateChange === 'function') onDateChange(e.detail.date);
  });

  // Do not expose the strip at scrollLeft 0. Resolve FitnessCalendar.ready only
  // after Today has been positioned on two layout frames, so navigation cannot
  // reveal an anchor-to-Today movement on the first visit after a hard reload.
  const positionedReady = calendarWrapper.ready.then(
    () =>
      new Promise((resolve) => {
        calendarWrapper.refresh?.();
        calendarWrapper.scrollToSelected?.({ instant: true });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            calendarWrapper.classList.remove('calendar-initializing');
            resolve();
          });
        });
      })
  );
  setFitnessCalendarApi(calendarWrapper, positionedReady);

  return calendarWrapper;
}
