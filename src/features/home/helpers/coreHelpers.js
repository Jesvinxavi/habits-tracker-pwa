import { appData } from '../../../core/state.js';
import {
  isHabitCompleted,
  isHabitSkippedToday,
  isHabitScheduledOnDate,
  belongsToSelectedGroup,
} from '../schedule.js';

/* -------------------------------------------------------------------------- */
/*  PROGRESS CALCULATION                                                      */
/* -------------------------------------------------------------------------- */

export function calculateProgressForCurrentContext() {
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

/* -------------------------------------------------------------------------- */
/*  GROUP NAVIGATION HELPERS                                                  */
/* -------------------------------------------------------------------------- */

export function findNextGroupWithHabits(current, dir) {
  const groups = ['health', 'productivity', 'learning', 'social', 'finance', 'spiritual'];
  const currentIndex = groups.indexOf(current);
  let nextIndex = currentIndex;

  // Try next 6 groups (full cycle)
  for (let i = 1; i <= 6; i++) {
    nextIndex = (currentIndex + dir * i + groups.length) % groups.length;
    const nextGroup = groups[nextIndex];

    // Check if this group has any habits
    const hasHabits = appData.habits.some((h) => belongsToSelectedGroup(h, nextGroup));
    if (hasHabits) {
      return nextGroup;
    }
  }

  // If no group has habits, return current
  return current;
}

/* -------------------------------------------------------------------------- */
/*  SECTION VISIBILITY STATE                                                  */
/* -------------------------------------------------------------------------- */

export let sectionVisibility = {
  Completed: true,
  Skipped: true,
};

// Load section visibility from localStorage
try {
  const saved = localStorage.getItem('homeSectionVisibility');
  if (saved) {
    sectionVisibility = { ...sectionVisibility, ...JSON.parse(saved) };
  }
} catch (e) {
  console.warn('Failed to load section visibility:', e);
}

export function updateSectionVisibility(completed, skipped) {
  sectionVisibility.Completed = completed;
  sectionVisibility.Skipped = skipped;
}
