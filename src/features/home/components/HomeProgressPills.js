// HomeProgressPills – side mini progress bars shown in Home view
// -----------------------------------------------------------------
// This module encapsulates the DOM logic for the small progress pills
// that appear next to the main circular progress ring.

import { getState } from '../../../core/state.js';
import { getProgressColor } from './ProgressRing.js';
import { getGroupProgress } from '../../../selectors/progress.js';
import { capitalize } from '../../../shared/common.js';

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

  const today = new Date(); // period calculation reference

  GROUPS.forEach((group) => {
    if (group === getState().selectedGroup) return; // don't show pill for current group

    const progress = getGroupProgress(group, today);

    // Only show pill if there are active habits (not paused, skipped, or hidden due to holidays)
    if (progress.active === 0) {
      return;
    }

    const pill = document.createElement('span');
    pill.setAttribute('data-group', group); // Add data attribute for easier removal
    pill.className =
      'progress-pill relative overflow-hidden py-1.5 rounded-full text-xs font-medium';
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
    container.appendChild(pill);
  });

  // Hide container entirely if no pills
  container.style.display = container.children.length ? 'flex' : 'none';
}

// Cache invalidation function for when the date changes
export function invalidatePillsCache() {
  // Since updateProgressPills always rebuilds from scratch,
  // we just need to call it to refresh the display
  updateProgressPills();
}


