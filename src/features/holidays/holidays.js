/**
 * Holiday utilities – pure functions, no DOM access.
 * Manages single-day holidays and multi-day holiday periods.
 *
 * Dates are stored/compared as ISO strings in YYYY-MM-DD format (UTC portion ignored).
 */

import { getState, dispatch, Actions } from '../../core/state.js';
import { generateUniqueId } from '../../shared/common.js';
import { dateToKey } from '../../shared/datetime.js';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EXPANDED_PERIOD_DAYS = 36600;

let holidayIndexCache = {
  singles: null,
  periods: null,
  value: null,
};

function normalizeDateKey(value) {
  if (typeof value === 'string' && DATE_KEY_PATTERN.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateToKey(date);
}

function localDateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return dateToKey(date) === key ? date : null;
}

/**
 * Build the canonical holiday lookup from normalized singles and periods.
 * Bare YYYY-MM-DD values are parsed as local calendar dates rather than UTC
 * timestamps, so DST and negative-offset timezones cannot shift a holiday.
 */
export function deriveHolidayIndex(singles = [], periods = []) {
  const keys = new Set();
  const normalizedPeriods = [];

  for (const value of singles || []) {
    const key = normalizeDateKey(value);
    if (key) keys.add(key);
  }

  for (const period of periods || []) {
    let startKey = normalizeDateKey(period?.startISO);
    let endKey = normalizeDateKey(period?.endISO);
    if (!startKey || !endKey) continue;
    if (endKey < startKey) [startKey, endKey] = [endKey, startKey];

    const start = localDateFromKey(startKey);
    const end = localDateFromKey(endKey);
    if (!start || !end) continue;
    normalizedPeriods.push({ startISO: startKey, endISO: endKey });

    const cursor = new Date(start);
    let expanded = 0;
    while (cursor <= end && expanded < MAX_EXPANDED_PERIOD_DAYS) {
      keys.add(dateToKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
      expanded++;
    }
  }

  return {
    keys,
    orderedKeys: Array.from(keys).sort(),
    periods: normalizedPeriods,
  };
}

/**
 * Return the identity-memoized holiday index. Immutable state collection
 * replacements invalidate it; unrelated state changes reuse the same Set.
 */
export function getHolidayIndex(state = getState()) {
  const singles = Array.isArray(state.manualHolidayDates)
    ? state.manualHolidayDates
    : state.holidayDates || [];
  const periods = Array.isArray(state.holidayPeriods) ? state.holidayPeriods : [];

  if (
    holidayIndexCache.value &&
    holidayIndexCache.singles === singles &&
    holidayIndexCache.periods === periods
  ) {
    return holidayIndexCache.value;
  }

  const value = deriveHolidayIndex(singles, periods);
  holidayIndexCache = { singles, periods, value };
  return value;
}

/** Compatibility entrypoint: force the next read to rebuild from state. */
export function syncSinglesFromState() {
  holidayIndexCache = { singles: null, periods: null, value: null };
  return getHolidayIndex();
}

/** Call once after appData has loaded from storage to rebuild caches. */
export async function initializeHolidays() {
  return recalcHolidayDates();
}

/**
 * Recalculate `appData.holidayDates` by taking the union of
 * – manual single-day holidays (`manualSingles`) and
 * – every date within `holidayPeriods`.
 *
 * This helper is invoked every time periods or manual toggles change.
 */
export async function recalcHolidayDates() {
  const state = getState();
  const index = getHolidayIndex(state);
  const current = Array.isArray(state.holidayDates) ? state.holidayDates : [];
  if (
    current.length === index.orderedKeys.length &&
    current.every((key) => index.keys.has(key))
  ) {
    return true;
  }
  return dispatch(Actions.setHolidayDates(index.orderedKeys));
}

/**
 * Return true if the given ISO date (YYYY-MM-DD or full) is a holiday.
 */
export function isHoliday(dateISO) {
  const key = normalizeDateKey(dateISO);
  if (!key) return false;
  const index = getHolidayIndex();
  if (index.keys.has(key)) return true;
  // Extremely long ranges are not materialized into the Set; interval lookup
  // keeps membership correct while bounding startup memory and CPU.
  return index.periods.some((period) => key >= period.startISO && key <= period.endISO);
}

/**
 * Toggle a single date as holiday / non-holiday.
 */
export async function toggleSingleHoliday(dateISO) {
  const key = normalizeDateKey(dateISO);
  if (!key) return false;
  const singles = getState().manualHolidayDates || [];
  const desired = !singles.includes(key);
  const saved = await dispatch(Actions.toggleSingleHoliday(key, desired));
  if (!saved) return false;
  await recalcHolidayDates();
  return true;
}

/**
 * Add a new holiday period. Dates are inclusive.
 */
export async function addPeriod({ startISO, endISO, label = 'Holiday' }) {
  if (!startISO || !endISO) return;
  startISO = normalizeDateKey(startISO);
  endISO = normalizeDateKey(endISO);
  if (!startISO || !endISO) return false;
  if (endISO < startISO) [startISO, endISO] = [endISO, startISO];
  const saved = await dispatch(Actions.addHolidayPeriod({
    id: generateUniqueId(),
    startISO,
    endISO,
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
  let startISO = normalizeDateKey(period?.startISO);
  let endISO = normalizeDateKey(period?.endISO);
  if (!period?.id || !startISO || !endISO) return false;
  if (endISO < startISO) [startISO, endISO] = [endISO, startISO];
  const saved = await dispatch(Actions.updateHolidayPeriod({
    ...period,
    startISO,
    endISO,
  }));
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
