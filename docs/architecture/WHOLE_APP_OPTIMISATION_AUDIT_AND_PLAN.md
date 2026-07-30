# Whole-App Forensic Optimisation Audit and Implementation Plan

Date: 2026-07-30. Branch audited: `codex/whole-app-optimisation` at `bcc0044b`
(clean tree). Every file under `src/`, `convex/` (excluding `_generated/`),
`tests/`, `scripts/`, `.github/workflows/`, the build/test configs, `index.html`
and all of `docs/` was read or traced for this audit. Nothing in this document
is speculative: every "unused" claim below was verified by tracing importers
and call sites, not by tooling alone.

## 0. How to read this document

- Sections 1–2 establish the architecture as found and the executive summary.
- Sections 3–8 are the findings, grouped into categories **L** (legacy backend
  and migration removal), **T** (test-infrastructure redesign the removal
  forces), **D** (dead code independent of legacy), **S** (Convex schema and
  server), **P** (performance), and **F** (file/structure consolidation and
  config hygiene). Each finding states the evidence, the change, and the risk.
- Section 9 is the phased implementation plan with gates.
- Section 10 is the verification matrix and acceptance criteria.

The controlling premise, confirmed with the owner: **the app has never been
released**. No real user has data in the legacy localStorage/IndexedDB format,
no old service worker holds a pre-archive client, and no production Convex
deployment holds rows written by retired schema fields. Everything that exists
only to carry data or clients forward from a past that never shipped is
removable. Where a legacy-named test covers behaviour that is still live, the
behaviour keeps its coverage under a truthful name; where it covers the
migration machinery itself, it is deleted with the machinery.

## 1. Architecture as found

### 1.1 Runtime

Vanilla-JS PWA built with Vite; Convex (TypeScript functions) is the
authoritative store; Clerk provides identity; an IndexedDB
(`habitsConvexCache`) holds the per-account confirmed cache plus a durable
offline outbox replayed by `SyncEngine` with three-way merge conflict handling.
State is a single frozen-in-dev store with a reducer, action creators, and
selector subscriptions (`src/core/state.js`, 1,123 lines). ~28,400 lines of
first-party JS/TS.

### 1.2 The dual backend

`src/core/dataBackend.js` selects between two complete persistence stacks via
`VITE_DATA_BACKEND`, **defaulting to `legacy`**:

- **legacy** — whole-state JSON snapshots in `localStorage.healthyHabitsData`
  and IndexedDB `healthyHabitsDB/state/appData` (`src/core/storage.js`),
  debounce-saved on every state change, cross-tab synced via `storage` events,
  with side keys (`theme`, `homeSectionVisibility`, `activeHabitTrackerTab`,
  `fitnessRestDays`, `habitsAppFitnessMigrationV1`).
- **cloud** — Clerk + Convex + confirmed cache + outbox, bootstrapped by
  `src/core/cloudBootstrap.js`.

Fifteen call sites branch on `isCloudBackend()` across `main.js`, `state.js`,
`storage.js`, `theme.js`, `navigation.js`, `holidays.js`, `restDays.js`, and
the home helpers.

### 1.3 The migration pipeline

`src/core/migration/` (7 modules, 839 lines) reads, fingerprints, normalizes,
merges, backs up, uploads, verifies and activates legacy snapshots into Convex
generations, with `convex/migration.ts` (284 lines) as the server side and a
`migrationBatches` + `legacyData` schema surface. Crucially, **all of it except
`periodKeys.js` is statically imported by `cloudBootstrap.js`**, so every
cloud-mode startup ships and parses the migration pipeline even though the
migration can never have anything to migrate for a new user.

### 1.4 Tests

- 24 Vitest suites (unit + migration + one convex-test suite).
- 14 Playwright e2e specs plus one PWA spec. **Both Playwright configs start
  the dev server with `VITE_DATA_BACKEND=legacy`** and drive/inspect the app
  through `window.__APP_TEST__`, which `state.js` exposes only when
  `import.meta.env.DEV && !isCloudBackend()`. The entire browser-test
  infrastructure therefore runs against the backend being removed.

## 2. Executive summary

| Theme | Outcome |
|---|---|
| Legacy backend + migration pipeline | Fully removable: ~2,400–2,700 lines across 20+ files, 2 Convex tables, 4 profile fields, 1 Convex module and parts of 3 more |
| Dead code unrelated to legacy | ~700 further lines: an entire unreachable export/import/reset subsystem, 7 unreachable Convex endpoints, dead UI containers and exports |
| Test infrastructure | e2e suites must move off the legacy backend onto an explicit in-memory harness mode (~40 lines of app code); 7 test files deleted, 5 reworked, 2 renamed |
| Schema | `legacyData`, `migrationBatches` tables and migration bookkeeping removed; three retired-but-declared fields (`programPreload`, `scheduleMode`, `anytimeRoutines`) dropped for good |
| Performance | Startup chunk sheds the migration pipeline; remote-update path stops rewriting whole tables and rebuilding all state per ping; several O(entire-store) IndexedDB scans fixed |
| Config hygiene | `deploy.yml` no longer defaults production to `legacy`; knip stops suppressing the export checks that would have caught the dead code |

Net effect: roughly **3,000–3,400 lines and ~15 files removed**, one smaller
and more truthful schema, a faster startup and remote-update path, and a test
suite that exercises the only backend that will ever ship.

## 3. Category L — Remove the legacy backend and migration pipeline

### L1. Retire `VITE_DATA_BACKEND` and the backend switch

Evidence: `src/core/dataBackend.js`; `.env.example` line 3
(`VITE_DATA_BACKEND=legacy`); `.github/workflows/deploy.yml` line 68
(`VITE_DATA_BACKEND: ${{ vars.VITE_DATA_BACKEND || 'legacy' }}` — production
deploys silently fall back to the legacy backend if the repo variable is
unset); `playwright.config.js` and `playwright.pwa.config.js` web-server
commands.

Change:
- Delete `dataBackend.js`. Move `assertCloudConfiguration()` into
  `src/core/convexClient.js` (its natural home — it validates the two env vars
  that module consumes).
- Remove the env var from `.env.example`, both workflows, both Playwright
  configs and the runbook. The deploy workflow fails loudly when
  `VITE_CONVEX_URL`/`VITE_CLERK_PUBLISHABLE_KEY` are missing instead of
  quietly building a localStorage app for production.
- `main.js` bootstraps cloud persistence unconditionally (harness mode aside —
  see T1); the `activeHabitTrackerTab` cleanup branch and legacy
  `loadDataFromLocalStorage()` call are deleted.

Risk: low. The only behavioural loss is the ability to run the app without a
Convex deployment, which T1's harness mode restores explicitly for tests and
local UI work.

### L2. Delete the legacy persistence layer

Evidence: `src/core/storage.js` (210 lines) is legacy-only end to end:
snapshot load, debounced save, `memoryStorage` polyfill, its own private
`healthyHabitsDB` IndexedDB helper, cross-tab `storage` listener, and
`exportAppData`/`importAppData` which **no module imports** (verified: sole
importer of `storage.js` is `main.js`, importing only
`loadDataFromLocalStorage`).

Change: delete the file. Delete the legacy side-key writes/reads it anchored:
`theme.js` (`localStorage.theme` read/write branches), `navigation.js:157`
(`activeHabitTrackerTab`), `features/home/helpers/coreHelpers.js` /
`uiHelpers.js` (`homeSectionVisibility` localStorage fallback),
`features/fitness/restDays.js` (`fitnessRestDays` one-time legacy import),
`features/holidays/holidays.js` legacy-source branch.

Risk: low; each branch is dead once `isCloudBackend()` is always true.

### L3. Delete `src/core/migration/` (keep `periodKeys.js`)

Evidence: import graph traced. `canonical.js`, `normalizeLegacy.js`,
`mergeLegacy.js`, `mergeNormalized.js`, `sourceReader.js`, `coordinator.js`
serve only migration and the dead import path (D1). `periodKeys.js` is
different: `persistenceRouter.js` uses `periodSortDate()` on every habit-entry
write — it is live domain logic that was filed under migration.

Change:
- Move `periodKeys.js` to `src/shared/periodKeys.js` (it is pure date logic).
- Delete the other six modules (811 lines).
- `cloudBootstrap.js` loses: `readLegacySources`, `selectLegacyDefault`,
  `summarizeLegacySources`, `mergeLegacySnapshots`, `normalizeLegacySnapshot`,
  `meaningfulLegacySnapshot`, `checksum`, `mergeNormalizedTables`,
  `exportCloudData`, `backUpLegacySources`, `renderMigrationPreview`,
  `uploadAndActivateMigration`, `hasMeaningfulLegacyData`, the
  `migration_required` flow, and the `additional_device_merge_required` flow —
  approximately 200 lines plus the `shouldInspectLegacySources` gate in the
  fast path. `hydrateEarlyConfirmedCache()` drops its legacy-source inspection
  and the `migrationVerified` metadata handshake entirely: a confirmed cache
  for the active generation is sufficient.
- `renderMigrationPreview`'s DOM overlay goes with it; nothing else uses it.

Risk: low-medium — this is the largest single edit (cloudBootstrap shrinks
from 605 to roughly 350 lines) and it touches the startup fast path, so it is
gated by the full e2e pass and a manual two-device smoke test in Phase 5.

### L4. Remove migration from Convex

Evidence: `convex/migration.ts` (begin/uploadChunk/verify/activate/abandon/
getStatus); `convex/schema.ts` tables `migrationBatches`, `legacyData`;
`userProfiles.migrationStatus`, `.activeMigrationBatchId`,
`.migrationCompletedAt`; `convex/lib/checksum.ts` (`tableChecksum`,
`portableMigrationRecord`); `bootstrap.ts` collecting `legacyData`;
`profiles.provision` seeding `migrationStatus: "not_started"` (verify exact
field list when editing).

Change:
- Delete `convex/migration.ts`.
- Drop `migrationBatches` and `legacyData` tables and the three migration
  fields on `userProfiles`. Keep `previousGeneration` only if `account:reset`
  is kept (D2); otherwise drop it too.
- `bootstrap:getCore` stops collecting/returning `legacyData`.
- Delete `convex/lib/checksum.ts` if `dataTransfer.ts` also goes (D2), else
  trim to what remains.
- Client mirrors: remove `legacyData` from `ENTITY_TYPES`/`emptyCache` in
  `cloudBootstrap.js`, from `stateHydration.js` (`foodLog`/`stats` lines
  255–256), and delete the duplicated 13-entry `TABLES` lists (see F2).
- Dev deployments are wiped or `npx convex dev` pushes the schema change; with
  no released users there is no data-compat constraint.

Risk: low. `npm run test:convex` (tsc) and `tests/convex/domain.test.js`
gate it.

### L5. Remove migration storage from the offline DB

Evidence: `offlineDb.js` `migrationBackups` store + `saveMigrationBackup()`
(only caller: `coordinator.js`); the DB is versioned (`DB_VERSION = 1`).

Change: remove `saveMigrationBackup` and the `migrationBackups` store
creation. Because devices in the field are only the owner's, keep
`DB_VERSION = 1` and delete the dev-machine DB once, rather than shipping a
version bump; note this explicitly in the PR description. Also remove the
`migrationVerified` / `legacyFingerprint` keys from `putSyncMetadata` call
sites.

### L6. Purge legacy concepts from state

Evidence: `state.js` — `syncStatus: 'legacy'` initial value; `foodLog: []`,
`stats: {}` in `initialState` (only producers/consumers were legacy snapshot
and `legacyData` hydration); the DEV+legacy `window.__APP_TEST__` gate;
`isCloudBackend()` import.

Change: initial `syncStatus` becomes `'connecting'`; `syncStatusUi.js`
presentation map updated accordingly; `foodLog`/`stats` deleted from
`initialState` and from `normalizedToCompatibilityState`; `__APP_TEST__`
moves behind the harness flag (T1). Also delete in the same pass:
the commented-out `UPDATE_HABIT_PROGRESS`/`UPDATE_HABIT_SKIPPED_DATES` action
stubs (lines 230–233, 426–433) and the dead `Selectors` export (D5).

### L7. Docs and release material

Change: mark `PERSISTENCE_AUDIT.md` and the migration sections of
`CONVEX_MIGRATION_RUNBOOK.md` as historical records of the retired pipeline
(the runbook keeps its live deployment/verification content); update
`PROJECT_RULES.md`, `README.md`, `.env.example`, `docs/README.md`, and the
release checklist so no active document instructs setting
`VITE_DATA_BACKEND`. The PERSISTENCE_AUDIT note scheduling
`activities:removeCascade`/`routines:removeCascade` removal "after
2026-10-29" is overtaken by events: the stale-client window it protected
never existed (D3).

## 4. Category T — Test infrastructure redesign

### T1. Replace legacy-mode e2e with an explicit in-memory harness mode

Evidence: both Playwright configs boot `VITE_DATA_BACKEND=legacy`; 8 spec
files evaluate `window.__APP_TEST__`; `tests/e2e/fitness/page-shell.spec.js`
and `programs.spec.js` seed via `localStorage.healthyHabitsData` /
`seedLegacyStorage`; the dispatch fast path the specs rely on (synchronous
reducer commit, no persistence router) exists only when `isCloudBackend()` is
false.

Decision (recommended): introduce a deliberate, honestly-named harness mode
rather than mocking Convex or testing against a live deployment:

- `VITE_TEST_HARNESS=1` (dev/test builds only). `main.js`: when set, skip
  cloud bootstrap entirely — state stays in memory, no persistence, no auth.
- `state.js`: expose `window.__APP_TEST__` when `import.meta.env.DEV &&
  import.meta.env.VITE_TEST_HARNESS`. Dispatch routes straight to the reducer
  because no cloud runtime exists — no `isCloudBackend()` check needed once
  the router condition becomes "cloud runtime configured and action
  unsourced" (see P1).
- Seeding: replace `seedLegacyStorage()` with a `window.__APP_TEST__.seed()`
  helper (wraps `dispatch(Actions.importData(snapshot))`) called via
  `page.evaluate` after load; the two storage-seeding specs are rewritten to
  use it. All other specs already act through the UI or `__APP_TEST__` and
  need only the config change.
- Both Playwright web-server commands become
  `VITE_TEST_HARNESS=1 npm run dev …` / build equivalents.

This keeps the suite deterministic and fast, tests the real reducer, views,
and modals, and adds ~40 lines of clearly-labelled app code. What it does not
cover — persistenceRouter → outbox → SyncEngine → Convex — is exactly what the
existing unit suites (`persistenceOperations`, `persistenceRecords`,
`syncEngineReplay`, `offlineDb`, `conflicts`, `stateHydration`,
`operationPayload`, `tests/convex/domain.test.js`) cover with
fake-indexeddb and convex-test. Rejected alternatives: driving e2e against a
real Convex dev deployment (auth flows, network flake, shared-state bleed,
CI secrets) and a full Convex client mock (large, drifts from the real
protocol).

### T2. Delete migration/legacy test assets; rehome live coverage

- Delete: `tests/migration/` (4 suites), `tests/fixtures/legacy.js`,
  `tests/helpers/storageSeed.js`, and the `test:migration` script +
  `npm test` reference in `package.json`, plus knip entries.
- `tests/unit/legacyBehavior.test.js`: the four behaviours it locks down
  (category delete cascades habits, activity archive preserves records,
  routine archive preserved, IndexedDB-wins load order) are **live reducer
  semantics**, not migration behaviour — except the load-order case, which
  dies with `storage.js`. Rewrite as `tests/unit/reducerCascades.test.js`
  keeping the three live cases.
- `tests/unit/stateHydration.test.js`: drop `legacyData`/`foodLog`
  expectations; the rest stands.
- `tests/unit/routines.test.js`, `programs.test.js`, `activityBatch.test.js`,
  `fitnessPerformanceHarness.test.js` currently mock `dataBackend.js` to force
  the reducer-direct path; after P1 the mock becomes "no cloud runtime
  configured", which is the natural test default — the `vi.mock` blocks and
  their explanatory comments are deleted.
- `tests/unit/deviceStateActions.test.js` stubs `VITE_DATA_BACKEND=cloud`;
  restate it in terms of the new router condition.

## 5. Category D — Dead code (independent of the legacy backend)

Knip's clean bill of health is an artefact of `knip.json` suppressing
`exports` issues for `src/components/**`, `src/core/**`, and every non-fitness
feature directory. The following were verified dead by tracing importers.

### D1. The unreachable export/import/reset subsystem

Evidence: `src/core/dataManagement.js` (150 lines) exports `exportCloudData`,
`exportOfflineCache`, `previewImport`, `commitImport`, `resetCloudAccount`.
The **only** importer anywhere is `cloudBootstrap.js` (for `exportCloudData`,
used solely by the additional-device merge flow deleted in L3). No UI module
references any of it — `ProfileModule.js` imports none of these. Transitively
dead with it: `convex/dataTransfer.ts` (`getExportPage` — sole caller is
`exportCloudData`) and `convex/account.ts` (`reset` — sole caller is
`resetCloudAccount`).

Change: delete `dataManagement.js` and `convex/dataTransfer.ts`. For
`convex/account.ts`: **keep**, documented as an operator tool runnable from
the Convex dashboard (it is the only way to reset an account's data without
touching the database by hand), and note it in the runbook. If the owner
prefers a pure-minimal tree it can go too; nothing in the client will break
either way. A user-facing export/import feature, if ever wanted, should be
rebuilt against the post-cleanup schema rather than preserved in amber.

### D2. Unreachable Convex endpoints

Evidence: exhaustive grep of `functionReference(...)` literals plus every
`mutationName` string built in `persistenceRouter.js`, cross-checked against
`convex/*` exports.

Dead — delete:
- `convex/sync.ts` — `listChangedEntities` (whole module; no caller).
- `profiles:get` (query in `profiles.ts`; no caller).
- `habitEntries:listByHabit` (no caller).
- `history:listActivityRecordsByActivity` (no caller).

### D3. Compatibility-only cascade mutations

Evidence: `habits:removeCascade`, `activities:removeCascade`,
`routines:removeCascade` are exported but the client archives via `:update`
in all three cases (persistenceRouter). PERSISTENCE_AUDIT kept the fitness
pair only for "pre-archive clients cached by an older service worker" — a
population that does not exist for an unreleased app. `habitCategories:
removeCascade` and `programs:removeCascade` **are live** (category delete and
program delete) and stay.

Change: delete the three dead exports and, where the underlying
`crud.remove`/`afterDelete` cascade config exists only for them
(`activities.ts`, `routines.ts`, `habits.ts`), the associated cascade
helpers. This also removes the standing footgun the persistence audit warned
about: `activities:removeCascade` tombstoning training history can no longer
be called by anything.

### D4. Dead UI and shell fragments

- `index.html` `#food-view` (line 159): no navigation target, no tab, no
  module ever mounts it — remove. (`foodLog` state removal is L6.)
- `initializeAccountControls()` in `auth.js` (lines 331–335): zero callers;
  its body is itself a cleanup for a control that no longer exists — remove.

### D5. Dead exports inside `state.js`

`Selectors` (lines 1085–1102): the only "Selectors" hits elsewhere in `src`
are unrelated identifiers in `HabitFrequencySection.js`. Remove the export;
subscription call sites all pass inline selector functions.

### D6. Re-arm the dead-code tooling

`knip.json`: after D1–D5 land, delete the `ignoreIssues` blanket for
`src/core/**`, `src/components/**` and the feature directories, fix or
explicitly annotate what then surfaces, and keep `check:dead-code` in the `audit`
script so regressions fail loudly instead of being configured away. Add the
deleted files' patterns nowhere — the point is that nothing references them.

## 6. Category S — Schema and server findings

### S1. Drop the three retired-but-declared fields

`userPreferences.programPreload`, `programs.scheduleMode`,
`programs.anytimeRoutines` are declared optional purely so pre-retirement rows
still validate — rows that only exist on the owner's dev deployments. Drop
them from the schema, from `stateHydration.js`'s defensive
`delete hydrated.scheduleMode / anytimeRoutines`, and reset dev data. The
schema stops documenting product history it no longer has.

### S2. Generation machinery: keep, with its purpose restated

`generation` is stamped on every row and index. With migration gone its only
writer-of-change is `account:reset` (kept as an operator tool, D1). Removing
generations entirely would touch every table, index, cache key and the
outbox — high blast radius for the benefit of deleting one field. Decision:
keep, and re-document it as "reset/import epoch" rather than migration
bookkeeping. Revisit only if `account:reset` is also deleted.

### S3. `lib/domain.ts` idempotent-create comparison

`create` detects replayed creates by `JSON.stringify(portable(current)) ===
JSON.stringify({ ...payload, revision: 1 })` — key-order-sensitive, so a
semantically identical replay whose keys serialise differently is misreported
as a `clientId` conflict instead of a duplicate. Low-probability today
(payloads are built by one code path); fix opportunistically in Phase 6 by
comparing with the canonical stable stringify (one small helper, now that
`canonical.js` is gone client-side, implement it in `lib/checksum.ts`'s
replacement or inline).

### S4. Retention job

`maintenance.cleanupEligibleRecords` stays: it is the only cleanup for
`processedOperations` and is deliberately unscheduled pending production
evidence (runbook). No change beyond removing tombstone/generation wording
that referenced migration generations.

## 7. Category P — Performance findings

### P1. Persistence-router gate should test the runtime, not the env var

`state.js` `dispatch()` routes through
`import('./persistenceRouter.js')` whenever `isCloudBackend()` and the action
is unsourced — including in harness mode and before bootstrap completes.
Change the gate to "a cloud runtime is configured" (cheap check via
`cloudRuntime.js`) and hoist the dynamic import to a one-time module promise
so steady-state dispatch stops paying an import-resolution microtask per
action. This is also what makes T1/T2 fall out naturally: no runtime, no
router, reducer-direct — in tests and before persistence is ready alike
(pre-runtime UI dispatches today already fail the persist step with an
error; the new gate makes that window behave as device-local instead).

### P2. Remote updates rebuild and repaint everything

Evidence: `cloudBootstrap.js` — each of the four `client.onUpdate`
subscriptions calls `cacheCore()`/`putConfirmedEntities()` (rewriting **every
row** of the affected tables into IndexedDB) and then
`rehydrateFromConfirmedCache()`, which re-reads **all** entity types for the
generation, overlays the outbox, rebuilds the entire compatibility state, and
dispatches `HYDRATE_CACHE`, whose reducer `deepClone`s the whole payload
before spreading it. A single remote habit tick re-serialises and re-clones
the account.

Changes (in order of value:effort):
1. Drop the `deepClone` in `HYDRATE_CACHE`/`IMPORT_DATA` for hydration-built
   payloads — `normalizedToCompatibilityState` already returns freshly
   constructed objects; clone only externally-supplied imports (the seed
   path can clone at the boundary instead).
2. Make `rehydrateFromConfirmedCache` selective: the three window
   subscriptions (habitEntries / activityRecords / restDays) only need their
   own slice rebuilt; only `getCore` updates need the full rebuild.
3. `putConfirmedEntities` should skip writes when the incoming record's
   `revision`/`updatedAt` matches the cached row (cheap read-before-write in
   the same transaction) so steady-state pings stop churning IndexedDB.

### P3. O(entire-store) IndexedDB scans

- `listOutbox()` does `getAll()` on the whole outbox and filters in JS,
  despite the `by_owner_status_createdAt` index — and it is called in loops
  (`SyncEngine.replay` re-lists after every operation; `syncBeforeSignOut`
  polls it 4×/second). Use the index with a key range per status.
- `purgeAccountCache()` does `getAll()` over all entities and outbox rows and
  deletes one by one; use index cursors/key ranges on `ownerKey`.

Both are small, self-contained fixes in `offlineDb.js`.

### P4. Startup chunk contents

The migration pipeline, `sourceReader`, mergers, and `dataManagement` are
statically imported into the `cloudBootstrap` chunk today, and
`check-bundle-budgets` counts them on the critical path. L3/D1 delete them,
which is the single biggest startup-bytes win available without touching a
feature. After removal, re-baseline `scripts/check-bundle-budgets.mjs`
budgets downward so the win is locked in, not just enjoyed.

### P5. Duplicated holiday expansion

`expandHolidayPeriods` (`stateHydration.js`) and `expandPeriod`
(`normalizeLegacy.js`) are the same loop with the same 36,600-date cap; the
legacy copy dies in L3. The surviving one runs on every hydration; with P2's
selective rehydration it stops running on history-window pings. Additionally,
`features/holidays/holidays.js` maintains its own period-expansion cache —
after L2's branch removal, confirm one authority (state hydration) feeds it
rather than re-deriving (verify at implementation time; likely a follow-on
simplification inside `holidays.js`).

### P6. Three default-category constants

The five default activity categories are declared in `state.js`
(`initialState.activityCategories`), `convex/account.ts`
(`DEFAULT_CATEGORIES`), and `normalizeLegacy.js`
(`DEFAULT_ACTIVITY_CATEGORIES`). The legacy copy dies in L3. The client copy
in `initialState` is only ever *seen* pre-hydration (cloud data immediately
replaces it) — harmless but misleading; keep client + server copies, add a
comment cross-referencing them, or drop the client copy to `[]` and let
provisioning be the single authority. Recommended: drop to `[]` in the same
phase as T1, since harness-mode tests are what currently observe the client
defaults (seed them explicitly in the fixtures that need them).

### P7. Non-findings (checked, left alone)

For completeness, paths inspected and deliberately not changed: the
three-year history window (deliberate, documented choice from the loading
audit); `freezeForDevelopment` (dev-only); `notify()`'s per-subscription
try/catch (correctness feature); `SyncEngine` retry/backoff and
navigator.locks discipline (sound); `hh-calendar`, `swipeableCard`,
`nextPaint`, `startupMetrics`, `equality.js`, `dateSelection.js`,
`selectors/progress.js`, `scrollHelpers.js` — all live with real consumers;
Vite manual-chunking strategy (matches the fitness audit's conclusions);
`index.html`'s static modal markup (deliberate post-fitness-audit
architecture; only `#food-view` is dead). The stats module (1,317 lines) and
`HomeHabitsList` (827) are large but cohesive; splitting them is not
justified by evidence now and is explicitly out of scope.

## 8. Category F — File, structure, and config consolidation

### F1. Files deleted / moved (summary)

| Action | Files |
|---|---|
| Delete (src) | `core/storage.js`, `core/dataBackend.js`, `core/dataManagement.js`, `core/migration/{canonical,normalizeLegacy,mergeLegacy,mergeNormalized,sourceReader,coordinator}.js` |
| Move | `core/migration/periodKeys.js` → `shared/periodKeys.js`; delete emptied `core/migration/` |
| Delete (convex) | `migration.ts`, `dataTransfer.ts`, `sync.ts`; `lib/checksum.ts` (superseded by S3's single canonical-stringify helper) |
| Delete (tests) | `tests/migration/` (4), `tests/fixtures/legacy.js`, `tests/helpers/storageSeed.js`; `legacyBehavior.test.js` (rewritten as `reducerCascades.test.js`) |
| Trim | `cloudBootstrap.js` (~250 lines), `state.js`, `offlineDb.js`, `auth.js`, `profiles.ts`, `habitEntries.ts`, `history.ts`, `habits.ts`, `activities.ts`, `routines.ts`, `schema.ts`, `index.html`, both Playwright configs, `deploy.yml`, `.env.example`, `knip.json`, `package.json` |

### F2. One authority for the entity-type list

The 12/13-entry table list is currently declared five times
(`convex/migration.ts`, `convex/dataTransfer.ts`, `src/core/dataManagement.js`,
`src/core/migration/coordinator.js`, `cloudBootstrap.js` `ENTITY_TYPES`).
Four die with L/D removals. The survivor (`ENTITY_TYPES` in
`cloudBootstrap.js`) stays where it is used; if a second consumer ever
reappears it moves to `shared/constants.js`. No new abstraction is created
for a list with one consumer.

### F3. Config and workflow hygiene

- `package.json`: drop `test:migration` (fold remaining suites into
  `test:unit`), update `test` accordingly; scripts otherwise sound.
- `.eslintignore` / configs: remove references to deleted paths if any.
- `performance.yml`: the Lighthouse step is `if: false` with an echo — either
  delete the workflow or the step; a workflow that cannot fail is
  documentation pretending to be CI. Recommended: delete the step, keep the
  bundle-budget job if one is added, otherwise delete the workflow.
- Repo metadata in `package.json` points at
  `github.com/your-org/healthy-habits-tracker`; fix to the real repo.
- `docs/` gains this document; superseded docs marked historical per L7.

## 9. Implementation plan

Ordered so the tree is releasable after every phase; each phase is one PR-able
commit series on this branch with its gate stated. Phases 1–4 are the
dependency-ordered core; 5–6 are follow-ons that build on the cleared ground.

**Phase 0 — Baseline.** Record `npm test`, `npm run test:e2e`,
`npm run check:bundle` numbers on the branch tip. Gate: all green (current
state), budgets captured.

**Phase 1 — Test harness first (T1, P1).** Introduce `VITE_TEST_HARNESS`,
re-gate `__APP_TEST__`, change the dispatch gate to runtime-presence, hoist
the router import, switch both Playwright configs, rewrite the two
storage-seeding specs, adjust the four `vi.mock('dataBackend')` unit suites.
The legacy backend still exists in this phase; the tests just stop using it.
Gate: full unit + e2e + pwa suites green under the harness. This proves the
replacement before anything is deleted.

**Phase 2 — Client legacy removal (L1, L2, L3, L5, L6, D4, D5).** Delete the
backend switch, storage layer, migration modules (moving `periodKeys.js`),
cloudBootstrap flows, offline-DB migration store, state legacy concepts, dead
shell/exports. Gate: unit + e2e green; manual cloud smoke (sign-in, warm
reload, offline edit → replay) on the dev deployment; `check:bundle` shows
the startup-chunk reduction; budgets re-baselined (P4).

**Phase 3 — Server legacy + dead-endpoint removal (L4, D1, D2, D3, S1).**
Schema and function deletions, dev-deployment reset, client mirror updates
(`ENTITY_TYPES`, hydration fields). Gate: `test:convex`,
`tests/convex/domain.test.js`, e2e, and a fresh-account provisioning smoke
test.

**Phase 4 — Tests and docs truth pass (T2, L7, F3, D6).** Delete migration
suites/fixtures, rewrite `legacyBehavior` → `reducerCascades`, un-suppress
knip and resolve what it finds, update scripts/workflows/docs, fix repo
metadata. Gate: `npm run audit` (now including an honest `check:dead-code`)
green; grep for `legacy` in `src/ convex/ tests/` returns only deliberate
historical-doc references.

**Phase 5 — Remote-update and IDB efficiency (P2, P3).** Selective
rehydration, clone removal, revision-gated cache writes, indexed outbox/purge
queries. Gate: unit suites for `offlineDb`/`stateHydration` extended to cover
the new paths; manual two-tab convergence check; no e2e regressions.

**Phase 6 — Opportunistic correctness (S3, P5, P6).** Canonical create
comparison, holiday-expansion single authority, default-category authority.
Gate: targeted unit tests.

Estimated diff across phases: ≈ −3,200 / +450 lines.

## 10. Verification matrix and acceptance criteria

| Claim | Verified by |
|---|---|
| No source path reads `VITE_DATA_BACKEND` or `healthyHabitsData` | grep gate in Phase 4; knip unlisted-deps pass |
| Cloud sign-in, warm launch, offline replay unaffected | Phase 2/3 manual smokes + `syncEngineReplay`, `offlineDb`, `persistenceOperations` suites |
| Reducer cascade semantics preserved | `reducerCascades.test.js` (rewritten), `homeHabitState`, e2e habit flows |
| e2e coverage not reduced by harness switch | identical spec list passing in Phase 1 before any deletion |
| Schema contains no write-path for removed tables/fields | `test:convex` compile + `domain.test.js` |
| Startup payload shrinks | `check:bundle` before/after, budgets tightened to new sizes |
| No dead exports reintroduced | knip un-suppressed in `audit` script |

Acceptance: all phases merged, every gate green, and a final read of this
document confirming each finding's change landed or was explicitly deferred
with a note added to this section.
