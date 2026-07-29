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

// The library opens as a list of collapsed categories, so tests that reach for a
// tile have to open its section first.
async function expandAll(page) {
  const sections = page.locator('#activity-library-content .search-category-section');
  for (let i = 0; i < (await sections.count()); i += 1) {
    const section = sections.nth(i);
    if (await section.evaluate((el) => el.classList.contains('collapsed'))) {
      await section.locator('.search-expand-btn').click();
      await expect(section).not.toHaveClass(/collapsed/);
    }
  }
}

test.describe('activity library modal', () => {
  test('opens with every category collapsed', async ({ page }) => {
    await seed(page);
    await openLibrary(page);

    const sections = page.locator('#activity-library-content .search-category-section');
    await expect(sections).toHaveCount(2);
    await expect(sections.nth(0)).toHaveClass(/collapsed/);
    await expect(sections.nth(1)).toHaveClass(/collapsed/);
    await expect(page.locator('.search-activity-item').first()).toBeHidden();

    // Opening one leaves the other alone.
    await page.locator('#search-category-cardio .search-expand-btn').click();
    await expect(page.locator('#search-category-cardio')).not.toHaveClass(/collapsed/);
    await expect(page.locator('#search-category-strength')).toHaveClass(/collapsed/);
  });

  test('a filter expands the sections it matches', async ({ page }) => {
    await seed(page);
    await openLibrary(page);

    await page.locator('#activity-library-filter').fill('bench');
    const section = page.locator('#activity-library-content .search-category-section').first();
    await expect(section).not.toHaveClass(/collapsed/);
    await expect(page.locator('.search-activity-item').first()).toBeVisible();
  });

  test('opens from the Activities button with grouped categories', async ({ page }) => {
    await seed(page);
    await openLibrary(page);
    await expandAll(page);

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

    // Coloured category edit pill survives; the per-tile stats and edit buttons
    // moved into the activity details modal.
    const editPill = strength.locator('.search-edit-category-btn');
    await expect(editPill).toHaveCount(1);
    await expect(content.locator('.stats-btn')).toHaveCount(0);
    await expect(content.locator('.edit-activity-btn')).toHaveCount(0);
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
    // Wait for the shared modal animation rather than sleeping for its duration.
    await expect(modalBox).toHaveCSS('opacity', '1');
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

  test('category content and chevron animate on one uninterrupted clock', async ({ page }) => {
    await seed(page);
    await openLibrary(page);

    const section = page.locator('#search-category-cardio');
    const contentDiv = section.locator('.search-category-content');

    // The transition comes from CSS, which must still match now the list lives in <body>.
    const transition = await contentDiv.evaluate((el) => ({
      duration: getComputedStyle(el).transitionDuration,
      property: getComputedStyle(el).transitionProperty,
      inlineHeight: el.style.maxHeight,
      inert: el.hasAttribute('inert'),
    }));
    expect(transition.duration).toContain('0.28s');
    expect(transition.property).toContain('grid-template-rows');
    expect(transition.inlineHeight).toBe('');
    expect(transition.inert).toBe(true);

    await section.locator('.search-expand-btn').click();
    await expect(section).not.toHaveClass(/collapsed/);
    await expect(contentDiv).toBeVisible();
    await expect(contentDiv).toHaveAttribute('aria-hidden', 'false');
    await expect(contentDiv).not.toHaveAttribute('inert', '');
    expect(await contentDiv.evaluate((el) => el.style.maxHeight)).toBe('');

    await section.locator('.search-expand-btn').click();
    await expect(section).toHaveClass(/collapsed/);
    await expect(contentDiv).toBeHidden();
    await expect(contentDiv).toHaveAttribute('aria-hidden', 'true');
    await expect(contentDiv).toHaveAttribute('inert', '');
  });

  test('tile tap opens the details view over the library, which stays open', async ({ page }) => {
    await seed(page);
    await openLibrary(page);
    await expandAll(page);

    await page.locator('.search-activity-item').first().click();
    await expect(page.locator('#activity-info-modal')).toBeVisible();
    // Details, not recording: nothing is written by opening a tile.
    await expect(page.locator('#activity-details-modal')).toBeHidden();
    await expect(page.locator('#activity-library-modal')).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    const stack = await page.evaluate(async () => {
      const { topModalId, isModalOpen } = await import('/src/components/Modal.js');
      return { top: topModalId(), libraryOpen: isModalOpen('activity-library-modal') };
    });
    expect(stack).toEqual({ top: 'activity-info-modal', libraryOpen: true });
  });

  test('the details view leads to stats, editing and recording', async ({ page }) => {
    await seed(page);
    await openLibrary(page);
    await expandAll(page);
    await page.locator('.search-activity-item').first().click();
    await expect(page.locator('#activity-info-modal')).toBeVisible();

    // Not enough sessions for a graph yet, so the placeholder stands in for it.
    await expect(page.locator('#activity-info-progress')).toContainText(
      'Progress being calculated'
    );

    // Statistics must land on top of the details modal, not behind it.
    await page.locator('#activity-info-stats-btn').click();
    const stats = page.locator('#activity-stats-modal');
    await expect(stats).toBeVisible();
    const zIndexes = await page.evaluate(() => ({
      info: getComputedStyle(document.querySelector('#activity-info-modal')).zIndex,
      stats: getComputedStyle(document.querySelector('#activity-stats-modal')).zIndex,
    }));
    expect(Number(zIndexes.stats)).toBeGreaterThan(Number(zIndexes.info));
    await page.locator('#close-stats-modal').click();
    await expect(stats).toHaveCount(0);

    await page.locator('#activity-info-edit-btn').click();
    await expect(page.locator('#add-activity-modal')).toBeVisible();
    await expect(page.locator('#add-activity-modal h2')).toContainText('Edit');
  });

  // Recording from here is one tap onto the schedule; the full flow, including
  // the prompt on the resulting card, lives in record-modal.spec.js.
  test('the details view records onto the schedule in one tap', async ({ page }) => {
    await seed(page);
    await openLibrary(page);
    await expandAll(page);
    await page.locator('.search-activity-item').first().click();

    await page.locator('#activity-info-record-btn').click();
    await expect(page.locator('#activity-info-modal')).toBeHidden();
    await expect(page.locator('#activity-library-modal')).toBeHidden();
    await expect(page.locator('#activities-list')).toContainText('Treadmill Run');
  });

  test('the progress chart plots one point per session on round axes', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
      const { recordActivity } = await import('/src/features/fitness/activities.js');
      const { getState } = await import('/src/core/state.js');
      const id = getState().activities.find((a) => a.name === 'Bench Press').id;
      const sessions = [
        ['2026-07-01', 47.5],
        ['2026-07-08', 63.8],
        ['2026-07-15', 71.1],
        ['2026-07-22', 82.5],
      ];
      for (const [date, weight] of sessions) {
        await recordActivity(id, date, { sets: [{ reps: 5, value: weight, unit: 'kg' }] });
      }
    });

    await openLibrary(page);
    await expandAll(page);
    await page.locator('.search-activity-item').filter({ hasText: 'Bench Press' }).click();

    const chart = page.locator('#activity-info-progress svg');
    await expect(chart).toBeVisible();
    // The metric and its unit are the y-axis title; the x axis carries only dates.
    await expect(chart.locator('.axis-title')).toHaveText('Max weight (kg)');

    const plot = await page.evaluate(() => {
      const svg = document.querySelector('#activity-info-progress svg');
      const texts = (selector) =>
        [...svg.querySelectorAll(selector)].map((t) => t.textContent.trim());
      const points = svg
        .querySelector('polyline')
        .getAttribute('points')
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(',').map(Number));
      const gaps = points.slice(1).map((p, i) => Number((p[0] - points[i][0]).toFixed(2)));
      return {
        ticks: texts('.axis-tick'),
        dates: texts('.axis-date'),
        values: texts('.point-value'),
        pointCount: points.length,
        gaps,
      };
    });

    // One plot per recorded session.
    expect(plot.pointCount).toBe(4);
    // Evenly spaced on x regardless of the gaps between dates. Coordinates are
    // rounded to one decimal in the markup, so allow a hair of drift.
    expect(Math.max(...plot.gaps) - Math.min(...plot.gaps)).toBeLessThan(0.2);
    // Round y-axis values rather than the raw data's decimals.
    expect(plot.ticks.every((l) => Number.isInteger(Number(l)))).toBe(true);
    expect(Number(plot.ticks[0])).toBeLessThanOrEqual(47.5);
    expect(Number(plot.ticks[plot.ticks.length - 1])).toBeGreaterThanOrEqual(82.5);
    // First and last dates are labelled.
    expect(plot.dates).toContain('01/07');
    expect(plot.dates).toContain('22/07');
    // Every point carries its exact figure.
    expect(plot.values).toEqual(['47.5', '63.8', '71.1', '82.5']);
  });

  test('the details view keeps a note against the activity', async ({ page }) => {
    await seed(page);
    await openLibrary(page);
    await expandAll(page);
    await page.locator('.search-activity-item').first().click();

    await page.locator('#activity-info-notes').fill('Left knee twinges');
    await page.locator('#activity-info-notes').blur();
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__APP_TEST__.getState().activities.find((a) => a.name === 'Treadmill Run').notes
        )
      )
      .toBe('Left knee twinges');

    await page.locator('#close-activity-info').click();
    await page.locator('.search-activity-item').first().click();
    await expect(page.locator('#activity-info-notes')).toHaveValue('Left knee twinges');
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
    await expandAll(page);

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

  test('rest day blocks recording from the details view', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
      const { toggleRestDay } = await import('/src/features/fitness/restDays.js');
      const { getState } = await import('/src/core/state.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      await toggleRestDay(getLocalISODate(getState().fitnessSelectedDate));
    });

    await openLibrary(page);
    await expandAll(page);
    // Opening the details is always allowed; only recording is blocked.
    await page.locator('.search-activity-item').first().click();
    await expect(page.locator('#activity-info-modal')).toBeVisible();

    await page.locator('#activity-info-record-btn').click();
    await expect(page.locator('#global-confirm-modal')).toBeVisible();
    await expect(page.locator('#global-confirm-modal')).toContainText('Rest Day');
    await expect(page.locator('#activity-details-modal')).toBeHidden();
  });
});
