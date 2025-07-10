/**
 * Activity Pills Helper Functions
 *
 * Pure functions for generating activity pills display
 */

/**
 * Generates activity pills based on the record type and data
 * @param {Object} record - The activity record
 * @param {Object} category - The activity category
 * @returns {string} HTML string for the activity pills
 */
export function generateActivityPills(record, category) {
  if (record.sets && record.sets.length > 0) {
    return generateSetsPills(record, category);
  } else {
    return generateTimePills(record, category);
  }
}

/**
 * Generates pills for sets/reps based activities
 * @param {Object} record - The activity record
 * @param {Object} category - The activity category
 * @returns {string} HTML string for the sets pills
 */
export function generateSetsPills(record, category) {
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
      return `<span class="inline-block text-white text-xs px-2 py-1 rounded-lg mr-1 mb-1 font-medium" style="background-color: ${category.color};">${setDisplay}</span>`;
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
export function generateTimePills(record, category) {
  let pills = [];

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
      `<span class="inline-block text-white text-xs px-2 py-1 rounded-lg mr-1 mb-1 font-medium" style="background-color: ${category.color};">${record.duration} ${unitShort}</span>`
    );
  }

  if (record.intensity) {
    const capitalizedIntensity =
      record.intensity.charAt(0).toUpperCase() + record.intensity.slice(1);
    pills.push(
      `<span class="inline-block text-white text-xs px-2 py-1 rounded-lg mr-1 mb-1 font-medium" style="background-color: ${category.color};">${capitalizedIntensity}</span>`
    );
  }

  return pills.join('');
}

/**
 * Builds set pills with specific layout ordering for display
 * @param {Array} sets - Array of set objects
 * @param {Object} category - The activity category
 * @returns {string} HTML string for the set pills with ordered layout
 */
export function buildSetPills(sets, category) {
  if (!sets || sets.length === 0) {
    return '';
  }

  const record = { sets };
  return generateSetsPills(record, category);
}
