# Fitness Feature — Independent Optimisation Audit and Revised Plan

**Branch:** `fitness-overhaul-optimisations` (from `claude/fitness-overhaul`, from `develop`)
**Author:** Independent audit pass, 2026-07-29
**Scope:** A line-by-line review of `docs/FITNESS_OPTIMISATION_PLAN.md`, followed
by an independent audit of the fitness page, shared state, navigation lifecycle,
modal system, persistence path, build output, CSS, accessibility and tests.
**Status:** Proposal. Nothing in here has been implemented.

---

## 0. How to read this document

This is both a review of the existing optimisation plan and a replacement
execution plan. Every implementation item uses the same fields as the source
document, with one added comparison field:

| Field | Meaning |
| --- | --- |
| **What** | The change, concretely, with file paths |
| **Original plan** | Where this agrees, disagrees, strengthens or replaces the existing item |
| **Evidence** | What this audit actually found — measured, greped, built, tested or read |
| **Benefit** | What improves, quantified only where the evidence supports it |
| **Risk** | What could break, and how it would show |
| **Difficulty** | S (< 1h) · M (half a day) · L (1–2 days) · XL (multi-day) |

Difficulty is effort plus verification, not line count. Items are grouped by the
system boundary they change rather than by whether they are “performance”,
“correctness” or “cleanup”: in this codebase those concerns are coupled. A render
optimisation that can leave stale progress is a correctness change; a modal
refactor that loses focus is an accessibility regression.

### Sources used

- `docs/FITNESS_OPTIMISATION_PLAN.md` — all 1,498 lines, including all 45
  recommendations and the sequencing section
- `docs/FITNESS_OVERHAUL_PLAN.md` — the implementation plan and deviation log
- `docs/PROJECT_RULES.md`, `docs/CODING_GUIDELINES.md`,
  `docs/LOADING_PERFORMANCE_AUDIT.md`, `docs/PERSISTENCE_AUDIT.md`
- All 41 files under `src/features/fitness/`
- `src/core/state.js`, `src/core/persistenceRouter.js`,
  `src/core/navigation.js`, `src/core/storage.js`,
  `src/components/Modal.js`, `src/features/stats/stats.js`
- `index.html`, `vite.config.js`, `playwright.config.js`, `package.json`
- Direct build, lint, Vitest and Playwright runs on 2026-07-29
- Grep-based inventories of state reads, subscriptions, global listeners,
  `innerHTML` writes, fixed test sleeps and modal markup

### Executive opinion

The existing plan is unusually strong. Its central diagnosis is correct:
`getState()` cloning the entire account on every read is the dominant measured
cost, and fixing that will dwarf almost every template, CSS or listener
micro-optimisation. Its best qualities are:

- it measured a realistic large account instead of guessing;
- it ordered work by effect rather than by ease;
- it explicitly recommended *not* micro-optimising `programProgress.js`;
- it noticed dependency ordering such as D3 before D1 and B4 before D4;
- it diagnosed the four timezone failures from first principles;
- it kept the 588 KB vendor bundle visible while correctly deferring it;
- it distinguished compatibility shims from genuinely dead server code.

I would approve the plan as an audit, but not implement it verbatim. Four parts
need material correction:

1. **A1/A3’s state fix is not safe enough as written.** A shallow
   `Object.freeze` does not catch nested writes, and the `dispatch()` clone is
   also the reducer input — not merely rollback storage. The correct end state is
   a replaceable canonical root, structural sharing, development deep-freezing,
   and no rollback mutation.
2. **A2/C1/C5 use a global state version too broadly.** Invalidating indexes and
   program progress on *every* dispatch throws away much of the benefit. Cache
   against the identity of the exact slices read, plus the local date where time
   is an input.
3. **B2, B5, D3, D5 and G2 overstate small or unmeasured runtime wins.** They may
   still be good maintainability or interaction changes, but they should not
   displace measured work. In particular, a 120 ms filter debounce adds visible
   latency and keyed DOM reconciliation has not been browser-benchmarked after
   A1.
4. **The plan measures six dispatches for a multi-activity action but never
   removes them.** An atomic bulk-record path is the largest missed fitness-
   specific optimisation.

The plan also misses three cross-cutting issues with meaningful user benefit:

- every top-level page keeps rendering after it has been visited, even while
  hidden;
- several fitness interactions render two or three times after one dispatch;
- the modal and template layer has significant keyboard, focus-management and
  HTML-injection problems that should be fixed before late-stage polish.

---

## 1. Revalidated baseline

### Independently reproduced

The following were rerun against the current working tree:

| Check | Result |
| --- | ---: |
| `npm run lint` | Clean, 0 warnings |
| `npm run test:unit` | 21 files, **154 passing**, 3.91 s |
| `npm run test:e2e` | **123 passing, 4 failing**, 1.9 min |
| `npm run build:local` | Successful, 201 modules, 3.07 s |
| `dist/index.html` | 110.07 KB / 13.49 KB gz |
| Fitness JS chunk | 136.62 KB / 32.55 KB gz |
| Vendor chunk | 1,599.19 KB / **587.96 KB gz** |
| CSS | 83.22 KB / 15.06 KB gz |
| Fitness modal region, `index.html:755–1351` | 50,729 B / 6,467 B gz |
| Fitness modal roots in static HTML | 11 |
| Fixed `waitForTimeout` calls | 9 |

The build reproduced all four `INEFFECTIVE_DYNAMIC_IMPORT` warning groups from
the original plan and emitted only generic `chunk-<hash>.js` names for the
manual chunks.

The Playwright run occurred during the BST local/UTC date mismatch window and
reproduced the exact four failures listed in H1:

```
program-schedule.spec.js:630
program-schedule.spec.js:647
program-schedule.spec.js:676
program-schedule.spec.js:687
```

The received UI consistently showed “Next session” or “No activities recorded”
where the test had pinned the previous UTC weekday. That is direct confirmation
of the source plan’s root-cause analysis.

### Static baseline corrections

Several counts in the original plan need small corrections:

- There are **42 textual `getState()` calls** in `src/features/fitness/`, not 37,
  across 12 files. The repo-wide count of 185 is correct.
- There are **four** state subscription call sites in fitness
  (`FitnessModule` plus three modals), not seven. The substantive point — all are
  globally notified — remains correct.
- There are **12** `document` keydown registrations in the fitness tree. Not all
  are permanent: the timer removes its handler and the program day menu has a
  temporary capture handler. Nine modal Escape handlers are effectively
  permanent once their modules bind.
- The e2e suite is not wholly “unparallelised”: this run used nine Playwright
  workers across spec files. Tests *within* the 699-line
  `program-schedule.spec.js` remain serial, which is why its final four timeouts
  dominate the tail.

### Reported benchmark accepted, but not yet reproducible

The source plan’s 722 KB synthetic-account measurements are internally
consistent:

| Reported operation | Calls | Reported time |
| --- | ---: | ---: |
| One `structuredClone(state)` | 1 | 2.4–2.8 ms |
| Six-activity routine lookup | 7 | 17.6 ms |
| One program tile progress calculation | 9 | 23.4 ms |
| Six-card activity-list render | 33 | 79.9 ms |

The arithmetic strongly supports the conclusion that cloning explains nearly
all of the Node-side render time. However, the scratch harness and synthetic
fixture were not committed, so these figures cannot be independently rerun or
protected from regression. They also do not measure browser DOM construction,
style calculation, layout, paint, focus loss or network latency. This matters
for B2, B3, D1 and G2: their benefits should be measured in a browser after A1,
not inferred from the Node benchmark.

### The original composite is a lower bound

The reported ~100 ms per dispatch includes the fitness list and program tile.
It does not include other top-level views after they have been visited:

- `HomeModule.js:45` permanently renders Home on every dispatch.
- `HabitsModule.js:29` permanently renders Habits on every dispatch.
- `stats.js:37` permanently recalculates both habit and fitness statistics.
- `ProfileModule.js:253` permanently rerenders Profile.
- `ActionButtons.js:80` adds another permanent category-state subscriber.

The Statistics page is especially important: it scans fitness history twice and
contains repeated all-time habit loops. A mature session that has visited every
tab can therefore cost materially more than the source plan’s fitness-only
composite.

---

## 2. Disposition of every original recommendation

This register ensures no source-plan item disappears merely because the revised
plan groups work differently.

| Item | Verdict | Independent assessment |
| --- | --- | --- |
| A1 | **Modify, highest priority** | Diagnosis correct; replace-root + deep-freeze design is safer than returning a shallow-frozen mutable root |
| A2 | **Modify** | Use collection-identity caches, not a global version invalidated by unrelated dispatches |
| A3 | **Merge into A1** | Clone removal is right; rollback should disappear when commit is a root replacement |
| A4 | **Modify** | Selector subscriptions are safer than action-type filtering, especially for hydration and remote patches |
| B1 | **Expand app-wide** | Fitness is not unique; every visited page needs activate/deactivate lifecycle |
| B2 | **Measure, then decide** | Focus/gesture preservation is real; speed benefit is unmeasured after A1 and hand reconciliation is risky |
| B3 | **Agree** | CSS should own layout; keep the null guard as an immediate independent fix |
| B4 | **Agree** | Narrow modal subscriptions by exact slices; do not use global action hints |
| B5 | **Modify** | Do not add an unconditional 120 ms delay; use browser measurement, rAF coalescing or an adaptive threshold |
| B6 | **Expand** | Correct, but duplicate renders also occur on delete, date change, rest toggle, colour update and program save |
| B7 | **Agree, small** | Import is cached, so the cost is a promise/microtask hop rather than repeated download/evaluation |
| C1 | **Modify** | Cache by program/slice identities plus local day; `stateVersion()` would invalidate on irrelevant actions |
| C2 | **Agree** | Still useful independently; becomes naturally free with the corrected C1 cache |
| C3 | **Agree** | Better still: pass one state snapshot and the resolved program through the whole call chain |
| C4 | **Strongly agree: skip** | This restraint is one of the source plan’s best decisions |
| C5 | **Expand** | Share the history index with the Statistics page and key it by `recordedActivities` identity |
| D1 | **Agree, measure startup effect** | Byte/DOM reduction is real; parse-time benefit was not browser-measured |
| D2 | **Agree as maintainability** | Strong drift prevention; runtime savings are secondary |
| D3 | **Expand** | Centralise Escape together with focus trap, focus restoration, dialog semantics and stacked-modal ownership |
| D4 | **Agree** | Remove only after state-driven refresh is proven |
| D5 | **Agree, very low value** | Sensible cleanup after D1, not a performance phase by itself |
| D6 | **Agree, modify prefetch** | Lazy modal imports are valuable; a global `modulepreload` would defeat the split |
| E1 | **Agree** | Static import graph is the cause; reconsider whether manual chunks are still needed after real boundaries exist |
| E2 | **Agree** | Diagnostic names are low-risk and should land early |
| E3 | **Agree: separate project** | Correctly identified and correctly deferred |
| E4 | **Agree** | Remove needless promise boundaries, preserving any intentional cycle break |
| E5 | **Agree** | Scope `test:unit` or rename the aggregate; do not run migration twice |
| F1 | **Agree** | Both migration functions are dead in cloud and mutually block in legacy |
| F2 | **Agree** | Remove dead timer API and converge on one display tick source |
| F3 | **Agree** | Empty method and unused re-exports should go |
| F4 | **Agree** | Delete after one final dynamic-reference check |
| F5 | **Modify rationale** | Public-surface cleanup is good, but an export does not inherently “block tree shaking” |
| F6 | **Agree** | Document/date compatibility mutations before later removal |
| F7 | **Agree, trivial** | Safe config cleanup |
| F8 | **Modify tooling** | Prefer `knip` with an explicit allowlist; `import/no-unused-modules` can be noisy around dynamic imports |
| G1 | **Agree** | Small bundle benefit, larger comprehension benefit; verify dynamic class construction |
| G2 | **Defer/fold into B2** | Inline style does not meaningfully “defeat CSS caching”; inherited custom properties help patching and consistency, not proven speed |
| H1 | **Agree, strengthen** | Set both a fixed clock and `timezoneId`; fixed time alone does not standardise local timezone |
| H2 | **Correct and narrow** | The suite already uses file-level workers; split/parallelise the long spec and add a production-preview smoke project |
| H3 | **Agree** | Shared domain fixtures materially lower the cost of the refactor |
| H4 | **Agree** | Replace all nine sleeps with observable conditions |
| H5 | **Agree** | Correct stale docs and compatibility-test labels |
| I1 | **Promote to Phase 0** | More serious than stated; raw HTML, attribute and style contexts require different safe handling |
| I2 | **Agree** | Immediate one-line guard, followed by CSS deletion of the helper |
| I3 | **Agree, correct rationale** | Remove production globals; “GC pinning” is not the issue because the store already retains state |

---

## Category A — Rebuild the state read path safely

> This remains the whole game. The revised design keeps the source plan’s
> performance conclusion but strengthens its immutability and invalidation model.

### A1. Replace the canonical root; do not mutate a shallow-frozen root

**What.** Change `src/core/state.js` from a `const` object mutated with
`Object.assign` to a replaceable canonical value:

```js
let _appData = freezeForDevelopment(deepClone(initialState));

export function getState() {
  return _appData;
}

function commit(nextState, prevState, action) {
  if (nextState === prevState) return false;
  _appData = freezeForDevelopment(nextState);
  notify(_appData, prevState, action);
  return true;
}
```

`freezeForDevelopment` must recursively freeze arrays and plain objects after
each successful reducer result. Freezing only the top level would still permit
`getState().activities.push(...)`, the exact class of bug the guard is supposed
to catch.

Clone or normalise only at untrusted ownership boundaries:

- initial state creation;
- import/hydration payloads that may be retained or mutated by their caller;
- export/serialisation where a detached result is the API contract.

**Original plan.** Agrees with A1’s clone diagnosis and dev enforcement, but
replaces the “return `_appData`; `Object.freeze` it” sketch. The current root is
mutated in place; freezing that root would make the next `Object.assign` fail.
Root replacement makes the immutability model coherent.

**Evidence.** `getState()` returns a full `structuredClone` at
`state.js:62–64`. There are 185 reads repo-wide and 42 in fitness. The reducer
already uses structural sharing in almost every case. The current clone boundary
is not absolute anyway: `notify()` passes live `_appData`, thunks receive it,
selectors default to it, and `window.appData` exposes it.

**Benefit.** Removes the dominant O(total account state) cost from every read
while preserving a loud development failure for accidental writes. Root
replacement also makes selector subscriptions and slice-identity caches
reliable.

**Risk.** High. The mutation audit must include reads through `getState`,
subscriber arguments, thunks, exported selectors and test globals. Add tests
that attempt nested array/object mutation in development and verify it throws.

**Difficulty.** L to implement and verify correctly.

---

### A2. Remove the dispatch clone by treating reducers and persistence as readers

**What.** In `dispatch()`:

1. Keep `const prevState = _appData`, not a clone.
2. Let `reducer(prevState, action)` construct `nextState`.
3. Replace the root only after the reducer succeeds.
4. Do not “restore” on reducer failure — no canonical mutation has happened.
5. Pass the read-only previous root to `persistStateAction`.

Audit `persistenceRouter.js` to confirm it does not mutate its `state` argument,
then pin that with a deep-freeze unit test.

**Original plan.** Agrees with A3 that the clone should go, but corrects the
claim that a shallow rollback copy is sufficient. The clone is currently the
*reducer input*. The cleaner design makes rollback unnecessary rather than
making it shallower.

**Evidence.** `state.js:353` clones before both persistence routing and reducer
execution. Persistent cloud actions pay this once before durable work and again
when the optimistic action is recursively dispatched. The reducer’s visible
mutations are to freshly copied local structures.

**Benefit.** Removes another full-state clone per dispatch, two on the
persistent path, and simplifies failure semantics.

**Risk.** High until reducer and persistence immutability are verified. Payload
aliasing in `IMPORT_DATA` and `HYDRATE_CACHE` needs explicit ownership handling.

**Difficulty.** M implementation, L verification.

---

### A3. Add selector subscriptions; reject action-type filtering as the primary API

**What.** Replace the single callback-only API with:

```js
subscribe(selector, listener, { equality = Object.is, fireImmediately = false })
```

Store the last selected value per subscriber. After commit, call the selector on
the new root and notify only when equality fails. Provide a small `shallowEqual`
for tuples/records of slice references.

Fitness selectors should be explicit:

- day list: selected date, that date’s records, activities, activity categories,
  and that date’s rest flag;
- rest toggle: selected date plus that date’s rest flag;
- program tile: active program, records, rest days, routines, activities and
  local date;
- library: activities and activity categories;
- activity details: selected activity plus recorded history;
- program details: selected program plus the progress inputs.

**Original plan.** Agrees with A4’s problem, but disagrees with starting from
action hints. An action filter can miss `HYDRATE_CACHE`, `APPLY_REMOTE_CHANGE`,
rollback/state-patch actions or future compound actions. Slice comparison asks
what actually changed and is therefore safer.

**Evidence.** `notify()` currently provides no action or previous state.
Fitness’s four subscriptions all run on every dispatch. Every top-level page
uses the same global channel.

**Benefit.** Stops entire render trees rather than merely making them faster.
It is the architectural prerequisite for safe memoisation and hidden-view
lifecycle.

**Risk.** Medium–High. A selector that omits a dependency creates stale UI.
Write dependency-focused tests: mutate each relevant slice independently and
assert exactly which render counter changes.

**Difficulty.** L.

---

### A4. Isolate subscriber failures from committed state

**What.** Move listener invocation outside reducer commit failure handling.
Catch/report each listener independently so one broken hidden page cannot roll
back an otherwise valid user action after earlier listeners have already
painted:

```js
for (const subscription of subscriptions) {
  try {
    subscription.notify(next, prev, action);
  } catch (error) {
    reportSubscriberError(error, subscription);
  }
}
```

**Original plan.** Missed.

**Evidence.** Today `notify()` runs inside `dispatch()`’s `try`. If listener
three throws after listeners one and two rendered, the catch mutates state back
with `Object.assign` but does not rerender the first two. State and DOM can
diverge.

**Benefit.** Prevents a rendering bug from turning into failed or visually
rolled-back fitness data. It also makes subscriber performance instrumentation
possible per listener.

**Risk.** Medium. Errors must still be visible in development and monitoring;
do not silently swallow them.

**Difficulty.** S–M.

---

### A5. Suppress no-op state commits

**What.** Have reducers return the original state when the requested value is
already present, and have `dispatch` skip notify/persistence where the domain
operation is truly a no-op. Start with:

- `SET_FITNESS_SELECTED_DATE`
- `SET_SELECTED_DATE`
- `SET_SELECTED_GROUP`
- `SET_SYNC_STATUS`
- `SET_REST_DAY`
- updates whose patch changes no field

Be careful not to suppress operations whose server revision or idempotency
semantics matter.

**Original plan.** Missed.

**Evidence.** Navigating to Fitness sets today before the view swap every time,
even if today is already selected. The reducer always returns a fresh root and
notifies all subscribers. Several modal saves can also submit unchanged data.

**Benefit.** Zero work for repeated navigation and unchanged controls: no
reducer allocation, subscriber selection, DOM work or persistence routing.

**Risk.** Medium for persistent actions; low for device-only date selection.

**Difficulty.** M.

---

### A6. Cache indexes by collection identity, not global state version

**What.** Build module-private indexes keyed by the exact array reference:

```js
let activitiesSource;
let activitiesById;

function activityIndex(state) {
  if (activitiesSource !== state.activities) {
    activitiesSource = state.activities;
    activitiesById = new Map(state.activities.map((item) => [item.id, item]));
  }
  return activitiesById;
}
```

Apply the same pattern only where measurement justifies it: routines, programs
and activity categories. Prefer passing a state snapshot/index through a call
chain to repeatedly calling public lookup functions.

**Original plan.** Improves A2. A global `stateVersion()` would rebuild an
activity map after toggling a habit, changing sync status or opening a different
date even though `state.activities` is the same object.

**Evidence.** Reducers replace changed collections and retain unchanged
references. `getRoutineActivities` performs one routine lookup plus one activity
lookup per id. Program schedule filtering repeats the same lookups per slot.

**Benefit.** O(1) lookup without unnecessary invalidation. More importantly,
the identity pattern is self-documenting: the cache depends on the collection,
not “all state”.

**Risk.** Low after A1 establishes reliable structural sharing. High if any code
still mutates a collection in place.

**Difficulty.** M.

---

## Category B — Remove repeated work at the user-action boundary

### B1. Add one atomic multi-activity record path

**What.** Replace the loop of individual `RECORD_ACTIVITY` dispatches with a
domain action such as `RECORD_ACTIVITIES` carrying prebuilt records in order.

The persistence layer should:

- create one outbox operation per record in deterministic order;
- commit those operations through one batch/transaction boundary where the
  current IndexedDB abstraction permits it;
- return per-record failure information if all-or-nothing durability is not
  available;
- apply one local reducer update and issue one notification.

De-duplicate ids before building records:

```js
const liveIds = [...new Set(activityIds)].filter((id) => activitiesById.has(id));
```

**Original plan.** Missed despite measuring this as the worst realistic case.
A1 makes six renders cheaper; B1 removes five of them and five state commits.

**Evidence.** `activities.js:90–97` awaits `recordActivity` once per id to keep
outbox ordering deterministic. Each call dispatches. `recordRoutinesForDate`
flattens selected routines without de-duplicating overlaps. The e2e wording says
activities across multiple routines are recorded “once”, but that is only
tested with non-overlapping routines.

**Benefit.** Six-activity routine: six state transitions and notifications
become one. Fewer clone-free reducer allocations, selectors, renders and outbox
round trips. Overlapping routines stop creating accidental duplicate sessions.

**Risk.** High. Partial durable failure semantics and idempotency must be
designed, not guessed. Add tests for duplicate ids, overlapping routines,
failure on operation N, retry, reload and remote replay.

**Difficulty.** L–XL depending on IndexedDB transaction support.

---

### B2. Establish one render authority per stateful surface

**What.** State subscriptions should be the sole normal render trigger. Event
handlers dispatch intent; they should not dispatch and then repaint the same
surface manually.

Remove or consolidate:

- `ActivityRecorded` repaint in `FitnessModule`;
- manual list repaint after delete in both ActivitiesList callbacks;
- rest-toggle list repaint plus `onRestToggle` repaint;
- date-change rest-toggle update duplicated by the subscription;
- program-builder `onSaved: renderProgramTile`;
- activity-library explicit refresh after a colour dispatch;
- modal-close/activity-delete refreshes once selector subscriptions cover them.

Keep imperative updates only for UI state not represented in app state, such as
filter text, expanded sections or pending focus.

**Original plan.** Expands B6 and D4. B6 correctly found one duplicate path but
not the whole family.

**Evidence.** One rest-day toggle currently:

1. dispatches and invokes the global Fitness subscription;
2. calls `updateRestToggle`;
3. calls `renderActivitiesList`;
4. invokes `onRestToggle`, which calls `renderActivitiesList` again.

A recorded activity notifies state and then fires `ActivityRecorded`, causing a
second list render. A delete notifies state and then explicitly renders in the
delete callback.

**Benefit.** Often a 2–3× reduction in DOM work for the affected action before
any sophisticated reconciliation. It also makes render counts testable.

**Risk.** Medium. Removing an imperative refresh before its replacement
subscription is correct creates stale UI. Land per interaction with render-
counter tests.

**Difficulty.** M.

---

### B3. Add page activate/deactivate lifecycle to navigation

**What.** Extend `navigation.js` so modules may expose:

```js
init()
activate({ firstActivation })
deactivate()
```

On deactivate, unsubscribe expensive view renderers or mark them dormant. On
activate, compare selected slice identities or consume one dirty flag and render
once. Keep global non-visual services such as storage and sync status subscribed.

Apply first to Fitness, then Home, Habits, Statistics and Profile.

**Original plan.** Expands B1. Checking `#fitness-view.active-view` is a useful
short-term guard, but navigation lifecycle is the durable fix and captures the
larger cross-page cost.

**Evidence.** All five top-level modules subscribe permanently after first
visit. Navigation only tracks whether a module was loaded; it never signals that
the view stopped being active.

**Benefit.** A habit toggle does not rebuild Fitness, Habits, Statistics and
Profile behind Home. A six-record fitness action does not repeatedly calculate
hidden all-time habit statistics after the Statistics tab has once been opened.

**Risk.** Medium. A missed activation refresh shows stale data. Test every pair:
change data on view A, navigate to B, assert B is current on its first frame.

**Difficulty.** L.

---

### B4. Replace JS height calculation with flex CSS

**What.** Add the required `min-height: 0`, flex growth and overflow rules to the
fitness view/list chain; remove `adjustActivitiesContainerHeight`,
`resize` and `orientationchange` handlers once visual tests pass.

Land the null guard immediately:

```js
const fitnessView = document.querySelector('#fitness-view');
if (!fitnessView) return;
```

**Original plan.** Agrees with B3/I2.

**Evidence.** The helper forces geometry and computed-style reads after every
non-empty list render and on resize. The null dereference was reproduced by the
source audit. The root view is already a flex column, so CSS is the natural
owner.

**Benefit.** Removes forced layout from the render path, two window listeners,
one delayed orientation timer and a latent crash.

**Risk.** Medium for mobile layout. Verify 375, 768 and 1280 px; portrait and
landscape; long lists; empty/rest states; iOS visual viewport with keyboard.

**Difficulty.** M.

---

### B5. Defer keyed activity-list reconciliation until after browser measurement

**What.** First land A1–A6 and B1–B4, then measure activity-list update time in
Chromium with 1, 6, 20 and 100 records under CPU throttling. Only implement keyed
reconciliation if DOM/listener work exceeds the frame budget or interaction
tests reproduce focus/swipe loss.

If implemented:

- key strictly by record id;
- patch content without replacing an active swipe node;
- use one delegated activation handler where possible;
- make swipe helper teardown explicit;
- retain focus on the same record after remote changes;
- fall back to full empty-state replacement when list mode changes.

**Original plan.** B2’s interaction rationale is valid, but its performance
benefit is not measured independently of cloning. This changes it from an
assumed Phase 6 win to a benchmark-gated project.

**Evidence.** The reported 79.9 ms render is explained by 33 clones at roughly
2.4 ms each. No post-A1 browser DOM number exists. Hand-written keyed diffing is
one of the highest-complexity proposals in the source plan.

**Benefit.** If the gate fails, no complexity is added. If it passes,
reconciliation protects swipe/focus state and bounds DOM mutations to changed
records.

**Risk.** Medium–High.

**Difficulty.** L, only if triggered.

---

### B6. Use one-pass activity grouping and frame-aware filtering

**What.** Replace `getActivitiesByCategory()`’s category-loop filtering with one
pass over live activities, using category and activity indexes from one state
snapshot. Cache normalised lowercase names by `activities` identity.

For filter input:

- render immediately while measured work stays below one frame;
- otherwise coalesce to at most once per animation frame;
- consider a short debounce only for very large libraries and make it
  cancelable on modal close.

**Original plan.** Improves B5 and adds a missed algorithmic issue. Rejects an
unconditional 120 ms debounce as the default.

**Evidence.** `getActivitiesByCategory` calls `listActivities()` inside every
category iteration. There are five default categories, so the current unfiltered
library repeatedly reads and filters the same activity collection. A 120 ms
delay is perceptible and the existing `debounce` helper has no cancel/flush API.

**Benefit.** One O(activities + categories) derivation and no artificial latency
for normal accounts.

**Risk.** Low.

**Difficulty.** M.

---

## Category C — Derived fitness data

### C1. Memoise program progress by exact inputs, including the local day

**What.** Cache `getProgramProgress` against:

- the program object/reference or revision;
- `recordedActivities`;
- `restDays`;
- `routines`;
- `activities`;
- `todayISO`.

Use a one-entry or small per-program cache; avoid serialising large inputs into a
string key.

**Original plan.** Agrees with C1 but replaces `{ program.revision,
stateVersion() }`. The global version would miss on unrelated habit/sync actions
and does not express the midnight dependency.

**Evidence.** `getProgramProgress` explicitly reads all five domain inputs and
passes `getLocalISODate(new Date())`. The result can change at local midnight
without a program revision.

**Benefit.** Repeat tile/details renders with unchanged fitness inputs become
constant-time while unrelated state changes retain the cached result.

**Risk.** Medium. Omit one input and progress becomes stale. Test every
dependency plus a simulated local-midnight transition.

**Difficulty.** M.

---

### C2. Compute program input from one state snapshot

**What.** Refactor program read helpers so `getProgramProgress(program, state)`
uses one snapshot and shared indexes. `getProgramScheduledDays`,
`getProgramSchedulePhases`, `routineActivityMap` and `archivedFromMap` should
accept resolved data rather than call `getState()` again.

Have `scheduledWeekday()` return `{ program, weekday }`, and use that object for
routine and activity schedule lookup.

**Original plan.** Combines and strengthens C2/C3. The source plan correctly
identifies redundant walks but treats them as separate micro-fixes.

**Evidence.** The reported progress calculation makes nine state reads. The
schedule add path resolves the active program and its schedule repeatedly.

**Benefit.** Fewer calls and scans even before indexes; one internally
consistent snapshot; simpler cache dependencies.

**Risk.** Low–Medium.

**Difficulty.** M.

---

### C3. Build one shared recorded-history index

**What.** Create a derived index keyed by `recordedActivities` identity:

- records by activity id;
- records by date;
- optionally pre-sorted per-activity records;
- aggregate totals needed by Statistics.

Reuse it in `activityStats.js`, `ActivityInfoModal`, `StatsModal` and
`stats.js`. Keep “today” filtering in the consuming selector or include
`todayISO` in the cached aggregate key.

**Original plan.** Expands C5 beyond the modal. The same history is also scanned
twice on the Statistics page, which continues doing so while hidden after a
visit.

**Evidence.** `activityStats.js` performs four full-history passes.
`stats.js:591` and `:617` perform two more. All read the same
`recordedActivities` object.

**Benefit.** One history traversal per actual record change, shared across every
statistics surface.

**Risk.** Medium. Sorting, future-date exclusion, lower-is-better and unit
normalisation must remain consumer-correct.

**Difficulty.** L.

---

### C4. Do not micro-optimise `plannedSlots`

**What.** Leave `helpers/programProgress.js`’s pure schedule expansion intact
unless the post-C1 benchmark still shows a user-visible long task.

**Original plan.** Full agreement with C4.

**Evidence.** The pure module has 53 focused tests and encodes history,
allocation and weekly credit rules. Upstream memoisation pays the complexity
once per relevant state change.

**Benefit.** Avoids risk disguised as optimisation.

**Risk.** None.

**Difficulty.** — (skip)

---

## Category D — Modal architecture, code loading and focus

### D1. Build one modal manager, not only one Escape dispatcher

**What.** Extend `src/components/Modal.js` to own:

- the open stack;
- one Escape dispatcher with per-modal hooks;
- opener capture and focus restoration;
- initial focus;
- Tab/Shift+Tab focus containment in the top modal;
- `role="dialog"`, `aria-modal="true"` and labelled title wiring;
- inert/`aria-hidden` handling for background and underlying modal content;
- body scroll lock;
- cleanup when a lazily created modal is removed.

Modal-specific Escape policies remain registered callbacks: clear a filter
first, flush notes, close a sub-menu, or close normally.

**Original plan.** D3 is a good prerequisite for D1 but is too narrow. The
runtime cost of ten small self-filtering key handlers is negligible; central
ownership is valuable because it fixes behavior and enables lazy lifetimes.

**Evidence.** None of the 11 static fitness modal roots has `role="dialog"` or
`aria-modal`. There is no focus trap or generic focus restoration.
`ActivityLibraryModal` and `RoutinesModal` focus their filters in only some
flows; activity cards and program tile can open modals without a return-focus
contract.

**Benefit.** Predictable stacked-modal behavior for keyboard and assistive-
technology users, plus one lifecycle boundary for D2–D4.

**Risk.** High. Nested modal focus is subtle. Test Tab wrap, Shift+Tab, Escape
policy, click-outside, opener restoration and closing a child back to its parent.

**Difficulty.** L.

---

### D2. Lazy-create modal markup inside lazy modal modules

**What.** Move the 11 static fitness modal shells out of `index.html`. Each modal
module exposes `ensureMounted()` and registers with the modal manager. Remove any
existing node before creation so duplicate ids are impossible.

Do this together with lazy `FitnessModals` methods. Keep the Activity/Program
details module and its shell in the same dynamic boundary where practical.

**Original plan.** Agrees with D1 and D6, but treats markup and code as one
delivery boundary rather than two independent refactors.

**Evidence.** The static region is 50,729 B raw / 6,467 B gz and contains 11
modal roots for every user. The current fitness core statically imports all
modal modules and builds one 136.62 KB chunk.

**Benefit.** Home-only sessions retain fewer DOM nodes; Fitness first activation
does not evaluate builder/details code; the build can create genuine dynamic
boundaries.

**Risk.** Medium–High. Module creation, handler lifetime, stacked z-index,
autofill, focus and PWA offline behavior all need coverage.

**Difficulty.** L.

---

### D3. Standardise modal shells after the lazy boundary exists

**What.** Add `buildModalShell({ id, layer, titleId, title, body, footer })` or a
small DOM builder. Centralise the z-index table and shared overlay/content/body
classes. Inspect the existing unused `modal-*-base` CSS before choosing whether
the abstraction belongs in CSS, JS or both.

**Original plan.** Agrees with D2.

**Evidence.** Overlay/content/body class strings are copied throughout
`index.html`; four unused base classes suggest an abandoned prior attempt.

**Benefit.** Prevents aesthetic, accessibility and z-index drift. Bundle-byte
savings are secondary.

**Risk.** Medium. Pixel parity is required.

**Difficulty.** M.

---

### D4. Make lazy opening resilient and prefetch by intent

**What.** Every async facade method should:

- expose a pending state on the initiating control;
- catch import failure and show a recoverable message;
- ignore a second tap while the same module is loading;
- preserve the opener for focus restoration.

Prefetch likely modal chunks on pointerdown/pointerenter of their triggers or
after Fitness becomes idle. Respect `navigator.connection?.saveData` and slow
effective connection types. Do not add global HTML `modulepreload` links for all
modals.

**Original plan.** Strengthens D6. A global modulepreload would download the
very code D6 is trying to defer.

**Evidence.** Navigation already prefetches top-level pages on pointer intent
and idle. The same pattern can be scoped to modal likelihood.

**Benefit.** Preserves instant-feeling common opens without paying for every
builder/details modal on Home.

**Risk.** Medium. Stale service workers and failed dynamic imports need explicit
UX.

**Difficulty.** M.

---

### D5. Remove redundant modal events and defensive DOM moves

**What.** After selector subscriptions and lazy mounting are green:

- delete `modalClosed`/`ActivityDeleted` refresh listeners;
- remove `ActivityRecorded` as a render signal;
- use `getElementById`, not “last duplicate id” query selection;
- remove modal reparenting on every open;
- keep custom events only when they represent integration behavior not already
  represented by state.

**Original plan.** Combines D4/D5 and part of B6.

**Evidence.** `closeModal` emits to every listener on every modal close. The
duplicate-id and reparent defenses exist because ownership is currently split
between static HTML and dynamic modules.

**Benefit.** One state-driven update path and simpler modal lifetime.

**Risk.** Low after prerequisites; high before them.

**Difficulty.** S–M.

---

## Category E — Security and accessibility are not polish

### E1. Eliminate context-unsafe interpolation before large DOM refactors

**What.** Inventory every user-controlled value used in:

- HTML text context;
- HTML attribute context;
- style/CSS context;
- SVG/ARIA text context.

Prefer DOM construction with `textContent`, `setAttribute` and
`style.setProperty`. Where templates remain, use separate context-correct
helpers and make unsafe raw interpolation a lint/review violation. Do not assume
one `escapeHtml()` function makes a CSS or attribute context safe.

Cover activity, routine, program and category names; notes; icons; record
labels; imported data; and any cloud-hydrated values.

**Original plan.** Promotes and strengthens I1. Phase 6 is too late: D1/D2/B2
would otherwise copy unsafe patterns into a larger architecture.

**Evidence.** Raw values appear in at least 20 `innerHTML` templates, including
activity names and notes, program/routine names and `aria-label` attributes.
`ActivityCard` places a name inside a quoted attribute and category colour inside
style. Imports and cloud hydration can supply persisted content.

**Benefit.** Prevents persistent markup injection, broken attributes and layout
corruption across devices/imports. DOM APIs also make later patching more
targeted.

**Risk.** Medium because it touches many templates. Snapshot visual tests and
malicious-string e2e fixtures are required.

**Difficulty.** L.

---

### E2. Validate colour, icon and numeric presentation inputs

**What.** Enforce domain allowlists/validators at creation, import and hydration:

- category colour: canonical six-digit hex from the supported palette, or a
  deliberately broader validated CSS-colour grammar;
- icons: plain text/known Material icon token, never raw markup;
- duration/unit/intensity/set fields: valid ranges and enum values;
- ids used in attributes/selectors: treat as data, not template syntax.

Use safe fallback presentation for legacy invalid values rather than failing the
whole account.

**Original plan.** Missed; I1 mentions text but not CSS/style injection.

**Evidence.** Category colour is user-editable and imported values flow into
inline style strings. Sanitisation in `operationPayload.js` primarily removes
nullish fields; it is not an HTML/CSS validation layer.

**Benefit.** Closes non-text injection contexts and makes rendering assumptions
explicit.

**Risk.** Medium for legacy data compatibility.

**Difficulty.** M.

---

### E3. Use native interactive semantics for cards

**What.**

- Make an active activity card a real button or give it complete button
  semantics and Enter/Space handling without interfering with swipe.
- Make routine cards real interactive elements.
- Do not combine `role="progressbar"` with “activate to open” on ProgramTile.
  Use a button for activation and a child progress element/status for progress.
- Ensure archived inert cards are not focusable.

**Original plan.** Missed.

**Evidence.** `ActivityCard` adds only a click listener to a `<div>`.
`RoutinesModal` gives a card `tabindex="0"` but no role. ProgramTile is a
focusable progressbar that also acts as a button.

**Benefit.** Full keyboard and assistive-technology access with clearer event
handling.

**Risk.** Medium around swipe/touch behavior and nested delete buttons.

**Difficulty.** M.

---

### E4. Remove production state globals; add a narrow test hook

**What.** Gate `window.fitnessCalendarApi`, `window.HomeModule`,
`window.HomeView` and `window.appData`. For Playwright, expose a single
test-only object when `VITE_DATA_BACKEND=legacy` or a dedicated test flag is set:

```js
window.__APP_TEST__ = {
  getState: () => getState(),
  dispatch,
};
```

Use a getter/function so A1 root replacement never leaves tests holding a stale
object.

**Original plan.** Agrees with I3.

**Evidence.** Many e2e specs read `window.appData` directly. Production also
receives the same global.

**Benefit.** Smaller accidental public surface and tests that state their
privileged dependency.

**Risk.** Medium because the existing e2e suite is coupled to the global.

**Difficulty.** M.

---

## Category F — Build and delivery

### F1. Name chunks first, then let real dynamic boundaries drive splitting

**What.** Update `chunkFileNames` to prefer `chunkInfo.name`. After D2, compare
two builds:

1. current manual chunk rules;
2. dynamic imports with fitness-specific manual rules removed.

Choose the graph with no cycle warnings, sensible request count and smaller
Fitness entry cost. Do not force all modal modules into one eager manual chunk.

**Original plan.** Agrees with E1/E2 and takes up its suggestion to question
whether manual chunks still earn their keep.

**Evidence.** Current build emits generic chunk names and one 136.62 KB fitness
chunk containing both core and modal markers.

**Benefit.** Observable, maintainable chunking tied to actual user-action
boundaries.

**Risk.** Medium. Shared helpers can become duplicated or promoted to surprising
common chunks.

**Difficulty.** M.

---

### F2. Remove ineffective dynamic imports

**What.** Resolve the four warning groups. For fitness:

- statically import `datetime.js` where it is already in the same graph;
- remove the ineffective `FitnessModals` promise hop by inverting the cycle or
  importing the final modal module directly through the new facade;
- make `RestToggle` consistently static within Fitness core.

Keep a dynamic import only when the build proves it creates a separate boundary.

**Original plan.** Agrees with B7/E4.

**Evidence.** Reproduced verbatim during `npm run build:local`.

**Benefit.** Clean diagnostic output and fewer misleading async boundaries.

**Risk.** Low–Medium around circular imports.

**Difficulty.** S–M.

---

### F3. Add bundle budgets and PWA lazy-chunk verification

**What.** Record build artefact budgets in CI:

- HTML gzip;
- Fitness entry gzip;
- total fitness modal gzip;
- largest vendor gzip;
- total precache size for Pages builds.

Add a built-PWA smoke test that:

1. installs/loads the service worker;
2. visits Fitness once;
3. goes offline;
4. opens at least one lazy modal from each chunk family.

**Original plan.** Missed. D6 changes the offline delivery model and should have
an explicit gate.

**Evidence.** Local builds disable the service worker, while Pages builds
precache built assets. Dev-server e2e cannot prove lazy chunks remain available
offline after deployment.

**Benefit.** Prevents a successful code split from becoming an offline-only
failure.

**Risk.** Medium; service-worker tests are easy to make flaky. Keep the smoke
small and production-built.

**Difficulty.** M–L.

---

### F4. Defer the vendor chunk to a separate audit

**What.** Keep the 587.96 KB gz vendor chunk visible as a release risk, but do
not mix Clerk/Convex surgery into the fitness change set.

**Original plan.** Full agreement with E3.

**Evidence.** Independently reproduced.

**Benefit.** Protects scope and auth/offline correctness.

**Risk.** None from deferral; significant network cost remains.

**Difficulty.** XL later.

---

## Category G — Dead code and CSS

### G1. Enable detection, then remove the verified dead surface

**What.** Add `knip` or equivalent with explicit entries for Vite, service
worker, Convex, Playwright dynamic imports and test-only exports. Turn
`no-unused-vars` into an error. Burn down:

- F1–F5’s dead fitness functions/exports;
- empty timer methods and duplicate tick path;
- stale `.eslintignore` entries;
- the 26 verified unused CSS classes;
- duplicate unreachable `return` in `SET_SYNC_STATUS`;
- commented-out action types and other state-file ghost code found by the tool.

**Original plan.** Combines F1–F5, F7/F8 and G1. Adds the duplicated
`SET_SYNC_STATUS` return, which the source plan missed.

**Evidence.** Manual grep confirms the listed dead functions and CSS selectors.
`state.js` contains two consecutive identical returns in `SET_SYNC_STATUS`.

**Benefit.** Smaller misleading surface and a standing regression gate.

**Risk.** Medium on the first tool run because dynamic entry points create false
positives. Use a reviewed allowlist, not blanket ignores.

**Difficulty.** M.

---

### G2. Keep compatibility mutations documented and dated

**What.** Add deprecation comments and a removal release/date for
`activities:removeCascade` and `routines:removeCascade`; label their Convex tests
as compatibility coverage. Remove in a later release only after the stale-client
window is closed.

**Original plan.** Full agreement with F6.

**Evidence.** No current client calls them; the overhaul deviation log says they
remain for older clients.

**Benefit.** Makes intentionally retained code distinguishable from dead code.

**Risk.** Low.

**Difficulty.** S.

---

### G3. Treat CSS custom properties as a maintainability companion, not a speed project

**What.** If B5’s keyed patching lands, set a validated category colour custom
property on the category group and let descendant cards inherit it. Otherwise,
do not schedule a standalone G2 rewrite for performance.

**Original plan.** Disagrees with G2’s “defeat CSS caching” rationale. Dynamic
colour still has to enter the DOM somewhere; a custom property mainly reduces
duplication and makes patching consistent.

**Evidence.** Category colours are runtime-editable. Moving the same value from
several child `style` attributes to one parent property is useful, but no
browser measurement shows it is a meaningful hot-path cost.

**Benefit.** Cleaner theme/update behavior if the DOM is already being patched.

**Risk.** Low–Medium.

**Difficulty.** S when folded into B5; otherwise defer.

---

## Category H — Tests and performance evidence

### H1. Fix time determinism with both clock and timezone

**What.**

1. Change the test helper to use the app’s local weekday convention.
2. Set Playwright `timezoneId` explicitly.
3. Freeze Date with `page.clock` before app code runs for date-dependent suites.
4. Add one separate timezone-boundary test that intentionally runs near local
   midnight.

**Original plan.** Agrees with H1 and adds the missing timezone control.

**Evidence.** The exact four failures reproduced at 00:xx BST while UTC was
still on the previous date.

**Benefit.** A trustworthy green baseline at every hour and on every
contributor/CI machine.

**Risk.** Low.

**Difficulty.** S–M.

---

### H2. Commit the synthetic account and performance harness

**What.** Add a deterministic fixture matching the source audit’s 722 KB account
shape and two kinds of tests:

- **work-count tests:** number of notifications, renders, selector recomputes,
  history scans and progress computations;
- **browser traces:** action-to-next-paint and long-task timing under a declared
  CPU throttle.

Store before/after results in this document or a machine-readable benchmark
artifact. Use generous CI budgets for timings and strict assertions for work
counts.

**Original plan.** Missed. Its measurements are excellent but currently
one-off.

**Evidence.** The scratch benchmark is not in the repository, so A1’s expected
speedup cannot be rerun during implementation.

**Benefit.** Prevents the central win from regressing and distinguishes CPU,
DOM, layout and persistence costs.

**Risk.** Medium. Hard wall-clock assertions are noisy; counts and trend
artifacts should carry most of the gate.

**Difficulty.** L.

---

### H3. Parallelise the long tail accurately

**What.** Keep file-level Playwright workers. Split
`program-schedule.spec.js` into independent concern files or mark proven-isolated
describes parallel. Set explicit CI workers/shards based on available cores.
Add a small production-preview project rather than duplicating all 127 tests.

**Original plan.** Corrects H2. The current run already used nine workers; the
problem is the large serial spec and four final timeouts.

**Evidence.** 123 tests completed across workers, then the suite waited on the
last serial program tests. The final hidden-button click alone consumed 30 s.

**Benefit.** Shorter and more predictable feedback without multiplying the
entire suite.

**Risk.** Medium. Splitting can reveal hidden state leakage.

**Difficulty.** M.

---

### H4. Consolidate fixtures and remove fixed sleeps

**What.** Create a shared fitness Playwright fixture for seeding, navigation,
routine/program creation and modal opening. Replace all nine
`waitForTimeout` calls with web-first assertions or explicit events.

**Original plan.** Full agreement with H3/H4.

**Evidence.** Six local `seed()` helpers and nine fixed waits remain.

**Benefit.** Less duplicated refactor work and tests that fail on behavior, not
machine timing.

**Risk.** Low–Medium.

**Difficulty.** M.

---

### H5. Add focus, injection, lifecycle and render-count regressions

**What.** New coverage should include:

- Tab containment and focus restoration for every modal stack depth;
- Enter/Space activation for activity, routine and program cards;
- malicious names/notes/colours rendered as text, not markup;
- repeated navigation with hidden views proving no hidden render;
- one dispatch producing one relevant render;
- multi-activity recording producing one state notification;
- cache invalidation per exact program/stat input;
- lazy-modal failure and offline open.

**Original plan.** Missed as a cohesive verification gate.

**Evidence.** Existing tests are behavior-rich but do not cover these
optimisation invariants.

**Benefit.** Protects the areas most likely to regress during the revised plan.

**Risk.** Low.

**Difficulty.** L across phases.

---

## 10. Recommended sequencing

Ordered to fix unsafe baselines first, then land the measured win, then remove
secondary work. Items within a phase should still be separate, reviewable
commits.

### Phase 0 — make the baseline safe and deterministic

- H1 — fix local/UTC tests; set fixed timezone and clock
- E1/E2 — close HTML/attribute/style injection paths
- B4 — immediate null guard only
- F1 chunk naming portion — make build output legible
- package scripts — stop running migration twice
- stale `.eslintignore` cleanup

*Gate: lint, all Vitest, all Playwright green twice; malicious-content tests
green; current build sizes recorded.*

### Phase 1 — state core, landed in safety-first slices

- A1 step 1 — mutation inventory and development deep-freeze tests
- A1/A2 step 2 — replaceable root and clone-free read/reducer path
- A4 — isolate subscriber errors
- A5 — no-op suppression for device-only date state
- A3 — selector subscription API, initially alongside legacy subscribe
- A6 — collection-identity lookup caches where counts justify them
- migrate Fitness subscriptions, then other views

*Gate: 154+ unit/migration/Convex tests; all e2e; mutation tests; committed
benchmark shows full-state clone count is zero on read and dispatch.*

### Phase 2 — one user action, one state change, one render

- B1 — atomic/batched multi-activity recording
- B2 — remove duplicate render authorities interaction by interaction
- B3 — view activate/deactivate lifecycle, Fitness first then every top-level page
- B4 — finish CSS layout replacement and delete JS listeners/helper
- B6 — one-pass library grouping and measured filter policy

*Gate: render/notification count tests; reload/replay/partial-failure tests for
bulk recording; hidden-view render count stays zero.*

### Phase 3 — derived data

- C1 — exact-input program-progress cache
- C2 — one-snapshot program helpers and remove duplicate open computation
- C3 — shared recorded-history index
- narrow each modal subscription to exact inputs

*Gate: every cache dependency invalidates in isolation; unrelated habit/sync
actions do not recompute fitness progress/stats.*

### Phase 4 — modal lifetime, accessibility and code split

- D1 — central modal manager with focus and semantics
- E3 — native card/button semantics
- D2 — lazy shells plus lazy modal modules
- D3 — shared shell/z-index builder
- D4 — intent prefetch and import-failure UI
- D5 — delete redundant document events, DOM moves and duplicate-id defenses
- F1/F2 — finalise chunk strategy and eliminate ineffective imports
- F3 — PWA offline lazy-chunk smoke and bundle budgets

*Gate: modal screenshot parity; complete keyboard suite; built local smoke;
Pages/service-worker offline lazy-modal smoke.*

### Phase 5 — enforce cleanliness

- G1 — add dead-code tooling and burn down the verified list
- G2 — document/date compatibility mutations
- remove dead timer API and use one interval/tick source
- correct stale overhaul-plan test-file references
- H3/H4 — split long e2e spec, shared fixtures, remove fixed waits
- E4 — replace production globals with a test-only hook

*Gate: lint/dead-code check, all suites, build with no ineffective-import
warnings.*

### Phase 6 — benchmark-gated optional work

- B5 — keyed activity-list reconciliation only if post-A1 browser trace warrants it
- G3 — inherited category custom properties only as part of B5 or a styling need
- vendor/auth/Convex bundle audit as a separate project

*Gate: each optional item must include a before/after browser measurement. “Less
code in a template” is not enough by itself.*

---

## 11. Expected outcome and success criteria

The revised plan is complete when all of the following are true:

- `getState()` and ordinary dispatch do not clone the full account;
- canonical state cannot be mutated through nested reads in development;
- a subscriber exception cannot roll back committed state or desynchronise DOM;
- irrelevant dispatches do not call Fitness renderers or recompute progress;
- hidden top-level views perform no view rendering;
- adding a six-activity routine produces one local state notification and one
  relevant list render;
- program progress and activity statistics recompute only when their exact
  inputs change;
- the activity list has no forced JS height layout;
- Fitness entry code excludes unopened modal implementations;
- every lazy modal works offline in the built PWA;
- modal focus is trapped/restored and every interactive card is keyboard
  operable;
- imported/cloud data cannot inject HTML, attributes or CSS;
- build output has meaningful chunk names and no ineffective-import warnings;
- all unit, migration, Convex and e2e tests pass independent of wall clock and
  machine timezone;
- the synthetic large-account benchmark is committed and records before/after
  work counts and browser timing.

The main performance expectation remains the source plan’s: eliminating
full-state clone-on-read should remove the overwhelming majority of the
fitness page’s measured JavaScript cost on large accounts. The revised plan does
not claim a precise end-to-end speedup until the benchmark is committed and run
in a browser. It does, however, add a structural guarantee the original plan
did not: the worst multi-activity action is reduced from six local state/render
cycles to one.

---

## 12. What this revised plan deliberately does not do

- **No framework migration.** It stays within the vanilla ES2020 module rule.
- **No rewrite of program-progress maths.** The pure algorithm stays protected;
  caching and input assembly change around it.
- **No auth/vendor surgery in the fitness branch.** The 587.96 KB gz chunk
  remains a separately scoped audit.
- **No unconditional virtual-DOM-style reconciler.** DOM diffing must earn its
  complexity with post-A1 browser evidence.
- **No artificial input latency by default.** Filtering remains immediate unless
  measurement proves it cannot fit a frame.
- **No raw state test global in production.** Playwright receives an explicit,
  narrow test hook.
- **No performance claim based solely on source bytes or listener count.** D3,
  D5 and G3 are justified mainly by ownership, correctness or maintainability;
  user-visible speed claims require a browser measurement.

---

## 13. Implementation record — 2026-07-29

### Outcome

The required phases of this revised plan have now been implemented. The two
benchmark-gated options, B5 keyed DOM reconciliation and G3 inherited colour
properties, deliberately did not land: the post-change browser measurements do
not justify their complexity. The separately scoped auth/vendor audit remains
separate exactly as section 12 specifies.

This implementation was checkpointed in small recoverable stages:

1. `608559a3` — state/render architecture, atomic batches, lazy modal boundary,
   sanitisation, bundle budgets and the initial regression harness;
2. `19340116` — data-boundary validation, modal/lifecycle hardening and
   optimisation-invariant browser tests;
3. `728099fc` — Pages-faithful PWA preview and offline lazy-chunk verification;
4. final verification/documentation checkpoint — browser-discovered title
   semantics, Knip gate and recorded measurements.

The source `docs/FITNESS_OPTIMISATION_PLAN.md` was kept untouched throughout.

### Implementation disposition

| Item | Result | Agreement or change from the plan |
| --- | --- | --- |
| A1/A2 | Implemented | Full agreement. `getState()` returns the stable canonical snapshot and dispatch no longer clones the account for ordinary actions. Ownership-boundary imports/hydration are still cloned. |
| A3/A4/A5 | Implemented | Selector subscriptions, equality functions, isolated listener failure and no-op root suppression landed together because they share one notification contract. |
| A6 | Implemented | Activity, category, routine and program indexes are cached by collection identity. Search normalisation is also identity-cached. |
| B1 | Implemented | Multi-activity recording creates one reducer transition and one notification while retaining one durable operation per record. |
| B2 | Implemented | Manual post-dispatch Fitness renders and the redundant custom record/delete events were removed. Active state subscriptions now own rendering. |
| B3 | Implemented and strengthened | Navigation activates/subscribes only the visible page. Small Home/Habits control subscriptions were also lifecycle-bound after the browser invariant exposed them. |
| B4 | Implemented | The Fitness view is a CSS flex/min-height scroll layout. The forced `getBoundingClientRect`/`getComputedStyle` height path and its resize listeners were deleted. |
| B5 | Measured and not implemented | One atomic dispatch produces one activity-list mutation delivery; mobile layout has no overflow. A keyed reconciler has no evidenced benefit yet. |
| B6 | Implemented | Activity grouping is one pass; searchable names are normalised only when activity identity changes. |
| C1/C2 | Implemented | Program progress is memoised by the program object, exact state collections and local day, and all inputs come from one snapshot. |
| C3 | Implemented | One recorded-history index is shared by Fitness statistics and the Stats page and invalidates only when `recordedActivities` identity changes. |
| C4 | Preserved | `plannedSlots` was not micro-optimised. |
| D1 | Implemented | One modal manager owns stack order, scroll lock, dialog semantics, focus entry, Tab containment, Escape ownership and focus restoration. |
| D2 | Implemented | Thirteen Fitness shells remain inert in one `<template>` at startup. A modal module materialises only its own shell on first open. |
| D3 | Implemented with a lower-risk form | The shared manager and markup materialiser standardise layering and semantics without a pixel-risk rewrite of every shell. A hands-on browser pass found styled title `<span>` elements; they are now real `<h2>` labels. |
| D4 | Implemented | Lazy opens expose busy state, coalesce repeated opens, recover from import failure, restore the opener and prefetch on intent while respecting Save-Data/2G. |
| D5 | Implemented | Redundant custom modal events and feature-owned DOM moves were removed. One central body-level repair remains for malformed legacy nesting. |
| E1 | Implemented | User-controlled Fitness text/attributes are escaped or assigned through DOM text APIs. Confirmation-dialog copy is never interpolated as HTML. |
| E2 | Implemented | Colours, icons, tracking type, units, direction, duration, intensity, reps and set values are validated at create/update/import/hydration boundaries with legacy-safe fallbacks. |
| E3 | Implemented | Activity and program cards use native buttons. Routine cards have complete button semantics and Enter/Space handling. Archived activity cards are inert. |
| E4 | Implemented | Production state globals were removed. Development legacy mode exposes only the narrow getter/dispatch `__APP_TEST__` hook. |
| F1/F2 | Implemented | Named chunks follow real dynamic boundaries. All ineffective-import warnings were eliminated. |
| F3 | Implemented | Local/Pages bundle budgets and an offline production-PWA lazy-modal test are committed. |
| F4 | Deferred by design | The 588 KB gzip auth/vendor chunk remains outside this Fitness branch. |
| G1 | Implemented | Dead Fitness APIs, two unreachable repository/update-prompt files, stale lint ignores and 26 unused CSS selectors were removed. `no-unused-vars` is an error and Knip now gates unused files, Fitness exports and dependencies. |
| G2 | Implemented | Legacy Convex remove-cascade mutations are explicitly compatibility-only and dated for removal after 2026-10-29. |
| G3 | Not implemented | B5 did not earn a keyed DOM path, so the companion custom-property rewrite also remains deferred. |
| H1 | Implemented | Playwright uses `Europe/London`; program-date tests freeze local time and use the app’s local weekday convention. |
| H2 | Implemented | A deterministic 0.9 MB work-count fixture and a 4× CPU-throttled browser action-to-second-paint test are committed. The throttle runs in a dedicated one-worker gate so it cannot slow functional pages that share a Chromium process. |
| H3 | Implemented | The independent 700-line program schedule cases run in parallel across existing Playwright workers; the PWA uses a small production-preview project rather than duplicating the suite. |
| H4 | Implemented with a deliberate limit | All fixed sleeps were replaced with web-first conditions. Domain-specific seed helpers remain local because merging unrelated program, routine and record setup into one giant fixture made tests less explicit. |
| H5 | Implemented | Focus stack depth, keyboard cards, injection, inactive lifecycle, single render, atomic notification, cache invalidation, failed lazy import and offline lazy open all have regressions. |

### Measured before and after

The build measurements below are directly comparable local production builds.
The “before” figures are the independently reproduced baseline in section 1;
the “after” figures are the final build with the budget script enabled.

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Fitness core JavaScript, raw | 136.62 KB | 70.25 KB | −48.6% |
| Fitness core JavaScript, gzip | 32.55 KB | 19.59 KB | −39.8% |
| CSS, raw | 83.2 KB | 79.36 KB | −4.6% |
| CSS, gzip | 15.1 KB | 14.40 KB | −4.6% |
| Live Fitness modal shells before first open | 13 | 0 | −100% |
| Total lazy Fitness modal/timer gzip | not split | 24.58 KB | separately cached/on demand |
| Pages precache | no enforced budget | 2,205,774 bytes | below 2.5 MB gate |
| Ineffective dynamic-import warnings | several | 0 | eliminated |

The committed 4× CPU-throttled browser benchmark used a 965,109-byte account
with 100 activities and 3,500 recorded sessions. One observed local run measured:

- 1,000 `getState()` reads: **0.10 ms**;
- one atomic 20-activity dispatch through the second animation frame:
  **42.4 ms**;
- rendered cards: **20**;
- state snapshot identity changes during the 1,000 reads: **0**.

Those wall-clock numbers are recorded as observations, not universal promises.
The CI limits are intentionally generous (50 ms for 1,000 reads and 500 ms for
batch-to-second-paint under 4× throttle); the strict guarantees are snapshot
identity, one notification, one render delivery and 20 resulting cards.

### Browser audit findings

The app was inspected in the in-app Chromium browser at 1280×900 and 375×812,
in addition to Playwright’s mobile/tablet/desktop projects.

**Confirmed.**

- Desktop Fitness keeps its authored width and empty-state hierarchy.
- Mobile `documentElement.scrollWidth` equals the 375 px viewport; the duplicate
  calendar scrollbar found during implementation is gone.
- The Add Activity modal is 343 px wide with 16 px gutters in a 375 px viewport.
- Before any modal opens, all 13 Fitness shells are inert and there are zero
  live Fitness modal shells.
- Opening Activity Library creates only `activity-library-modal`.
- Opening Add Activity above the library yields stack layers 1001/1002,
  `aria-hidden="true"` on the lower layer and focus on
  `cancel-add-activity`.
- Body scroll remains locked until the last stacked modal closes.
- The add menu remains fully on-screen at 375 px and the mobile empty state is
  not clipped.

**Found and fixed during the browser pass.**

1. The calendar host and its inner strip both owned horizontal overflow,
   producing a thick redundant mobile scrollbar. The host now delegates
   scrolling to the strip.
2. Several modal titles were styled spans. They now use `<h2>`, giving the
   dialog manager a deterministic `aria-labelledby` target.
3. Vite preview served a Pages build at `/` while its assets lived under
   `/habits-tracker-pwa/`; every app asset and `registerSW.js` returned 404.
   `preview-pages.mjs` now reproduces the real Pages subpath, allowing the
   service worker and offline test to exercise the actual build.

### Final verification record

| Gate | Result |
| --- | --- |
| ESLint, including unused variables as errors | pass |
| Knip unused files/Fitness exports/dependencies | pass |
| Unit + Convex-behaviour tests | 152/152 pass |
| Migration tests | 19/19 pass |
| Convex TypeScript validation | pass |
| Full Chromium suite, first run | 132/132 pass |
| Full Chromium suite, second run | 132/132 pass |
| Isolated 4× CPU Fitness performance gate | pass |
| Picker title/ARIA regression | 10/10 pass |
| Offline Pages PWA lazy-modal test | pass |
| Local bundle budgets | pass |
| Pages bundle/precache budgets | pass |
| Local production build | pass; zero ineffective-import warnings |

The only remaining build warning is the intentionally deferred auth/vendor
chunk over Vite’s generic 1 MB raw warning threshold. Its measured gzip size is
about 588 KB and remains below the explicit 650 KB guardrail.

### Complications and boundaries

**Knip/TypeScript.** Knip 5 could not be installed because its peer range stops
below this repository’s TypeScript 7. npm correctly rejected it. Knip 6.29.0
supports the repository’s Node/TypeScript toolchain and is the version used by
the final gate; no peer dependency was forced.

**Benchmark isolation.** An initial combined run placed the 4× CPU-throttled
benchmark alongside functional pages. Five otherwise unrelated tests remained
on Home beyond their five-second navigation assertion while the machine was
loaded. The benchmark now has the explicit `test:fitness:perf` single-worker
gate, restores the throttle and detaches its CDP session in `finally`; ordinary
`test:e2e` skips only that diagnostic. This preserves strict functional
timeouts instead of concealing interference by increasing them.

**Dependency audit.** `npm audit --omit=dev` reports 12 moderate transitive
issues through Clerk’s Solana wallet dependency chain. npm offers only a forced
breaking downgrade to Clerk 5, so this Fitness change does not apply it. This is
part of the separate vendor/auth audit, not evidence of a Fitness regression.

**No Convex schema change.** Atomic multi-record UI work still emits the existing
validated `activityRecords:create` operations. The optimisation therefore
needed no new table, index or public Convex mutation, and the full Convex
type/behaviour gates remain green.
