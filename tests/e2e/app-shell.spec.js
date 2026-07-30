import { expect, test } from '@playwright/test';

test('loads the PWA application shell', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Healthy Habits/i);
  await expect(page.locator('body')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__APP_TEST__?.seed)))
    .toBe(true);
  expect(
    await page.evaluate(async () => ({
      legacySnapshot: localStorage.getItem('healthyHabitsData'),
      legacyDatabase: indexedDB.databases
        ? (await indexedDB.databases()).some((database) => database.name === 'healthyHabitsDB')
        : false,
    }))
  ).toEqual({ legacySnapshot: null, legacyDatabase: false });
});

test('keeps the current page visible until a lazy page is ready', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/src/features/fitness/FitnessModule.js*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });

  await page.goto('/');
  const homeView = page.locator('#home-view');
  const fitnessView = page.locator('#fitness-view');
  const fitnessTab = page.getByRole('tab', { name: 'Fitness view' });

  await expect(page.locator('#app-loading-screen')).toHaveCount(0);
  await expect(homeView).toBeVisible();
  await fitnessTab.click();

  await expect(fitnessTab).toHaveAttribute('aria-busy', 'true');
  await expect(homeView).toBeVisible();
  await expect(fitnessView).toBeHidden();

  await expect(fitnessView).toBeVisible();
  await expect(fitnessView.getByRole('heading', { name: 'Fitness' })).toBeVisible();
  await expect(homeView).toBeHidden();
  await expect(fitnessTab).toHaveAttribute('aria-busy', 'false');
});
