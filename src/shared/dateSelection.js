import { getState } from '../core/state.js';
import { belongsToSelectedGroup, isHabitScheduledOnDate } from '../features/home/schedule.js';
import { getPeriodStart } from '../shared/datetime.js';

/**
 * Calculates the appropriate "today" date for a specific habit group.
 * This ensures that when switching between groups, we show a meaningful date
 * that has habits scheduled rather than just the current calendar date.
 */
export function calculateSmartDateForGroup(habits, group, baseDate = new Date()) {
  // For daily group, always use the actual today
  if (group === 'daily') {
    return baseDate;
  }

  // For other groups, find the most recent date that has habits scheduled
  const today = new Date(baseDate);
  const groupHabits = habits.filter(h => belongsToSelectedGroup(h, group) && !h.paused);
  
  if (groupHabits.length === 0) {
    // No habits in this group, use today
    return today;
  }

  // Look for the most recent date with scheduled habits
  let bestDate = today;
  let bestScore = -1;

  // Check the last 30 periods (days/weeks/months/years) for this group
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today);
    
    // Go back in time by the appropriate period
    switch (group) {
      case 'weekly':
        checkDate.setDate(checkDate.getDate() - (i * 7));
        break;
      case 'monthly':
        checkDate.setMonth(checkDate.getMonth() - i);
        break;
      case 'yearly':
        checkDate.setFullYear(checkDate.getFullYear() - i);
        break;
      default:
        checkDate.setDate(checkDate.getDate() - i);
    }

    // Count how many habits are scheduled on this date
    const scheduledHabits = groupHabits.filter(h => isHabitScheduledOnDate(h, checkDate));
    
    if (scheduledHabits.length > 0) {
      // Found a date with habits - use it if it's better than what we have
      const score = scheduledHabits.length + (i === 0 ? 10 : 0); // Prefer today if it has habits
      if (score > bestScore) {
        bestScore = score;
        bestDate = checkDate;
      }
    }
  }

  return bestDate;
}

/**
 * Calculates the appropriate "today" date for a specific habit group and returns it as an ISO string.
 * This is the same as calculateSmartDateForGroup but returns an ISO string for consistency.
 */
export function calculateSmartDateForGroupISO(habits, group, baseDate = new Date()) {
  const smartDate = calculateSmartDateForGroup(habits, group, baseDate);
  return smartDate.toISOString();
} 