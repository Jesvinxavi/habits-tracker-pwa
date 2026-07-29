import { expect, test } from '@playwright/test';
import { expandAllActivityPickerCategories } from './helpers/activityPicker.js';

// Every case provisions its own browser context and deterministic data, so the
// formerly 700-line serial tail can safely spread across Playwright workers.
test.describe.configure({ mode: 'parallel' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-29T12:00:00+01:00'));
});

async function seed(page) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.locator('#fitness-add-menu-btn')).toBeVisible();
  await page.evaluate(async () => {
    const { addActivity } = await import('/src/features/fitness/activities.js');
    const { addRoutine } = await import('/src/features/fitness/routines.js');
    const a = await addActivity({ name: 'Bench Press', categoryId: 'strength', trackingType: 'sets-reps', muscleGroup: 'Chest' });
    const b = await addActivity({ name: 'Treadmill Run', categoryId: 'cardio', trackingType: 'time' });
    await addRoutine({ name: 'Push Day', activityIds: [a.id] });
    await addRoutine({ name: 'Cardio Day', activityIds: [b.id] });
    await addRoutine({ name: 'Core', activityIds: [a.id, b.id] });
  });
}

async function openBuilder(page) {
  await page.locator('#fitness-add-menu-btn').click();
  await page.locator('[data-action="new-program"]').click();
  await expect(page.locator('#program-builder-modal')).toBeVisible();
}

async function chooseForDay(page, day, choice) {
  await page.locator(`.program-day-add[data-day-of-week="${day}"]`).click();
  await page.locator(`.day-add-option[data-choice="${choice}"]`).click();
}

async function pinRoutines(page, day, names) {
  await chooseForDay(page, day, 'routine');
  await expect(page.locator('#routine-picker-modal')).toBeVisible();
  for (const n of names) {
    await page.locator('#routine-picker-list .selectable-routine-item').filter({ hasText: n }).click();
  }
  await page.locator('#confirm-routine-picker').click();
  await expect(page.locator('#routine-picker-modal')).toBeHidden();
}

async function pinActivities(page, day, names) {
  await chooseForDay(page, day, 'activity');
  await expect(page.locator('#activity-picker-modal')).toBeVisible();
  await expandAllActivityPickerCategories(page);
  for (const n of names) {
    await page.locator('#activity-picker-list .selectable-activity-item').filter({ hasText: n }).click();
  }
  await page.locator('#confirm-activity-picker').click();
  await expect(page.locator('#activity-picker-modal')).toBeHidden();
}

function dayRow(page, day) {
  return page.locator(`.program-day-row[data-day-of-week="${day}"]`);
}

test.describe('program scheduling', () => {
  test('the week is expressed only as pinned days', async ({ page }) => {
    await seed(page);
    await openBuilder(page);

    await expect(page.locator('#program-mode-prescriptive')).toHaveCount(0);
    await expect(page.locator('#program-mode-freeform')).toHaveCount(0);
    // The anytime bucket is gone: a session counts anywhere in its week, so a
    // weekly target is just a pinned day.
    await expect(page.locator('#program-anytime-section')).toHaveCount(0);
    await expect(page.locator('#program-add-anytime-btn')).toHaveCount(0);
    await expect(page.locator('#program-schedule-heading')).toHaveText('Weekly schedule');
  });

  test('a program needs at least one pinned item to save', async ({ page }) => {
    await seed(page);
    await openBuilder(page);
    await page.locator('#program-name-input').fill('Empty');
    await expect(page.locator('#save-program-builder')).toBeDisabled();

    await pinRoutines(page, 1, ['Push Day']);
    await expect(page.locator('#save-program-builder')).toBeEnabled();
  });

  test('rest day selector runs Monday to Sunday and trims rows', async ({ page }) => {
    await seed(page);
    await openBuilder(page);

    const buttons = page.locator('#program-rest-day-grid .day-button');
    await expect(buttons).toHaveCount(7);
    // Monday first, Sunday last — the same week the progress view splits on.
    await expect(buttons.nth(0)).toHaveText('M');
    await expect(buttons.nth(0)).toHaveAttribute('data-day', '1');
    await expect(buttons.nth(6)).toHaveText('S');
    await expect(buttons.nth(6)).toHaveAttribute('data-day', '0');
    await expect(page.locator('.program-day-row')).toHaveCount(7);

    // Mark Sunday (0) and Saturday (6) as rest.
    await buttons.nth(6).click();
    await buttons.nth(5).click();
    await expect(buttons.nth(6)).toHaveClass(/selected/);
    await expect(buttons.nth(6)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.program-day-row')).toHaveCount(5);
    await expect(dayRow(page, 0)).toHaveCount(0);
    await expect(dayRow(page, 6)).toHaveCount(0);

    // Unselecting brings the day back.
    await buttons.nth(6).click();
    await expect(page.locator('.program-day-row')).toHaveCount(6);
  });

  test('a day holds one tile per pinned item, with the add button after the last', async ({ page }) => {
    await seed(page);
    await openBuilder(page);
    await pinRoutines(page, 1, ['Push Day', 'Core']);

    const monday = dayRow(page, 1);
    await expect(monday.locator('.program-day-item')).toHaveCount(2);
    await expect(monday.locator('.program-day-item').nth(0)).toContainText('Push Day');
    await expect(monday.locator('.program-day-item').nth(1)).toContainText('Core');

    // The day label owns its own column: the tiles and the add button live in a
    // second one, so a row that wraps never tucks anything under "Mon". The add
    // button still trails the last tile rather than floating right.
    const layout = await page.evaluate(() => {
      const row = document.querySelector('.program-day-row[data-day-of-week="1"]');
      const add = row.querySelector('.program-day-add');
      const label = row.firstElementChild;
      const items = row.lastElementChild;
      return {
        addIsLast: items.contains(add),
        labelText: label.textContent.trim(),
        // Wrapped tiles line up with the first one, clear of the day column.
        itemsClearOfLabel:
          items.getBoundingClientRect().left >= label.getBoundingClientRect().right,
        sameLine:
          Math.abs(
            add.getBoundingClientRect().top +
              add.getBoundingClientRect().height / 2 -
              (label.getBoundingClientRect().top + label.getBoundingClientRect().height / 2)
          ) < 2,
      };
    });
    expect(layout.addIsLast).toBe(true);
    expect(layout.labelText).toBe('Mon');
    expect(layout.sameLine).toBe(true);
    expect(layout.itemsClearOfLabel).toBe(true);

    await expect(page.locator('#save-program-builder')).toBeDisabled();
    await page.locator('#program-name-input').fill('Split');
    await expect(page.locator('#save-program-builder')).toBeEnabled();

    await page.locator('#save-program-builder').click();
    await expect(page.locator('#program-builder-modal')).toBeHidden();

    const stored = await page.evaluate(() => {
      const p = window.__APP_TEST__.getState().programs.find((x) => x.active);
      return { mode: p.scheduleMode, days: p.scheduledDays, rest: p.restDays };
    });
    expect(stored.mode).toBeUndefined();
    expect(stored.days).toHaveLength(2);
    expect(stored.days.every((d) => d.dayOfWeek === 1)).toBe(true);
  });

  test('removing a tile drops just that item', async ({ page }) => {
    await seed(page);
    await openBuilder(page);
    await pinRoutines(page, 1, ['Push Day', 'Core']);

    await dayRow(page, 1).locator('.program-day-item-remove').first().click();
    await expect(dayRow(page, 1).locator('.program-day-item')).toHaveCount(1);
    await expect(dayRow(page, 1).locator('.program-day-item')).toContainText('Core');
  });

  test('individual activities can be pinned alongside routines', async ({ page }) => {
    await seed(page);
    await openBuilder(page);
    await pinRoutines(page, 1, ['Push Day']);
    await pinActivities(page, 1, ['Treadmill Run']);

    await expect(dayRow(page, 1).locator('.program-day-item')).toHaveCount(2);
    await expect(dayRow(page, 1)).toContainText('Treadmill Run');

    await page.locator('#program-name-input').fill('Mixed');
    await page.locator('#save-program-builder').click();

    const days = await page.evaluate(
      () => window.__APP_TEST__.getState().programs.find((x) => x.active).scheduledDays
    );
    expect(days).toHaveLength(2);
    expect(days.filter((d) => d.routineId)).toHaveLength(1);
    expect(days.filter((d) => d.activityId)).toHaveLength(1);
  });

  test('the day pickers name the day in full', async ({ page }) => {
    await seed(page);
    await openBuilder(page);

    await chooseForDay(page, 1, 'routine');
    await expect(page.locator('#routine-picker-title')).toHaveText('Monday Routines');
    await page.locator('#cancel-routine-picker').click();

    await chooseForDay(page, 3, 'activity');
    await expect(page.locator('#activity-picker-title')).toHaveText('Wednesday Activities');
  });

  test('marking a day as rest clears the items pinned to it', async ({ page }) => {
    await seed(page);
    await openBuilder(page);
    await pinRoutines(page, 1, ['Push Day']);
    await expect(dayRow(page, 1)).toContainText('Push Day');

    await page.locator('#program-rest-day-grid .day-button[data-day="1"]').click();
    await expect(dayRow(page, 1)).toHaveCount(0);
    await page.locator('#program-rest-day-grid .day-button[data-day="1"]').click();
    await expect(dayRow(page, 1).locator('.program-day-item')).toHaveCount(0);
  });

  test('edit mode restores rest days and multi-item days', async ({ page }) => {
    await seed(page);
    await openBuilder(page);
    await page.locator('#program-rest-day-grid .day-button[data-day="0"]').click();
    await pinRoutines(page, 1, ['Push Day', 'Core']);
    await pinActivities(page, 3, ['Treadmill Run']);
    await page.locator('#program-name-input').fill('Mixed');
    await page.locator('#save-program-builder').click();
    await expect(page.locator('#program-tile')).toContainText('Mixed');

    await page.locator('#program-tile').click();
    await page.locator('#program-details-edit-btn').click();
    await expect(page.locator('#program-builder-title')).toHaveText('Edit Program');
    await expect(page.locator('#program-rest-day-grid .day-button[data-day="0"]')).toHaveClass(/selected/);
    await expect(dayRow(page, 1).locator('.program-day-item')).toHaveCount(2);
    await expect(dayRow(page, 3)).toContainText('Treadmill Run');
  });
});

test.describe('program week progress', () => {
  // Weeks run Monday to Sunday, so a block anchored to the current calendar week
  // behaves the same whichever day the suite runs on.
  async function makeProgram(page, { pinToToday, weeks = 1 }) {
    const { start, end, weekday } = await page.evaluate(
      async ({ pinToToday: pinToday, weeks: weekCount }) => {
        const { getLocalISODate } = await import('/src/shared/datetime.js');
        const key = (time) => new Date(time).toISOString().slice(0, 10);
        const today = Date.parse(`${getLocalISODate(new Date())}T00:00:00Z`);
        const todayWeekday = new Date(today).getUTCDay();
        const monday = today - ((todayWeekday + 6) % 7) * 86400000;
        return {
          start: key(monday),
          end: key(monday + (weekCount * 7 - 1) * 86400000),
          // Pinning away from today needs a different weekday in the same week.
          weekday: pinToday ? todayWeekday : (todayWeekday === 1 ? 2 : 1),
        };
      },
      { pinToToday, weeks }
    );

    await openBuilder(page);
    await page.locator('#program-start-input').fill(start);
    await page.locator('#program-end-input').fill(end);
    await pinRoutines(page, weekday, ['Push Day']);
    await page.locator('#program-name-input').fill('Block');
    await page.locator('#save-program-builder').click();
    await expect(page.locator('#program-builder-modal')).toBeHidden();
    return { weekday };
  }

  test('the current week opens expanded, showing the days it plans', async ({ page }) => {
    await seed(page);
    await makeProgram(page, { pinToToday: true });
    await page.locator('#program-tile').click();

    const pill = page.locator('.program-week-pill');
    await expect(pill).toHaveCount(1);
    await expect(pill).toHaveAttribute('aria-expanded', 'true');
    await expect(pill).toContainText('Week 1');
    await expect(pill).toContainText('0/1');

    const panel = page.locator('#program-week-panel-1');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.program-week-day')).toHaveCount(1);
    await expect(panel).toContainText('Push Day');
    await expect(panel.locator('.program-week-item.is-done')).toHaveCount(0);

    // The pill collapses and reopens on its own.
    await pill.click();
    await expect(pill).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    await pill.click();
    await expect(panel).toBeVisible();
  });

  test('later weeks stay behind a disclosure, and only one week opens at a time', async ({ page }) => {
    await seed(page);
    await makeProgram(page, { pinToToday: true, weeks: 4 });
    await page.locator('#program-tile').click();

    // Week 1 is the current week, so weeks 2-4 are not on show yet.
    await expect(page.locator('.program-week-pill')).toHaveCount(1);
    const more = page.locator('#program-details-more-weeks-btn');
    await expect(more).toBeVisible();
    await expect(more).toHaveText(/Show 3 later weeks/);

    await more.click();
    await expect(page.locator('.program-week-pill')).toHaveCount(4);
    await expect(more).toHaveText(/Show fewer weeks/);

    // Opening week 2 closes week 1.
    await page.locator('.program-week-pill[data-week="2"]').click();
    await expect(page.locator('.program-week-pill[data-week="2"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.program-week-pill[data-week="1"]')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#program-week-panel-1')).toBeHidden();

    await more.click();
    await expect(page.locator('.program-week-pill')).toHaveCount(1);
  });

  test('recording the day ticks it off and turns the bars green', async ({ page }) => {
    await seed(page);
    await makeProgram(page, { pinToToday: true });
    await page.locator('#program-tile').click();
    await expect(page.locator('#program-details-modal')).toBeVisible();

    // Nothing done yet: both bars carry the behind-schedule red.
    const barColors = () =>
      page.evaluate(() => ({
        overall: getComputedStyle(document.getElementById('program-details-bar')).backgroundColor,
        week: getComputedStyle(
          document.querySelector('.program-week-pill span[style*="width"]')
        ).backgroundColor,
      }));
    expect(await barColors()).toEqual({
      overall: 'rgb(220, 38, 38)',
      week: 'rgb(220, 38, 38)',
    });

    await page.locator('#program-details-add-today-btn').click();

    const done = page.locator('#program-week-panel-1 .program-week-item.is-done');
    await expect(done).toHaveCount(1);
    await expect(done).toContainText('Push Day');
    await expect(page.locator('.program-week-pill')).toContainText('1/1');
    await expect(page.locator('#program-details-percent')).toHaveText('100%');
    expect(await barColors()).toEqual({
      overall: 'rgb(21, 128, 61)',
      week: 'rgb(21, 128, 61)',
    });
  });

  test('a session on another day ticks the day it was pinned to', async ({ page }) => {
    await seed(page);
    // Pinned to a different day of the same week, trained today: the week's work
    // was done, so it counts.
    await makeProgram(page, { pinToToday: false });
    await page.evaluate(async () => {
      const { recordActivitiesForDate } = await import('/src/features/fitness/activities.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const bench = window.__APP_TEST__.getState().activities.find((a) => a.name === 'Bench Press');
      await recordActivitiesForDate([bench.id], getLocalISODate(new Date()));
    });

    await page.locator('#program-tile').click();
    const done = page.locator('#program-week-panel-1 .program-week-item.is-done');
    await expect(done).toHaveCount(1);
    // The tile says which day the tick came from.
    const today = await page.evaluate(async () => {
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      return new Date(`${getLocalISODate(new Date())}T00:00:00.000Z`).toLocaleDateString(
        undefined,
        { weekday: 'short', timeZone: 'UTC' }
      );
    });
    await expect(done).toContainText(today);
    await expect(page.locator('.program-week-pill')).toContainText('1/1');
  });

  test('with nothing scheduled today, the card shows the next session', async ({ page }) => {
    await seed(page);
    // Pinned to another weekday, which recurs inside a two-week block.
    const { weekday } = await makeProgram(page, { pinToToday: false, weeks: 2 });
    await page.locator('#program-tile').click();

    await expect(page.locator('#program-details-session-heading')).toHaveText('Next session');
    const session = page.locator('#program-details-session');
    await expect(session).toContainText('Push Day');
    // The day it lands on is named, since it is not today.
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday];
    await expect(session).toContainText(dayName);
    // Nothing to pull into today, so the button stays out of the way.
    await expect(page.locator('#program-details-add-today-btn')).toBeHidden();
  });

  test('the modal leads with today, whatever day the page is showing', async ({ page }) => {
    await seed(page);
    await makeProgram(page, { pinToToday: true });

    // Move the fitness page a week back; the card still answers for today.
    await page.evaluate(async () => {
      const { dispatch, Actions, getState } = await import('/src/core/state.js');
      const today = getState().fitnessSelectedDate;
      const back = new Date(Date.parse(`${today.slice(0, 10)}T00:00:00Z`) - 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      await dispatch(Actions.setFitnessSelectedDate(`${back}T00:00:00.000`));
    });

    await page.locator('#program-tile').click();
    await expect(page.locator('#program-details-session-heading')).toHaveText('Scheduled for today');
    await expect(page.locator('#program-details-session')).toContainText('Push Day');

    // The session card sits above the progress card, and Edit lives in the
    // header tile rather than at the foot of the modal.
    const order = await page.evaluate(() => {
      const session = document.getElementById('program-details-session-heading').closest('div.space-y-3');
      const progress = document.getElementById('program-details-weeks').closest('div.space-y-2');
      const edit = document.getElementById('program-details-edit-btn');
      return {
        sessionFirst: Boolean(
          session.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
        editInHeader: edit.parentElement.contains(document.getElementById('program-details-name')),
      };
    });
    expect(order.sessionFirst).toBe(true);
    expect(order.editInHeader).toBe(true);
  });
});

test.describe('editing a running program', () => {
  test('past weeks keep the plan they were measured against', async ({ page }) => {
    await seed(page);

    // A block that started two calendar weeks ago, pinned to Monday.
    const { start, end } = await page.evaluate(async () => {
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const key = (time) => new Date(time).toISOString().slice(0, 10);
      const today = Date.parse(`${getLocalISODate(new Date())}T00:00:00Z`);
      const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * 86400000;
      return { start: key(monday - 14 * 86400000), end: key(monday + 13 * 86400000) };
    });

    await openBuilder(page);
    await page.locator('#program-start-input').fill(start);
    await page.locator('#program-end-input').fill(end);
    await pinRoutines(page, 1, ['Push Day']);
    await page.locator('#program-name-input').fill('Block');
    await page.locator('#save-program-builder').click();
    await expect(page.locator('#program-builder-modal')).toBeHidden();

    // Swap Monday's routine for another one.
    await page.locator('#program-tile').click();
    await page.locator('#program-details-edit-btn').click();
    await dayRow(page, 1).locator('.program-day-item-remove').click();
    await pinRoutines(page, 1, ['Cardio Day']);
    await page.locator('#save-program-builder').click();
    await expect(page.locator('#program-builder-modal')).toBeHidden();

    // The edit is stored as history rather than as a rewrite.
    const phases = await page.evaluate(
      () => window.__APP_TEST__.getState().programs.find((p) => p.active).schedulePhases
    );
    expect(phases).toHaveLength(1);
    expect(phases[0].scheduledDays).toHaveLength(1);

    // Saving drops back to the details modal, which is still open.
    await expect(page.locator('#program-details-modal')).toBeVisible();
    await page.locator('#program-details-more-weeks-btn').click();

    // Week 1 is entirely in the past, so it keeps the routine the edit removed.
    await page.locator('.program-week-pill[data-week="1"]').click();
    await expect(page.locator('#program-week-panel-1')).toContainText('Push Day');
    await expect(page.locator('#program-week-panel-1')).not.toContainText('Cardio Day');

    // The last week is entirely in the future, so it carries the new plan only.
    await page.locator('.program-week-pill[data-week="4"]').click();
    await expect(page.locator('#program-week-panel-4')).toContainText('Cardio Day');
    await expect(page.locator('#program-week-panel-4')).not.toContainText('Push Day');
  });

  test('a session recorded under the old plan stays ticked after the edit', async ({ page }) => {
    await seed(page);

    const { start, end, lastMonday } = await page.evaluate(async () => {
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const key = (time) => new Date(time).toISOString().slice(0, 10);
      const today = Date.parse(`${getLocalISODate(new Date())}T00:00:00Z`);
      const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * 86400000;
      return {
        start: key(monday - 14 * 86400000),
        end: key(monday + 13 * 86400000),
        lastMonday: key(monday - 7 * 86400000),
      };
    });

    await openBuilder(page);
    await page.locator('#program-start-input').fill(start);
    await page.locator('#program-end-input').fill(end);
    await pinRoutines(page, 1, ['Push Day']);
    await page.locator('#program-name-input').fill('Block');
    await page.locator('#save-program-builder').click();
    await expect(page.locator('#program-builder-modal')).toBeHidden();

    // Backdate the program's creation to its start, so it reads as one that has
    // been running rather than one just made: a block only credits sessions
    // from the week it was created in onwards.
    await page.evaluate(async (createdAt) => {
      const { updateProgram, getActiveProgram } = await import(
        '/src/features/fitness/programs.js'
      );
      await updateProgram(getActiveProgram().id, { createdAt });
    }, start);

    // Do last Monday's session, back when it was the plan.
    await page.evaluate(async (date) => {
      const { recordActivitiesForDate } = await import('/src/features/fitness/activities.js');
      const bench = window.__APP_TEST__.getState().activities.find((a) => a.name === 'Bench Press');
      await recordActivitiesForDate([bench.id], date);
    }, lastMonday);

    await page.locator('#program-tile').click();
    await page.locator('#program-details-edit-btn').click();
    await dayRow(page, 1).locator('.program-day-item-remove').click();
    await pinRoutines(page, 1, ['Cardio Day']);
    await page.locator('#save-program-builder').click();
    await expect(page.locator('#program-builder-modal')).toBeHidden();

    // Week two is the week that session belongs to, and it is still ticked.
    await page.locator('.program-week-pill[data-week="2"]').click();
    const done = page.locator('#program-week-panel-2 .program-week-item.is-done');
    await expect(done).toHaveCount(1);
    await expect(done).toContainText('Push Day');
  });
});

test.describe('conflicting program dates', () => {
  async function makeProgram(page, name, start, end) {
    await openBuilder(page);
    await page.locator('#program-name-input').fill(name);
    await page.locator('#program-start-input').fill(start);
    await page.locator('#program-end-input').fill(end);
    await pinRoutines(page, 1, ['Push Day']);
    await page.locator('#save-program-builder').click();
  }

  test('an overlapping range offers replace, edit or cancel', async ({ page }) => {
    await seed(page);
    await makeProgram(page, 'First', '2026-10-01', '2026-11-30');
    await expect(page.locator('#program-builder-modal')).toBeHidden();

    // A range that starts inside the first block.
    await makeProgram(page, 'Second', '2026-11-01', '2026-12-31');

    const dialog = page.locator('#global-confirm-modal');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Conflicting Dates');
    await expect(dialog).toContainText('"First"');
    await expect(dialog.locator('.choice-btn')).toHaveCount(2);
    // The destructive option carries the app's red treatment.
    await expect(dialog.locator('.choice-btn').first()).toHaveClass(/bg-red-600/);
    // Dismissal is a corner X, as on the statistics modal, not a third button.
    const dismiss = dialog.locator('.choice-cancel-btn');
    await expect(dismiss).toHaveAttribute('aria-label', 'Cancel');
    await expect(dismiss.locator('svg')).toBeVisible();
    await expect(dismiss).toHaveText('');

    // Dismissing leaves both the builder open and the first program untouched.
    await dismiss.click();
    await expect(page.locator('#program-builder-modal')).toBeVisible();
    expect(await page.evaluate(() => window.__APP_TEST__.getState().programs.length)).toBe(1);
  });

  test('replace deletes the clashing program and saves the new one', async ({ page }) => {
    await seed(page);
    await makeProgram(page, 'First', '2026-10-01', '2026-11-30');
    await makeProgram(page, 'Second', '2026-11-01', '2026-12-31');

    await page.locator('#global-confirm-modal .choice-btn').first().click();
    await expect(page.locator('#program-builder-modal')).toBeHidden();
    await expect(page.locator('#program-tile')).toContainText('Second');

    const names = await page.evaluate(() => window.__APP_TEST__.getState().programs.map((p) => p.name));
    expect(names).toEqual(['Second']);
  });

  test('editing instead reopens the builder on the clashing program', async ({ page }) => {
    await seed(page);
    await makeProgram(page, 'First', '2026-10-01', '2026-11-30');
    await makeProgram(page, 'Second', '2026-11-01', '2026-12-31');

    await page.locator('#global-confirm-modal .choice-btn').nth(1).click();
    await expect(page.locator('#program-builder-title')).toHaveText('Edit Program');
    await expect(page.locator('#program-name-input')).toHaveValue('First');
    // The unsaved second program was discarded rather than stored.
    expect(await page.evaluate(() => window.__APP_TEST__.getState().programs.length)).toBe(1);
  });

  test('editing a program back onto its own dates raises nothing', async ({ page }) => {
    await seed(page);
    await makeProgram(page, 'Only', '2026-10-01', '2026-11-30');

    await page.locator('#program-tile').click();
    await page.locator('#program-details-edit-btn').click();
    await page.locator('#program-name-input').fill('Only, renamed');
    await page.locator('#save-program-builder').click();

    await expect(page.locator('#global-confirm-modal')).toBeHidden();
    await expect(page.locator('#program-tile')).toContainText('Only, renamed');
  });

  test('a range that clears the existing block saves straight through', async ({ page }) => {
    await seed(page);
    await makeProgram(page, 'First', '2026-10-01', '2026-10-31');
    await makeProgram(page, 'Second', '2026-11-01', '2026-11-30');

    await expect(page.locator('#global-confirm-modal')).toBeHidden();
    expect(await page.evaluate(() => window.__APP_TEST__.getState().programs.length)).toBe(2);
  });
});

test.describe('adding a program day', () => {
  async function makeTodayProgram(page) {
    const weekday = await page.evaluate(() => new Date().getDay());
    await openBuilder(page);
    await pinRoutines(page, weekday, ['Push Day']);
    await page.locator('#program-name-input').fill('Today Plan');
    await page.locator('#save-program-builder').click();
    await expect(page.locator('#program-builder-modal')).toBeHidden();
  }

  test('a program never records anything by itself', async ({ page }) => {
    await seed(page);
    await makeTodayProgram(page);
    // Saving a program plans days; it does not fill them. The user adds a
    // session when they do it.
    expect(await page.evaluate(() => Object.values(window.__APP_TEST__.getState().recordedActivities).flat().length)).toBe(0);
  });

  test('the dropdown item records the day\'s scheduled routines', async ({ page }) => {
    await seed(page);
    await makeTodayProgram(page);

    await page.locator('#fitness-add-menu-btn').click();
    await page.locator('[data-action="add-program-day"]').click();

    await expect(page.locator('#activities-list')).toContainText('Bench Press');
    expect(await page.evaluate(() => Object.values(window.__APP_TEST__.getState().recordedActivities).flat().length)).toBe(1);

    // Running it again says so rather than doubling up.
    await page.locator('#fitness-add-menu-btn').click();
    await page.locator('[data-action="add-program-day"]').click();
    await expect(page.locator('#global-confirm-modal')).toContainText('Already Logged');
    expect(await page.evaluate(() => Object.values(window.__APP_TEST__.getState().recordedActivities).flat().length)).toBe(1);
  });

  test('a day holding other training still gets its session added', async ({ page }) => {
    await seed(page);
    await makeTodayProgram(page);

    // Something unrelated is logged first: the program's own session is still
    // outstanding, and adding it tops the day up rather than refusing.
    await page.evaluate(async () => {
      const { recordActivitiesForDate } = await import('/src/features/fitness/activities.js');
      const { getLocalISODate } = await import('/src/shared/datetime.js');
      const run = window.__APP_TEST__.getState().activities.find((a) => a.name === 'Treadmill Run');
      await recordActivitiesForDate([run.id], getLocalISODate(new Date()));
    });

    await page.locator('#program-tile').click();
    await expect(page.locator('#program-details-session-heading')).toHaveText('Scheduled for today');
    await page.locator('#program-details-add-today-btn').click();

    await expect(page.locator('#activities-list')).toContainText('Bench Press');
    await expect(page.locator('#activities-list')).toContainText('Treadmill Run');
    expect(await page.evaluate(() => Object.values(window.__APP_TEST__.getState().recordedActivities).flat().length)).toBe(2);
  });

  test('with no program scheduled for the day it explains itself', async ({ page }) => {
    await seed(page);
    await page.locator('#fitness-add-menu-btn').click();
    await page.locator('[data-action="add-program-day"]').click();
    await expect(page.locator('#global-confirm-modal')).toContainText('Nothing Scheduled');
  });

  test('the details modal adds the current day', async ({ page }) => {
    await seed(page);
    await makeTodayProgram(page);
    await page.locator('#program-tile').click();
    await expect(page.locator('#program-details-add-today-btn')).toBeVisible();
    await page.locator('#program-details-add-today-btn').click();
    await expect(page.locator('#activities-list')).toContainText('Bench Press');
    // Once the day is logged there is nothing left to pull in.
    await expect(page.locator('#program-details-add-today-btn')).toBeHidden();
  });

  test('a day pinned to an activity records that activity too', async ({ page }) => {
    await seed(page);
    const weekday = await page.evaluate(() => new Date().getDay());
    await openBuilder(page);
    await pinActivities(page, weekday, ['Treadmill Run']);
    await page.locator('#program-name-input').fill('Solo');
    await page.locator('#save-program-builder').click();

    await page.locator('#program-tile').click();
    await page.locator('#program-details-add-today-btn').click();
    await expect(page.locator('#activities-list')).toContainText('Treadmill Run');
  });
});
