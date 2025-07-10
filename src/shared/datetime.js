/**
 * Date-time utilities (framework-agnostic, no DOM).
 * -------------------------------------------------
 * All date/time formatting, conversion, and calculation functions.
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
 * Get the start and end dates (inclusive) for a given period containing the specified date.
 * @param {'day'|'week'|'month'|'year'} period - The period type
 * @param {Date} date - The date to find the period for (defaults to today)
 * @returns {{start: Date, end: Date}} - Start and end dates of the period (inclusive)
 */
export function getPeriodBounds(period, date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // Normalize to start of day

  switch (period) {
    case 'day':
      return {
        start: new Date(d),
        end: new Date(d),
      };

    case 'week':
      // ISO week: Monday to Sunday
      const monday = mondayStart(d);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        start: monday,
        end: sunday,
      };

    case 'month':
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0); // Last day of month
      return {
        start: monthStart,
        end: monthEnd,
      };

    case 'year':
      const yearStart = new Date(d.getFullYear(), 0, 1);
      const yearEnd = new Date(d.getFullYear(), 11, 31);
      return {
        start: yearStart,
        end: yearEnd,
      };

    default:
      throw new Error(`Unknown period: ${period}`);
  }
}

/**
 * Generator function that yields each day in a date range as YYYY-MM-DD strings.
 * Uses lazy evaluation to avoid creating large arrays.
 * @param {Date} start - Start date (inclusive)
 * @param {Date} end - End date (inclusive)
 * @yields {string} YYYY-MM-DD date string
 */
export function* eachDayInRange(start, end) {
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    yield dateToKey(current);
    current.setDate(current.getDate() + 1);
  }
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

/**
 * Convert a Date object or ISO string to a calendar-key string (YYYY-MM-DD) in local time.
 * This avoids the UTC shift that Date.toISOString introduces.
 * Consolidated from holidays.js to centralize date conversion logic.
 */
export function dateToKey(dateObj) {
  if (!(dateObj instanceof Date)) dateObj = new Date(dateObj);
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format duration in minutes to readable format
 * Consolidated from multiple UI files to centralize duration formatting
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration string
 */
export function formatDuration(minutes) {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  } else if (minutes < 1440) {
    // Less than 24 hours
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  } else {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
}

/**
 * Format elapsed time in seconds to MM:SS format
 * @param {number} seconds - Total seconds elapsed
 * @returns {string} Formatted time string (MM:SS)
 */
export function formatElapsedTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format last performed/completed date in human-readable format
 * Consolidated from multiple UI files to centralize relative date formatting
 * @param {string|number} timestamp - ISO timestamp or timestamp number
 * @returns {string} Human-readable relative date
 */
export function formatLastPerformed(timestamp) {
  if (!timestamp) return 'Never';

  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

/**
 * Format a date to a readable format (DD MMM YYYY)
 * Consolidated from holidays manage.js
 * @param {string} key - YYYY-MM-DD date string
 * @returns {string} Formatted date string
 */
export function formatDate(key) {
  const d = new Date(key);
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getLocalMidnightISOString(date) {
  // Re-use getLocalISODate to strip any time portion and avoid TZ shifts.
  const isoDate = getLocalISODate(date);
  return `${isoDate}T00:00:00.000Z`;
}

export const toKey = dateToKey;

/**
 * Convert a YYYY-MM-DD key back to a Date object in local time
 * (midnight at the user's locale).
 * Accepts Date or key for convenience.
 */
export function fromKey(key) {
  if (key instanceof Date) return new Date(key); // already Date
  if (typeof key !== 'string') return new Date(NaN);
  const [y, m, d] = key.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Get the start of the next period.
 */
export function getNextPeriodStart(date, group) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    if (group === 'daily') {
        d.setDate(d.getDate() + 1);
    } else if (group === 'weekly') {
        d.setDate(d.getDate() - d.getDay() + 8); // Go to the next Sunday
    } else if (group === 'monthly') {
        d.setMonth(d.getMonth() + 1, 1); // Go to the first day of the next month
    } else if (group === 'yearly') {
        d.setFullYear(d.getFullYear() + 1, 0, 1); // Go to Jan 1 of next year
    }
    return d;
}
