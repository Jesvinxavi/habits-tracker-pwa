import { describe, expect, it } from 'vitest';
import { escapeAttribute, escapeHtml, normalizeHexColor } from '../../src/shared/sanitize.js';

describe('fitness presentation sanitizers', () => {
  it('escapes text and quoted-attribute delimiters', () => {
    const unsafe = 'Bench <b data-x="1">\'Press\' & Run</b>';
    expect(escapeHtml(unsafe)).toBe(
      'Bench &lt;b data-x=&quot;1&quot;&gt;&#39;Press&#39; &amp; Run&lt;/b&gt;'
    );
    expect(escapeAttribute(unsafe)).toBe(escapeHtml(unsafe));
  });

  it('accepts design-system hex colours and rejects style injection', () => {
    expect(normalizeHexColor('#ef4444')).toBe('#EF4444');
    expect(normalizeHexColor('red";background:url(x)')).toBe('#64748B');
    expect(normalizeHexColor(null, '#000000')).toBe('#000000');
  });
});
