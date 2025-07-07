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
 * @prop {()=>void} destroy
 */

let _fitnessCalendarApi = null;

export const FitnessCalendar = {
  ready: null,
  setDate: null,
  scrollToSelected: null,
  destroy: () => {
    if (_fitnessCalendarApi) {
      _fitnessCalendarApi.destroy();
      _fitnessCalendarApi = null;
    }
  },
};

// Store fitness calendar API reference
export function setFitnessCalendarApi(api) {
  _fitnessCalendarApi = api;
  FitnessCalendar.ready = api.ready;
  FitnessCalendar.setDate = api.setDate;
  FitnessCalendar.scrollToSelected = api.scrollToSelected;
}

/**
 * Mounts the calendar wrapper for the fitness view
 * @param {Object} options - Configuration options
 * @param {Function} options.onDateChange - Callback when date changes
 * @returns {HTMLElement} The calendar wrapper element
 */
export function mountFitnessCalendar(options = {}) {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Create custom element
  const calendarWrapper = document.createElement('hh-calendar');
  calendarWrapper.className = 'week-calendar overflow-x-auto no-scrollbar m-0 p-0';
  calendarWrapper.id = 'fitness-calendar';
  calendarWrapper.setAttribute('state-key', 'fitnessSelectedDate');
  calendarWrapper.style.minHeight = '120px';
  calendarWrapper.style.overflowY = 'visible';
  calendarWrapper.style.overflowX = 'auto';
  calendarWrapper.style.width = '100%';

  // Forward selection event
  calendarWrapper.addEventListener('select', (e) => {
    if (typeof options.onDateChange === 'function') options.onDateChange(e.detail.date);
  });

  setFitnessCalendarApi(calendarWrapper);

  // Keep window reference for backward compatibility
  window.fitnessCalendarApi = calendarWrapper;

  // Trigger initial refresh after element is ready
  if (typeof window !== 'undefined') {
    calendarWrapper.ready?.then?.(() => calendarWrapper.refresh?.());
  }

  return calendarWrapper;
}
