/**
 * The rule for how a habit update becomes a habit, shared by the two places
 * that build one: the reducer, which produces what the screen renders, and the
 * persistence router, which produces what is written to the outbox and synced.
 *
 * These ran independently until 2026-08-01, and only the reducer stamped a
 * pause. `dispatch` persists before it commits the reducer, so the stamp never
 * reached the outbox: `pausedAt` lived in memory for one session and was lost
 * on reload. Keeping the rule in one place is what stops them diverging again.
 */

/**
 * Merges an update into a habit, recording when a pause began.
 *
 * Statistics need to know *when* a pause started, or they cannot tell a habit
 * that was never kept from one kept for a year and then deliberately put down.
 *
 * A pause is always stamped afresh, rather than only when no stamp is present.
 * A habit that is paused, resumed and paused again keeps the earlier stamp on
 * the backend — `db.patch` cannot remove a field the payload omits, and
 * `pausedAt` has no null form to clear it with — so treating any existing value
 * as authoritative would date the new pause to the old one. The stale value is
 * inert while the habit runs, because every reader tests `paused` first.
 *
 * @param {object|null} previous The habit as it currently stands, or null when
 *   it is being created — a habit created already paused is stamped like any
 *   other transition into a pause.
 * @param {object} updates The fields being changed.
 * @param {number} [now] Timestamp to stamp with; defaults to the current time.
 * @returns {object} The merged habit.
 */
export function mergeHabitUpdate(previous, updates, now = Date.now()) {
  const merged = { ...previous, ...updates };
  if (merged.paused && !previous?.paused) {
    // A stamp supplied explicitly wins: that is a sync carrying the moment
    // another device recorded, which is the one that actually happened.
    merged.pausedAt = updates?.pausedAt ?? now;
  } else if (!merged.paused) {
    delete merged.pausedAt;
  }
  return merged;
}
