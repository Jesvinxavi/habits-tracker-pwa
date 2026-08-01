/**
 * The two comparison charts. Their edge cases are the interesting part: a
 * category colour is the user's choice, so a label printed on one has to stay
 * readable on anything from near-black to bright yellow, and a share can be
 * anything from the whole circle to a sliver too thin to write in.
 */
import { describe, expect, it } from 'vitest';
import { horizontalBarChart, pieChart } from '../../src/features/stats/statsUi.js';
import { readableTextOn } from '../../src/shared/color.js';

/**
 * Counts non-overlapping occurrences of a needle.
 * @param {string} haystack Markup.
 * @param {string} needle Substring.
 * @returns {number} Count.
 */
const occurrences = (haystack, needle) => haystack.split(needle).length - 1;

describe('readable text on a background', () => {
  it('darkens on light backgrounds and lightens on dark ones', () => {
    expect(readableTextOn('#FFD60A')).toBe('#111827'); // bright yellow
    expect(readableTextOn('#FFFFFF')).toBe('#111827');
    expect(readableTextOn('#1D1D1F')).toBe('#FFFFFF'); // near black
    expect(readableTextOn('#5856D6')).toBe('#FFFFFF'); // deep indigo
  });

  it('accepts short hex and falls back rather than throwing on rubbish', () => {
    expect(readableTextOn('#fff')).toBe('#111827');
    expect(readableTextOn('not-a-colour')).toBe('#111827');
    expect(readableTextOn(undefined)).toBe('#111827');
  });
});

describe('horizontal bar chart', () => {
  const bars = [
    { label: 'Health', sub: '4 habits', value: 80, color: '#34C759' },
    { label: 'Mind', sub: '1 habit', value: 8, color: '#5856D6' },
  ];

  it('renders one row per bar, each naming its category and count', () => {
    const markup = horizontalBarChart({ bars });
    expect(occurrences(markup, 'chart-row')).toBe(2);
    expect(markup).toContain('Health');
    expect(markup).toContain('4 habits');
    expect(markup).toContain('Mind');
    expect(markup).toContain('1 habit');
  });

  it('writes a wide bar’s figure inside it, in a colour that reads', () => {
    const markup = horizontalBarChart({ bars: [bars[0]] });
    expect(markup).toContain('width:80.0%');
    // Inside the fill, so it is positioned by the flex row rather than offset.
    expect(markup).toContain(`color:${readableTextOn('#34C759')}`);
    expect(markup).not.toContain('left:calc(');
  });

  it('moves a narrow bar’s figure past the end of the bar', () => {
    const markup = horizontalBarChart({ bars: [bars[1]] });
    expect(markup).toContain('left:calc(8.0% + 6px)');
  });

  it('clamps values that fall outside nought to a hundred', () => {
    const markup = horizontalBarChart({
      bars: [
        { label: 'Over', value: 140, color: '#000000' },
        { label: 'Under', value: -20, color: '#000000' },
        { label: 'Broken', value: Number.NaN, color: '#000000' },
      ],
    });
    expect(markup).toContain('width:100.0%');
    expect(occurrences(markup, 'width:0.0%')).toBe(2);
  });

  it('renders nothing at all when there is nothing to compare', () => {
    expect(horizontalBarChart({ bars: [] })).toBe('');
  });
});

describe('pie chart', () => {
  it('draws a full circle rather than an arc for a single category', () => {
    const markup = pieChart({ slices: [{ label: 'Cardio', value: 12, color: '#FF3B30' }] });
    // An arc whose start meets its end draws nothing, so this case is a circle.
    expect(markup).toContain('<circle');
    expect(markup).not.toContain('<path');
    expect(markup).toContain('100%');
  });

  it('draws one wedge per category and labels the ones with room', () => {
    const markup = pieChart({
      slices: [
        { label: 'Cardio', value: 40, color: '#FF3B30' },
        { label: 'Strength', value: 30, color: '#007AFF' },
        { label: 'Stretching', value: 14, color: '#34C759' },
        { label: 'Sports', value: 3, color: '#FFD60A' },
        { label: 'Other', value: 1, color: '#8E8E93' },
      ],
    });

    expect(occurrences(markup, '<path')).toBe(5);
    // Only the three shares above roughly a twelfth carry an inside label; the
    // 3% and 1% slivers would print on top of each other.
    expect(occurrences(markup, '<text')).toBe(3);
    // Every category is still named and quantified by the legend.
    for (const name of ['Cardio', 'Strength', 'Stretching', 'Sports', 'Other']) {
      expect(markup).toContain(name);
    }
    expect(markup).toContain('3%');
    expect(markup).toContain('1%');
  });

  it('ignores categories with nothing recorded', () => {
    const markup = pieChart({
      slices: [
        { label: 'Cardio', value: 5, color: '#FF3B30' },
        { label: 'Unused', value: 0, color: '#007AFF' },
      ],
    });
    expect(markup).not.toContain('Unused');
    expect(markup).toContain('<circle');
  });

  it('renders nothing when every category is empty', () => {
    expect(pieChart({ slices: [{ label: 'Cardio', value: 0 }] })).toBe('');
    expect(pieChart({ slices: [] })).toBe('');
  });

  it('escapes category names rather than trusting them', () => {
    const markup = pieChart({
      slices: [{ label: '<img src=x onerror=alert(1)>', value: 5, color: '#FF3B30' }],
    });
    expect(markup).not.toContain('<img');
    expect(markup).toContain('&lt;img');
  });
});
