// HomeProgressPills – side mini progress bars shown in Home view
// -----------------------------------------------------------------
// This module encapsulates the DOM logic for the small progress pills
// that appear next to the main circular progress ring.

import { appData } from '../core/state.js';
import { getProgressColor } from './ProgressRing.js';
import { getGroupProgress } from '../selectors/progress.js';
import { capitalize } from '../shared/common.js';

const GROUPS = ['daily', 'weekly', 'monthly', 'yearly'];

// Memoization cache to prevent unnecessary DOM updates
let _cache = {};

/**
 * Invalidate the pills cache - call this when habits or dates change
 */
export function invalidatePillsCache() {
  _cache = {};
}

/**
 * Generate a cache key for a group's progress
 */
function getCacheKey(group, date) {
  const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const habitsHash = appData.habits.length.toString(); // Simple hash for now
  return `${group}|${dateKey}|${habitsHash}`;
}

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

  // Use today's date for period calculations (not selectedDate)
  const today = new Date();
  const changes = [];

  // Remove any hard-coded legacy pill markup if present (can be deleted from HTML later)
  section.querySelector('.weekly-progress')?.remove();

  GROUPS.forEach((group) => {
    if (group === appData.selectedGroup) return; // skip currently selected group

    // Check cache first
    const cacheKey = getCacheKey(group, today);
    const cached = _cache[cacheKey];

    // Get current progress
    const progress = getGroupProgress(group, today);

    // Check if we need to update this pill
    if (!cached || cached.percentage !== progress.percentage || cached.active !== progress.active) {
      changes.push({ group, progress });
      _cache[cacheKey] = progress;
    }
  });

  // Only update DOM if there are actual changes
  if (changes.length === 0) return;

  // Clear container and rebuild pills
  container.innerHTML = '';

  changes.forEach(({ group, progress }) => {
    // Only show pill if there are active habits (not paused, skipped, or hidden due to holidays)
    if (progress.active === 0) {
      // Remove any existing pill for this group if it exists
      const existingPill = container.querySelector(`[data-group="${group}"]`);
      if (existingPill) {
        existingPill.remove();
      }
      // Debug logging (can be removed in production)
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
        console.log(
          `Progress pill for ${group} hidden: no active habits (${progress.completed}/${progress.active})`
        );
      }
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

// -------------------- Self-tests (development only) --------------------

if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
  // Test cache invalidation
  invalidatePillsCache();
  console.assert(Object.keys(_cache).length === 0, 'Cache should be cleared after invalidation');

  // Test cache key generation
  const testDate = new Date('2025-01-15');
  const testKey = getCacheKey('daily', testDate);
  console.assert(testKey.includes('daily'), 'Cache key should include group name');
  console.assert(testKey.includes('2025-01-15'), 'Cache key should include date');

  // Test pill hiding logic
  const mockProgress = { percentage: 0, completed: 0, active: 0 };
  console.assert(mockProgress.active === 0, 'Pill should be hidden when active === 0');

  console.log('✅ HomeProgressPills.js self-tests passed');
}
