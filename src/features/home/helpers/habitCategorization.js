import { getState } from '../../../core/state.js';
import {
  belongsToSelectedGroup,
  isHabitScheduledOnDate,
  isHabitCompleted,
  isHabitSkippedToday,
} from '../schedule.js';

function toMinutes(t) {
  if (!t || typeof t !== 'string') return Number.POSITIVE_INFINITY;
  const [hh, mm] = t.split(':');
  const h = parseInt(hh, 10);
  const m = parseInt(mm, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return Number.POSITIVE_INFINITY;
  return h * 60 + m;
}

export function getCategorizedHabitsForSelectedContext() {
  const state = getState();
  const rawDate = new Date(state.selectedDate);
  const group = state.selectedGroup;

  // Normalize local date to midnight-UTC like the existing code
  const normalizedLocal = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate());
  const date = new Date(
    Date.UTC(normalizedLocal.getFullYear(), normalizedLocal.getMonth(), normalizedLocal.getDate())
  );

  const habits = state.habits.filter(
    (h) => belongsToSelectedGroup(h, group) && isHabitScheduledOnDate(h, date)
  );

  const skipped = habits.filter((h) => !isHabitCompleted(h, date) && isHabitSkippedToday(h, date));
  const incompleteActive = habits.filter(
    (h) => !isHabitCompleted(h, date) && !isHabitSkippedToday(h, date)
  );
  const anytime = incompleteActive.filter((h) => !h.scheduledTime);
  const scheduled = incompleteActive.filter((h) => h.scheduledTime);

  const scheduledSorted = scheduled.slice().sort((a, b) => {
    const diff = toMinutes(a.scheduledTime) - toMinutes(b.scheduledTime);
    if (diff !== 0) return diff;
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return (a.id || '').localeCompare(b.id || '');
  });

  const completed = habits.filter((h) => isHabitCompleted(h, date));

  const sections = {
    Anytime: anytime,
    Scheduled: scheduledSorted,
    Completed: completed,
    Skipped: skipped,
  };

  const counts = {
    Anytime: anytime.length,
    Scheduled: scheduledSorted.length,
    Completed: completed.length,
    Skipped: skipped.length,
  };

  return { sections, counts, date, group, habits };
} 