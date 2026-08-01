/* Auto-advance selectedDate to always represent the current period.
 * -------------------------------------------------------------------
 * This module has no exports; importing it once sets up a timer that
 * keeps appData.selectedDate in sync with the real calendar so that the
 * blue "selected" highlight moves automatically at midnight / new week
 * / new month / new year depending on the active group.
 */
import { getState, dispatch, Actions } from '../core/state.js';
import {
  getLocalMidnightISOString,
  getNextPeriodStart,
  isSamePeriod,
} from '../shared/datetime.js';
import { invalidatePillsCache } from './home/components/HomeProgressPills.js';

/**
 * @param {boolean} [realign] Whether a selection outside the current period may
 *   be pulled back to it. Only a timer wake-up — a real period rollover — is
 *   allowed to. This module is imported from the deferred idle chunk, so its
 *   first run lands at an unpredictable point after boot; realigning there
 *   silently discards a date the user picked in the meantime, and overrides the
 *   deliberately-earlier period that startup's smart date selection chose for
 *   the weekly, monthly, and yearly groups. Boot has already placed the
 *   selection, so there is nothing for the first run to correct.
 */
function alignSelectedAndScheduleNext(realign = true) {
  const state = getState();
  const now = new Date();
  const group = state.selectedGroup || 'daily';
  const sel = new Date(state.selectedDate);

  // Align date if it's out of the current period
  if (realign && !isSamePeriod(now, sel, group)) {
    // Use timezone-safe local midnight ISO to prevent timezone issues
    dispatch(Actions.setSelectedDate(getLocalMidnightISOString(now)));
    invalidatePillsCache();
  }

  // Schedule the next check
  const nextPeriodStart = getNextPeriodStart(now, group);
  const timeUntilNextPeriod = nextPeriodStart.getTime() - now.getTime() + 1000; // Add a 1s buffer

  // The wake-up takes no argument, so it realigns by default.
  setTimeout(alignSelectedAndScheduleNext, timeUntilNextPeriod);
}

// Schedule the first rollover check. See above for why this run does not align.
alignSelectedAndScheduleNext(false);
