/**
 * Program progress maths.
 *
 * Pure functions only — no DOM access and no state reads, so every number the
 * program tile shows is unit-testable with a fixed `todayISO`.
 *
 * Dates are handled as YYYY-MM-DD strings and converted with an explicit UTC
 * time component. Parsing a bare date string leaves the time zone up to the
 * engine, and a one-day drift here would silently corrupt every figure on the
 * tile, so `new Date(iso)` is never used on its own.
 */

const MS_PER_DAY = 86400000;

/**
 * Converts a YYYY-MM-DD key to a UTC-anchored timestamp.
 * @param {string} iso Date key.
 * @returns {number} Milliseconds since the epoch at UTC midnight, or NaN.
 */
function toUtcTime(iso) {
  const key = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return NaN;
  return Date.parse(`${key}T00:00:00.000Z`);
}

/**
 * Converts a UTC-anchored timestamp back to a YYYY-MM-DD key.
 * @param {number} time Milliseconds since the epoch.
 * @returns {string} Date key.
 */
function toKey(time) {
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Counts the days in an inclusive date range.
 * @param {string} startISO First day, YYYY-MM-DD.
 * @param {string} endISO Last day, YYYY-MM-DD.
 * @returns {number} Day count, 0 when the range is invalid or inverted.
 */
export function inclusiveDayCount(startISO, endISO) {
  const start = toUtcTime(startISO);
  const end = toUtcTime(endISO);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  // Both ends are UTC midnight, so this division is exact across DST boundaries.
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

/**
 * Lists every date in the range whose weekday is scheduled.
 * @param {string} startISO First day, YYYY-MM-DD.
 * @param {string} endISO Last day, YYYY-MM-DD.
 * @param {Array<{dayOfWeek: number}>} scheduledDays Schedule entries, 0 = Sunday.
 * @param {number[]} [restDays] Weekdays the program treats as rest, excluded outright.
 * @returns {string[]} Planned dates in ascending order.
 */
export function plannedDates(startISO, endISO, scheduledDays = [], restDays = []) {
  const total = inclusiveDayCount(startISO, endISO);
  if (total === 0 || scheduledDays.length === 0) return [];

  const rest = new Set(restDays.map(Number));
  const weekdays = new Set(
    scheduledDays.map((day) => Number(day.dayOfWeek)).filter((day) => !rest.has(day))
  );
  if (weekdays.size === 0) return [];

  const start = toUtcTime(startISO);
  const dates = [];
  for (let offset = 0; offset < total; offset += 1) {
    const time = start + offset * MS_PER_DAY;
    if (weekdays.has(new Date(time).getUTCDay())) dates.push(toKey(time));
  }
  return dates;
}

/**
 * Splits the program into consecutive seven-day weeks measured from the start date.
 * @param {string} startISO First day, YYYY-MM-DD.
 * @param {string} endISO Last day, YYYY-MM-DD.
 * @returns {Array<{start: string, end: string, dates: string[]}>} One entry per week.
 */
export function programWeeks(startISO, endISO) {
  const total = inclusiveDayCount(startISO, endISO);
  if (total === 0) return [];
  const start = toUtcTime(startISO);
  const weeks = [];
  for (let offset = 0; offset < total; offset += 7) {
    const dates = [];
    for (let day = offset; day < Math.min(offset + 7, total); day += 1) {
      dates.push(toKey(start + day * MS_PER_DAY));
    }
    weeks.push({ start: dates[0], end: dates[dates.length - 1], dates });
  }
  return weeks;
}

/**
 * Works out which week of the program a given day falls in.
 * @param {string} startISO Program start, YYYY-MM-DD.
 * @param {string} endISO Program end, YYYY-MM-DD.
 * @param {string} todayISO The day to place, YYYY-MM-DD.
 * @returns {{week: number, totalWeeks: number, phase: 'before'|'during'|'after', daysUntilStart: number}}
 *   Week position, clamped to the program's bounds.
 */
export function currentWeek(startISO, endISO, todayISO) {
  const totalDays = inclusiveDayCount(startISO, endISO);
  const totalWeeks = Math.ceil(totalDays / 7);
  const start = toUtcTime(startISO);
  const end = toUtcTime(endISO);
  const today = toUtcTime(todayISO);

  if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(today) || totalDays === 0) {
    return { week: 1, totalWeeks: 0, phase: 'during', daysUntilStart: 0 };
  }

  if (today < start) {
    return {
      week: 1,
      totalWeeks,
      phase: 'before',
      daysUntilStart: Math.round((start - today) / MS_PER_DAY),
    };
  }

  if (today > end) {
    return { week: totalWeeks, totalWeeks, phase: 'after', daysUntilStart: 0 };
  }

  const elapsedDays = Math.round((today - start) / MS_PER_DAY);
  const week = Math.min(Math.max(Math.floor(elapsedDays / 7) + 1, 1), totalWeeks);
  return { week, totalWeeks, phase: 'during', daysUntilStart: 0 };
}

/**
 * Computes a program's adherence figures.
 *
 * Progress is workout-based rather than time-based: a user who is behind
 * schedule sees a bar reflecting sessions actually done.
 *
 * @param {Object} input Computation input.
 * @param {{startDate: string, endDate: string, scheduledDays: Array<{dayOfWeek: number}>}} input.program
 *   The program to measure.
 * @param {string} input.todayISO Today's date key.
 * @param {Object<string, Array>} [input.recordedActivities] Map of date key to records.
 * @param {Object<string, boolean>} [input.restDays] Map of date key to rest-day flag.
 * @returns {{plannedWorkouts: number, completedWorkouts: number, percent: number,
 *   week: number, totalWeeks: number, phase: string, daysUntilStart: number}} Progress figures.
 */
export function computeProgramProgress({
  program,
  todayISO,
  recordedActivities = {},
  restDays = {},
} = {}) {
  const empty = {
    plannedWorkouts: 0,
    completedWorkouts: 0,
    percent: 0,
    week: 1,
    totalWeeks: 0,
    phase: 'during',
    daysUntilStart: 0,
  };
  if (!program) return empty;

  const position = currentWeek(program.startDate, program.endDate, todayISO);
  const today = toUtcTime(todayISO);
  const programRestDays = program.restDays || [];
  const restWeekdays = new Set(programRestDays.map(Number));

  /**
   * A date counts as trained when it is not in the future, is not a rest day at
   * either the program or the calendar level, and holds at least one record.
   * @param {string} date Date key.
   * @returns {boolean} Whether the date counts.
   */
  const trained = (date) => {
    if (Number.isNaN(today) || toUtcTime(date) > today) return false;
    if (restDays[date]) return false;
    if (restWeekdays.has(new Date(toUtcTime(date)).getUTCDay())) return false;
    return (recordedActivities[date] || []).length > 0;
  };

  const pinned = plannedDates(
    program.startDate,
    program.endDate,
    program.scheduledDays,
    programRestDays
  );

  let plannedWorkouts = pinned.length;
  let completedWorkouts = pinned.filter(trained).length;

  // Freeform adds a weekly quota of sessions that may fall on any non-pinned,
  // non-rest day. Credit is capped per week so a burst of sessions in one week
  // cannot cover a later week's target.
  if (program.scheduleMode === 'freeform') {
    const quotaPerWeek = (program.anytimeRoutines || []).reduce(
      (sum, entry) => sum + Math.max(1, Number(entry.count) || 1),
      0
    );
    if (quotaPerWeek > 0) {
      const pinnedSet = new Set(pinned);
      programWeeks(program.startDate, program.endDate).forEach((week) => {
        plannedWorkouts += quotaPerWeek;
        const flexible = week.dates.filter((date) => !pinnedSet.has(date) && trained(date)).length;
        completedWorkouts += Math.min(quotaPerWeek, flexible);
      });
    }
  }

  const percent =
    plannedWorkouts === 0 ? 0 : Math.round((completedWorkouts / plannedWorkouts) * 100);

  return { ...position, plannedWorkouts, completedWorkouts, percent };
}
