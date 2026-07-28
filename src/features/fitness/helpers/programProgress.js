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
 *
 * The unit of progress is a **slot**: one pinned routine or activity on one
 * date. A slot is satisfied by a session anywhere in its week — the day a thing
 * is pinned to is where it belongs, not the only day it counts. Which session
 * fills which slot is decided by allocation rather than by a per-date lookup,
 * so nothing is credited twice and the week view can say where a tick came from.
 */

const MS_PER_DAY = 86400000;

/**
 * The order slots claim sessions in. Each pass sweeps every still-open slot
 * before the next one runs, so an earlier pass always outranks a later one.
 *
 * A slot is only ever satisfied by a session that holds its activity — or, for
 * a routine slot, one of that routine's activities. Training that has nothing
 * to do with the plan earns nothing: a slot is a specific piece of work, and
 * ticking Tuesday's squats off because the user swam on Tuesday says something
 * untrue. What the day itself is only decides *which* matching session a slot
 * takes: its own day first, then anywhere else in the week.
 */
const CLAIM_PASSES = [{ scope: 'day' }, { scope: 'week' }];

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
 * Reads the weekday of a date key without leaving the UTC anchor.
 * @param {string} iso Date key.
 * @returns {number} Weekday index, 0 = Sunday, or NaN for an invalid key.
 */
export function weekdayOf(iso) {
  const time = toUtcTime(iso);
  return Number.isNaN(time) ? NaN : new Date(time).getUTCDay();
}

/**
 * The Monday of the calendar week a date falls in.
 * @param {string} iso Date key, YYYY-MM-DD.
 * @returns {string} The week's Monday, or an empty string for an invalid key.
 */
export function weekStart(iso) {
  const time = toUtcTime(iso);
  if (Number.isNaN(time)) return '';
  // getUTCDay is Sunday-based, so shift to a Monday-based index first.
  return toKey(time - ((weekdayOf(iso) + 6) % 7) * MS_PER_DAY);
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
 * Splits the program into calendar weeks, Monday to Sunday.
 *
 * A block that starts mid-week gets a short first week rather than shifting
 * every later week off the calendar: "Week 2" has to mean the same span here as
 * it does on a wall planner, or a program starting on a Thursday would report
 * its weeks a few days out from the ones the user is living in. The last week is
 * short for the same reason.
 * @param {string} startISO First day, YYYY-MM-DD.
 * @param {string} endISO Last day, YYYY-MM-DD.
 * @returns {Array<{start: string, end: string, dates: string[]}>} One entry per
 *   calendar week, holding only the dates inside the program.
 */
export function programWeeks(startISO, endISO) {
  if (inclusiveDayCount(startISO, endISO) === 0) return [];
  const start = toUtcTime(startISO);
  const end = toUtcTime(endISO);

  // Monday of the week the program starts in.
  const anchor = toUtcTime(weekStart(startISO));

  const weeks = [];
  for (let monday = anchor; monday <= end; monday += 7 * MS_PER_DAY) {
    const dates = [];
    for (let day = 0; day < 7; day += 1) {
      const time = monday + day * MS_PER_DAY;
      if (time < start || time > end) continue;
      dates.push(toKey(time));
    }
    if (dates.length > 0) weeks.push({ start: dates[0], end: dates[dates.length - 1], dates });
  }
  return weeks;
}

/**
 * Works out which calendar week of the program a given day falls in.
 * @param {string} startISO Program start, YYYY-MM-DD.
 * @param {string} endISO Program end, YYYY-MM-DD.
 * @param {string} todayISO The day to place, YYYY-MM-DD.
 * @returns {{week: number, totalWeeks: number, phase: 'before'|'during'|'after', daysUntilStart: number}}
 *   Week position, clamped to the program's bounds.
 */
export function currentWeek(startISO, endISO, todayISO) {
  const weeks = programWeeks(startISO, endISO);
  const totalWeeks = weeks.length;
  const start = toUtcTime(startISO);
  const end = toUtcTime(endISO);
  const today = toUtcTime(todayISO);

  if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(today) || totalWeeks === 0) {
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

  const key = String(todayISO).slice(0, 10);
  const index = weeks.findIndex((week) => key >= week.start && key <= week.end);
  return { week: index === -1 ? 1 : index + 1, totalWeeks, phase: 'during', daysUntilStart: 0 };
}

/**
 * Groups one schedule's entries by weekday, dropping the program's rest weekdays.
 * @param {Array<{dayOfWeek: number, routineId?: string, activityId?: string}>} entries Schedule entries.
 * @param {number[]} restDays Weekdays the program treats as rest.
 * @returns {Map<number, Array<{type: string, id: string}>>} Items by weekday.
 */
function itemsByWeekday(entries = [], restDays = []) {
  const rest = new Set(restDays.map(Number));
  const byWeekday = new Map();
  entries.forEach((entry) => {
    const dayOfWeek = Number(entry.dayOfWeek);
    if (rest.has(dayOfWeek)) return;
    if (!byWeekday.has(dayOfWeek)) byWeekday.set(dayOfWeek, []);
    byWeekday
      .get(dayOfWeek)
      .push(
        entry.activityId
          ? { type: 'activity', id: entry.activityId }
          : { type: 'routine', id: entry.routineId }
      );
  });
  return byWeekday;
}

/**
 * Lays a program's schedule history out in order: each superseded schedule over
 * the dates it was in force, then the current one over everything after them.
 *
 * Editing a running program does not rewrite its past. The schedule in force
 * until the edit is closed off as a phase, so a week that has already happened
 * keeps the plan it was actually measured against — including work the edit
 * deleted — and the new plan applies from the edit onwards.
 *
 * @param {object} program The program, with an optional `schedulePhases` history.
 * @returns {Array<{from: string, to: string|null, scheduledDays: Array, restDays: number[]}>}
 *   Segments in date order; the last runs to the end of the block.
 */
export function scheduleSegments(program) {
  if (!program) return [];
  const phases = (program.schedulePhases || [])
    .filter((phase) => phase?.startDate && phase?.endDate)
    .map((phase) => ({
      from: String(phase.startDate).slice(0, 10),
      to: String(phase.endDate).slice(0, 10),
      scheduledDays: phase.scheduledDays || [],
      restDays: phase.restDays || [],
      routineSnapshots: phase.routineSnapshots || [],
    }))
    .sort((left, right) => left.from.localeCompare(right.from));

  const lastEnd = phases.length > 0 ? phases[phases.length - 1].to : null;
  const from = lastEnd ? toKey(toUtcTime(lastEnd) + MS_PER_DAY) : program.startDate;

  return [
    ...phases,
    {
      from,
      to: null,
      scheduledDays: program.scheduledDays || [],
      restDays: program.restDays || [],
      // The live schedule reads routine membership as it is now.
      routineSnapshots: [],
    },
  ];
}

/**
 * Lists every session a program plans: one slot per pinned routine or activity
 * per date, in date order and, within a date, in schedule order.
 *
 * Weekdays the program marks as rest hold no slots at all. A date the *user*
 * later marks as a rest day keeps its slots — the work moves to another day of
 * the same week rather than disappearing, so the plan's size never changes
 * under the user's feet.
 *
 * Each date is expanded against the schedule that was in force on it, so past
 * weeks keep what they were planned with. See scheduleSegments().
 *
 * @param {{startDate: string, endDate: string,
 *   scheduledDays?: Array<{dayOfWeek: number, routineId?: string, activityId?: string}>,
 *   restDays?: number[], schedulePhases?: Array}} program The program to expand.
 * @returns {Array<{date: string, dayOfWeek: number, type: 'routine'|'activity', id: string}>} Slots.
 */
export function plannedSlots(program, { routineActivities = {}, archivedFrom = {} } = {}) {
  if (!program) return [];
  if (inclusiveDayCount(program.startDate, program.endDate) === 0) return [];

  const blockStart = toUtcTime(program.startDate);
  const blockEnd = toUtcTime(program.endDate);
  const slots = [];

  scheduleSegments(program).forEach((segment) => {
    const byWeekday = itemsByWeekday(segment.scheduledDays, segment.restDays);
    if (byWeekday.size === 0) return;

    // What each routine held while this segment was in force. A phase carries
    // its own snapshot, so editing a routine's contents cannot change whether a
    // week that has already happened was completed.
    const snapshots = new Map(
      (segment.routineSnapshots || []).map((entry) => [entry.routineId, entry.activityIds || []])
    );

    // Segments are clamped to the block, so moving a program's dates never
    // resurrects a phase outside them.
    const from = Math.max(toUtcTime(segment.from), blockStart);
    const to = segment.to ? Math.min(toUtcTime(segment.to), blockEnd) : blockEnd;
    if (Number.isNaN(from) || Number.isNaN(to)) return;

    for (let time = from; time <= to; time += MS_PER_DAY) {
      const dayOfWeek = new Date(time).getUTCDay();
      const items = byWeekday.get(dayOfWeek);
      if (!items) continue;
      const date = toKey(time);
      items.forEach((item) => {
        // An archived routine or activity stops being planned from the day it
        // was archived. Before that day it was the plan, and the week it sits
        // in keeps it.
        const archived = archivedFrom[item.id];
        if (archived && date >= archived) return;
        slots.push({
          date,
          dayOfWeek,
          ...item,
          targets:
            item.type === 'activity'
              ? [item.id]
              : snapshots.get(item.id) || routineActivities[item.id] || [],
        });
      });
    }
  });

  // Segments are already in date order, but a phase and the live tail can only
  // be trusted to be ordered relative to each other, not merged.
  return slots.sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * Collects the days of a week that hold a trainable session.
 *
 * A day counts when it is in the past or today, is not a rest day on the
 * calendar, and holds at least one record. Duplicate records of the same
 * activity collapse: doing an activity twice in one day is one day's training,
 * not two.
 *
 * A weekday the *program* treats as rest is not excluded. The program's rest
 * weekdays shape the plan — no slot is ever placed on one — but they do not get
 * to veto work the user actually did: a Push Day trained on a rest Monday still
 * counts towards that week's Push Day.
 *
 * @param {string[]} dates The week's date keys.
 * @param {Object} context Lookup data.
 * @param {string} context.todayISO Today's date key.
 * @param {Object<string, Array<{activityId?: string}>>} context.recordedActivities Records by date.
 * @param {Object<string, boolean>} context.restDays Calendar rest days by date.
 * @param {string} [context.creditFrom] First date that may earn credit.
 * @returns {Array<{date: string, activityIds: Set<string>}>} Sessions in date order.
 */
function weekSessions(dates, { todayISO, recordedActivities, restDays, creditFrom }) {
  const today = toUtcTime(todayISO);
  return dates
    .filter((date) => {
      if (Number.isNaN(today) || toUtcTime(date) > today) return false;
      if (creditFrom && date < creditFrom) return false;
      if (restDays[date]) return false;
      return (recordedActivities[date] || []).length > 0;
    })
    .map((date) => ({
      date,
      activityIds: new Set(
        (recordedActivities[date] || []).map((record) => record?.activityId).filter(Boolean)
      ),
    }));
}

/**
 * Resolves the activities that satisfy a slot.
 * @param {{type: string, id: string}} slot The slot.
 * @param {Object<string, string[]>} routineActivities Activity ids by routine id.
 * @returns {string[]} Activity client ids.
 */
function slotTargets(slot, routineActivities) {
  if (slot.targets) return slot.targets;
  return slot.type === 'activity' ? [slot.id] : routineActivities[slot.id] || [];
}

/**
 * Assigns one week's sessions to that week's slots.
 *
 * A claim consumes only the activities it recognises, so a week never credits
 * the same training twice while a single day can still satisfy two slots the
 * user genuinely trained for — a routine and a separate run, say. Anything left
 * over in a day is simply extra training, and earns no slot.
 *
 * @param {Array<{date: string}>} slots The week's slots, in order.
 * @param {Array<{date: string, activityIds: Set<string>}>} sessions The week's sessions.
 * @param {Object<string, string[]>} routineActivities Activity ids by routine id.
 * @returns {Array<{done: boolean, doneDate: string|null}>} One result per slot.
 */
export function allocateWeek(slots, sessions, routineActivities = {}) {
  const results = slots.map(() => ({ done: false, doneDate: null }));
  const pools = new Map(sessions.map((session) => [session.date, new Set(session.activityIds)]));

  /**
   * Tries to claim one session for one slot.
   * @param {number} index Slot position.
   * @param {string} date Candidate session date.
   * @returns {boolean} True when the claim succeeded.
   */
  const claim = (index, date) => {
    const pool = pools.get(date);
    if (!pool || pool.size === 0) return false;

    const hits = slotTargets(slots[index], routineActivities).filter((id) => pool.has(id));
    if (hits.length === 0) return false;
    hits.forEach((id) => pool.delete(id));

    results[index] = { done: true, doneDate: date };
    return true;
  };

  CLAIM_PASSES.forEach(({ scope }) => {
    slots.forEach((slot, index) => {
      if (results[index].done) return;
      if (scope === 'day') {
        claim(index, slot.date);
        return;
      }
      // Earliest first, so a week reads as being worked through in order.
      sessions.some((session) => session.date !== slot.date && claim(index, session.date));
    });
  });

  return results;
}

/**
 * Computes a program's adherence figures, week by week.
 *
 * Progress is workout-based rather than time-based: a user who is behind
 * schedule sees a bar reflecting sessions actually done. Credit is settled
 * inside each week, so a burst of training in one week can never cover the
 * next week's plan.
 *
 * @param {Object} input Computation input.
 * @param {{startDate: string, endDate: string,
 *   scheduledDays?: Array<{dayOfWeek: number, routineId?: string, activityId?: string}>,
 *   restDays?: number[]}} input.program The program to measure.
 * @param {string} input.todayISO Today's date key.
 * @param {Object<string, Array>} [input.recordedActivities] Map of date key to records.
 * @param {Object<string, boolean>} [input.restDays] Map of date key to rest-day flag.
 * @param {Object<string, string[]>} [input.routineActivities] Activity ids by routine id,
 *   used to tell whether a day's training matches what a slot asked for.
 * @param {Object<string, string>} [input.archivedFrom] Date key each archived routine
 *   or activity stopped being planned from.
 * @returns {{plannedWorkouts: number, completedWorkouts: number, percent: number,
 *   week: number, totalWeeks: number, phase: string, daysUntilStart: number,
 *   weeks: Array<{index: number, start: string, end: string, planned: number,
 *     completed: number, percent: number, days: Array<{date: string, dayOfWeek: number,
 *     isRestDay: boolean, slots: Array<{type: string, id: string, done: boolean,
 *     doneDate: string|null}>}>}>}} Progress figures.
 */
export function computeProgramProgress({
  program,
  todayISO,
  recordedActivities = {},
  restDays = {},
  routineActivities = {},
  archivedFrom = {},
} = {}) {
  const empty = {
    plannedWorkouts: 0,
    completedWorkouts: 0,
    percent: 0,
    week: 1,
    totalWeeks: 0,
    phase: 'during',
    daysUntilStart: 0,
    weeks: [],
  };
  if (!program) return empty;

  const position = currentWeek(program.startDate, program.endDate, todayISO);

  // A backdated program plans the weeks before it existed, but nothing recorded
  // in them counts: those sessions were not done for this plan, and crediting
  // them made a block look part-finished the moment it was created. Credit
  // opens with the week the program was created in, so a session earlier that
  // same week — a Monday, on a program made that Wednesday — still counts.
  const creditFrom = program.createdAt ? weekStart(program.createdAt) : '';

  const slotsByDate = new Map();
  plannedSlots(program, { routineActivities, archivedFrom }).forEach((slot) => {
    if (!slotsByDate.has(slot.date)) slotsByDate.set(slot.date, []);
    slotsByDate.get(slot.date).push(slot);
  });

  let plannedWorkouts = 0;
  let completedWorkouts = 0;

  const weeks = programWeeks(program.startDate, program.endDate).map((week, index) => {
    const slots = week.dates.flatMap((date) => slotsByDate.get(date) || []);
    const sessions = weekSessions(week.dates, {
      todayISO,
      recordedActivities,
      restDays,
      creditFrom,
    });
    const results = allocateWeek(slots, sessions, routineActivities);

    const completed = results.filter((result) => result.done).length;
    plannedWorkouts += slots.length;
    completedWorkouts += completed;

    const days = [];
    slots.forEach((slot, slotIndex) => {
      const entry = { ...slot, ...results[slotIndex] };
      const day = days.at(-1);
      if (day && day.date === slot.date) {
        day.slots.push(entry);
        return;
      }
      days.push({
        date: slot.date,
        dayOfWeek: slot.dayOfWeek,
        isRestDay: Boolean(restDays[slot.date]),
        slots: [entry],
      });
    });

    return {
      index: index + 1,
      start: week.start,
      end: week.end,
      planned: slots.length,
      completed,
      percent: slots.length === 0 ? 0 : Math.round((completed / slots.length) * 100),
      days,
    };
  });

  const percent =
    plannedWorkouts === 0 ? 0 : Math.round((completedWorkouts / plannedWorkouts) * 100);

  return { ...position, plannedWorkouts, completedWorkouts, percent, weeks };
}
