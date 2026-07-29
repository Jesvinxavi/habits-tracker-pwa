/**
 * Escapes an arbitrary value for an HTML text or quoted-attribute context.
 *
 * Prefer textContent/setAttribute when building DOM nodes. This helper exists
 * for the remaining string templates and intentionally escapes both quote
 * styles so the same value cannot escape a quoted attribute.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}

/**
 * Quoted HTML attributes use the same escaping contract as escapeHtml.
 * Exported separately so call sites document the context they are protecting.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeAttribute(value) {
  return escapeHtml(value);
}

/**
 * Accepts only the six-digit hex colours used by the fitness design system.
 * Imported or legacy values that do not match fall back safely instead of
 * entering a style attribute.
 * @param {unknown} value
 * @param {string} [fallback]
 * @returns {string}
 */
export function normalizeHexColor(value, fallback = '#64748B') {
  const candidate = String(value ?? '').trim();
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toUpperCase() : fallback;
}
