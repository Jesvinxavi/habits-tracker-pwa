import { appData } from '../../core/state.js';
import { isSameDay } from '../../utils/datetime.js';
import {
  belongsToSelectedGroup,
  isHabitScheduledOnDate,
  isHabitSkippedToday,
  isHabitCompleted,
} from '../schedule.js';
import { centerHorizontally } from '../../components/scrollHelpers.js';
// Local GROUP_ICONS definition (same as in HomeHeader.js)
const GROUP_ICONS = {
  daily: 'today', // calendar today icon
  weekly: 'view_week', // weekly calendar columns icon
  monthly: 'date_range', // month range icon
  yearly: 'event', // general calendar/event icon
};
import { capitalize } from '../../utils/common.js';
import { updateProgressRing } from '../components/HomeProgress.js';
import { updateProgressPills } from '../components/HomeProgress.js';
import { renderHabitsForHome } from '../components/HomeHabitsList.js';
import { updateHolidayToggle } from '../components/HomeHeader.js';
import { adjustHabitsContainerHeight } from './layoutHelpers.js';

// Global calendar API reference
let _calendarApi = null;

export function setCalendarApi(api) {
  _calendarApi = api;
}

/* -------------------------------------------------------------------------- */
/*  MAIN UI REFRESH FUNCTION                                                  */
/* -------------------------------------------------------------------------- */

export function refreshUI() {
  if (typeof window !== 'undefined' && window._skipHomeRefresh) return;

  // Update pill text/icon
  const titleEl = document.getElementById('group-title');
  const iconEl = document.getElementById('group-icon');
  if (titleEl) titleEl.textContent = `${capitalize(appData.selectedGroup)} Habits`;
  if (iconEl) {
    // Ensure class present in case this element was created before patch
    iconEl.classList.add('material-icons');
    iconEl.textContent = GROUP_ICONS[appData.selectedGroup];
  }

  // Highlight selected day in calendar
  const dayItems = document.querySelectorAll(
    '#home-calendar .day-item, #home-view .week-calendar .day-item'
  );
  dayItems.forEach((el) => {
    const match = isSameDay(new Date(el.dataset.date), new Date(appData.selectedDate));
    el.classList.toggle('current-day', match);

    const isToday = isSameDay(new Date(el.dataset.date), new Date());
    el.classList.toggle('today', isToday && !match);
  });

  // Recalculate progress
  const progress = calculateProgressForCurrentContext();
  updateProgressRing(progress);

  // Update stacked progress pills for other groups
  updateProgressPills();

  // Re-render habit cards for current context
  renderHabitsForHome();

  // After toggling classes, center selected day
  const current = document.querySelector(
    '#home-calendar .day-item.current-day, #home-view .week-calendar .day-item.current-day'
  );
  if (current) centerHorizontally(current);

  // Refresh calendar labels to reflect current selected group
  if (_calendarApi && typeof _calendarApi.refresh === 'function') {
    _calendarApi.refresh();
  }

  // Sync holiday toggle with newly selected date
  updateHolidayToggle();

  // Recalculate scrollable area height after any UI change
  adjustHabitsContainerHeight();
}

/* -------------------------------------------------------------------------- */
/*  PROGRESS CALCULATION                                                      */
/* -------------------------------------------------------------------------- */

function calculateProgressForCurrentContext() {
  const dateObj = new Date(appData.selectedDate);

  // 1) Habits that belong to the currently selected group
  // 2) Are actually scheduled for the selected date (takes holiday mode into account)
  const scheduledHabits = appData.habits.filter(
    (h) => belongsToSelectedGroup(h, appData.selectedGroup) && isHabitScheduledOnDate(h, dateObj)
  );

  // 3) Remove any that the user explicitly skipped
  const activeHabits = scheduledHabits.filter((h) => !isHabitSkippedToday(h, dateObj));

  // 4) Determine how many of the remaining active habits are completed
  const completed = activeHabits.filter((h) => isHabitCompleted(h, dateObj));

  const progress = activeHabits.length ? (completed.length / activeHabits.length) * 100 : 0;
  return progress;
}
