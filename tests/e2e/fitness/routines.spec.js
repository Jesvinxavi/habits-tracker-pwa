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

async function openRoutines(page) {
  await page.locator('#fitness-routines-btn').click();
  await expect(page.locator('#routines-modal')).toBeVisible();
}

async function tileByName(page, name) {
  // The builder no longer embeds a picker; open it, pick, and confirm.
  await page.locator('#routine-add-activities-btn').click();
  await expandAllActivityPickerCategories(page);
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
  test('empty state, with New in the header like the activity library', async ({ page }) => {
    await seed(page);
    await openRoutines(page);

    const list = page.locator('#routines-list');
    await expect(list).toContainText('No routines saved');
    await expect(list).toContainText('Create a new routine to group activities you do together.');

    // New sits in the modal header, as it does on the activity library.
    const inHeader = await page.evaluate(() =>
      Boolean(document.getElementById('new-routine-btn').closest('.modal-header'))
    );
    expect(inHeader).toBe(true);
    await expect(page.locator('#new-routine-btn')).toHaveText(/New/);

    // The search sits between the header and the list.
    const search = page.locator('#routines-filter');
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute('placeholder', 'Search routines...');
    const searchBox = await search.boundingBox();
    const listBox = await list.boundingBox();
    expect(searchBox.y).toBeLessThan(listBox.y);
  });

  test('the search narrows the saved routines', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
      const { addRoutine } = await import('/src/features/fitness/routines.js');
      const push = window.__APP_TEST__.getState().activities.find((a) => a.name === 'Bench Press');
      const run = window.__APP_TEST__.getState().activities.find((a) => a.name === 'Treadmill Run');
      await addRoutine({ name: 'Push Day', activityIds: [push.id] });
      await addRoutine({ name: 'Cardio Day', activityIds: [run.id] });
    });
    await openRoutines(page);

    const cards = page.locator('#routines-list .routine-card');
    await expect(cards).toHaveCount(2);

    const search = page.locator('#routines-filter');
    const clear = page.locator('#routines-filter-clear');
    await expect(clear).toBeHidden();

    await search.fill('card');
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('Cardio Day');
    await expect(clear).toBeVisible();

    await search.fill('nothing here');
    await expect(cards).toHaveCount(0);
    await expect(page.locator('#routines-list')).toContainText('No routines match');

    // Clearing restores the list and keeps the field focused for another go.
    await clear.click();
    await expect(cards).toHaveCount(2);
    await expect(clear).toBeHidden();
    await expect(search).toBeFocused();
  });

  test('routine cards open from both Enter and Space', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
      const { addRoutine } = await import('/src/features/fitness/routines.js');
      const activity = window.__APP_TEST__.getState().activities[0];
      await addRoutine({ name: 'Keyboard Routine', activityIds: [activity.id] });
    });
    await openRoutines(page);

    const card = page.locator('#routines-list .routine-card');
    await card.focus();
    await card.press('Enter');
    await expect(page.locator('#routine-builder-modal')).toBeVisible();
    await page.locator('#cancel-routine-builder').click();

    await card.focus();
    await card.press('Space');
    await expect(page.locator('#routine-builder-modal')).toBeVisible();
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
    // Archived, not erased: the row survives so the days a program planned it
    // on can still resolve it.
    const routines = await page.evaluate(() => window.__APP_TEST__.getState().routines);
    expect(routines).toHaveLength(1);
    expect(routines[0].archivedAt).toBeGreaterThan(0);
  });

  test('archiving an activity leaves the routine usable with a filtered count', async ({ page }) => {
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

    // Remove one of the three activities out from under the routine.
    await page.evaluate(async () => {
      const { archiveActivity, getState } = await Promise.all([
        import('/src/features/fitness/activities.js'),
        import('/src/core/state.js'),
      ]).then(([a, s]) => ({ archiveActivity: a.archiveActivity, getState: s.getState }));
      const target = getState().activities.find((a) => a.name === 'Cycling');
      await archiveActivity(target.id);
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

test.describe('renaming and removing activities', () => {
  async function recordToday(page, name) {
    await page.evaluate(async (activityName) => {
      const { recordActivitiesForDate, getActivity } = await import(
        '/src/features/fitness/activities.js'
      );
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const target = window.__APP_TEST__.getState().activities.find((a) => a.name === activityName);
      await recordActivitiesForDate([target.id], getLocalISODate(new Date()));
      return getActivity(target.id);
    }, name);
  }

  test('renaming an activity renames the sessions already recorded', async ({ page }) => {
    await seed(page);
    await recordToday(page, 'Cycling');
    await expect(page.locator('#activities-list')).toContainText('Cycling');

    await page.evaluate(async () => {
      const { updateActivity } = await import('/src/features/fitness/activities.js');
      const target = window.__APP_TEST__.getState().activities.find((a) => a.name === 'Cycling');
      await updateActivity(target.id, { name: 'Indoor Bike' });
    });

    // The card follows the activity, not the name it was written with.
    await expect(page.locator('#activities-list')).toContainText('Indoor Bike');
    await expect(page.locator('#activities-list')).not.toContainText('Cycling');

    // The record's own snapshot is left alone — it is only a fallback — so the
    // client and the server cannot drift apart on a reload.
    const snapshot = await page.evaluate(
      () => Object.values(window.__APP_TEST__.getState().recordedActivities).flat()[0].activityName
    );
    expect(snapshot).toBe('Cycling');
  });

  test('deleting an activity keeps the sessions it was recorded for', async ({ page }) => {
    await seed(page);
    await recordToday(page, 'Cycling');

    await page.evaluate(async () => {
      const { archiveActivity } = await import('/src/features/fitness/activities.js');
      const target = window.__APP_TEST__.getState().activities.find((a) => a.name === 'Cycling');
      await archiveActivity(target.id);
    });

    // The day still shows the session that happened.
    await expect(page.locator('#activities-list')).toContainText('Cycling');
    const records = await page.evaluate(() =>
      Object.values(window.__APP_TEST__.getState().recordedActivities).flat().length
    );
    expect(records).toBe(1);

    // But the library and the pickers no longer offer it.
    await page.locator('#fitness-activity-btn').click();
    await expect(page.locator('#activity-library-modal')).toBeVisible();
    await page.locator('#activity-library-filter').fill('Cycling');
    await expect(page.locator('#activity-library-content')).not.toContainText('Cycling');
  });
});

test.describe('deleting activities from the library', () => {
  async function deleteFromLibrary(page, name) {
    const library = page.locator('#activity-library-modal');
    // Deleting closes the editor and the details view, leaving the library up.
    if (!(await library.isVisible())) {
      await page.locator('#fitness-activity-btn').click();
    }
    await expect(library).toBeVisible();
    await page.locator('#activity-library-filter').fill(name);
    await page.locator('.search-activity-item').filter({ hasText: name }).first().click();
    await expect(page.locator('#activity-info-modal')).toBeVisible();
    await page.locator('#activity-info-edit-btn').click();
    await expect(page.locator('#add-activity-modal')).toBeVisible();
    await page.locator('#delete-activity-btn').click();
    await page.locator('#global-confirm-modal button', { hasText: 'Delete' }).first().click();
  }

  test('a second delete removes the activity actually on screen', async ({ page }) => {
    await seed(page);

    // The delete button binds once for the page's lifetime; it used to close
    // over the first activity opened, so every later delete hit that one again
    // and left the activity on screen untouched until a reload.
    await deleteFromLibrary(page, 'Cycling');
    await expect(page.locator('#add-activity-modal')).toBeHidden();
    // The details view closes with it rather than describing a deleted activity.
    await expect(page.locator('#activity-info-modal')).toBeHidden();
    await deleteFromLibrary(page, 'Treadmill Run');
    await expect(page.locator('#add-activity-modal')).toBeHidden();

    const archived = await page.evaluate(() =>
      window.__APP_TEST__.getState().activities
        .filter((activity) => activity.archivedAt)
        .map((activity) => activity.name)
        .sort()
    );
    expect(archived).toEqual(['Cycling', 'Treadmill Run']);
  });

  test('a deleted activity keeps its card, marked and inert', async ({ page }) => {
    await seed(page);
    await page.evaluate(async () => {
      const { recordActivitiesForDate } = await import('/src/features/fitness/activities.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const run = window.__APP_TEST__.getState().activities.find((a) => a.name === 'Treadmill Run');
      await recordActivitiesForDate([run.id], getLocalISODate(new Date()));
    });

    const card = page.locator('#activities-list .activity-card').filter({ hasText: 'Treadmill Run' });
    await expect(card).toBeVisible();
    await expect(card.locator('.activity-archived-pill')).toHaveCount(0);

    await page.evaluate(async () => {
      const { archiveActivity } = await import('/src/features/fitness/activities.js');
      const run = window.__APP_TEST__.getState().activities.find((a) => a.name === 'Treadmill Run');
      await archiveActivity(run.id);
    });

    // The session stays on the day, labelled, and no longer opens anything.
    await expect(card).toBeVisible();
    await expect(card.locator('.activity-archived-pill')).toHaveText('Deleted');
    await card.click();
    await expect(page.locator('#activity-details-modal')).toBeHidden();
    await expect(page.locator('#activity-info-modal')).toBeHidden();

    // Swiping it away still works: the session is the user's to remove.
    await expect(page.locator('#activities-list .swipe-container .restore-btn')).toHaveCount(1);
  });
});
