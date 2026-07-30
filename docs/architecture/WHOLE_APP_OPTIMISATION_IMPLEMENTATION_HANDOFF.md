# Whole-App Optimisation Implementation Status and Handoff

Date: 2026-07-30

Branch: `codex/whole-app-optimisation`

Implementation base: `feeb0f48`

Implementation commit at first stopping point: `2c82c5f7`

Status: **complete and merged to `develop`** at `91410b8b`.

Read in reverse. **Section 16** is the close-out: the device testing pass and
the list of what remains open. **Section 15** records the development schema
deployment, the authenticated cloud smoke and the phase gates. Sections 1–14 are
preserved as written at the first stopping point and are superseded wherever the
later sections disagree.

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

As written at the first stopping point, this was not a claim that the revised
plan was complete: the development Convex deployment had not received the
narrowed schema, no authenticated cloud smoke had been run, and the requested
phone/in-app-browser pass had not begun. Section 15 records the continuation
that closed those items. Read section 15 before acting on sections 1–14.

Do not restart the audit or re-implement the committed phases.

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

## 15. Continuation record

Date: 2026-07-30. Branch unchanged. Head at the end of this continuation:
`7c1f86b7`.

This section supersedes sections 1.2, 1.3, and 10 where they disagree. It
records what happened after the stopping point described in section 14: the
development deployment, the outstanding phase gates, and a browser diagnostics
pass on the running app.

### 15.1 Commits

| Commit | Milestone |
| --- | --- |
| `39fcbe3d` | Aggregate `audit` script, repository metadata, rewritten runbook |
| `e3a498d6` | Save-Data prefetch and conflict-blocker coverage |
| `140966b5` | Bundle budget gate made testable and provably failing |
| `4ed7661b` | `restDays` moved out of the Fitness feature |
| `7c1f86b7` | Dark-mode calendar tile legibility fix and contrast spec |

Total since `2de2ef61`: 26 files, +641/−128.

### 15.2 Development deployment

The narrowed schema is deployed to development. The blocker described in
section 1.2 is closed.

The route in section 13 did not work as written, and the reason is worth
keeping. A Convex object validator rejects a missing required field *and* an
undeclared extra one, so:

- importing documents with the retired fields stripped failed against the
  deployed schema, which still required `migrationStatus`;
- pushing the narrowed schema first would have failed against documents that
  still carried it.

Neither order is possible in two steps. The working sequence adds an
intermediate push in which each retired field is `v.optional(v.any())`, and it
is now recorded in
[the setup and recovery runbook](../operations/CONVEX_SETUP_AND_RECOVERY_RUNBOOK.md).

A second failure is worth recording because it is silent. The first transform
round-tripped documents through `JSON.parse`/`JSON.stringify`, which rewrote
Convex's `1.0` as `1` and so turned every integral float64 into an int64. The
import was rejected on `collectionRevisions.generation`. The transformer was
rewritten to copy retained values as raw text and to assert that a document
reassembled without deletions is byte-identical to its input.

Evidence:

| Property | Value |
| --- | --- |
| Target | development `hallowed-mandrill-729`; production untouched |
| Source snapshot SHA-256 | `fc5f039b…7a98`, re-verified before use |
| Pre-import state | export byte-identical to the snapshot, table by table |
| Transformed archive SHA-256 | `20ab1857335727c7da4f04f68196bc5c0a01659a98435e4097076896cb70c718` |
| Field values stripped | 7: one `userProfiles.migrationStatus`, six across `programs` |
| Tables dropped | `legacyData`, `migrationBatches`, both empty and asserted empty |
| Documents imported | 608, every one retaining `_id` and `_creationTime` |
| Post-import reconciliation | every normalized table byte-identical to the intended target |
| Retired fields remaining | none outside `processedOperations.result`, which is `v.any()` |
| Generations | `activeGeneration` still 1; no `previousGeneration` introduced |
| New table | `historySyncSignals` created empty |

Both failed imports left the deployment byte-identical to the backup. Convex
stages and swaps, so a validation error part-way through rolls the whole import
back. That was verified by re-exporting after each failure rather than assumed.

Residual: `legacyData` and `migrationBatches` still exist as empty untyped
tables with their indexes dropped. The CLI has no drop-table command and
`--replace-all` was out of scope, so they are a dashboard cleanup.

### 15.3 Authenticated cloud smoke

Run against the deployed narrowed schema with a real Clerk session on the local
build, not the harness.

Passing:

- sign-in and session restore;
- trusted confirmed-cache startup — Home interactive at 449 ms, before Convex
  authentication completed at 1,793 ms;
- online hydration to `cacheHydrated` at 2,035 ms;
- Profile reporting Synced, zero pending operations, and a valid offline lease;
- a real domain write (rest-day toggle) reaching Convex, and the write toggled
  back so the account ends where it started;
- `historySyncSignals` creating its `restDays` row on the first write and
  advancing to revision 2 on the second. This is the first live exercise of the
  Phase 3 signal protocol.

Recorded startup timings, local build, warm cache:

```text
bootstrapStart 22   authStart 39            clerkReady 422
earlyCacheHydrated 429   persistenceReady 429   homeReady 448   visible 449
convexAuthenticated 1793   accountReady 1923   coreReady 2026   cacheHydrated 2035
```

Third-party requests during startup: four, all to the Clerk instance. No Google
Fonts and no jsDelivr, which is the Phase 8 offline-dependency claim confirmed
against a running build rather than against the source.

Still outstanding, because they need a second device or a device this machine
cannot stand in for:

- two-device convergence across recent and old history;
- offline edit, terminate, reopen, reconnect on a real installed client;
- conflict resolution UI against a genuine concurrent write;
- sign-out with pending work, and generation reset. Both were deliberately not
  run: they would have ended the session that the phone preview is serving.

### 15.4 Phase gates closed

**Phase 6.** `npm run audit` now runs the same gates as pull-request CI in the
same order, so a local pass means what a green check means. The dependency scan
moved to `audit:deps`: gating on advisory counts makes an unrelated change fail
for a reason its author cannot fix. Repository metadata no longer points at a
`your-org` placeholder. The README documented `VITE_DATA_BACKEND` and a
`test:migration` script that no longer exist. The migration runbook was the last
document presenting the deleted pipeline as live procedure; it is renamed and
rewritten around the one backend. Remaining `VITE_DATA_BACKEND` mentions are
deliberate prohibitions or historical Fitness records.

**Phase 8.** Connection-aware prefetch and the conflict branch of the update
coordinator both shipped without tests. A speculative warm-up that quietly
returns on a metered connection is indistinguishable from one that never ran, so
the browser spec asserts the pair together: nothing speculative on Save-Data or
2G, and intent prefetch still firing there. The coordinator tests add retry and
syncing — previously assumed to share the pending branch rather than shown to —
conflict's distinct messaging, and the recovery path, since nothing re-shows a
blocked banner and its own poll is the only route back to an enabled button.

**Phase 9.** The budget script was a top-level side effect with no test, so the
one thing budgets exist to do had never been observed. The decision is now
separable from the measurement and unit tested, and each budget carries a line
saying what it protects. This closed a hole the gate had all along: every
measurement was coalesced with `|| 0`, so a renamed or missing chunk measured as
zero bytes and passed — silence in exactly the case a size gate exists to catch.
Verified against a real Pages build, which passes, and fails on a tightened
budget, an injected oversized chunk, and a renamed Fitness entry chunk.

Dependency audit, reviewed rather than force-fixed. All 27 advisories descend
from two roots. `brace-expansion` reaches eslint and, through `workbox-build`,
`vite-plugin-pwa`: build and lint tooling that ships nothing. `uuid` reaches
`@clerk/clerk-js` through `jayson` and `@solana/web3.js`, the only path touching
a runtime dependency — but the shipped auth chunk contains Clerk's own wallet
code against the injected provider and the Wallet Standard API, with no
`@solana/web3.js`, `bs58`, `ed25519`, or `Keypair` present. Nothing vulnerable
reaches the artifact. No forced upgrade was applied.

### 15.5 Findings from browser diagnostics

**Dark mode calendar tiles, fixed in `7c1f86b7`.** The tile background was a
hard-coded `#f3f4f6` with no dark override while the date number inside it
followed the theme, so dark mode rendered white on light grey at 1.10:1. The
today outline repeated the same literal. Measuring also exposed a failure
present in both themes: the weekday label used `--text-color-secondary`, which
reaches 2.96:1 on the light tile. Date numbers now measure 17.01:1 in dark;
labels 5.19:1 light and 6.68:1 dark.

This is the case for measuring rather than reading. Every rule involved looks
correct in isolation; the defect only exists once the variable beside it flips.

**Stale service worker on the preview origin.** The first load of the local
preview was served by a `sw.js` left over from an earlier Pages build on the
same origin, which returned precached HTML from before the Home header work. It
looked exactly like a layout regression. `npm run preview:phone` already warns
about this; anyone testing on a device that has previously loaded a Pages build
must clear that site's data first.

**Home downloads `fitness-core` at startup — open.** Home statically imports
three symbols from the 70.89 kB / 19.76 kB gzip Fitness chunk. The cause is not
a feature import: `shared/color.js` and `shared/equality.js` are unassigned by
`manualChunks`, and rolldown inlines a small shared module into a consuming
chunk regardless of the group it is assigned. Two fixes were tried and reverted.
Broadening the `manualChunks` shared rule produced a `utils` chunk but left the
dependency, making it a net loss of one request. Expressing the same groups
through rolldown's `advancedChunks` pulled `habits-core` and `habits-modals`
onto Home as well. Left for the separate vendor-and-chunking work Phase 9
reserves, with the measurement recorded so it is not rediscovered.

`restDays` was moved to `src/shared/` while tracing this. Bundle output is
byte-identical, so it is a structural fix — `isRestDay` reads a root reducer
slice and is consumed by Home and Statistics — and not a size one.

**Not fixed, reported.** The progress ring draws a red dot at 0% because its
foreground stroke keeps `stroke-linecap: round` at zero progress. The Habits
page search field reads "Search activities…". The selected day tile and today
outline print text in the brand accent, and white on `#007bff` is 4.02:1 in both
themes, below AA for normal text — a palette decision rather than a defect.
`applyTheme()` is called only from theme initialisation and the toggle, so a
dark-mode preference arriving from another device would not repaint until
reload.

### 15.6 Gate results at this head

```text
npm run lint            passed
npm run test:unit       32 files, 224 tests passed
npm run test:convex     passed
npm run check:dead-code passed, zero issues
npm run check:cycles    passed, zero cycles
npm run test:e2e        149 passed, 1 skipped (opt-in large-account case)
npm run test:pwa        3 passed
npm run test:fitness:perf  1 passed
```

Pages budgets:

| Metric | Result | Budget |
| --- | ---: | ---: |
| HTML gzip | 13,473 | 18,000 |
| Fitness entry gzip | 19,614 | 25,000 |
| Fitness modals gzip | 24,645 | 30,000 |
| Largest JavaScript gzip | 582,365 | 650,000 |
| Workbox precache raw | 2,372,436 | 2,500,000 |

### 15.7 Revised phase matrix

| Phase | Status | Outstanding |
| --- | --- | --- |
| 0 — Baseline/census/backup | Complete | none |
| 1 — Harness/persistence seam | Complete | none |
| 2 — Offline correctness | Partial | manual two-tab offline/reconnect on a device |
| 3 — Realtime completeness | Partial | two-device convergence; signal protocol now exercised live |
| 4 — Client legacy removal | Complete | none |
| 5 — Server/schema cleanup | Complete | empty legacy tables are a dashboard cleanup |
| 6 — Tests/docs/dead-code | Complete | none |
| 7 — Home/Stats/holidays | Complete | none |
| 8 — PWA/offline delivery | Partial | installed-device confirmation on a real phone |
| 9 — Budgets/vendor | Partial | auth vendor investigation; `fitness-core` chunking in 15.5 |

Every remaining item needs a real device or a second client. None is a source
change waiting to be written.

### 15.8 State at handover

The worktree is clean. Production has never been exported, imported, deployed,
or otherwise touched, and its census remains empty. The development backup is
intact and its checksum re-verified. The development deployment carries the
narrowed schema and the same 608 documents it started with.

`npm run preview:phone` is serving the local build on port 4180 for device
testing. It is a real cloud build and requires a Clerk sign-in; if the phone
cannot authenticate, add the LAN origin to the Clerk instance's allowed origins.

## 16. Device testing pass and close-out

Date: 2026-07-30. Head at close-out: `91410b8b`. Merged to `develop`.

Section 15 closed the plan's own gates. This section records what a real device
found afterwards, which is a different category of finding: every item here came
from using the app on a phone or from measuring the running build, and none of it
was visible in the source.

### 16.1 Interaction and layout work

| Commit | Change |
| --- | --- |
| `88cd1c86` | Home habit tiles compacted, 82px to 66px |
| `e4bf32ad` | Target tile height matched to a tick tile, both 66px |
| `e0e05c20` | A revealed card can be swiped closed instead of snapping |
| `58ac6d73` | A closing card no longer travels behind the action button |
| `dc55b543` | Space around the Home title halved |
| `a56a0b79` | Habits reorder button reduced to an icon |
| `91410b8b` | Habits search field says habits, not activities |

Three of these are the same swipe gesture, and the sequence is worth keeping
because each fix exposed the next.

1. Closing a revealed card was not a rough animation, it was not animated at
   all. The gesture measured its delta from pointerdown and assumed the card
   started at zero, but a revealed card sits at `-btnWidth`. Dragging right gave
   a positive delta which the "left only" clamp turned into zero, so the card
   slammed shut the moment the drag passed the 12px threshold.
2. With that fixed, the 12px spent deciding the gesture was horizontal was still
   applied in one step, so travel began with a jump in both directions.
3. With both fixed, a card closed from a *released* reveal still slid behind the
   button and jumped in front at the end, while the same motion performed
   without lifting a finger looked correct. That difference was the diagnosis:
   `swipe-revealed` is only applied on release, and it lifts the button above
   the card, so only the non-continuous path was ever affected.

The user reported (3) precisely enough to name the reproduction, which is what
made it findable at all.

### 16.2 Two duplication faults, same shape

`.habit-card` set `padding: 16px` while its own markup carried `px-4 py-2`, and
the Home header set `height: 72px` while its markup carried `h-[72px]`. In both
cases `style.css` loads after Tailwind and won, so the markup was stating values
it did not control, and the tile was rendering at twice the padding it asked
for. Both now have a single source.

The reorder button had the same fault across modules rather than within one:
`HabitsView` built it and `HabitReorderModal` re-rendered it on every mode flip,
each with its own copy of the icon markup. The modal is dynamically imported, so
the icons moved to a small shared module rather than being imported from it.

### 16.3 A preview trap, and a guard that had to be fixed twice

`npm run test:pwa` and `npm run check:bundle:pages` both write a Pages build into
the same `dist/` a running preview serves. The result is not a 404: index.html
loads, every asset resolves to the SPA fallback and returns HTML, and the app
renders unstyled on whatever device is pointed at it. It looks exactly like the
stylesheet broke. This happened twice during this session, both times because
the assistant ran `test:pwa` and left it.

The first guard (`238d0522`) never fired. It used `fs.watch` on
`dist/index.html`, but a build removes the directory and writes a new file, so
the watch was bound to a dead inode. The verification is what allowed it to ship
broken: it rewrote the file in place, which keeps the inode and does emit an
event, and so tested a case that never occurs. `77e18579` replaced it with a
stat poll, verified against a real `BUILD_TARGET=pages vite build` and then
observed firing in a live preview during an actual `test:pwa`.

The lesson generalises beyond this script: a guard's test has to reproduce the
mechanism that triggers it, not a convenient approximation of the symptom.

### 16.4 Two-device convergence, observed

Section 15.3 listed two-device convergence as outstanding because it needs a
second client. It was then observed incidentally: Holiday Mode was switched off
for 30 July on the phone, and the change was present in the desktop session
against the deployed narrowed schema. The document record shows the write
carrying the phone's device id, distinct from the browser session's, so the two
clients did converge through Convex. This is weaker than a designed test — it
covers one recent-history record in one direction — but it is real evidence and
is recorded as such rather than left as a gap.

### 16.5 Final gate results

```text
npm run lint            passed
npm run test:unit       32 files, 224 tests passed
npm run test:convex     passed
npm run check:dead-code passed, zero issues
npm run check:cycles    passed, zero cycles
npm run test:e2e        149 passed, 1 skipped (opt-in large-account case)
npm run test:pwa        3 passed
npm run test:fitness:perf  1 passed
```

Pages budgets all pass: HTML 13,472 of 18,000; Fitness entry 19,614 of 25,000;
Fitness modals 24,645 of 30,000; largest JavaScript 582,365 of 650,000; Workbox
precache 2,372,430 of 2,500,000 bytes.

One known flake: `home-updates.spec.js:353` fails roughly once in eighty runs,
on an archived habit's card not being present after a date change. It was
measured at the same rate with and without the tile changes, so it predates
them. It is a real race worth fixing, not a test to delete.

### 16.6 What remains open

- The auth vendor chunk is 588 KB gzip and dominates delivery. Untouched
  deliberately: the plan forbids unsupported deep imports to move that number.
- Home downloads `fitness-core` at startup, 19.76 KB gzip, because rolldown
  inlines `shared/color.js` and `shared/equality.js` into it regardless of their
  `manualChunks` group. Two fixes were tried and reverted with measurements in
  15.5.
- Offline edit, terminate, reopen and reconnect on an installed client.
- Conflict resolution against a genuine concurrent write.
- Sign-out with pending work, and generation reset.
- `legacyData` and `migrationBatches` remain as empty untyped tables in
  development; the CLI has no drop-table command.
- The selected day tile and today outline print text in the brand accent, and
  white on `#007bff` is 4.02:1 in both themes, below AA for normal text. A
  palette decision rather than a defect.
- `applyTheme()` runs only at initialisation and on the toggle, so a dark-mode
  preference arriving from another device does not repaint until reload.

Production has still never been exported, imported, deployed or otherwise
touched, and its census remains empty.
