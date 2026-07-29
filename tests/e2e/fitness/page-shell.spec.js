import { expect, test } from '@playwright/test';

async function openFitness(page) {
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await expect(page.locator('#fitness-view')).toBeVisible();
  await expect(page.locator('#fitness-activity-btn')).toBeVisible();
}

test.describe('fitness page shell', () => {
  for (const [label, width, height] of [
    ['mobile 375', 375, 812],
    ['tablet 768', 768, 1024],
    ['desktop 1280', 1280, 800],
  ]) {
    test(`layout at ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await openFitness(page);

      const buttons = page.locator('#fitness-view .action-buttons button');
      await expect(buttons).toHaveCount(2);
      await expect(buttons.nth(0)).toHaveText(/Activities/);
      await expect(buttons.nth(1)).toHaveText(/Routines/);

      // Old launchers are gone, and no search input survives on the page.
      await expect(page.locator('#new-activity-btn')).toHaveCount(0);
      await expect(page.locator('#start-timer-btn')).toHaveCount(0);
      await expect(page.locator('#fitness-view input[type="text"]')).toHaveCount(0);
      await expect(page.locator('#fitness-view .activities-search-section')).toHaveCount(0);

      const metrics = await page.evaluate(() => {
        const box = (selector) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const { x, y, width, height } = el.getBoundingClientRect();
          return { x, y, width, height, centerY: y + height / 2, right: x + width };
        };
        return {
          label: box('#activities-label'),
          timer: box('#fitness-timer-btn'),
          plus: box('#fitness-add-menu-btn'),
          rest: box('#rest-toggle'),
          host: box('#fitness-program-host'),
          activity: box('#fitness-activity-btn'),
          routines: box('#fitness-routines-btn'),
          viewportWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          order: [...document.querySelector('#fitness-view').children].map((c) => c.id),
        };
      });

      // The program host reserves the slot beneath the buttons but renders flat.
      expect(metrics.host.height).toBe(0);
      expect(metrics.order.indexOf('fitness-program-host')).toBe(2);

      // Equal-width pills.
      expect(Math.abs(metrics.activity.width - metrics.routines.width)).toBeLessThan(1);

      // Schedule pill, then the timer button, then the +, all vertically centred.
      expect(metrics.timer.x).toBeGreaterThan(metrics.label.right);
      expect(metrics.timer.x - metrics.label.right).toBeLessThan(12);
      expect(metrics.plus.x).toBeGreaterThan(metrics.timer.right);
      expect(metrics.plus.x - metrics.timer.right).toBeLessThan(12);
      expect(Math.abs(metrics.timer.centerY - metrics.label.centerY)).toBeLessThan(1);
      expect(Math.abs(metrics.plus.centerY - metrics.label.centerY)).toBeLessThan(1);

      // Rest toggle stays flush right and nothing overflows horizontally.
      expect(metrics.rest.x).toBeGreaterThan(metrics.plus.right);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    });
  }

  test('add menu button exposes menu semantics', async ({ page }) => {
    await openFitness(page);
    const plus = page.locator('#fitness-add-menu-btn');
    await expect(plus).toHaveAttribute('aria-haspopup', 'true');
    await expect(plus).toHaveAttribute('aria-expanded', 'false');
    // Wired from Phase 5 onwards; the dropdown's own behaviour is covered in
    // phase5-addmenu.spec.js.
    await plus.click();
    await expect(page.locator('#fitness-add-menu')).toBeVisible();
    await expect(plus).toHaveAttribute('aria-expanded', 'true');
  });

  test('first Fitness visit is pre-centred, but a later return still sweeps to today', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(() => {
      localStorage.setItem(
        'healthyHabitsData',
        JSON.stringify({ appFirstOpenDate: '2025-01-01T00:00:00.000Z' })
      );
    });
    await page.goto('/?test=true');
    await page.reload();

    await page.evaluate(() => {
      window.__fitnessScrollBehaviors = [];
      window.__originalElementScrollTo = HTMLElement.prototype.scrollTo;
      HTMLElement.prototype.scrollTo = function scrollTo(options, y) {
        if (this.closest?.('#fitness-calendar')) {
          window.__fitnessScrollBehaviors.push(
            typeof options === 'object' ? options.behavior : 'legacy'
          );
        }
        if (typeof options === 'object') {
          return window.__originalElementScrollTo.call(this, options);
        }
        return window.__originalElementScrollTo.call(this, options, y);
      };
    });

    await page.getByRole('tab', { name: 'Fitness view' }).click();
    const calendar = page.locator('#fitness-calendar');
    await expect(calendar).toBeVisible();
    await expect(calendar).not.toHaveClass(/calendar-initializing/);

    // The initial position must remain still for longer than the removed 80 ms
    // refinement. Every first-mount centring call is instant/auto.
    await page.waitForTimeout(250);
    const firstVisit = await page.evaluate(() => {
      const strip = document.querySelector('#fitness-calendar .week-days');
      const today = strip.querySelector('.day-item.current-day');
      const stripBox = strip.getBoundingClientRect();
      const todayBox = today.getBoundingClientRect();
      return {
        behaviors: [...window.__fitnessScrollBehaviors],
        centerDelta: Math.abs(
          todayBox.left + todayBox.width / 2 - (stripBox.left + stripBox.width / 2)
        ),
      };
    });
    expect(firstVisit.behaviors).not.toContain('smooth');
    expect(firstVisit.centerDelta).toBeLessThan(2);

    // Selecting another date, leaving Fitness, then returning is intentionally
    // different: navigation resets Today with the established smooth sweep.
    await page.locator('#fitness-calendar .prev-day').click();
    await page.getByRole('tab', { name: 'Home view' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
    await page.evaluate(() => {
      window.__fitnessScrollBehaviors.length = 0;
    });
    await page.getByRole('tab', { name: 'Fitness view' }).click();
    await expect(calendar).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.__fitnessScrollBehaviors))
      .toContain('smooth');

    await page.evaluate(() => {
      HTMLElement.prototype.scrollTo = window.__originalElementScrollTo;
      delete window.__originalElementScrollTo;
      delete window.__fitnessScrollBehaviors;
    });
  });

  test('dark mode uses the dark variants for the new controls', async ({ page }) => {
    await openFitness(page);
    const before = await page.evaluate(
      () => getComputedStyle(document.querySelector('#fitness-activity-btn')).backgroundColor
    );
    await page.evaluate(async () => {
      const { toggleTheme } = await import('/src/core/theme.js');
      await toggleTheme();
    });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const after = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      activityBg: getComputedStyle(document.querySelector('#fitness-activity-btn')).backgroundColor,
      plusBg: getComputedStyle(document.querySelector('#fitness-add-menu-btn')).backgroundColor,
    }));
    expect(after.theme).toBe('dark');
    expect(after.activityBg).not.toBe(before);
  });

  test('closing a stacked modal keeps the page scroll-locked', async ({ page }) => {
    await openFitness(page);

    await page.evaluate(async () => {
      const { Modals } = await import('/src/features/fitness/FitnessModals.js');
      Modals.openAddActivity();
    });
    await expect(page.locator('#add-activity-modal')).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.evaluate(async () => {
      const { openModal } = await import('/src/components/Modal.js');
      openModal('icon-selection-modal');
    });
    await expect(page.locator('#icon-selection-modal')).toBeVisible();

    await page.evaluate(async () => {
      const { closeModal } = await import('/src/components/Modal.js');
      closeModal('icon-selection-modal');
    });
    await expect(page.locator('#icon-selection-modal')).toBeHidden();

    // The underlying Add Activity modal is still open, so the lock must hold.
    await expect(page.locator('#add-activity-modal')).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    const stack = await page.evaluate(async () => {
      const { isModalOpen, topModalId } = await import('/src/components/Modal.js');
      return { addOpen: isModalOpen('add-activity-modal'), top: topModalId() };
    });
    expect(stack).toEqual({ addOpen: true, top: 'add-activity-modal' });

    await page.evaluate(async () => {
      const { closeModal } = await import('/src/components/Modal.js');
      closeModal('add-activity-modal');
    });
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });
});
