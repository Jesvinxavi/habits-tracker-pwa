import { expect, test } from '@playwright/test';
import { expandAllActivityPickerCategories } from './helpers/activityPicker.js';

async function seed(page) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.locator('#fitness-routines-btn')).toBeVisible();
  await page.evaluate(async () => {
    const { addActivity } = await import('/src/features/fitness/activities.js');
    await addActivity({ name: 'Treadmill Run', categoryId: 'cardio', trackingType: 'time' });
    await addActivity({ name: 'Cycling', categoryId: 'cardio', trackingType: 'time' });
    await addActivity({
      name: 'Bench Press',
      categoryId: 'strength',
      trackingType: 'sets-reps',
      muscleGroup: 'Chest',
    });
  });
}

test('builder shows only selected activities and delegates picking', async ({ page }) => {
  await seed(page);
  await page.locator('#fitness-routines-btn').click();
  await page.locator('#new-routine-btn').click();

  // No embedded grouped list or filter any more.
  await expect(page.locator('#routine-activity-picker')).toHaveCount(0);
  await expect(page.locator('#routine-activity-filter')).toHaveCount(0);
  await expect(page.locator('#routine-selected-list')).toContainText('No activities yet');
  await expect(page.locator('#routine-add-activities-btn')).toBeVisible();
  await expect(page.locator('#save-routine-builder')).toBeDisabled();

  // Add activities opens the multi-select picker above the builder.
  await page.locator('#routine-add-activities-btn').click();
  await expect(page.locator('#activity-picker-modal')).toBeVisible();
  await expect(page.locator('#routine-builder-modal')).toBeVisible();
  await expect(page.locator('#activity-picker-title')).toHaveText('Select Activities');
  await expect(page.locator('#confirm-activity-picker')).toHaveText('Done');
  const z = await page.evaluate(() => ({
    builder: Number(getComputedStyle(document.querySelector('#routine-builder-modal')).zIndex),
    picker: Number(getComputedStyle(document.querySelector('#activity-picker-modal')).zIndex),
  }));
  expect(z.picker).toBeGreaterThan(z.builder);
  await expandAllActivityPickerCategories(page);

  await page
    .locator('#activity-picker-list .selectable-activity-item')
    .filter({ hasText: 'Bench Press' })
    .click();
  await page
    .locator('#activity-picker-list .selectable-activity-item')
    .filter({ hasText: 'Cycling' })
    .click();
  await page.locator('#confirm-activity-picker').click();

  await expect(page.locator('#activity-picker-modal')).toBeHidden();
  const rows = page.locator('.routine-selected-item');
  await expect(rows).toHaveCount(2);
  // Selection order is routine order.
  await expect(rows.nth(0)).toContainText('Bench Press');
  await expect(rows.nth(1)).toContainText('Cycling');
  await expect(page.locator('#routine-selection-count')).toHaveText('2 selected');

  // Activities alone are not enough; the name is still required.
  await expect(page.locator('#save-routine-builder')).toBeDisabled();
  await page.locator('#routine-name-input').fill('Push Day');
  await expect(page.locator('#save-routine-builder')).toBeEnabled();
});

test('rows can be removed and the picker reopens with the current selection', async ({ page }) => {
  await seed(page);
  await page.locator('#fitness-routines-btn').click();
  await page.locator('#new-routine-btn').click();
  await page.locator('#routine-add-activities-btn').click();
  await expandAllActivityPickerCategories(page);
  await page
    .locator('#activity-picker-list .selectable-activity-item')
    .filter({ hasText: 'Treadmill Run' })
    .click();
  await page
    .locator('#activity-picker-list .selectable-activity-item')
    .filter({ hasText: 'Bench Press' })
    .click();
  await page.locator('#confirm-activity-picker').click();
  await expect(page.locator('.routine-selected-item')).toHaveCount(2);

  // Reopening shows the existing picks already ticked.
  await page.locator('#routine-add-activities-btn').click();
  await expect(page.locator('#activity-picker-count')).toHaveText('2 selected');
  await expect(
    page
      .locator('#activity-picker-list .selectable-activity-item')
      .filter({ hasText: 'Treadmill Run' })
  ).toHaveAttribute('aria-checked', 'true');
  await page.locator('#cancel-activity-picker').click();
  await expect(page.locator('.routine-selected-item')).toHaveCount(2);

  // Remove one row.
  await page
    .locator('.routine-selected-item')
    .filter({ hasText: 'Treadmill Run' })
    .locator('.routine-remove-activity')
    .click();
  await expect(page.locator('.routine-selected-item')).toHaveCount(1);
  await expect(page.locator('#routine-selection-count')).toHaveText('1 selected');

  await page.locator('#routine-name-input').fill('Trimmed');
  await page.locator('#save-routine-builder').click();
  await expect(page.locator('.routine-card')).toContainText('1 activity');
});

test('edit mode lists the saved activities in order', async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => {
    const { getState } = await import('/src/core/state.js');
    const { addRoutine } = await import('/src/features/fitness/routines.js');
    const byName = (name) => getState().activities.find((a) => a.name === name).id;
    await addRoutine({
      name: 'Saved',
      activityIds: [byName('Bench Press'), byName('Treadmill Run')],
    });
  });
  await page.locator('#fitness-routines-btn').click();
  await page.locator('.routine-card').click();
  await expect(page.locator('#routine-builder-title')).toHaveText('Edit Routine');
  const rows = page.locator('.routine-selected-item');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Bench Press');
  await expect(rows.nth(1)).toContainText('Treadmill Run');
});
