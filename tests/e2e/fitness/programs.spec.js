import { expect, test } from '@playwright/test';

async function openFitness(page) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.locator('#fitness-add-menu-btn')).toBeVisible();
}

async function seedActivity(page) {
  await page.evaluate(async () => {
    const { addActivity } = await import('/src/features/fitness/activities.js');
    await addActivity({ name: 'Treadmill Run', categoryId: 'cardio', trackingType: 'time' });
  });
}

async function makeRoutine(page, name) {
  await page.locator('#fitness-routines-btn').click();
  await page.locator('#new-routine-btn').click();
  await page.locator('#routine-name-input').fill(name);
  await page.locator('#routine-add-activities-btn').click();
  await page.locator('#activity-picker-list .selectable-activity-item').first().click();
  await page.locator('#confirm-activity-picker').click();
  await page.locator('#save-routine-builder').click();
  await expect(page.locator('#routine-builder-modal')).toBeHidden();
  await page.locator('#close-routines-modal').click();
  await expect(page.locator('#routines-modal')).toBeHidden();
}

async function openBuilder(page) {
  await page.locator('#fitness-add-menu-btn').click();
  await page.locator('[data-action="new-program"]').click();
  await expect(page.locator('#program-builder-modal')).toBeVisible();
}

async function pinFirstRoutine(page, day) {
  await page.locator(`.program-day-select[data-day-of-week="${day}"]`).click();
  await expect(page.locator('#routine-picker-modal')).toBeVisible();
  await page.locator('#routine-picker-list .selectable-routine-item').first().click();
  await page.locator('#confirm-routine-picker').click();
  await expect(page.locator('#routine-picker-modal')).toBeHidden();
}

async function createProgram(page, { name, start, end, days }) {
  await openBuilder(page);
  await page.locator('#program-name-input').fill(name);
  await page.locator('#program-start-input').fill(start);
  await page.locator('#program-end-input').fill(end);
  for (const day of days) {
    await pinFirstRoutine(page, day);
  }
  await page.locator('#save-program-builder').click();
  await expect(page.locator('#program-builder-modal')).toBeHidden();
}

test.describe('program builder and tile', () => {
  test('no program means an empty, zero-height host', async ({ page }) => {
    await openFitness(page);
    const host = page.locator('#fitness-program-host');
    await expect(host).toBeAttached();
    const box = await host.evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      children: el.children.length,
    }));
    expect(box).toEqual({ height: 0, children: 0 });
  });

  test('with zero routines the builder explains itself and Save stays off', async ({ page }) => {
    await openFitness(page);
    await openBuilder(page);
    await expect(page.locator('#program-no-routines-notice')).toBeVisible();
    await expect(page.locator('#program-no-routines-notice')).toContainText(
      'Create a routine first to schedule it.'
    );
    await page.locator('#program-name-input').fill('Doomed');
    await expect(page.locator('#save-program-builder')).toBeDisabled();
    await expect(page.locator('.program-day-select')).toHaveCount(0);
  });

  test('one Monday-first row per day, each offering every routine', async ({ page }) => {
    await openFitness(page);
    await seedActivity(page);
    await makeRoutine(page, 'Push');
    await makeRoutine(page, 'Pull');
    await openBuilder(page);

    const rows = page.locator('.program-day-select');
    await expect(rows).toHaveCount(7);
    const labels = await page
      .locator('#program-schedule-rows > div > span:first-child')
      .allTextContents();
    expect(labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    // Unassigned days read as Rest.
    await expect(rows.first()).toContainText('Rest');

    await rows.first().click();
    const cards = page.locator('#routine-picker-list .selectable-routine-item');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText('Push');
    await expect(cards.nth(1)).toContainText('Pull');
  });

  test('validation: name, dates and at least one scheduled day', async ({ page }) => {
    await openFitness(page);
    await seedActivity(page);
    await makeRoutine(page, 'Push');
    await openBuilder(page);

    const save = page.locator('#save-program-builder');
    // Dates are pre-filled, so only the name and a day are missing.
    await expect(save).toBeDisabled();

    await page.locator('#program-name-input').fill('Autumn');
    await expect(save).toBeDisabled();

    await pinFirstRoutine(page, 1);
    await expect(save).toBeEnabled();

    // Inverted range shows the inline error and blocks Save.
    await page.locator('#program-start-input').fill('2026-12-13');
    await page.locator('#program-end-input').fill('2026-10-20');
    await expect(page.locator('#program-date-error')).toBeVisible();
    await expect(page.locator('#program-date-error')).toContainText(
      'End date must be on or after the start date.'
    );
    await expect(save).toBeDisabled();

    await page.locator('#program-start-input').fill('2026-10-20');
    await page.locator('#program-end-input').fill('2026-12-13');
    await expect(page.locator('#program-date-error')).toBeHidden();
    await expect(save).toBeEnabled();
  });

  test('saving renders the tile between the buttons and the calendar', async ({ page }) => {
    await openFitness(page);
    await seedActivity(page);
    await makeRoutine(page, 'Push');
    await createProgram(page, {
      name: 'Autumn Hypertrophy',
      start: '2026-10-20',
      end: '2026-12-13',
      days: [1, 3, 5],
    });

    const tile = page.locator('#program-tile');
    await expect(tile).toBeVisible();
    await expect(tile).toContainText('Autumn Hypertrophy');
    await expect(tile.locator('.program-range-pill')).toHaveText('20 Oct – 13 Dec');
    // 20 Oct 2026 is a Tuesday, so Mon/Wed/Fri yields 23 sessions across 8 weeks.
    await expect(tile.locator('.program-workouts')).toHaveText('0/23');

    const order = await page.evaluate(() => {
      const view = document.querySelector('#fitness-view');
      const ids = [...view.children].map((c) => c.id || c.className.split(' ')[0]);
      return {
        ids,
        hostIndex: ids.indexOf('fitness-program-host'),
        buttonsIndex: ids.indexOf('action-buttons'),
        calendarIndex: ids.findIndex((id) => id.includes('calendar')),
      };
    });
    expect(order.hostIndex).toBeGreaterThan(order.buttonsIndex);
    expect(order.hostIndex).toBeLessThan(order.calendarIndex);

    // The tile itself is the progress indicator, with a textual value so the
    // fill is never the only cue.
    await expect(tile).toHaveAttribute('role', 'progressbar');
    await expect(tile).toHaveAttribute('aria-valuemin', '0');
    await expect(tile).toHaveAttribute('aria-valuemax', '100');
    await expect(tile).toHaveAttribute('aria-valuenow', '0');
    await expect(tile).toHaveAttribute('aria-valuetext', /0 of 23 workouts completed/);
    await expect(tile.locator('.program-tile-fill')).toHaveCount(1);
  });

  test('recording on a scheduled date raises the count and the bar', async ({ page }) => {
    await openFitness(page);
    await seedActivity(page);
    await makeRoutine(page, 'Push');

    // A program covering today, scheduled on every weekday so today counts.
    const today = await page.evaluate(async () => {
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      return getLocalISODate(new Date());
    });
    await createProgram(page, {
      name: 'Now',
      start: today,
      end: today,
      days: [0, 1, 2, 3, 4, 5, 6],
    });

    await expect(page.locator('.program-workouts')).toHaveText('0/1');
    await expect(page.locator('#program-tile')).toHaveAttribute('aria-valuenow', '0');

    await page.evaluate(async () => {
      const { recordActivity } = await import('/src/features/fitness/activities.js');
      const { getState } = await import('/src/core/state.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const iso = getLocalISODate(getState().fitnessSelectedDate);
      await recordActivity(getState().activities[0].id, iso, {});
    });

    await expect(page.locator('.program-workouts')).toHaveText('1/1');
    await expect(page.locator('.program-percent-pill')).toHaveText('100%');
    await expect(page.locator('#program-tile')).toHaveAttribute('aria-valuenow', '100');
    // The fill tracks the value.
    const fill = await page.locator('.program-tile-fill').getAttribute('style');
    expect(fill).toContain('100%');
  });

  test('a rest day is not counted as completed', async ({ page }) => {
    await openFitness(page);
    await seedActivity(page);
    await makeRoutine(page, 'Push');
    const today = await page.evaluate(async () => {
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      return getLocalISODate(new Date());
    });
    await createProgram(page, {
      name: 'Rest Check',
      start: today,
      end: today,
      days: [0, 1, 2, 3, 4, 5, 6],
    });

    await page.evaluate(async () => {
      const { recordActivity } = await import('/src/features/fitness/activities.js');
      const { getState } = await import('/src/core/state.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const iso = getLocalISODate(getState().fitnessSelectedDate);
      await recordActivity(getState().activities[0].id, iso, {});
    });
    await expect(page.locator('.program-workouts')).toHaveText('1/1');

    // Marking the day as rest excludes it, even though a record exists.
    await page.evaluate(async () => {
      const { dispatch, Actions, getState } = await import('/src/core/state.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const iso = getLocalISODate(getState().fitnessSelectedDate);
      await dispatch(Actions.setRestDay(iso, true));
    });
    await expect(page.locator('.program-workouts')).toHaveText('0/1');
  });

  test('future program shows a countdown, past program shows Completed', async ({ page }) => {
    await openFitness(page);
    await seedActivity(page);
    await makeRoutine(page, 'Push');

    const future = await page.evaluate(() => {
      const d = new Date(Date.now() + 30 * 86400000);
      const iso = (x) => x.toISOString().slice(0, 10);
      return { start: iso(d), end: iso(new Date(d.getTime() + 20 * 86400000)) };
    });
    await createProgram(page, { name: 'Later', ...future, days: [1] });
    await expect(page.locator('#program-tile')).toContainText(/Starts in \d+ days?/);
    await expect(page.locator('.program-percent-pill')).toHaveText('0%');

    // A second program deactivates the first, so only one tile ever renders.
    const past = await page.evaluate(() => {
      const d = new Date(Date.now() - 60 * 86400000);
      const iso = (x) => x.toISOString().slice(0, 10);
      return { start: iso(d), end: iso(new Date(d.getTime() + 20 * 86400000)) };
    });
    await createProgram(page, { name: 'Earlier', ...past, days: [1] });

    await expect(page.locator('#program-tile')).toHaveCount(1);
    await expect(page.locator('#program-tile')).toContainText('Earlier');
    await expect(page.locator('#program-tile')).toContainText('Completed');

    const activeCount = await page.evaluate(
      () => window.appData.programs.filter((p) => p.active).length
    );
    expect(activeCount).toBe(1);
  });

  test('tapping the tile opens the builder pre-populated', async ({ page }) => {
    await openFitness(page);
    await seedActivity(page);
    await makeRoutine(page, 'Push');
    await createProgram(page, {
      name: 'Editable',
      start: '2026-10-20',
      end: '2026-12-13',
      days: [1, 5],
    });

    await page.locator('#program-tile').click();
    await expect(page.locator('#program-builder-modal')).toBeVisible();
    await expect(page.locator('#program-builder-title')).toHaveText('Edit Program');
    await expect(page.locator('#program-name-input')).toHaveValue('Editable');
    await expect(page.locator('#program-start-input')).toHaveValue('2026-10-20');
    await expect(page.locator('#program-end-input')).toHaveValue('2026-12-13');
    await expect(page.locator('#delete-program-btn')).toBeVisible();

    const selected = await page.evaluate(() =>
      [...document.querySelectorAll('.program-day-select')]
        .filter((btn) => !btn.textContent.includes('Rest'))
        .map((btn) => Number(btn.dataset.dayOfWeek))
        .sort()
    );
    expect(selected).toEqual([1, 5]);
  });

  test('deleting the program empties the host', async ({ page }) => {
    await openFitness(page);
    await seedActivity(page);
    await makeRoutine(page, 'Push');
    await createProgram(page, {
      name: 'Temporary',
      start: '2026-10-20',
      end: '2026-12-13',
      days: [1],
    });

    await page.locator('#program-tile').click();
    await page.locator('#delete-program-btn').click();
    await expect(page.locator('#global-confirm-modal')).toContainText('Delete Program?');
    await page.locator('#global-confirm-modal button', { hasText: 'Delete' }).first().click();

    await expect(page.locator('#program-tile')).toHaveCount(0);
    const host = await page.locator('#fitness-program-host').evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      children: el.children.length,
    }));
    expect(host).toEqual({ height: 0, children: 0 });
  });

  test('the tile survives a reload', async ({ page }) => {
    await openFitness(page);
    await seedActivity(page);
    await makeRoutine(page, 'Push');
    await createProgram(page, {
      name: 'Persistent',
      start: '2026-10-20',
      end: '2026-12-13',
      days: [1, 3, 5],
    });
    await expect(page.locator('#program-tile')).toContainText('Persistent');

    // Legacy-mode saves are debounced by 300ms; wait for the write to land so the
    // reload reads a persisted program rather than racing the debounce.
    await page.waitForFunction(() => {
      try {
        const raw = localStorage.getItem('healthyHabitsData');
        return (JSON.parse(raw || '{}').programs || []).length > 0;
      } catch {
        return false;
      }
    });

    await page.reload();
    await page.getByRole('tab', { name: 'Fitness view' }).click();
    await expect(page.locator('#program-tile')).toContainText('Persistent');
    await expect(page.locator('.program-workouts')).toHaveText('0/23');
  });

  test('tile renders without overflow at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openFitness(page);
    await seedActivity(page);
    await makeRoutine(page, 'Push');
    await createProgram(page, {
      name: 'A Very Long Program Name That Should Truncate Cleanly',
      start: '2026-10-20',
      end: '2026-12-13',
      days: [1, 3, 5],
    });

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      tileWidth: document.querySelector('#program-tile').getBoundingClientRect().width,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
    expect(metrics.tileWidth).toBeLessThanOrEqual(375);
  });
});
