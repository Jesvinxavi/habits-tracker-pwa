import { expect, test } from '@playwright/test';

async function seed(page) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.locator('#fitness-add-menu-btn')).toBeVisible();
  await page.evaluate(async () => {
    const { addActivity } = await import('/src/features/fitness/activities.js');
    await addActivity({ name: 'Treadmill Run', categoryId: 'cardio', trackingType: 'time' });
    await addActivity({ name: 'Cycling', categoryId: 'cardio', trackingType: 'time' });
    await addActivity({ name: 'Bench Press', categoryId: 'strength', trackingType: 'sets-reps', muscleGroup: 'Chest' });
  });
}

async function makeRoutine(page, name, activityNames) {
  await page.locator('#fitness-routines-btn').click();
  await page.locator('#new-routine-btn').click();
  await page.locator('#routine-name-input').fill(name);
  await page.locator('#routine-add-activities-btn').click();
  for (const n of activityNames) {
    await page.locator('#activity-picker-list .selectable-activity-item').filter({ hasText: n }).first().click();
  }
  await page.locator('#confirm-activity-picker').click();
  await page.locator('#save-routine-builder').click();
  await expect(page.locator('#routine-builder-modal')).toBeHidden();
  await page.locator('#close-routines-modal').click();
  await expect(page.locator('#routines-modal')).toBeHidden();
}

async function openMenu(page, action) {
  await page.locator('#fitness-add-menu-btn').click();
  await page.locator(`[data-action="${action}"]`).click();
}

const tile = (page, name) =>
  page.locator('#activity-picker-list .selectable-activity-item').filter({ hasText: name }).first();

test.describe('add-activity picker', () => {
  test('is a selection surface with no stats or edit buttons', async ({ page }) => {
    await seed(page);
    await openMenu(page, 'add-activity');

    await expect(page.locator('#activity-picker-modal')).toBeVisible();
    // Not the library.
    await expect(page.locator('#activity-library-modal')).toBeHidden();
    await expect(page.locator('#activity-picker-list .stats-btn')).toHaveCount(0);
    await expect(page.locator('#activity-picker-list .edit-activity-btn')).toHaveCount(0);
    await expect(page.locator('#activity-picker-list .selection-indicator')).toHaveCount(3);

    const add = page.locator('#confirm-activity-picker');
    await expect(add).toBeDisabled();
    await expect(page.locator('#activity-picker-count')).toHaveText('0 selected');
  });

  test('tapping a tile selects it instead of recording', async ({ page }) => {
    await seed(page);
    await openMenu(page, 'add-activity');

    const cycling = tile(page, 'Cycling');
    await expect(cycling).toHaveAttribute('aria-checked', 'false');
    await cycling.click();

    // No details modal, nothing recorded yet.
    await expect(page.locator('#activity-details-modal')).toBeHidden();
    expect(await page.evaluate(() => Object.values(window.appData.recordedActivities).flat().length)).toBe(0);

    const selected = tile(page, 'Cycling');
    await expect(selected).toHaveAttribute('aria-checked', 'true');
    await expect(selected).toHaveClass(/(^|\s)ring-2(\s|$)/);
    await expect(selected.locator('.selection-indicator .material-icons')).toBeVisible();
    await expect(page.locator('#activity-picker-count')).toHaveText('1 selected');
    await expect(page.locator('#confirm-activity-picker')).toBeEnabled();

    await selected.click();
    await expect(tile(page, 'Cycling')).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('#activity-picker-count')).toHaveText('0 selected');
    await expect(page.locator('#confirm-activity-picker')).toBeDisabled();
  });

  test('adds several activities at once with no metric pills', async ({ page }) => {
    await seed(page);
    await openMenu(page, 'add-activity');

    await tile(page, 'Treadmill Run').click();
    await tile(page, 'Cycling').click();
    await tile(page, 'Bench Press').click();
    await expect(page.locator('#activity-picker-count')).toHaveText('3 selected');
    await page.locator('#confirm-activity-picker').click();

    await expect(page.locator('#activity-picker-modal')).toBeHidden();
    const list = page.locator('#activities-list');
    await expect(list).toContainText('Treadmill Run');
    await expect(list).toContainText('Cycling');
    await expect(list).toContainText('Bench Press');

    const recorded = await page.evaluate(() =>
      Object.values(window.appData.recordedActivities).flat().map((r) => ({
        name: r.activityName, duration: r.duration, sets: r.sets ?? null,
      }))
    );
    expect(recorded).toHaveLength(3);
    recorded.forEach((r) => {
      expect(r.duration == null).toBeTruthy();
      expect(r.sets == null).toBeTruthy();
    });
  });

  test('filtering keeps selections', async ({ page }) => {
    await seed(page);
    await openMenu(page, 'add-activity');
    await tile(page, 'Cycling').click();
    await page.locator('#activity-picker-filter').fill('bench');
    await expect(page.locator('#activity-picker-list')).not.toContainText('Cycling');
    await expect(page.locator('#activity-picker-count')).toHaveText('1 selected');
    await page.locator('#activity-picker-filter').fill('');
    await expect(tile(page, 'Cycling')).toHaveAttribute('aria-checked', 'true');
  });

  test('rest day blocks the batch', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
      const { toggleRestDay } = await import('/src/features/fitness/restDays.js');
      const { getState } = await import('/src/core/state.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      await toggleRestDay(getLocalISODate(getState().fitnessSelectedDate));
    });
    await openMenu(page, 'add-activity');
    await tile(page, 'Cycling').click();
    await page.locator('#confirm-activity-picker').click();

    await expect(page.locator('#global-confirm-modal')).toContainText('Rest Day');
    expect(await page.evaluate(() => Object.values(window.appData.recordedActivities).flat().length)).toBe(0);
  });

  test('the Activity button still opens the full library', async ({ page }) => {
    await seed(page);
    await page.locator('#fitness-activity-btn').click();
    await expect(page.locator('#activity-library-modal')).toBeVisible();
    await expect(page.locator('#activity-picker-modal')).toBeHidden();
    // Stats and edit remain there.
    await expect(page.locator('#activity-library-content .stats-btn').first()).toBeVisible();
    await expect(page.locator('#activity-library-content .edit-activity-btn').first()).toBeVisible();
  });
});

test.describe('add-routine picker', () => {
  test('supports selecting multiple routines', async ({ page }) => {
    await seed(page);
    await makeRoutine(page, 'Cardio Day', ['Treadmill Run', 'Cycling']);
    await makeRoutine(page, 'Push Day', ['Bench Press']);
    await openMenu(page, 'add-routine');

    await expect(page.locator('#routine-picker-modal')).toBeVisible();
    const cards = page.locator('#routine-picker-list .selectable-routine-item');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('#routine-picker-list .selection-indicator')).toHaveCount(2);
    await expect(page.locator('#routine-picker-list .edit-routine-btn')).toHaveCount(0);

    const add = page.locator('#confirm-routine-picker');
    await expect(add).toBeDisabled();

    await cards.filter({ hasText: 'Cardio Day' }).click();
    await expect(page.locator('#routine-picker-count')).toHaveText('1 selected');
    const first = page.locator('#routine-picker-list .selectable-routine-item').filter({ hasText: 'Cardio Day' });
    await expect(first).toHaveAttribute('aria-checked', 'true');
    await expect(first).toHaveClass(/(^|\s)ring-2(\s|$)/);

    await page.locator('#routine-picker-list .selectable-routine-item').filter({ hasText: 'Push Day' }).click();
    await expect(page.locator('#routine-picker-count')).toHaveText('2 selected');
    await expect(add).toBeEnabled();

    await add.click();
    await expect(page.locator('#routine-picker-modal')).toBeHidden();

    // Every activity across both routines is recorded once.
    const recorded = await page.evaluate(() =>
      Object.values(window.appData.recordedActivities).flat().map((r) => r.activityName).sort()
    );
    expect(recorded).toEqual(['Bench Press', 'Cycling', 'Treadmill Run']);
  });

  test('deselecting works and a rest day shows one dialog for the batch', async ({ page }) => {
    await seed(page);
    await makeRoutine(page, 'Cardio Day', ['Treadmill Run']);
    await makeRoutine(page, 'Push Day', ['Bench Press']);
    await page.evaluate(async () => {
      const { toggleRestDay } = await import('/src/features/fitness/restDays.js');
      const { getState } = await import('/src/core/state.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      await toggleRestDay(getLocalISODate(getState().fitnessSelectedDate));
    });

    await openMenu(page, 'add-routine');
    const cards = page.locator('#routine-picker-list .selectable-routine-item');
    await cards.filter({ hasText: 'Cardio Day' }).click();
    await cards.filter({ hasText: 'Push Day' }).click();
    await expect(page.locator('#routine-picker-count')).toHaveText('2 selected');

    // Deselect one.
    await page.locator('#routine-picker-list .selectable-routine-item').filter({ hasText: 'Push Day' }).click();
    await expect(page.locator('#routine-picker-count')).toHaveText('1 selected');

    await page.locator('#confirm-routine-picker').click();
    await expect(page.locator('#global-confirm-modal')).toContainText('Rest Day');
    // Exactly one dialog, not one per routine.
    await expect(page.locator('#global-confirm-modal')).toHaveCount(1);
    expect(await page.evaluate(() => Object.values(window.appData.recordedActivities).flat().length)).toBe(0);
  });

  test('empty state still offers to create a routine', async ({ page }) => {
    await seed(page);
    await openMenu(page, 'add-routine');
    await expect(page.locator('#routine-picker-list')).toContainText('No routines saved');
    await page.locator('#picker-create-routine-btn').click();
    await expect(page.locator('#routine-picker-modal')).toBeHidden();
    await expect(page.locator('#routine-builder-modal')).toBeVisible();
  });
});
