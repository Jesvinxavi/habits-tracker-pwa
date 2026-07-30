/**
 * Seeds an already-booted Playwright page through the explicit in-memory test
 * harness. UI tests must use this instead of browser storage so they cannot
 * accidentally exercise the retired legacy persistence path.
 */
export async function seedTestHarness(page, snapshot = {}) {
  await page.waitForFunction(() => Boolean(window.__APP_TEST__?.seed));
  await page.evaluate((data) => window.__APP_TEST__.seed(data), snapshot);
}
