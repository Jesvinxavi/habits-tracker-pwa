import { expect, test } from '@playwright/test';

// WCAG 2.1 AA for text below 18pt / 14pt-bold.
const AA_NORMAL_TEXT = 4.5;

// Runs in the page so it can read computed styles.
//
// The theme is set and read inside one evaluation on purpose: `applyTheme()`
// writes `data-theme` during bootstrap, so setting it from a separate step
// races with the app putting it back.
//
// Translucent tile backgrounds are composited over the page background before
// measuring. Reading an rgba() value directly reports the contrast of a colour
// that nothing actually renders.
const measureDayTiles = (darkMode) => {
  // Tiles transition background-color over 0.2s, and getComputedStyle reports
  // the interpolated value. Reading straight after the flip measures the colour
  // being animated away from, which is the old theme's.
  const freeze = document.createElement('style');
  freeze.textContent =
    '*, *::before, *::after { transition: none !important; animation: none !important; }';
  document.head.appendChild(freeze);
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  void document.body.offsetHeight;

  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance = (colour) => {
    const [r, g, b] = colour.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const flatten = (colour, under) => {
    const parts = colour.match(/[\d.]+/g)?.map(Number);
    if (!parts || parts.length < 4) return colour;
    const [r, g, b, alpha] = parts;
    const base = under.match(/\d+/g).map(Number);
    const mix = [r, g, b].map((c, i) => Math.round(c * alpha + base[i] * (1 - alpha)));
    return `rgb(${mix.join(', ')})`;
  };

  const pageBackground = flatten(
    getComputedStyle(document.body).backgroundColor,
    darkMode ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)'
  );

  // The selected tile and the today outline both print their text in the brand
  // accent rather than a theme text colour. Whether that accent clears AA is a
  // palette decision, not the tile-background defect this spec guards, so those
  // variants are covered by the theme-awareness assertion only.
  const tiles = [...document.querySelectorAll('#home-view .day-item')]
    .filter(
      (tile) =>
        !tile.classList.contains('current-day') && !tile.classList.contains('today')
    )
    .map((tile) => {
      const background = flatten(getComputedStyle(tile).backgroundColor, pageBackground);
      const number = tile.querySelector('.day-number');
      const name = tile.querySelector('.day-name');
      return {
        classes: tile.className,
        background,
        numberContrast: number ? contrast(background, getComputedStyle(number).color) : null,
        nameContrast: name ? contrast(background, getComputedStyle(name).color) : null,
      };
    });

  const result = {
    theme: document.documentElement.getAttribute('data-theme'),
    tileBackground: getComputedStyle(
      document.querySelector('#home-view .day-item:not(.current-day)')
    ).backgroundColor,
    todayTileBackground: getComputedStyle(
      document.querySelector('#home-view .day-item.today:not(.current-day)') ||
        document.querySelector('#home-view .day-item:not(.current-day)')
    ).backgroundColor,
    // One entry per distinct background, so a failure names the tile variant
    // rather than repeating the same colour across a whole calendar range.
    tiles: [...new Map(tiles.map((tile) => [tile.background, tile])).values()],
  };

  freeze.remove();
  return result;
};

test.describe('calendar day tile legibility', () => {
  // The unselected tile background was a hard-coded light grey with no dark
  // override, while its text colour did follow the theme. In dark mode that put
  // white on #f3f4f6: a contrast ratio of 1.1, which is an invisible date.
  for (const darkMode of [false, true]) {
    const themeName = darkMode ? 'dark' : 'light';

    test(`unselected day tiles meet AA contrast in ${themeName} mode`, async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('#home-view')).toBeVisible();

      const result = await page.evaluate(measureDayTiles, darkMode);
      expect(result.theme).toBe(themeName);
      expect(result.tiles.length).toBeGreaterThan(0);

      for (const tile of result.tiles) {
        expect(
          tile.numberContrast,
          `date number on ${tile.background} (${tile.classes})`
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        expect(
          tile.nameContrast,
          `weekday label on ${tile.background} (${tile.classes})`
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      }
    });
  }

  test('the day tile background is theme-aware rather than fixed', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#home-view')).toBeVisible();

    const light = await page.evaluate(measureDayTiles, false);
    const dark = await page.evaluate(measureDayTiles, true);

    expect(dark.tileBackground).not.toBe(light.tileBackground);
    // The today outline repeated the same hard-coded grey, so it needs its own
    // assertion rather than riding on the plain tile's.
    expect(dark.todayTileBackground).not.toBe(light.todayTileBackground);
  });
});
