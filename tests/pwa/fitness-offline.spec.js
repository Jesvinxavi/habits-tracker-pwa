import { expect, test } from '@playwright/test';

async function openControlledApp(page) {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
}

test('precache keeps lazy Fitness dialogs available offline', async ({ page, context }) => {
  await openControlledApp(page);

  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.getByRole('heading', { name: 'Fitness' })).toBeVisible();

  await context.setOffline(true);
  try {
    await page.getByRole('button', { name: 'Open activities' }).click();
    await expect(page.locator('#activity-library-modal')).toBeVisible();
    await page.getByRole('button', { name: 'Create a new activity' }).click();
    await expect(page.locator('#add-activity-modal')).toBeVisible();
    await page.locator('#cancel-add-activity').click();
    await page.locator('#close-activity-library').click();

    await page.getByRole('button', { name: 'Open routines' }).click();
    await expect(page.locator('#routines-modal')).toBeVisible();
    await page.locator('#new-routine-btn').click();
    await expect(page.locator('#routine-builder-modal')).toBeVisible();
    await page.locator('#cancel-routine-builder').click();
    await page.locator('#close-routines-modal').click();

    await page.getByRole('button', { name: 'Open timer' }).click();
    await expect(page.locator('#timer-modal')).toBeVisible();
    await page.locator('#close-timer-modal').click();
  } finally {
    await context.setOffline(false);
  }
});

test('icons and habit reordering stay available without third-party network access', async ({
  page,
  context,
}) => {
  const thirdPartyRequests = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4190/')) {
      thirdPartyRequests.push(request.url());
    }
  });
  await openControlledApp(page);
  await page.evaluate(() =>
    window.__APP_TEST__.seed({
      categories: [
        { id: 'health', name: 'Health', color: '#2563EB' },
      ],
      habits: [
        {
          id: 'walk',
          categoryId: 'health',
          name: 'Walk',
          frequency: 'daily',
          createdAt: '2026-07-30',
          icon: '🚶',
          paused: false,
          activeOnHolidays: true,
          completed: {},
          progress: {},
          skippedDates: [],
        },
      ],
    })
  );

  await context.setOffline(true);
  try {
    await page.getByRole('tab', { name: 'Habits view' }).click();
    await expect(
      page.getByRole('heading', { name: 'Habits', exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Reorder' }).click();
    await expect(page.locator('body')).toHaveClass(/reorder-mode/);
    await expect(page.locator('.category-drag-handle')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.fonts.check('24px "Material Icons"'))
      )
      .toBe(true);
  } finally {
    await context.setOffline(false);
  }

  expect(thirdPartyRequests).toEqual([]);
});
