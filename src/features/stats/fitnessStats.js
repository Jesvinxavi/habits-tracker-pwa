/**
 * Whole-library fitness statistics for the Stats page.
 *
 * The per-activity modal answers "how is this exercise going"; this answers
 * "how is my training going", which needs different arithmetic: sessions joined
 * back to their activity for category and muscle group, weeks bucketed for
 * trend, and rest days read from their own store.
 */

import { getState } from '../../core/state.js';
import { getRecordedHistoryIndex } from '../fitness/helpers/recordedHistory.js';
import {
  averageOver,
  durationMinutes,
  hasDuration,
  hasMetrics,
  hasSets,
  recordDate,
  recordDateKey,
  recordsWithinDays,
  sessionReps,
  sessionVolume,
} from '../fitness/helpers/recordMetrics.js';
import { isRestDay } from '../../shared/restDays.js';
import { getProgramProgress, getPrograms } from '../fitness/programs.js';
import { calendarDaysBetween, dateToKey, mondayStart } from '../../shared/datetime.js';

/**
 * Calculates the fitness half of the Stats page.
 * @param {Date} [today] The current date.
 * @returns {object} Fitness statistics.
 */
export function calculateFitnessStatistics(today = new Date()) {
  const state = getState();
  // Archived activities keep their history but are no longer part of the
  // library, so they are not counted as activities the user has.
  const activities = (state.activities || []).filter((activity) => !activity.archivedAt);
  const activitiesById = new Map((state.activities || []).map((entry) => [entry.id, entry]));
  const categoriesById = new Map((state.activityCategories || []).map((entry) => [entry.id, entry]));
  const history = getRecordedHistoryIndex(state.recordedActivities || {});
  const records = history.allRecords;

  const duration = averageOver(records, hasDuration, durationMinutes);
  const recent = recordsWithinDays(records, 30, today);

  const stats = {
    totalActivities: activities.length,
    totalSessions: records.length,
    loggedSessions: records.filter(hasMetrics).length,
    recentSessions: recent.length,
    totalDuration: duration.total,
    averageSessionDuration: duration.average,
    timedSessions: duration.count,
    totalVolume: records.reduce((sum, record) => sum + sessionVolume(record), 0),
    totalSets: records.reduce((sum, record) => sum + (hasSets(record) ? record.sets.length : 0), 0),
    totalReps: records.reduce((sum, record) => sum + sessionReps(record), 0),
    activeDayKeys: [...new Set(records.map(recordDateKey).filter(Boolean))],
    byCategory: [],
    byMuscleGroup: [],
    weeklyVolume: [],
    weeklySessions: [],
    restDaysLast30Days: 0,
    restDaysPercentage: 0,
    currentTrainingStreak: 0,
    longestTrainingStreak: 0,
    lastSession: null,
  };

  stats.unloggedSessions = stats.totalSessions - stats.loggedSessions;
  stats.activeDays = stats.activeDayKeys.length;
  if (records.length > 0) {
    stats.lastSession = recordDateKey(records.reduce((latest, record) =>
      recordDateKey(record) > recordDateKey(latest) ? record : latest
    ));
  }

  // Sessions grouped by the category and muscle group of the activity they
  // belong to, resolved through the activity rather than the snapshot on the
  // record, so renaming or recategorising applies to past sessions too.
  const categoryTotals = new Map();
  const muscleTotals = new Map();
  for (const record of records) {
    const activity = activitiesById.get(record.activityId);
    const categoryId = activity?.categoryId || record.categoryId;
    if (categoryId) {
      const entry = categoryTotals.get(categoryId) || { sessions: 0, minutes: 0 };
      entry.sessions += 1;
      entry.minutes += durationMinutes(record);
      categoryTotals.set(categoryId, entry);
    }
    if (hasSets(record)) {
      const muscle = activity?.muscleGroup || 'Other';
      const entry = muscleTotals.get(muscle) || { sets: 0, volume: 0, sessions: 0 };
      entry.sets += record.sets.length;
      entry.volume += sessionVolume(record);
      entry.sessions += 1;
      muscleTotals.set(muscle, entry);
    }
  }

  stats.byCategory = [...categoryTotals.entries()]
    .map(([categoryId, entry]) => ({
      id: categoryId,
      name: categoriesById.get(categoryId)?.name || 'Uncategorised',
      color: categoriesById.get(categoryId)?.color || '#64748B',
      sessions: entry.sessions,
      minutes: entry.minutes,
      share: records.length > 0 ? entry.sessions / records.length : 0,
    }))
    .sort((left, right) => right.sessions - left.sessions);

  stats.byMuscleGroup = [...muscleTotals.entries()]
    .map(([name, entry]) => ({ name, ...entry }))
    .sort((left, right) => right.sets - left.sets);

  // Twelve weeks of training load, oldest first, for the trend charts.
  const weeks = 12;
  const volumeBuckets = new Array(weeks).fill(0);
  const sessionBuckets = new Array(weeks).fill(0);
  const thisMonday = mondayStart(today);
  for (const record of records) {
    const date = recordDate(record);
    if (!date) continue;
    const weeksBack = Math.floor(calendarDaysBetween(thisMonday, mondayStart(date)) / 7);
    if (weeksBack < 0 || weeksBack >= weeks) continue;
    const slot = weeks - 1 - weeksBack;
    volumeBuckets[slot] += sessionVolume(record);
    sessionBuckets[slot] += 1;
  }
  stats.weeklyVolume = volumeBuckets;
  stats.weeklySessions = sessionBuckets;

  // Rest days across the last thirty dated days, today included, divided by the
  // window actually walked rather than by a hard-coded thirty.
  const restWindow = 30;
  let restDays = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  cursor.setDate(cursor.getDate() - (restWindow - 1));
  for (let index = 0; index < restWindow; index += 1) {
    if (isRestDay(dateToKey(cursor))) restDays += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  stats.restDaysLast30Days = restDays;
  stats.restDaysPercentage = (restDays / restWindow) * 100;

  Object.assign(stats, trainingStreaks(records, today));
  stats.programs = programAdherence();

  return stats;
}

/**
 * How closely each program has actually been followed.
 *
 * Programs declare what a week should hold, and until now nothing ever compared
 * that against what was recorded — the plan had no feedback loop at all. The
 * arithmetic already exists for the program detail screen; this borrows it so
 * the same figure appears where the user is looking at their training as a
 * whole.
 * @returns {Array<object>} One entry per program that has started, newest first.
 */
function programAdherence() {
  return getPrograms()
    .map((program) => {
      const progress = getProgramProgress(program);
      if (!progress || progress.plannedWorkouts === 0) return null;
      return {
        id: program.id,
        name: program.name,
        percent: progress.percent,
        completed: progress.completedWorkouts,
        planned: progress.plannedWorkouts,
        week: progress.week,
        totalWeeks: progress.totalWeeks,
        phase: progress.phase,
        active: Boolean(program.active),
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number(right.active) - Number(left.active));
}

/**
 * Runs of consecutive weeks holding at least one session.
 *
 * Weeks rather than days: training every day is not the goal, and a daily
 * streak would punish the rest the plan asks for.
 * @param {object[]} records Sessions.
 * @param {Date} today The current date.
 * @returns {{currentTrainingStreak: number, longestTrainingStreak: number}} Streaks.
 */
function trainingStreaks(records, today) {
  if (records.length === 0) return { currentTrainingStreak: 0, longestTrainingStreak: 0 };

  const trainedWeeks = new Set();
  for (const record of records) {
    const date = recordDate(record);
    if (date) trainedWeeks.add(dateToKey(mondayStart(date)));
  }

  const thisMonday = mondayStart(today);
  let current = 0;
  // The week in progress does not break a run: there is still time in it.
  let cursor = new Date(thisMonday);
  if (!trainedWeeks.has(dateToKey(cursor))) cursor.setDate(cursor.getDate() - 7);
  while (trainedWeeks.has(dateToKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 7);
  }

  const ordered = [...trainedWeeks].sort();
  let longest = 0;
  let run = 0;
  let previous = null;
  for (const weekKey of ordered) {
    const week = new Date(`${weekKey}T00:00:00`);
    if (previous && calendarDaysBetween(week, previous) === 7) run += 1;
    else run = 1;
    if (run > longest) longest = run;
    previous = week;
  }

  return { currentTrainingStreak: current, longestTrainingStreak: longest };
}
