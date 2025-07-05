/**
 * Fitness Calendar Component
 *
 * Component for building the fitness calendar with navigation
 * Extracted from src/ui/fitness.js for better modularity
 */

import { mountCalendar } from '../home/calendar.js';
import { appData, mutate } from '../core/state.js';

/**
 * Mounts the calendar wrapper for the fitness view
 * @param {Object} options - Configuration options
 * @param {Function} options.onDateChange - Callback when date changes
 * @returns {HTMLElement} The calendar wrapper element
 */
export function mountFitnessCalendar(options = {}) {
  const fitnessView = document.getElementById('fitness-view');
  if (!fitnessView) return;

  // Add horizontal calendar container below header
  const calendarWrapper = document.createElement('div');
  calendarWrapper.className = 'week-calendar overflow-x-auto no-scrollbar m-0 p-0';
  calendarWrapper.id = 'fitness-calendar';
  calendarWrapper.style.minHeight = '120px';
  calendarWrapper.style.overflowY = 'visible';
  calendarWrapper.style.overflowX = 'auto';
  calendarWrapper.style.width = '100%';

  // Mount calendar with fitness-specific configuration
  window.fitnessCalendarApi = mountCalendar({
    container: calendarWrapper,
    stateKey: 'fitnessSelectedDate',
    onDateChange: options.onDateChange,
  });

  // Add navigation buttons AFTER mountCalendar creates .week-days element
  addCalendarNavigation(calendarWrapper);

  // Since navigation was added after mountCalendar, we need to manually bind the events
  // that mountCalendar would normally handle
  bindCalendarNavigation(calendarWrapper);

  return calendarWrapper;
}

/**
 * Adds navigation buttons to the calendar after mountCalendar creates the week-days
 */
function addCalendarNavigation(calendarWrapper) {
  if (!calendarWrapper) return;

  // Check if navigation already exists
  if (calendarWrapper.querySelector('.calendar-nav')) return;

  // Add navigation buttons below the calendar (after week-days)
  const navContainer = document.createElement('div');
  navContainer.className = 'calendar-nav flex justify-center items-center gap-4 lg:gap-6';
  navContainer.innerHTML = `
    <button class="nav-arrow prev-week text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">‹‹</button>
    <button class="nav-arrow prev-day text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">‹</button>
    <button class="today-btn bg-ios-blue text-white rounded-full font-medium hover:bg-blue-600 transition-colors spring lg:px-6 lg:text-lg">Today</button>
    <button class="nav-arrow next-day text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">›</button>
    <button class="nav-arrow next-week text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">››</button>
  `;

  // Insert navigation after week-days to ensure it's below the calendar
  const weekDays = calendarWrapper.querySelector('.week-days');
  if (weekDays) {
    weekDays.insertAdjacentElement('afterend', navContainer);
  } else {
    calendarWrapper.appendChild(navContainer);
  }
}

/**
 * Binds calendar navigation events
 */
function bindCalendarNavigation(container) {
  // Replicate the navigation binding logic from mountCalendar with bounds checking

  function getStateDate() {
    return new Date(appData.fitnessSelectedDate);
  }

  function setStateDate(dateObj) {
    mutate((s) => {
      // Create ISO string manually without timezone conversion for fitness dates
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const localISOString = `${year}-${month}-${day}T00:00:00.000Z`;
      s.fitnessSelectedDate = localISOString;
    });
    // Trigger the date change callback via the calendar API
    if (window.fitnessCalendarApi && typeof window.fitnessCalendarApi.refresh === 'function') {
      window.fitnessCalendarApi.refresh();
    }
  }

  function getFirstAvailableDate() {
    // Get the first tile's date from the calendar
    const firstTile = container.querySelector('.week-days .day-item');
    if (firstTile && firstTile.dataset.date) {
      return new Date(firstTile.dataset.date);
    }
    // Fallback to current date if no tiles exist
    return new Date();
  }

  // Bind navigation arrows
  container.querySelectorAll('.nav-arrow').forEach((arrow) => {
    arrow.addEventListener('click', () => {
      let cur = getStateDate();
      const originalDate = new Date(cur);
      const grp = appData.selectedGroup || 'daily';
      const isPrev = arrow.classList.contains('prev-week');
      const isNext = arrow.classList.contains('next-week');
      const isPrevDay = arrow.classList.contains('prev-day');
      const isNextDay = arrow.classList.contains('next-day');

      // Calculate new date based on navigation type
      if (isPrev || isNext) {
        const dir = isPrev ? -1 : +1;
        switch (grp) {
          case 'weekly':
            cur.setDate(cur.getDate() + dir * 28); // 4 weeks
            break;
          case 'monthly':
            cur.setMonth(cur.getMonth() + dir * 6); // 6 months
            break;
          case 'yearly':
            cur.setFullYear(cur.getFullYear() + dir * 5); // 5 years
            break;
          case 'daily':
          default:
            cur.setDate(cur.getDate() + dir * 7); // 1 week
            break;
        }
      } else if (isPrevDay || isNextDay) {
        const dirDay = isPrevDay ? -1 : +1;
        switch (grp) {
          case 'weekly':
            cur.setDate(cur.getDate() + dirDay * 7);
            break;
          case 'monthly':
            cur.setMonth(cur.getMonth() + dirDay);
            break;
          case 'yearly':
            cur.setFullYear(cur.getFullYear() + dirDay);
            break;
          case 'daily':
          default:
            cur.setDate(cur.getDate() + dirDay);
        }
      }

      // Apply bounds checking - prevent going before first available date
      const firstDate = getFirstAvailableDate();
      if (cur < firstDate) {
        // Special logic for prev-week when current is < 7 days from first tile
        if (isPrev && grp === 'daily') {
          const daysDiff = Math.floor((originalDate - firstDate) / (1000 * 60 * 60 * 24));
          if (daysDiff < 7) {
            // If less than 7 days from first tile, go to first tile
            cur = new Date(firstDate);
          } else {
            // Otherwise just prevent going before first tile
            cur = new Date(firstDate);
          }
        } else {
          // For any other case where we'd go before first date, stay at first date
          cur = new Date(firstDate);
        }
      }

      setStateDate(cur);
    });
  });

  // Bind today button
  const todayBtn = container.querySelector('.today-btn');
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const today = new Date();
      setStateDate(today);
    });
  }
}
