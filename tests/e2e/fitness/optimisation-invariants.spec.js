import { expect, test } from '@playwright/test';

async function openFitness(page) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.locator('#fitness-add-menu-btn')).toBeVisible();
}

test('repeated navigation leaves inactive Home free of hidden renders', async ({ page }) => {
  await openFitness(page);
  for (let visit = 0; visit < 3; visit += 1) {
    await page.getByRole('tab', { name: 'Home view' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
    await page.getByRole('tab', { name: 'Fitness view' }).click();
    await expect(page.locator('#fitness-view')).toBeVisible();
  }

  const mutationCallbacks = await page.evaluate(async () => {
    const home = document.getElementById('home-view');
    let deliveries = 0;
    const observer = new MutationObserver(() => {
      deliveries += 1;
    });
    observer.observe(home, { childList: true, subtree: true, attributes: true });
    const { dispatch, Actions, getState } = await import('/src/core/state.js');
    await dispatch(Actions.updateSettings({
      hideCompleted: !getState().settings.hideCompleted,
    }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    observer.disconnect();
    return deliveries;
  });
  expect(mutationCallbacks).toBe(0);
});

test('one atomic activity batch produces one activities-list render delivery', async ({ page }) => {
  await openFitness(page);
  await page.evaluate(async () => {
    const { addActivity } = await import('/src/features/fitness/activities.js');
    await addActivity({ name: 'Atomic One', categoryId: 'cardio', trackingType: 'time' });
    await addActivity({ name: 'Atomic Two', categoryId: 'cardio', trackingType: 'time' });
  });

  const deliveries = await page.evaluate(async () => {
    const list = document.getElementById('activities-list');
    let renderDeliveries = 0;
    const observer = new MutationObserver(() => {
      renderDeliveries += 1;
    });
    observer.observe(list, { childList: true, subtree: true });

    const { dispatch, Actions, getState } = await import('/src/core/state.js');
    const date = getState().fitnessSelectedDate.slice(0, 10);
    const records = getState().activities.slice(0, 2).map((activity, index) => ({
      id: `atomic-${index}`,
      activityId: activity.id,
      activityName: activity.name,
      categoryId: activity.categoryId,
      date,
      timestamp: `${date}T12:00:00.000Z`,
    }));
    await dispatch(Actions.recordActivities(date, records));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    observer.disconnect();
    return renderDeliveries;
  });

  expect(deliveries).toBe(1);
  await expect(page.locator('#activities-list .activity-card')).toHaveCount(2);
});

test('a failed lazy modal chunk reports a recoverable error and restores its trigger', async ({
  page,
}) => {
  await page.route('**/src/features/fitness/Modals/ActivityLibraryModal.js*', (route) =>
    route.abort('failed')
  );
  await openFitness(page);

  const trigger = page.locator('#fitness-activity-btn');
  await trigger.click();
  await expect(page.locator('#global-confirm-modal')).toBeVisible();
  await expect(page.locator('.confirm-title')).toHaveText('Unable to Open');
  await expect(page.locator('.confirm-message')).toContainText('Check your connection');
  await page.locator('.confirm-ok-btn').click();
  await expect(trigger).toBeEnabled();
  await expect(trigger).not.toHaveAttribute('aria-busy', 'true');
});
