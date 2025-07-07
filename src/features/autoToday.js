/* Auto-advance selectedDate to always represent the current period.
 * -------------------------------------------------------------------
 * This module has no exports; importing it once sets up a timer that
 * keeps appData.selectedDate in sync with the real calendar so that the
 * blue "selected" highlight moves automatically at midnight / new week
 * / new month / new year depending on the active group.
 */
import { appData, mutate } from '../core/state.js';
import { isSamePeriod } from '../shared/datetime.js';
import { removeLoadingState } from '../shared/loader.js';
import { invalidatePillsCache } from '../components/HomeProgressPills.js';

function alignSelected() {
  const now = new Date();
  const group = appData.selectedGroup || 'daily';
  const sel = new Date(appData.selectedDate);
  if (!isSamePeriod(now, sel, group)) {
    mutate((s) => {
      s.selectedDate = now.toISOString();
    });
    // Invalidate pills cache when date changes due to period rollover
    invalidatePillsCache();
  }
}

// Run immediately and then once every hour (1 h = 3 600 000 ms)
alignSelected();
setInterval(alignSelected, 60 * 60 * 1000);

removeLoadingState();
