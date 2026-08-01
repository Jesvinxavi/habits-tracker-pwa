# Release Risk Register

Status: pre-release review

Target: Healthy Habits Tracker 1.1.0

Last reviewed: 1 August 2026, after the statistics audit merged. The gates
below were **not** re-examined for that release; they remain open.

This register records work that must be completed or explicitly accepted before
general availability. The release branch and draft pull request are suitable
for integration review and controlled test accounts; they are not evidence of
production approval by themselves.

## Open production gates

| Area | Risk | Required disposition |
|---|---|---|
| Convex contracts | Public functions currently validate arguments, ownership, and indexed access, but do not all declare explicit return validators. | Add return validators to every public query and mutation, then rerun Convex type checking and ownership tests. |
| Large cascades | Habit/category and activity cascade mutations collect related history in one transaction. Extremely large accounts could approach Convex transaction limits. | Replace unbounded cascades with bounded, resumable batches or prove safe limits with the large-history fixture. |
| Reactive query determinism | The core bootstrap response includes a server timestamp produced inside a reactive query. | Remove the query clock or replace it with a deterministic/non-reactive time source. |
| Account lifecycle | Export, deletion, and recovery are documented, but the current deletion process is operator-assisted. | Assign an operational owner and complete the self-service lifecycle UI or formally approve the assisted process. |
| Production identity | **Partly closed, 1 August 2026 (Jesvin).** Convex is separated: the deployed app now reads the production deployment `hushed-elephant-959`, its schema deploys automatically on publish, and a missing deploy key fails the build instead of being skipped. Clerk is **not** separated — the deployed app still uses a development instance. | Clerk production requires a domain the account owner controls, which `jesvinxavi.github.io` is not. Tracked in `docs/operations/CLERK_PRODUCTION_INSTANCE_BRIEF.md`; this gate stays open until that brief is complete. |
| Retention automation | Tombstone, processed-operation, and inactive-generation cleanup is intentionally disabled until offline assumptions are validated. | Observe the initial cohort, approve retention windows, then enable and monitor bounded cleanup jobs. |

## Dependency audit

The 29 July 2026 review reported:

- No critical vulnerabilities.
- `npm audit --omit=dev`: 12 moderate production dependency advisories,
  inherited through Clerk's Solana wallet dependency chain.
- Full `npm audit`: the same 12 moderate advisories plus 15 high-severity
  development/tooling advisories in the ESLint and Workbox/Vite PWA dependency
  chains.
- Suggested automatic remediations require major or compatibility-changing
  dependency moves and were therefore not applied without regression testing.

Before general availability, update the affected dependency families where a
compatible release exists or record a time-bounded security acceptance with an
owner and review date.

## Closed in this release

- Browser secrets, local environment files, dependencies, build output,
  Playwright artifacts, and macOS metadata are excluded from Git.
- Account ownership is derived from authenticated Convex identity rather than
  client arguments.
- Normal data reads are scoped to the authenticated account and active dataset
  generation.
- Generations remain the account epoch, so a reset keeps the previous generation
  readable.
- The PWA service worker does not runtime-cache Clerk or Convex API traffic, and
  a waiting worker cannot activate over pending offline work.
- Automated lint, unit, Convex type, dead-code, cycle, bundle-budget, browser and
  PWA checks all run in CI, and `npm run audit` runs the same set locally.
