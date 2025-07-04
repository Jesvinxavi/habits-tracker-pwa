/* -------------------------------------------------------------------------- */
/*  features/home/schedule.js                                                 */
/* -------------------------------------------------------------------------- */
// Core date-schedule utilities used by the Home screen and other UI layers.
// Pure functions only – no DOM operations.

import { isHoliday, dateToKey } from '../../utils/holidays.js';
import { mondayStart, weeksBetween, getISOWeekNumber } from '../../utils/datetime.js';

/**
 * Return the first date that should be treated as this habit's "anchor" – the
 * reference point from which week / month / year intervals are calculated.
 * – If the habit explicitly stores a `createdAt` or `anchorDate`, that is used.
 * – Otherwise we try to extract the unix-ms timestamp prefix that `generateUniqueId()`
 *   stores at the beginning of the habit.id string.
 * – As a final fallback we return the Unix epoch so that maths still work.
 *
 * @param {object} habit
 * @returns {Date}
 */
function getAnchorDate(habit) {
  if (habit.anchorDate) {
    const d = new Date(habit.anchorDate);
    if (!isNaN(d)) return d;
  }

  if (habit.createdAt) {
    const d = new Date(habit.createdAt);
    if (!isNaN(d)) return d;
  }

  // Heuristic: id generated via generateUniqueId() – first 13 chars are Date.now()
  if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) return new Date(ts);
  }

  return new Date(0); // epoch fallback – keeps maths deterministic
}

/** Map ordinal word → numeric index (1-based) */
const ORD_MAP = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };

function isNthWeekdayOfMonth(date, ordinalWord) {
  if (ordinalWord === 'last') {
    // Last Xday of month: compare with next-week date – if month changes we are last
    const nextWeek = new Date(date);
    nextWeek.setDate(date.getDate() + 7);
    return nextWeek.getMonth() !== date.getMonth();
  }
  const nth = ORD_MAP[ordinalWord];
  if (!nth) return false;
  return Math.floor((date.getDate() - 1) / 7) + 1 === nth;
}

export function isHabitScheduledOnDate(habit, date) {
  if (habit.paused === true) return false;

  const d = new Date(date);
  if (isNaN(d)) return false;

  // Normalised frequency string (prefers targetFrequency for target-based habits)
  const freqRaw = habit.targetFrequency || habit.frequency || 'daily';
  const freq = typeof freqRaw === 'string' ? freqRaw.toLowerCase() : freqRaw;

  // Handle target-based habits with custom frequency rules up-front
  if (typeof habit.target === 'number' && habit.target > 0) {
    if (freq === 'biweekly') {
      // Same anchor / week-parity logic as schedule-based bi-weekly habits
      const anchor = getAnchorDate(habit);
      const weekDiff = weeksBetween(anchor, d);
      return weekDiff % 2 === 0;
    }
    // All other target habits are considered scheduled for every displayed period
    return true;
  }

  const dow = d.getDay(); // 0-6 Sun-Sat

  // ---- Holiday Mode (Daily Group) ----
  // If the selected date is a holiday and the habit is daily-frequency and NOT
  // explicitly marked as active on holidays, we skip it.
  const holidayKey = dateToKey(d);
  if (isHoliday(holidayKey) && freq === 'daily' && !habit.activeOnHolidays) {
    return false;
  }

  /* ---------------- DAILY ---------------- */
  if (freq === 'daily' || !freq) return true;

  /* ---------------- WEEKLY ---------------- */
  if (freq === 'weekly') {
    if (Array.isArray(habit.days) && habit.days.length > 0) {
      return habit.days.includes(dow);
    }
    return true; // no explicit day list ⇒ every day
  }

  /* ---------------- BI-WEEKLY ---------------- */
  if (freq === 'biweekly') {
    // 1) Day match first
    if (Array.isArray(habit.days) && habit.days.length > 0 && !habit.days.includes(dow)) {
      return false;
    }

    const anchor = getAnchorDate(habit);
    const weekDiff = weeksBetween(anchor, d);

    // If even difference (0,2,4…) -> potentially active week
    if (weekDiff % 2 !== 0) return false;

    // Extra rule for the very first (anchor) week: ignore days before the first day ever logged
    if (weekDiff === 0) {
      const firstDow = anchor.getDay();
      if (dow < firstDow) return false;
    }
    return true;
  }

  /* ---------------- MONTHLY ---------------- */
  if (freq === 'monthly') {
    const cfg = habit.monthly || {};
    const interval = Math.max(1, parseInt(cfg.interval || 1, 10));

    // respect month interval relative to anchor
    const anchor = getAnchorDate(habit);
    const monthDiff =
      (d.getFullYear() - anchor.getFullYear()) * 12 + (d.getMonth() - anchor.getMonth());
    if (monthDiff % interval !== 0) return false;

    // If no detailed config, every day inside the active month is valid
    if (!cfg.mode || cfg.mode === 'each') {
      const datesArr = Array.isArray(cfg.dates) && cfg.dates.length > 0 ? cfg.dates : null;
      if (!datesArr) return true; // no explicit dates ⇒ whole month
      return datesArr.includes(d.getDate());
    }

    if (cfg.mode === 'on') {
      const combArr = Array.isArray(cfg.combinations) ? cfg.combinations : [];
      if (combArr.length === 0) return true; // default: whole month

      // Example combination: "first-monday"
      return combArr.some((comb) => {
        const [ord, dayStr] = comb.split('-');
        if (!ord || !dayStr) return false;
        const dayIdx = {
          sunday: 0,
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
        }[dayStr.toLowerCase()];
        if (dayIdx === undefined || dayIdx !== dow) return false;
        return isNthWeekdayOfMonth(d, ord.toLowerCase());
      });
    }

    return true;
  }

  /* ---------------- YEARLY ---------------- */
  if (freq === 'yearly') {
    const monthsArr = Array.isArray(habit.months) && habit.months.length > 0 ? habit.months : null;
    const yearInterval = Math.max(1, parseInt(habit.yearInterval || 1, 10));

    const anchor = getAnchorDate(habit);
    const yearDiff = d.getFullYear() - anchor.getFullYear();
    if (yearDiff % yearInterval !== 0) return false;

    if (monthsArr && !monthsArr.includes(d.getMonth())) return false;

    // Future-proof: if habit.yearlyDates exists (specify dates toggle)
    if (Array.isArray(habit.yearlyDates) && habit.yearlyDates.length > 0) {
      if (!habit.yearlyDates.includes(d.getDate())) return false;
    }

    return true;
  }

  /* ---------- Unknown frequency: default true ---------- */
  return true;
}

export function belongsToSelectedGroup(habit, group) {
  // Determine whether habit is a target-based habit (completion goal) or purely schedule-based.
  const isTarget = typeof habit.target === 'number' && habit.target > 0;

  // Normalise frequency strings to lowercase for robust matching
  const rawTargetFreq = habit.targetFrequency || habit.frequency || 'daily';
  const tgtFreq = typeof rawTargetFreq === 'string' ? rawTargetFreq.toLowerCase() : rawTargetFreq;

  const rawFreq = habit.frequency || habit.targetFrequency || 'daily';
  const freq = typeof rawFreq === 'string' ? rawFreq.toLowerCase() : rawFreq;

  if (group === 'daily') {
    // All schedule-only habits except yearly belong here.
    if (!isTarget) return ['daily', 'weekly', 'biweekly', 'monthly'].includes(freq);
    // Target-based habits that are explicitly daily.
    return tgtFreq === 'daily';
  }

  if (group === 'weekly') {
    // Weekly group when:
    //  • Target-based habits whose targetFrequency is weekly or biweekly
    //  • Schedule-based habits whose primary frequency is weekly (no completion target)
    if (isTarget) return tgtFreq === 'weekly' || tgtFreq === 'biweekly';
    return freq === 'weekly';
  }

  if (group === 'monthly') {
    // 1) Monthly target habits.
    // 2) Yearly scheduled habits (no target).
    if (isTarget) return tgtFreq === 'monthly';
    return freq === 'yearly';
  }

  if (group === 'yearly') {
    return isTarget && tgtFreq === 'yearly';
  }

  return false;
}

export function getPeriodKey(habit, dateObj) {
  const d = new Date(dateObj);
  const freq = habit.targetFrequency || habit.frequency || 'daily';

  if (freq === 'daily') {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`; // e.g. 2025-06-17
  }
  if (freq === 'weekly') {
    const week = getISOWeekNumber(d);
    return `${d.getFullYear()}-W${week}`;
  }
  if (freq === 'monthly') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  }
  if (freq === 'yearly') {
    return `${d.getFullYear()}`;
  }
  if (freq === 'biweekly') {
    // Determine bi-weekly period relative to the habit's anchor week.
    const anchor = getAnchorDate(habit);
    const weekDiff = weeksBetween(anchor, d);
    const periodStart = new Date(anchor);
    periodStart.setDate(anchor.getDate() + Math.floor(weekDiff / 2) * 14);
    const week = getISOWeekNumber(periodStart);
    return `${periodStart.getFullYear()}-BW${week}`; // e.g. 2025-BW34
  }
  // fallback daily
  return d.toISOString().slice(0, 10);
}

// -------------------- Completion helpers --------------------
export function isHabitCompleted(habit, dateObj) {
  if (habit.completed === true) return true; // legacy boolean
  if (typeof habit.completed !== 'object' || habit.completed === null) return false;
  const key = getPeriodKey(habit, dateObj);
  return habit.completed[key] === true;
}

export function setHabitCompleted(habit, dateObj, val) {
  const key = getPeriodKey(habit, dateObj);
  if (typeof habit.completed !== 'object' || habit.completed === null) habit.completed = {};
  habit.completed[key] = val;
}

export function toggleHabitCompleted(habit, dateObj) {
  const cur = isHabitCompleted(habit, dateObj);
  setHabitCompleted(habit, dateObj, !cur);
}

/**
 * Return true when the given habit is explicitly skipped on the provided date.
 * Helper centralised here so UI layers can share one source-of-truth.
 * @param {object} habit
 * @param {Date|string} [date] – date object or ISO string (defaults to today)
 * @returns {boolean}
 */
export function isHabitSkippedToday(habit, date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const key = dateToKey(d);
  return Array.isArray(habit.skippedDates) && habit.skippedDates.includes(key);
}
