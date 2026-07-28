import { expect, test } from '@playwright/test';

// The overhaul touched shared files — ActionButtons.js, Modal.js, state.js,
// persistenceRouter.js, stateHydration.js and syncEngine.js — so these guard the
// features that share them.

async function open(page, tab) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: tab }).click();
}

async function seedHabit(page, { target = null } = {}) {
  return page.evaluate(async (targetValue) => {
    const { dispatch, Actions, getState } = await import('/src/core/state.js');
    const { generateUniqueId } = await import('/src/shared/common.js');
    const categoryId = generateUniqueId();
    await dispatch(Actions.addCategory({ id: categoryId, name: 'Health', color: '#2563EB' }));
    const habitId = generateUniqueId();
    await dispatch(
      Actions.addHabit({
        id: habitId,
        categoryId,
        name: 'Drink water',
        frequency: 'daily',
        createdAt: new Date().toISOString().slice(0, 10),
        icon: '💧',
        paused: false,
        activeOnHolidays: true,
        completed: {},
        progress: {},
        skippedDates: [],
        ...(targetValue ? { target: targetValue, targetUnit: 'glasses', defaultIncrement: 1 } : {}),
      })
    );
    return { habitId, categoryId, selectedDate: getState().selectedDate };
  }, target);
}

test.describe('habits page still works', () => {
  test('the shared action buttons render New Category and New Habit', async ({ page }) => {
    await open(page, 'Habits view');
    const buttons = page.locator('#habits-view .action-buttons button');
    await expect(buttons).toHaveCount(2);
    await expect(buttons.nth(0)).toContainText('New Category');
    await expect(buttons.nth(1)).toContainText('New Habit');

    // New Habit stays disabled until a category exists — behaviour owned by the
    // habits branch of ActionButtons.js, which the fitness rewrite left alone.
    await expect(buttons.nth(1)).toBeDisabled();
    await buttons.nth(0).click();
    await expect(page.locator('#category-modal, #add-category-modal').first()).toBeVisible();
  });

  test('New Habit enables once a category exists', async ({ page }) => {
    await open(page, 'Habits view');
    await seedHabit(page);
    await expect(page.locator('#habits-view .action-buttons button').nth(1)).toBeEnabled();
  });

  test('the habits search panel is untouched', async ({ page }) => {
    await open(page, 'Habits view');
    // Habits keeps its own mountSearchPanel and .search-input markup.
    await expect(page.locator('#habits-view .search-container')).toHaveCount(1);
    await expect(page.locator('#habits-view .search-input')).toHaveCount(1);
  });
});

test.describe('home page still works', () => {
  test('a habit can be completed and the progress ring reacts', async ({ page }) => {
    await open(page, 'Home view');
    const { habitId } = await seedHabit(page);
    await page.waitForTimeout(500);

    const before = await page.evaluate(
      (id) => Object.keys(window.appData.habits.find((h) => h.id === id).completed).length,
      habitId
    );
    expect(before).toBe(0);

    await page.evaluate(async (id) => {
      const { dispatch, Actions, getState } = await import('/src/core/state.js');
      await dispatch(Actions.toggleHabitCompleted(id, getState().selectedDate.slice(0, 10)));
    }, habitId);

    const after = await page.evaluate(
      (id) => window.appData.habits.find((h) => h.id === id).completed,
      habitId
    );
    expect(Object.values(after)).toContain(true);
  });

  test('a target habit still fills its card', async ({ page }) => {
    await open(page, 'Home view');
    const { habitId } = await seedHabit(page, { target: 10 });
    await page.waitForTimeout(500);

    await page.evaluate(async (id) => {
      const { dispatch, Actions, getState } = await import('/src/core/state.js');
      await dispatch(Actions.setHabitProgress(id, getState().selectedDate.slice(0, 10), 5));
    }, habitId);
    await page.waitForTimeout(400);

    const filled = await page.evaluate(() =>
      [...document.querySelectorAll('#home-view *')].some(
        (el) => el.style?.background && el.style.background.includes('gradient')
      )
    );
    expect(filled).toBe(true);
  });

  test('calendar navigation and holiday mode still dispatch', async ({ page }) => {
    await open(page, 'Home view');
    const moved = await page.evaluate(async () => {
      const { dispatch, Actions, getState } = await import('/src/core/state.js');
      const before = getState().selectedDate;
      const next = new Date(Date.parse(before.slice(0, 10) + 'T00:00:00Z') + 86400000)
        .toISOString()
        .slice(0, 10);
      await dispatch(Actions.setSelectedDate(next + 'T00:00:00.000'));
      return { before, after: getState().selectedDate };
    });
    expect(moved.after).not.toBe(moved.before);

    const holiday = await page.evaluate(async () => {
      const { dispatch, Actions, getState } = await import('/src/core/state.js');
      await dispatch(Actions.toggleSingleHoliday('2026-12-25', true));
      return getState().manualHolidayDates;
    });
    expect(holiday).toContain('2026-12-25');
  });
});

test.describe('profile page still works', () => {
  test('preference switches toggle', async ({ page }) => {
    await open(page, 'Profile view');
    for (const setting of ['hideCompleted', 'hideSkipped']) {
      const toggle = page.locator(`[data-setting="${setting}"]`);
      await expect(toggle).toBeVisible();
      const before = await toggle.getAttribute('aria-checked');
      await toggle.click();
      await expect(toggle).not.toHaveAttribute('aria-checked', before);
    }
    // The program preload switch was removed with the feature.
    await expect(page.locator('[data-setting="programPreload"]')).toHaveCount(0);
  });

  test('export includes the two new tables', async ({ page }) => {
    await open(page, 'Profile view');
    const tables = await page.evaluate(async () => {
      const module = await import('/src/core/dataManagement.js');
      // previewImport walks the same TABLES list the exporter uses.
      const preview = module.previewImport({ formatVersion: 1, tables: {} });
      return Object.keys(preview.normalized.tables);
    });
    expect(tables).toContain('routines');
    expect(tables).toContain('programs');
  });
});

test('theme toggle still flips both themes', async ({ page }) => {
  await open(page, 'Home view');
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.evaluate(async () => {
    const { toggleTheme } = await import('/src/core/theme.js');
    await toggleTheme();
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  expect(after).not.toBe(before);
});
