/**
 * Holiday utilities – pure functions, no DOM access.
 * Manages single-day holidays and multi-day holiday periods.
 *
 * Dates are stored/compared as ISO strings in YYYY-MM-DD format (UTC portion ignored).
 */

import { getState, dispatch, Actions } from '../../core/state.js';
import { generateUniqueId } from '../../shared/common.js';
import { dateToKey } from '../../shared/datetime.js';
import { isCloudBackend } from '../../core/dataBackend.js';

// Internal Set tracking manual (single-day) holiday toggles.
const manualSingles = new Set();

/** Sync internal manualSingles cache with appData.holidayDates (used on startup). */
export function syncSinglesFromState() {
  manualSingles.clear();
  const source = isCloudBackend() && Array.isArray(getState().manualHolidayDates)
    ? getState().manualHolidayDates
    : getState().holidayDates;
  if (Array.isArray(source)) {
    source.forEach((d) => manualSingles.add(d));
  }
}

/** Call once after appData has loaded from storage to rebuild caches. */
export async function initializeHolidays() {
  syncSinglesFromState();
  await recalcHolidayDates();
}

/**
 * Recalculate `appData.holidayDates` by taking the union of
 * – manual single-day holidays (`manualSingles`) and
 * – every date within `holidayPeriods`.
 *
 * This helper is invoked every time periods or manual toggles change.
 */
export async function recalcHolidayDates() {
  syncSinglesFromState();
  const union = new Set(manualSingles);

  // Expand each period (inclusive range)
  getState().holidayPeriods.forEach((p) => {
    const cur = new Date(p.startISO);
    const end = new Date(p.endISO);
    while (cur <= end) {
      union.add(dateToKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
  });

  await dispatch(Actions.setHolidayDates(Array.from(union)));
}

/**
 * Return true if the given ISO date (YYYY-MM-DD or full) is a holiday.
 */
export function isHoliday(dateISO) {
  const key = dateToKey(dateISO);
  // Quick lookup in cached list first
  if (getState().holidayDates.includes(key)) return true;

  // Fallback (should be rare): compute against periods
  return getState().holidayPeriods.some((p) => key >= p.startISO && key <= p.endISO);
}

/**
 * Toggle a single date as holiday / non-holiday.
 */
export async function toggleSingleHoliday(dateISO) {
  const key = dateToKey(dateISO);
  let desired;
  if (manualSingles.has(key)) {
    manualSingles.delete(key);
    desired = false;
  } else {
    manualSingles.add(key);
    desired = true;
  }
  const saved = await dispatch(Actions.toggleSingleHoliday(key, desired));
  if (!saved) {
    syncSinglesFromState();
    return false;
  }
  await recalcHolidayDates();
  return true;
}

/**
 * Add a new holiday period. Dates are inclusive.
 */
export async function addPeriod({ startISO, endISO, label = 'Holiday' }) {
  if (!startISO || !endISO) return;
  if (endISO < startISO) [startISO, endISO] = [endISO, startISO];
  const saved = await dispatch(Actions.addHolidayPeriod({
    id: generateUniqueId(),
    startISO: dateToKey(startISO),
    endISO: dateToKey(endISO),
    label,
  }));
  if (!saved) return false;
  await recalcHolidayDates();
  return true;
}

/** Remove a period by id */
export async function deletePeriod(id) {
  const saved = await dispatch(Actions.deleteHolidayPeriod(id));
  if (!saved) return false;
  await recalcHolidayDates();
  return true;
}

/** Update a period by id */
export async function updatePeriod(period) {
  const saved = await dispatch(Actions.updateHolidayPeriod(period));
  if (!saved) return false;
  await recalcHolidayDates();
  return true;
}

/** Delete all periods */
export async function deleteAllPeriods() {
  const saved = await dispatch(Actions.deleteAllHolidayPeriods());
  if (!saved) return false;
  await recalcHolidayDates();
  return true;
}
