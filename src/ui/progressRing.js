import { appData } from '../core/state.js';
import { isHabitCompleted } from '../features/home/schedule.js';

export function calculateDailyProgress() {
  // Consider all habits that are not paused. A future refactor will
  // take schedule-specific filtering into account (see features/home/schedule.js).
  const activeHabits = appData.habits.filter((h) => !h.paused);

  // A habit is treated as completed when its `completed` flag is true.
  // For target-based habits we still rely on that flag being toggled once
  // the target is reached (the existing Home controller already does this).
  const today = new Date(appData.selectedDate);
  const completed = activeHabits.filter((h) => isHabitCompleted(h, today));

  return activeHabits.length ? (completed.length / activeHabits.length) * 100 : 0;
}

export function getProgressColor(pct) {
  if (pct < 34)
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--danger-color').trim() ||
      '#ff3b30'
    );
  if (pct < 67)
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--warning-color').trim() ||
      '#ff9500'
    );
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--success-color').trim() ||
    '#34c759'
  );
}

export function updateProgressRing(percentage) {
  const ring = document.querySelector('.progress-ring-fg');
  const progressNumber = document.querySelector('.progress-number');
  if (!ring || !progressNumber) return;
  const radius = ring.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = getProgressColor(percentage);
  progressNumber.textContent = `${Math.round(percentage)}%`;
}

export function initializeProgressRing() {
  // Call once after DOM ready
  updateProgressRing(calculateDailyProgress());
}
