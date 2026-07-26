import { expect, test } from '@playwright/test';

async function seed(page) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.locator('#fitness-add-menu-btn')).toBeVisible();
  await page.evaluate(async () => {
    const { addActivity } = await import('/src/features/fitness/activities.js');
    const { addRoutine } = await import('/src/features/fitness/routines.js');
    const a = await addActivity({ name: 'Bench Press', categoryId: 'strength', trackingType: 'sets-reps', muscleGroup: 'Chest' });
    const b = await addActivity({ name: 'Treadmill Run', categoryId: 'cardio', trackingType: 'time' });
    await addRoutine({ name: 'Push Day', activityIds: [a.id] });
    await addRoutine({ name: 'Cardio Day', activityIds: [b.id] });
    await addRoutine({ name: 'Core', activityIds: [a.id, b.id] });
  });
}

async function openBuilder(page) {
  await page.locator('#fitness-add-menu-btn').click();
  await page.locator('[data-action="new-program"]').click();
  await expect(page.locator('#program-builder-modal')).toBeVisible();
}

async function pickForDay(page, day, names) {
  await page.locator(`.program-day-select[data-day-of-week="${day}"]`).click();
  await expect(page.locator('#routine-picker-modal')).toBeVisible();
  for (const n of names) {
    await page.locator('#routine-picker-list .selectable-routine-item').filter({ hasText: n }).click();
  }
  await page.locator('#confirm-routine-picker').click();
  await expect(page.locator('#routine-picker-modal')).toBeHidden();
}

test.describe('program scheduling modes', () => {
  test('mode toggle switches sections and hints', async ({ page }) => {
    await seed(page);
    await openBuilder(page);

    await expect(page.locator('#program-mode-prescriptive')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#program-anytime-section')).toBeHidden();
    await expect(page.locator('#program-schedule-heading')).toHaveText('Weekly schedule');

    await page.locator('#program-mode-freeform').click();
    await expect(page.locator('#program-mode-freeform')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#program-mode-prescriptive')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#program-anytime-section')).toBeVisible();
    await expect(page.locator('#program-schedule-heading')).toHaveText('Pinned to days');
  });

  test('rest day selector mirrors the habits day picker and trims rows', async ({ page }) => {
    await seed(page);
    await openBuilder(page);

    const buttons = page.locator('#program-rest-day-grid .day-button');
    await expect(buttons).toHaveCount(7);
    await expect(buttons.nth(0)).toHaveText('S');
    await expect(buttons.nth(1)).toHaveText('M');
    // Monday-first rows for the seven non-rest days.
    await expect(page.locator('.program-day-select')).toHaveCount(7);

    // Mark Sunday (0) and Saturday (6) as rest.
    await buttons.nth(0).click();
    await buttons.nth(6).click();
    await expect(buttons.nth(0)).toHaveClass(/selected/);
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.program-day-select')).toHaveCount(5);
    await expect(page.locator('.program-day-select[data-day-of-week="0"]')).toHaveCount(0);
    await expect(page.locator('.program-day-select[data-day-of-week="6"]')).toHaveCount(0);

    // Unselecting brings the day back.
    await buttons.nth(0).click();
    await expect(page.locator('.program-day-select')).toHaveCount(6);
  });

  test('a day can hold several routines', async ({ page }) => {
    await seed(page);
    await openBuilder(page);
    await pickForDay(page, 1, ['Push Day', 'Core']);

    const monday = page.locator('.program-day-select[data-day-of-week="1"]');
    await expect(monday).toContainText('Push Day, Core');
    await expect(page.locator('#save-program-builder')).toBeDisabled();
    await page.locator('#program-name-input').fill('Split');
    await expect(page.locator('#save-program-builder')).toBeEnabled();

    await page.locator('#save-program-builder').click();
    await expect(page.locator('#program-builder-modal')).toBeHidden();

    const stored = await page.evaluate(() => {
      const p = window.appData.programs.find((x) => x.active);
      return { mode: p.scheduleMode, days: p.scheduledDays, rest: p.restDays };
    });
    expect(stored.mode).toBe('prescriptive');
    expect(stored.days).toHaveLength(2);
    expect(stored.days.every((d) => d.dayOfWeek === 1)).toBe(true);
  });

  test('marking a day as rest clears the routines pinned to it', async ({ page }) => {
    await seed(page);
    await openBuilder(page);
    await pickForDay(page, 1, ['Push Day']);
    await expect(page.locator('.program-day-select[data-day-of-week="1"]')).toContainText('Push Day');

    await page.locator('#program-rest-day-grid .day-button').nth(1).click();
    await expect(page.locator('.program-day-select[data-day-of-week="1"]')).toHaveCount(0);
    await page.locator('#program-rest-day-grid .day-button').nth(1).click();
    await expect(page.locator('.program-day-select[data-day-of-week="1"]')).toContainText('Rest');
  });

  test('freeform anytime rows carry weekly counts', async ({ page }) => {
    await seed(page);
    await openBuilder(page);
    await page.locator('#program-mode-freeform').click();
    await expect(page.locator('#program-anytime-rows')).toContainText('Nothing added yet');

    await page.locator('#program-add-anytime-btn').click();
    await page.locator('#routine-picker-list .selectable-routine-item').filter({ hasText: 'Core' }).click();
    await page.locator('#confirm-routine-picker').click();

    const row = page.locator('.program-anytime-row').filter({ hasText: 'Core' });
    await expect(row).toBeVisible();
    await expect(row.locator('.anytime-count')).toHaveText('1');
    await expect(page.locator('#program-anytime-count')).toHaveText('1 per week');

    await row.locator('.anytime-step[data-delta="1"]').click();
    await expect(page.locator('.program-anytime-row').filter({ hasText: 'Core' }).locator('.anytime-count')).toHaveText('2');
    await expect(page.locator('#program-anytime-count')).toHaveText('2 per week');

    // Anytime alone is enough to save a flexible program.
    await page.locator('#program-name-input').fill('Flexible');
    await expect(page.locator('#save-program-builder')).toBeEnabled();
    await page.locator('#save-program-builder').click();

    const stored = await page.evaluate(() => {
      const p = window.appData.programs.find((x) => x.active);
      return { mode: p.scheduleMode, anytime: p.anytimeRoutines, days: p.scheduledDays };
    });
    expect(stored.mode).toBe('freeform');
    expect(stored.anytime).toHaveLength(1);
    expect(stored.anytime[0].count).toBe(2);
    expect(stored.days).toHaveLength(0);
  });

  test('stepping an anytime count below one removes the row', async ({ page }) => {
    await seed(page);
    await openBuilder(page);
    await page.locator('#program-mode-freeform').click();
    await page.locator('#program-add-anytime-btn').click();
    await page.locator('#routine-picker-list .selectable-routine-item').filter({ hasText: 'Core' }).click();
    await page.locator('#confirm-routine-picker').click();
    await page.locator('.program-anytime-row .anytime-step[data-delta="-1"]').click();
    await expect(page.locator('#program-anytime-rows')).toContainText('Nothing added yet');
  });

  test('edit mode restores mode, rest days, multi-routine days and anytime', async ({ page }) => {
    await seed(page);
    await openBuilder(page);
    await page.locator('#program-mode-freeform').click();
    await page.locator('#program-rest-day-grid .day-button').nth(0).click();
    await pickForDay(page, 1, ['Push Day', 'Core']);
    await page.locator('#program-add-anytime-btn').click();
    await page.locator('#routine-picker-list .selectable-routine-item').filter({ hasText: 'Cardio Day' }).click();
    await page.locator('#confirm-routine-picker').click();
    await page.locator('.program-anytime-row .anytime-step[data-delta="1"]').click();
    await page.locator('#program-name-input').fill('Mixed');
    await page.locator('#save-program-builder').click();
    await expect(page.locator('#program-tile')).toContainText('Mixed');

    await page.locator('#program-tile').click();
    await expect(page.locator('#program-builder-title')).toHaveText('Edit Program');
    await expect(page.locator('#program-mode-freeform')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#program-rest-day-grid .day-button').nth(0)).toHaveClass(/selected/);
    await expect(page.locator('.program-day-select[data-day-of-week="1"]')).toContainText('Push Day, Core');
    await expect(page.locator('.program-anytime-row').filter({ hasText: 'Cardio Day' }).locator('.anytime-count')).toHaveText('2');
    await expect(page.locator('#program-add-today-btn')).toBeVisible();
  });
});

test.describe('add to day and the preload preference', () => {
  async function makeTodayProgram(page) {
    const weekday = await page.evaluate(() => new Date().getUTCDay());
    await openBuilder(page);
    await pickForDay(page, weekday, ['Push Day']);
    await page.locator('#program-name-input').fill('Today Plan');
    await page.locator('#save-program-builder').click();
    await expect(page.locator('#program-builder-modal')).toBeHidden();
  }

  test('nothing is recorded automatically while the preference is off', async ({ page }) => {
    await seed(page);
    await makeTodayProgram(page);
    expect(await page.evaluate(() => Object.values(window.appData.recordedActivities).flat().length)).toBe(0);
  });

  test('the dropdown item records the day\'s scheduled routines', async ({ page }) => {
    await seed(page);
    await makeTodayProgram(page);

    await page.locator('#fitness-add-menu-btn').click();
    await page.locator('[data-action="add-program-day"]').click();

    await expect(page.locator('#activities-list')).toContainText('Bench Press');
    expect(await page.evaluate(() => Object.values(window.appData.recordedActivities).flat().length)).toBe(1);

    // Running it again refuses rather than doubling up.
    await page.locator('#fitness-add-menu-btn').click();
    await page.locator('[data-action="add-program-day"]').click();
    await expect(page.locator('#global-confirm-modal')).toContainText('Already Logged');
    expect(await page.evaluate(() => Object.values(window.appData.recordedActivities).flat().length)).toBe(1);
  });

  test('with no program scheduled for the day it explains itself', async ({ page }) => {
    await seed(page);
    await page.locator('#fitness-add-menu-btn').click();
    await page.locator('[data-action="add-program-day"]').click();
    await expect(page.locator('#global-confirm-modal')).toContainText('Nothing Scheduled');
  });

  test('the builder button adds the current day', async ({ page }) => {
    await seed(page);
    await makeTodayProgram(page);
    await page.locator('#program-tile').click();
    await expect(page.locator('#program-add-today-btn')).toBeVisible();
    await page.locator('#program-add-today-btn').click();
    await expect(page.locator('#program-builder-modal')).toBeHidden();
    await expect(page.locator('#activities-list')).toContainText('Bench Press');
  });

  test('turning the preference on preloads the day when it is opened', async ({ page }) => {
    await seed(page);
    await makeTodayProgram(page);

    await page.evaluate(async () => {
      const { dispatch, Actions } = await import('/src/core/state.js');
      await dispatch(Actions.updateSettings({ programPreload: true }));
    });

    // Move away and back so the day is "opened" again.
    await page.evaluate(async () => {
      const { dispatch, Actions, getState } = await import('/src/core/state.js');
      const today = getState().fitnessSelectedDate;
      const next = new Date(Date.parse(today.slice(0, 10) + 'T00:00:00Z') + 86400000)
        .toISOString()
        .slice(0, 10);
      await dispatch(Actions.setFitnessSelectedDate(next + 'T00:00:00.000'));
      await dispatch(Actions.setFitnessSelectedDate(today));
    });

    await expect(page.locator('#activities-list')).toContainText('Bench Press');
  });

  test('the profile exposes the preference', async ({ page }) => {
    await page.goto('/?test=true');
    await page.getByRole('tab', { name: 'Profile view' }).click();
    const toggle = page.locator('[data-setting="programPreload"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(() => window.appData.settings.programPreload)).toBe(true);
  });
});
