/**
 * Activity Statistics Helper Functions
 *
 * Pure functions for calculating and formatting activity statistics
 * Extracted from src/ui/fitness.js for better modularity
 */

import { getActivity } from '../activities.js';
import {
  calendarDaysBetween,
  formatDuration,
  formatLastPerformed,
  mondayStart,
} from '../../../shared/datetime.js';
import { escapeHtml, normalizeHexColor } from '../../../shared/sanitize.js';
import {
  barChart,
  comparisonRow,
  statCard,
  statGrid,
  statSection,
  statsEmptyState,
} from '../../stats/statsUi.js';
import { getRecordedHistoryIndex } from './recordedHistory.js';
import {
  averageOver,
  durationMinutes,
  hasDuration,
  hasMetrics,
  hasSets,
  isWeightedSet,
  recordDate,
  recordDateKey,
  recordsWithinDays,
  sessionMaxWeight,
  sessionOneRepMax,
  sessionReps,
  sessionVolume,
  sessionWeightUnit,
} from './recordMetrics.js';

/** An activity with no sessions yet, so every reader gets the same shape. */
function emptyStatistics() {
  return {
    totalSessions: 0,
    loggedSessions: 0,
    unloggedSessions: 0,
    totalDuration: 0,
    totalSets: 0,
    totalReps: 0,
    totalVolume: 0,
    averageDuration: 0,
    averageSets: 0,
    averageReps: 0,
    averageVolume: 0,
    intensityCounts: {},
    mostCommonIntensity: null,
    lastPerformed: null,
    bestSession: null,
    personalBests: null,
    recentFrequency: 0,
    weeklyAverage: 0,
    firstPerformed: null,
    weightUnit: '',
  };
}

/**
 * Calculates comprehensive statistics for an activity
 * @param {string} activityId - The ID of the activity
 * @param {Date} [today] - The current date, injectable for tests
 * @returns {Object|null} Statistics object or null if activity not found
 */
export function calculateActivityStatistics(activityId, today = new Date()) {
  const activity = getActivity(activityId);
  if (!activity) return null;

  // Get all records for this activity across all dates, oldest first by the day
  // they were performed on.
  const allRecords = getRecordedHistoryIndex().byActivity.get(activityId) || [];
  if (allRecords.length === 0) return emptyStatistics();

  const stats = emptyStatistics();
  stats.totalSessions = allRecords.length;
  stats.loggedSessions = allRecords.filter(hasMetrics).length;
  // Quick-records carry no metrics by design. They are real sessions, so they
  // count as sessions, but averaging them in as zero would be a lie.
  stats.unloggedSessions = stats.totalSessions - stats.loggedSessions;
  stats.lastPerformed = recordDateKey(allRecords[allRecords.length - 1]) || null;
  stats.firstPerformed = recordDateKey(allRecords[0]) || null;

  if (activity.trackingType === 'sets-reps') {
    const sessions = allRecords.filter(hasSets);
    let bestVolume = 0;
    let bestSessionRecord = null;

    for (const record of sessions) {
      stats.totalSets += record.sets.length;
      stats.totalReps += sessionReps(record);
      // Volume is accumulated per session and compared once, so the session
      // that did the most work wins rather than the one with the single
      // heaviest set in it.
      const volume = sessionVolume(record);
      stats.totalVolume += volume;
      if (volume > bestVolume) {
        bestVolume = volume;
        bestSessionRecord = record;
      }
    }

    // A bodyweight activity records no volume at all, so fall back to the
    // session that did the most reps rather than showing no best session.
    if (!bestSessionRecord && sessions.length > 0) {
      bestSessionRecord = sessions.reduce((best, record) =>
        sessionReps(record) > sessionReps(best) ? record : best
      );
    }

    const sets = averageOver(allRecords, hasSets, (record) => record.sets.length);
    const reps = averageOver(allRecords, hasSets, sessionReps);
    const volume = averageOver(allRecords, hasSets, sessionVolume);
    stats.averageSets = sets.average;
    stats.averageReps = reps.average;
    stats.averageVolume = volume.average;
    stats.bestSession = bestSessionRecord;
    stats.weightUnit = weightUnitForRecords(sessions, activity);
    stats.personalBests = strengthPersonalBests(sessions, stats.weightUnit);
  } else {
    const lowerIsBetter = prefersLower(activity);
    let bestDuration = null;
    let bestSessionRecord = null;

    for (const record of allRecords) {
      if (hasDuration(record)) {
        const minutes = durationMinutes(record);
        // Best is the longest, or the quickest when the activity is one where a
        // smaller figure is the improvement.
        const better =
          bestDuration === null || (lowerIsBetter ? minutes < bestDuration : minutes > bestDuration);
        if (better) {
          bestDuration = minutes;
          bestSessionRecord = record;
        }
      }
      if (record.intensity) {
        stats.intensityCounts[record.intensity] = (stats.intensityCounts[record.intensity] || 0) + 1;
      }
    }

    const duration = averageOver(allRecords, hasDuration, durationMinutes);
    stats.totalDuration = duration.total;
    stats.averageDuration = duration.average;
    stats.bestSession = bestSessionRecord;

    const intensities = Object.entries(stats.intensityCounts);
    if (intensities.length > 0) {
      stats.mostCommonIntensity = intensities.sort(([, a], [, b]) => b - a)[0][0];
    }
    stats.personalBests = durationPersonalBests(allRecords, lowerIsBetter);
  }

  stats.recentFrequency = recordsWithinDays(allRecords, 30, today).length;

  // Sessions per week since the first one, floored at a week so a pair of
  // sessions logged on one day cannot extrapolate to fourteen a week.
  const firstDate = recordDate(allRecords[0]);
  const daysSinceFirst = firstDate ? calendarDaysBetween(today, firstDate) + 1 : 1;
  stats.weeklyAverage = stats.totalSessions / (Math.max(7, daysSinceFirst) / 7);

  return stats;
}

/**
 * Picks the weight unit an activity's sessions are recorded in.
 * @param {object[]} records Sessions holding sets, oldest first.
 * @param {object} activity The activity, for its declared unit.
 * @returns {string} Unit, or an empty string when nothing is weighted.
 */
function weightUnitForRecords(records, activity) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const unit = sessionWeightUnit(records[index]);
    if (unit) return unit;
  }
  return activity?.units || '';
}

/**
 * Personal bests for a strength activity.
 * @param {object[]} records Sessions holding sets.
 * @param {string} unit The weight unit in play.
 * @returns {object|null} Bests, or null when nothing is weighted.
 */
function strengthPersonalBests(records, unit) {
  let heaviest = null;
  let bestVolume = null;
  let bestOneRepMax = null;

  for (const record of records) {
    const weight = sessionMaxWeight(record);
    if (weight > 0 && (!heaviest || weight > heaviest.value)) {
      heaviest = { value: weight, date: recordDateKey(record), unit };
    }
    const volume = sessionVolume(record);
    if (volume > 0 && (!bestVolume || volume > bestVolume.value)) {
      bestVolume = { value: volume, date: recordDateKey(record), unit };
    }
    const oneRepMax = sessionOneRepMax(record);
    if (oneRepMax > 0 && (!bestOneRepMax || oneRepMax > bestOneRepMax.value)) {
      bestOneRepMax = { value: oneRepMax, date: recordDateKey(record), unit };
    }
  }

  if (!heaviest && !bestVolume) return null;
  return { heaviest, bestVolume, bestOneRepMax };
}

/**
 * Personal bests for a time-tracked activity.
 * @param {object[]} records Sessions.
 * @param {boolean} lowerIsBetter Whether a smaller figure is the improvement.
 * @returns {object|null} Bests, or null when nothing is timed.
 */
function durationPersonalBests(records, lowerIsBetter) {
  let best = null;
  let longest = null;
  for (const record of records) {
    if (!hasDuration(record)) continue;
    const minutes = durationMinutes(record);
    if (!best || (lowerIsBetter ? minutes < best.value : minutes > best.value)) {
      best = { value: minutes, date: recordDateKey(record) };
    }
    if (!longest || minutes > longest.value) {
      longest = { value: minutes, date: recordDateKey(record) };
    }
  }
  if (!best) return null;
  return { best, longest, lowerIsBetter };
}

/**
 * Builds the statistics content HTML for display in modal
 * @param {Object} activity - The activity object
 * @param {Object} stats - The calculated statistics
 * @param {Object} category - The activity category
 * @returns {string} HTML string for the statistics content
 */
export function buildStatsContent(activity, stats, category) {
  if (stats.totalSessions === 0) {
    return statsEmptyState({
      title: 'No sessions yet',
      message: 'Record this activity and its statistics will build up here.',
    });
  }

  const isStrength = activity.trackingType === 'sets-reps';
  const accent = normalizeHexColor(category?.color, '#3B82F6');
  const sections = [];

  // What the user came for: how often, and how recently.
  sections.push(
    statSection({
      title: 'Activity',
      body: statGrid([
        statCard({
          value: stats.totalSessions,
          label: 'Total sessions',
          sub: stats.unloggedSessions > 0 ? `${stats.unloggedSessions} without details` : '',
          tone: 'feature',
        }),
        statCard({
          value: formatMetric(stats.weeklyAverage),
          label: 'Sessions per week',
          sub: 'Since the first one',
        }),
        statCard({ value: stats.recentFrequency, label: 'Last 30 days' }),
        statCard({ value: formatLastPerformed(stats.lastPerformed), label: 'Last performed' }),
      ]),
    })
  );

  if (isStrength) {
    sections.push(
      statSection({
        title: 'Workload',
        note:
          stats.unloggedSessions > 0
            ? 'Averages cover only the sessions with sets recorded.'
            : '',
        body: statGrid([
          statCard({ value: stats.totalSets, label: 'Total sets' }),
          statCard({ value: stats.totalReps, label: 'Total reps' }),
          statCard({ value: formatMetric(stats.averageSets), label: 'Avg sets per session' }),
          statCard({ value: formatMetric(stats.averageReps), label: 'Avg reps per session' }),
          stats.totalVolume > 0
            ? statCard({
                value: `${formatMetric(stats.totalVolume)}${stats.weightUnit}`,
                label: 'Total volume lifted',
                sub: `Averaging ${formatMetric(stats.averageVolume)}${stats.weightUnit} a session`,
                wide: true,
              })
            : '',
        ]),
      })
    );
  } else {
    sections.push(
      statSection({
        title: 'Time',
        note:
          stats.unloggedSessions > 0 ? 'Averages cover only the sessions with a duration.' : '',
        body: statGrid([
          statCard({ value: formatDuration(stats.totalDuration), label: 'Total time' }),
          statCard({ value: formatDuration(stats.averageDuration), label: 'Average session' }),
        ]),
      })
    );

    const intensities = Object.entries(stats.intensityCounts);
    if (intensities.length > 0) {
      const total = intensities.reduce((sum, [, count]) => sum + count, 0);
      const order = ['low', 'moderate', 'high'];
      const rows = intensities
        .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
        .map(([name, count]) =>
          comparisonRow({
            label: name.charAt(0).toUpperCase() + name.slice(1),
            value: `${Math.round((count / total) * 100)}%`,
            sub: `${count} ${count === 1 ? 'session' : 'sessions'}`,
            fraction: count / total,
            color: accent,
          })
        )
        .join('');
      sections.push(statSection({ title: 'Intensity', body: rows }));
    }
  }

  sections.push(buildPersonalBests(stats, isStrength, accent));

  const trend = buildFrequencyTrend(activity.id, accent);
  if (trend) {
    sections.push(
      statSection({ title: 'Frequency', note: 'Sessions per week, last 12 weeks', body: trend })
    );
  }

  if (stats.bestSession) {
    sections.push(
      statSection({
        title: 'Best session',
        body: `
          <div class="rounded-xl p-3 bg-gray-50 dark:bg-gray-800/70 border-l-[3px]" style="border-left-color:${accent};">
            ${formatBestSession(stats.bestSession, activity)}
            <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
              ${escapeHtml(formatLastPerformed(recordDateKey(stats.bestSession)))}
            </div>
          </div>
        `,
      })
    );
  }

  return `<div class="stats-grid space-y-5">${sections.filter(Boolean).join('')}</div>`;
}

/**
 * The records worth chasing: the heaviest lift, the biggest session, the best
 * estimated one-rep max, or for a timed activity the best time in whichever
 * direction counts as an improvement for it.
 * @param {object} stats Calculated statistics.
 * @param {boolean} isStrength Whether the activity tracks sets and reps.
 * @param {string} accent The category colour.
 * @returns {string} Section markup, or an empty string when there are none.
 */
function buildPersonalBests(stats, isStrength, accent) {
  const bests = stats.personalBests;
  if (!bests) return '';

  if (isStrength) {
    return statSection({
      title: 'Personal bests',
      body: statGrid([
        bests.heaviest
          ? statCard({
              value: `${formatMetric(bests.heaviest.value)}${bests.heaviest.unit}`,
              label: 'Heaviest lift',
              sub: formatLastPerformed(bests.heaviest.date),
              tone: 'positive',
            })
          : '',
        bests.bestOneRepMax
          ? statCard({
              value: `${formatMetric(bests.bestOneRepMax.value)}${bests.bestOneRepMax.unit}`,
              label: 'Estimated 1RM',
              sub: 'Epley estimate, not a tested max',
            })
          : '',
        bests.bestVolume
          ? statCard({
              value: `${formatMetric(bests.bestVolume.value)}${bests.bestVolume.unit}`,
              label: 'Best session volume',
              sub: formatLastPerformed(bests.bestVolume.date),
              wide: !bests.bestOneRepMax,
            })
          : '',
      ]),
    });
  }

  const cards = [
    statCard({
      value: formatDuration(bests.best.value),
      label: bests.lowerIsBetter ? 'Fastest session' : 'Longest session',
      sub: formatLastPerformed(bests.best.date),
      tone: 'positive',
    }),
  ];
  // A "longest" card beside a "fastest" one is only interesting when the
  // activity is scored the other way round.
  if (bests.lowerIsBetter && bests.longest && bests.longest.value !== bests.best.value) {
    cards.push(
      statCard({
        value: formatDuration(bests.longest.value),
        label: 'Longest session',
        sub: formatLastPerformed(bests.longest.date),
      })
    );
  }
  return statSection({ title: 'Personal bests', body: statGrid(cards) });
}

/**
 * Sessions per week over the last twelve weeks.
 * @param {string} activityId The activity id.
 * @param {string} accent Bar colour.
 * @returns {string} Chart markup, or an empty string when there is too little.
 */
function buildFrequencyTrend(activityId, accent) {
  const records = getRecordedHistoryIndex().byActivity.get(activityId) || [];
  if (records.length < 3) return '';

  const weeks = 12;
  const buckets = new Array(weeks).fill(0);
  const thisMonday = mondayStart(new Date());

  for (const record of records) {
    const date = recordDate(record);
    if (!date) continue;
    const weeksBack = Math.floor(calendarDaysBetween(thisMonday, mondayStart(date)) / 7);
    if (weeksBack >= 0 && weeksBack < weeks) buckets[weeks - 1 - weeksBack] += 1;
  }

  if (buckets.every((count) => count === 0)) return '';

  return barChart({
    bars: buckets.map((value) => ({ value, label: '' })),
    axis: ['12 weeks ago', '6 weeks', 'This week'],
    color: accent,
  });
}

/**
 * Helper function to format best session details
 * @param {Object} session - The best session record
 * @param {Object} activity - The activity object
 * @returns {string} HTML string for the best session display
 */
function formatBestSession(session, activity) {
  if (activity.trackingType === 'sets-reps' && hasSets(session)) {
    const volume = sessionVolume(session);
    const maxWeight = sessionMaxWeight(session);
    const unit = sessionWeightUnit(session);
    const detail =
      maxWeight > 0
        ? `Heaviest set: ${formatMetric(maxWeight)}${escapeHtml(unit)}`
        : `${sessionReps(session)} reps in total`;

    return `
      <div class="text-sm font-semibold text-gray-900 dark:text-white">
        ${session.sets.length} sets${volume > 0 ? ` • ${formatMetric(volume)}${escapeHtml(unit)} volume` : ''}
      </div>
      <div class="text-xs text-gray-600 dark:text-gray-300">
        ${detail}
      </div>
    `;
  }

  const minutes = durationMinutes(session);
  return `
    <div class="text-sm font-semibold text-gray-900 dark:text-white">
      ${escapeHtml(formatDuration(minutes))}${session.intensity ? ` • ${escapeHtml(session.intensity)} intensity` : ''}
    </div>
    <div class="text-xs text-gray-600 dark:text-gray-300">
      ${prefersLower(activity) ? 'Quickest session' : 'Longest duration session'}
    </div>
  `;
}

/**
 * Formats a metric without a trailing `.0` on whole numbers.
 * @param {number} value Any measurement.
 * @returns {string} Display string.
 */
export function formatMetric(value) {
  if (!Number.isFinite(value)) return '0';
  // Grouped, because a five-figure tonnage is unreadable as a run of digits.
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/**
 * Extracts progression data for a time-tracked activity: one point per session,
 * holding the session's duration normalised to minutes.
 * @param {string} activityId The activity ID.
 * @returns {Array<{date: string, value: number}>} Progression data, oldest first.
 */
function extractDurationProgressionData(activityId) {
  const activity = getActivity(activityId);
  if (!activity || activity.trackingType === 'sets-reps') return [];

  return (getRecordedHistoryIndex().byActivity.get(activityId) || [])
    .filter(hasDuration)
    .map((record) => ({
      date: recordDateKey(record),
      value: Math.round(durationMinutes(record) * 10) / 10,
    }));
}

/**
 * Resolves the progression series to plot for an activity, whichever way it is
 * tracked, so one chart component serves both.
 * @param {Object} activity The activity object.
 * @returns {{points: Array<{date: string, value: number}>, unit: string}} Series and its unit.
 */
export function extractProgressionSeries(activity) {
  if (!activity) return { points: [], unit: '' };
  if (activity.trackingType === 'sets-reps') {
    const records = (getRecordedHistoryIndex().byActivity.get(activity.id) || []).filter(hasSets);
    return {
      points: extractStrengthProgressionData(records),
      unit: weightUnitForRecords(records, activity),
    };
  }
  return { points: extractDurationProgressionData(activity.id), unit: 'min' };
}

/**
 * One point per session, holding the heaviest weight lifted in it.
 *
 * Bodyweight sessions are left out rather than plotted as zero: a chart that
 * drops to the floor every time the user trained without weights describes the
 * recording format, not the progress.
 * @param {object[]} records Sessions holding sets, oldest first.
 * @returns {Array<{date: string, value: number}>} Progression data.
 */
function extractStrengthProgressionData(records) {
  return records
    .filter((record) => record.sets.some(isWeightedSet))
    .map((record) => ({ date: recordDateKey(record), value: sessionMaxWeight(record) }));
}

/**
 * Reports whether a smaller figure is the better one for an activity.
 *
 * Only time-tracked activities can set this: with sets and reps, more is always
 * the improvement. Activities saved before the setting existed read as higher.
 * @param {Object} activity The activity object.
 * @returns {boolean} True when lower is better.
 */
function prefersLower(activity) {
  return activity?.trackingType !== 'sets-reps' && activity?.betterDirection === 'lower';
}

/**
 * Picks the better of a set of figures for an activity, honouring its direction.
 * @param {number[]} values Candidate figures.
 * @param {Object} activity The activity object.
 * @returns {number} The best figure.
 */
export function bestValue(values, activity) {
  return prefersLower(activity) ? Math.min(...values) : Math.max(...values);
}

/**
 * Picks round axis values covering a range.
 *
 * Steps are constrained to 1, 2, 2.5 or 5 times a power of ten, which is what
 * makes an axis read as 0/20/40/60 rather than 0/23.7/47.4/71.1. The domain is
 * widened to the outermost ticks so the top and bottom rules bound the plot.
 * @param {number} min Lowest value in the series.
 * @param {number} max Highest value in the series.
 * @param {number} [targetCount] Rough number of gaps wanted.
 * @returns {{ticks: number[], min: number, max: number}} Ticks and the padded domain.
 */
function niceTicks(min, max, targetCount = 4) {
  const rawSpan = max - min;
  if (!Number.isFinite(rawSpan) || rawSpan <= 0) {
    return { ticks: [min], min, max: min || 1 };
  }

  const rawStep = rawSpan / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const niceStep =
    (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10) *
    magnitude;

  const start = Math.floor(min / niceStep) * niceStep;
  const end = Math.ceil(max / niceStep) * niceStep;

  const ticks = [];
  // Floating-point steps drift, so compute each tick from the index and guard
  // the loop bound with a small epsilon rather than accumulating.
  const count = Math.round((end - start) / niceStep);
  for (let i = 0; i <= count; i += 1) {
    ticks.push(Number((start + i * niceStep).toPrecision(12)));
  }

  return { ticks, min: start, max: end };
}

/**
 * Formats an axis tick without trailing zeroes.
 * @param {number} value Tick value.
 * @returns {string} Label.
 */
function formatTick(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2)));
}

/**
 * Formats a YYYY-MM-DD key as a short DD/MM label.
 * @param {string} iso Date key.
 * @returns {string} Short label, or an empty string for an unparsable key.
 */
export function shortDateLabel(iso) {
  const time = Date.parse(`${String(iso || '').slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(time)) return '';
  const date = new Date(time);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/**
 * Renders a compact progression sparkline for the activity details modal.
 *
 * Built for the width a detail card gives it: horizontal rules rather than a
 * full axis box, a filled area under the line, and only the first, middle and
 * last dates labelled.
 *
 * @param {Array<{date: string, value: number}>} data Progression points, oldest first.
 * @param {string} color Line colour.
 * @param {string} unit Unit shown beside the peak value.
 * @param {string} [axisLabel] Y-axis title, e.g. "Max weight (kg)".
 * @returns {string} SVG markup, or an empty string with fewer than two points.
 */
function generateProgressChartSVG(data, color = '#3b82f6', unit = '', axisLabel = '') {
  if (!data || data.length < 2) return '';

  const width = 320;
  const height = 140;
  // Left gutter fits the rotated axis title plus a four-digit tick label, bottom
  // fits the tick marks and dates, and the top leaves room for the value printed
  // above each point. The x axis carries only its dates — what they are is
  // obvious, and a title there would cost a row of height for nothing.
  const margin = { top: 22, right: 14, bottom: 26, left: axisLabel ? 54 : 40 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const values = data.map((point) => point.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  // A flat series would divide by zero; give it a nominal range so the line
  // renders through the middle of the plot instead of collapsing onto an edge.
  const flat = maxValue === minValue;
  const pad = flat ? Math.max(1, Math.abs(maxValue) * 0.2) : 0;
  const { ticks, min: low, max: high } = niceTicks(minValue - pad, maxValue + pad);
  const span = high - low || 1;

  const x = (index) => margin.left + (index / (data.length - 1)) * plotWidth;
  const y = (value) => margin.top + plotHeight - ((value - low) / span) * plotHeight;

  const line = data.map((point, index) => `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`);
  const area = [
    `${margin.left},${margin.top + plotHeight}`,
    ...line,
    `${margin.left + plotWidth},${margin.top + plotHeight}`,
  ].join(' ');

  // Dots crowd the line once a series gets long; the shape carries it from there.
  const dots =
    data.length > 12
      ? ''
      : data
          .map(
            (point, index) =>
              `<circle cx="${x(index).toFixed(1)}" cy="${y(point.value).toFixed(1)}" r="3" fill="${color}"/>`
          )
          .join('');

  // Horizontal rules only, on round values. A full axis box would box in a chart
  // this small; the rules alone carry the scale.
  const grid = ticks
    .map((value) => {
      const rowY = y(value);
      const baseline = value === ticks[0];
      return `
        <line x1="${margin.left}" y1="${rowY.toFixed(1)}" x2="${(margin.left + plotWidth).toFixed(1)}" y2="${rowY.toFixed(1)}" stroke="currentColor" stroke-width="${baseline ? 1.5 : 1}" opacity="${baseline ? 0.6 : 0.22}"/>
        <text class="axis-tick" x="${margin.left - 8}" y="${(rowY + 3.5).toFixed(1)}" text-anchor="end" font-size="10" font-weight="600" fill="currentColor" opacity="0.9">${formatTick(value)}</text>
      `;
    })
    .join('');

  // First, middle and last dates. More than three labels collide at this width.
  const labelIndices =
    data.length > 2 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0, data.length - 1];
  const xLabels = [...new Set(labelIndices)]
    .map((index) => {
      const anchor = index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle';
      return `
        <line x1="${x(index).toFixed(1)}" y1="${(margin.top + plotHeight).toFixed(1)}" x2="${x(index).toFixed(1)}" y2="${(margin.top + plotHeight + 4).toFixed(1)}" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
        <text class="axis-date" x="${x(index).toFixed(1)}" y="${height - 5}" text-anchor="${anchor}" font-size="10" font-weight="600" fill="currentColor" opacity="0.9">${shortDateLabel(data[index].date)}</text>
      `;
    })
    .join('');

  // The exact figure sits above its point. Past roughly eight sessions the
  // labels would overlap, so only the peak and the latest keep theirs.
  const labelledPoints =
    data.length <= 8
      ? data.map((_, index) => index)
      : [...new Set([values.indexOf(maxValue), data.length - 1])];
  const valueLabels = labelledPoints
    .map((index) => {
      const point = data[index];
      // Nudge the end labels inwards so they do not run past the plot edges.
      const anchor = index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle';
      return `
        <text class="point-value" x="${x(index).toFixed(1)}" y="${(y(point.value) - 8).toFixed(1)}" text-anchor="${anchor}" font-size="9.5" font-weight="700" fill="${color}">${formatTick(point.value)}</text>
      `;
    })
    .join('');

  const gradientId = `progress-fill-${Math.random().toString(36).slice(2, 9)}`;
  const firstLabel = shortDateLabel(data[0].date);
  const lastLabel = shortDateLabel(data[data.length - 1].date);

  const axisTitle = axisLabel
    ? `<text class="axis-title" x="12" y="${(margin.top + plotHeight / 2).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor" opacity="0.9" transform="rotate(-90, 12, ${(margin.top + plotHeight / 2).toFixed(1)})">${axisLabel}</text>`
    : '';

  return `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-36 text-gray-600 dark:text-gray-300" role="img" aria-label="Progression from ${firstLabel} to ${lastLabel}, peak ${maxValue}${unit ? ` ${unit}` : ''}">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${axisTitle}
      ${grid}
      <polygon points="${area}" fill="url(#${gradientId})"/>
      <polyline points="${line.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${valueLabels}
      ${xLabels}
    </svg>
  `;
}

/**
 * Builds the progress card for the activity details modal: a chart once there
 * are at least two sessions to compare, and an explanatory placeholder before
 * that, so the section never renders as an empty box.
 * @param {Object} activity The activity object.
 * @param {Object} category The activity's category, for the line colour.
 * @returns {string} HTML markup for the progress card body.
 */
export function buildProgressCard(activity, category) {
  const { points, unit } = extractProgressionSeries(activity);
  const metric = activity?.trackingType === 'sets-reps' ? 'Max weight' : 'Duration';

  if (points.length < 2) {
    const remaining = 2 - points.length;
    return `
      <div class="flex flex-col items-center justify-center text-center py-6 px-3 space-y-1">
        <span class="material-icons text-3xl text-gray-400" aria-hidden="true">show_chart</span>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-300">Progress being calculated</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">Record ${remaining} more ${remaining === 1 ? 'session' : 'sessions'} to see a progress graph.</p>
      </div>
    `;
  }

  // The metric and unit live on the y axis rather than in a caption above it.
  const axisLabel = `${metric}${unit ? ` (${unit})` : ''}`;
  return generateProgressChartSVG(points, category?.color || '#3b82f6', unit, axisLabel);
}
