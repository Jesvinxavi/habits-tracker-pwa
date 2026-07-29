import { expect, test } from '@playwright/test';

test('routine-added card accepts metrics and shows pills', async ({ page }) => {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await page.locator('#fitness-add-menu-btn').waitFor();
  await page.evaluate(async () => {
    const { addActivity } = await import('/src/features/fitness/activities.js');
    await addActivity({ name: 'Treadmill Run', categoryId: 'cardio', trackingType: 'time', units: 'minutes' });
  });

  // Build a routine and record it for today.
  await page.locator('#fitness-routines-btn').click();
  await page.locator('#new-routine-btn').click();
  await page.locator('#routine-name-input').fill('Cardio');
  await page.locator('#routine-add-activities-btn').click();
  await page.locator('#activity-picker-list .selectable-activity-item').first().click();
  await page.locator('#confirm-activity-picker').click();
  await page.locator('#save-routine-builder').click();
  await page.locator('#close-routines-modal').click();

  await page.locator('#fitness-add-menu-btn').click();
  await page.locator('[data-action="add-routine"]').click();
  // The picker is multi-select: choose, then confirm.
  await page.locator('#routine-picker-list .selectable-routine-item').click();
  await page.locator('#confirm-routine-picker').click();

  const card = page.locator('#activities-list .activity-card').first();
  await expect(card).toBeVisible();
  // No metric pills before the user fills anything in.
  const pillsBefore = await card.locator('.metric-pill, [class*="pill"]').count();

  await card.focus();
  await card.press('Enter');
  await expect(page.locator('#activity-details-modal')).toBeVisible();
  expect(pillsBefore).toBe(0);

  await page.locator('#activity-duration-input').fill('30');
  await page.locator('#duration-unit-select').selectOption('minutes');
  await page.locator('#save-activity-details').click();
  await expect(page.locator('#activity-details-modal')).toBeHidden();

  // The card now carries the metric it was given.
  const updated = page.locator('#activities-list .activity-card').first();
  await expect(updated).toContainText('30');
  const stored = await page.evaluate(() =>
    Object.values(window.__APP_TEST__.getState().recordedActivities).flat().map((r) => ({ d: r.duration, u: r.durationUnit }))
  );
  expect(stored).toEqual([{ d: 30, u: 'minutes' }]);

  // Native button semantics cover Space as well as Enter.
  await updated.focus();
  await updated.press('Space');
  await expect(page.locator('#activity-details-modal')).toBeVisible();
  await page.locator('#cancel-activity-details').click();
});
