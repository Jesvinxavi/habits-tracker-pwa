# Whole-App Optimisation Implementation Status and Handoff

Date: 2026-07-30

Branch: `codex/whole-app-optimisation`

Implementation base: `feeb0f48`

Current implementation commit: `2c82c5f7`

## 0. Purpose and authority

This document is the implementation record and pickup point for
`WHOLE_APP_OPTIMISATION_INDEPENDENT_AUDIT_AND_REVISED_PLAN.md`.

It records:

- what was actually implemented;
- what was committed and where;
- what was tested, including exact results;
- which decisions changed or refined the revised plan;
- what was deliberately not deployed or manually exercised;
- the remaining risks and work in dependency order;
- the exact safety state of development and production data.

This is not a claim that the whole revised plan is complete. The source
implementation is substantially advanced, but the development Convex
deployment has not received the narrowed schema, no production deployment was
changed, no authenticated cloud smoke was run against the new functions, and
the requested phone/in-app-browser pass was stopped before it began.

The correct continuation point is section 13. Do not restart the audit or
re-implement the committed phases.

## 1. Executive status

### 1.1 Completed and committed

- The independent revised plan was written and indexed.
- Browser UI tests use an explicit in-memory harness rather than a legacy
  backend.
- Normal builds fail closed if the harness flag is present.
- Home, Statistics, holiday indexing, and invalidation paths were narrowed.
- IndexedDB multi-operation writes are atomic.
- Cross-tab replay uses queued Web Locks, safe close cancellation, peer wake-up,
  indexed outbox reads, and superseded-chain cleanup.
- Remote history synchronization is paginated, inclusive at its watermark,
  serialized, coalesced, generation-aware, and tombstone-aware.
- The client legacy backend, migration graph, data-management shell, and
  migration-only tests were removed.
- Convex migration/data-transfer functions and retired schema fields were
  removed from source.
- Convex defaults were consolidated and dead endpoints removed.
- A protected-field authorization defect found during the Convex review was
  fixed.
- PWA updates now wait for user confirmation and defer for offline state,
  critical editors, pending/retry/syncing work, or conflicts.
- Every controlled tab reloads after an accepted worker update.
- Material Icons and SortableJS are local/offline-capable.
- Home habit and holiday management entry points are lazy again.
- Knip now reports all unused exports; the surfaced dead implementations were
  removed.
- Automated unit, Convex, PWA, bundle, dead-code, cycle, and browser gates were
  run at this stopping point.

### 1.2 Implemented in source but not deployed

- The narrowed Convex schema.
- The new history synchronization signals.
- Removed Convex migration/data-transfer endpoints.
- Bounded bootstrap/history/cascade/reorder reads.
- Measurement-only processed-operation retention reporting.

The current development deployment still contains documents shaped for the
older schema. Pushing the current schema without preparing those documents is
expected to fail validation. This is the principal handoff blocker, not a
missing source implementation.

### 1.3 Deliberately not done

- No development snapshot import.
- No `npx convex dev --once` with the narrowed schema.
- No production Convex deployment or data mutation.
- No GitHub Pages deployment.
- No branch push or pull request.
- No authenticated Clerk/Convex browser smoke.
- No manual two-device convergence test.
- No in-app-browser visual/performance diagnostics.
- No phone preview left running on port 4180.
- No forced dependency audit remediation.
- No auth-vendor deep-import or vendor swap.

## 2. Repository and data safety state

### 2.1 Production

A read-only production census was repeated at the stopping point:

```text
npx convex data --prod
There are no tables in the production deployment's database.
```

The deployment identifier is intentionally omitted from version-controlled
documentation. Production was not exported, imported, reset, deployed, or
otherwise mutated.

### 2.2 Development snapshot

Before schema narrowing, a full development snapshot was exported outside the
repository:

```text
/Users/jesvinxavi/Desktop/habits-tracker-pwa-backups/
  dev-before-whole-app-optimisation-2026-07-30.zip
```

Snapshot evidence:

| Property | Value |
| --- | --- |
| File size | approximately 78 KB |
| SHA-256 | `fc5f039bdd2ffc88089e334d6115f133a9536aa84c0df26d7ef7397137617a98` |
| Archive entries | 36 files |
| Archived payload bytes | 481,992 |
| `legacyData/documents.jsonl` | 0 bytes |
| `migrationBatches/documents.jsonl` | 0 bytes |
| Largest table payload | `processedOperations/documents.jsonl`, 412,788 bytes |

The snapshot also contains the live normalized definition/history tables,
user profile/preferences, collection revisions, and system table metadata.

### 2.3 Why the snapshot has not yet been imported

The source schema removes:

- `legacyData`;
- `migrationBatches`;
- profile migration state fields;
- `programPreload`;
- `scheduleMode`;
- `anytimeRoutines`.

The old development deployment can still contain documents with those optional
fields. The safe continuation is to create a transformed copy of the snapshot,
preserving `_id` and `_creationTime`, import that copy into development under
the old permissive schema, and only then push the narrowed schema.

Resetting development was rejected because real normalized development data is
present and a data-preserving route is available.

## 3. Commit and rollback map

| Commit | Milestone | Change size | Rollback use |
| --- | --- | --- | --- |
| `4a16b71e` | Independent audit and revised plan | 2 files, +1,381 | Documentation baseline |
| `659909da` | Explicit browser test harness | 11 files, +195/-53 | Return to pre-harness runtime |
| `7adc4676` | Home/Stats/holiday render work | 11 files, +632/-349 | Isolate UI derivation regressions |
| `0549e3a0` | Atomic offline replay and writes | 7 files, +1,079/-142 | Isolate IndexedDB/lock regressions |
| `2c82c5f7` | Cloud-only runtime, Convex cleanup, PWA/offline delivery | 91 files, +2,130/-3,409 | Main integrated implementation boundary |

At the time this handoff was written, CI/workflow/doc truth-pass changes were
still in the working tree awaiting the documentation commit that contains this
file. Check `git log` and `git status` before continuing; do not assume the
handoff commit hash in advance.

## 4. Workstream record

The primary orchestrator assigned narrow, non-overlapping workstreams, then
reviewed and integrated the shared-tree changes.

| Workstream | Implemented result | Primary quality evidence |
| --- | --- | --- |
| Harness | Explicit `VITE_TEST_HARNESS`; no implicit legacy backend; production guard | focused unit and app-shell Playwright |
| Render/derivation | Home invalidation, Stats memoization, holiday Set index | focused unit and Home/Stats Playwright |
| Offline/sync | IndexedDB v2 indexes, atomic action batches, queued locks, replay cleanup | 40-test focused worker suite; later full suite |
| Client cloud/legacy | Paginated hydration, serialized remote queue, legacy deletion | 16 focused remote/hydration tests |
| Convex cleanup | Narrow schema/source APIs, defaults, bounds, retention measurement | Convex compile and domain tests |
| Convex regression tests | Removed stale endpoint cases; canonical-create and tombstone coverage | 12 final domain tests |
| Dead code | Removed Knip suppressions and 22 surfaced implementations plus local cascades | Knip zero-issue gate |
| CI/docs | Executable budgets/PWA/performance gates and one-backend documentation | YAML/JSON parse and local gates |
| Orchestrator review | Protected metadata sanitization, lifecycle close order, PWA lifecycle, integration fixes | final combined gates |

Two earlier workers hit a credit limit after writing their changes. Their
filesystem changes remained intact. They were not accepted on trust: later
focused workers and the orchestrator re-read the diffs, expanded tests, ran the
Convex reviewer checklist, and executed the combined verification set.

## 5. Detailed implementation record

### 5.1 Explicit harness and fail-closed persistence

Implemented:

- `src/core/testHarness.js` is the only browser UI harness.
- `playwright.config.js` starts the dev server with
  `VITE_TEST_HARNESS=1`.
- The harness seeds reducer state through `window.__APP_TEST__`.
- Normal code no longer chooses a backend through `VITE_DATA_BACKEND`.
- Domain writes without a ready cloud runtime fail instead of mutating only
  in memory.
- Device/UI-only state actions remain usable without cloud persistence.
- Normal production builds reject the harness flag.

PWA tests require a production-shaped service worker build. The accepted
exception is deliberately triple-gated:

```text
PWA_TEST_BUILD=1
VITE_PWA_TEST=1
VITE_TEST_HARNESS=1
```

The resulting artifact is a test fixture, never a deployable artifact. This
decision preserves realistic Workbox behavior without weakening the normal
build guard.

### 5.2 Home, Statistics, and holidays

Implemented:

- Home no longer installs duplicate responsive listeners or performs repeated
  inline height calculations.
- CSS owns the scroll container.
- Home child components receive narrower invalidation signals.
- Sync-status-only actions do not rebuild habit cards.
- Statistics subscribes to a narrow selector.
- Its derived view model and daily series are shared/memoized.
- Statistics no longer shows a synchronous loading shimmer.
- Creation-date semantics prefer explicit `createdAt`.
- A midnight invalidation refreshes date-sensitive derivation.
- Holiday membership uses one identity-aware cached `Set`.
- Holiday date iteration is DST-safe.
- Unused Home/Habits calculation and rendering cascades surfaced by Knip were
  removed.

Deferred:

- A manual visual comparison in the in-app browser.
- Final recorded timing comparisons on a real phone.

### 5.3 IndexedDB atomicity and cross-tab replay

Implemented:

- IndexedDB schema version advanced from 1 to 2.
- Existing `entities` and `outbox` stores receive additive `by_owner` indexes.
- Cache, outbox, lease, and migration-backup data are not deleted during the
  upgrade.
- All durable operations produced by one reducer action are written in one
  IndexedDB transaction.
- Any entry failure aborts the whole action batch.
- Outbox reads use owner/status/creation indexes.
- Account purge uses owner-index cursors rather than full-store materialization.
- Confirmed deltas skip byte-equivalent records.
- Authoritative window replacement removes missing confirmed rows while
  preserving optimistic rows.
- Confirmation preserves a newer optimistic successor.
- Safe superseded chains are deleted.
- Replay drains work that arrives while a replay is active.
- Abandoned `syncing` operations are recovered.
- Web Locks queue rather than returning immediately with `ifAvailable`.
- An `AbortController` cancels a queued lock when the engine closes.
- Retry timers are tracked and cleared on close.
- BroadcastChannel peers wake replay without rebroadcast loops.
- Lack of Web Locks falls back to server idempotency rather than pretending
  cross-tab exclusion exists.

The move of `periodKeys.js` to `src/shared/periodKeys.js` was kept separate from
legacy migration deletion because it remains live domain logic.

### 5.4 Realtime completeness and remote application

Implemented:

- Core definition tables load with explicit account limits.
- History tables load through pagination rather than a 500-row assumption.
- `historySyncSignals` gives each history entity type a lightweight reactive
  revision.
- `listChangedEntities` uses an inclusive `updatedAt >= watermark` boundary.
- Client revision checks make repeated equal-watermark documents cheap.
- Equal-timestamp writes cannot be skipped.
- Initial history windows use authoritative replacement semantics.
- Later updates use confirmed deltas.
- Tombstones remove confirmed compatibility-state rows.
- Pending optimistic rows overlay confirmed tombstones.
- Subscription callbacks pass through one serialized/coalescing queue.
- Same-tick bursts coalesce before IndexedDB I/O.
- A generation change invalidates stale in-flight delivery.
- One remote signal produces one processing/delivery pass in the focused test.

Decision:

The plan's lightweight signal plus paginated delta protocol was selected over
subscribing to unbounded history arrays. It gives complete history without
making every old record reactive.

Residual:

The signal row is one OCC point per account/generation/history type. This was
accepted for the current write volume but should be measured under genuinely
concurrent devices before any high-frequency expansion.

### 5.5 Client legacy retirement

Deleted:

- `src/core/dataBackend.js`;
- `src/core/storage.js`;
- `src/core/dataManagement.js`;
- the client migration coordinator/readers/normalizers/merge/checksum graph;
- legacy fixtures and migration-only test files.

Removed:

- `VITE_DATA_BACKEND` from runtime configuration;
- legacy storage branches and side-key behavior;
- migration state from reducer hydration;
- retired UI/config concepts;
- dead export/import tests.

Kept:

- the normalized reducer compatibility state;
- authenticated IndexedDB cache/outbox;
- generation identity and previous-generation recovery;
- explicit external development snapshots.

User export/import was not reimplemented. The revised plan records it as a
separate product/privacy requirement rather than a reason to preserve
unreachable legacy code.

### 5.6 Convex schema, functions, and security review

Source changes:

- removed `convex/migration.ts`;
- removed `convex/dataTransfer.ts`;
- removed migration checksum helpers;
- removed legacy/migration tables and migration profile fields from the source
  schema;
- removed `programPreload`, `scheduleMode`, and `anytimeRoutines`;
- consolidated default categories in `convex/lib/defaults.ts`;
- removed dead public endpoints;
- retained live category/program cascades while removing stale cascades;
- bounded core, reorder, category cascade, and rest-day reads;
- made canonical create comparison key-order-insensitive;
- retained `deletedAt` in portable equality so tombstoned IDs conflict;
- added explicit registered-function return validators;
- added measurement-only processed-operation retention reporting;
- did not schedule deletion.

Additional security issue found during orchestrator review:

Generic CRUD payloads were previously spread into updates after lookup.
Although revision/device timestamps were overwritten, a payload could carry
protected fields such as `ownerKey`, `generation`, or `deletedAt`. The shared
domain layer now strips:

```text
_id
_creationTime
ownerKey
generation
revision
updatedAt
updatedByDeviceId
deletedAt
```

A Convex regression test verifies that an update cannot move a document to
another owner/generation, forge its revision/device, or tombstone it.

Validator note:

Some generic operation, conflict, pagination, and multi-entity document
contracts still contain nested `v.any()` values. Registered functions do have
return validators, but fully table-specific unions remain a possible hardening
follow-up. Do not confuse this with the fixed protected-field persistence
boundary.

### 5.7 Runtime lifecycle

Sign-out and runtime replacement now dispose work in this order:

1. close the remote queue;
2. unsubscribe reactive queries;
3. close the sync engine, retry timers, BroadcastChannel, and queued locks;
4. revoke the offline lease;
5. clear Convex authentication;
6. sign out of Clerk;
7. purge the account cache.

This prevents a callback, retry, or queued lock from writing after account
teardown begins.

### 5.8 PWA update safety

Implemented:

- VitePWA uses `registerType: "prompt"`.
- A waiting worker creates an accessible update banner.
- Activation is blocked while:
  - a critical editor/dialog is open;
  - the browser is offline;
  - outbox work is `pending`, `retry`, or `syncing`;
  - a conflict remains unresolved.
- The user can choose Later or Update now.
- Accepted activation is broadcast to peer tabs.
- `controllerchange` reloads every participating old tab.
- Vitest covers explicit acceptance, an open editor, pending durable work, and
  offline state. Retry/syncing share the pending branch; conflict has distinct
  messaging but still needs a direct test.
- Playwright modifies the built worker, proves it remains waiting, accepts it,
  and proves two controlled tabs both reload.

Decision:

This safety flow was landed before restoring Home's intent-based modal imports.
That ordering prevents a long-lived old tab from requesting a hashed chunk that
the new build removed.

### 5.9 Offline dependencies and prefetch

Implemented:

- removed Google Fonts preconnect and Material Icons stylesheet requests;
- installed `@material-design-icons/font@0.14.15`;
- bundled the Material Icons WOFF2 locally;
- installed `sortablejs@1.15.7`;
- kept SortableJS behind the reorder interaction's dynamic import;
- re-lazied Home habit and holiday management code;
- retained pointer-down/pointer-enter intent prefetch;
- removed the ineffective hidden-page listener;
- suppressed speculative idle prefetch on Save-Data and 2G connections;
- lets a ready service worker own Pages warm-up instead of duplicating fetches.

Measured trade-off:

- local Material Icons font: 128.35 KB raw;
- lazy SortableJS chunk: 36.55 KB raw, 12.64 KB gzip;
- Pages precache remains within budget.

The full Material Icons font was chosen for correctness because several icons
are selected dynamically. A reviewed glyph subset or SVG migration could reduce
the 128.35 KB cost later, but must first inventory dynamic ligatures and verify
every current icon.

### 5.10 Dead code, CI, and documentation

Implemented or prepared in the final documentation commit:

- removed Knip's directory-wide export suppressions;
- removed all 22 initially surfaced dead exports/implementations;
- removed additional dead local call cascades;
- removed the final two unused color-class maps;
- added a cycle gate;
- removed the disabled decorative performance workflow;
- made PR CI run:
  - lint;
  - unit tests;
  - Convex type-check;
  - dead-code check;
  - cycle check;
  - Pages bundle/precache budgets;
  - full browser suite;
  - PWA suite;
  - bounded one-worker Fitness performance invariant;
- retained lint/unit/type-check work in the deploy workflow because it has no
  explicit successful-CI dependency; removing those gates would let a direct
  main push deploy without equivalent verification;
- updated development, build/deploy, and release documentation for one
  Clerk+Convex backend.

Remaining documentation/tooling truth work:

- `npm run audit` still means dependency audit + lint + local build; it is not
  the aggregate CI command described by Phase 6.
- repository placeholder metadata should be checked separately.
- historical documents intentionally still contain legacy terminology.

## 6. Decisions and rationale

| Decision | Why |
| --- | --- |
| Back up development before deletion | Source cleanup changes schema compatibility; real normalized dev data exists |
| Leave production untouched | Production census is empty and no deployment was requested |
| Preserve generations | Reset/recovery and offline correctness depend on stable generation boundaries |
| Add IDB indexes in place | Avoid losing confirmed cache, pending outbox, lease, or backups |
| Use one transaction per reducer action | Prevent partial durability for multi-entity actions |
| Queue Web Locks | `ifAvailable` allowed a tab to report completion without replaying |
| Use inclusive watermarks | Millisecond timestamps are not unique; exclusive bounds can miss equal-time writes |
| Separate authoritative windows from deltas | Upsert-only hydration cannot express remote deletion |
| Serialize and coalesce callbacks | Async subscription completion order is otherwise nondeterministic |
| Keep retention measurement-only | No observed production offline/idempotency window justifies deletion |
| Remove migration/export shell | It was unreachable legacy weight; portability remains a product requirement |
| Prompt for PWA updates | Auto-activation can strand editors or pending offline work |
| Reload all tabs | Guarantees old clients do not request removed chunks |
| Bundle icons and Sortable locally | Installed/offline PWA behavior must not depend on Google/jsDelivr |
| Keep auth vendor unchanged | The 588 KB gzip chunk is large, but unsupported deep imports risk auth/offline correctness |
| Strip protected CRUD metadata | Authentication is insufficient if payloads can move/tombstone owned documents |
| Stop before dev schema push | The safe data transformation/import step had not yet been performed |

## 7. Verification ledger

### 7.1 Final non-browser gates

```text
npm run test:unit
31 files passed
209 tests passed
```

```text
npm run lint
passed
```

```text
npm run test:convex
passed
```

```text
npm run check:dead-code
passed with zero issues
```

```text
npm run check:cycles
passed with zero cycles
```

```text
git diff --check
passed
```

### 7.2 Bundle and precache gates

Local:

| Metric | Result | Budget |
| --- | ---: | ---: |
| HTML gzip | 13,455 bytes | 18,000 |
| Fitness entry gzip | 19,618 bytes | 25,000 |
| Fitness modals gzip | 24,687 bytes | 30,000 |
| Largest JavaScript gzip | 582,364 bytes | 650,000 |

Pages:

| Metric | Result | Budget |
| --- | ---: | ---: |
| HTML gzip | 13,485 bytes | 18,000 |
| Fitness entry gzip | 19,614 bytes | 25,000 |
| Fitness modals gzip | 24,645 bytes | 30,000 |
| Largest JavaScript gzip | 582,365 bytes | 650,000 |
| Workbox precache raw | 2,372,431 bytes | 2,500,000 |
| Workbox entries | 40 | informational |

Selected generated chunks:

| Chunk | Gzip |
| --- | ---: |
| Auth vendor | 588.00 KB |
| Components | 21.97 KB |
| Fitness core | 19.75 KB |
| Habits core | 14.69 KB |
| SortableJS | 12.64 KB |
| Home | 9.54 KB |
| Cloud bootstrap | 6.81 KB |
| Statistics | 6.09 KB |

### 7.3 PWA browser gate

```text
npm run test:pwa
3 passed
```

Covered:

- offline lazy Fitness dialogs;
- offline local Material Icons;
- offline lazy SortableJS/reorder mode;
- no third-party request during the offline-dependency case;
- real waiting-worker detection;
- no activation before confirmation;
- two old controlled tabs reload after acceptance.

### 7.4 Main browser suite

The full run executed 143 tests:

```text
141 passed
1 skipped (the opt-in large-account performance case)
1 failed
```

The single failure was a test-selector ambiguity: the loading-screen and Home
headings share the text `Healthy Habits Tracker`. The selector was scoped to
`#home-view` and made exact. The failed case was then rerun:

```text
1 passed
```

The entire 143-test suite was not rerun a second time after that selector-only
patch. The other 141 cases passed in the full run.

### 7.5 Focused evidence retained from implementation

- Render/holiday focused units: 7 passed.
- Home/Stats focused Playwright set: 9 passed.
- Offline/sync focused worker set: 40 passed before later test consolidation.
- Cloud remote/hydration focused set: 16 passed.
- Final Convex domain file: 12 passed.
- PWA coordinator unit file: 4 passed.
- Cloud runtime lifecycle file: 2 passed.

## 8. Known complications and unresolved risks

### 8.1 Development schema compatibility

Severity: blocking for deployment.

The current source schema is narrower than the deployed development documents.
Do not run an unattended schema push first. Follow section 13.

### 8.2 No authenticated integration smoke

Severity: blocking for release, not for source commit.

Mocks and Convex-test cover the boundaries, but the new client/server protocol
has not been exercised with a real Clerk session after deploying the new
functions.

### 8.3 No manual multi-device convergence

Severity: important.

Automated tests cover ordering, paging, generation invalidation, tombstones, and
optimistic overlays. They do not replace a real two-device recent/old-history
convergence run.

### 8.4 Dependency audit

`npm install` reported:

```text
27 vulnerabilities
12 moderate
15 high
```

No `npm audit fix --force` was run because it can make breaking dependency
changes and the user requested a stopping point. The next agent must inspect the
dependency paths and distinguish runtime exposure from dev-tool transitive
packages before changing versions.

### 8.5 Auth bundle

The auth chunk remains approximately 588 KB gzip and dominates JavaScript
delivery. It is under the current 650 KB gate. Do not use unsupported Clerk or
Convex deep imports merely to reduce this number.

### 8.6 Precache headroom

The Pages precache is 2,372,431 of 2,500,000 bytes, leaving limited headroom.
The local icon font is the main newly added offline asset.

### 8.7 Return-validator precision

Nested `v.any()` remains in generic multi-entity envelopes and results. This is
a hardening opportunity, not an absent registered-function return validator.

### 8.8 Manual UI and phone evidence

The user originally requested in-app-browser diagnostics and a port-4180 phone
server. The stop instruction arrived before those steps. Do not claim them
complete.

## 9. Current workflow/documentation changes

The documentation/CI truth pass changes:

- `.github/workflows/ci.yml`;
- `.github/workflows/deploy.yml`;
- deletion of `.github/workflows/performance.yml`;
- `knip.json`;
- `docs/development/PROJECT_RULES.md`;
- `docs/operations/BUILD_AND_DEPLOY.md`;
- `docs/release/RELEASE_CHECKLIST.md`;
- this handoff;
- the documentation index.

Before taking over, run:

```bash
git status --short
git log --oneline -8
```

If these files are still modified, the final documentation commit was not made.
If the tree is clean, read the newest commit rather than recreating them.

## 10. Revised-plan phase matrix

The status terms are gate-based:

- **Complete** means source work and the stated gate are complete.
- **Partial** means material source work is complete but at least one gate is
  outstanding.
- **Not started** means no material implementation exists.

| Phase | Status | Evidence | Outstanding gate |
| --- | --- | --- | --- |
| 0 — Baseline/census/backup | Complete | production read-only census; external dev snapshot and SHA-256 | none before dev continuation |
| 1 — Harness/persistence seam | Partial | explicit harness, fail-closed runtime, build guard, automated suites | final real production-missing-runtime smoke if desired |
| 2 — Offline correctness | Partial | atomic IDB, queued locks, close/retry tests | manual two-tab offline/reconnect |
| 3 — Realtime completeness | Partial | >500 paging, equal watermark, tombstone, burst, generation, overlay tests | deployed two-device convergence |
| 4 — Client legacy removal | Partial | legacy graph deleted; automated gates pass | authenticated warm-cache/offline/sign-out/reset smoke; recorded before/after startup data |
| 5 — Server/schema cleanup | Partial | source and Convex tests complete | transformed dev import, schema push, row reconciliation, fresh provision/recovery smoke |
| 6 — Tests/docs/dead-code | Partial | old suites removed; Knip/cycles/CI/docs updated | aggregate `audit` script and final metadata/history grep review |
| 7 — Home/Stats/holidays | Partial | unit and browser regressions pass | manual in-app-browser visual/timing evidence |
| 8 — PWA/offline delivery | Partial | 3 PWA tests, local dependencies, prompt update, relazy/prefetch | Save-Data browser case and installed-device/manual confirmation |
| 9 — Budgets/vendor | Partial | executable budgets and CI changes; vendor size measured | deliberate budget-failure proof and full auth/offline vendor investigation |

No phase after Phase 0 should be treated as release-complete solely because its
source code exists.

## 11. Do-not-repeat and do-not-do list

Do not:

- rewrite the audit;
- recreate the explicit harness;
- restore `VITE_DATA_BACKEND`;
- restore the client migration graph;
- wipe development to make schema deployment easy;
- use `--prod` for the transformed snapshot rehearsal;
- use `--replace-all` without a separately approved destructive recovery plan;
- push the narrowed schema before preparing old documents;
- bypass PWA update blockers;
- return to `autoUpdate`;
- reintroduce Google Fonts or jsDelivr;
- suppress whole source directories in Knip;
- enable processed-operation deletion without measured retention evidence;
- optimize Clerk/Convex through unsupported internals;
- claim manual browser/phone/two-device success from automated tests.

## 12. Safe rollback points

If a continuation fails before deployment:

- return to `2c82c5f7` for the integrated source boundary;
- use `0549e3a0` to isolate offline replay changes;
- use `7adc4676` to isolate Home/Stats/holiday changes;
- use `659909da` to isolate harness changes.

If development data import or schema deployment fails:

1. stop the dev process;
2. keep the failed transformed archive for diagnosis;
3. verify the original snapshot SHA-256;
4. restore only to the development deployment;
5. do not touch production;
6. reconcile table/document counts before retrying.

## 13. Exact pickup sequence

### Step 1 — Confirm repository state

```bash
cd /Users/jesvinxavi/Desktop/habits-tracker-pwa
git branch --show-current
git status --short
git log --oneline -8
```

Expected branch: `codex/whole-app-optimisation`.

Read this handoff, the revised plan, and the latest commit. Do not begin by
running a Convex push.

### Step 2 — Reconfirm the original snapshot

```bash
shasum -a 256 \
  /Users/jesvinxavi/Desktop/habits-tracker-pwa-backups/dev-before-whole-app-optimisation-2026-07-30.zip
unzip -l \
  /Users/jesvinxavi/Desktop/habits-tracker-pwa-backups/dev-before-whole-app-optimisation-2026-07-30.zip
```

Expected SHA-256:

```text
fc5f039bdd2ffc88089e334d6115f133a9536aa84c0df26d7ef7397137617a98
```

### Step 3 — Build a transformed copy, never edit the original

Use a new temporary directory and archive. Preserve all normalized documents,
`_id`, and `_creationTime`.

Remove only:

- empty `legacyData` snapshot table;
- empty `migrationBatches` snapshot table;
- profile keys `migrationStatus`, `activeMigrationBatchId`,
  `migrationCompletedAt`;
- preference key `programPreload`;
- program keys `scheduleMode`, `anytimeRoutines`.

Validate every JSONL line before creating the new ZIP. Record the transformed
archive's path and SHA-256.

### Step 4 — Import into development under the old permissive schema

Resolve and print the target deployment first. Never add `--prod`.

Use the least destructive import mode that replaces only the tables present in
the transformed snapshot:

```bash
npx convex import --deployment dev --replace \
  /absolute/path/to/transformed-dev-snapshot.zip
```

Review the interactive deletion summary. The omitted legacy tables were already
empty. Do not use `--replace-all`.

### Step 5 — Push the narrowed development schema/functions

```bash
npx convex dev --once
```

If validation fails, stop and inspect the named table/field. Do not reset the
deployment.

### Step 6 — Reconcile development

Verify:

- the account profile still exists;
- active/previous generation are unchanged;
- normalized table counts match the transformed snapshot;
- legacy/migration tables are absent;
- retired fields are absent;
- processed operations remain;
- fresh provision works;
- account reset creates a new generation;
- history signals advance on history writes.

### Step 7 — Run authenticated cloud smokes

Cover:

- sign-in;
- trusted confirmed-cache startup;
- online hydration;
- offline edit and reload;
- reconnect/replay;
- conflict display;
- sign-out with pending-work choices;
- generation reset;
- Profile/account controls.

Then perform two-device recent and old-history convergence.

### Step 8 — Run the final automated gates

```bash
npm ci
npm run lint
npm run test:unit
npm run test:convex
npm run check:dead-code
npm run check:cycles
npm run check:bundle:pages
npm run test:e2e
npm run test:pwa
npm run test:fitness:perf
```

Run `npm audit` separately and review paths rather than applying a forced fix.

### Step 9 — Perform the deferred browser/phone pass

Start the requested phone build:

```bash
npm run preview:phone
```

It serves the local build on port 4180 and should remain running for the user.

Use the in-app browser and a mobile viewport to inspect:

- Home;
- Habits and offline reorder;
- Fitness dialogs;
- Statistics;
- Profile;
- light/dark themes;
- update banner/blockers;
- console errors;
- failed/third-party requests;
- layout shifts;
- navigation timings;
- warm/cold/offline paths.

If phone authentication fails, check Clerk's authorized origins for the LAN
origin. Do not replace the normal build with the test harness and call that a
successful phone cloud smoke.

### Step 10 — Only then consider production

Production currently has no tables, but deployment still requires:

- correct production Clerk issuer/integration;
- protected deploy key;
- production Pages base/origin;
- final release checklist;
- explicit owner approval.

No production deployment is implied by this handoff.

## 14. Final stopping statement

The source implementation is committed through `2c82c5f7`. Automated evidence
is strong, including real service-worker update and offline dependency tests.
The safe stopping point is immediately before development data transformation
and schema deployment.

The next agent's first implementation action should be the transformed
development snapshot workflow—not more client refactoring.
