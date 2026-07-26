// ProgramTile.js - At-a-glance progress for the active program
import { getState } from '../../core/state.js';
import { getLocalISODate } from '../../shared/datetime.js';
import { hexToRgba } from '../../shared/color.js';
import { getActiveProgram } from './programs.js';
import { computeProgramProgress } from './helpers/programProgress.js';
import { ProgramBuilderModal } from './Modals/ProgramBuilderModal.js';

const PROGRAM_COLOR = '#007AFF'; // ios-blue

// The card fills left-to-right like a home target-habit tile. Home paints the
// filled portion in the solid category colour, which leaves its text at ~4.4:1
// against gray-900 — under AA. A translucent fill keeps the same metaphor while
// holding every label above 4.5:1 in both themes.
const FILL_ALPHA = 0.45;
const BASE_ALPHA = 0.07;

/**
 * Builds the left-to-right fill for a given completion fraction.
 * @param {number} percent Completion, 0-100.
 * @returns {string} CSS gradient.
 */
function fillGradient(percent) {
  const clamped = Math.max(0, Math.min(percent, 100));
  const fill = hexToRgba(PROGRAM_COLOR, FILL_ALPHA);
  const base = hexToRgba(PROGRAM_COLOR, BASE_ALPHA);
  return `linear-gradient(to right, ${fill} ${clamped}%, ${base} ${clamped}%)`;
}

/**
 * Formats a single date as "20 Oct", with the year appended when asked.
 *
 * The day is placed before the month explicitly rather than leaving the order to
 * toLocaleDateString, which follows the ambient locale and renders "Oct 20" under
 * en-US. Only the month name is localised.
 * @param {Date} date UTC-anchored date.
 * @param {boolean} withYear Whether to append the year.
 * @returns {string} Formatted date.
 */
function formatDay(date, withYear) {
  const month = date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
  const day = date.getUTCDate();
  return withYear ? `${day} ${month} ${date.getUTCFullYear()}` : `${day} ${month}`;
}

/**
 * Formats a program's date range, e.g. "20 Oct – 13 Dec". The year is appended
 * when the block spans a year boundary.
 * @param {string} startISO Start date key.
 * @param {string} endISO End date key.
 * @returns {string} Human-readable range.
 */
function dateRangeLabel(startISO, endISO) {
  const start = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return '';

  const spansYears = start.getUTCFullYear() !== end.getUTCFullYear();
  return `${formatDay(start, spansYears)} – ${formatDay(end, spansYears)}`;
}

/**
 * Builds the pill text describing where the user is in the program.
 * @param {{phase: string, week: number, totalWeeks: number, daysUntilStart: number}} progress
 *   Computed progress figures.
 * @returns {string} Pill label.
 */
function weekLabel({ phase, week, totalWeeks, daysUntilStart }) {
  if (phase === 'before') {
    return daysUntilStart === 1 ? 'Starts in 1 day' : `Starts in ${daysUntilStart} days`;
  }
  if (phase === 'after') return 'Completed';
  return `Week ${week} of ${totalWeeks}`;
}

/**
 * Renders the active program's tile into #fitness-program-host, or clears the
 * host when no program is active.
 * @returns {void}
 */
export function renderProgramTile() {
  const host = document.getElementById('fitness-program-host');
  if (!host) return;

  const program = getActiveProgram();
  if (!program) {
    host.innerHTML = '';
    return;
  }

  const state = getState();
  const progress = computeProgramProgress({
    program,
    todayISO: getLocalISODate(new Date()),
    recordedActivities: state.recordedActivities,
    restDays: state.restDays,
  });

  const label = weekLabel(progress);
  const range = dateRangeLabel(program.startDate, program.endDate);

  // The tile is the progress indicator, so it carries the progressbar role and a
  // textual value — the fill alone must never be the only cue.
  host.innerHTML = `
    <div id="program-tile" class="program-tile relative overflow-hidden mb-2 mt-2 p-4 rounded-2xl bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer transition-shadow hover:shadow-md" data-program-id="${program.id}" role="progressbar" aria-valuenow="${progress.percent}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${progress.completedWorkouts} of ${progress.plannedWorkouts} workouts completed, ${progress.percent} percent" tabindex="0" aria-label="Program ${program.name}. Activate to edit.">
      <div class="program-tile-fill absolute inset-0 pointer-events-none transition-[background] duration-300" style="background:${fillGradient(progress.percent)}" aria-hidden="true"></div>
      <div class="relative z-10">
        <div class="flex items-start justify-between gap-3 mb-2">
          <div class="min-w-0">
            <h3 class="font-bold text-base text-gray-900 dark:text-white truncate">${program.name}</h3>
            <p class="text-xs text-gray-700 dark:text-gray-300">${range}</p>
          </div>
          <span class="text-xs font-semibold px-2 py-1 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-ios-blue whitespace-nowrap">${label}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-700 dark:text-gray-300">${progress.completedWorkouts} of ${progress.plannedWorkouts} workouts</span>
          <span class="text-xs font-bold text-gray-900 dark:text-white">${progress.percent}%</span>
        </div>
      </div>
    </div>
  `;

  const tile = host.querySelector('#program-tile');
  const openEditor = () => ProgramBuilderModal.openEditMode(program.id);
  tile?.addEventListener('click', openEditor);
  tile?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openEditor();
  });
}
