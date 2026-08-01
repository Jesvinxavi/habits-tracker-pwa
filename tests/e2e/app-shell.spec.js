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

test('a date picked before the deferred chunk lands is not snapped back to today', async ({
  page,
}) => {
  // The rollover watcher rides the deferred idle chunk, so it arrives at an
  // unpredictable point after boot. Holding it back reproduces, deterministically,
  // the ordering a loaded machine produces on its own: the user picks an earlier
  // date first, and the watcher only starts afterwards.
  await page.route('**/src/features/autoToday.js*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  await page.goto('/?test=true');
  await expect(page.locator('#home-view')).toBeVisible();

  const earlier = await page.evaluate(async () => {
    const { dispatch, Actions, getState } = await import('/src/core/state.js');
    const previous = new Date(`${getState().selectedDate.slice(0, 10)}T12:00:00`);
    previous.setDate(previous.getDate() - 1);
    const key = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-${String(previous.getDate()).padStart(2, '0')}T00:00:00.000`;
    await dispatch(Actions.setSelectedDate(key));
    return key;
  });

  // Let the watcher arrive and run its first pass.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .some((entry) => entry.name.includes('autoToday.js'))
        ),
      { timeout: 10000 }
    )
    .toBe(true);
  await page.waitForTimeout(250);

  expect(await page.evaluate(() => window.__APP_TEST__.getState().selectedDate)).toBe(earlier);
});
