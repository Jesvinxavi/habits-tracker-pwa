// Utility colour helpers – shared across UI components
// ------------------------------------------------------

/**
 * Convert a 3- or 6-digit HEX colour to rgba() string with the desired alpha.
 * @param {string} hex  e.g. "#FF0000" or "#F00"
 * @param {number} alpha  0-1 transparency
 */
export function hexToRgba(hex = '#000000', alpha = 1) {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Generate a left-to-right linear-gradient that fills ‹progress› percent with the
 * solid category colour and leaves the rest with a subtle tinted base.
 * @param {string} hex  e.g. "#2563EB"
 * @param {number} progress 0–1 inclusive (0 = no fill, 1 = full fill)
 * @param {number} [baseAlpha=0.07] – alpha for the unfilled tint
 */
export function tintedLinearGradient(hex, progress = 0, baseAlpha = 0.07) {
  const pct = Math.max(0, Math.min(progress, 1)) * 100;
  const base = hexToRgba(hex, baseAlpha);
  return `linear-gradient(to right, ${hex} ${pct}%, transparent ${pct}% ), ${base}`;
}
