import { describe, expect, it } from 'vitest';

import {
  BUDGETS,
  BUDGET_RATIONALE,
  evaluateBudgets,
  formatBudgetResult,
} from '../../scripts/bundleBudgets.mjs';

const withinBudget = Object.fromEntries(
  Object.entries(BUDGETS).map(([name, limit]) => [name, limit - 1])
);

describe('bundle budget evaluation', () => {
  it('passes when every measurement is within its budget', () => {
    const { results, failed } = evaluateBudgets(withinBudget);
    expect(failed).toBe(false);
    expect(results.every((result) => result.okay)).toBe(true);
  });

  it('treats a measurement exactly at its budget as a pass', () => {
    const { failed } = evaluateBudgets({ ...BUDGETS });
    expect(failed).toBe(false);
  });

  // The gate's whole purpose. A budget nobody has watched fail is a comment.
  it.each(Object.keys(BUDGETS))('fails when %s regresses by one byte', (name) => {
    const { results, failed } = evaluateBudgets({
      ...withinBudget,
      [name]: BUDGETS[name] + 1,
    });
    expect(failed).toBe(true);
    const regressed = results.filter((result) => !result.okay);
    expect(regressed).toHaveLength(1);
    expect(regressed[0].name).toBe(name);
  });

  it('reports every regression rather than stopping at the first', () => {
    const { results, failed } = evaluateBudgets({
      ...withinBudget,
      htmlGzip: BUDGETS.htmlGzip + 1,
      precacheRaw: BUDGETS.precacheRaw + 1,
    });
    expect(failed).toBe(true);
    expect(results.filter((result) => !result.okay).map((result) => result.name)).toEqual([
      'htmlGzip',
      'precacheRaw',
    ]);
  });

  // A renamed or missing chunk previously measured as 0 and sailed under every
  // budget, which is the one failure mode a size gate must never have.
  it('fails an unmeasured budget instead of reading it as zero', () => {
    const { results, failed } = evaluateBudgets({
      ...withinBudget,
      largestJavaScriptGzip: undefined,
    });
    expect(failed).toBe(true);
    const missing = results.find((result) => result.name === 'largestJavaScriptGzip');
    expect(missing.okay).toBe(false);
    expect(missing.value).toBeNull();
    expect(formatBudgetResult(missing)).toContain('not measured');
  });

  it('ignores a budget that does not apply to the build target', () => {
    const budgets = { ...BUDGETS };
    delete budgets.precacheRaw;
    const measurements = { ...withinBudget };
    delete measurements.precacheRaw;

    const { results, failed } = evaluateBudgets(measurements, budgets);
    expect(failed).toBe(false);
    expect(results.some((result) => result.name === 'precacheRaw')).toBe(false);
  });

  it('documents what every budget protects', () => {
    expect(Object.keys(BUDGET_RATIONALE).sort()).toEqual(Object.keys(BUDGETS).sort());
    Object.values(BUDGET_RATIONALE).forEach((reason) => {
      expect(reason.length).toBeGreaterThan(0);
    });
  });
});
