/**
 * Activity Pills Helper Functions
 *
 * Pure functions for generating activity pills display
 */
import { escapeHtml, normalizeHexColor } from '../../../shared/sanitize.js';

/**
 * Generates activity pills based on the record type and data
 * @param {Object} record - The activity record
 * @param {Object} category - The activity category
 * @param {Object} [options] - Display options
 * @param {boolean} [options.archived] - Whether the activity has been deleted
 * @returns {string} HTML string for the activity pills
 */
export function generateActivityPills(record, category, { archived = false } = {}) {
  if (record.sets && record.sets.length > 0) {
    return generateSetsPills(record, category);
  }

  const timePills = generateTimePills(record, category);
  if (timePills) return timePills;

  // Nothing measured yet — a record added straight to the schedule. Say so on
  // the card, so an empty tile reads as unfinished rather than as a session
  // that genuinely had nothing to it. A deleted activity has nowhere to add
  // them, so it is left without the invitation.
  return archived ? '' : generateAddDetailsPrompt(category);
}

/**
 * Builds the prompt shown on a record that carries no metrics yet.
 * @param {Object} category - The activity category, for the accent colour
 * @returns {string} HTML string for the prompt pill
 */
function generateAddDetailsPrompt(category) {
  const color = normalizeHexColor(category?.color);
  return `
    <span class="add-details-prompt inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium border border-dashed"
          style="color:${color}; border-color:${color};">
      <span class="material-icons text-sm" aria-hidden="true">add</span>Add sets &amp; details
    </span>
  `;
}

/**
 * Generates pills for sets/reps based activities
 * @param {Object} record - The activity record
 * @param {Object} category - The activity category
 * @returns {string} HTML string for the sets pills
 */
function generateSetsPills(record, category) {
  const color = normalizeHexColor(category?.color);
  const n = record.sets.length;
  const col1Count = Math.ceil(n / 2);

  // Build ordered index list: col1 row-wise first, then matching col2 item if exists
  const orderedIndices = [];
  for (let i = 0; i < col1Count; i++) {
    // Left column
    orderedIndices.push(i);
    // Right column (if any)
    const rightIdx = col1Count + i;
    if (rightIdx < n) orderedIndices.push(rightIdx);
  }

  const pillsMarkup = orderedIndices
    .map((idx) => {
      const set = record.sets[idx];
      let setDisplay = `Set ${idx + 1}: ${set.reps} reps`;
      if (set.value && set.unit && set.unit !== 'none') {
        let unitDisplay = '';
        if (set.unit === 'seconds') {
          unitDisplay = 's';
        } else if (set.unit === 'minutes') {
          unitDisplay = ' Mins';
        } else if (set.unit === 'kg') {
          unitDisplay = 'kg';
        } else {
          unitDisplay = set.unit;
        }
        setDisplay += ` × ${set.value}${unitDisplay}`;
      } else if (set.value) {
        setDisplay += ` × ${set.value}`;
      }
      return `<span class="inline-block text-white text-xs px-2 py-1 rounded-lg mr-1 mb-1 font-medium" style="background-color: ${color};">${escapeHtml(setDisplay)}</span>`;
    })
    .join('');

  // Wrap pills in a 2-column grid so they utilise horizontal space predictably
  return `<div class="set-pills grid grid-cols-2 gap-1">${pillsMarkup}</div>`;
}

/**
 * Generates pills for time-based activities
 * @param {Object} record - The activity record
 * @param {Object} category - The activity category
 * @returns {string} HTML string for the time pills
 */
function generateTimePills(record, category) {
  const pills = [];
  const color = normalizeHexColor(category?.color);

  if (record.duration) {
    const durationUnit = record.durationUnit || 'minutes';
    let unitShort = '';
    if (durationUnit === 'minutes') {
      unitShort = record.duration > 1 ? 'Mins' : 'Min';
    } else if (durationUnit === 'hours') {
      unitShort = record.duration > 1 ? 'Hrs' : 'Hr';
    } else {
      unitShort = 's';
    }
    pills.push(
      `<span class="inline-block text-white text-xs px-2 py-1 rounded-lg mr-1 mb-1 font-medium" style="background-color: ${color};">${escapeHtml(record.duration)} ${unitShort}</span>`
    );
  }

  if (record.intensity) {
    const capitalizedIntensity =
      record.intensity.charAt(0).toUpperCase() + record.intensity.slice(1);
    pills.push(
      `<span class="inline-block text-white text-xs px-2 py-1 rounded-lg mr-1 mb-1 font-medium" style="background-color: ${color};">${escapeHtml(capitalizedIntensity)}</span>`
    );
  }

  return pills.join('');
}
