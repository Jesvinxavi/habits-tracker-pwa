/* Auto-advance selectedDate to always represent the current period.
 * -------------------------------------------------------------------
 * This module has no exports; importing it once sets up a timer that
 * keeps appData.selectedDate in sync with the real calendar so that the
 * blue "selected" highlight moves automatically at midnight / new week
 * / new month / new year depending on the active group.
 */
import { getState, dispatch, Actions } from '../core/state.js';
import { isSamePeriod, getNextPeriodStart } from '../shared/datetime.js';
import { invalidatePillsCache } from './home/components/HomeProgressPills.js';

function alignSelectedAndScheduleNext() {
  const state = getState();
  const now = new Date();
  const group = state.selectedGroup || 'daily';
  const sel = new Date(state.selectedDate);

  // Align date if it's out of the current period
  if (!isSamePeriod(now, sel, group)) {
    // Use timezone-safe local midnight ISO to prevent timezone issues
    import('../shared/datetime.js').then(({ getLocalMidnightISOString }) => {
      dispatch(Actions.setSelectedDate(getLocalMidnightISOString(now)));
      invalidatePillsCache();
    });
  }

  // Schedule the next check
  const nextPeriodStart = getNextPeriodStart(now, group);
  const timeUntilNextPeriod = nextPeriodStart.getTime() - now.getTime() + 1000; // Add a 1s buffer

  setTimeout(alignSelectedAndScheduleNext, timeUntilNextPeriod);
}

// Run the initial alignment and schedule the next one
alignSelectedAndScheduleNext();
