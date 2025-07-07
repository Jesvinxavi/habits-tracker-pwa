/**
 * Holiday utilities – pure functions, no DOM access.
 * Manages single-day holidays and multi-day holiday periods.
 *
 * Dates are stored/compared as ISO strings in YYYY-MM-DD format (UTC portion ignored).
 */

import { appData, mutate } from '../../core/state.js';
import { generateUniqueId } from '../../shared/common.js';
import { dateToKey } from '../../shared/datetime.js';

// Internal Set tracking manual (single-day) holiday toggles.
const manualSingles = new Set();

/** Sync internal manualSingles cache with appData.holidayDates (used on startup). */
export function syncSinglesFromState() {
  manualSingles.clear();
  if (Array.isArray(appData.holidayDates)) {
    appData.holidayDates.forEach((d) => manualSingles.add(d));
  }
}

/** Call once after appData has loaded from storage to rebuild caches. */
export function initializeHolidays() {
  syncSinglesFromState();
  recalcHolidayDates();
}

/**
 * Recalculate `appData.holidayDates` by taking the union of
 * – manual single-day holidays (`manualSingles`) and
 * – every date within `holidayPeriods`.
 *
 * This helper is invoked every time periods or manual toggles change.
 */
export function recalcHolidayDates() {
  const union = new Set(manualSingles);

  // Expand each period (inclusive range)
  appData.holidayPeriods.forEach((p) => {
    const cur = new Date(p.startISO);
    const end = new Date(p.endISO);
    while (cur <= end) {
      union.add(dateToKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
  });

  mutate((s) => {
    s.holidayDates = Array.from(union);
  });
}

/**
 * Return true if the given ISO date (YYYY-MM-DD or full) is a holiday.
 */
export function isHoliday(dateISO) {
  const key = dateToKey(dateISO);
  // Quick lookup in cached list first
  if (appData.holidayDates.includes(key)) return true;

  // Fallback (should be rare): compute against periods
  return appData.holidayPeriods.some((p) => key >= p.startISO && key <= p.endISO);
}

/**
 * Toggle a single date as holiday / non-holiday.
 */
export function toggleSingleHoliday(dateISO) {
  const key = dateToKey(dateISO);
  if (manualSingles.has(key)) {
    manualSingles.delete(key);
  } else {
    manualSingles.add(key);
  }
  recalcHolidayDates();
}

/**
 * Add a new holiday period. Dates are inclusive.
 */
export function addPeriod({ startISO, endISO, label = 'Holiday' }) {
  if (!startISO || !endISO) return;
  if (endISO < startISO) [startISO, endISO] = [endISO, startISO];
  mutate((s) => {
    s.holidayPeriods.push({
      id: generateUniqueId(),
      startISO: dateToKey(startISO),
      endISO: dateToKey(endISO),
      label,
    });
  });
  recalcHolidayDates();
}

/** Remove a period by id */
export function deletePeriod(id) {
  mutate((s) => {
    s.holidayPeriods = s.holidayPeriods.filter((p) => p.id !== id);
  });
  recalcHolidayDates();
}

/** Delete all periods */
export function deleteAllPeriods() {
  mutate((s) => {
    s.holidayPeriods = [];
  });
  recalcHolidayDates();
}

// dateToKey function moved to datetime.js for centralization
