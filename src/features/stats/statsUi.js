/**
 * The shared vocabulary every statistics surface is built from.
 *
 * The Stats page and the two statistics modals used to each invent their own
 * tiles, so the same kind of number appeared in three sizes and four colours,
 * and colour carried no meaning — a stat was purple because it was fourth.
 * Here there is one card, one section header and one chart set, and colour is
 * reserved for the few figures that genuinely have a good and a bad direction.
 *
 * Markup only: nothing here reads the store or calculates anything.
 */

import { escapeHtml } from '../../shared/sanitize.js';
import { readableTextOn } from '../../shared/color.js';

/**
 * Card emphasis. `feature` is for the one number a section is really about;
 * `plain` is for everything else, so the feature has something to stand out
 * from. `positive` and `caution` are for figures with a direction.
 */
const TONES = {
  plain: {
    card: 'bg-gray-50 dark:bg-gray-800/70',
    value: 'text-gray-900 dark:text-white',
    label: 'text-gray-500 dark:text-gray-400',
  },
  feature: {
    card: 'bg-blue-50 dark:bg-blue-950/50 ring-1 ring-blue-200/70 dark:ring-blue-900/70',
    value: 'text-blue-700 dark:text-blue-200',
    label: 'text-blue-700/70 dark:text-blue-300/80',
  },
  positive: {
    card: 'bg-emerald-50 dark:bg-emerald-950/50',
    value: 'text-emerald-700 dark:text-emerald-200',
    label: 'text-emerald-700/70 dark:text-emerald-300/80',
  },
  caution: {
    card: 'bg-amber-50 dark:bg-amber-950/50',
    value: 'text-amber-700 dark:text-amber-200',
    label: 'text-amber-700/70 dark:text-amber-300/80',
  },
};

/**
 * One statistic.
 * @param {object} options Card options.
 * @param {string|number} options.value The figure itself.
 * @param {string} options.label What it measures.
 * @param {string} [options.sub] A qualifier: the window, a date, a comparison.
 * @param {'plain'|'feature'|'positive'|'caution'} [options.tone] Emphasis.
 * @param {boolean} [options.wide] Span the full row.
 * @param {boolean} [options.raw] Treat `value` as trusted markup.
 * @returns {string} Card markup.
 */
export function statCard({ value, label, sub = '', tone = 'plain', wide = false, raw = false }) {
  const palette = TONES[tone] || TONES.plain;
  // A card holds either a figure or a short phrase, and a phrase set at the
  // size of a figure wraps to three lines and pushes the grid out of square.
  // Long values step down a size rather than each caller having to say so.
  const text = String(value ?? '');
  const size = text.length > 10 ? 'text-base' : text.length > 6 ? 'text-xl' : 'text-2xl';
  return `
    <div class="stat-card ${palette.card} ${wide ? 'col-span-2' : ''} rounded-xl p-3">
      <div class="stat-value ${size} font-bold leading-tight ${palette.value}">${raw ? value : escapeHtml(text)}</div>
      <div class="stat-label text-xs font-medium mt-0.5 ${palette.label}">${escapeHtml(label)}</div>
      ${sub ? `<div class="stat-sub text-[11px] mt-1 ${palette.label} opacity-80">${escapeHtml(sub)}</div>` : ''}
    </div>
  `;
}

/**
 * A titled block of statistics.
 * @param {object} options Section options.
 * @param {string} options.title Section heading.
 * @param {string} options.body Section contents.
 * @param {string} [options.note] A line under the heading explaining the block.
 * @returns {string} Section markup.
 */
export function statSection({ title, body, note = '' }) {
  if (!body) return '';
  return `
    <section class="stats-section">
      <h4 class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">${escapeHtml(title)}</h4>
      ${note ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">${escapeHtml(note)}</p>` : '<div class="mb-2"></div>'}
      ${body}
    </section>
  `;
}

/**
 * Lays cards out two to a row, which is as many as stays readable on a phone.
 * @param {string[]} cards Card markup.
 * @returns {string} Grid markup.
 */
export function statGrid(cards) {
  const filled = cards.filter(Boolean);
  if (filled.length === 0) return '';
  return `<div class="grid grid-cols-2 gap-2.5">${filled.join('')}</div>`;
}

/**
 * A labelled row: a name on the left, a figure on the right, and a bar beneath
 * showing the figure's share. Used wherever a handful of things are being
 * compared — categories, weekdays, muscle groups.
 * @param {object} options Row options.
 * @param {string} options.label The thing being measured.
 * @param {string} options.value Its figure, already formatted.
 * @param {number} options.fraction 0–1, how full the bar is.
 * @param {string} [options.color] Bar colour.
 * @param {string} [options.sub] A qualifier under the label.
 * @returns {string} Row markup.
 */
export function comparisonRow({ label, value, fraction, color = '#3B82F6', sub = '' }) {
  const width = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0)) * 100;
  return `
    <div class="comparison-row py-1.5">
      <div class="flex items-baseline justify-between gap-3">
        <span class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">${escapeHtml(label)}</span>
        <span class="text-sm font-semibold text-gray-900 dark:text-white tabular-nums shrink-0">${escapeHtml(value)}</span>
      </div>
      ${sub ? `<div class="text-[11px] text-gray-500 dark:text-gray-400">${escapeHtml(sub)}</div>` : ''}
      <div class="mt-1 h-1.5 rounded-full bg-gray-200/80 dark:bg-gray-700/80 overflow-hidden">
        <div class="h-full rounded-full" style="width:${width.toFixed(1)}%;background-color:${color};"></div>
      </div>
    </div>
  `;
}

/**
 * The empty state a surface shows before it has anything to report.
 * @param {object} options Options.
 * @param {string} options.title Headline.
 * @param {string} options.message Explanation of what would fill it.
 * @param {string} [options.icon] Material icon name.
 * @returns {string} Empty-state markup.
 */
export function statsEmptyState({ title, message, icon = 'bar_chart' }) {
  return `
    <div class="text-center py-10 px-4">
      <span class="material-icons text-4xl text-gray-300 dark:text-gray-600" aria-hidden="true">${escapeHtml(icon)}</span>
      <p class="text-base font-semibold text-gray-700 dark:text-gray-200 mt-3">${escapeHtml(title)}</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * A calendar heatmap of the last N weeks, newest week on the right.
 *
 * Reading a year of completions as numbers is work; reading it as a grid is a
 * glance, and the shape of a slump is visible in a way a percentage never
 * makes it.
 * @param {object} options Options.
 * @param {Array<{dateKey: string, date: Date, status?: string, percentage?: number, active?: number}>} options.days
 *   Days, newest first.
 * @param {number} [options.weeks] How many weeks to show.
 * @param {string} [options.color] The colour full days are drawn in.
 * @returns {string} Heatmap markup.
 */
export function heatmap({ days, weeks = 13, color = '#22C55E' }) {
  if (!days || days.length === 0) return '';

  const byKey = new Map(days.map((day) => [day.dateKey, day]));
  const newest = days[0].date;
  // Anchor on the Sunday ending the current week so columns are whole weeks.
  const end = new Date(newest);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const columns = [];
  for (let week = weeks - 1; week >= 0; week -= 1) {
    const cells = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = new Date(end);
      date.setDate(date.getDate() - week * 7 - (6 - weekday));
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(date.getDate()).padStart(2, '0');
      const dateKey = `${date.getFullYear()}-${month}-${dayOfMonth}`;
      const day = byKey.get(dateKey);
      const future = date > newest;

      let opacity = 0;
      if (day) {
        if (typeof day.percentage === 'number' && day.active > 0) opacity = day.percentage / 100;
        else if (day.status === 'completed') opacity = 1;
        else if (day.status === 'skipped') opacity = 0.18;
      }

      // Every past day gets a base tint so the grid reads as a grid; a day with
      // nothing done is a visible gap rather than a hole in the layout. Days
      // that have not happened yet are left blank entirely.
      const filled = opacity > 0;
      const base = future ? '' : 'bg-gray-200/70 dark:bg-gray-700/50';
      const fill = filled
        ? `background-color:${color};opacity:${Math.max(0.25, opacity).toFixed(2)};`
        : '';
      cells.push(
        `<div class="heat-cell rounded-[2px] aspect-square ${base}" title="${escapeHtml(dateKey)}" style="${fill}"></div>`
      );
    }
    columns.push(`<div class="grid grid-rows-7 gap-[3px]">${cells.join('')}</div>`);
  }

  return `
    <div class="heatmap">
      <div class="grid gap-[3px]" style="grid-template-columns:repeat(${weeks},minmax(0,1fr));">
        ${columns.join('')}
      </div>
      <div class="flex items-center justify-between mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        <span>${weeks} weeks ago</span>
        <span>Today</span>
      </div>
    </div>
  `;
}

/**
 * A compact bar chart for a short ordered series — a week's weekdays, a
 * quarter's weeks.
 * @param {object} options Options.
 * @param {Array<{label: string, value: number, sub?: string}>} options.bars The series.
 * @param {string} [options.color] Bar colour.
 * @param {(value: number) => string} [options.format] Value formatter for labels.
 * @param {string[]} [options.axis] Start/middle/end labels, for long series.
 * @param {number|null} [options.scaleTo] Fix the top of the scale, e.g. 100 for
 *   percentages, instead of scaling to the tallest bar.
 * @returns {string} Chart markup.
 */
export function barChart({
  bars,
  color = '#3B82F6',
  format = (value) => String(Math.round(value)),
  axis = [],
  scaleTo = null,
}) {
  if (!bars || bars.length === 0) return '';
  // Percentages are scaled to a fixed 100 rather than to the tallest bar: a set
  // of rates between 78% and 81% auto-scaled looks like a dramatic spread, when
  // the real story is that they are all the same.
  const max = scaleTo ?? Math.max(...bars.map((bar) => bar.value), 0);
  // Past about seven columns there is no room under each one for a legible
  // label, so a long series gets a start/middle/end axis instead of trying to
  // squeeze a word into twenty pixels.
  const perColumnLabels = bars.length <= 7;

  const columns = bars
    .map((bar) => {
      const height = max > 0 ? Math.max(2, (bar.value / max) * 100) : 2;
      const showValue = perColumnLabels || bar.value > 0;
      return `
        <div class="flex flex-col items-center gap-1 flex-1 min-w-0">
          <div class="text-[10px] font-semibold text-gray-600 dark:text-gray-300 tabular-nums h-3">${showValue ? escapeHtml(format(bar.value)) : ''}</div>
          <div class="w-full flex items-end" style="height:64px;">
            <div class="w-full rounded-t-[3px]" style="height:${height.toFixed(1)}%;background-color:${color};opacity:${bar.value > 0 ? 1 : 0.2};"></div>
          </div>
          ${
            perColumnLabels
              ? `<div class="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">${escapeHtml(bar.label)}</div>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  const axisRow =
    !perColumnLabels && axis.length > 0
      ? `<div class="flex justify-between mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
           ${axis.map((label) => `<span>${escapeHtml(label)}</span>`).join('')}
         </div>`
      : '';

  return `<div><div class="flex items-end gap-1.5">${columns}</div>${axisRow}</div>`;
}

/**
 * A bar chart, one row per thing being compared.
 *
 * Rows rather than columns because the things compared here have names, and a
 * name under a column is either truncated or turned sideways. The figure rides
 * the bar — inside it where there is room, just past its end where there is not
 * — and the name and count sit beneath in grey, so the bars stay the thing the
 * eye follows down the list.
 * @param {object} options Options.
 * @param {Array<{label: string, sub?: string, value: number, color?: string}>} options.bars
 *   The series. `value` is a percentage.
 * @returns {string} Chart markup.
 */
export function horizontalBarChart({ bars }) {
  if (!bars || bars.length === 0) return '';

  const rows = bars
    .map((bar) => {
      const value = Math.max(0, Math.min(100, Number.isFinite(bar.value) ? bar.value : 0));
      const color = bar.color || '#3B82F6';
      const label = `${Math.round(value)}%`;
      // A fill narrower than about a quarter cannot hold its own figure, so
      // that one sits just past the end of the bar instead.
      const inside = value >= 25;

      return `
        <div class="chart-row py-1.5">
          <div class="relative h-7 rounded-md bg-gray-200/70 dark:bg-gray-700/60 overflow-hidden">
            <div class="absolute inset-y-0 left-0 rounded-md flex items-center justify-end"
                 style="width:${value.toFixed(1)}%;background-color:${color};">
              ${
                inside
                  ? `<span class="text-[11px] font-bold tabular-nums pr-2" style="color:${readableTextOn(color)};">${label}</span>`
                  : ''
              }
            </div>
            ${
              inside
                ? ''
                : `<span class="absolute inset-y-0 flex items-center text-[11px] font-bold tabular-nums text-gray-600 dark:text-gray-300"
                         style="left:calc(${value.toFixed(1)}% + 6px);">${label}</span>`
            }
          </div>
          <div class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            <span class="font-medium text-gray-500 dark:text-gray-400">${escapeHtml(bar.label)}</span>${
              bar.sub ? ` · ${escapeHtml(bar.sub)}` : ''
            }
          </div>
        </div>
      `;
    })
    .join('');

  return `<div>${rows}</div>`;
}

/**
 * A pie chart with its shares written into the segments, and a legend beneath.
 *
 * The legend carries the names because a segment is rarely wide enough for one,
 * and slices too thin to hold even a percentage are left unlabelled rather than
 * printed on top of their neighbours.
 * @param {object} options Options.
 * @param {Array<{label: string, value: number, sub?: string, color?: string}>} options.slices
 *   Segments; `value` is a raw amount, not a percentage.
 * @returns {string} Chart markup.
 */
export function pieChart({ slices }) {
  const usable = (slices || []).filter((slice) => slice.value > 0);
  if (usable.length === 0) return '';

  const total = usable.reduce((sum, slice) => sum + slice.value, 0);
  const centre = 50;
  const radius = 46;
  const point = (radians, distance) => [
    (centre + distance * Math.cos(radians)).toFixed(2),
    (centre + distance * Math.sin(radians)).toFixed(2),
  ];

  const shapes = [];
  const labels = [];
  const legend = [];
  let angle = -Math.PI / 2; // start at twelve o'clock

  for (const slice of usable) {
    const share = slice.value / total;
    const color = slice.color || '#3B82F6';
    const sweep = share * Math.PI * 2;
    const start = angle;
    const mid = angle + sweep / 2;
    angle += sweep;

    if (usable.length === 1) {
      // One category fills the circle, and an arc whose start meets its end
      // draws nothing at all, so that case is a plain circle.
      shapes.push(`<circle cx="${centre}" cy="${centre}" r="${radius}" fill="${color}"/>`);
    } else {
      const [x1, y1] = point(start, radius);
      const [x2, y2] = point(angle, radius);
      const largeArc = sweep > Math.PI ? 1 : 0;
      shapes.push(
        `<path d="M ${centre} ${centre} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}"/>`
      );
    }

    const percent = Math.round(share * 100);
    // Below roughly a twelfth of the circle a label would overlap its
    // neighbours. The legend still names and quantifies it.
    if (share >= 0.08) {
      // A slice that is the whole circle has no meaningful mid-point on the
      // rim, so its label belongs in the middle.
      const [labelX, labelY] =
        usable.length === 1 ? [centre, centre] : point(mid, radius * 0.62);
      labels.push(
        `<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="700" fill="${readableTextOn(color)}">${percent}%</text>`
      );
    }

    legend.push(`
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0" style="background-color:${color};"></span>
        <span class="text-xs text-gray-700 dark:text-gray-200 truncate">${escapeHtml(slice.label)}</span>
        <span class="text-xs text-gray-400 dark:text-gray-500 tabular-nums ml-auto flex-shrink-0">${percent}%${slice.sub ? ` \u00b7 ${escapeHtml(slice.sub)}` : ''}</span>
      </div>
    `);
  }

  const summary = usable
    .map((slice) => `${slice.label} ${Math.round((slice.value / total) * 100)}%`)
    .join(', ');

  return `
    <div class="flex flex-col items-center gap-3">
      <svg viewBox="0 0 100 100" class="w-36 h-36 flex-shrink-0" role="img"
           aria-label="Share by category: ${escapeHtml(summary)}">
        ${shapes.join('')}
        ${labels.join('')}
      </svg>
      <div class="w-full space-y-1.5">${legend.join('')}</div>
    </div>
  `;
}
