import { expect } from '@playwright/test';

export async function expandAllActivityPickerCategories(page) {
  const modal = page.locator('#activity-picker-modal');
  const sections = page.locator('#activity-picker-list .search-category-section');
  await expect(modal).toBeVisible();
  await expect(sections).not.toHaveCount(0);

  const count = await sections.count();
  for (let index = 0; index < count; index += 1) {
    const section = sections.nth(index);
    if (await section.evaluate((element) => element.classList.contains('collapsed'))) {
      await section.locator('.search-expand-btn').click();
      await expect(section).not.toHaveClass(/collapsed/);
    }
  }
}

export async function expandActivityPickerCategory(page, categoryId) {
  const modal = page.locator('#activity-picker-modal');
  const section = page.locator(`#pick-category-${categoryId}`);
  await expect(modal).toBeVisible();
  await expect(section).toBeAttached();

  if (await section.evaluate((element) => element.classList.contains('collapsed'))) {
    await section.locator('.search-expand-btn').click();
    await expect(section).not.toHaveClass(/collapsed/);
  }
  return section;
}
