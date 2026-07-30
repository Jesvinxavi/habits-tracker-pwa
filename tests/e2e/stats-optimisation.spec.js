import { expect, test } from '@playwright/test';

test('Stats ignores sync-only noise and never flashes a synchronous loading shimmer', async ({
  page,
}) => {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Stats view' }).click();
  await expect(page.locator('#stats-view')).toBeVisible();
  await expect(page.locator('#stats-container > :first-child')).toBeVisible();
  await expect(page.locator('#stats-container .loading-state')).toHaveCount(0);

  const sameOverviewNode = await page.evaluate(async () => {
    const before = document.querySelector('#stats-container > :first-child');
    const { dispatch, Actions } = await import('/src/core/state.js');
    await dispatch(Actions.setSyncStatus('syncing'));
    const after = document.querySelector('#stats-container > :first-child');
    return before === after;
  });

  expect(sameOverviewNode).toBe(true);
});
