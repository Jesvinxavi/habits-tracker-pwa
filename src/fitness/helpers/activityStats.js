/**
 * Activity Statistics Helper Functions
 *
 * Pure functions for calculating and formatting activity statistics
 * Extracted from src/ui/fitness.js for better modularity
 */

import { appData } from '../../core/state.js';
import { getActivity, getActivityCategory } from '../../utils/activities.js';
import { formatDuration, formatLastPerformed } from '../../utils/datetime.js';

/**
 * Calculates comprehensive statistics for an activity
 * @param {string} activityId - The ID of the activity
 * @returns {Object|null} Statistics object or null if activity not found
 */
export function calculateActivityStatistics(activityId) {
  const activity = getActivity(activityId);
  if (!activity) return null;

  // Get all records for this activity across all dates
  const allRecords = [];
  Object.values(appData.recordedActivities || {}).forEach((dayRecords) => {
    dayRecords.forEach((record) => {
      if (record.activityId === activityId) {
        allRecords.push(record);
      }
    });
  });

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

  // Sort records by timestamp
  allRecords.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

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
    let maxDuration = 0;
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

        // Track best session by duration
        if (durationInMinutes > maxDuration) {
          maxDuration = durationInMinutes;
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
    content += `
      <div class="stats-section">
        <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Best Session</h4>
        <div class="stat-card bg-gradient-to-r from-${category.color.slice(1)} to-${category.color.slice(1)} bg-opacity-10 p-4 rounded-lg border-2" style="border-color: ${category.color}40;">
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
export function formatBestSession(session, activity) {
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
        Max weight: ${maxWeight}${session.sets[0]?.unit !== 'none' ? session.sets[0]?.unit || '' : ''}
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
        ${durationText}${session.intensity ? ` • ${session.intensity} intensity` : ''}
      </div>
      <div class="text-xs text-gray-600 dark:text-gray-300">
        Longest duration session
      </div>
    `;
  }
}

/**
 * Opens activity statistics modal with calculated data
 * @param {Object} activity - The activity object
 * @param {Object} stats - The calculated statistics
 */
export function openActivityStatsModal(activity, stats) {
  const category = getActivityCategory(activity.categoryId);

  // Create modal HTML
  const modalHTML = `
    <div id="activity-stats-modal" class="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
      <div class="modal-content bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
        <div class="modal-header flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="activity-icon w-10 h-10 rounded-full flex items-center justify-center text-xl" style="background-color: ${category.color}20; color: ${category.color};">
              ${activity.icon || category.icon}
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${activity.name}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">Activity Statistics</p>
            </div>
          </div>
          <button id="close-stats-modal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        
        <div class="modal-body flex-1 overflow-y-auto p-4">
          ${buildStatsContent(activity, stats, category)}
        </div>
      </div>
    </div>
  `;

  // Remove existing modal if present
  const existingModal = document.getElementById('activity-stats-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Add modal to document
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Bind close handlers
  const modal = document.getElementById('activity-stats-modal');
  const closeIcon = document.getElementById('close-stats-modal');

  const closeModal = () => {
    if (modal) {
      modal.classList.add('hidden');
      setTimeout(() => modal.remove(), 300);
    }
  };

  if (closeIcon) closeIcon.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Show modal
  if (modal) {
    modal.classList.remove('hidden');
  }
}
