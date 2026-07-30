import { getState } from '../../../core/state.js';
import { belongsToSelectedGroup } from '../schedule.js';

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
    const hasHabits = getState().habits.some(
      (h) => belongsToSelectedGroup(h, nextGroup) && !h.archivedAt
    );
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

// Cloud hydration finishes before Home is initialized, so the reducer is the
// single source of truth for account-scoped section visibility.
try {
  sectionVisibility = {
    ...sectionVisibility,
    ...(getState().homeSectionVisibility || {}),
  };
} catch (e) {
  console.warn('Failed to load section visibility:', e);
}

export function updateSectionVisibility(completed, skipped) {
  sectionVisibility.Completed = completed;
  sectionVisibility.Skipped = skipped;
}
