import { expect, test } from '@playwright/test';

async function openHome(page) {
  await page.goto('/?test=true');
  await expect(page.locator('#home-view')).toBeVisible();
}

async function seedHabit(page, { target = null } = {}) {
  return page.evaluate(async (targetValue) => {
    const { dispatch, Actions, getState } = await import('/src/core/state.js');
    const suffix = Math.random().toString(36).slice(2);
    const categoryId = `home-category-${suffix}`;
    const habitId = `home-habit-${suffix}`;
    const selectedDate = getState().selectedDate.slice(0, 10);
    await dispatch(
      Actions.addCategory({ id: categoryId, name: 'Health', color: '#2563EB' })
    );
    await dispatch(
      Actions.addHabit({
        id: habitId,
        categoryId,
        name: targetValue ? 'Water target' : 'Morning walk',
        frequency: 'daily',
        createdAt: selectedDate,
        icon: targetValue ? '💧' : '🚶',
        paused: false,
        activeOnHolidays: true,
        completed: {},
        progress: {},
        skippedDates: [],
        ...(targetValue
          ? {
              target: targetValue,
              targetFrequency: 'daily',
              targetUnit: 'glasses',
              defaultIncrement: 1,
            }
          : {}),
      })
    );
    return { habitId, categoryId, selectedDate };
  }, target);
}

async function revealAction(page, habitId) {
  const slide = page.locator(`[data-habit-id="${habitId}"]`).locator('..');
  const box = await slide.boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
}

function actionButton(page, habitId, selector) {
  return page
    .locator(`[data-habit-id="${habitId}"]`)
    .locator('..')
    .locator('..')
    .locator(selector);
}

test.describe('Home updates', () => {
  test('complete, restore, skip, and restore move a habit between the correct sections', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHome(page);
    const { habitId } = await seedHabit(page);
    const card = page.locator(`[data-habit-id="${habitId}"]`);

    await expect(card).toBeVisible();
    await card.locator('.complete-toggle').click();
    await expect(page.locator('.section-pill-btn.selected')).toContainText('Completed');
    await expect(card).toContainText('Completed');

    await revealAction(page, habitId);
    const swipeGeometry = await actionButton(page, habitId, '.restore-btn').evaluate((button) => {
      const wrapper = button.parentElement;
      const slide = wrapper.querySelector('.swipe-slide');
      const cardNode = slide.querySelector('.habit-card');
      const wrapperRect = wrapper.getBoundingClientRect();
      const cardRect = cardNode.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const wrapperStyle = getComputedStyle(wrapper);
      const buttonStyle = getComputedStyle(button);
      return {
        wrapperHeight: wrapperRect.height,
        cardHeight: cardRect.height,
        cardLeft: cardRect.left,
        wrapperLeft: wrapperRect.left,
        buttonHeight: buttonRect.height,
        wrapperBackground: wrapperStyle.backgroundColor,
        wrapperOverflow: wrapperStyle.overflow,
        buttonBorderWidth: buttonStyle.borderTopWidth,
        buttonTopLeftRadius: buttonStyle.borderTopLeftRadius,
      };
    });
    expect(Math.abs(swipeGeometry.wrapperHeight - swipeGeometry.cardHeight)).toBeLessThan(1);
    expect(Math.abs(swipeGeometry.buttonHeight - swipeGeometry.cardHeight)).toBeLessThan(1);
    expect(swipeGeometry.cardLeft).toBeGreaterThanOrEqual(swipeGeometry.wrapperLeft);
    expect(swipeGeometry.cardLeft).toBeGreaterThanOrEqual(0);
    expect(swipeGeometry.wrapperBackground).toBe('rgba(0, 0, 0, 0)');
    expect(swipeGeometry.wrapperOverflow).toBe('visible');
    expect(swipeGeometry.buttonBorderWidth).toBe('2px');
    expect(swipeGeometry.buttonTopLeftRadius).toBe('0px');
    await page.locator('.restore-btn').click();
    await expect(page.locator('.section-pill-btn.selected')).toContainText('Anytime');
    await expect(card.locator('.complete-toggle')).toBeVisible();

    await revealAction(page, habitId);
    await page.locator('.skip-btn').click();
    await expect(page.locator('.section-pill-btn.selected')).toContainText('Skipped');
    await expect(card).toContainText('Skipped');

    await revealAction(page, habitId);
    await page.locator('.restore-btn').click();
    await expect(page.locator('.section-pill-btn.selected')).toContainText('Anytime');

    const entry = await page.evaluate((id) => {
      const habit = window.__APP_TEST__.getState().habits.find((item) => item.id === id);
      return {
        completed: Object.values(habit.completed).filter(Boolean).length,
        skipped: habit.skippedDates.length,
      };
    }, habitId);
    expect(entry).toEqual({ completed: 0, skipped: 0 });
  });

  test('puts the add menu beside the group pill and leaves theme control in Profile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHome(page);
    const metrics = await page.evaluate(() => {
      const box = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return {
          x: rect.x,
          right: rect.right,
          centerY: rect.y + rect.height / 2,
        };
      };
      return { pill: box('#group-pill'), add: box('#menu-toggle') };
    });
    expect(metrics.add.x).toBeGreaterThan(metrics.pill.right);
    expect(metrics.add.x - metrics.pill.right).toBeLessThan(12);
    expect(Math.abs(metrics.add.centerY - metrics.pill.centerY)).toBeLessThan(2);
    const addStyle = await page.locator('#menu-toggle').evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
      };
    });
    expect(addStyle).toEqual({
      width: 36,
      height: 36,
      backgroundColor: 'rgb(239, 246, 255)',
      borderRadius: '50%',
    });
    await expect(page.locator('#theme-toggle')).toHaveCount(0);
    const titleLayout = await page
      .getByRole('heading', { name: 'Healthy Habits Tracker' })
      .evaluate((node) => ({
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        whiteSpace: getComputedStyle(node).whiteSpace,
        fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
      }));
    expect(titleLayout.whiteSpace).toBe('nowrap');
    expect(titleLayout.scrollWidth).toBeLessThanOrEqual(titleLayout.clientWidth);
    expect(titleLayout.fontSize).toBeGreaterThanOrEqual(24);

    await page.getByRole('tab', { name: 'Profile view' }).click();
    const darkMode = page.locator('[data-setting="darkMode"]');
    await expect(darkMode).toBeVisible();
    const themeBefore = await page.locator('html').getAttribute('data-theme');
    await darkMode.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', themeBefore);
  });

  test('restores two skipped habits without duplicate or phantom cards on mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHome(page);
    const first = await seedHabit(page);
    const second = await seedHabit(page);

    await revealAction(page, first.habitId);
    await actionButton(page, first.habitId, '.skip-btn').click();
    await expect(page.locator(`[data-habit-id="${first.habitId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-habit-id="${second.habitId}"]`)).toBeVisible();

    await revealAction(page, second.habitId);
    await actionButton(page, second.habitId, '.skip-btn').click();
    await expect(page.locator('.section-pill-btn.selected')).toContainText('Skipped');
    await expect(page.locator('[data-habit-id]')).toHaveCount(2);

    await revealAction(page, first.habitId);
    await actionButton(page, first.habitId, '.restore-btn').click();
    await expect(page.locator(`[data-habit-id="${first.habitId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-habit-id="${second.habitId}"]`)).toBeVisible();
    await expect(page.locator('.section-pill-btn.selected')).toContainText('Skipped');

    await revealAction(page, second.habitId);
    await actionButton(page, second.habitId, '.restore-btn').click();
    await expect(page.locator('.section-pill-btn.selected')).toContainText('Anytime');
    await expect(page.locator(`[data-habit-id="${first.habitId}"]`)).toHaveCount(1);
    await expect(page.locator(`[data-habit-id="${second.habitId}"]`)).toHaveCount(1);

    const finalEntries = await page.evaluate(
      (ids) =>
        window.__APP_TEST__.getState().habits
          .filter((habit) => ids.includes(habit.id))
          .map((habit) => ({
            id: habit.id,
            completed: Object.values(habit.completed).filter(Boolean).length,
            skipped: habit.skippedDates.length,
          })),
      [first.habitId, second.habitId]
    );
    expect(finalEntries).toEqual(
      expect.arrayContaining([
        { id: first.habitId, completed: 0, skipped: 0 },
        { id: second.habitId, completed: 0, skipped: 0 },
      ])
    );
  });

  test('renders a larger target counter and preserves an archived habit on earlier dates', async ({
    page,
  }) => {
    await openHome(page);
    const { habitId, selectedDate } = await seedHabit(page, { target: 8 });
    const counter = page.locator(`[data-habit-id="${habitId}"] .progress-box`);
    await expect(counter).toHaveText('0/8');
    expect(Number.parseFloat(await counter.evaluate((node) => getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(18);

    const previousDate = await page.evaluate(
      async ({ id, selected }) => {
        const { dispatch, Actions } = await import('/src/core/state.js');
        const previous = new Date(`${selected}T12:00:00`);
        previous.setDate(previous.getDate() - 1);
        const previousKey = previous.toISOString().slice(0, 10);
        await dispatch(Actions.toggleHabitCompleted(id, previousKey));
        await dispatch(Actions.deleteHabit(id, Date.now()));
        return previousKey;
      },
      { id: habitId, selected: selectedDate }
    );

    await expect(page.locator(`[data-habit-id="${habitId}"]`)).toHaveCount(0);
    await page.evaluate(async (date) => {
      const { dispatch, Actions } = await import('/src/core/state.js');
      await dispatch(Actions.setSelectedDate(`${date}T00:00:00.000`));
    }, previousDate);
    await expect(page.locator(`[data-habit-id="${habitId}"]`)).toContainText('Completed');

    const preserved = await page.evaluate((id) => {
      const habit = window.__APP_TEST__.getState().habits.find((item) => item.id === id);
      return { archived: Boolean(habit.archivedAt), completed: habit.completed };
    }, habitId);
    expect(preserved.archived).toBe(true);
    expect(preserved.completed[previousDate]).toBe(true);
  });
});
