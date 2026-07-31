import { expect, test } from '@playwright/test';

/**
 * Seeds a small but complete account: a daily habit with a real record, a
 * skipped day, and one timed session.
 * @param {import('@playwright/test').Page} page The page.
 * @returns {Promise<void>}
 */
async function seedAccount(page) {
  await page.evaluate(() => {
    const iso = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const ago = (days) => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date;
    };

    const completed = {};
    for (let day = 1; day <= 40; day += 1) {
      if (day === 3) continue; // left for the skip below
      completed[iso(ago(day))] = day % 6 !== 0;
    }

    window.__APP_TEST__.seed({
      categories: [{ id: 'cat-health', name: 'Health', color: '#34C759' }],
      habits: [
        {
          id: 'habit-meditate',
          name: 'Meditate',
          categoryId: 'cat-health',
          icon: '🧘',
          paused: false,
          activeOnHolidays: false,
          frequency: 'daily',
          createdAt: `${iso(ago(40))}T00:00:00.000`,
          completed,
          skippedDates: [iso(ago(3))],
          sortOrder: 0,
        },
      ],
      activityCategories: [
        { id: 'cat-cardio', name: 'Cardio', color: '#FF3B30', icon: '🏃', isSystemDefault: true, sortOrder: 0 },
      ],
      activities: [
        {
          id: 'act-run',
          name: 'Running',
          categoryId: 'cat-cardio',
          icon: '🏃',
          trackingType: 'time',
          createdAt: `${iso(ago(40))}T00:00:00.000`,
        },
      ],
      recordedActivities: {
        [iso(ago(2))]: [
          {
            id: 'rec-1',
            activityId: 'act-run',
            activityName: 'Running',
            categoryId: 'cat-cardio',
            date: iso(ago(2)),
            timestamp: ago(2).toISOString(),
            duration: 1.5,
            durationUnit: 'hours',
            intensity: 'moderate',
            notes: '',
          },
        ],
      },
    });
  });
}

test.describe('statistics surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=true');
    await page.waitForFunction(() => Boolean(window.__APP_TEST__?.seed));
    await seedAccount(page);
  });

  test('the Stats page groups its figures into labelled sections', async ({ page }) => {
    await page.getByRole('tab', { name: 'Stats view' }).click();
    const container = page.locator('#stats-container');
    await expect(container).toBeVisible();

    await expect(container.getByText('Overview', { exact: true })).toBeVisible();
    await expect(container.getByText('Reliability', { exact: true })).toBeVisible();
    await expect(container.getByText('Completed today', { exact: true })).toBeVisible();

    // The fitness half is reachable and reports the session that was seeded.
    await page.locator('#fitness-toggle').click();
    await expect(container.getByText('Training', { exact: true })).toBeVisible();
    // Ninety minutes, not the sixty a truncated decimal would have banked.
    await expect(container).toContainText('1h 30m');
  });

  test('a long habit list shows its ends, says so, and keeps the rest reachable', async ({
    page,
  }) => {
    await page.evaluate(() => {
      const iso = (date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const ago = (days) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
      };

      // Twenty habits spanning a genuine range of reliability.
      const habits = Array.from({ length: 20 }, (_, index) => {
        const completed = {};
        for (let day = 1; day <= 60; day += 1) {
          completed[iso(ago(day))] = day % Math.max(2, index + 2) !== 0;
        }
        return {
          id: `habit-${index}`,
          name: `Habit ${index}`,
          categoryId: 'cat-health',
          icon: '🔵',
          paused: false,
          activeOnHolidays: false,
          frequency: 'daily',
          createdAt: `${iso(ago(60))}T00:00:00.000`,
          completed,
          skippedDates: [],
          sortOrder: index,
        };
      });

      window.__APP_TEST__.seed({
        categories: [{ id: 'cat-health', name: 'Health', color: '#34C759' }],
        habits,
      });
    });

    await page.getByRole('tab', { name: 'Stats view' }).click();
    const section = page
      .locator('#stats-container section')
      .filter({ hasText: 'Habit by habit' });

    // Six rows on screen out of twenty, and the count is stated rather than
    // leaving the list looking complete.
    await expect(section.locator('.comparison-row')).toHaveCount(20);
    await expect(section.locator('details .comparison-row')).toHaveCount(14);
    await expect(section).toContainText('20 habits');

    // The remainder is one tap away, not lost.
    const disclosure = section.locator('summary');
    await expect(disclosure).toContainText('Show the other 14');
    await disclosure.click();
    await expect(section.locator('details')).toHaveAttribute('open', '');
    await expect(section.locator('details .comparison-row').first()).toBeVisible();
  });

  test('the habit statistics modal behaves like every other dialog', async ({ page }) => {
    await page.getByRole('tab', { name: 'Habits view' }).click();
    await page.locator('.stats-habit-btn[data-habit-id="habit-meditate"]').click();

    const modal = page.locator('#habit-stats-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');

    // It joins the modal stack rather than picking its own layer, so a dialog
    // opened over it would land on top rather than behind.
    await expect(modal).toHaveJSProperty('style.zIndex', '1001');

    // Focus is inside the dialog, not left on the page behind it.
    expect(
      await page.evaluate(() =>
        Boolean(document.getElementById('habit-stats-modal')?.contains(document.activeElement))
      )
    ).toBe(true);

    // A skipped day is reported on its own terms, not as a failure.
    await expect(modal).toContainText('Times skipped');
    await expect(modal).toContainText('Streaks');

    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
  });

  test('a habit name cannot inject markup into its own statistics', async ({ page }) => {
    await page.evaluate(() => {
      const state = window.__APP_TEST__.getState();
      window.__APP_TEST__.seed({
        ...state,
        habits: state.habits.map((habit) => ({
          ...habit,
          name: '<img src=x onerror="window.__XSS__=true">',
        })),
      });
    });

    await page.getByRole('tab', { name: 'Habits view' }).click();
    await page.locator('.stats-habit-btn[data-habit-id="habit-meditate"]').click();
    await expect(page.locator('#habit-stats-modal')).toBeVisible();

    expect(await page.evaluate(() => window.__XSS__)).toBeUndefined();
    await expect(page.locator('#habit-stats-modal img')).toHaveCount(0);
  });

  test('the activity statistics modal opens from the details view', async ({ page }) => {
    await page.getByRole('tab', { name: 'Fitness view' }).click();
    await page.locator('#fitness-activity-btn').click();
    // The library groups activities under collapsible categories, so the
    // category has to be opened before its activities can be tapped.
    await page.locator('.search-expand-btn[data-category-id="cat-cardio"]').click();
    await page.locator('[data-activity-id="act-run"]').click();
    await expect(page.locator('#activity-info-modal')).toBeVisible();

    await page.locator('#activity-info-stats-btn').click();
    const modal = page.locator('#activity-stats-modal');
    await expect(modal).toBeVisible();

    await expect(modal).toContainText('Personal bests');
    // The full ninety minutes, and no dialog blaming the network.
    await expect(modal).toContainText('1h 30m');
    await expect(page.locator('#global-confirm-modal')).toBeHidden();
  });
});
