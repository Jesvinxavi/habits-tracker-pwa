import { expect, test } from '@playwright/test';

async function setup(page, pct) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?test=true');
  await page.getByRole('tab', { name: 'Fitness view' }).click();
  await page.locator('#fitness-add-menu-btn').waitFor();
  await page.evaluate(async (targetPct) => {
    const { addActivity, recordActivity } = await import('/src/features/fitness/activities.js');
    const { addRoutine } = await import('/src/features/fitness/routines.js');
    const { addProgram, setActiveProgram } = await import('/src/features/fitness/programs.js');
    const { getLocalISODate } = await import('/src/shared/datetime.js');
    const { plannedSlots } = await import('/src/features/fitness/helpers/programProgress.js');
    const a = await addActivity({ name: 'Bench Press', categoryId: 'strength', trackingType: 'sets-reps', muscleGroup: 'Chest' });
    const r = await addRoutine({ name: 'Push Day', activityIds: [a.id] });
    const today = new Date();
    const start = new Date(today.getTime() - 24 * 86400000);
    const end = new Date(start.getTime() + 55 * 86400000);
    const startKey = getLocalISODate(start), endKey = getLocalISODate(end);
    const days = [{ dayOfWeek: 1, routineId: r.id }, { dayOfWeek: 3, routineId: r.id }, { dayOfWeek: 5, routineId: r.id }];
    const p = await addProgram({ name: 'Autumn Hypertrophy', startDate: startKey, endDate: endKey, scheduledDays: days });
    await setActiveProgram(p.id);
    const planned = plannedSlots({ startDate: startKey, endDate: endKey, scheduledDays: days })
      .map((slot) => slot.date);
    const todayKey = getLocalISODate(today);
    const past = planned.filter((d) => d <= todayKey);
    const want = Math.round((targetPct / 100) * planned.length);
    for (const d of past.slice(0, want)) await recordActivity(a.id, d, {});
  }, pct);
  await page.waitForTimeout(900);
}

function contrastFns() {
  return `
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const parse = (s) => s.match(/[\\d.]+/g).slice(0, 3).map(Number);
    const over = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  `;
}

test('filled tile keeps every label above AA in light mode', async ({ page }) => {
  await setup(page, 70);
  const result = await page.evaluate('(() => {' + contrastFns() + `
    const tile = document.querySelector('#program-tile');
    const pageBg = [255, 255, 255];
    const fillAlpha = 0.45;
    const blue = [0, 122, 255];
    const filledBg = over(blue, fillAlpha, pageBg);
    // Text sitting directly on the fill.
    const onFill = {
      name: getComputedStyle(tile.querySelector('.program-name')).color,
      workouts: getComputedStyle(tile.querySelector('.program-workouts')).color,
    };
    const out = {};
    for (const [k, v] of Object.entries(onFill)) out[k] = Number(ratio(parse(v), filledBg).toFixed(2));
    // Pills are opaque, so measure each against its own background.
    for (const sel of ['.program-range-pill', '.program-percent-pill', '.program-week-box']) {
      const el = tile.querySelector(sel);
      const cs = getComputedStyle(el);
      out[sel] = Number(ratio(parse(cs.color), parse(cs.backgroundColor)).toFixed(2));
    }
    return { out, fill: tile.querySelector('.program-tile-fill').style.background };
  ` + '})()');
  Object.entries(result.out).forEach(([, v]) => expect(v).toBeGreaterThanOrEqual(4.5));
});

test('filled tile keeps every label above AA in dark mode', async ({ page }) => {
  await setup(page, 70);
  await page.evaluate(async () => {
    const { toggleTheme } = await import('/src/core/theme.js');
    await toggleTheme();
  });
  await page.waitForTimeout(700);
  const result = await page.evaluate('(() => {' + contrastFns() + `
    const tile = document.querySelector('#program-tile');
    const cardBg = parse(getComputedStyle(document.body).backgroundColor);
    const blue = [0, 122, 255];
    const filledBg = over(blue, 0.45, cardBg);
    const onFill = {
      name: getComputedStyle(tile.querySelector('.program-name')).color,
      workouts: getComputedStyle(tile.querySelector('.program-workouts')).color,
    };
    const out = {};
    for (const [k, v] of Object.entries(onFill)) out[k] = Number(ratio(parse(v), filledBg).toFixed(2));
    for (const sel of ['.program-range-pill', '.program-percent-pill', '.program-week-box']) {
      const el = tile.querySelector(sel);
      const cs = getComputedStyle(el);
      out[sel] = Number(ratio(parse(cs.color), parse(cs.backgroundColor)).toFixed(2));
    }
    return { out, bodyBg: getComputedStyle(document.body).backgroundColor };
  ` + '})()');
  Object.entries(result.out).forEach(([, v]) => expect(v).toBeGreaterThanOrEqual(4.5));
});

test('fill tracks the percentage and there is no separate bar', async ({ page }) => {
  await setup(page, 0);
  const tile = page.locator('#program-tile');
  await expect(tile).toHaveAttribute('role', 'progressbar');
  await expect(tile).toHaveAttribute('aria-valuenow', '0');
  await expect(tile.locator('.program-tile-fill')).toHaveCount(1);
  const zero = await tile.locator('.program-tile-fill').getAttribute('style');
  expect(zero).toContain('0%');

  await page.evaluate(async () => {
    const { recordActivity } = await import('/src/features/fitness/activities.js');
    const { getState } = await import('/src/core/state.js');
    const { getActiveProgram } = await import('/src/features/fitness/programs.js');
    const { plannedSlots } = await import('/src/features/fitness/helpers/programProgress.js');
    const { getLocalISODate } = await import('/src/shared/datetime.js');
    const p = getActiveProgram();
    const planned = plannedSlots(p).map((slot) => slot.date);
    const todayKey = getLocalISODate(new Date());
    const past = planned.filter((d) => d <= todayKey);
    for (const d of past) await recordActivity(getState().activities[0].id, d, {});
  });

  await expect(tile).not.toHaveAttribute('aria-valuenow', '0');
  const after = await tile.locator('.program-tile-fill').getAttribute('style');
  expect(after).not.toContain(' 0%');
  const valueText = await tile.getAttribute('aria-valuetext');
  expect(valueText).toMatch(/\d+ of \d+ workouts completed/);
});
