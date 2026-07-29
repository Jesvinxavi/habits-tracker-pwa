/**
 * Activity Statistics Helper Functions
 *
 * Pure functions for calculating and formatting activity statistics
 * Extracted from src/ui/fitness.js for better modularity
 */

import { getActivity } from '../activities.js';
import { formatDuration, formatLastPerformed } from '../../../shared/datetime.js';
import { escapeHtml, normalizeHexColor } from '../../../shared/sanitize.js';
import { getRecordedHistoryIndex } from './recordedHistory.js';

/**
 * Calculates comprehensive statistics for an activity
 * @param {string} activityId - The ID of the activity
 * @returns {Object|null} Statistics object or null if activity not found
 */
export function calculateActivityStatistics(activityId) {
  const activity = getActivity(activityId);
  if (!activity) return null;

  // Get all records for this activity across all dates
  const allRecords = getRecordedHistoryIndex().byActivity.get(activityId) || [];

  if (allRecords.length === 0) {
    return {
      totalSessions: 0,
      totalDuration: 0,
      totalSets: 0,
      totalReps: 0,
      totalVolume: 0,
      averageDuration: 0,
      averageSets: 0,
      averageReps: 0,
      mostCommonIntensity: null,
      lastPerformed: null,
      bestSession: null,
      recentFrequency: 0,
      weeklyAverage: 0,
    };
  }

  const stats = {
    totalSessions: allRecords.length,
    totalDuration: 0,
    totalSets: 0,
    totalReps: 0,
    totalVolume: 0,
    averageDuration: 0,
    averageSets: 0,
    averageReps: 0,
    mostCommonIntensity: null,
    lastPerformed: allRecords[allRecords.length - 1].timestamp,
    bestSession: null,
    recentFrequency: 0,
    weeklyAverage: 0,
  };

  // Calculate metrics based on tracking type
  if (activity.trackingType === 'sets-reps') {
    let maxVolume = 0;
    let bestSessionRecord = null;

    allRecords.forEach((record) => {
      if (record.sets && record.sets.length > 0) {
        stats.totalSets += record.sets.length;

        record.sets.forEach((set) => {
          if (set.reps) stats.totalReps += parseInt(set.reps) || 0;
          if (set.value && set.unit && set.unit !== 'none') {
            const weight = parseFloat(set.value) || 0;
            const reps = parseInt(set.reps) || 0;
            const volume = weight * reps;
            stats.totalVolume += volume;

            // Track best session by total volume
            if (volume > maxVolume) {
              maxVolume = volume;
              bestSessionRecord = record;
            }
          }
        });
      }
    });

    stats.averageSets = stats.totalSets / stats.totalSessions;
    stats.averageReps = stats.totalReps / stats.totalSessions;
    stats.bestSession = bestSessionRecord;
  } else {
    // Time-based tracking
    const intensities = {};
    const lowerIsBetter = prefersLower(activity);
    let bestDuration = null;
    let bestSessionRecord = null;

    allRecords.forEach((record) => {
      if (record.duration) {
        let durationInMinutes = parseInt(record.duration) || 0;

        // Convert to minutes for consistency
        if (record.durationUnit === 'hours') {
          durationInMinutes *= 60;
        } else if (record.durationUnit === 'seconds') {
          durationInMinutes /= 60;
        }

        stats.totalDuration += durationInMinutes;

        // Best session is the longest, or the quickest when the activity is one
        // where a smaller figure is the improvement.
        const better =
          bestDuration === null ||
          (lowerIsBetter ? durationInMinutes < bestDuration : durationInMinutes > bestDuration);
        if (better) {
          bestDuration = durationInMinutes;
          bestSessionRecord = record;
        }
      }

      if (record.intensity) {
        intensities[record.intensity] = (intensities[record.intensity] || 0) + 1;
      }
    });

    stats.averageDuration = stats.totalDuration / stats.totalSessions;
    stats.bestSession = bestSessionRecord;

    // Find most common intensity
    if (Object.keys(intensities).length > 0) {
      stats.mostCommonIntensity = Object.entries(intensities).sort(([, a], [, b]) => b - a)[0][0];
    }
  }

  // Calculate recent frequency (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentRecords = allRecords.filter((record) => new Date(record.timestamp) > thirtyDaysAgo);
  stats.recentFrequency = recentRecords.length;

  // Calculate weekly average (total sessions / weeks since first session)
  const firstSession = new Date(allRecords[0].timestamp);
  const now = new Date();
  const daysSinceFirst = Math.max(1, (now - firstSession) / (1000 * 60 * 60 * 24));
  const weeksSinceFirst = daysSinceFirst / 7;
  stats.weeklyAverage = stats.totalSessions / weeksSinceFirst;

  return stats;
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
    return `
      <div class="text-center py-8">
        <span class="material-icons text-4xl text-gray-400 mb-4">bar_chart</span>
        <p class="text-gray-600 dark:text-gray-400">No recorded sessions yet</p>
        <p class="text-sm text-gray-500 mt-2">Start tracking this activity to see statistics</p>
      </div>
    `;
  }

  let content = `
    <div class="stats-grid space-y-4">
      <!-- Overview Stats -->
      <div class="stats-section">
        <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Overview</h4>
        <div class="grid grid-cols-2 gap-4">
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-2xl font-bold text-gray-900 dark:text-white">${stats.totalSessions}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Total Sessions</div>
          </div>
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-2xl font-bold text-gray-900 dark:text-white">${stats.weeklyAverage.toFixed(1)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Per Week Average</div>
          </div>
        </div>
      </div>
  `;

  // Activity-specific stats
  if (activity.trackingType === 'sets-reps') {
    content += `
      <div class="stats-section">
        <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Strength Metrics</h4>
        <div class="grid grid-cols-2 gap-4">
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.totalSets}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Total Sets</div>
          </div>
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.totalReps}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Total Reps</div>
          </div>
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.averageSets.toFixed(1)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Avg Sets/Session</div>
          </div>
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.averageReps.toFixed(1)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Avg Reps/Session</div>
          </div>
        </div>
        ${
          stats.totalVolume > 0
            ? `
        <div class="mt-4">
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.totalVolume.toFixed(1)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Total Volume (weight × reps)</div>
          </div>
        </div>
      `
            : ''
        }
      </div>
    `;
    // No progression chart here: the activity details modal already charts it,
    // and this modal is the numbers view.
  } else {
    content += `
      <div class="stats-section">
        <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Duration Metrics</h4>
        <div class="grid grid-cols-2 gap-4">
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${formatDuration(stats.totalDuration)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Total Duration</div>
          </div>
          <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${formatDuration(stats.averageDuration)}</div>
            <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Avg Duration</div>
          </div>
        </div>
        ${
          stats.mostCommonIntensity
            ? `
          <div class="mt-4">
            <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <div class="stat-value text-lg font-bold text-gray-900 dark:text-white capitalize">${stats.mostCommonIntensity}</div>
              <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Most Common Intensity</div>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  // Recent activity
  content += `
    <div class="stats-section">
      <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Recent Activity</h4>
      <div class="grid grid-cols-2 gap-4">
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="stat-value text-xl font-bold text-gray-900 dark:text-white">${stats.recentFrequency}</div>
          <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Last 30 Days</div>
        </div>
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <div class="stat-value text-sm font-bold text-gray-900 dark:text-white">${formatLastPerformed(stats.lastPerformed)}</div>
          <div class="stat-label text-xs text-gray-500 dark:text-gray-400">Last Performed</div>
        </div>
      </div>
    </div>
  `;

  // Best session
  if (stats.bestSession) {
    const categoryColor = normalizeHexColor(category?.color);
    content += `
      <div class="stats-section">
        <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Best Session</h4>
        <div class="stat-card bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border-2" style="border-color: ${categoryColor}40;">
          ${formatBestSession(stats.bestSession, activity)}
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
            ${new Date(stats.bestSession.timestamp).toLocaleDateString()}
          </div>
        </div>
      </div>
    `;
  }

  content += '</div>';
  return content;
}

/**
 * Helper function to format best session details
 * @param {Object} session - The best session record
 * @param {Object} activity - The activity object
 * @returns {string} HTML string for the best session display
 */
function formatBestSession(session, activity) {
  if (activity.trackingType === 'sets-reps' && session.sets) {
    const totalVolume = session.sets.reduce((sum, set) => {
      const weight = parseFloat(set.value) || 0;
      const reps = parseInt(set.reps) || 0;
      return sum + weight * reps;
    }, 0);

    const maxWeight = Math.max(...session.sets.map((set) => parseFloat(set.value) || 0));

    return `
      <div class="text-sm font-semibold text-gray-900 dark:text-white">
        ${session.sets.length} sets • ${totalVolume.toFixed(1)} volume
      </div>
      <div class="text-xs text-gray-600 dark:text-gray-300">
        Max weight: ${maxWeight}${session.sets[0]?.unit !== 'none' ? escapeHtml(session.sets[0]?.unit || '') : ''}
      </div>
    `;
  } else {
    let durationText = '';
    if (session.duration) {
      let duration = session.duration;
      let unit = session.durationUnit || 'minutes';

      if (unit === 'hours') {
        duration = duration * 60;
        unit = 'minutes';
      } else if (unit === 'seconds') {
        duration = Math.round(duration / 60);
        unit = 'minutes';
      }

      durationText = `${duration} ${unit === 'minutes' ? 'min' : unit}`;
    }

    return `
      <div class="text-sm font-semibold text-gray-900 dark:text-white">
        ${escapeHtml(durationText)}${session.intensity ? ` • ${escapeHtml(session.intensity)} intensity` : ''}
      </div>
      <div class="text-xs text-gray-600 dark:text-gray-300">
        ${prefersLower(activity) ? 'Quickest session' : 'Longest duration session'}
      </div>
    `;
  }
}

/**
 * Gets the weight unit used for an activity by looking at recent recorded sets
 * @param {string} activityId - The activity ID
 * @returns {string} - The weight unit (e.g., 'lbs', 'kg') or empty string
 */
function getWeightUnitForActivity(activityId) {
  const allRecords = (getRecordedHistoryIndex().byActivity.get(activityId) || []).filter(
    (record) => record.sets
  );

  // Find the most recent record with a non-'none' unit
  for (let i = allRecords.length - 1; i >= 0; i--) {
    const record = allRecords[i];
    if (record.sets && record.sets.length > 0) {
      const set = record.sets.find(s => s.unit && s.unit !== 'none');
      if (set && set.unit) {
        return set.unit;
      }
    }
  }

  return 'lbs'; // Default fallback
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

  const allRecords = (getRecordedHistoryIndex().byActivity.get(activityId) || []).filter(
    (record) => record.duration
  );

  return allRecords.map((record) => {
    let minutes = parseFloat(record.duration) || 0;
    if (record.durationUnit === 'hours') minutes *= 60;
    else if (record.durationUnit === 'seconds') minutes /= 60;
    return { date: record.date, value: Math.round(minutes * 10) / 10 };
  });
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
    return {
      points: extractStrengthProgressionData(activity.id),
      unit: getWeightUnitForActivity(activity.id),
    };
  }
  return { points: extractDurationProgressionData(activity.id), unit: 'min' };
}

function extractStrengthProgressionData(activityId) {
  const activity = getActivity(activityId);
  if (!activity || activity.trackingType !== 'sets-reps') return [];

  // Flatten records similar to calculateActivityStatistics
  const allRecords = getRecordedHistoryIndex().byActivity.get(activityId) || [];

  if (allRecords.length === 0) return [];

  const progression = [];

  allRecords.forEach((record) => {
    if (!record.sets || record.sets.length === 0) return;

    // Determine the heaviest weight lifted in this session
    // Ignore sets with unit === 'none'. Treat missing/invalid as 0.
    const maxWeight = Math.max(
      ...record.sets.map((set) => {
        const weight = parseFloat(set.value);
        return isNaN(weight) ? 0 : weight;
      }),
      0,
    );

    // Use the actual recorded date from the fitness page, not the timestamp
    const date = record.date;

    progression.push({ date, value: maxWeight });
  });

  return progression;
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
