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
 * Picks black or white text for a background, whichever stays legible.
 *
 * Category colours are the user's choice and range from near-black to bright
 * yellow, so a label printed on one in a fixed colour is unreadable half the
 * time. Uses the WCAG relative-luminance formula and its usual 0.179 threshold.
 *
 * An absent or unparsable colour returns dark text: the surfaces this is used
 * on are light by default, and white text on an unknown background risks
 * disappearing entirely, where dark text merely looks plain.
 * @param {string} hex Background colour, 3- or 6-digit hex.
 * @returns {string} `#FFFFFF` or `#111827`.
 */
export function readableTextOn(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return '#111827';

  const channel = (value) => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const bigint = parseInt(h, 16);
  const luminance =
    0.2126 * channel((bigint >> 16) & 255) +
    0.7152 * channel((bigint >> 8) & 255) +
    0.0722 * channel(bigint & 255);

  return luminance > 0.179 ? '#111827' : '#FFFFFF';
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
