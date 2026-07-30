import { expect, test } from '@playwright/test';

// Chunk requests the speculative idle warm-up would make. Home is excluded: it
// is the landing page and is loaded by navigation, not by warm-up.
const SPECULATIVE_MODULE_PATTERNS = [
  /features\/habits\/HabitsModule\.js/,
  /features\/fitness\/FitnessModule\.js/,
  /features\/stats\/stats\.js/,
  /features\/profile\/ProfileModule\.js/,
];

function recordModuleRequests(page) {
  const requested = [];
  page.on('request', (request) => {
    const url = request.url();
    if (SPECULATIVE_MODULE_PATTERNS.some((pattern) => pattern.test(url))) {
      requested.push(url);
    }
  });
  return requested;
}

async function stubConnection(page, connection) {
  await page.addInitScript((value) => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value,
    });
  }, connection);
}

// The idle warm-up is scheduled with a 1200ms requestIdleCallback timeout, so
// anything shorter than that cannot distinguish "suppressed" from "not yet".
async function waitPastIdleWarmup(page) {
  await page.waitForTimeout(2500);
}

test.describe('speculative prefetch scheduling', () => {
  test('warms every top-level page on an unconstrained connection', async ({ page }) => {
    await stubConnection(page, { saveData: false, effectiveType: '4g' });
    const requested = recordModuleRequests(page);

    await page.goto('/');
    await expect(page.locator('#home-view')).toBeVisible();
    await waitPastIdleWarmup(page);

    for (const pattern of SPECULATIVE_MODULE_PATTERNS) {
      expect(requested.some((url) => pattern.test(url))).toBe(true);
    }
  });

  test('suppresses speculative warm-up when Save-Data is enabled', async ({ page }) => {
    await stubConnection(page, { saveData: true, effectiveType: '4g' });
    const requested = recordModuleRequests(page);

    await page.goto('/');
    await expect(page.locator('#home-view')).toBeVisible();
    await waitPastIdleWarmup(page);

    expect(requested).toEqual([]);
  });

  test('suppresses speculative warm-up on a 2G-class connection', async ({ page }) => {
    await stubConnection(page, { saveData: false, effectiveType: 'slow-2g' });
    const requested = recordModuleRequests(page);

    await page.goto('/');
    await expect(page.locator('#home-view')).toBeVisible();
    await waitPastIdleWarmup(page);

    expect(requested).toEqual([]);
  });

  // Suppressing the speculative warm-up must not cost the user a responsive
  // navigation: intent prefetch is the part that makes tapping a tab feel fast,
  // and it is deliberately not connection-gated.
  test('keeps intent prefetch on a Save-Data connection', async ({ page }) => {
    await stubConnection(page, { saveData: true, effectiveType: 'slow-2g' });
    const requested = recordModuleRequests(page);

    await page.goto('/');
    await expect(page.locator('#home-view')).toBeVisible();
    await waitPastIdleWarmup(page);
    expect(requested).toEqual([]);

    await page.getByRole('tab', { name: 'Stats view' }).hover();
    await expect
      .poll(() => requested.some((url) => /features\/stats\/stats\.js/.test(url)))
      .toBe(true);

    expect(requested.some((url) => /features\/profile\/ProfileModule\.js/.test(url))).toBe(
      false
    );
  });
});
