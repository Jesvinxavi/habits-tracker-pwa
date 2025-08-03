/**
 * Fitness muscle group helper functions
 */

import { capitalize } from '../../../shared/common.js';

/**
 * Format muscle name for display
 * @param {string} muscleName - Raw muscle name
 * @returns {string} Formatted muscle name
 */
export function formatMuscleName(muscleName) {
  return muscleName
    .split('_')
    .map((word) => capitalize(word))
    .join(' ');
} 

/**
 * Build muscle group header HTML
 * @param {string} muscleGroupName - The muscle group name
 * @returns {string} HTML string for the muscle group header
 */
export function buildMuscleGroupHeader(muscleGroupName) {
  return `<div class="muscle-header pl-3 py-1 text-sm font-semibold text-gray-700 dark:text-gray-300">${formatMuscleName(muscleGroupName)}</div>`;
} 