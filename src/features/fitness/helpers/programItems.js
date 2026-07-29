/**
 * Shared presentation for the things a program pins to a day.
 *
 * A pinned item is either a routine or a single activity, and both the builder's
 * day rows and the details modal's week view draw it as the same tile. Resolving
 * the name, icon and colour in one place keeps the two views from drifting, and
 * keeps the read-time integrity rule in one place too: an item whose routine or
 * activity has since been deleted resolves to null and is simply not drawn.
 */

import { getRoutine } from '../routines.js';
import { getActivity, getActivityCategory } from '../activities.js';
import { escapeHtml, normalizeHexColor } from '../../../shared/sanitize.js';

/** Routines carry one colour rather than a category's, since a routine spans categories. */
const ROUTINE_COLOR = '#0060C7';

/**
 * Resolves what a pinned item looks like.
 * @param {{type: 'routine'|'activity', id: string}} item The pinned item.
 * @returns {{name: string, color: string, iconHTML: string}|null} Presentation
 *   data, or null when the target no longer exists.
 */
export function programItemPresentation(item) {
  if (!item) return null;

  if (item.type === 'activity') {
    const activity = getActivity(item.id);
    if (!activity) return null;
    const category = getActivityCategory(activity.categoryId);
    const glyph = activity.icon || category?.icon || '🎯';
    return {
      name: activity.name,
      color: normalizeHexColor(category?.color, ROUTINE_COLOR),
      iconHTML: `<span class="text-base leading-none flex-shrink-0" aria-hidden="true">${escapeHtml(glyph)}</span>`,
    };
  }

  const routine = getRoutine(item.id);
  if (!routine) return null;
  return {
    name: routine.name,
    color: ROUTINE_COLOR,
    iconHTML:
      '<span class="material-icons text-base leading-none text-ios-blue flex-shrink-0" aria-hidden="true">repeat</span>',
  };
}
