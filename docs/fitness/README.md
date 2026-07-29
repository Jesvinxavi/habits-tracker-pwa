# Fitness Documentation

The Fitness feature is complete and integrated into `develop` as of
29 July 2026. These documents preserve the design, audit evidence, deviations,
implementation decisions, and measured optimisation results.

## Current implementation record

- [Fitness overhaul plan](FITNESS_OVERHAUL_PLAN.md) — the original phased
  implementation checklist, its final disposition, and the product deviations
  agreed while the feature evolved.
- [Independent optimisation audit and revised plan](FITNESS_OPTIMISATION_AUDIT_AND_REVISED_PLAN.md)
  — the implemented optimisation programme, comparison with the source audit,
  benchmark results, verification gates, and browser findings.

## Historical source

- [Original optimisation plan](FITNESS_OPTIMISATION_PLAN.md) — the source audit
  reviewed by the independent plan. It is retained as a historical baseline;
  its proposal wording describes the state before implementation.

PR #2 tracked the earlier `claude/fitness-overhaul` head. The completed
successor branch, `fitness-overhaul-optimisations`, was integrated directly into
`develop`; PR #2 was therefore closed without merging its older head.
