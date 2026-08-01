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
  // Online, a chunk that will not load means the page is older than the deploy
  // it is asking files from, so the offer is a reload rather than advice about
  // a connection that is demonstrably working.
  await expect(page.locator('.confirm-title')).toHaveText('Update needed');
  await expect(page.locator('.confirm-message')).not.toContainText('connection');
  await page.locator('.confirm-cancel-btn').click();
  await expect(trigger).toBeEnabled();
  await expect(trigger).not.toHaveAttribute('aria-busy', 'true');
});

test('large-account state reads and a 20-card batch stay bounded under 4x CPU throttle', async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    !process.env.FITNESS_PERF,
    'CPU throttling runs in its isolated single-worker performance gate'
  );
  await openFitness(page);
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  try {
    const result = await page.evaluate(async () => {
      const activities = Array.from({ length: 100 }, (_, index) => ({
        id: `browser-activity-${index}`,
        name: `Browser activity ${index}`,
        categoryId: ['cardio', 'strength', 'stretching', 'sports', 'other'][index % 5],
        trackingType: index % 2 ? 'sets-reps' : 'time',
      }));
      const recordedActivities = {};
      for (let day = 0; day < 250; day += 1) {
        const date = new Date(Date.UTC(2025, 0, 1 + day)).toISOString().slice(0, 10);
        recordedActivities[date] = Array.from({ length: 14 }, (_, index) => ({
          id: `browser-record-${day}-${index}`,
          activityId: activities[(day + index) % activities.length].id,
          activityName: activities[(day + index) % activities.length].name,
          categoryId: activities[(day + index) % activities.length].categoryId,
          date,
          timestamp: `${date}T12:00:00.000Z`,
          duration: 30,
          durationUnit: 'minutes',
          notes: 'Deterministic browser benchmark record',
        }));
      }

      const { dispatch, Actions, getState } = await import('/src/core/state.js');
      await dispatch({
        ...Actions.hydrateCache({ activities, recordedActivities }),
        meta: { source: 'test' },
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const readStart = performance.now();
      const snapshot = getState();
      for (let index = 0; index < 1000; index += 1) {
        if (getState() !== snapshot) throw new Error('State snapshot identity changed during reads');
      }
      const thousandReadsMs = performance.now() - readStart;

      const date = getState().fitnessSelectedDate.slice(0, 10);
      const records = activities.slice(0, 20).map((activity, index) => ({
        id: `browser-batch-${index}`,
        activityId: activity.id,
        activityName: activity.name,
        categoryId: activity.categoryId,
        date,
        timestamp: `${date}T12:00:00.000Z`,
      }));
      const batchStart = performance.now();
      await dispatch({
        ...Actions.recordActivities(date, records),
        meta: { source: 'test' },
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const batchToSecondPaintMs = performance.now() - batchStart;

      return {
        accountBytes: JSON.stringify({ activities, recordedActivities }).length,
        thousandReadsMs,
        batchToSecondPaintMs,
        renderedCards: document.querySelectorAll('#activities-list .activity-card').length,
      };
    });

    await testInfo.attach('fitness-performance.json', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    });
    expect(result.accountBytes).toBeGreaterThan(700000);
    expect(result.thousandReadsMs).toBeLessThan(50);
    expect(result.batchToSecondPaintMs).toBeLessThan(500);
    expect(result.renderedCards).toBe(20);
  } finally {
    try {
      await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    } finally {
      await session.detach();
    }
  }
});
