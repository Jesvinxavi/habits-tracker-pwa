import { expect, test } from '@playwright/test';

async function seed(page, history = []) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.locator('#fitness-activity-btn')).toBeVisible();
  await page.evaluate(async (sessions) => {
    const { addActivity, recordActivity } = await import('/src/features/fitness/activities.js');
    const activity = await addActivity({
      name: 'Bench Press',
      categoryId: 'strength',
      trackingType: 'sets-reps',
      muscleGroup: 'Chest',
      units: 'kg',
    });
    for (const session of sessions) {
      await recordActivity(activity.id, session.date, {
        sets: [{ reps: 5, value: session.weight, unit: 'kg' }],
      });
    }
  }, history);
}

// The details modal logs straight onto the schedule; the record form is reached
// by tapping the resulting card.
async function addToSchedule(page) {
  await page.locator('#fitness-activity-btn').click();
  const section = page.locator('#activity-library-content .search-category-section').first();
  if (await section.evaluate((el) => el.classList.contains('collapsed'))) {
    await section.locator('.search-expand-btn').click();
  }
  await page.locator('.search-activity-item').first().click();
  await expect(page.locator('#activity-info-modal')).toBeVisible();
  await page.locator('#activity-info-record-btn').click();
  await expect(page.locator('#activity-info-modal')).toBeHidden();
  await expect(page.locator('#activity-library-modal')).toBeHidden();
}

async function openRecordModal(page) {
  if ((await page.locator('#activities-list .activity-card').count()) === 0) {
    await addToSchedule(page);
  }
  await page.locator('#activities-list .activity-card').first().click();
  await expect(page.locator('#activity-details-modal')).toBeVisible();
}

test.describe('record activity modal', () => {
  test('Add Set adds exactly one row, however often the modal has been opened', async ({
    page,
  }) => {
    await seed(page);

    // Open and close a few times first: the handlers used to rebind on every
    // open, so the third visit added three rows per click.
    for (let i = 0; i < 3; i += 1) {
      await openRecordModal(page);
      await page.locator('#cancel-activity-details').click();
      await expect(page.locator('#activity-details-modal')).toBeHidden();
    }

    await openRecordModal(page);
    await expect(page.locator('#sets-container .set-item')).toHaveCount(1);

    await page.locator('#add-set-btn').click();
    await expect(page.locator('#sets-container .set-item')).toHaveCount(2);
    await page.locator('#add-set-btn').click();
    await expect(page.locator('#sets-container .set-item')).toHaveCount(3);

    // Rows read as a table: a set-number column, then the inputs.
    await expect(page.locator('#sets-container .set-item').nth(0).locator('.set-label')).toHaveText(
      'Set 1'
    );
    await expect(page.locator('#sets-container .set-item').nth(2).locator('.set-label')).toHaveText(
      'Set 3'
    );
    // The first row's remove control is inert, so a set always remains.
    await expect(page.locator('.remove-set-btn').first()).toBeDisabled();

    // Removing takes one away, and the rows renumber.
    await page.locator('.remove-set-btn:not([disabled])').first().click();
    await expect(page.locator('#sets-container .set-item')).toHaveCount(2);
    await expect(page.locator('#sets-container .set-item').nth(0).locator('.set-label')).toHaveText(
      'Set 1'
    );
    await expect(page.locator('#sets-container .set-item').nth(1).locator('.set-label')).toHaveText(
      'Set 2'
    );
  });

  test('the form resets between visits rather than reusing the last set count', async ({
    page,
  }) => {
    await seed(page);
    await openRecordModal(page);
    await page.locator('#add-set-btn').click();
    await expect(page.locator('#sets-container .set-item')).toHaveCount(2);

    await page.locator('#cancel-activity-details').click();
    await openRecordModal(page);
    await expect(page.locator('#sets-container .set-item')).toHaveCount(1);
  });

  test('the details modal logs straight onto the schedule', async ({ page }) => {
    await seed(page);

    await page.locator('#fitness-activity-btn').click();
    const section = page.locator('#activity-library-content .search-category-section').first();
    await section.locator('.search-expand-btn').click();
    await page.locator('.search-activity-item').first().click();

    await expect(page.locator('#activity-info-record-btn')).toContainText(
      'Record to today’s schedule'
    );
    await page.locator('#activity-info-record-btn').click();

    // One tap: the record form never appears, and both modals step out of the
    // way so the new card is visible.
    await expect(page.locator('#activity-details-modal')).toBeHidden();
    await expect(page.locator('#activity-info-modal')).toBeHidden();
    await expect(page.locator('#activity-library-modal')).toBeHidden();
    await expect(page.locator('#activities-list')).toContainText('Bench Press');

    // The bare card invites the detail it does not have yet.
    await expect(page.locator('#activities-list .add-details-prompt')).toBeVisible();
    await expect(page.locator('#activities-list .add-details-prompt')).toContainText(
      'Add sets & details'
    );

    // And tapping it opens the record form.
    await page.locator('#activities-list .activity-card').first().click();
    await expect(page.locator('#activity-details-modal')).toBeVisible();
  });

  test('it logs to today even when the page is showing another day', async ({ page }) => {
    await seed(page);

    // Move the page a week back, then record from the details modal.
    await page.evaluate(async () => {
      const { dispatch, Actions } = await import('/src/core/state.js');
      const past = new Date(Date.now() - 7 * 86400000);
      past.setHours(0, 0, 0, 0);
      const { getLocalMidnightISOString } = await import('/src/shared/datetime.js');
      await dispatch(Actions.setFitnessSelectedDate(getLocalMidnightISOString(past)));
    });

    await page.locator('#fitness-activity-btn').click();
    await page.locator('#activity-library-content .search-expand-btn').first().click();
    await page.locator('.search-activity-item').first().click();
    await page.locator('#activity-info-record-btn').click();
    await expect(page.locator('#activity-info-modal')).toBeHidden();

    // The record lands on today, and the page follows so the card is visible.
    const landed = await page.evaluate(async () => {
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const today = getLocalISODate(new Date());
      return {
        onToday: (window.__APP_TEST__.getState().recordedActivities[today] || []).length,
        otherDays: Object.entries(window.__APP_TEST__.getState().recordedActivities)
          .filter(([date, records]) => date !== today && records.length > 0)
          .map(([date]) => date),
        selected: getLocalISODate(window.__APP_TEST__.getState().fitnessSelectedDate),
        today,
      };
    });
    expect(landed.onToday).toBe(1);
    expect(landed.otherDays).toEqual([]);
    expect(landed.selected).toBe(landed.today);
    await expect(page.locator('#activities-list')).toContainText('Bench Press');
  });

  test('the prompt gives way once metrics are filled in', async ({ page }) => {
    await seed(page);
    await openRecordModal(page);
    await page.locator('input[name="reps-set-1"]').fill('10');
    await page.locator('input[name="value-set-1"]').fill('60');
    await page.locator('#save-activity-details').click();
    await expect(page.locator('#activity-details-modal')).toBeHidden();

    await expect(page.locator('#activities-list .add-details-prompt')).toHaveCount(0);
    await expect(page.locator('#activities-list')).toContainText('10 reps');
  });

  test('the header tile opens the activity details', async ({ page }) => {
    await seed(page);
    await openRecordModal(page);
    await expect(page.locator('#activity-info-modal')).toBeHidden();

    await page.locator('#activity-details-info-tile').click();
    await expect(page.locator('#activity-details-modal')).toBeHidden();
    await expect(page.locator('#activity-info-modal')).toBeVisible();
    await expect(page.locator('#activity-info-name')).toHaveText('Bench Press');
  });

  test('each card edits its own record rather than the last one opened', async ({ page }) => {
    await seed(page);

    // Two separate records of the same activity on the same day.
    await addToSchedule(page);
    await addToSchedule(page);
    await expect(page.locator('#activities-list .activity-card')).toHaveCount(2);

    // Fill the first, then the second. Edit state left behind from the first
    // used to make the second save overwrite it.
    await page.locator('#activities-list .activity-card').nth(0).click();
    await page.locator('input[name="reps-set-1"]').fill('8');
    await page.locator('#save-activity-details').click();
    await expect(page.locator('#activity-details-modal')).toBeHidden();

    await page.locator('#activities-list .activity-card').nth(1).click();
    await page.locator('input[name="reps-set-1"]').fill('12');
    await page.locator('#save-activity-details').click();
    await expect(page.locator('#activity-details-modal')).toBeHidden();

    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.values(window.__APP_TEST__.getState().recordedActivities)
            .flat()
            .map((r) => r.sets?.[0]?.reps ?? null)
            .sort((a, b) => a - b)
        )
      )
      .toEqual([8, 12]);
  });

  test('best and last figures show once there is history', async ({ page }) => {
    await seed(page, [
      { date: '2026-07-01', weight: 60 },
      { date: '2026-07-08', weight: 82.5 },
      { date: '2026-07-15', weight: 75 },
    ]);
    await openRecordModal(page);

    const highlights = page.locator('#activity-details-highlights');
    await expect(highlights).toBeVisible();
    // Best is the heaviest across every session, last is the most recent one —
    // which is deliberately not the same session here.
    await expect(page.locator('#activity-details-best')).toHaveText('82.5 kg');
    await expect(page.locator('#activity-details-last')).toHaveText('75 kg');
    await expect(page.locator('#activity-details-last-label')).toHaveText('Last · 15/07');
  });

  test('Last follows the most recent trained day, not the last one typed', async ({ page }) => {
    await seed(page);

    // Enter the older session second, so entry order and date order disagree.
    await page.evaluate(async () => {
      const { recordActivity } = await import('/src/features/fitness/activities.js');
      const { getState } = await import('/src/core/state.js');
      const id = getState().activities[0].id;
      await recordActivity(id, '2026-07-20', { sets: [{ reps: 5, value: 90, unit: 'kg' }] });
      await recordActivity(id, '2026-07-05', { sets: [{ reps: 5, value: 55, unit: 'kg' }] });
    });

    await openRecordModal(page);
    await expect(page.locator('#activity-details-best')).toHaveText('90 kg');
    await expect(page.locator('#activity-details-last')).toHaveText('90 kg');
    await expect(page.locator('#activity-details-last-label')).toHaveText('Last · 20/07');
  });

  test('Last ignores sessions dated after today', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
      const { recordActivity } = await import('/src/features/fitness/activities.js');
      const { getState } = await import('/src/core/state.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const id = getState().activities[0].id;
      const day = (offset) =>
        getLocalISODate(new Date(Date.now() + offset * 86400000));
      await recordActivity(id, day(-3), { sets: [{ reps: 5, value: 70, unit: 'kg' }] });
      // A session planned ahead has not happened yet.
      await recordActivity(id, day(5), { sets: [{ reps: 5, value: 100, unit: 'kg' }] });
    });

    await openRecordModal(page);
    await expect(page.locator('#activity-details-last')).toHaveText('70 kg');
  });

  test('Best takes the smallest figure when lower is better', async ({ page }) => {
    await page.goto('/?test=true');
    await page.getByRole('tab', { name: 'Fitness view' }).click();
    await expect(page.locator('#fitness-activity-btn')).toBeVisible();

    // A 5k: the improvement is a smaller time. Dated relative to today so the
    // most recent session leaves a card on the schedule to open.
    await page.evaluate(async () => {
      const { addActivity, recordActivity } = await import('/src/features/fitness/activities.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const day = (offset) => getLocalISODate(new Date(Date.now() + offset * 86400000));
      const activity = await addActivity({
        name: '5k Run',
        categoryId: 'cardio',
        trackingType: 'time',
        betterDirection: 'lower',
      });
      await recordActivity(activity.id, day(-14), { duration: 31, durationUnit: 'minutes' });
      await recordActivity(activity.id, day(-7), { duration: 26, durationUnit: 'minutes' });
      await recordActivity(activity.id, day(0), { duration: 28, durationUnit: 'minutes' });
    });

    await page.locator('#activities-list .activity-card').first().click();
    await expect(page.locator('#activity-details-modal')).toBeVisible();
    await expect(page.locator('#activity-details-best')).toHaveText('26 min');
    // Last still follows the calendar, not the ranking.
    await expect(page.locator('#activity-details-last')).toHaveText('28 min');

    // The statistics modal ranks the same way.
    await page.locator('#activity-details-info-tile').click();
    await page.locator('#activity-info-stats-btn').click();
    await expect(page.locator('#activity-stats-modal')).toContainText('Quickest session');
    // The statistics modal formats every duration the same way the rest of the
    // app does, so 26 minutes reads as "26m" here rather than "26 min".
    await expect(page.locator('#activity-stats-modal')).toContainText('26m');
  });

  test('higher stays the default for time activities', async ({ page }) => {
    await page.goto('/?test=true');
    await page.getByRole('tab', { name: 'Fitness view' }).click();
    await expect(page.locator('#fitness-activity-btn')).toBeVisible();

    await page.evaluate(async () => {
      const { addActivity, recordActivity } = await import('/src/features/fitness/activities.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const day = (offset) => getLocalISODate(new Date(Date.now() + offset * 86400000));
      const activity = await addActivity({
        name: 'Plank',
        categoryId: 'other',
        trackingType: 'time',
      });
      await recordActivity(activity.id, day(-7), { duration: 4, durationUnit: 'minutes' });
      await recordActivity(activity.id, day(0), { duration: 2, durationUnit: 'minutes' });
    });

    await page.locator('#activities-list .activity-card').first().click();
    await expect(page.locator('#activity-details-best')).toHaveText('4 min');
  });

  test('the editor offers the direction only for time activities', async ({ page }) => {
    await seed(page);

    await page.locator('#fitness-activity-btn').click();
    await page.locator('#library-new-activity-btn').click();
    await expect(page.locator('#add-activity-modal')).toBeVisible();

    await page.locator('#activity-name-input').fill('5k Run');
    await page.locator('#activity-category-select').selectOption('cardio');
    // Cardio defaults to time tracking, so the choice is offered.
    await expect(page.locator('#direction-section')).toBeVisible();
    await expect(page.locator('#direction-higher-toggle')).toHaveAttribute('aria-pressed', 'true');

    // Sets and reps have no direction to choose: more is always the improvement.
    await page.locator('#sets-reps-toggle').click();
    await expect(page.locator('#direction-section')).toBeHidden();
    await page.locator('#time-toggle').click();
    await expect(page.locator('#direction-section')).toBeVisible();

    await page.locator('#direction-lower-toggle').click();
    await expect(page.locator('#direction-lower-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#save-add-activity').click();
    await expect(page.locator('#add-activity-modal')).toBeHidden();

    await expect
      .poll(() =>
        page.evaluate(
          () => window.__APP_TEST__.getState().activities.find((a) => a.name === '5k Run')?.betterDirection
        )
      )
      .toBe('lower');

    // And it comes back when the activity is reopened for editing.
    await page.locator('#activity-library-filter').fill('5k');
    await page.locator('.search-activity-item').first().click();
    await page.locator('#activity-info-edit-btn').click();
    await expect(page.locator('#direction-lower-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the figures stay hidden for an activity with no history', async ({ page }) => {
    await seed(page);
    await openRecordModal(page);
    await expect(page.locator('#activity-details-highlights')).toBeHidden();
  });

  test('a rest day refuses recording from any surface', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
      const { toggleRestDay } = await import('/src/shared/restDays.js');
      const { getState } = await import('/src/core/state.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      await toggleRestDay(getLocalISODate(getState().fitnessSelectedDate));
    });

    await page.locator('#fitness-activity-btn').click();
    const section = page.locator('#activity-library-content .search-category-section').first();
    if (await section.evaluate((el) => el.classList.contains('collapsed'))) {
      await section.locator('.search-expand-btn').click();
    }
    await page.locator('.search-activity-item').first().click();
    await page.locator('#activity-info-record-btn').click();

    await expect(page.locator('#global-confirm-modal')).toContainText('Rest Day');
    await expect(page.locator('#activity-details-modal')).toBeHidden();
  });
});
