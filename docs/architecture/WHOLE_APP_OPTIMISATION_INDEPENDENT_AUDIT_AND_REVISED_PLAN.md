# Whole-App Independent Optimisation Audit and Revised Implementation Plan

> **Historical. Implemented and closed.** This plan was carried out on
> `codex/whole-app-optimisation` and merged. What was built, what was measured,
> what was deliberately not done, and the few items that remain open are recorded
> in [the implementation record](WHOLE_APP_OPTIMISATION_IMPLEMENTATION_HANDOFF.md),
> which is the current document. Read this one for the reasoning behind a
> decision, not as a list of work to do.

Date: 2026-07-30. Branch reviewed: `codex/whole-app-optimisation` at
`feeb0f48` (clean tree before this document). This is an independent review of
`WHOLE_APP_OPTIMISATION_AUDIT_AND_PLAN.md`, followed by a second audit of the
runtime paths that carry the highest performance or data-integrity risk:
startup, authentication, state dispatch, optimistic persistence, IndexedDB,
outbox replay, Convex subscriptions, hydration, Home, Statistics, navigation,
the service worker, tests, build budgets, workflows, and release material.

The original plan is unusually strong. Its dependency order, legacy inventory,
test-harness proposal, preservation of generation semantics, and refusal to
split large files merely because they are large are all good engineering. This
revision agrees with most of its deletion work. It changes the safety premise,
corrects two important non-findings, strengthens the remote-update design, and
adds meaningful render, PWA, offline-dependency, and CI optimisations that the
original did not cover.

## 0. How to read this document

- Sections 1–2 establish the architecture, measured baseline, and overall
  opinion.
- Section 3 disposes every finding in the original plan as **agree**,
  **strengthen**, **modify**, **defer**, or **disagree**.
- Sections 4–9 are the revised findings, using the original categories:
  **L** (legacy backend and migration), **T** (test infrastructure), **D**
  (dead code), **S** (schema, server, sync, and offline integrity), **P**
  (performance), and **F** (file/config consolidation).
- Every material finding states the evidence, comparison with the original,
  change, benefit, and risk.
- Section 10 is the dependency-ordered implementation plan. Correctness and
  recoverability precede speed.
- Section 11 is the verification matrix and acceptance criteria.

Two terms are used precisely:

- **Confirmed cache** means IndexedDB records acknowledged by Convex for one
  owner and generation.
- **Compatibility state** means the reducer-facing arrays and maps rebuilt from
  normalized confirmed records plus pending outbox operations.

The original plan's controlling premise was that the app had never been
released and therefore no old client, service worker, local database, or cloud
row could exist. That may be the owner's intended and correct operational
truth, but this audit does **not** treat it as proven by the repository. The
tree contains dated `1.0.0` release notes, a production release checklist, an
`origin/gh-pages` branch, Pages deployment workflows, and a public deployment
history. These facts do not prove that a real user exists; they do prove that a
read-only live-state census is required before destructive compatibility
removal. The fast path remains available when that census confirms zero users,
rows, installed clients, and recoverable data.

## 1. Architecture as independently found

### 1.1 Runtime and data authority

The app is a vanilla-JavaScript Vite PWA. Clerk supplies identity and Convex is
the intended authoritative store. IndexedDB database `habitsConvexCache`
contains per-owner, per-generation confirmed entities, an offline outbox, sync
metadata, and migration backups. Reducer state is a denormalized compatibility
view used by the existing UI.

The legacy backend is still a complete second application persistence path:
`localStorage.healthyHabitsData`, IndexedDB `healthyHabitsDB/state/appData`,
side keys, storage-event synchronization, and the migration pipeline. The
original plan's inventory of that path is substantially correct.

### 1.2 Startup and navigation

`main.js` establishes the shell and selects the persistence path.
`cloudBootstrap.js` authenticates, provisions the profile, performs early-cache
hydration, loads core data plus three years of history, installs the cloud
runtime and `SyncEngine`, then subscribes to four reactive query surfaces.

Top-level feature code is dynamically imported by `navigation.js`. Pointer
intent prefetches the selected page, but idle and background handlers also
prefetch nearly every page unconditionally (`navigation.js:239-317`). A Pages
build additionally precaches every generated JavaScript chunk through Workbox.
Those two policies currently overlap.

### 1.3 Write lifecycle

For an unsourced domain action in cloud mode:

1. `state.dispatch()` dynamically resolves `persistenceRouter.js`.
2. The router maps one reducer action to one or more normalized operations.
3. Each operation is committed optimistically to the entity cache and outbox.
4. Only after those commits does the reducer receive the original action.
5. `SyncEngine` replays pending operations through named Convex mutations.
6. Confirmation replaces the confirmed entity, removes the current operation,
   and avoids repainting over a pending successor.
7. Conflicts are three-way merged automatically or exposed for user choice.

This is a thoughtful design: durable optimistic state, operation IDs,
revisions, generations, conflict records, and a confirmed/pending separation
are worth preserving. The important defect is that one reducer action can
produce multiple operations which are currently committed in separate
IndexedDB transactions (`persistenceRouter.js:485-505`, `576-591`,
`710-731`, `784-786`). That makes the action only partially durable if a later
operation fails.

### 1.4 Replay and cross-tab coordination

`SyncEngine` has a same-instance replay latch and uses
`navigator.locks.request(..., { ifAvailable: true })` for cross-tab exclusion
(`syncEngine.js:50-67`). If another tab owns the lock, the request returns
without scheduling a later attempt. A `BroadcastChannel` is opened and a
`replay-complete` message is posted, but no message listener is installed
(`syncEngine.js:34-42`, `109`). Therefore a write made in tab B while tab A
owns the lock can remain pending until another dispatch, online event, reload,
or manual sync happens.

Retry timers are also created without being retained
(`syncEngine.js:79-83`, `120`, `184`) and `close()` only closes the channel
and removes the online listener (`259-262`). A timer may wake an obsolete
engine after sign-out or runtime replacement.

### 1.5 Remote reads and reactive updates

Initial history loading is complete: `queryHistoryWindow()` walks every
500-row page for habit entries and activity records (`cloudBootstrap.js:
134-153`). The reactive subscriptions are not equivalent. They subscribe only
to `cursor: null, numItems: 500` (`523-556`), so changes outside the first page
of either three-year result are not represented by the live query.

Each subscription callback then:

- upserts the received page into IndexedDB;
- does not remove cached rows absent from an authoritative full result;
- re-reads all entity types;
- overlays the outbox;
- rebuilds all compatibility state;
- dispatches a full `HYDRATE_CACHE`.

The four asynchronous callbacks have no shared serialization or coalescing.
Initial subscription emissions and close-together remote writes can therefore
produce overlapping full hydrations and out-of-order completions. The original
plan correctly identified the excessive work but proposed selective hydration
before solving result completeness, replacement semantics, and callback
ordering.

### 1.6 View and render boundaries

The active-view lifecycle is a real existing optimisation: lazy modules mount
or activate only when needed and deactivate subscriptions when hidden. Several
important surfaces nevertheless subscribe too broadly.

- Home selects nine state slices, and any identity change renders the complete
  Home view. `HomeView.render()` delegates to every child. `HomeHabitsList`
  clears its container, rebuilds cards and handlers, then reads layout on every
  render (`HomeHabitsList.js:63-108`, `115-130`).
- Home installs responsive behavior twice: once through `HomeView.mount()` and
  once in `HomeModule` after mounting. `HomeView` and `HomeHabitsList` both
  calculate available height using `getBoundingClientRect()` plus
  `getComputedStyle()`.
- Statistics subscribes to the entire store (`stats.js:45-50`). Any sync-status
  or device-only update recalculates both habit and fitness statistics and
  replaces the page DOM (`113-133`).
- Statistics recomputes some daily rates twice (`261-291`), scans every date in
  the year for holidays (`293-306`), and its carousel repeatedly filters habits
  and calls state/schedule helpers for every date back to the earliest habit
  (`705-810`).
- `calculateHabitCompletionRate()` first infers creation time from the legacy
  timestamp-shaped ID (`319-330`) rather than preferring `habit.createdAt`.
  Cloud UUID habits can therefore receive a wrong effective lifetime. This
  correctness issue must be fixed before memoizing the result.

The existing `getRecordedHistoryIndex` identity cache in Fitness is a clever
counterexample: it centralizes a repeatedly needed derived index and invalidates
it from input identity. The same pattern can be applied to Statistics.

### 1.7 PWA and offline surface

Pages builds use `registerType: 'autoUpdate'` and precache all JS/CSS/HTML and
assets (`vite.config.js:76-85`). Generated service-worker behavior activates a
new worker eagerly. The release checklist requires an update prompt that
handles pending operations safely (`RELEASE_CHECKLIST.md:36-45`), but the app
has an install prompt, not an update coordinator.

This matters beyond polish. An old live tab may reference old hashed lazy
chunks after a new worker removes the old precache. The existing Home helper
comments acknowledge this and statically import the habit and holiday modal
surfaces to avoid missing chunks (`uiHelpers.js:8-12`), trading update safety
for a larger Home chunk. Update lifecycle must be fixed before reversing those
imports.

Two app features also depend on unprecached third-party origins:

- Material Icons load from Google Fonts in `index.html:19-22`; roughly 80
  source references depend on that font and no local font asset is present.
- Habit reordering imports SortableJS from jsDelivr at interaction time in
  `features/habits/modals/HabitReorderModal.js`.

The app can open offline while icons or reorder behavior remain unavailable.

### 1.8 Test, build, and CI baseline

Baseline recorded at `feeb0f48`:

| Gate | Result |
|---|---|
| `npm test` | 24 unit/Convex files, 167 tests passed; 4 migration files, 19 tests passed |
| `npm run test:convex` | Passed |
| `npm run lint` | Passed |
| `npm run check:dead-code` | Passed with broad export suppressions |
| `npm run test:e2e` | 141 passed, 1 opt-in performance case skipped |
| `npm run test:pwa` | 1 passed |
| `npm run test:fitness:perf` | 1 large-account invariant passed |
| `npm run check:bundle` | Passed; 206 modules; 2.47 seconds in this environment |
| `npm run check:bundle:pages` | Passed; 37 precache entries, 2,211,468 bytes against a 2,500,000-byte budget |

Important bundle observations:

- `auth` is the dominant JavaScript chunk: 1,599.24 KB raw / 587.99 KB gzip.
- `cloudBootstrap` is 36.00 KB raw / 10.96 KB gzip.
- `HomeModule` is 36.35 KB raw / 10.44 KB gzip.
- `index.html` is 110.36 KB raw / 13.63 KB gzip.
- CSS is 81.82 KB raw / 14.74 KB gzip.

The original plan is right that removing statically imported migration code is
the clearest first-party startup win. It should not be described as the
dominant total-payload win while the auth vendor chunk is roughly 54 times its
gzip size.

`performance.yml` builds and starts a preview but every meaningful measurement
step is `if: false`. Normal CI omits the Pages bundle/precache budget, PWA
suite, dead-code gate, and large-account performance invariant.

## 2. Executive opinion

### 2.1 Overall verdict

Implement the original plan's cleanup direction, but **do not implement its
current ordering verbatim**. Five corrections are prerequisites:

1. Prove the no-user/no-old-client premise with a deployment and data census,
   then export or back up anything that exists.
2. Fix cross-tab replay and engine shutdown before relying more heavily on the
   single cloud path.
3. Make multi-operation reducer actions atomically durable in one IndexedDB
   transaction.
4. Fix the first-500-row reactive-history boundary and define authoritative
   cache replacement before selective hydration.
5. Replace the proposed “no runtime means reducer-direct” production behavior
   with an explicit test-harness exception and a fail-closed production gate.

After those corrections, the deletion programme is high-value. It reduces
surface area, removes a misleading production default, makes tests truthful,
shrinks the first-party startup graph, and lets dead-code tooling become useful
again.

### 2.2 What the original plan did especially well

| Original idea | Opinion |
|---|---|
| Build the test harness before deleting the backend | Excellent dependency order; it proves the replacement before removal |
| Keep `periodKeys.js` while deleting migration | Careful domain tracing; the file's folder was not mistaken for its purpose |
| Keep generations | Correct value-to-risk judgment; reset epochs still need them |
| Canonicalize idempotent-create comparison | Small, real correctness improvement |
| Re-arm Knip instead of trusting its green output | Exactly right; configuration was hiding useful findings |
| Preserve large cohesive modules unless evidence demands a split | Correct; file size is not a performance metric |
| Tighten budgets after removal | Converts a one-time win into a maintained constraint |
| Explain why live-Convex e2e and a full client mock were rejected | Clear trade-off analysis |

### 2.3 Material disagreements and additions

| Area | Original plan | Revised position |
|---|---|---|
| Release premise | Treat owner confirmation as sufficient | Add a read-only production/Pages/Clerk/Convex/IndexedDB census and backup gate |
| `SyncEngine` locks | Marked sound | Not sound under lock contention; requests can be dropped |
| Pre-runtime dispatch | Reducer-direct when no runtime | Harness-only reducer-direct; production must fail closed |
| Reactive history | Selectively hydrate the received page | First make subscriptions complete beyond 500 rows |
| Cache update | Skip equal upserts | Also reconcile removals and serialize/coalesce callbacks |
| Multi-operation actions | Not covered | Commit the action's operations in one IDB transaction |
| Superseded outbox rows | Not covered | Delete safely after successor confirmation; bound diagnostic retention |
| Home | Leave large module alone | Do not split arbitrarily, but reduce invalidation and remove forced layout |
| Statistics | Out of scope | High-value selector, derivation, and DOM work; include after correctness |
| PWA updates | Not covered | Required before re-lazying static Home modal imports |
| Offline dependencies | Not covered | Self-host icons and bundle the reorder dependency |
| Default categories | Three copies | Four copies today; three remain after legacy deletion |
| Dead exports | Generic Knip follow-up | Enumerate the currently hidden set and remove/justify each |
| CI | Remove fake Lighthouse | Also run real bundle, PWA, dead-code, and selected performance gates |

### 2.4 Expected value

The most meaningful user-visible gains are not all byte deletion:

- no write left pending merely because another tab briefly owned the lock;
- no partial durable result from a multi-record action;
- correct realtime convergence for accounts with more than 500 history rows;
- fewer full IndexedDB rewrites and state hydrations during remote activity;
- no full Statistics recalculation for sync-status noise;
- fewer full Home list rebuilds and forced layouts;
- reliable icons and habit reordering offline;
- controlled PWA updates without stranding pending operations or old chunks.

Line-count reduction remains useful, but it is a maintainability result rather
than the acceptance criterion. The original estimate of approximately
−3,200/+450 lines should be remeasured after the safety and performance work,
which adds code intentionally.

## 3. Disposition of every original finding

| ID | Verdict | Revised disposition |
|---|---|---|
| L1 backend switch | Agree, gated | Remove only after L0 live-state census; production env must fail loudly |
| L2 legacy persistence | Agree, gated | Delete after backup/no-client proof; preserve a documented recovery snapshot if any data exists |
| L3 client migration | Agree | Keep/move `periodKeys`; remove the rest after the census |
| L4 Convex migration | Agree, gated | Count/export live rows and deploy schema safely before dropping fields/tables |
| L5 migration IDB store | Modify | Do not assume keeping DB version 1 plus manually deleting one dev DB is enough; use an explicit upgrade/reset strategy |
| L6 state legacy concepts | Agree | Remove; make test-harness state explicit |
| L7 documentation | Strengthen | Mark historical material and reconcile contradictory release claims |
| T1 in-memory harness | Agree, strengthen | Use for UI e2e, but never as the implicit production no-runtime behavior |
| T2 test deletion/rehome | Agree | Preserve live reducer semantics and add the missing end-to-end persistence seam |
| D1 data management | Mostly agree | Delete unreachable implementation, but record export/data-portability as a product requirement, not “dead forever” |
| D2 dead endpoints | Modify | Delete verified dead endpoints except decide the delta-sync design before deleting `sync:listChangedEntities` |
| D3 compatibility cascades | Agree, gated | Remove after stale-client census |
| D4 dead UI | Agree | Remove `#food-view` and account-control stub |
| D5 state exports | Agree | Remove verified dead exports |
| D6 Knip | Strongly agree | Remove blanket suppressions and enumerate every surfaced export |
| S1 retired fields | Agree, gated | Export/count rows first; Convex schema removal is a data operation |
| S2 generations | Strongly agree | Keep as reset/import epoch |
| S3 canonical create | Agree | Land with explicit key-order tests |
| S4 retention | Strengthen | Do not schedule blindly, but define retention semantics and collect dry-run metrics |
| P1 router gate | Disagree in part | Hoist import, but fail closed in production when runtime is absent |
| P2 remote updates | Strengthen substantially | Completeness, ordering, replacement semantics, diffing, then selective delivery |
| P3 IDB scans | Agree, reprioritize | Hot outbox path first; rare account purge later |
| P4 startup removal | Agree, qualify | Biggest easy first-party win, not biggest total bundle win |
| P5 holiday expansion | Agree, strengthen | One derived authority plus `Set` membership and date-bound tests |
| P6 category constants | Correct and strengthen | There are four current copies, not three |
| P7 non-findings | Partly disagree | Lock discipline is defective; Home/Stats have measured structural work even if file splitting is unjustified |
| F1 file summary | Agree, update later | Final file list follows the chosen subscription and data-export decisions |
| F2 entity list | Agree | Avoid premature abstraction |
| F3 config/workflow | Strongly agree | Replace fake performance CI with executable gates rather than only deleting it |

## 4. Category L — Retire legacy paths safely

### L0. Prove the destructive-cleanup premise

Evidence:

- `docs/release/RELEASE_1.0.0.md:3` gives a release date of 26 July 2026.
- The release notes claim cloud sync and migration as shipped behavior
  (`22-38`).
- Git has `origin/gh-pages`; `develop` is currently 42 commits ahead of
  `main`.
- The release checklist still describes cohort rollout and 30-day retention
  observation (`RELEASE_CHECKLIST.md:67-73`).

Original-plan comparison: this is the largest safety gap. Owner intent is
valuable context, but destructive removal needs observable evidence.

Change:

1. Record the exact Pages URL, current artifact commit/version, service-worker
   scope, and whether any controlled browser has it installed.
2. Record Clerk production and development user counts without exposing user
   details.
3. Record Convex deployment identities and per-table row counts by owner and
   generation, including legacy/migration tables and processed operations.
4. Export the owner's current cloud generation and any meaningful local legacy
   snapshot before schema or database removal.
5. Inspect controlled devices for `healthyHabitsData`, `healthyHabitsDB`,
   `habitsConvexCache`, registered workers, and caches.
6. Choose:
   - **zero-state fast path** — proceed with direct deletion when every surface
     is empty or expendable and the owner signs off;
   - **sunset path** — ship telemetry/notice and compatibility for one bounded
     release before removal.

Benefit: makes every later “low risk because unreleased” claim true by evidence.

Risk: read-only except the export. Do not reset a deployment or unregister a
worker in this phase.

### L1. Retire `VITE_DATA_BACKEND`

Original-plan comparison: agree.

Change:

- Delete `dataBackend.js` and all runtime branches after L0.
- Move cloud environment validation to `convexClient.js`.
- Remove the legacy default from local, test, and deployment configuration.
- Make missing production Clerk/Convex settings a build or startup failure with
  an actionable message.
- Keep only `VITE_TEST_HARNESS` for explicit development/browser testing; guard
  it so a production Pages build refuses to include it.

Benefit: one runtime architecture, smaller branching surface, and no production
build that silently becomes a localStorage application.

Risk: local UI work needs the documented harness command.

### L2. Delete legacy persistence and client migration

Original-plan comparison: agree with the original file tracing.

Change:

- Delete `storage.js`, the legacy side-key branches, and the six migration-only
  modules.
- Move `periodKeys.js` to a neutral shared domain location.
- Remove migration discovery, preview, merge, upload, verification, and
  additional-device flows from `cloudBootstrap.js`.
- Remove migration metadata only after the L0 backup.
- Preserve a one-time, external recovery export when any meaningful snapshot
  exists; do not retain dormant runtime machinery solely as a backup.

Benefit: largest maintainability deletion and clearest first-party startup-graph
reduction.

Risk: high if L0 is skipped; low-medium after proof and backup.

### L3. Remove server migration tables, functions, and retired fields

Original-plan comparison: agree, but schema deletion is not “just a dev reset”
until L0 proves it.

Change:

- Delete `convex/migration.ts` and unused client/server migration helpers.
- Drop `migrationBatches`, `legacyData`, migration profile fields, and retired
  optional product fields only after row counts and export.
- Remove them from bootstrap, hydration, validators, fixtures, and schema.
- Push the schema first to a disposable/dev deployment, then validate the
  intended target deployment before production.

Benefit: smaller schema and function surface; less product history encoded as
live behavior.

Risk: Convex validation can reject existing rows carrying removed fields. The
gate is a data census plus deployment smoke, not TypeScript alone.

### L4. Preserve generations and define the IndexedDB upgrade

Original-plan comparison: agree on generations; disagree with casually keeping
`DB_VERSION = 1` and manually deleting only the developer's database.

Change:

- Keep generation on server rows, cache keys, metadata, and outbox operations as
  the reset/import epoch.
- If the removed `migrationBackups` store must disappear physically, bump the
  IndexedDB version and write an idempotent upgrade, or deliberately leave the
  unused store until a later version.
- Never require users to delete `habitsConvexCache`; that database contains the
  only durable copy of pending offline work.

Benefit: preserves atomic account epochs and upgrades installed clients safely.

Risk: an unnecessary object-store deletion has almost no runtime value. Prefer
the lower-risk option unless storage measurements justify cleanup.

### L5. Make active documentation internally consistent

Original-plan comparison: strengthen L7.

Change:

- Mark migration and persistence audits historical, retaining their evidence.
- Update active setup, deployment, release, privacy/support, and recovery
  material to describe the one backend.
- Resolve whether `RELEASE_1.0.0.md` is an actual release record, a prepared
  release note, or a historical draft. Rename or annotate it truthfully.
- Remove stale cleanup dates and backend flags only when the corresponding code
  is gone.

Benefit: prevents a future operator from following a retired migration or
believing a release premise contradicted by the repository.

Risk: none, provided historical measurements are not erased.

## 5. Category T — Test infrastructure and performance evidence

### T1. Build the in-memory UI harness first

Original-plan comparison: strongly agree.

Change:

- Add `VITE_TEST_HARNESS=1` for dev/test only.
- Skip auth/cloud bootstrap and expose `window.__APP_TEST__` only under that
  explicit flag.
- Seed state through a clear test API after load, replacing legacy storage
  seeding.
- Run every existing browser spec against the harness before deleting the
  legacy backend and compare the spec list.
- Make a production build fail if the harness flag is truthy.

Benefit: deterministic UI tests with truthful naming and no external auth or
shared cloud state.

Risk: the harness does not test persistence. T2 closes that gap.

### T2. Add one real persistence integration seam

Evidence: current unit suites exercise router operations, IndexedDB,
hydration, replay, conflicts, and Convex domain code, but no suite owns the
complete `dispatch → persistenceRouter → IndexedDB → SyncEngine → transport →
confirmation` lifecycle.

Original-plan comparison: this is the missing complement to T1.

Change:

- Add a deterministic integration fixture using fake IndexedDB and a fake or
  convex-test transport.
- Drive real domain actions through `dispatch`, not private operation builders.
- Assert reducer optimism, entity/outbox atomicity, replay payload, server
  result, confirmed cache, outbox cleanup, and final compatibility state.
- Cover one create, update, archive, multi-record batch, conflict, retry,
  sign-out shutdown, and generation change.
- Keep a small optional authenticated deployment smoke for release; do not make
  every UI test depend on live Clerk/Convex.

Benefit: protects the exact seam most changed by this plan.

Risk: avoid reproducing Convex implementation logic in the fake. Assert
protocol contracts, with server semantics separately covered by convex-test.

### T3. Rehome live behavior; delete only historical behavior

Original-plan comparison: agree.

Change:

- Delete migration fixtures and tests with the migration.
- Rename live reducer cascade tests by the behavior they protect.
- Preserve IndexedDB precedence only if a live confirmed/pending precedence rule
  replaces the legacy load-order case.
- Remove backend mocks made unnecessary by the harness.
- Update test counts in documentation; the current browser suite is 16 e2e
  spec files plus one PWA spec, not 14 plus one.

Benefit: less test weight without reducing product coverage.

Risk: compare test names and covered behaviors, not only pass counts.

### T4. Add missing concurrency and lifecycle tests

Change:

- Two-tab lock contention: tab B writes while tab A replays; both converge
  without an unrelated trigger.
- Engine close: pending retry timers cannot replay or dispatch afterward.
- More than 500 history rows: a change outside the first page arrives.
- Subscription burst: stale async callback completion cannot overwrite newer
  data.
- Service-worker update with an empty outbox and with pending/retry/conflict
  operations.
- Old-tab lazy navigation across a deployed version boundary.
- Offline habit reorder and offline icon rendering.

Benefit: converts this audit's most consequential edge cases into permanent
regressions.

Risk: concurrency tests need deterministic barriers rather than timing sleeps.

## 6. Category D — Dead code and honest static analysis

### D1. Remove unreachable legacy/data-management surfaces

Original-plan comparison: agree with the traced client reachability.

Change:

- Delete the unreachable data-management implementation and its solely
  supporting endpoints.
- Keep `account:reset` only as a documented, authenticated operator tool if it
  has an owner and drill.
- Track user export/import as a separate product/privacy requirement. A missing
  UI makes the current code unreachable; it does not prove data portability is
  permanently unnecessary.

Benefit: removes dormant complexity without losing sight of a product
obligation.

Risk: support/privacy docs must not promise a self-service export after its
implementation is deleted.

### D2. Decide delta-sync architecture before deleting `convex/sync.ts`

Original-plan comparison: modify D2.

`profiles:get`, `habitEntries:listByHabit`, and
`history:listActivityRecordsByActivity` have no current caller and can be
deleted. `sync:listChangedEntities` also has no current caller, but the first
500-row subscription defect creates an immediate design decision: a bounded
delta query may be preferable to reactive pagination.

Change:

- Design S4 first.
- If the chosen solution uses a revised delta query, retain and reshape
  `sync.ts` with owner/generation indexes, stable ordering, tie handling, and
  pagination.
- Otherwise delete it with the other dead endpoints.

Benefit: avoids deleting a potentially useful boundary immediately before
recreating it.

Risk: `updatedAt` alone is not a safe cursor when timestamps tie. Use a stable
compound watermark or server revision protocol.

### D3. Remove compatibility-only cascade mutations after L0

Original-plan comparison: agree.

Change: remove the three verified stale-client-only cascades while preserving
live category and program cascades. First confirm that no deployed artifact can
still invoke them.

Benefit: smaller public mutation surface and removal of a history-tombstoning
footgun.

Risk: old service-worker clients are the only material blocker.

### D4. Remove the full currently hidden export set

Evidence: running Knip without the broad export suppressions surfaced the
following unused exports or groups:

- `auth.initializeAccountControls`;
- `dataManagement.exportOfflineCache`, `commitImport`,
  `resetCloudAccount`;
- `stateHydration.isHydratingCompatibilityState`;
- `storage.exportAppData`, `importAppData`;
- `theme.forceLightMode`;
- `HabitsListModule.initializeHabitsList`;
- `habits.getCSSColorClass`, `getTextColorClass`;
- `habitStats.calculateRollingCompletionRate`;
- `HomeHabitsList.renderHabitsForHome`;
- `HomeHeader.updateHolidayToggle`;
- `ProgressRing.initializeProgressRing`;
- `coreHelpers.calculateProgressForCurrentContext`;
- `uiHelpers.adjustProgress`, `attachSwipeBehaviour`;
- `schedule.toggleHabitCompleted`;
- `datetime.isSameDay`, `toKey`, `fromKey`.

Original-plan comparison: strengthen D4–D6. The original named a subset and
correctly proposed re-arming Knip; this list makes the work reviewable.

Change: for each symbol, either remove the export and dead implementation,
convert it to a private helper with a real caller, or add a narrow documented
Knip exception explaining an external entry point. Do not preserve exports
merely because their names look useful.

Benefit: smaller API surface and an enforceable dead-code gate.

Risk: verify HTML/event-string/global entry points before deletion. Static
analysis is evidence, not sole authority.

### D5. Remove no-op UI lifecycle work

Additional evidence:

- `HomeHabitsList.test()` is dead.
- `HabitsView.updateReorderButton()` is empty.
- `HabitsView.setupResponsiveBehavior()` installs resize/orientation work that
  ultimately calls the empty method.

Change: delete the no-op methods, their listeners, and timers unless a current
behavior test demonstrates an intended effect.

Benefit: less lifecycle noise and fewer global listeners.

Risk: low after responsive habit-page smoke tests.

### D6. Make Knip and cycle checks authoritative

Original-plan comparison: strongly agree. `npx knip --cycles` found no import
cycles, which is a useful non-finding.

Change:

- Remove directory-wide export suppressions.
- Use narrow exceptions only for documented framework/tool entry points.
- Run dead-code and cycle checks in CI.
- Keep generated Convex code and deliberate HTML entry points explicitly
  configured.

Benefit: future dead code becomes a failing change rather than the next audit's
archaeology.

Risk: none beyond resolving the initial backlog.

## 7. Category S — Schema, server, sync, and offline integrity

### S1. Repair cross-tab replay ownership

Evidence: `syncEngine.js:50-67` drops a replay request when another tab owns the
lock; BroadcastChannel is write-only (`34-42`, `109`).

Original-plan comparison: disagree with P7's “navigator.locks discipline
sound” non-finding.

Change, preferred design:

- Request the named lock without `ifAvailable` and let the request queue, then
  re-read the outbox after acquisition. This is simpler than inventing a
  complete leader protocol.
- If cancellation on close is needed, use an `AbortController` for the queued
  request.
- Alternatively, keep `ifAvailable` only with a complete BroadcastChannel
  protocol: `work-available`, `replay-complete`, owner heartbeat, and guaranteed
  retry. The queued lock is preferred.
- Where Navigator Locks is unavailable, explicitly rely on the server's
  operation-ID idempotency for concurrent replay or add an IndexedDB lease;
  test that two engines replaying the same operation converge without a false
  conflict or duplicate entity.
- Install a `closed` flag, retain every retry timer, clear timers and abort lock
  requests in `close()`, and make callbacks no-op after close.
- Re-read until no eligible pending/retry operation remains; do not depend on a
  mutated array inside an original `for...of` iterator.

Benefit: no stranded offline write and no obsolete-engine wakeup.

Risk: a queued lock callback must re-check authentication, online state,
generation, and `closed` after acquiring ownership.

### S2. Commit one reducer action atomically

Evidence: actions such as delete-all holiday periods, record-activity batches,
and program activation produce N operations but call
`commitOptimisticOperation()` N times.

Original-plan comparison: new.

Change:

- Add `commitOptimisticOperations({ operations })` that opens one read-write
  transaction over entities and outbox.
- Read bases, coalesce/supersede predecessors, write every optimistic entity,
  and append every outbox record within that transaction.
- Abort the whole action on quota, serialization, or write failure.
- Dispatch the reducer action only after transaction completion.
- Preserve explicit dependency ordering for server replay.
- Keep the single-operation API as a thin wrapper.

Benefit: the visible reducer state and durable offline state cannot disagree
because operation 12 of 20 failed. One transaction also reduces IDB overhead.

Risk: large batches must remain bounded. Chunking is not a substitute for
atomic product semantics; define a maximum and server-side batch behavior where
needed.

### S3. Bound and index the outbox

Evidence:

- `listOutbox()` reads the whole object store and filters in JavaScript even
  though it is on replay and sign-out polling paths.
- superseded operations are marked in conflict/coalescing paths but no cleanup
  removes them;
- later writes for the same entity inspect historical rows, so a frequently
  toggled habit accumulates growing lookup work.

Original-plan comparison: strengthen and reprioritize P3.

Change:

1. Add the exact compound indexes or cursor ranges needed for
   owner + status + created order and owner + entity.
2. Query `pending`/`retry` directly without materializing unrelated owners or
   terminal rows.
3. Delete a superseded predecessor when its successor is confirmed and no
   dependency/conflict record needs it.
4. Keep diagnostics in bounded metadata or logs, not an unbounded hot object
   store.
5. Optimize account purge afterward; it is rare compared with replay and
   dispatch.

Benefit: bounded storage and stable write/replay cost for long-lived accounts.

Risk: never delete an operation still referenced by
`dependsOnOperationId`, conflict UI, or a pending successor.

### S4. Make realtime history complete

Evidence: initial paging is complete; live subscriptions observe only the first
500 habit entries and activity records.

Original-plan comparison: prerequisite omitted from P2.

Change: choose and document one design:

- **Partitioned reactive windows:** subscribe by bounded date partitions whose
  maximum cardinality is proven, and replace each partition authoritatively.
- **Reactive summary + paged delta:** subscribe to a generation/account change
  token, then page a stable indexed delta query until caught up.
- **Bounded recent reactive window + explicit refresh:** acceptable only if the
  product clearly documents that older edits are fetched on focus/reconnect and
  tests that promise.

For the current three-year offline contract, reactive summary + paged delta is
the most scalable. It must carry tombstones, generation, stable ordering, and a
watermark that cannot skip equal timestamps.

Benefit: correct convergence for large histories without one unbounded reactive
query.

Risk: pagination and reactivity do not combine safely by merely subscribing to
page one and following its cursor. Treat the query as a synchronization
protocol.

### S5. Serialize, diff, and coalesce remote application

Original-plan comparison: strengthen P2.

Change:

- Route every cloud callback through one generation-aware update coordinator.
- Coalesce bursts by entity type/window and allow at most one cache-apply
  transaction at a time.
- Distinguish **merge/delta** results from **authoritative replacement**
  results. For replacement, delete cached rows in that scope that are absent
  from the server result, unless protected by a pending optimistic operation.
- Compare `revision`, `deletedAt`, and relevant content before writing.
- Apply all row changes for one scope in a single IDB transaction.
- Rebuild only affected compatibility slices.
- Deliver one reducer update per microtask/frame batch, and discard an older
  async result if generation or sequence changed.

Benefit: less IDB churn, fewer full clones/renders, no stale-row preservation,
and deterministic callback ordering.

Risk: selective hydration is unsafe without an explicit slice dependency map.
For example, profile/preferences can affect UI outside their nominal entity
array.

### S6. Canonicalize idempotent create

Original-plan comparison: agree.

Change: compare portable records with a stable canonical serializer or
field-wise equality. Test identical payloads with different key insertion
orders, optional fields, and nested objects.

Benefit: legitimate operation replay is duplicate success, not a false client
ID conflict.

Risk: canonicalization must preserve distinctions that matter to Convex
values; do not coerce `undefined`, `null`, dates, or numeric types casually.

### S7. Define processed-operation retention before scheduling it

Original-plan comparison: strengthen S4.

Change:

- Keep cleanup disabled until live evidence.
- Define the maximum offline lease and the idempotency replay window together.
- Add a dry-run count/age distribution and document what a client older than
  the retention window experiences.
- Schedule bounded cleanup only after the owner accepts those semantics and a
  rollback exists.

Benefit: prevents indefinite backend growth without invalidating legitimate
offline replays.

Risk: deleting processed operation IDs too soon can turn a replayed create into
a duplicate entity attempt.

### S8. Establish one default-category authority

Evidence: default activity categories are defined in four locations:
`state.js`, `normalizeLegacy.js`, `convex/account.ts`, and
`convex/profiles.ts`. The original counted three.

Original-plan comparison: correct P6's inventory.

Change:

- Legacy copy dies with migration.
- Move server defaults to one Convex helper shared by profile provisioning and
  operator reset.
- Start client state with `[]`; harness fixtures seed defaults explicitly.
- If a client fallback remains, add a contract test rather than a comment
  asking two constants to stay synchronized.

Benefit: one source for IDs, names, colors, icons, order, and system-default
flags.

Risk: fresh-account and reset smoke tests must prove exactly one set is created.

### S9. Adjacent release blocker: public return validators

Evidence: the production checklist requires every public Convex function to
have an explicit return validator (`RELEASE_CHECKLIST.md:30`), but that
condition is not generally met.

Original-plan comparison: outside pure optimisation, but relevant to claims of
release readiness.

Change: audit public query/mutation/action return validators in a separate,
bounded correctness phase or explicitly defer them in the release risk
register.

Benefit: server contract validation and safer refactoring.

Risk: do not hide this work inside a performance diff; it deserves its own
review.

## 8. Category P — Meaningful runtime and delivery optimisations

### P1. Make dispatch runtime-aware and fail closed

Evidence: the original correctly identifies repeated dynamic import resolution
in `state.dispatch()`.

Original-plan comparison: agree on hoisting; disagree that a missing runtime in
production should commit reducer-direct.

Change:

- Hoist the router module promise or import once at startup.
- Harness mode routes directly to the reducer by explicit flag.
- Cloud production accepts persisted domain actions only when the cloud runtime
  is ready and matches the current owner/generation.
- Before readiness or after persistence failure, return failure, disable the
  initiating control where practical, and show a recoverable storage/sync
  state. Device-only actions remain explicitly allowed.

Benefit: removes repeated module-resolution work without creating silent
unpersisted user changes.

Risk: audit action classification carefully so navigation and ephemeral UI
state do not require cloud persistence.

### P2. Apply selective hydration only after S4–S5

Original-plan comparison: keep its three steps, but reorder and strengthen.

Change:

1. Remove redundant cloning only at trusted fresh-object boundaries.
2. Implement complete, ordered, authoritative cache application.
3. Define slice builders and dependencies.
4. Rehydrate only affected slices and preserve unchanged object identities.
5. Let selector equality suppress downstream views.

Benefit: converts remote update cost from “account-sized” toward
“changed-slice-sized.”

Risk: an apparently unnecessary clone may currently isolate mutable caller
data. Add dev freezing and mutation tests before removal.

### P3. Reduce Home invalidation and forced layout

Original-plan comparison: disagree only with leaving Home untouched. Splitting
the 827-line component is still not recommended without a domain reason.

Change, in descending value:

1. Remove the duplicate responsive-behavior installation.
2. Replace JavaScript height calculation with CSS flex layout,
   `min-height: 0`, and scoped scrolling where cross-browser testing permits.
3. If a resize fallback remains, own one lifecycle-bound listener and batch it
   with `requestAnimationFrame`.
4. Give Home child components explicit slice selectors/invalidation so a
   header-only change does not rebuild habit cards, while preserving the
   current suppression of sync-only changes.
5. Preserve the current DOM when the categorized habit result and selected
   section are referentially/equivalently unchanged.
6. Only after profiling, consider keyed patching of the changed card rather
   than clearing `innerHTML`; preserve swipe state, focus, scroll, and section
   selection.

Benefit: fewer card constructions/listeners, fewer layout reads, less scroll
position disturbance, and better behavior on larger habit lists.

Risk: DOM diffing can be more complex than a fast rebuild for small lists. Gate
the later steps on a 100/500-habit browser benchmark and interaction tests.

### P4. Build and memoize a Statistics view model

Original-plan comparison: new; file splitting remains unnecessary.

Change:

1. Subscribe only to habits, categories, entries/progress, holidays, activities,
   records, rest days, and the local-date boundary needed by the active view.
2. Fix creation-date semantics to prefer explicit `createdAt`.
3. Build one per-date habit aggregate/index for the required range and reuse it
   for 7-day, 30-day, all-time, streak, group, and category calculations.
4. Reuse completion rates already calculated for each habit rather than
   repeating daily calculations.
5. Memoize habit and fitness view models by input collection identities plus
   local date/timezone.
6. Render overview plus only the active detail view; do not build hidden habit
   and fitness detail simultaneously.
7. Preserve the container and patch changed sections rather than showing a
   loading shimmer during synchronous recalculation.
8. Cap or virtualize “all time” work only if measured history makes the indexed
   pass exceed the agreed budget.

Benefit: eliminates full Stats work on sync-status noise and changes repeated
date-by-habit scans into a shared indexed pass.

Risk: local-midnight invalidation and timezone-safe date keys need explicit
tests. Memoization must not conceal in-place mutations; state should continue
using immutable collection replacements.

### P5. Make holidays one derived authority

Original-plan comparison: strengthen P5.

Evidence: hydration expands periods, while `holidays.js` maintains separate
manual singles and period expansion and `isHoliday()` performs array
membership.

Change:

- Keep normalized singles and periods as source state.
- Build one cached holiday selector keyed by those collection identities.
- Expose a `Set` of ISO date keys for O(1) membership and, if needed, an ordered
  array for display.
- Use timezone-safe ISO date arithmetic, validate `start <= end`, and retain a
  documented maximum range.
- Remove mutable module-global copies that can drift from reducer state.

Benefit: one expansion per actual holiday change, not per unrelated hydration
or repeated membership check.

Risk: very long periods can consume memory when expanded. If product needs
unbounded ranges, use interval membership instead of a full Set.

### P6. Separate first-party startup work from vendor investigation

Original-plan comparison: agree with P4, qualify its impact.

Change:

- Remove statically imported migration/data-management code and tighten the
  `cloudBootstrap` budget immediately.
- Add a separate measured investigation of the 587.99-KB-gzip auth chunk:
  determine the Clerk and Convex modules included, how much is required before
  cached-account Home can display, and whether official lighter entry points or
  deferred account-management UI exist.
- Accept a vendor change only if authenticated offline startup, sign-in,
  token refresh, and account controls remain correct.
- Track startup critical-path gzip separately from total precache bytes.

Benefit: locks in the safe first-party win while focusing later work on the
actual dominant chunk.

Risk: do not replace or deep-import authentication internals solely to improve
one bundle number.

### P7. Add a safe PWA update coordinator, then restore lazy boundaries

Original-plan comparison: new.

Change:

- Replace unconditional auto-update activation with an application-controlled
  waiting-worker flow.
- Before activation, inspect outbox states and critical UI flows. Defer when
  writes, retry/conflict resolution, migration/reset, or an unsafe modal action
  is active.
- Prompt or clearly notify the user, then activate and reload atomically.
- Test old and new worker/client coexistence; preserve old precache entries
  until no old client needs them, or guarantee all clients reload.
- After this is proven, return HabitForm and holiday management to intent-based
  dynamic imports instead of static Home imports.
- Consider moving live habit/holiday modal markup out of initial DOM using the
  already successful Fitness `<template>`/materialization pattern. Measure HTML
  parse and first-interaction cost before and after.

Benefit: safe upgrades, smaller Home startup graph, and no missing hashed chunk
failure.

Risk: forcing reload while offline can be destructive to session-only UI even
when the durable outbox is safe. The coordinator needs explicit UX.

### P8. Remove third-party offline holes

Original-plan comparison: new.

Change:

- Replace the remote Material Icons stylesheet/font with a local subset,
  self-hosted font, or reviewed SVG sprite for the icons actually used.
- Install and bundle SortableJS (or a small local reorder implementation) and
  keep it lazy at the reorder interaction boundary.
- Keep Clerk-hosted UI/network requirements documented as online account
  surfaces; do not pretend first-time authentication is offline.

Benefit: reliable installed-PWA UI and reordering offline, less DNS/third-party
latency, and a clearer content-security/privacy boundary.

Risk: verify icon names, accessibility labels, font rendering, license
attribution, pointer/touch reorder, and bundle impact.

### P9. Make prefetch connection-aware and service-worker-aware

Evidence: intent prefetch is useful, but idle and hidden handlers download all
top-level features even when the Pages worker is already precaching them.

Original-plan comparison: new.

Change:

- Keep pointer-down/pointer-enter intent prefetch.
- Remove the current `window` `visibilitychange` listener or attach it to its
  actual `document` target only if background prefetch remains useful.
- Skip or reduce idle prefetch when `navigator.connection.saveData` is true or
  the effective connection is slow.
- On Pages, wait for service-worker readiness and avoid duplicating fetch work
  already guaranteed by successful precache.
- Preserve full offline feature availability if that remains a product
  requirement; optimize scheduling, not blindly remove coverage.
- Measure navigation latency on warm cache, cold cache, slow network, and
  installed offline modes.

Benefit: less first-visit contention and wasted mobile data without regressing
intent navigation.

Risk: Network Information API is not universal; default behavior must remain
sound when absent.

### P10. Replace decorative performance CI with executable budgets

Original-plan comparison: strengthen F3.

Change:

- Delete the disabled Lighthouse shell or restore it with a maintained config
  and real thresholds.
- Run `check:dead-code`, `check:bundle:pages`, `test:pwa`, and a bounded
  performance invariant in PR CI.
- Keep full e2e once; remove unnecessary duplication between CI and deployment
  while deployment remains protected by successful CI.
- Budget:
  - largest JS gzip;
  - startup-critical JS gzip;
  - total JS gzip;
  - total Workbox precache bytes;
  - Home render/update time at 100 and 500 habits;
  - Statistics initial and update time on a seeded large account;
  - remote-delta IDB writes and hydration deliveries for one changed record.
- Capture artifacts/measurements on failure.

Benefit: performance regressions become reviewable failures instead of prose.

Risk: browser timing thresholds need generous, stable CI envelopes. Use
operation counts and relative budgets where wall-clock noise is high.

### P11. Non-findings retained

The following original non-findings remain sound:

- three-year history is a deliberate product/offline window;
- development freezing is not production cost;
- per-subscriber error isolation is a correctness feature;
- manual chunks broadly match real feature boundaries;
- `nextPaint`, startup metrics, equality/date/progress helpers, calendar and
  swipe modules have live consumers;
- `stats.js` and `HomeHabitsList.js` need better computation/render boundaries,
  not arbitrary file splitting;
- no circular import was found by Knip.

Also retain the existing recorded-history identity index and lazy
feature-activation lifecycle; both are good optimisations already present.

## 9. Category F — File, structure, and configuration consolidation

### F1. Revised file-change shape

The original deletion list remains the likely core. Add or modify these
surfaces for the strengthened plan:

| Action | Likely files |
|---|---|
| Add | test harness helper; persistence integration fixture; remote-update coordinator or delta helper; PWA update coordinator; shared Convex defaults |
| Delete | legacy backend/storage/migration modules; unreachable data-management modules; verified dead exports/no-op listeners; disabled performance workflow if not restored |
| Move | `core/migration/periodKeys.js` → shared domain location |
| Strengthen | `syncEngine.js`, `offlineDb.js`, `persistenceRouter.js`, `cloudBootstrap.js`, `state.js` |
| Optimise | `HomeModule.js`, `HomeView.js`, `HomeHabitsList.js`, `stats.js`, `holidays.js`, navigation prefetch |
| Delivery | `vite.config.js`, service-worker registration/update UI, local icons, local lazy reorder dependency |
| Tests/CI | Playwright configs/specs, unit/integration suites, `ci.yml`, bundle budgets, docs |

Do not freeze this table into a promised diff until S4 chooses reactive
partitions versus delta sync.

### F2. Consolidate only real authorities

Original-plan comparison: agree.

Create shared authorities only where multiple live consumers require them:

- Convex default activity categories: one server helper.
- Holiday derivation: one client selector.
- Entity type list: leave local if only one consumer remains.
- Canonical serialization: share only within the runtime that consumes it;
  avoid a cross-client/server abstraction that bundling cannot actually share.

Benefit: removes drift without replacing duplication with a grab-bag constants
module.

### F3. Configuration and documentation hygiene

Original-plan comparison: agree and expand.

- Correct repository metadata.
- Remove retired env vars, scripts, Knip exceptions, workflow conditions, and
  docs in the same phase as their code.
- Add an explicit test-harness command and prohibition in production builds.
- Document Pages build target, service-worker update behavior, offline
  dependency guarantees, cloud configuration, and operator reset/export drills.
- Keep performance budgets near their measurement script and explain what each
  protects.

## 10. Revised implementation plan

Each phase is independently reviewable. A phase does not start merely because
the previous code was written; its gate must pass and its evidence must be
recorded. Phase ordering deliberately separates correctness, destructive
cleanup, and optional performance work.

**Phase 0 — Baseline, deployment census, and backup (L0).**

Record the command baseline in section 1.8. Inspect Pages, controlled service
workers/caches, Clerk environments, Convex deployments/table counts, and local
databases. Export the active generation and any meaningful legacy/migration
data. Decide zero-state fast path versus sunset path.

Gate: owner-visible census record, recoverable export location, target
deployment IDs, and explicit cleanup decision. No destructive change.

**Phase 1 — Harness and persistence seam (T1, T2, P1).**

Add the explicit UI harness, switch Playwright without changing the tested
spec list, make production dispatch fail closed, hoist the router import, and
add the full persistence integration fixture.

Gate: unit, Convex, e2e, PWA, and new persistence integration suites green;
production build rejects the harness flag; missing runtime cannot mutate domain
state silently.

**Phase 2 — Offline correctness before simplification (S1–S3).**

Queue cross-tab locks, close engines completely, make multi-operation actions
one transaction, add hot outbox indexes, and safely clean superseded rows.

Gate: deterministic two-tab contention, close/retry, batch rollback,
dependency, conflict, and long-lived hot-entity tests. Manual two-tab
offline/reconnect smoke.

**Phase 3 — Realtime completeness and ordered application (S4, S5, P2).**

Choose the history synchronization protocol, make results complete beyond 500,
define merge versus replacement scopes, serialize/coalesce callbacks, diff IDB
writes, and deliver selective compatibility slices.

Gate: >500-row remote edit, tombstone/removal, burst ordering, generation
switch, pending-overlay preservation, and one-change operation-count tests.
Manual two-device convergence across recent and old history.

**Phase 4 — Client legacy removal (L1, L2, L4, D4, D5).**

Remove the backend switch, legacy storage/side keys, client migration graph,
state legacy concepts, dead shell, and no-op lifecycle work. Move
`periodKeys.js`. Apply the chosen IDB version strategy without deleting pending
outbox data.

Gate: all automated suites; cloud sign-in, warm confirmed-cache launch, offline
edit/reload/replay, sign-out, and generation reset smoke. Record
`cloudBootstrap`, startup-critical, and precache size deltas.

**Phase 5 — Server/schema and endpoint cleanup (L3, D1–D3, S6–S9).**

On the L0-approved target, remove migration tables/fields/functions, retired
fields, and dead endpoints; keep or replace `sync.ts` according to Phase 3.
Consolidate server defaults and canonical create comparison. Preserve
generations. Define retention metrics without enabling destructive cleanup.

Gate: schema push on disposable/dev deployment, Convex compile/domain tests,
row-count reconciliation, fresh provision, operator reset/recovery, and
authenticated cloud smoke. Production changes require the recorded backup.

**Phase 6 — Tests, docs, and dead-code truth pass (T3, D6, L5, F3).**

Delete historical suites/fixtures, rehome live reducer coverage, un-suppress
Knip, resolve the complete export list, update scripts/workflows/docs, and
correct release/repository metadata.

Gate: `npm run audit` includes honest dead-code/cycle checks; grep for legacy
runtime identifiers finds only deliberate historical documentation; behavior
coverage comparison reviewed.

**Phase 7 — Home, Statistics, and holiday derivation (P3–P5).**

Remove duplicate/empty responsive behavior, prefer CSS layout, narrow Home and
Stats subscriptions, build memoized derived models, correct habit creation-date
semantics, and establish one holiday index.

Gate: functional and visual browser tests at mobile/desktop sizes; focus,
scroll, swipe, carousel, local-midnight, timezone, archived-habit, and
large-account cases. Record Home/Stats operation counts and timings before and
after. Keep any step whose benefit is measurable; revert speculative DOM
complexity that is not.

**Phase 8 — PWA update and offline dependencies (P7–P9).**

Add the safe waiting-worker flow, pending-outbox guard, coexistence/reload tests,
self-host icons, locally bundle the reorder dependency, then re-lazy Home modal
surfaces and tune prefetch scheduling.

Gate: Pages build and PWA suite; installed offline launch; offline reorder and
icons; update with empty/pending/conflict outbox; old-tab lazy navigation;
save-data network test.

**Phase 9 — Budgets and vendor investigation (P6, P10).**

Tighten first-party/startup/precache budgets, make CI gates executable, then
profile the auth vendor chunk using supported public entry points. Land vendor
changes separately and only with auth/offline proof.

Gate: CI fails on a deliberate budget regression; production-like Clerk sign-in,
returning cached account, token refresh, offline lease, Profile, and sign-out
smokes pass.

Suggested review milestones:

1. Census/backup only.
2. Harness plus integration seam.
3. Sync/offline correctness.
4. Realtime protocol.
5. Client deletion.
6. Server/schema deletion.
7. Dead-code/docs truth pass.
8. Home/Stats derivation.
9. PWA/offline delivery.
10. Vendor/budget work.

## 11. Verification matrix and acceptance criteria

| Claim | Verification |
|---|---|
| Destructive removal is safe | L0 Clerk/Convex/Pages/device census + recoverable export + owner decision |
| No production action bypasses persistence | missing-runtime and harness-rejection tests; persisted-action integration cases |
| Cross-tab work cannot be stranded | deterministic lock contention with a write arriving before and during replay |
| Closed engines stay closed | fake-timer retry/close tests and sign-out runtime replacement |
| Multi-record actions are durable-atomic | injected failure at every operation position leaves zero partial writes |
| Outbox remains bounded | successor confirmation cleanup, dependency retention, and hot-entity stress test |
| Realtime history is complete | edits/tombstones before and after row 500 converge on another client |
| Remote callbacks cannot regress state | delayed older callback completes after newer one; newer generation wins |
| Selective hydration preserves correctness | slice dependency tests plus unchanged identity assertions |
| Legacy runtime is gone | no `VITE_DATA_BACKEND`, `healthyHabitsData`, legacy side keys, migration function calls, or retired tables outside history |
| Fresh/reset accounts receive one default set | Convex provision/reset contract tests |
| Home performs less work | render/list-build/layout-read counts and 100/500-habit interaction timings |
| Statistics performs less work | sync-status update causes zero recalculation; seeded large history meets budget |
| Holiday membership has one authority | singles/periods/timezone/range tests and one cached index identity |
| PWA update is safe | empty, pending, retry, conflict, offline, and old-client update cases |
| Offline features are actually local | network-disabled icon and reorder tests |
| Startup reduction is locked | critical-path gzip and `cloudBootstrap` budgets tightened after deletion |
| Total delivery does not regress | largest chunk, total JS gzip, and precache-byte budgets in PR CI |
| Dead code stays visible | unsuppressed Knip exports + cycle check in CI |

Final acceptance:

- Every phase either passes its gate or is explicitly deferred with owner,
  reason, risk, and revisit condition.
- No line-count or bundle win is accepted at the cost of offline durability,
  authentication, generation atomicity, conflict handling, recoverability, or
  PWA update safety.
- Baseline and post-change measurements use the same build target, test data,
  browser, CPU/network profile, and commands.
- The final implementation record lists exact changed files, added/removed
  lines, verification output, live deployment evidence, and rollback point.
- A final read reconciles this document and the original plan so neither
  remains an ambiguous active checklist.

The recommended outcome is therefore not “discard the original plan.” It is:
retain its excellent cleanup spine, insert the missing safety and sync
correctness phases ahead of deletion, then add targeted Home, Statistics, PWA,
offline-dependency, and CI work where this independent audit found meaningful
user benefit.
