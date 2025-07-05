// HomeProgressPills – side mini progress bars shown in Home view
// -----------------------------------------------------------------
// This module encapsulates the DOM logic for the small progress pills
// that appear next to the main circular progress ring.

import { appData } from '../core/state.js';
import { getProgressColor } from '../ui/progressRing.js';
import {
  belongsToSelectedGroup,
  isHabitScheduledOnDate,
  isHabitCompleted,
  isHabitSkippedToday,
} from '../features/home/schedule.js';
import { capitalize } from '../utils/common.js';

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

  container.innerHTML = '';
  const date = new Date(appData.selectedDate);

  // Remove any hard-coded legacy pill markup if present (can be deleted from HTML later)
  section.querySelector('.weekly-progress')?.remove();

  GROUPS.forEach((g) => {
    if (g === appData.selectedGroup) return; // skip currently selected group

    // build lists to decide if pill needed
    const habitsForGroup = appData.habits.filter(
      (h) => belongsToSelectedGroup(h, g) && isHabitScheduledOnDate(h, date)
    );

    if (habitsForGroup.length === 0) return; // no habits at all ⇒ no pill

    // Exclude paused habits entirely – if everything is paused we skip the pill altogether.
    const nonPaused = habitsForGroup.filter((h) => !h.paused);
    if (nonPaused.length === 0) return; // all paused

    // Now compute active for progress (not skipped today / not paused)
    const active = nonPaused.filter((h) => !isHabitSkippedToday(h, date));

    // If every habit for this group is skipped today, do not render a pill at all.
    if (active.length === 0) return;

    const completed = active.filter((h) => isHabitCompleted(h, date));
    const pct = Math.round((completed.length / active.length) * 100);

    const pill = document.createElement('span');
    pill.className =
      'progress-pill relative overflow-hidden px-4 py-1.5 rounded-full text-xs font-medium';
    pill.textContent = `${capitalize(g)} (${pct}%)`;

    // Apply progress fill based on percentage thresholds
    const fillColor = getProgressColor(pct);
    const unfilled = '#e5e5e7';
    pill.style.background = `linear-gradient(to right, ${fillColor} ${pct}%, ${unfilled} ${pct}%)`;
    pill.style.color = '#000';
    pill.style.border = '1px solid #4B5563';
    container.appendChild(pill);
  });

  // Hide container entirely if no pills
  container.style.display = container.children.length ? 'flex' : 'none';
}
