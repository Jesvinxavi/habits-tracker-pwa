import { devices, expect, test } from '@playwright/test';

async function seedRecordedActivity(page) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.locator('#fitness-activity-btn')).toBeVisible();
  await page.evaluate(async () => {
    const { addActivity, recordActivitiesForDate } = await import(
      '/src/features/fitness/activities.js'
    );
    const { getLocalISODate } = await import('/src/shared/datetime.js');
    const activity = await addActivity({
      name: 'Touch Run',
      categoryId: 'cardio',
      trackingType: 'time',
    });
    await recordActivitiesForDate([activity.id], getLocalISODate(new Date()));
  });
  await expect(page.locator('#activities-list .activity-card')).toHaveCount(1);
}

async function revealDelete(page) {
  const slide = page.locator('#activities-list .swipe-slide').first();
  const box = await slide.boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
}

test('Fitness activity slider matches Home and accepts a touch delete', async ({ browser }) => {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    baseURL: 'http://127.0.0.1:4173',
    timezoneId: 'Europe/London',
  });
  const page = await context.newPage();

  try {
    await seedRecordedActivity(page);
    const wrapper = page.locator('#activities-list .fitness-swipe-container');
    const card = wrapper.locator('.activity-card');
    const deleteButton = wrapper.locator('.fitness-swipe-action');
    const label = deleteButton.locator('.fitness-swipe-action-label');
    const closedLeft = await card.evaluate((node) => node.getBoundingClientRect().left);

    await revealDelete(page);
    await expect(wrapper).toHaveClass(/swipe-revealed/);

    const geometry = await wrapper.evaluate((node) => {
      const cardNode = node.querySelector('.activity-card');
      const button = node.querySelector('.fitness-swipe-action');
      const labelNode = node.querySelector('.fitness-swipe-action-label');
      const wrapperRect = node.getBoundingClientRect();
      const cardRect = cardNode.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const labelRect = labelNode.getBoundingClientRect();
      return {
        wrapperBackground: getComputedStyle(node).backgroundColor,
        wrapperLeft: wrapperRect.left,
        cardLeft: cardRect.left,
        buttonWidth: buttonRect.width,
        buttonHeight: buttonRect.height,
        buttonBackground: getComputedStyle(button).backgroundColor,
        buttonPadding: getComputedStyle(button).paddingTop,
        labelWidth: labelRect.width,
        labelHeight: labelRect.height,
        labelBackground: getComputedStyle(labelNode).backgroundColor,
        actionZIndex: getComputedStyle(button).zIndex,
      };
    });

    expect(geometry.wrapperBackground).toBe('rgb(184, 190, 200)');
    expect(geometry.cardLeft).toBeLessThan(closedLeft);
    expect(geometry.cardLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.cardLeft).toBeLessThan(geometry.wrapperLeft);
    expect(geometry.buttonBackground).toBe('rgb(184, 190, 200)');
    expect(geometry.buttonPadding).toBe('5px');
    expect(geometry.labelWidth).toBeLessThan(geometry.buttonWidth);
    expect(geometry.labelHeight).toBeLessThan(geometry.buttonHeight);
    expect(geometry.labelBackground).toBe('rgb(220, 38, 38)');
    expect(geometry.actionZIndex).toBe('2');

    await label.tap();
    await expect(page.locator('#activities-list .activity-card')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
