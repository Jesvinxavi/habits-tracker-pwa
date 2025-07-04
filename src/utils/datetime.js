/**
 * Date-time utilities (framework-agnostic, no DOM).
 * -------------------------------------------------
 * Currently only exposes getISOWeekNumber() but keep this module for future
 * calendar helpers so we avoid re-defining them across files.
 */

/**
 * Calculate ISO-8601 week number (1-53) for the provided date.
 * Thursday is considered the first week-day per ISO definition.
 * @param {Date} date – JS Date object
 * @returns {number} ISO week number (1-53)
 */
export function getISOWeekNumber(date) {
  const tmp = new Date(date.getTime());
  tmp.setHours(0, 0, 0, 0);
  // Set to Thursday in current week – Thursday determines the week year.
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
}

/**
 * Return true if two dates belong to the same logical period for the given
 * habit group.
 * @param {Date} a
 * @param {Date} b
 * @param {'daily'|'weekly'|'monthly'|'yearly'} group
 */
export function isSamePeriod(a, b, group = 'daily') {
  switch (group) {
    case 'weekly':
      return a.getFullYear() === b.getFullYear() && getISOWeekNumber(a) === getISOWeekNumber(b);
    case 'monthly':
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
    case 'yearly':
      return a.getFullYear() === b.getFullYear();
    case 'daily':
    default:
      return a.toDateString() === b.toDateString();
  }
}

/**
 * Return true if two Date objects refer to the same calendar day.
 * @param {Date} a
 * @param {Date} b
 */
export function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

export function mondayStart(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun,…6=Sat
  const diff = dow === 0 ? -6 : 1 - dow; // shift so Monday becomes start of week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate full week difference (Monday-based) between two dates.
 * @param {Date} a – anchor (earlier) date
 * @param {Date} b – later date to compare
 */
export function weeksBetween(a, b) {
  const msWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((mondayStart(b) - mondayStart(a)) / msWeek);
}

/**
 * Mutate `date` forward/backward by one logical unit of the selected group.
 * dir = +1 for next period, -1 for previous.
 */
export function advanceDate(date, group = 'daily', dir = 1) {
  switch (group) {
    case 'weekly':
      date.setDate(date.getDate() + dir * 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + dir);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + dir);
      break;
    case 'daily':
    default:
      date.setDate(date.getDate() + dir);
  }
  return date;
}

/**
 * Convert a date to local ISO format (YYYY-MM-DD) to avoid timezone issues
 * This ensures consistent date handling across the fitness calendar and rest day toggles
 */
export function getLocalISODate(date) {
  let result;

  if (typeof date === 'string') {
    // If it's an ISO string, parse it carefully to avoid timezone shifts
    if (date.includes('T')) {
      // Full ISO string - extract just the date part to avoid timezone conversion
      result = date.slice(0, 10); // Return YYYY-MM-DD part directly
    } else {
      // Already in YYYY-MM-DD format
      result = date;
    }
  } else {
    // Date object - extract components directly to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    result = `${year}-${month}-${day}`;
  }

  return result;
}
