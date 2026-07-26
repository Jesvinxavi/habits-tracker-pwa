import { expect, test } from '@playwright/test';

test('loads the PWA application shell', async ({ page }) => {
  await page.goto('/?test=true');
  await expect(page).toHaveTitle(/Healthy Habits/i);
  await expect(page.locator('body')).toBeVisible();
});
