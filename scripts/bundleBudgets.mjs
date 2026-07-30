// Budget definitions and the pass/fail decision, kept separate from the code
// that measures a build so the decision itself can be unit tested. A budget
// gate that has never been observed failing is not a gate.

export const BUDGETS = {
  htmlGzip: 18_000,
  fitnessEntryGzip: 25_000,
  fitnessModalsGzip: 30_000,
  largestJavaScriptGzip: 650_000,
  precacheRaw: 2_500_000,
};

// What each budget protects, so a future change to one is a decision rather
// than a nudge.
export const BUDGET_RATIONALE = {
  htmlGzip: 'Initial document parse cost, including inlined modal markup.',
  fitnessEntryGzip: 'Fitness landing cost before any dialog is materialised.',
  fitnessModalsGzip: 'Combined lazy Fitness dialog chunks.',
  largestJavaScriptGzip: 'Dominant single chunk; currently the auth vendor.',
  precacheRaw: 'Total bytes an installed Pages client downloads up front.',
};

/**
 * Compares measurements against budgets.
 *
 * A measurement with no budget is reported and ignored. A budget with no
 * measurement fails: a renamed or missing artefact must not read as a pass.
 */
export function evaluateBudgets(measurements, budgets = BUDGETS) {
  const results = Object.entries(budgets).map(([name, limit]) => {
    const value = measurements[name];
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { name, value: null, limit, okay: false, reason: 'not measured' };
    }
    return { name, value, limit, okay: value <= limit, reason: '' };
  });
  return { results, failed: results.some((result) => !result.okay) };
}

export function formatBudgetResult({ name, value, limit, okay, reason }) {
  const measured = value === null ? reason : `${value} bytes`;
  return `${okay ? '✓' : '✗'} ${name}: ${measured} (budget ${limit})`;
}
