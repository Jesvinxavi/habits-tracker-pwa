// src/shared/ScheduleEngine.js – central scheduling logic

import { weeksBetween, dateToKey } from './datetime.js';
import { isHoliday } from '../features/holidays/holidays.js';

// Helper: derive anchor date for interval calculations
function getAnchorDate(habit) {
  if (habit.anchorDate) {
    const d = new Date(habit.anchorDate);
    if (!isNaN(d)) return d;
  }
  if (habit.createdAt) {
    const d = new Date(habit.createdAt);
    if (!isNaN(d)) return d;
  }
  // TODO: remove id-prefix heuristic after data migration (legacy support)
  if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) return new Date(ts);
  }
  return new Date(0); // epoch fallback
}

// Ordinal → index helper for monthly combos
const ORD_MAP = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
function isNthWeekdayOfMonth(date, ordinalWord) {
  if (ordinalWord === 'last') {
    const nextWeek = new Date(date);
    nextWeek.setDate(date.getDate() + 7);
    return nextWeek.getMonth() !== date.getMonth();
  }
  const nth = ORD_MAP[ordinalWord];
  if (!nth) return false;
  return Math.floor((date.getDate() - 1) / 7) + 1 === nth;
}

function _isHabitScheduledOnDate(habit, date) {
  if (habit.paused === true) return false;
  const d = new Date(date);
  if (isNaN(d)) return false;

  // Determine frequency
  const freqRaw = habit.targetFrequency || habit.frequency || 'daily';
  const freq = typeof freqRaw === 'string' ? freqRaw.toLowerCase() : freqRaw;

  /* ---------------- Target-based habits ---------------- */
  if (typeof habit.target === 'number' && habit.target > 0) {
    if (freq === 'biweekly') {
      const anchor = getAnchorDate(habit);
      const weekDiff = weeksBetween(anchor, d);
      return weekDiff % 2 === 0;
    }
    if (freq === 'daily') {
      const holidayKey = dateToKey(d);
      if (isHoliday(holidayKey) && !habit.activeOnHolidays) return false;
    }
    return true; // for other target frequencies, period calc handled elsewhere
  }

  const dow = d.getDay();
  const holidayKey = dateToKey(d);
  if (isHoliday(holidayKey) && (freq === 'daily' || freq === 'weekly') && !habit.activeOnHolidays) {
    return false;
  }

  /* ---------------- Schedule-only ---------------- */
  if (freq === 'daily' || !freq) return true;

  if (freq === 'weekly') {
    if (Array.isArray(habit.days) && habit.days.length > 0) return habit.days.includes(dow);
    return true;
  }

  if (freq === 'biweekly') {
    if (Array.isArray(habit.days) && habit.days.length > 0 && !habit.days.includes(dow))
      return false;
    const anchor = getAnchorDate(habit);
    const weekDiff = weeksBetween(anchor, d);
    if (weekDiff % 2 !== 0) return false;
    if (weekDiff === 0) {
      const firstDow = anchor.getDay();
      if (dow < firstDow) return false;
    }
    return true;
  }

  if (freq === 'monthly') {
    const cfg = habit.monthly || {};
    const interval = Math.max(1, parseInt(cfg.interval || 1, 10));
    const anchor = getAnchorDate(habit);
    const monthDiff =
      (d.getFullYear() - anchor.getFullYear()) * 12 + (d.getMonth() - anchor.getMonth());
    if (monthDiff % interval !== 0) return false;

    if (!cfg.mode || cfg.mode === 'each') {
      const datesArr = Array.isArray(cfg.dates) && cfg.dates.length > 0 ? cfg.dates : null;
      if (!datesArr) return true;
      return datesArr.includes(d.getDate());
    }

    if (cfg.mode === 'on') {
      const combArr = Array.isArray(cfg.combinations) ? cfg.combinations : [];
      if (combArr.length === 0) return true;
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

  if (freq === 'yearly') {
    const monthsArr = Array.isArray(habit.months) && habit.months.length > 0 ? habit.months : null;
    const yearInterval = Math.max(1, parseInt(habit.yearInterval || 1, 10));
    const anchor = getAnchorDate(habit);
    const yearDiff = d.getFullYear() - anchor.getFullYear();
    if (yearDiff % yearInterval !== 0) return false;
    if (monthsArr && !monthsArr.includes(d.getMonth())) return false;
    if (
      Array.isArray(habit.yearlyDates) &&
      habit.yearlyDates.length > 0 &&
      !habit.yearlyDates.includes(d.getDate())
    )
      return false;
    return true;
  }

  return true; // fallback
}

export class ScheduleEngine {
  static isDue(habit, date) {
    return _isHabitScheduledOnDate(habit, date);
  }
}
