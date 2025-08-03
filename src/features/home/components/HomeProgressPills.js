// HomeProgressPills – side mini progress bars shown in Home view
// -----------------------------------------------------------------
// This module encapsulates the DOM logic for the small progress pills
// that appear next to the main circular progress ring.

import { getState, dispatch, Actions } from '../../../core/state.js';
import { getProgressColor } from './ProgressRing.js';
import { getGroupProgress } from '../../../selectors/progress.js';
import { capitalize } from '../../../shared/common.js';
import { 
  belongsToSelectedGroup, 
  isHabitScheduledOnDate, 
  isHabitSkippedToday 
} from '../schedule.js';

const GROUPS = ['daily', 'weekly', 'monthly', 'yearly'];

export function updateProgressPills() {
  const section = document.querySelector('#home-view .progress-section');
  if (!section) return;

  let container = section.querySelector('.progress-pills');
  if (!container) {
    container = document.createElement('div');
    container.className =
      'progress-pills absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1';
    section.appendChild(container);
  }

  // Always rebuild pills from scratch for simplicity and correctness
  container.innerHTML = '';

  const selectedDate = new Date(getState().selectedDate);

  GROUPS.forEach((group) => {
    if (group === getState().selectedGroup) {
      return; // don't show pill for current group
    }

    // Use the original period-based progress calculation
    const progress = getGroupProgress(group, selectedDate);

    // Additional check: for consistency with daily progress behavior,
    // ensure that there are habits belonging to this group that have any presence
    // on the current selected date (either scheduled or target-based)
    const groupHabits = getState().habits.filter((h) => belongsToSelectedGroup(h, group));
    
    // Check if any habits in this group are either:
    // 1. Scheduled on the selected date and not skipped, OR
    // 2. Target-based (which means they're always "present" for their period)
    const hasRelevantHabits = groupHabits.some((habit) => {
      const isTarget = typeof habit.target === 'number' && habit.target > 0;
      
      // Target-based habits are always relevant for their group
      if (isTarget) {
        return !habit.paused && !isHabitSkippedToday(habit, selectedDate);
      }
      
      // Schedule-only habits must be scheduled on this date and not skipped
      return isHabitScheduledOnDate(habit, selectedDate) && !isHabitSkippedToday(habit, selectedDate);
    });

    // For daily group: show pill if there are relevant habits, regardless of progress.active
    // For other groups: show pill if there are active habits AND relevant habits  
    const shouldShowPill = group === 'daily' 
      ? hasRelevantHabits 
      : (progress.active > 0 && hasRelevantHabits);

    if (!shouldShowPill) {
      return;
    }

    // Create pill element with original styling
    const pill = document.createElement('span');
    pill.setAttribute('data-group', group);
    pill.className =
      'progress-pill relative overflow-hidden py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 hover:scale-105';
    pill.textContent = `${capitalize(group)} (${progress.percentage}%)`;

    // Apply progress fill based on percentage thresholds
    const fillColor = getProgressColor(progress.percentage);
    const unfilled = '#e5e5e7';
    pill.style.background = `linear-gradient(to right, ${fillColor} ${progress.percentage}%, ${unfilled} ${progress.percentage}%)`;
    pill.style.color = '#000';
    pill.style.border = '1px solid #4B5563';

    // Ensure consistent width and prevent text wrapping
    pill.style.width = '110px';
    pill.style.minWidth = '110px';
    pill.style.maxWidth = '110px';
    pill.style.whiteSpace = 'nowrap';
    pill.style.textAlign = 'center';
    pill.style.fontSize = '11px';
    pill.style.lineHeight = '1.2';
    pill.style.paddingLeft = '0';
    pill.style.paddingRight = '0';

    // Handle pill click to switch to that group
    pill.addEventListener('click', () => {
      dispatch(Actions.setSelectedGroup(group));
    });

    container.appendChild(pill);
  });
}

// Cache invalidation function for when the date changes
export function invalidatePillsCache() {
  // Since updateProgressPills always rebuilds from scratch,
  // we just need to call it to refresh the display
  updateProgressPills();
}


