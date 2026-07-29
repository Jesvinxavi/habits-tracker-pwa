// ProgramTile.js - At-a-glance progress for the active program
import { hexToRgba } from '../../shared/color.js';
import { getActiveProgram, getProgramProgress } from './programs.js';
import { dateRangeLabel, weekLabel } from './helpers/programLabels.js';
import { escapeAttribute, escapeHtml } from '../../shared/sanitize.js';

const PROGRAM_COLOR = '#007AFF'; // ios-blue

// Solid pills carry white text, and white on ios-blue is only 4.02:1. This
// deeper shade of the same hue reaches 6.0:1.
const PILL_COLOR = '#0060C7';

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

  const progress = getProgramProgress(program);
  const label = escapeHtml(weekLabel(progress));
  const range = escapeHtml(dateRangeLabel(program.startDate, program.endDate));
  const programName = escapeHtml(program.name || '');
  const programNameAttribute = escapeAttribute(program.name || '');
  const programId = escapeAttribute(program.id);

  // Laid out like a home target-habit card: icon, then name with a pill beneath
  // it, then a right-hand column holding the counter box and a unit pill, all
  // vertically centred. A native button owns activation while its screen-reader
  // progress node carries the numeric state — the fill is never the only cue.
  host.innerHTML = `
    <button type="button" id="program-tile" class="program-tile relative overflow-hidden mb-2 mt-2 flex items-center px-4 py-3 rounded-2xl bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer transition-shadow hover:shadow-md w-full text-left" data-program-id="${programId}" aria-label="Program ${programNameAttribute}. ${progress.completedWorkouts} of ${progress.plannedWorkouts} workouts completed, ${progress.percent} percent. Open details.">
      <span class="sr-only" role="progressbar" aria-valuenow="${progress.percent}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${progress.completedWorkouts} of ${progress.plannedWorkouts} workouts completed, ${progress.percent} percent"></span>
      <div class="program-tile-fill absolute inset-0 pointer-events-none transition-[background] duration-300" style="background:${fillGradient(progress.percent)}" aria-hidden="true"></div>

      <div class="program-icon relative z-10 w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center mr-3 bg-white dark:bg-gray-800" style="border:2px solid ${PILL_COLOR};" aria-hidden="true">
        <span class="material-icons text-lg" style="color:${PILL_COLOR};">calendar_month</span>
      </div>

      <div class="program-content relative z-10 flex-grow min-w-0">
        <div class="program-name font-semibold leading-tight text-gray-900 dark:text-white truncate">${programName}</div>
        <div class="flex items-center gap-2 mt-0.5 min-w-0">
          <span class="program-range-pill whitespace-nowrap px-2 py-0.5 rounded-lg text-xs font-medium text-white flex-shrink-0" style="background:${PILL_COLOR};">${range}</span>
          <span class="program-workouts text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">${progress.completedWorkouts}/${progress.plannedWorkouts}</span>
        </div>
      </div>

      <div class="relative z-10 ml-3 flex flex-col items-end flex-shrink-0">
        <span class="program-week-box px-2 py-0.5 text-xs font-bold rounded-md mb-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white whitespace-nowrap" style="border:1px solid ${PILL_COLOR};">${label}</span>
        <span class="program-percent-pill whitespace-nowrap px-2 py-0.5 rounded-lg text-xs font-medium text-white" style="background:${PILL_COLOR};">${progress.percent}%</span>
      </div>
    </button>
  `;

  const tile = host.querySelector('#program-tile');
  const openDetails = () =>
    import('./Modals/ProgramDetailsModal.js').then(({ ProgramDetailsModal }) =>
      ProgramDetailsModal.open(program.id)
    );
  tile?.addEventListener('click', openDetails);
}
