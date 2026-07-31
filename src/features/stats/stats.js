/**
 * Stats view controller — the whole-account picture.
 *
 * Laid out so the top of the page answers "how am I doing" in one glance and
 * everything below it explains that answer: a headline strip, then the
 * habits/fitness switch, then sections that each make one point. Calculation
 * lives in `habitPageStats.js` and `fitnessStats.js`; this module decides what
 * is worth showing and paints it.
 */

import { getState, subscribe } from '../../core/state.js';
import { formatDuration, formatLastPerformed } from '../../shared/datetime.js';
import { shallowArrayEqual } from '../../shared/equality.js';
import { calculateHabitStatistics } from './habitPageStats.js';
import { calculateFitnessStatistics } from './fitnessStats.js';
import { mountPeriodCarousel, renderPeriodCarousel } from './completionCarousel.js';
import {
  barChart,
  comparisonRow,
  heatmap,
  statCard,
  statGrid,
  statSection,
  statsEmptyState,
} from './statsUi.js';

// Current stats view state - 'habits' or 'fitness'
let currentStatsView = 'habits';
let unsubscribeState = null;
let midnightTimer = null;
let initialized = false;
let statsViewModelCache = null;
let renderedViewModel = null;
let releaseCarousel = null;

function selectStatsState(state) {
  return [
    state.habits,
    state.categories,
    state.holidayDates,
    state.manualHolidayDates,
    state.holidayPeriods,
    state.activities,
    state.activityCategories,
    state.recordedActivities,
    state.restDays,
  ];
}

function localDayCacheKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}@${date.getTimezoneOffset()}`;
}

function scheduleMidnightRefresh() {
  if (midnightTimer) clearTimeout(midnightTimer);
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 25);
  midnightTimer = setTimeout(() => {
    statsViewModelCache = null;
    renderedViewModel = null;
    renderStatsContent();
    scheduleMidnightRefresh();
  }, Math.max(25, nextMidnight.getTime() - now.getTime()));
}

function getStatsViewModel(now = new Date()) {
  const selected = selectStatsState(getState());
  const dayKey = localDayCacheKey(now);
  if (
    statsViewModelCache &&
    statsViewModelCache.dayKey === dayKey &&
    shallowArrayEqual(statsViewModelCache.selected, selected)
  ) {
    return statsViewModelCache.value;
  }

  const value = {
    habitStats: calculateHabitStatistics(now),
    fitnessStats: calculateFitnessStatistics(now),
  };
  statsViewModelCache = { selected, dayKey, value };
  return value;
}

/**
 * Initializes the stats view with all its components
 * @returns {void}
 */
export function initializeStats() {
  if (initialized) return;
  buildHeader();
  buildStatsContainer();
  renderStatsContent();
  initialized = true;
}

/**
 * Starts listening for the state the page reflects.
 * @returns {void}
 */
export function activate() {
  if (!initialized || unsubscribeState) return;
  unsubscribeState = subscribe(selectStatsState, renderStatsContent, {
    equalityFn: shallowArrayEqual,
  });
  scheduleMidnightRefresh();
  renderStatsContent();
}

/**
 * Stops listening and releases every timer the page owns.
 * @returns {void}
 */
export function deactivate() {
  unsubscribeState?.();
  unsubscribeState = null;
  if (midnightTimer) {
    clearTimeout(midnightTimer);
    midnightTimer = null;
  }
  releaseCarousel?.();
  releaseCarousel = null;
}

function buildHeader() {
  const statsView = document.getElementById('stats-view');
  if (!statsView) return;
  statsView.innerHTML = '';

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

function buildStatsContainer() {
  const statsView = document.getElementById('stats-view');
  if (!statsView) return;

  const container = document.createElement('div');
  container.className =
    'stats-container flex-1 overflow-y-auto overscroll-behavior-contain px-4 py-4 pb-8 space-y-6';
  container.id = 'stats-container';
  statsView.appendChild(container);
}

/**
 * Renders the statistics content
 * @returns {void}
 */
function renderStatsContent() {
  const container = document.getElementById('stats-container');
  if (!container) return;

  try {
    const viewModel = getStatsViewModel();
    if (renderedViewModel === viewModel && container.childElementCount > 0) return;
    const { habitStats, fitnessStats } = viewModel;

    releaseCarousel?.();
    releaseCarousel = null;

    // Whether there is anything to show is decided before anything is drawn.
    // The empty state used to be appended after the sections and then wipe
    // them, which meant a fitness-only user who had archived their activities
    // saw "no data" over months of real sessions.
    const hasAnything =
      habitStats.historicalHabits > 0 ||
      fitnessStats.totalActivities > 0 ||
      fitnessStats.totalSessions > 0;

    if (!hasAnything) {
      container.innerHTML = renderEmptyState();
      renderedViewModel = viewModel;
      return;
    }

    container.innerHTML = `
      ${renderOverviewSection(habitStats, fitnessStats)}
      ${renderToggle()}
      <div id="detailed-stats-container" class="detailed-stats-section space-y-6">
        ${currentStatsView === 'habits' ? renderHabitSections(habitStats) : renderFitnessSections(fitnessStats)}
      </div>
    `;

    bindStatsToggleEvents();
    releaseCarousel = mountPeriodCarousel(container);
    renderedViewModel = viewModel;
  } catch (error) {
    renderedViewModel = null;
    // eslint-disable-next-line no-console
    console.error('Statistics could not be rendered:', error);
    container.innerHTML = `
      <div class="error-state p-8 text-center">
        <span class="material-icons text-4xl text-red-500" aria-hidden="true">error_outline</span>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mt-3 mb-1">Statistics unavailable</h3>
        <p class="text-gray-600 dark:text-gray-400 text-sm">Something went wrong working these out. Reopening the tab usually clears it.</p>
      </div>
    `;
  }
}

/* -------------------------------------------------------------------------- */
/*  Overview                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The headline strip: the four figures that answer "how am I doing" on their own.
 * @param {object} habitStats Habit statistics.
 * @param {object} fitnessStats Fitness statistics.
 * @returns {string} Section markup.
 */
function renderOverviewSection(habitStats, fitnessStats) {
  const todayLabel =
    habitStats.dueToday > 0
      ? `of ${habitStats.dueToday} due today`
      : 'nothing scheduled today';
  const onTrack =
    habitStats.onTrackThisPeriod > 0
      ? `${habitStats.onTrackThisPeriod} more on track this period`
      : '';
  const activeDays = combinedActiveDays(habitStats, fitnessStats);

  return statSection({
    title: 'Overview',
    body: `
      <div class="grid grid-cols-2 gap-2.5">
        ${statCard({
          value: habitStats.completedToday,
          label: 'Completed today',
          sub: onTrack || todayLabel,
          tone: 'feature',
        })}
        ${statCard({
          value: `${Math.round(habitStats.averageCompletionRate)}%`,
          label: 'Habit completion',
          sub: 'Last 30 days',
        })}
        ${statCard({
          value: habitStats.currentStreak,
          label: 'Perfect-day streak',
          sub: habitStats.longestStreak > 0 ? `Best: ${habitStats.longestStreak}` : '',
          tone: habitStats.currentStreak > 0 ? 'positive' : 'plain',
        })}
        ${statCard({
          value: fitnessStats.recentSessions,
          label: 'Training sessions',
          sub: 'Last 30 days',
        })}
      </div>
      ${
        activeDays.total > 0
          ? `<div class="mt-2.5">${statCard({
              value: `${activeDays.last30} of 30`,
              label: 'Days you did something',
              sub: `${activeDays.total} active days all time`,
              wide: true,
            })}</div>`
          : ''
      }
    `,
  });
}

/**
 * Days on which the user did anything at all — a habit or a session.
 *
 * Every other figure on this page belongs to one half of the app. This is the
 * one that spans both, and it is the honest answer to "am I actually showing
 * up", which neither half can give on its own.
 * @param {object} habitStats Habit statistics.
 * @param {object} fitnessStats Fitness statistics.
 * @returns {{total: number, last30: number}} Active-day counts.
 */
function combinedActiveDays(habitStats, fitnessStats) {
  const days = new Set(fitnessStats.activeDayKeys || []);
  for (const day of habitStats.dailySeries || []) {
    if (day.completed > 0) days.add(day.dateKey);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 29);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  let last30 = 0;
  for (const day of days) {
    if (day >= cutoffKey) last30 += 1;
  }

  return { total: days.size, last30 };
}

function renderToggle() {
  const button = (view, label) => `
    <button
      id="${view}-toggle"
      class="toggle-btn flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
        currentStatsView === view
          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
          : 'text-gray-600 dark:text-gray-400'
      }"
      data-view="${view}"
      role="tab"
      aria-selected="${currentStatsView === view}"
    >${label}</button>
  `;

  return `
    <div class="toggle-container bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex w-full" role="tablist" aria-label="Statistics section">
      ${button('habits', 'Habits')}
      ${button('fitness', 'Fitness')}
    </div>
  `;
}

/* -------------------------------------------------------------------------- */
/*  Habits                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The habits half of the page.
 * @param {object} stats Habit statistics.
 * @returns {string} Sections markup.
 */
function renderHabitSections(stats) {
  if (stats.historicalHabits === 0) {
    return statsEmptyState({
      title: 'No habits yet',
      message: 'Add a habit and this page starts keeping its record.',
      icon: 'checklist',
    });
  }

  const sections = [];

  sections.push(
    statSection({
      title: 'Reliability',
      note: 'Across every daily habit. Skipped days are set aside, not counted against you.',
      body: `
        ${renderPeriodCarousel(stats.dailyCompletionPeriods)}
        <div class="mt-2.5">
          ${statGrid([
            statCard({ value: stats.longestStreak, label: 'Longest perfect streak' }),
            statCard({ value: stats.perfectDaysThisMonth, label: 'Perfect days this month' }),
            stats.weeklyHabits.length > 0
              ? statCard({
                  value: `${Math.round(stats.weeklyCompletionRate)}%`,
                  label: 'Weekly habits',
                  sub: 'Last 4 weeks',
                })
              : '',
            stats.monthlyHabits.length > 0
              ? statCard({
                  value: `${Math.round(stats.monthlyCompletionRate)}%`,
                  label: 'Monthly habits',
                  sub: 'Last 3 months',
                })
              : '',
          ])}
        </div>
      `,
    })
  );

  if (stats.dailySeries && stats.dailySeries.length > 6) {
    sections.push(
      statSection({
        title: 'History',
        note: 'Each day shaded by how much of it you completed',
        body: heatmap({ days: stats.dailySeries, color: '#22C55E' }),
      })
    );
  }

  // The habits carrying the average, and the ones dragging it. Both were
  // already calculated and never shown. With only a handful of habits the two
  // lists would overlap and print the same habit twice, so a habit is only ever
  // in one of them, and with too few to divide the list is simply shown whole.
  if (stats.completionRates.length > 0) {
    const ranked = stats.completionRates;
    const spread = ranked[0].rate - ranked[ranked.length - 1].rate;
    // Splitting the list into "holding up" and "needs attention" is only honest
    // when the two ends are actually different. Four habits all within a few
    // points of each other are all doing the same thing, and labelling the last
    // of them a problem invents one.
    const worthSplitting = ranked.length >= 4 && spread >= 15;
    const listSize = Math.min(3, Math.floor(ranked.length / 2));

    sections.push(
      statSection({
        title: 'Habit by habit',
        note: 'Each habit measured over its own recent periods',
        body: worthSplitting
          ? `
              <div class="space-y-3">
                <div>
                  <p class="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">Holding up</p>
                  ${ranked
                    .slice(0, listSize)
                    .map((entry) => habitRow(entry, '#22C55E'))
                    .join('')}
                </div>
                <div>
                  <p class="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Needs attention</p>
                  ${ranked
                    .slice(-listSize)
                    .reverse()
                    .map((entry) => habitRow(entry, '#F59E0B'))
                    .join('')}
                </div>
              </div>
            `
          : ranked
              .slice(0, 6)
              .map((entry) => habitRow(entry, entry.rate >= 70 ? '#22C55E' : '#F59E0B'))
              .join(''),
      })
    );
  }

  const categoryRows = stats.categoryBreakdown
    .filter((category) => category.completionRate !== null)
    .map((category) =>
      comparisonRow({
        label: category.name,
        value: `${Math.round(category.completionRate)}%`,
        sub: `${category.count} ${category.count === 1 ? 'habit' : 'habits'}`,
        fraction: category.completionRate / 100,
        color: category.color,
      })
    )
    .join('');
  if (categoryRows) {
    sections.push(statSection({ title: 'By category', body: categoryRows }));
  }

  sections.push(
    statSection({
      title: 'Context',
      body: statGrid([
        statCard({
          value: stats.totalSkipsThisMonth,
          label: 'Skips this month',
          sub: stats.mostSkipped ? `Most often: ${stats.mostSkipped.name}` : '',
          tone: stats.totalSkipsThisMonth > 0 ? 'caution' : 'plain',
        }),
        statCard({ value: stats.holidayDaysThisYear, label: 'Holiday days this year' }),
        stats.pausedHabits > 0 ? statCard({ value: stats.pausedHabits, label: 'Paused habits' }) : '',
        stats.archivedHabits > 0
          ? statCard({ value: stats.archivedHabits, label: 'Archived habits' })
          : '',
      ]),
    })
  );

  return sections.filter(Boolean).join('');
}

/**
 * One habit's line in the habit-by-habit comparison.
 * @param {object} entry A per-habit rate entry.
 * @param {string} color Bar colour.
 * @returns {string} Row markup.
 */
function habitRow(entry, color) {
  const unit = entry.streakUnit || 'day';
  const count = entry.currentStreak;
  const streak = count > 0 ? `${count} ${unit}${count === 1 ? '' : 's'} in a row` : '';
  return comparisonRow({
    label: `${entry.icon ? `${entry.icon} ` : ''}${entry.habitName}`,
    value: `${Math.round(entry.rate)}%`,
    sub: streak,
    fraction: entry.rate / 100,
    color,
  });
}

/* -------------------------------------------------------------------------- */
/*  Fitness                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The fitness half of the page.
 * @param {object} stats Fitness statistics.
 * @returns {string} Sections markup.
 */
function renderFitnessSections(stats) {
  if (stats.totalSessions === 0) {
    return statsEmptyState({
      title: 'No sessions recorded',
      message: 'Log a workout and your training record builds up here.',
      icon: 'fitness_center',
    });
  }

  const sections = [];

  sections.push(
    statSection({
      title: 'Training',
      body: statGrid([
        statCard({
          value: stats.totalSessions,
          label: 'Total sessions',
          sub: `${stats.activeDays} active ${stats.activeDays === 1 ? 'day' : 'days'}`,
          tone: 'feature',
        }),
        statCard({ value: stats.recentSessions, label: 'Last 30 days' }),
        statCard({
          value: stats.currentTrainingStreak,
          label: 'Week streak',
          sub: stats.longestTrainingStreak > 0 ? `Best: ${stats.longestTrainingStreak}` : '',
          tone: stats.currentTrainingStreak > 0 ? 'positive' : 'plain',
        }),
        statCard({
          value: stats.lastSession ? formatLastPerformed(stats.lastSession) : 'Never',
          label: 'Last session',
        }),
      ]),
    })
  );

  sections.push(
    statSection({
      title: 'Workload',
      note: stats.unloggedSessions > 0 ? `${stats.unloggedSessions} sessions logged without details` : '',
      body: statGrid([
        statCard({ value: formatDuration(stats.totalDuration), label: 'Total time' }),
        statCard({
          value: formatDuration(stats.averageSessionDuration),
          label: 'Average session',
          sub: stats.timedSessions > 0 ? `Over ${stats.timedSessions} timed sessions` : '',
        }),
        stats.totalSets > 0 ? statCard({ value: stats.totalSets, label: 'Total sets' }) : '',
        stats.totalReps > 0 ? statCard({ value: stats.totalReps, label: 'Total reps' }) : '',
        stats.totalVolume > 0
          ? statCard({
              value: Math.round(stats.totalVolume).toLocaleString(),
              label: 'Total volume lifted',
              wide: true,
            })
          : '',
      ]),
    })
  );

  if (stats.programs.length > 0) {
    sections.push(
      statSection({
        title: 'Programme adherence',
        note: 'Sessions recorded against sessions planned',
        body: stats.programs
          .map((program) =>
            comparisonRow({
              label: program.name,
              value: `${Math.round(program.percent)}%`,
              sub:
                program.phase === 'before'
                  ? 'Not started yet'
                  : `${program.completed} of ${program.planned} · week ${program.week} of ${program.totalWeeks}`,
              fraction: program.percent / 100,
              color: program.active ? '#22C55E' : '#94A3B8',
            })
          )
          .join(''),
      })
    );
  }

  if (stats.weeklySessions.some((count) => count > 0)) {
    sections.push(
      statSection({
        title: 'Consistency',
        note: 'Sessions per week, last 12 weeks',
        body: barChart({
          bars: stats.weeklySessions.map((value) => ({ value, label: '' })),
          axis: ['12 weeks ago', '6 weeks', 'This week'],
          color: '#6366F1',
        }),
      })
    );
  }

  if (stats.weeklyVolume.some((volume) => volume > 0)) {
    sections.push(
      statSection({
        title: 'Training load',
        note: 'Volume lifted per week, last 12 weeks',
        body: barChart({
          bars: stats.weeklyVolume.map((value) => ({ value, label: '' })),
          axis: ['12 weeks ago', '6 weeks', 'This week'],
          color: '#8B5CF6',
          format: (value) => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value))),
        }),
      })
    );
  }

  if (stats.byCategory.length > 0) {
    sections.push(
      statSection({
        title: 'By category',
        body: stats.byCategory
          .map((category) =>
            comparisonRow({
              label: category.name,
              value: `${category.sessions}`,
              // The bar shows the share, so the share is what the caption
              // explains; a duration is extra detail where one exists, not a
              // different caption for rows that happen to have one.
              sub: `${Math.round(category.share * 100)}% of sessions${
                category.minutes > 0 ? ` · ${formatDuration(category.minutes)}` : ''
              }`,
              fraction: category.share,
              color: category.color,
            })
          )
          .join(''),
      })
    );
  }

  if (stats.byMuscleGroup.length > 0) {
    const maxSets = Math.max(...stats.byMuscleGroup.map((group) => group.sets));
    sections.push(
      statSection({
        title: 'By muscle group',
        note: 'Sets recorded, all time',
        body: stats.byMuscleGroup
          .map((group) =>
            comparisonRow({
              label: group.name,
              value: `${group.sets} sets`,
              sub: group.volume > 0 ? `${Math.round(group.volume).toLocaleString()} volume` : '',
              fraction: maxSets > 0 ? group.sets / maxSets : 0,
              color: '#8B5CF6',
            })
          )
          .join(''),
      })
    );
  }

  sections.push(
    statSection({
      title: 'Recovery',
      body: statGrid([
        statCard({
          value: stats.restDaysLast30Days,
          label: 'Rest days',
          sub: `${Math.round(stats.restDaysPercentage)}% of the last 30 days`,
        }),
        statCard({ value: stats.totalActivities, label: 'Activities in library' }),
      ]),
    })
  );

  return sections.filter(Boolean).join('');
}

/* -------------------------------------------------------------------------- */
/*  Toggle and empty state                                                     */
/* -------------------------------------------------------------------------- */

function bindStatsToggleEvents() {
  document.getElementById('habits-toggle')?.addEventListener('click', () => switchStatsView('habits'));
  document
    .getElementById('fitness-toggle')
    ?.addEventListener('click', () => switchStatsView('fitness'));
}

/**
 * Switches between the habits and fitness halves.
 * @param {'habits'|'fitness'} view Which half to show.
 * @returns {void}
 */
function switchStatsView(view) {
  if (currentStatsView === view) return;
  currentStatsView = view;

  const container = document.getElementById('detailed-stats-container');
  if (!container) return;

  releaseCarousel?.();
  releaseCarousel = null;

  const { habitStats, fitnessStats } = getStatsViewModel();
  container.innerHTML =
    view === 'habits' ? renderHabitSections(habitStats) : renderFitnessSections(fitnessStats);

  for (const name of ['habits', 'fitness']) {
    const button = document.getElementById(`${name}-toggle`);
    if (!button) continue;
    const active = name === view;
    button.setAttribute('aria-selected', String(active));
    button.className = `toggle-btn flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
      active
        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
        : 'text-gray-600 dark:text-gray-400'
    }`;
  }

  releaseCarousel = mountPeriodCarousel(document.getElementById('stats-container'));
}

/**
 * The page before there is anything to report.
 * @returns {string} Empty-state markup.
 */
function renderEmptyState() {
  return `
    <div class="empty-state flex flex-col items-center justify-center py-16 px-4 text-center">
      <div class="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-5">
        <span class="material-icons text-4xl text-gray-400" aria-hidden="true">insights</span>
      </div>
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Nothing to show yet</h3>
      <p class="text-gray-600 dark:text-gray-400 max-w-sm mx-auto mb-6 text-sm">
        Track a habit or record a workout, and this page starts building your record.
      </p>
      <button id="stats-start-tracking" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors">
        Start tracking
      </button>
    </div>
  `;
}

// The empty state's button lives and dies with each render, so it is bound by
// delegation rather than re-wired every time.
if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('#stats-start-tracking')) return;
    document.querySelector('[data-view="home-view"]')?.click();
  });
}
