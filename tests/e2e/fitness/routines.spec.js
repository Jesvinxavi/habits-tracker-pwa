import { expect, test } from '@playwright/test';

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

async function openRoutines(page) {
  await page.locator('#fitness-routines-btn').click();
  await expect(page.locator('#routines-modal')).toBeVisible();
}

async function tileByName(page, name) {
  // The builder no longer embeds a picker; open it, pick, and confirm.
  await page.locator('#routine-add-activities-btn').click();
  await page
    .locator('#activity-picker-list .selectable-activity-item')
    .filter({ hasText: name })
    .first()
    .click();
  await page.locator('#confirm-activity-picker').click();
  return page.locator('.routine-selected-item').filter({ hasText: name });
}

// Tile selection and filter behaviour now live in the activity picker and are
// asserted in pickers.spec.js.
test.describe('routines modal', () => {
  test('empty state and New Routine button', async ({ page }) => {
    await seed(page);
    await openRoutines(page);

    const list = page.locator('#routines-list');
    await expect(list).toContainText('No routines saved');
    await expect(list).toContainText('Create a new routine to group activities you do together.');

    // The button sits above the empty state.
    const btnBox = await page.locator('#new-routine-btn').boundingBox();
    const listBox = await list.boundingBox();
    expect(btnBox.y).toBeLessThan(listBox.y);
  });

  test('builder opens over the routines modal with Save disabled', async ({ page }) => {
    await seed(page);
    await openRoutines(page);
    await page.locator('#new-routine-btn').click();

    await expect(page.locator('#routine-builder-modal')).toBeVisible();
    await expect(page.locator('#routines-modal')).toBeVisible();

    const z = await page.evaluate(() => ({
      routines: getComputedStyle(document.querySelector('#routines-modal')).zIndex,
      builder: getComputedStyle(document.querySelector('#routine-builder-modal')).zIndex,
    }));
    expect(Number(z.builder)).toBeGreaterThan(Number(z.routines));

    const save = page.locator('#save-routine-builder');
    await expect(save).toBeDisabled();
    await expect(save).toHaveClass(/opacity-50/);
    await expect(page.locator('#routine-selection-count')).toHaveText('0 selected');
    await expect(page.locator('#delete-routine-btn')).toBeHidden();

    // Name alone is not enough.
    await page.locator('#routine-name-input').fill('Push Day');
    await expect(save).toBeDisabled();

    // Name + one activity enables Save.
    await (await tileByName(page, 'Bench Press')).click();
    await expect(page.locator('#routine-selection-count')).toHaveText('1 selected');
    await expect(save).toBeEnabled();
    await expect(save).not.toHaveClass(/opacity-50/);
  });



  test('saving creates the routine and the list updates behind', async ({ page }) => {
    await seed(page);
    await openRoutines(page);
    await page.locator('#new-routine-btn').click();

    await page.locator('#routine-name-input').fill('Push Day');
    await (await tileByName(page, 'Bench Press')).click();
    await (await tileByName(page, 'Cycling')).click();
    await page.locator('#save-routine-builder').click();

    await expect(page.locator('#routine-builder-modal')).toBeHidden();
    await expect(page.locator('#routines-modal')).toBeVisible();

    const card = page.locator('.routine-card');
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('Push Day');
    await expect(card).toContainText('2 activities');

    // Scroll lock is still held by the routines modal underneath.
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  });

  test('singular activity count reads correctly', async ({ page }) => {
    await seed(page);
    await openRoutines(page);
    await page.locator('#new-routine-btn').click();
    await page.locator('#routine-name-input').fill('Solo');
    await (await tileByName(page, 'Cycling')).click();
    await page.locator('#save-routine-builder').click();
    await expect(page.locator('.routine-card')).toContainText('1 activity');
  });

  test('editing pre-populates name and selection in saved order', async ({ page }) => {
    await seed(page);
    await openRoutines(page);
    await page.locator('#new-routine-btn').click();
    await page.locator('#routine-name-input').fill('Order Test');
    // Deliberate order: Bench Press first, then Treadmill Run.
    await (await tileByName(page, 'Bench Press')).click();
    await (await tileByName(page, 'Treadmill Run')).click();
    await page.locator('#save-routine-builder').click();
    await expect(page.locator('.routine-card')).toContainText('Order Test');

    await page.locator('.routine-card').click();
    await expect(page.locator('#routine-builder-modal')).toBeVisible();
    await expect(page.locator('#routine-builder-title')).toHaveText('Edit Routine');
    await expect(page.locator('#routine-name-input')).toHaveValue('Order Test');
    await expect(page.locator('#routine-selection-count')).toHaveText('2 selected');
    await expect(page.locator('#delete-routine-btn')).toBeVisible();

    const savedOrder = await page.evaluate(async () => {
      const { getRoutines, getRoutineActivities } = await import(
        '/src/features/fitness/routines.js'
      );
      const routine = getRoutines()[0];
      return getRoutineActivities(routine.id).map((a) => a.name);
    });
    expect(savedOrder).toEqual(['Bench Press', 'Treadmill Run']);
  });

  test('editing the name and selection saves', async ({ page }) => {
    await seed(page);
    await openRoutines(page);
    await page.locator('#new-routine-btn').click();
    await page.locator('#routine-name-input').fill('Before');
    await (await tileByName(page, 'Cycling')).click();
    await page.locator('#save-routine-builder').click();
    await expect(page.locator('.routine-card')).toContainText('Before');

    await page.locator('.edit-routine-btn').click();
    await page.locator('#routine-name-input').fill('After');
    await (await tileByName(page, 'Bench Press')).click();
    await page.locator('#save-routine-builder').click();

    await expect(page.locator('.routine-card')).toContainText('After');
    await expect(page.locator('.routine-card')).toContainText('2 activities');
  });

  test('delete asks for confirmation then removes the routine', async ({ page }) => {
    await seed(page);
    await openRoutines(page);
    await page.locator('#new-routine-btn').click();
    await page.locator('#routine-name-input').fill('Doomed');
    await (await tileByName(page, 'Cycling')).click();
    await page.locator('#save-routine-builder').click();
    await expect(page.locator('.routine-card')).toHaveCount(1);

    await page.locator('.routine-card').click();
    await page.locator('#delete-routine-btn').click();

    await expect(page.locator('#global-confirm-modal')).toBeVisible();
    await expect(page.locator('#global-confirm-modal')).toContainText('Delete Routine?');
    await page.locator('#global-confirm-modal button', { hasText: 'Delete' }).first().click();

    await expect(page.locator('#routine-builder-modal')).toBeHidden();
    await expect(page.locator('#routines-list')).toContainText('No routines saved');
    const remaining = await page.evaluate(() => window.appData.routines.length);
    expect(remaining).toBe(0);
  });

  test('deleting an activity leaves the routine usable with a filtered count', async ({ page }) => {
    await seed(page);
    await openRoutines(page);
    await page.locator('#new-routine-btn').click();
    await page.locator('#routine-name-input').fill('Integrity');
    await (await tileByName(page, 'Treadmill Run')).click();
    await (await tileByName(page, 'Cycling')).click();
    await (await tileByName(page, 'Bench Press')).click();
    await page.locator('#save-routine-builder').click();
    await expect(page.locator('.routine-card')).toContainText('3 activities');

    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Delete one of the three activities out from under the routine.
    await page.evaluate(async () => {
      const { deleteActivity, getState } = await Promise.all([
        import('/src/features/fitness/activities.js'),
        import('/src/core/state.js'),
      ]).then(([a, s]) => ({ deleteActivity: a.deleteActivity, getState: s.getState }));
      const target = getState().activities.find((a) => a.name === 'Cycling');
      await deleteActivity(target.id);
    });

    // Reopen the routines modal so the list re-renders.
    await page.locator('#close-routines-modal').click();
    await openRoutines(page);
    await expect(page.locator('.routine-card')).toContainText('2 activities');

    await page.locator('.routine-card').click();
    await expect(page.locator('#routine-builder-modal')).toBeVisible();
    await expect(page.locator('#routine-selection-count')).toHaveText('2 selected');
    expect(errors).toEqual([]);
  });

  test('Escape closes only the topmost modal and the lock releases last', async ({ page }) => {
    await seed(page);
    await openRoutines(page);
    await page.locator('#new-routine-btn').click();
    await expect(page.locator('#routine-builder-modal')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#routine-builder-modal')).toBeHidden();
    await expect(page.locator('#routines-modal')).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Escape');
    await expect(page.locator('#routines-modal')).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });
});
