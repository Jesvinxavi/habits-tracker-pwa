import { expect, test } from '@playwright/test';

async function seed(page) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.locator('#fitness-add-menu-btn')).toBeVisible();
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

// Recording flows through the two multi-select pickers live in
// pickers.spec.js; this file covers the menu itself.
test.describe('the + add menu', () => {
  test('menu matches the home dropdown and has five items', async ({ page }) => {
    await seed(page);
    const btn = page.locator('#fitness-add-menu-btn');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');

    await btn.click();
    const menu = page.locator('#fitness-add-menu');
    await expect(menu).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.locator('.dropdown-item')).toHaveCount(5);
    await expect(menu).toContainText('Add activity');
    await expect(menu).toContainText('Add routine');
    await expect(menu).toContainText('program');
    await expect(menu).toContainText('Save as routine');
    await expect(menu).toContainText('New program');
    // The timer has its own button beside the Schedule pill.
    await expect(menu).not.toContainText('Timer');
    await expect(menu).toHaveAttribute('role', 'menu');

    // Same visual treatment as the home-screen menu.
    const styles = await page.evaluate(() => {
      const fitness = document.querySelector('#fitness-add-menu');
      const home = document.querySelector('#dropdown-menu');
      const read = (el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, radius: cs.borderRadius, shadow: cs.boxShadow };
      };
      const itemHeight = getComputedStyle(fitness.querySelector('.dropdown-item')).height;
      return { fitness: read(fitness), home: read(home), itemHeight };
    });
    expect(styles.fitness).toEqual(styles.home);
    expect(styles.itemHeight).toBe('36px');
  });

  test('menu stays on screen at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seed(page);
    await page.locator('#fitness-add-menu-btn').click();
    const box = await page.locator('#fitness-add-menu').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  });

  test('outside click, Escape and selection all close the menu', async ({ page }) => {
    await seed(page);
    const btn = page.locator('#fitness-add-menu-btn');
    const menu = page.locator('#fitness-add-menu');

    await btn.click();
    await expect(menu).toBeVisible();
    await page.locator('#activities-label').click();
    await expect(menu).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');

    await btn.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(btn).toBeFocused();

    await btn.click();
    await menu.locator('[data-action="new-program"]').click();
    await expect(menu).toBeHidden();
    await expect(page.locator('#program-builder-modal')).toBeVisible();
  });

  test('keyboard: arrows navigate, Enter activates, Escape restores focus', async ({ page }) => {
    await seed(page);
    const btn = page.locator('#fitness-add-menu-btn');
    await btn.focus();
    await page.keyboard.press('Enter');
    const menu = page.locator('#fitness-add-menu');
    await expect(menu).toBeVisible();

    // First item takes focus on open.
    await expect(menu.locator('[data-action="add-activity"]')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.locator('[data-action="add-routine"]')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menu.locator('[data-action="add-activity"]')).toBeFocused();
    // Wraps at the top.
    await page.keyboard.press('ArrowUp');
    await expect(menu.locator('[data-action="new-program"]')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(btn).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#activity-picker-modal')).toBeVisible();
  });

  test('Save as routine with nothing recorded warns', async ({ page }) => {
    await seed(page);
    await page.locator('#fitness-add-menu-btn').click();
    await page.locator('[data-action="save-routine"]').click();
    await expect(page.locator('#global-confirm-modal')).toBeVisible();
    await expect(page.locator('#global-confirm-modal')).toContainText('Nothing to Save');
    await expect(page.locator('#routine-builder-modal')).toBeHidden();
  });

  test('Save as routine de-duplicates repeated activities', async ({ page }) => {
    await seed(page);

    // Record three activities, one of them twice.
    await page.evaluate(async () => {
      const { recordActivity } = await import('/src/features/fitness/activities.js');
      const { getState } = await import('/src/core/state.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const iso = getLocalISODate(getState().fitnessSelectedDate);
      const byName = (n) => getState().activities.find((a) => a.name === n).id;
      await recordActivity(byName('Treadmill Run'), iso, {});
      await recordActivity(byName('Cycling'), iso, {});
      await recordActivity(byName('Bench Press'), iso, {});
      await recordActivity(byName('Cycling'), iso, {});
    });

    await page.locator('#fitness-add-menu-btn').click();
    await page.locator('[data-action="save-routine"]').click();

    await expect(page.locator('#routine-builder-modal')).toBeVisible();
    await expect(page.locator('#routine-builder-title')).toHaveText('Save as Routine');
    await expect(page.locator('#routine-selection-count')).toHaveText('3 selected');

    // Remove one and save -> a two-activity routine.
    await page
      .locator('.routine-selected-item')
      .filter({ hasText: 'Bench Press' })
      .locator('.routine-remove-activity')
      .click();
    await expect(page.locator('#routine-selection-count')).toHaveText('2 selected');
    await page.locator('#routine-name-input').fill('Trimmed');
    await page.locator('#save-routine-builder').click();
    await expect(page.locator('#routine-builder-modal')).toBeHidden();

    await page.locator('#fitness-routines-btn').click();
    await expect(page.locator('.routine-card')).toContainText('Trimmed');
    await expect(page.locator('.routine-card')).toContainText('2 activities');
  });

  test('New program opens the program builder', async ({ page }) => {
    await seed(page);
    await page.locator('#fitness-add-menu-btn').click();
    await page.locator('[data-action="new-program"]').click();
    await expect(page.locator('#program-builder-modal')).toBeVisible();
  });

  test('Timer has its own button and still works', async ({ page }) => {
    await seed(page);
    // Between the Schedule pill and the + button, not inside the dropdown.
    const order = await page.evaluate(() => {
      const row = document.querySelector('.rest-toggle-row > div');
      // The dropdown is mounted in here too; only the controls are ordered.
      return [...row.children].map((el) => el.id).filter((id) => id !== 'fitness-add-menu');
    });
    expect(order).toEqual(['activities-label', 'fitness-timer-btn', 'fitness-add-menu-btn']);

    await page.locator('#fitness-timer-btn').click();
    await expect(page.locator('#timer-modal')).toBeVisible();
    await expect(page.locator('#close-timer-modal')).toBeVisible();
    await page.locator('#close-timer-modal').click();
    await expect(page.locator('#timer-modal')).toBeHidden();
  });
});
