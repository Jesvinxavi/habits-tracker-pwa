import { expect, test } from '@playwright/test';

async function seed(page) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.locator('#fitness-activity-btn')).toBeVisible();

  // Seed a few activities, including two strength ones with muscle groups.
  await page.evaluate(async () => {
    const { addActivity } = await import('/src/features/fitness/activities.js');
    await addActivity({ name: 'Treadmill Run', categoryId: 'cardio', trackingType: 'time' });
    await addActivity({
      name: 'Bench Press',
      categoryId: 'strength',
      trackingType: 'sets-reps',
      muscleGroup: 'Chest',
    });
    await addActivity({
      name: 'Barbell Curl',
      categoryId: 'strength',
      trackingType: 'sets-reps',
      muscleGroup: 'Biceps',
    });
  });

  // Prove the seed landed in the state the app itself renders from.
  await expect(page.locator('#activities-list')).toBeVisible();
}

async function openLibrary(page) {
  await page.locator('#fitness-activity-btn').click();
  await expect(page.locator('#activity-library-modal')).toBeVisible();
  await expect(page.locator('#activity-library-content')).toBeVisible();
}

test.describe('activity library modal', () => {
  test('opens from the Activity button with grouped categories', async ({ page }) => {
    await seed(page);
    await openLibrary(page);

    const content = page.locator('#activity-library-content');
    await expect(content.locator('.search-category-section')).toHaveCount(2);
    await expect(content.locator('#search-category-cardio')).toContainText('Cardio');
    await expect(content).toContainText('Treadmill Run');

    // Strength keeps its muscle-group sub-headers.
    const strength = content.locator('#search-category-strength');
    await expect(strength).toBeVisible();
    await expect(strength.locator('.muscle-group')).toHaveCount(2);
    await expect(strength).toContainText('Chest');
    await expect(strength).toContainText('Biceps');

    // Coloured edit pill and 2.5px category-coloured tile borders survived the port.
    const editPill = strength.locator('.search-edit-category-btn');
    await expect(editPill).toHaveCount(1);
    // The aesthetic contract is the authored 2.5px border; Chrome floors the
    // computed value to whole device pixels, so assert the authored style.
    const tile = content.locator('.search-activity-item').first();
    await expect(tile).toHaveAttribute('style', /border:\s*2\.5px solid/);
    const borderColor = await tile.evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(borderColor).toBe('rgb(239, 68, 68)');

    // Hover lift still applies now the tiles live outside #fitness-view.
    const hoverTransition = await tile.evaluate((el) => {
      el.matches(':hover');
      return getComputedStyle(el).transitionDuration;
    });
    expect(hoverTransition).not.toBe('0s');

    // Body is scroll-locked while the library is open.
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  });

  test('filter narrows in place and the clear button tracks text', async ({ page }) => {
    await seed(page);
    await openLibrary(page);

    const content = page.locator('#activity-library-content');
    const filter = page.locator('#activity-library-filter');
    const clear = page.locator('#activity-library-filter-clear');
    const modalBox = page.locator('#activity-library-modal .modal-content');

    await expect(clear).toBeHidden();
    // Let the shared modal open-animation settle before measuring, otherwise the
    // comparison picks up the scale transition rather than any filter-driven growth.
    await page.waitForTimeout(500);
    const boxBefore = await modalBox.boundingBox();

    await filter.fill('bench');
    await expect(content).toContainText('Bench Press');
    await expect(content).not.toContainText('Treadmill Run');
    await expect(clear).toBeVisible();

    // The modal does not grow, animate open, or blur the page behind it.
    const boxAfter = await modalBox.boundingBox();
    expect(Math.abs(boxAfter.width - boxBefore.width)).toBeLessThan(1);
    const viewFilter = await page.evaluate(
      () => getComputedStyle(document.querySelector('#fitness-view')).filter
    );
    expect(viewFilter === 'none' || viewFilter === '').toBeTruthy();
    await expect(page.locator('#fitness-view')).not.toHaveClass(/search-expanded/);

    // No matches -> the "no activities found" state.
    await filter.fill('zzzz');
    await expect(content).toContainText('No activities found');

    await clear.click();
    await expect(filter).toHaveValue('');
    await expect(clear).toBeHidden();
    await expect(content).toContainText('Treadmill Run');
    await expect(content).toContainText('Bench Press');
  });

  test('empty state shows when there are no activities', async ({ page }) => {
    await page.goto('/?test=true');
    await page.getByRole('tab', { name: 'Fitness view' }).click();
    await openLibrary(page);
    const content = page.locator('#activity-library-content');
    await expect(content).toContainText('No activities available');
    // Points at the header button that actually exists.
    await expect(content).toContainText('Tap "New" to create your first activity');
    await expect(page.locator('#library-new-activity-btn')).toContainText('New');
  });

  test('collapse chevron still animates outside #fitness-view', async ({ page }) => {
    await seed(page);
    await openLibrary(page);

    const section = page.locator('#search-category-cardio');
    const contentDiv = section.locator('.search-category-content');
    await expect(contentDiv).toBeVisible();

    // The transition comes from CSS, which must still match now the list lives in <body>.
    const transition = await contentDiv.evaluate(
      (el) => getComputedStyle(el).transitionDuration
    );
    expect(transition).not.toBe('0s');

    await section.locator('.search-expand-btn').click();
    await expect(section).toHaveClass(/collapsed/);
    await page.waitForTimeout(450);
    await expect(contentDiv).toBeHidden();

    await section.locator('.search-expand-btn').click();
    await expect(section).not.toHaveClass(/collapsed/);
    await expect(contentDiv).toBeVisible();
  });

  test('tile tap opens details over the library, which stays open', async ({ page }) => {
    await seed(page);
    await openLibrary(page);

    await page.locator('.search-activity-item').first().click();
    await expect(page.locator('#activity-details-modal')).toBeVisible();
    await expect(page.locator('#activity-library-modal')).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    const stack = await page.evaluate(async () => {
      const { topModalId, isModalOpen } = await import('/src/components/Modal.js');
      return { top: topModalId(), libraryOpen: isModalOpen('activity-library-modal') };
    });
    expect(stack).toEqual({ top: 'activity-details-modal', libraryOpen: true });
  });

  test('stats and edit buttons open their modals', async ({ page }) => {
    await seed(page);
    await openLibrary(page);

    await page.locator('.search-activity-item').first().locator('.stats-btn').click();
    await expect(page.locator('#activity-stats-modal')).toBeVisible();
    await page.evaluate(async () => {
      const { closeModal } = await import('/src/components/Modal.js');
      closeModal('activity-stats-modal');
    });

    await page.locator('.search-activity-item').first().locator('.edit-activity-btn').click();
    await expect(page.locator('#add-activity-modal')).toBeVisible();
    await expect(page.locator('#add-activity-modal h2')).toContainText('Edit');
  });

  test('New opens Add Activity above the library and the list refreshes on save', async ({
    page,
  }) => {
    await seed(page);
    await openLibrary(page);

    await page.locator('#library-new-activity-btn').click();
    await expect(page.locator('#add-activity-modal')).toBeVisible();
    await expect(page.locator('#activity-library-modal')).toBeVisible();

    const zIndexes = await page.evaluate(() => ({
      library: getComputedStyle(document.querySelector('#activity-library-modal')).zIndex,
      add: getComputedStyle(document.querySelector('#add-activity-modal')).zIndex,
    }));
    expect(Number(zIndexes.add)).toBeGreaterThan(Number(zIndexes.library));

    await page.locator('#activity-name-input').fill('Rowing Machine');
    await page.locator('#activity-category-select').selectOption('cardio');
    await page.locator('#save-add-activity').click();

    await expect(page.locator('#add-activity-modal')).toBeHidden();
    await expect(page.locator('#activity-library-modal')).toBeVisible();
    await expect(page.locator('#activity-library-content')).toContainText('Rowing Machine');
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  });

  test('category colour change updates in place without closing', async ({ page }) => {
    await seed(page);
    await openLibrary(page);

    await page.locator('#search-category-cardio .search-edit-category-btn').click();
    await expect(page.locator('.category-color-picker')).toBeVisible();

    await page.locator('.category-color-picker .color-option').nth(6).click();
    await expect(page.locator('#activity-library-modal')).toBeVisible();

    const tileBorderColor = await page
      .locator('#search-category-cardio .search-activity-item')
      .first()
      .evaluate((el) => getComputedStyle(el).borderTopColor);
    // #8b5cf6 is the seventh swatch.
    expect(tileBorderColor).toBe('rgb(139, 92, 246)');
  });

  test('closing releases the scroll lock and does not leak subscriptions', async ({ page }) => {
    await seed(page);

    const before = await page.evaluate(async () => {
      const { listeners } = await import('/src/core/state.js');
      return listeners.size;
    });

    for (let i = 0; i < 10; i += 1) {
      await page.locator('#fitness-activity-btn').click();
      await expect(page.locator('#activity-library-modal')).toBeVisible();
      await page.locator('#close-activity-library').click();
      await expect(page.locator('#activity-library-modal')).toBeHidden();
    }

    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

    const after = await page.evaluate(async () => {
      const { listeners } = await import('/src/core/state.js');
      return listeners.size;
    });
    expect(after).toBe(before);
  });

  test('rest day blocks recording from the library', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
      const { toggleRestDay } = await import('/src/features/fitness/restDays.js');
      const { getState } = await import('/src/core/state.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      await toggleRestDay(getLocalISODate(getState().fitnessSelectedDate));
    });

    await openLibrary(page);
    await page.locator('.search-activity-item').first().click();

    await expect(page.locator('#global-confirm-modal')).toBeVisible();
    await expect(page.locator('#global-confirm-modal')).toContainText('Rest Day');
    await expect(page.locator('#activity-details-modal')).toBeHidden();
  });
});
