/**
 * Stats view controller - manages the statistics and analytics page
 *
 * This module provides a comprehensive statistics dashboard for the PWA Habits tracker.
 * It displays general statistics for both habits and fitness activities, including:
 * - Habit completion rates and streaks
 * - Category-based breakdowns
 * - Fitness session analytics
 * - 100% completion streak calculations
 *
 * The page follows the same styling patterns as the fitness page with left-aligned titles.
 */

import { getState, subscribe } from '../../core/state.js';
import {
  isHabitCompleted,
  isHabitScheduledOnDate,
  belongsToSelectedGroup,
} from '../home/schedule.js';
import { formatDuration } from '../../shared/datetime.js';
import { isHoliday } from '../../features/holidays/holidays.js';
import { isRestDay } from '../../features/fitness/restDays.js';

// Current stats view state - 'habits' or 'fitness'
let currentStatsView = 'habits';
let activeCarouselInterval = null;

/**
 * Initializes the stats view with all its components
 */
export function initializeStats() {
  buildHeader();
  buildStatsContainer();

  // Subscribe to state changes for reactive updates
  subscribe(() => {
    renderStatsContent();
  });

  // Initial render
  renderStatsContent();
}

/**
 * Builds the header for the stats view
 */
function buildHeader() {
  const statsView = document.getElementById('stats-view');
  if (!statsView) return;

  // Clear any existing content
  statsView.innerHTML = '';

  buildHeaderBar();
}

/**
 * Builds the header bar with left-aligned title (same styling as fitness page)
 */
function buildHeaderBar() {
  const statsView = document.getElementById('stats-view');
  if (!statsView) return;

  const header = document.createElement('header');
  header.className =
    'app-header flex justify-between items-center h-11 px-4 sm:px-6 lg:px-8 w-full pt-1.5';

  header.innerHTML = `
    <div></div>
    <h1 class="app-title text-left flex-grow text-[36px] font-extrabold leading-none flex items-end">Statistics</h1>
    <div></div>
  `;

  statsView.appendChild(header);
}

/**
 * Builds the main stats container
 */
function buildStatsContainer() {
  const statsView = document.getElementById('stats-view');
  if (!statsView) return;

  const container = document.createElement('div');
  container.className =
    'stats-container flex-1 overflow-y-auto overscroll-behavior-contain px-4 py-4 pb-8';
  container.id = 'stats-container';

  statsView.appendChild(container);
}

/**
 * Renders the statistics content
 */
function renderStatsContent() {
  const container = document.getElementById('stats-container');
  if (!container) return;

  // Show loading state
  container.innerHTML =
    '<div class="loading-state p-8 text-center"><div class="loading-shimmer h-32 rounded-xl mb-4"></div><div class="loading-shimmer h-24 rounded-xl"></div></div>';

  try {
    // Calculate statistics
    const habitStats = calculateHabitStatistics();
    const fitnessStats = calculateFitnessStatistics();

    // Clear loading state
    container.innerHTML = '';

    // Render sections
    renderOverviewSection(container, habitStats, fitnessStats);
    renderStatsToggleSection(container);
    renderDetailedStatsSection(container, habitStats, fitnessStats);

    // Add empty state if no data
    if (habitStats.totalHabits === 0 && fitnessStats.totalActivities === 0) {
      renderEmptyState(container);
    }
  } catch (error) {
    // Error state
    container.innerHTML = `
      <div class="error-state p-8 text-center">
        <div class="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full mx-auto mb-4 flex items-center justify-center">
          <svg class="w-8 h-8 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.349 16.5c-.77.833.192 2.5 1.732 2.5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Statistics</h3>
        <p class="text-gray-600 dark:text-gray-400">Please try refreshing the page</p>
      </div>
    `;
  }
}

/**
 * Calculate comprehensive habit statistics
 */
function calculateHabitStatistics() {
  const habits = (getState().habits || []).filter(validateHabitData);
  const today = new Date();

  // Basic counts
  const stats = {
    totalHabits: habits.length,
    activeHabits: habits.filter((h) => !h.paused).length,
    pausedHabits: habits.filter((h) => h.paused).length,
    completedToday: 0,
    streaks: [],
    categoryBreakdown: new Map(),
    completionRates: new Map(),
    longestStreak: 0,
    currentStreak: 0,
    averageCompletionRate: 0,
    // Group-specific statistics
    dailyHabits: [],
    weeklyHabits: [],
    monthlyHabits: [],
    yearlyHabits: [],
    dailyCompletionRate: 0,
    weeklyCompletionRate: 0,
    monthlyCompletionRate: 0,
    // Holiday statistics
    holidayDaysThisYear: 0,
  };

  // Categorize habits by group and calculate group-specific statistics
  habits.forEach((habit) => {
    if (habit.paused) return;

    try {
      // Calculate completion rate over the last 30 days
      const completionRate = safeCalculation(() => calculateHabitCompletionRate(habit, 30), 0);
      stats.completionRates.set(habit.id, {
        habitName: habit.name,
        rate: completionRate,
        categoryId: habit.categoryId,
        habitId: habit.id,
      });

      // Categorize habit by group
      if (belongsToSelectedGroup(habit, 'daily')) {
        stats.dailyHabits.push(habit);
      } else if (belongsToSelectedGroup(habit, 'weekly')) {
        stats.weeklyHabits.push(habit);
      } else if (belongsToSelectedGroup(habit, 'monthly')) {
        stats.monthlyHabits.push(habit);
      } else if (belongsToSelectedGroup(habit, 'yearly')) {
        stats.yearlyHabits.push(habit);
      }

      // Calculate streaks (only for daily habits)
      if (belongsToSelectedGroup(habit, 'daily')) {
        const currentStreak = safeCalculation(() => calculateCurrentStreak(habit), 0);
        const longestStreak = safeCalculation(() => calculateLongestStreak(habit), 0);

        stats.streaks.push({
          habitName: habit.name,
          currentStreak,
          longestStreak,
          categoryId: habit.categoryId,
        });

        // Update longest streak record (only for daily habits)
        // Removed individual max, will compute group after loop
      }

      // Check if completed today
      if (isHabitCompleted(habit, today)) {
        stats.completedToday++;
      }

      // Category breakdown
      const categoryId = habit.categoryId;
      if (!stats.categoryBreakdown.has(categoryId)) {
        stats.categoryBreakdown.set(categoryId, {
          count: 0,
          completionRate: 0,
          habits: [],
        });
      }

      const categoryData = stats.categoryBreakdown.get(categoryId);
      categoryData.count++;
      categoryData.habits.push({
        name: habit.name,
        completionRate: completionRate,
      });
    } catch (error) {
      // Ignore calculation errors for individual habits
    }
  });

  // Calculate category completion rates
  stats.categoryBreakdown.forEach((categoryData, categoryId) => {
    const totalRate = categoryData.habits.reduce((sum, h) => sum + (h.completionRate || 0), 0);
    categoryData.completionRate =
      categoryData.habits.length > 0 ? totalRate / categoryData.habits.length : 0;
  });

  // Calculate group-specific completion rates
  if (stats.dailyHabits.length > 0) {
    const dailyRates = stats.dailyHabits.map((habit) =>
      safeCalculation(() => calculateHabitCompletionRate(habit, 30), 0)
    );
    stats.dailyCompletionRate = dailyRates.reduce((sum, rate) => sum + rate, 0) / dailyRates.length;
  }

  if (stats.weeklyHabits.length > 0) {
    const weeklyRates = stats.weeklyHabits.map((habit) =>
      safeCalculation(() => calculateWeeklyHabitCompletionRate(habit, 4), 0)
    );
    stats.weeklyCompletionRate =
      weeklyRates.reduce((sum, rate) => sum + rate, 0) / weeklyRates.length;
  }

  if (stats.monthlyHabits.length > 0) {
    const monthlyRates = stats.monthlyHabits.map((habit) =>
      safeCalculation(() => calculateMonthlyHabitCompletionRate(habit, 3), 0)
    );
    stats.monthlyCompletionRate =
      monthlyRates.reduce((sum, rate) => sum + rate, 0) / monthlyRates.length;
  }

  // Calculate overall average completion rate (only for daily habits)
  const dailyCompletionRates = Array.from(stats.completionRates.values()).filter((rate) =>
    stats.dailyHabits.some((habit) => habit.id === rate.habitId)
  );
  const totalCompletionRate = dailyCompletionRates.reduce((sum, h) => sum + (h.rate || 0), 0);
  stats.averageCompletionRate =
    dailyCompletionRates.length > 0 ? totalCompletionRate / dailyCompletionRates.length : 0;

  // Calculate holiday days this year
  const currentYear = today.getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);

  let holidayCount = 0;
  const currentDate = new Date(yearStart);
  while (currentDate <= yearEnd) {
    if (isHoliday(currentDate.toISOString())) {
      holidayCount++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  stats.holidayDaysThisYear = holidayCount;

  // Calculate group longest 100% streak
  stats.longestStreak = safeCalculation(() => calculateLongestGroupStreak(stats.dailyHabits), 0);

  return stats;
}

/**
 * Calculate completion rate for a specific habit over the last N days
 * Only counts scheduled days as denominator for accurate percentage
 * Only looks back to when the habit was actually created
 */
function calculateHabitCompletionRate(habit, days = 30) {
  const today = new Date();
  let completed = 0;
  let scheduled = 0;

  // Extract creation date from habit ID (timestamp + random string)
  let creationDate;
  if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) {
      creationDate = new Date(ts);
    }
  }

  // Fallback to current date if we can't extract creation date
  if (!creationDate || isNaN(creationDate)) {
    creationDate = new Date();
  }

  // Calculate how many days the habit has existed
  const daysSinceCreation = Math.floor((today - creationDate) / (1000 * 60 * 60 * 24)) + 1; // +1 to include today

  // Only look back as far as the habit has existed, or the requested days, whichever is smaller
  const daysToCheck = Math.min(days, daysSinceCreation);

  for (let i = 0; i < daysToCheck; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    // Don't check dates before the habit was created
    if (date < creationDate) {
      continue;
    }

    if (isHabitScheduledOnDate(habit, date)) {
      scheduled++;
      if (isHabitCompleted(habit, date)) {
        completed++;
      }
    }
  }

  // Return completion rate based only on scheduled days since creation
  // If no days were scheduled in the period, return 0
  return scheduled > 0 ? (completed / scheduled) * 100 : 0;
}

/**
 * Calculate completion rate for weekly habits based on actual weeks
 */
function calculateWeeklyHabitCompletionRate(habit, weeks = 4) {
  const today = new Date();
  let completed = 0;
  let scheduled = 0;

  // Extract creation date from habit ID
  let creationDate;
  if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) {
      creationDate = new Date(ts);
    }
  }

  // Fallback to current date if we can't extract creation date
  if (!creationDate || isNaN(creationDate)) {
    creationDate = new Date();
  }

  // Calculate weeks since creation
  const weeksSinceCreation = Math.floor((today - creationDate) / (1000 * 60 * 60 * 24 * 7)) + 1;
  const weeksToCheck = Math.min(weeks, weeksSinceCreation);

  for (let i = 0; i < weeksToCheck; i++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - i * 7);

    // Get the start of the week (Monday)
    const dayOfWeek = weekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - daysToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Check if habit was scheduled in this week
    let weekScheduled = false;
    let weekCompleted = false;

    const currentDate = new Date(weekStart);
    while (currentDate <= weekEnd) {
      if (currentDate >= creationDate && isHabitScheduledOnDate(habit, currentDate)) {
        weekScheduled = true;
        if (isHabitCompleted(habit, currentDate)) {
          weekCompleted = true;
          break; // Weekly habit is considered complete if done once in the week
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (weekScheduled) {
      scheduled++;
      if (weekCompleted) {
        completed++;
      }
    }
  }

  return scheduled > 0 ? (completed / scheduled) * 100 : 0;
}

/**
 * Calculate completion rate for monthly habits based on actual months
 */
function calculateMonthlyHabitCompletionRate(habit, months = 3) {
  const today = new Date();
  let completed = 0;
  let scheduled = 0;

  // Extract creation date from habit ID
  let creationDate;
  if (typeof habit.id === 'string' && /^[0-9]{13}/.test(habit.id)) {
    const ts = parseInt(habit.id.slice(0, 13), 10);
    if (!Number.isNaN(ts)) {
      creationDate = new Date(ts);
    }
  }

  // Fallback to current date if we can't extract creation date
  if (!creationDate || isNaN(creationDate)) {
    creationDate = new Date();
  }

  // Calculate months since creation
  const monthsSinceCreation =
    (today.getFullYear() - creationDate.getFullYear()) * 12 +
    (today.getMonth() - creationDate.getMonth()) +
    1;
  const monthsToCheck = Math.min(months, monthsSinceCreation);

  for (let i = 0; i < monthsToCheck; i++) {
    // Calculate the month we're checking (0 = current month, 1 = previous month, etc.)
    const targetMonth = today.getMonth() - i;
    const targetYear = today.getFullYear();

    // Adjust year if we go into negative months
    const adjustedYear = targetMonth < 0 ? targetYear - 1 : targetYear;
    const adjustedMonth = targetMonth < 0 ? targetMonth + 12 : targetMonth;

    const monthStart = new Date(adjustedYear, adjustedMonth, 1);
    const monthEnd = new Date(adjustedYear, adjustedMonth + 1, 0, 23, 59, 59, 999);

    // Check if habit was scheduled in this month
    let monthScheduled = false;
    let monthCompleted = false;

    const currentDate = new Date(monthStart);
    while (currentDate <= monthEnd) {
      if (currentDate >= creationDate && isHabitScheduledOnDate(habit, currentDate)) {
        monthScheduled = true;
        if (isHabitCompleted(habit, currentDate)) {
          monthCompleted = true;
          break; // Monthly habit is considered complete if done once in the month
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (monthScheduled) {
      scheduled++;
      if (monthCompleted) {
        completed++;
      }
    }
  }

  const result = scheduled > 0 ? (completed / scheduled) * 100 : 0;
  return result;
}

/**
 * Calculate current streak for a habit (consecutive days of completion)
 */
function calculateCurrentStreak(habit) {
  const today = new Date();
  let streak = 0;
  let date = new Date(today);

  // Check up to 365 days back
  for (let i = 0; i < 365; i++) {
    if (isHabitScheduledOnDate(habit, date)) {
      if (isHabitCompleted(habit, date)) {
        streak++;
      } else {
        break;
      }
    }
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

/**
 * Calculate longest streak for a habit
 */
function calculateLongestStreak(habit) {
  const today = new Date();
  let longestStreak = 0;
  let currentStreak = 0;

  // Check last 365 days
  for (let i = 365; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    if (isHabitScheduledOnDate(habit, date)) {
      if (isHabitCompleted(habit, date)) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
  }

  return longestStreak;
}

/**
 * Calculate longest 100% streak for the daily habit group
 * (consecutive active days with 100% completion, skipping holidays without breaking streak)
 */
function calculateLongestGroupStreak(dailyHabits) {
  if (dailyHabits.length === 0) return 0;

  const today = new Date();
  let longest = 0;
  let current = 0;

  for (let i = 365; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const scheduled = dailyHabits.filter(h => isHabitScheduledOnDate(h, date));

    if (scheduled.length === 0) continue; // Skip non-active days

    const completedCount = scheduled.filter(h => isHabitCompleted(h, date)).length;
    const is100Percent = completedCount === scheduled.length;

    if (is100Percent) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

/**
 * Calculate fitness statistics
 */
function calculateFitnessStatistics() {
  const activities = getState().activities || [];
  const recordedActivities = getState().recordedActivities || {};

  const stats = {
    totalActivities: activities.length,
    totalSessions: 0,
    categoriesUsed: new Set(),
    recentSessions: 0,
    totalDuration: 0,
    averageSessionDuration: 0,
    // Rest days statistics
    restDaysLast30Days: 0,
    restDaysPercentage: 0,
  };

  // Calculate from recorded activities
  Object.values(recordedActivities).forEach((dayRecords) => {
    dayRecords.forEach((record) => {
      stats.totalSessions++;

      // Track categories
      if (record.categoryId) {
        stats.categoriesUsed.add(record.categoryId);
      }

      // Calculate duration
      if (record.duration) {
        let durationInMinutes = parseInt(record.duration) || 0;
        if (record.durationUnit === 'hours') {
          durationInMinutes *= 60;
        } else if (record.durationUnit === 'seconds') {
          durationInMinutes /= 60;
        }
        stats.totalDuration += durationInMinutes;
      }
    });
  });

  // Calculate recent sessions (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  Object.entries(recordedActivities).forEach(([dateStr, dayRecords]) => {
    const recordDate = new Date(dateStr);
    if (recordDate >= thirtyDaysAgo) {
      stats.recentSessions += dayRecords.length;
    }
  });

  // Calculate average session duration
  stats.averageSessionDuration =
    stats.totalSessions > 0 ? stats.totalDuration / stats.totalSessions : 0;

  // Calculate rest days in the last 30 days
  let restDaysCount = 0;
  const currentDate = new Date(thirtyDaysAgo);
  const today = new Date();

  while (currentDate <= today) {
    const isoDate = currentDate.toISOString().split('T')[0];
    if (isRestDay(isoDate)) {
      restDaysCount++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  stats.restDaysLast30Days = restDaysCount;
  stats.restDaysPercentage = (restDaysCount / 30) * 100;

  return stats;
}

/**
 * Render overview section
 */
function renderOverviewSection(container, habitStats, fitnessStats) {
  const section = document.createElement('div');
  section.className = 'overview-section mb-6';

  section.innerHTML = `
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Overview</h2>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="stat-card bg-blue-50 dark:bg-blue-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-blue-600 dark:text-blue-300">${formatNumber(habitStats.totalHabits)}</div>
        <div class="stat-label text-sm text-blue-600 dark:text-blue-300">Total Habits</div>
      </div>
      <div class="stat-card bg-green-50 dark:bg-green-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-green-600 dark:text-green-300">${formatNumber(habitStats.completedToday)}</div>
        <div class="stat-label text-sm text-green-600 dark:text-green-300">Completed Today</div>
      </div>
      <div class="stat-card bg-purple-50 dark:bg-purple-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-purple-600 dark:text-purple-300">${formatNumber(fitnessStats.recentSessions)}</div>
        <div class="stat-label text-sm text-purple-600 dark:text-purple-300">Fitness Sessions</div>
        <div class="text-sm text-purple-600 dark:text-purple-300 mt-1">Last 30 days</div>
      </div>
      <div class="stat-card bg-orange-50 dark:bg-orange-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-orange-600 dark:text-orange-300">${formatNumber(habitStats.longestStreak)}</div>
        <div class="stat-label text-sm text-orange-600 dark:text-orange-300">Longest 100% Streak (Daily)</div>
      </div>
    </div>
  `;

  container.appendChild(section);
}

/**
 * Render habit statistics section - compressed version
 */
function renderHabitStatsSection(container, stats) {
  const section = document.createElement('div');
  section.className = 'habit-stats-section mb-6';

  // --- Completion Carousel ---
  // Calculate average completion rates for all daily habits
  const periods = [
    {
      label: '7d',
      rate:
        stats.dailyHabits.length > 0
          ? stats.dailyHabits
              .map((h) => safeCalculation(() => calculateHabitCompletionRate(h, 7), 0))
              .reduce((sum, r) => sum + r, 0) / stats.dailyHabits.length
          : 0,
    },
    {
      label: '30d',
      rate:
        stats.dailyHabits.length > 0
          ? stats.dailyHabits
              .map((h) => safeCalculation(() => calculateHabitCompletionRate(h, 30), 0))
              .reduce((sum, r) => sum + r, 0) / stats.dailyHabits.length
          : 0,
    },
    {
      label: 'All Time',
      rate:
        stats.dailyHabits.length > 0
          ? stats.dailyHabits
              .map((h) => safeCalculation(() => calculateHabitCompletionRate(h, 3650), 0))
              .reduce((sum, r) => sum + r, 0) / stats.dailyHabits.length
          : 0,
    },
  ];

  // Build dynamic tiles based on available habit groups
  const tiles = [];

  // Always show longest streak tile
  tiles.push(`
    <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
      <div class="text-2xl font-bold text-center mb-1 text-gray-900 dark:text-white">
        ${stats.longestStreak}
      </div>
      <div class="text-center text-sm text-gray-600 dark:text-gray-400">
        Longest 100% Streak (Daily)
      </div>
    </div>
  `);

  // Weekly habits tile
  if (stats.weeklyHabits.length > 0) {
    tiles.push(`
      <div class="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
        <div class="text-2xl font-bold text-center mb-1 text-blue-600 dark:text-blue-300">
          ${stats.weeklyCompletionRate.toFixed(1)}%
        </div>
        <div class="text-center text-sm text-blue-600 dark:text-blue-300">
          Weekly habits avg
        </div>
      </div>
    `);
  }

  // Monthly habits tile
  if (stats.monthlyHabits.length > 0) {
    tiles.push(`
      <div class="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg">
        <div class="text-2xl font-bold text-center mb-1 text-purple-600 dark:text-purple-300">
          ${stats.monthlyCompletionRate.toFixed(1)}%
        </div>
        <div class="text-center text-sm text-purple-600 dark:text-purple-300">
          Monthly habits avg
        </div>
      </div>
    `);
  }

  // Holiday days tile
  tiles.push(`
    <div class="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg">
      <div class="text-2xl font-bold text-center mb-1 text-yellow-600 dark:text-yellow-300">
        ${stats.holidayDaysThisYear}
      </div>
      <div class="text-center text-sm text-yellow-600 dark:text-yellow-300">
        Holiday days this year
      </div>
    </div>
  `);

  // Determine grid layout - max 2 tiles per row
  let gridClass = 'grid gap-3 mb-4';
  if (tiles.length === 1) {
    gridClass += ' grid-cols-1';
  } else {
    // Always use 2 columns for 2+ tiles
    gridClass += ' grid-cols-2';
  }

  section.innerHTML = `
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Habit Stats</h2>
    
    <!-- Stats Tiles including Carousel -->
    <div class="${gridClass}">
      <!-- Completion Carousel as a tile -->
      <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        ${renderHabitCompletionCarousel(periods)}
      </div>
      
      ${tiles.join('')}
    </div>
  `;

  let categoryStatsHTML = '';
  stats.categoryBreakdown.forEach((categoryData, categoryId) => {
    const category = getState().categories.find((c) => c.id === categoryId);
    const categoryName = category ? category.name : 'Unknown';
    const categoryColor = category ? category.color : '#888';

    categoryStatsHTML += `
      <div class="category-stat mb-3 p-3 rounded-lg border-l-4 bg-gray-50 dark:bg-gray-800" style="border-left-color: ${categoryColor};">
        <div class="flex justify-between items-center">
          <span class="font-medium text-sm">${categoryName}</span>
          <span class="text-sm text-gray-600 dark:text-gray-400">${categoryData.count} habits</span>
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Avg: ${categoryData.completionRate.toFixed(1)}%
        </div>
      </div>
    `;
  });

  section.innerHTML += `
    ${
      categoryStatsHTML
        ? `<div class="category-breakdown">
      <h3 class="text-lg font-medium mb-3 text-gray-900 dark:text-white">By Category</h3>
      ${categoryStatsHTML}
    </div>`
        : ''
    }
  `;

  container.appendChild(section);

  // After rendering the section, call initializeHabitCompletionCarousel
  setTimeout(() => {
    initializeHabitCompletionCarousel();
  }, 100);
}

/**
 * Render fitness statistics section - compressed version
 */
function renderFitnessStatsSection(container, stats) {
  const section = document.createElement('div');
  section.className = 'fitness-stats-section mb-8 pb-6';

  section.innerHTML = `
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Fitness Stats</h2>
    
    <div class="grid grid-cols-2 gap-3">
      <div class="stat-card bg-red-50 dark:bg-red-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-red-600 dark:text-red-300">${formatNumber(stats.totalActivities)}</div>
        <div class="stat-label text-sm text-red-600 dark:text-red-300">Total Activities</div>
      </div>
      <div class="stat-card bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-indigo-600 dark:text-indigo-300">${formatNumber(stats.recentSessions)}</div>
        <div class="stat-label text-sm text-indigo-600 dark:text-indigo-300">Recent Sessions</div>
        <div class="text-sm text-indigo-600 dark:text-indigo-300 mt-1">Last 30 days</div>
      </div>
      <div class="stat-card bg-teal-50 dark:bg-teal-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-teal-600 dark:text-teal-300">${formatDuration(stats.totalDuration)}</div>
        <div class="stat-label text-sm text-teal-600 dark:text-teal-300">Total Time</div>
      </div>
      <div class="stat-card bg-pink-50 dark:bg-pink-900 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-pink-600 dark:text-pink-300">${formatDuration(stats.averageSessionDuration)}</div>
        <div class="stat-label text-sm text-pink-600 dark:text-pink-300">Avg Session</div>
      </div>
    </div>
    
    <div class="grid grid-cols-1 gap-3 mt-4">
      <div class="stat-card bg-gray-50 dark:bg-gray-800 p-4 rounded-lg hover:scale-105 transition-transform">
        <div class="stat-value text-2xl font-bold text-center mb-1 text-gray-900 dark:text-white">
          ${stats.restDaysLast30Days} (${stats.restDaysPercentage.toFixed(1)}%)
        </div>
        <div class="text-center text-sm text-gray-600 dark:text-gray-400">
          Rest days (last 30 days)
        </div>
      </div>
    </div>
  `;

  container.appendChild(section);
}

/**
 * Render toggle section for switching between habits and fitness stats
 */
function renderStatsToggleSection(container) {
  const section = document.createElement('div');
  section.className = 'stats-toggle-section mb-6';

  section.innerHTML = `
    <div class="toggle-container bg-gray-100 dark:bg-gray-800 p-1 rounded-xl inline-flex w-full max-w-md mx-auto">
      <button 
        id="habits-toggle" 
        class="toggle-btn flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 ${currentStatsView === 'habits' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
        data-view="habits"
      >
        Habits
      </button>
      <button 
        id="fitness-toggle" 
        class="toggle-btn flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 ${currentStatsView === 'fitness' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
        data-view="fitness"
      >
        Fitness
      </button>
    </div>
  `;

  container.appendChild(section);

  // Bind toggle event listeners
  bindStatsToggleEvents();
}

/**
 * Render detailed stats section based on current view
 */
function renderDetailedStatsSection(container, habitStats, fitnessStats) {
  const section = document.createElement('div');
  section.className = 'detailed-stats-section';
  section.id = 'detailed-stats-container';
  section.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  section.style.opacity = '1';
  section.style.transform = 'translateY(0)';

  // Render appropriate stats based on current view
  if (currentStatsView === 'habits') {
    section.innerHTML = '';
    renderHabitStatsSection(section, habitStats);
  } else {
    section.innerHTML = '';
    renderFitnessStatsSection(section, fitnessStats);
  }

  container.appendChild(section);
}

/**
 * Bind event listeners for the stats toggle buttons
 */
function bindStatsToggleEvents() {
  const habitsToggle = document.getElementById('habits-toggle');
  const fitnessToggle = document.getElementById('fitness-toggle');

  if (!habitsToggle || !fitnessToggle) return;

  habitsToggle.addEventListener('click', () => switchStatsView('habits'));
  fitnessToggle.addEventListener('click', () => switchStatsView('fitness'));
}

/**
 * Switch between habits and fitness stats views with smooth transition
 */
function switchStatsView(view) {
  if (currentStatsView === view) return;

  currentStatsView = view;
  const detailedContainer = document.getElementById('detailed-stats-container');

  if (!detailedContainer) return;

  // Add fade out effect
  detailedContainer.style.opacity = '0';
  detailedContainer.style.transform = 'translateY(10px)';

  setTimeout(() => {
    // Cleanup any active carousel intervals before re-rendering
    if (activeCarouselInterval) {
      clearInterval(activeCarouselInterval);
      activeCarouselInterval = null;
    }

    // Re-render with new data
    const habitStats = calculateHabitStatistics();
    const fitnessStats = calculateFitnessStatistics();

    detailedContainer.innerHTML = '';

    if (currentStatsView === 'habits') {
      renderHabitStatsSection(detailedContainer, habitStats);
    } else {
      renderFitnessStatsSection(detailedContainer, fitnessStats);
    }

    // Update toggle button states
    updateToggleButtonStates();

    // Add fade in effect
    detailedContainer.style.opacity = '1';
    detailedContainer.style.transform = 'translateY(0)';
  }, 150);
}

/**
 * Update toggle button visual states
 */
function updateToggleButtonStates() {
  const habitsToggle = document.getElementById('habits-toggle');
  const fitnessToggle = document.getElementById('fitness-toggle');

  if (!habitsToggle || !fitnessToggle) return;

  // Reset both buttons
  habitsToggle.className =
    'toggle-btn flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300';
  fitnessToggle.className =
    'toggle-btn flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300';

  // Apply active state to current view
  if (currentStatsView === 'habits') {
    habitsToggle.className += ' bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm';
    fitnessToggle.className +=
      ' text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200';
  } else {
    fitnessToggle.className += ' bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm';
    habitsToggle.className +=
      ' text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200';
  }
}

/**
 * Render empty state when no data is available
 */
function renderEmptyState(container) {
  container.innerHTML = `
    <div class="empty-state flex flex-col items-center justify-center py-16 px-4 text-center">
      <div class="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">No Data Yet</h3>
      <p class="text-gray-600 dark:text-gray-400 max-w-sm mx-auto mb-6">
        Start tracking habits and fitness activities to see your personalized statistics here.
      </p>
      <button class="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors" onclick="document.querySelector('[data-view=&quot;home-view&quot;]').click()">
        Start Tracking
      </button>
    </div>
  `;
}

/**
 * Format large numbers with appropriate units
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Validate habit data to prevent calculation errors
 */
function validateHabitData(habit) {
  return (
    habit &&
    typeof habit.id === 'string' &&
    typeof habit.name === 'string' &&
    typeof habit.paused === 'boolean'
  );
}

/**
 * Enhanced error handling for calculations
 */
function safeCalculation(fn, fallback = 0) {
  try {
    const result = fn();
    return isNaN(result) ? fallback : result;
  } catch (error) {
    return fallback;
  }
}

// --- Carousel rendering and logic (copied from HabitsListModule.js, adapted for stats page) ---
function renderHabitCompletionCarousel(periods) {
  if (periods.length === 1) {
    const period = periods[0];
    return `
      <div class="text-lg font-bold text-center mb-1 text-gray-900 dark:text-white">
        ${period.rate.toFixed(1)}%
      </div>
      <div class="text-center text-xs text-gray-500 dark:text-gray-400">
        Completion Rate (${period.label})
      </div>
    `;
  }
  const slidesHTML = periods
    .map(
      (period, index) => `
    <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-slide="${index}">
      <div class="text-lg font-bold text-center mb-1 text-gray-900 dark:text-white">
        ${period.rate.toFixed(1)}%
      </div>
      <div class="text-center text-xs text-gray-500 dark:text-gray-400">
        Completion Rate (${period.label})
      </div>
    </div>
  `
    )
    .join('');
  const dotsHTML = periods
    .map(
      (_, index) => `
    <div class="carousel-dot ${index === 0 ? 'active' : ''}" data-slide="${index}"></div>
  `
    )
    .join('');
  return `
    <div class="completion-carousel" id="habit-completion-carousel">
      <div class="carousel-container">
        <div class="carousel-track" id="habit-carousel-track">
          ${slidesHTML}
        </div>
      </div>
      <div class="carousel-dots" id="habit-carousel-dots">
        ${dotsHTML}
      </div>
    </div>
  `;
}

function initializeHabitCompletionCarousel() {
  const carousel = document.getElementById('habit-completion-carousel');
  const track = document.getElementById('habit-carousel-track');
  const dots = document.getElementById('habit-carousel-dots');
  if (!carousel || !track || !dots) return;
  const slides = track.querySelectorAll('.carousel-slide');
  const dotElements = dots.querySelectorAll('.carousel-dot');
  if (slides.length <= 1) return;
  let currentSlide = 0;
  let touchStartX = 0;
  let touchEndX = 0;
  let autoScrollInterval = null;
  function updateActiveSlide(index) {
    if (index < 0 || index >= slides.length) return;
    currentSlide = index;
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === currentSlide);
    });
    dotElements.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentSlide);
    });
  }
  function nextSlide() {
    const next = (currentSlide + 1) % slides.length;
    updateActiveSlide(next);
  }
  function prevSlide() {
    const prev = (currentSlide - 1 + slides.length) % slides.length;
    updateActiveSlide(prev);
  }
  dotElements.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      updateActiveSlide(index);
    });
  });
  carousel.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  });
  carousel.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].clientX;
    handleSwipe();
  });
  let isDragging = false;
  let startX = 0;
  carousel.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    carousel.style.cursor = 'grabbing';
  });
  carousel.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
  });
  carousel.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    carousel.style.cursor = 'grab';
    const endX = e.clientX;
    const diffX = startX - endX;
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  });
  carousel.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      carousel.style.cursor = 'grab';
    }
  });
  function handleSwipe() {
    const swipeThreshold = 50;
    const diffX = touchStartX - touchEndX;
    if (Math.abs(diffX) > swipeThreshold) {
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  }
  carousel.style.cursor = 'grab';
  // --- Autoscroll ---
  if (autoScrollInterval) clearInterval(autoScrollInterval);
  autoScrollInterval = setInterval(() => {
    nextSlide();
  }, 30000);
  carousel.addEventListener('mouseenter', () => {
    if (autoScrollInterval) clearInterval(autoScrollInterval);
  });
  carousel.addEventListener('mouseleave', () => {
    autoScrollInterval = setInterval(() => {
      nextSlide();
    }, 30000);
  });
}
