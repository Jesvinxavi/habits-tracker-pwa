/**
 * Shared label formatting for programs, so the tile and the details modal
 * describe the same block in the same words.
 */

/**
 * Formats a single date as "20 Oct", with the year appended when asked.
 *
 * The day is placed before the month explicitly rather than leaving the order to
 * toLocaleDateString, which follows the ambient locale and renders "Oct 20" under
 * en-US. Only the month name is localised.
 * @param {Date} date UTC-anchored date.
 * @param {boolean} withYear Whether to append the year.
 * @returns {string} Formatted date.
 */
function formatDay(date, withYear) {
  const month = date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
  const day = date.getUTCDate();
  return withYear ? `${day} ${month} ${date.getUTCFullYear()}` : `${day} ${month}`;
}

/**
 * Formats a program's date range, e.g. "20 Oct – 13 Dec". The year is appended
 * when the block spans a year boundary.
 * @param {string} startISO Start date key.
 * @param {string} endISO End date key.
 * @returns {string} Human-readable range.
 */
export function dateRangeLabel(startISO, endISO) {
  const start = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return '';

  const spansYears = start.getUTCFullYear() !== end.getUTCFullYear();
  return `${formatDay(start, spansYears)} – ${formatDay(end, spansYears)}`;
}

/**
 * Builds the pill text describing where the user is in the program.
 * @param {{phase: string, week: number, totalWeeks: number, daysUntilStart: number}} progress
 *   Computed progress figures.
 * @returns {string} Pill label.
 */
export function weekLabel({ phase, week, totalWeeks, daysUntilStart }) {
  if (phase === 'before') {
    return daysUntilStart === 1 ? 'Starts in 1 day' : `Starts in ${daysUntilStart} days`;
  }
  if (phase === 'after') return 'Completed';
  return `Week ${week} of ${totalWeeks}`;
}

/**
 * Formats a date key as a short weekday, e.g. "Mon".
 * @param {string} iso Date key, YYYY-MM-DD.
 * @returns {string} Three-letter weekday, or an empty string for an invalid key.
 */
export function shortDayLabel(iso) {
  const date = new Date(`${String(iso).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return '';
  return date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
}

/**
 * Formats a date key as a weekday-led label, e.g. "Monday 20 Oct".
 * @param {string} iso Date key, YYYY-MM-DD.
 * @returns {string} Human-readable day, or an empty string for an invalid key.
 */
export function dayLabel(iso) {
  const date = new Date(`${String(iso).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return '';
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' });
  return `${weekday} ${formatDay(date, false)}`;
}
