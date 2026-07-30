import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const SERVICE_WORKER_PATH = join(process.cwd(), 'dist', 'sw.js');

async function openControlledApp(page) {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__APP_TEST__?.seed)))
    .toBe(true);
}

function nextTopLevelNavigation(page) {
  return page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
}

test('a waiting worker activates only on confirmation and reloads every old tab', async ({
  page,
  context,
}) => {
  await openControlledApp(page);
  const peer = await context.newPage();
  await openControlledApp(peer);

  const originalWorker = await readFile(SERVICE_WORKER_PATH, 'utf8');
  try {
    await writeFile(
      SERVICE_WORKER_PATH,
      `${originalWorker}\n// playwright-update-${Date.now()}\n`,
      'utf8'
    );
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });

    const banner = page.locator('#update-banner');
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Update now' })).toBeEnabled();

    // The worker remains waiting until the user explicitly accepts it.
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.ready;
          return Boolean(registration.waiting);
        })
      )
      .toBe(true);

    const pageReloaded = nextTopLevelNavigation(page);
    const peerReloaded = nextTopLevelNavigation(peer);
    await page.getByRole('button', { name: 'Update now' }).click();
    await Promise.all([pageReloaded, peerReloaded]);

    await expect
      .poll(() => page.evaluate(() => Boolean(window.__APP_TEST__?.seed)))
      .toBe(true);
    await expect
      .poll(() => peer.evaluate(() => Boolean(window.__APP_TEST__?.seed)))
      .toBe(true);
  } finally {
    await writeFile(SERVICE_WORKER_PATH, originalWorker, 'utf8');
    await peer.close();
  }
});
