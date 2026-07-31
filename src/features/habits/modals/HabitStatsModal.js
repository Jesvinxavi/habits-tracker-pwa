/**
 * Habit Statistics Modal
 *
 * The per-habit view: how reliably it has been kept, how it is trending, and
 * where it falls down. It shares the app's modal stack and the statistics card
 * system rather than hand-rolling either, so it locks scrolling, traps focus and
 * closes on Escape like every other dialog.
 */

import { getState } from '../../../core/state.js';
import { calculateHabitStatistics } from '../helpers/habitStats.js';
import { formatLastPerformed } from '../../../shared/datetime.js';
import { closeModal, openModal, topModalId } from '../../../components/Modal.js';
import { escapeHtml, normalizeHexColor } from '../../../shared/sanitize.js';
import { mountPeriodCarousel, renderPeriodCarousel } from '../../stats/completionCarousel.js';
import {
  barChart,
  heatmap,
  statCard,
  statGrid,
  statSection,
  statsEmptyState,
} from '../../stats/statsUi.js';

const MODAL_ID = 'habit-stats-modal';
let releaseCarousel = null;
let escapeBound = false;

/**
 * Handle habit stats click - calculate and show modal
 * @param {string} habitId - The ID of the habit
 * @returns {void}
 */
export function handleHabitStatsClick(habitId) {
  const habit = getState().habits.find((candidate) => candidate.id === habitId);
  if (!habit) return;
  openHabitStatsModal(habit, calculateHabitStatistics(habitId));
}

/**
 * Opens the habit statistics modal with calculated data
 * @param {Object} habit - The habit object
 * @param {Object} stats - The calculated statistics
 * @returns {void}
 */
export function openHabitStatsModal(habit, stats) {
  const category = getState().categories.find((entry) => entry.id === habit.categoryId);
  const color = normalizeHexColor(category?.color, '#3B82F6');

  document.getElementById(MODAL_ID)?.remove();
  document.body.insertAdjacentHTML(
    'beforeend',
    `
      <div id="${MODAL_ID}" class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 hidden">
        <div class="modal-content bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
          <div class="flex-shrink-0 flex items-center justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-800">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0" style="background-color:${color}20;">
                ${escapeHtml(habit.icon || '📋')}
              </div>
              <div class="min-w-0">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(habit.name)}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${escapeHtml(category?.name || 'Uncategorised')}</p>
              </div>
            </div>
            <button id="close-habit-stats-modal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 flex-shrink-0" aria-label="Close statistics">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            ${buildHabitStatsContent(habit, stats, category)}
          </div>
        </div>
      </div>
    `
  );

  bindHandlers();
  openModal(MODAL_ID);
  releaseCarousel = mountPeriodCarousel(document.getElementById(MODAL_ID));
}

/**
 * Closes the modal and takes it back out of the DOM.
 * @returns {void}
 */
export function closeHabitStatsModal() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  releaseCarousel?.();
  releaseCarousel = null;
  closeModal(MODAL_ID);
  modal.remove();
}

/**
 * Binds the modal's own close affordances.
 * @returns {void}
 */
function bindHandlers() {
  const modal = document.getElementById(MODAL_ID);
  document
    .getElementById('close-habit-stats-modal')
    ?.addEventListener('click', () => closeHabitStatsModal());
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeHabitStatsModal();
  });

  if (escapeBound) return;
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || topModalId() !== MODAL_ID) return;
    event.preventDefault();
    closeHabitStatsModal();
  });
  escapeBound = true;
}

/**
 * Builds the habit statistics content HTML
 * @param {Object} habit - The habit object
 * @param {Object} stats - The calculated statistics
 * @param {Object} category - The habit category
 * @returns {string} HTML string for the statistics content
 */
export function buildHabitStatsContent(habit, stats, category) {
  if (!stats || !stats.hasData) {
    return statsEmptyState({
      title: 'Nothing to measure yet',
      message: 'Once this habit has had a day to succeed or miss, its record appears here.',
    });
  }

  const color = normalizeHexColor(category?.color, '#3B82F6');
  const sections = [];

  if (stats.frozenOn) {
    sections.push(`
      <div class="rounded-xl bg-gray-100 dark:bg-gray-800 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
        ${escapeHtml(stats.isArchived ? 'Archived' : 'Paused')} — this record stops at
        ${escapeHtml(formatLastPerformed(stats.frozenOn).toLowerCase())} and resumes when the habit does.
      </div>
    `);
  }

  sections.push(
    statSection({
      title: 'Reliability',
      body: `
        ${renderPeriodCarousel([
          { label: stats.periodLabels[0], rate: stats.completionRateShort },
          { label: stats.periodLabels[1], rate: stats.completionRateLong },
          { label: stats.periodLabels[2], rate: stats.completionRateTotal },
        ])}
        <div class="mt-2.5">
          ${statGrid([
            statCard({ value: stats.totalCompletions, label: 'Total completions' }),
            statCard({ value: stats.daysTracked, label: stats.trackedUnitLabel }),
          ])}
        </div>
      `,
    })
  );

  sections.push(
    statSection({
      title: 'Streaks',
      note: 'Skipped days are stepped over rather than counted against you.',
      body: statGrid([
        statCard({
          value: stats.currentStreak,
          label: 'Current streak',
          tone: stats.currentStreak > 0 ? 'positive' : 'plain',
        }),
        statCard({ value: stats.longestStreak, label: 'Longest streak' }),
      ]),
    })
  );

  if (stats.targetProgress) {
    const target = stats.targetProgress;
    sections.push(
      statSection({
        title: 'Target',
        note: `Aiming for ${target.target}${target.unit ? ` ${target.unit}` : ''} each ${
          stats.group === 'daily' ? 'day' : stats.group.replace('ly', '')
        }`,
        body: statGrid([
          statCard({
            value: `${Math.round(target.hitRate || 0)}%`,
            label: 'Target reached',
            tone: 'feature',
          }),
          statCard({
            value: formatAmount(target.average),
            label: 'Average per period',
            sub: target.unit,
          }),
          statCard({ value: formatAmount(target.best), label: 'Best period', sub: target.unit }),
          statCard({
            value: formatAmount(target.total),
            label: 'Total recorded',
            sub: target.unit,
          }),
        ]),
      })
    );
  }

  sections.push(
    statSection({
      title: 'Recent',
      body: statGrid([
        statCard({ value: stats.recentActivity, label: stats.recentLabel }),
        statCard({
          value: stats.lastCompleted ? formatLastPerformed(stats.lastCompleted) : 'Never',
          label: 'Last completed',
        }),
        statCard({ value: formatAmount(stats.periodAverage), label: stats.periodAverageLabel }),
        statCard({
          value: stats.totalSkipped,
          label: 'Times skipped',
          sub: stats.totalSkipped > 0 ? `${Math.round(stats.skippedPercentage)}% of days` : '',
          tone: stats.totalSkipped > 0 ? 'caution' : 'plain',
        }),
      ]),
    })
  );

  if (stats.daySeries && stats.daySeries.length > 6) {
    sections.push(
      statSection({
        title: 'History',
        note: 'Every day since this habit started, most recent on the right',
        body: heatmap({ days: stats.daySeries, color }),
      })
    );
  }

  if (stats.weekdayBreakdown && stats.weekdayBreakdown.some((day) => day.decided > 0)) {
    sections.push(
      statSection({
        title: 'By day of week',
        note: 'Where this habit holds up, and where it slips',
        body: barChart({
          bars: stats.weekdayBreakdown.map((day) => ({ label: day.label, value: day.rate })),
          color,
          scaleTo: 100,
          format: (value) => `${Math.round(value)}%`,
        }),
      })
    );
  }

  return `<div class="stats-grid space-y-5">${sections.filter(Boolean).join('')}</div>`;
}

/**
 * Formats a figure without a pointless trailing zero.
 * @param {number} value Any measurement.
 * @returns {string} Display string.
 */
function formatAmount(value) {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
