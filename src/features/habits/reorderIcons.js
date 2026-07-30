// Icons for the Habits header reorder toggle.
//
// The button is built by HabitsView and then re-rendered by HabitReorderModal
// every time the mode flips, so the markup has to come from one place or the
// two drift. The modal is dynamically imported, which is why these live here
// rather than inside it.

const SVG_OPEN =
  '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">';

/** List rows with an up/down arrow beside them: move these, not merely a list. */
export const REORDER_ICON =
  `${SVG_OPEN}<path d="M11 7h9M11 12h9M11 17h9"/>` +
  '<path d="M6 6.5v11M3.5 9L6 6.5 8.5 9M3.5 15L6 17.5 8.5 15"/></svg>';

/** Shown while reordering is active, where the button commits the new order. */
export const DONE_ICON = `${SVG_OPEN}<path d="M5 13l4 4L19 7"/></svg>`;
