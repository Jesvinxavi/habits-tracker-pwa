/**
 * The one place a recorded session is turned into numbers.
 *
 * Four call sites used to convert a duration to minutes, and three of them used
 * `parseInt`, which silently discards the fraction: an hour and a half was
 * banked as one hour, while the best-session card beside it — the fourth,
 * correct conversion — displayed the true ninety minutes. Everything that reads
 * a record now comes through here.
 *
 * Two ideas the rest of the fitness statistics rest on:
 *
 * - **A session's date is when it happened, not when it was typed in.**
 *   Back-filling last month's runs is a supported flow, so `date` is the
 *   calendar day and `timestamp` only orders sessions within one.
 * - **A session with no metrics is not a zero.** The quick-record button
 *   deliberately writes a session with no duration and no sets. Averaging it in
 *   as nothing drags every average toward zero, so it is counted separately.
 */

import { dateFromStoredValue } from '../../../shared/datetime.js';

/**
 * Converts a stored numeric-ish value to a finite number.
 * @param {unknown} value Number or numeric string.
 * @returns {number} The value, or 0 when it is not a number.
 */
function toNumber(value) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * A session's duration in minutes, keeping the fraction.
 * @param {object} record A recorded session.
 * @returns {number} Minutes, or 0 when the session carries no duration.
 */
export function durationMinutes(record) {
  if (record?.duration == null || record.duration === '') return 0;
  const value = toNumber(record.duration);
  if (record.durationUnit === 'hours') return value * 60;
  if (record.durationUnit === 'seconds') return value / 60;
  return value;
}

/**
 * Reports whether a session records how long it took.
 * @param {object} record A recorded session.
 * @returns {boolean} True when a duration is present.
 */
export function hasDuration(record) {
  return record?.duration != null && record.duration !== '' && durationMinutes(record) > 0;
}

/**
 * Reports whether a session records sets.
 * @param {object} record A recorded session.
 * @returns {boolean} True when at least one set is present.
 */
export function hasSets(record) {
  return Array.isArray(record?.sets) && record.sets.length > 0;
}

/**
 * Reports whether a session carries any metric at all.
 *
 * The negation is the quick-record: logged to say "I did this", with the
 * details left for later or never.
 * @param {object} record A recorded session.
 * @returns {boolean} True when the session has a duration or sets.
 */
export function hasMetrics(record) {
  return hasDuration(record) || hasSets(record);
}

/**
 * Reports whether a set carries external load, as opposed to bodyweight.
 * @param {object} set A recorded set.
 * @returns {boolean} True when a weight was recorded.
 */
export function isWeightedSet(set) {
  return Boolean(set?.unit) && set.unit !== 'none' && toNumber(set.value) > 0;
}

/**
 * A session's total volume: weight times reps, summed across its sets.
 * @param {object} record A recorded session.
 * @returns {number} Volume in the sets' own weight unit, or 0.
 */
export function sessionVolume(record) {
  if (!hasSets(record)) return 0;
  return record.sets.reduce((sum, set) => {
    if (!isWeightedSet(set)) return sum;
    return sum + toNumber(set.value) * toNumber(set.reps);
  }, 0);
}

/**
 * A session's total reps across all its sets.
 * @param {object} record A recorded session.
 * @returns {number} Reps, or 0.
 */
export function sessionReps(record) {
  if (!hasSets(record)) return 0;
  return record.sets.reduce((sum, set) => sum + toNumber(set.reps), 0);
}

/**
 * The heaviest weight lifted in a session.
 * @param {object} record A recorded session.
 * @returns {number} Weight in the sets' own unit, or 0 when bodyweight only.
 */
export function sessionMaxWeight(record) {
  if (!hasSets(record)) return 0;
  return record.sets.reduce(
    (max, set) => (isWeightedSet(set) ? Math.max(max, toNumber(set.value)) : max),
    0
  );
}

/**
 * Estimates a one-rep max from a set, by the Epley formula.
 *
 * Widely used because it is simple and close enough in the 1–10 rep range that
 * lifters actually train in; it is an estimate and is labelled as one.
 * @param {number} weight Weight lifted.
 * @param {number} reps Repetitions completed.
 * @returns {number} Estimated one-rep max in the same unit as the weight.
 */
export function estimatedOneRepMax(weight, reps) {
  const load = toNumber(weight);
  const count = toNumber(reps);
  if (load <= 0 || count <= 0) return 0;
  if (count === 1) return load;
  return load * (1 + count / 30);
}

/**
 * The best estimated one-rep max in a session.
 * @param {object} record A recorded session.
 * @returns {number} Estimated one-rep max, or 0.
 */
export function sessionOneRepMax(record) {
  if (!hasSets(record)) return 0;
  return record.sets.reduce(
    (max, set) =>
      isWeightedSet(set) ? Math.max(max, estimatedOneRepMax(set.value, set.reps)) : max,
    0
  );
}

/**
 * The weight unit a session's sets were recorded in.
 * @param {object} record A recorded session.
 * @returns {string} Unit, or an empty string for bodyweight-only sessions.
 */
export function sessionWeightUnit(record) {
  if (!hasSets(record)) return '';
  const weighted = record.sets.find(isWeightedSet);
  return weighted?.unit || '';
}

/**
 * The calendar day a session happened on.
 *
 * Falls back to the moment it was written only when the record predates the
 * date field, which is the one case where they are the same thing.
 * @param {object} record A recorded session.
 * @returns {Date|null} Local midnight, or null when neither field parses.
 */
export function recordDate(record) {
  const fromDate = dateFromStoredValue(record?.date);
  if (fromDate) return new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const fromTimestamp = dateFromStoredValue(record?.timestamp);
  if (!fromTimestamp) return null;
  return new Date(
    fromTimestamp.getFullYear(),
    fromTimestamp.getMonth(),
    fromTimestamp.getDate()
  );
}

/**
 * The local date key a session happened on.
 * @param {object} record A recorded session.
 * @returns {string} `YYYY-MM-DD`, or an empty string.
 */
export function recordDateKey(record) {
  if (typeof record?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    return record.date;
  }
  const date = recordDate(record);
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Orders sessions oldest first by the day they happened, then by when they were
 * written, so several sessions on one day keep the order they were logged in.
 * @param {object} left A recorded session.
 * @param {object} right A recorded session.
 * @returns {number} Comparator result.
 */
export function compareRecords(left, right) {
  const leftKey = recordDateKey(left);
  const rightKey = recordDateKey(right);
  if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1;
  return String(left?.timestamp || '').localeCompare(String(right?.timestamp || ''));
}

/**
 * Filters sessions to those performed within the last N calendar days.
 *
 * The window includes today and reaches back N−1 further days, so "last 30
 * days" is thirty dated days rather than thirty days plus whatever fraction of
 * a day the clock happens to hold.
 * @param {object[]} records Sessions.
 * @param {number} days Window length in days.
 * @param {Date} [today] The current date.
 * @returns {object[]} Sessions inside the window.
 */
export function recordsWithinDays(records, days, today = new Date()) {
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return records.filter((record) => {
    const date = recordDate(record);
    return date != null && date >= cutoff;
  });
}

/**
 * Averages a metric over only the sessions that carry it.
 * @param {object[]} records Sessions.
 * @param {(record: object) => boolean} carries Whether a session has the metric.
 * @param {(record: object) => number} measure The metric.
 * @returns {{total: number, count: number, average: number}} Totals and mean.
 */
export function averageOver(records, carries, measure) {
  let total = 0;
  let count = 0;
  for (const record of records) {
    if (!carries(record)) continue;
    total += measure(record);
    count += 1;
  }
  return { total, count, average: count > 0 ? total / count : 0 };
}
