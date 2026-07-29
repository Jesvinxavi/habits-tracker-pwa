# Fitness Feature — Optimisation Plan

**Branch:** `fitness-overhaul-optimisations` (from `claude/fitness-overhaul`, from `develop`)
**Author:** Audit pass, 2026-07-29
**Scope:** The fitness page and everything it touches — the shared state layer, the
modal system, `index.html`, the build config, the CSS and the test suite.
**Status:** **Historical source audit.** It was independently reviewed, revised,
and implemented through
[`FITNESS_OPTIMISATION_AUDIT_AND_REVISED_PLAN.md`](FITNESS_OPTIMISATION_AUDIT_AND_REVISED_PLAN.md).
Proposal wording below is intentionally retained as the pre-implementation
baseline.

---

## 0. How to read this document

Every item is written the same way:

| Field | Meaning |
| --- | --- |
| **What** | The change, concretely, with file paths |
| **Evidence** | What the audit actually found — measured, greped or read |
| **Benefit** | What improves, quantified where it was measured |
| **Risk** | What could break, and how it would show |
| **Difficulty** | S (< 1h) · M (half a day) · L (1–2 days) · XL (multi-day) |

Difficulty is *effort plus verification*, not lines changed. An S-sized item with
an XL-sized blast radius is marked by its risk, not its size.

Items are grouped into categories A–I. **Category A is the whole game** — it
accounts for roughly 95% of the measurable runtime cost on the fitness page, and
several later categories only become worth doing once it lands. Read §10 for the
recommended order.

### Sources used

- `docs/fitness/FITNESS_OVERHAUL_PLAN.md` — the 1,908-line implementation plan, all ten
  phases plus Appendix D's deviation log
- `docs/development/CODING_GUIDELINES.md`, `docs/development/PROJECT_RULES.md`, `docs/architecture/LOADING_PERFORMANCE_AUDIT.md`
- `CHANGELOG.md` `[Unreleased]`
- The four Claude Code sessions the work was done in (`Fitness page overhaul plan`,
  `Fitness page overhaul implementation`, `Local server deployment on port 4180`,
  `Program progress tracking and modal UI`)
- Direct reading of all 41 files under `src/features/fitness/`, plus
  `src/core/state.js`, `src/components/Modal.js`, `src/core/navigation.js`,
  `index.html`, `vite.config.js`
- Measurements taken during the audit (§1)

### What the existing docs do *not* cover

`docs/architecture/LOADING_PERFORMANCE_AUDIT.md` is a **startup** audit — cold boot to a usable
Home screen. It says nothing about runtime cost once the app is running, and the
fitness page was explicitly excluded from it ("Fitness and Statistics remain
navigation-loaded"). No performance work has ever been done on the fitness
feature itself. The session transcripts confirm this: searches for `performance`,
`slow` and `deepClone` across all four threads return only the Lighthouse CI fix
from Phase 10.13, nothing about render cost.

---

## 1. Measured baseline

These numbers were produced during this audit, not estimated. Method: the real
`src/` tree was copied to a scratch directory, `getState()` was wrapped in a call
counter, and the real modules were driven against a synthetic but realistic
account.

**Test account shape** (a plausible two-year user): 40 habits × 730 days of
completion entries, 60 activities, 12 routines, 500 days of recorded sessions,
one 8-week program with 4 pinned items per week. Serialised state: **722 KB**.

**Machine:** Apple silicon, Node 22, V8. A mid-range Android phone runs this
class of work **4–6× slower**.

| Operation | `getState()` calls | Time |
| --- | ---: | ---: |
| `structuredClone(state)` — one `getState()` | 1 | **2.4–2.8 ms** |
| `getRoutineActivities(routine)` (6 activities) | 7 | **17.6 ms** |
| `getProgramProgress(program)` — one program tile | 9 | **23.4 ms** |
| `renderActivitiesList()` — 6 recorded cards | 33 | **79.9 ms** |

**Composite:** `FitnessModule`'s state subscription (`FitnessModule.js:185`) runs
`renderActivitiesList()` **and** `renderProgramTile()` on **every dispatch
anywhere in the app**. That is **42 `getState()` calls ≈ 100 ms per dispatch** on
this machine, **400–600 ms on a phone** — and it fires whether or not the fitness
tab is even visible.

**Worst realistic case:** adding a 6-activity routine to a day.
`recordActivitiesForDate` (`activities.js:90–97`) awaits each `recordActivity`
sequentially, so it dispatches **six** times. Six full fitness re-renders:
**~600 ms desktop, 2–3 s on a phone**, for one button tap.

**Other baseline figures:**

| Metric | Value |
| --- | ---: |
| `index.html` total | 110,042 B (13.4 KB gz) |
| — of which fitness modal markup (lines 755–1351) | **50,718 B — 46%** |
| Fitness JS chunk (`chunk-CPQo1Qm9.js`) | 136.6 KB raw / 32.6 KB gz |
| Vendor chunk (Clerk + Convex, `chunk-DZ6Z77G-.js`) | 1,599 KB raw / **588 KB gz** |
| CSS bundle | 83.2 KB raw / 15.1 KB gz |
| Unit + migration + convex tests | 154 passing, 1.9 s |
| Playwright suite | **123 passing, 4 failing**, 2.0 min |
| Lint | clean, 0 warnings |

---

## Category A — The state layer

> The single largest cost in the application, by an order of magnitude. Every
> other runtime optimisation in this document is rounding error next to A1.

### A1. `getState()` deep-clones the entire application state on every call

**What.** `src/core/state.js:62–64`:

```js
export function getState() {
  return deepClone(_appData);   // deepClone === structuredClone
}
```

Replace this with a read path that does not copy. Two viable designs:

1. **Frozen live reference (recommended).** Return `_appData` directly. Enforce
   immutability with `Object.freeze` in development only (a `import.meta.env.DEV`
   guard), so the "never mutate `appData` directly" rule from the overhaul plan's
   §0 is still enforced where it matters — at authoring time — without paying for
   it in production. Reducers already build new objects via spread, so nothing
   depends on the clone.
2. **Copy-on-read per slice.** Add `getSlice('activities')` returning a cached,
   invalidated-on-dispatch shallow copy. More code, keeps a copy boundary, but
   still O(slice) rather than O(whole state).

**Evidence.** 185 `getState()` call sites across `src/`, 37 of them inside
`src/features/fitness/`. Measured at 2.4–2.8 ms each on a 722 KB state. Several
call sites are inside loops — `getRoutineActivities()` (`routines.js:82–88`)
calls `getActivity()` once per activity id, and `getActivity()`
(`activities.js:186–188`) calls `getState()` then `.find()`. Six activities = six
full clones of the whole account.

**Benefit.** Removes essentially all of the 100 ms-per-dispatch cost. The
measured breakdown shows the clones *are* the cost: 33 × 2.4 ms = 79 ms out of
a measured 79.9 ms for `renderActivitiesList`. Every screen in the app gets
faster, not just fitness. This alone would take the routine-add case from
~600 ms to under 20 ms.

**Risk.** **High — this is the riskiest change in the document.** Somewhere in
185 call sites there may be code that mutates the object it got back from
`getState()` and relies on that mutation being discarded. Such code would start
corrupting real state silently. Mitigations, in order:
- Land `Object.freeze` in dev **first**, as its own commit, and run the entire
  unit + e2e suite. Any offending mutation throws in strict mode (all ES modules
  are strict), so it surfaces loudly rather than silently.
- Grep for the shapes that matter: `getState().x.push(`, `getState().x.sort(`,
  `getState().x[` on the left of `=`, and `Object.assign(getState()`.
  (`programs.js:234` and `routines.js:61–63` already defend against this by
  copying before sorting — `[...getState().programs].sort(...)` — which is
  evidence the hazard is understood.)
- Only then flip the clone off.

**Difficulty.** M to write, L to verify properly. Do not rush the verification.

---

### A2. No memoised lookup indexes — every `getActivity`/`getRoutine` is a linear scan

**What.** Add an id→entity index rebuilt on dispatch (or lazily, keyed off a
state version counter bumped in `notify()`):

```js
// src/core/state.js
let _version = 0;
export function stateVersion() { return _version; }
// notify() → _version += 1
```

Then in `activities.js` / `routines.js` / `programs.js`, memoise:

```js
let _cache = { version: -1, byId: null };
export function getActivity(activityId) {
  if (_cache.version !== stateVersion()) {
    _cache = { version: stateVersion(), byId: new Map(getState().activities.map((a) => [a.id, a])) };
  }
  return _cache.byId.get(activityId);
}
```

**Evidence.** `getActivity` (`activities.js:186`), `getActivityCategory`
(`activities.js:179`), `getRoutine` (`routines.js:71`), `getProgram`
(`programs.js:242`), `getActiveProgram` (`programs.js:250`) are all
`getState().<collection>.find(...)`. `recordActivityView()` (`activities.js:245`)
calls `getActivity` once per rendered card; `ActivityCard.bindEvents`
(`ActivityCard.js:94`) calls it *again* per card; `archivedFromMap()`
(`programs.js:105–112`) walks routines and activities together on every progress
computation.

**Benefit.** After A1 the clone cost is gone but the O(n) scans remain. With 60
activities and 6 cards that is 720 comparisons per render — small, but it
compounds inside `plannedSlots()` where lookups happen per slot per week.
Together with A1 this makes a fitness re-render effectively free.

**Risk.** Low. Stale-cache bugs if `notify()` is bypassed. `notify()` is the only
path that mutates `_appData` after a reducer runs (`state.js:387–390`), and
`stateHydration` goes through `dispatch`, so the invariant holds — but write a
unit test asserting the index invalidates after `dispatch`.

**Difficulty.** M.

---

### A3. `dispatch()` deep-clones state a second time, for `prevState`

**What.** `state.js:353` — `const prevState = deepClone(_appData);` runs on
**every** dispatch, including non-persistent ones. It exists so
`persistStateAction(action, prevState)` can shape a Convex record from the
pre-action state, and so the `catch` at `state.js:392–397` can roll back.

Narrow it: only clone when the action is actually persistent and actually needs
the previous state; use a shallow copy for the rollback path (`Object.assign`
already only restores top-level keys, so a shallow copy is sufficient for what
the rollback actually does).

**Evidence.** `state.js:353`. Adds another 2.4–2.8 ms to *every* dispatch on the
measured account — on top of everything the listeners then do.

**Risk.** Medium. The rollback path is a correctness backstop; getting it wrong
turns a recoverable write failure into corrupt state. Read
`persistenceRouter.js` carefully first — `SET_ACTIVE_PROGRAM`
(`persistenceRouter.js:659` region) genuinely diffs against `prevState` to decide
which programs changed their `active` flag.

**Difficulty.** M.

---

### A4. One global listener set — no subscription granularity

**What.** `state.js:67–76`: a single `Set` of callbacks, all invoked on every
dispatch with no information about what changed. Introduce either:

- **Selector subscriptions:** `subscribe(selector, fn)` where `fn` runs only when
  `selector(state)` changes by reference. Cheap to add given collections are
  replaced wholesale by the reducer.
- **Or, minimally, an action-type hint:** `notify(action)` → listeners receive the
  action and self-filter. Far less invasive, and enough for every case in fitness.

**Evidence.** `state.js:74–76`. Every one of the seven `subscribe()` call sites in
fitness (`FitnessModule.js:185`, `ActivityLibraryModal.js:57`,
`ActivityInfoModal.js:46`, `ProgramDetailsModal.js:85`) re-renders unconditionally.
Toggling a habit on Home re-renders the fitness activity list, the program tile,
and any open fitness modal.

**Benefit.** Removes whole classes of wasted work rather than making each unit
cheaper. Complements A1 — after A1 the waste is cheap, but it is still waste, and
it still causes DOM churn (see B1, B4).

**Risk.** Medium. A too-narrow selector means a stale screen — the worst kind of
bug because it is intermittent and looks like a sync problem. Start with the
action-hint variant, which can only make things *more* correct than today.

**Difficulty.** L.

---

## Category B — The fitness page render path

### B1. The fitness subscription runs while the page is not visible

**What.** `FitnessModule.js:185–201` subscribes once, for the lifetime of the
page, and never checks whether `#fitness-view` is the active view. Gate it:

```js
let _dirty = false;
subscribe(() => {
  if (!document.getElementById('fitness-view')?.classList.contains('active-view')) {
    _dirty = true;
    return;
  }
  renderAll();
});
// on navigation back to fitness: if (_dirty) { _dirty = false; renderAll(); }
```

`navigation.js:184–190` already has a fitness-specific "view became active" hook
to hang this off.

**Evidence.** Verified: `navigation.js:50–54` initialises `FitnessModule` on first
visit only, but once initialised the subscription is permanent and
unconditional. `prefetchModule('fitness')` (`navigation.js:247–251`) only
downloads code, so the cost begins the first time the user opens the Fitness tab
and never stops.

**Benefit.** After the user has visited Fitness once, every habit toggle,
skip, holiday change and sync event on Home currently pays ~100 ms of fitness
rendering for a page nobody is looking at. This removes 100% of that.

**Risk.** Low–Medium. If the "became visible" re-render is missed, the user
returns to a stale list. Covered by an e2e test: record on Home-adjacent flows,
switch to Fitness, assert the list is current.

**Difficulty.** S.

---

### B2. `renderActivitiesList()` rebuilds the entire list via `innerHTML` on every change

**What.** `ActivitiesList.js:99` sets `activitiesContainer.innerHTML = html` for
the whole day, then `CategoryGroup.bindEvents` re-attaches swipe handlers to
every card (`ActivityCard.js:73–107`, one `makeCardSwipable` per card). Move to
keyed reconciliation: give each `.swipe-container` its `data-record-id` (it
already has one), diff against the existing DOM, and only add/remove/patch what
changed.

**Evidence.** `ActivitiesList.js:36–114`. Every re-render destroys and rebuilds
every card, discarding in-progress swipe gestures and any focus. `makeCardSwipable`
attaches pointer/touch listeners per card, so N cards = N listener sets recreated
per dispatch.

**Benefit.** Removes DOM churn that A1 does not touch. Fixes the latent
interaction bug where a swipe in progress is destroyed by an unrelated state
change. Meaningful on days with many recorded sessions.

**Risk.** Medium. Reconciliation is where subtle "the wrong card got deleted"
bugs live. The existing e2e coverage
(`recorded-card-metrics.spec.js`, `record-modal.spec.js`) helps but is not
sufficient — add tests for delete-while-list-updates and swipe-during-sync.

**Difficulty.** L.

---

### B3. Layout thrash on every render: `adjustActivitiesContainerHeight()`

**What.** `helpers/fitnessLayout.js:10–29` runs `getBoundingClientRect()` **and**
`getComputedStyle()`, forcing a synchronous layout, and it is called at the end
of every `renderActivitiesList()` (`ActivitiesList.js:113`) plus on every
`resize` and `orientationchange` (`FitnessView.js:104–118`, undebounced).

Replace the whole function with CSS. The container is inside a flex column; a
`min-height: 0` on the flex parent plus `flex: 1 1 auto; overflow-y: auto` on
`#activities-list` gives the same result with zero JS and zero forced layout.

**Evidence.** `fitnessLayout.js:10–29`; call sites at `ActivitiesList.js:113`,
`FitnessView.js:108,114`.

**Also a real bug.** Line 18 is unguarded:

```js
const content = document.querySelector('#fitness-view').closest('.content-area');
```

If `#fitness-view` is absent this throws `TypeError: Cannot read properties of
null`. This was reproduced during the audit — it is what made the first
`renderActivitiesList` benchmark crash. Today it is masked because the view is
created by `navigation.js:19–28` before the module loads, but it is one refactor
away from being a hard crash on the fitness page.

**Benefit.** Removes a forced synchronous layout from the hot render path and
from every resize frame. Deletes a file. Removes a latent null-deref.

**Risk.** Low for the null guard (do it immediately, regardless). Medium for the
CSS replacement — the height behaviour must be checked at 375 px, 768 px and
1280 px in both orientations, and with the iOS keyboard open.

**Difficulty.** S for the guard, M for the CSS replacement.

---

### B4. Fitness modals re-render wholesale on every state change while open

**What.** Three modals subscribe and fully repaint on any dispatch:

| Modal | Subscription | What it rebuilds |
| --- | --- | --- |
| `ActivityLibraryModal` | `:57` | Entire grouped category list via `innerHTML` (`:181`) |
| `ActivityInfoModal` | `:46` | Full repaint incl. the progress chart |
| `ProgramDetailsModal` | `:85` | Full progress recompute + every week pill (`:185`) |

Each is a correct-but-blunt response to a real requirement (the library must show
a newly created activity; the details modal must tick a week when a session
lands). Narrow them with A4's action hints, or at minimum with a shallow
before/after comparison of the specific slice each one reads.

**Evidence.** `ActivityLibraryModal.js:56–60`, `ActivityInfoModal.js:45–49`,
`ProgramDetailsModal.js:84–88`. Note `ProgramDetailsModal._render()` calls
`getProgramProgress()` (`:120`) — measured at 23.4 ms — and then
`programItemPresentation()` per slot per visible week, each of which calls
`getActivity`/`getRoutine` (`programItems.js:27,38`). An 8-week block with
4 slots/week is 32 more `getState()` calls on top.

**Benefit.** Typing in the Activity Library filter currently triggers a full
rebuild per keystroke (`ActivityLibraryModal.js:235–239`, no debounce) *and* any
concurrent dispatch triggers another. This makes the library feel responsive on a
phone.

**Risk.** Medium. Under-narrowing gives stale modals. The overhaul plan's
verification steps explicitly tested "a newly created activity appears
immediately" (Phase 3 verification) and "a recorded day ticking without reopening
the modal" (Phase 10 verification) — both must still pass.

**Difficulty.** M (depends on A4 for the clean version; a slice-comparison
version is independent and M-sized).

---

### B5. Debounce the Activity Library filter input

**What.** `ActivityLibraryModal.js:235–239` re-renders the full list on every
`input` event. Wrap in the existing `debounce` helper from
`src/shared/common.js` at ~120 ms, and keep the clear-button toggle immediate so
the UI still feels instant.

**Evidence.** `ActivityLibraryModal.js:233–251`. `_render()` calls
`searchActivities()` → `listActivities()` → `getState()` (clone) → filter, then
rebuilds `innerHTML` and rebinds three handler sets (`:190–201`).

**Benefit.** Typing a 10-character query goes from 10 full rebuilds to 1–2.

**Risk.** Low. A debounce that is too long makes typing feel laggy; 120 ms is
below the perceptual threshold for this kind of list.

**Difficulty.** S.

---

### B6. Duplicated render callbacks and a passthrough wrapper in `FitnessModule`

**What.** The identical 6-line closure

```js
(activityId, record) => { if (record) Modals.openActivityDetailsWithRecord(activityId, record);
                          else handleActivityClick(activityId); }
```

appears **four** times: `FitnessModule.js:167–173`, `:186–192`, `:204–210`,
`:223–229`. Extract it once. `handleActivityClick` (`:24–26`) is itself a
one-line passthrough to `Modals.openActivityDetails` — inline it.

Also collapse the three separate render triggers into one `renderAll()`: the
`subscribe` callback (`:185`), the initial render (`:204`) and the
`ActivityRecorded` document listener (`:222–230`). The last one is **pure
duplication** — `recordActivitiesForDate` dispatches (which notifies) *and* fires
`ActivityRecorded` (`activities.js:110`), so recording currently renders twice.

**Evidence.** Read directly, line numbers above.

**Benefit.** ~40 lines removed, one render path instead of three, and one
duplicate render eliminated per recording action.

**Risk.** Low.

**Difficulty.** S.

---

### B7. `FitnessView.updateRestToggle()` dynamically imports on every call

**What.** `FitnessView.js:79–83` does `import('./RestToggle.js').then(...)` every
time the rest toggle needs updating. `RestToggle.js` is already statically
imported into the same chunk by `mount()` (`FitnessView.js:53`). Make it a static
import.

**Evidence.** `FitnessView.js:53` and `:80`. The bundler confirms this class of
problem — `npm run build:local` emits four `INEFFECTIVE_DYNAMIC_IMPORT` warnings
(see E4).

**Benefit.** Removes a promise hop from the date-change path, making the rest
toggle update in the same frame as the calendar rather than a microtask later.

**Risk.** Low. The dynamic import may have been avoiding a circular dependency —
check `RestToggle.js` → `ActivityList/ActivitiesList.js` → back. If a cycle
exists, resolve it by moving `renderActivitiesList` behind a small event instead.

**Difficulty.** S.

---

## Category C — Program progress computation

### C1. `getProgramProgress()` recomputes the entire block from scratch, every time

**What.** `programs.js:306–326` builds four derived structures
(`getProgramScheduledDays`, `getProgramSchedulePhases`, `routineActivityMap`,
`archivedFromMap`) and hands them to `computeProgramProgress`, which expands
every date in the block into slots (`programProgress.js:269–290`) and runs
`allocateWeek` per week. For an 8-week block that is 56 date iterations plus 8
allocation passes — on every dispatch, via the program tile.

Memoise on a composite key: `{ program.revision, stateVersion() }`. The result is
a pure function of the program plus `recordedActivities`, `restDays`, `routines`
and `activities` — all of which change only through `dispatch`.

**Evidence.** Measured at **23.4 ms / 9 `getState()` calls** on the test account
(§1). Called from `ProgramTile.renderProgramTile()` (`ProgramTile.js:47`) on every
dispatch, from `ProgramDetailsModal._render()` (`:120`) on every dispatch while
open, and **twice** on `ProgramDetailsModal.open()` (`:78` and `:120`).

**Benefit.** After A1 removes the clone cost, this becomes the next largest item
on the fitness page — the slot expansion itself is real work. Memoisation makes
repeat renders free.

**Risk.** Low–Medium. A stale cache shows wrong progress figures, which is
user-visible and undermines trust in the feature. The invalidation key must
include everything the computation reads — note that `archivedFrom` depends on
`activities` *and* `routines`, and `creditFrom` depends on `program.createdAt`.
A plain `stateVersion()` key covers all of it and is the safe choice.

**Difficulty.** M.

---

### C2. `ProgramDetailsModal.open()` computes progress twice

**What.** `ProgramDetailsModal.js:78` calls `getProgramProgress(program)` purely
to read `.week` for `_expandedWeek`, then `_render()` (`:113`) calls it again at
`:120`. Compute once and pass it down.

**Evidence.** Lines above. 23.4 ms wasted on every open of the details modal.

**Benefit.** Halves the cost of opening the program details modal. Free once C1
lands, but worth fixing independently since it is two lines.

**Risk.** None.

**Difficulty.** S.

---

### C3. Redundant `getActiveProgram()` / `getProgram()` walks in the schedule helpers

**What.** `getScheduledRoutineIdsForDate` (`programs.js:391–395`) calls
`scheduledWeekday()`, which itself calls `getActiveProgram()` (`:416`), and then
calls `getActiveProgram()` **again** on line 394 to read `.id`. The same happens in
`getScheduledActivityIdsForDate` (`:403–407`). Each of those then calls
`getRoutineIdsForWeekday`/`getActivityIdsForWeekday`, which call
`getProgramScheduledDays`, which calls `getProgram` — another scan.

`addProgramRoutinesToDate` (`:442–464`) calls both, so one "add today's program"
tap walks the program list six times and the schedule twice.

Have `scheduledWeekday()` return `{ program, weekday }` and thread it through.

**Evidence.** Lines above, read directly.

**Benefit.** Small in absolute terms, but it is on the `+` menu's hot path and
the fix is mechanical.

**Risk.** Low.

**Difficulty.** S.

---

### C4. `plannedSlots()` re-derives `itemsByWeekday` per segment on every call

**What.** `programProgress.js:252–291` rebuilds a `Map` of weekday→items and a
`Map` of routine snapshots for each schedule segment, then iterates every date in
the segment. For a program with `schedulePhases` (the mid-block edit history from
Phase 10.20) this repeats per phase.

This is correct and readable, and it is *pure* — which is exactly why C1's
memoisation is the right fix rather than micro-optimising here. Listed for
completeness: **do not optimise this in isolation.** If C1 lands, this cost is
paid once per state change instead of once per render, which is the right answer.

**Evidence.** `programProgress.js:244–296`.

**Benefit.** N/A standalone.

**Risk.** High if attempted independently — `programProgress.js` is the most
carefully reasoned file in the feature (see the CLAIM_PASSES doc comment at
`:21–31` and the weekly-credit rules from Phase 10.15–10.17) and it carries 53
unit tests in `tests/unit/programProgress.test.js`. Touching its internals for
speed, when the speed problem is upstream, is a bad trade.

**Difficulty.** — (recommend: skip)

---

### C5. `activityStats.js` scans the full record history four times per call

**What.** `helpers/activityStats.js` walks
`Object.values(getState().recordedActivities)` at lines **23, 360, 393 and 432** —
four independent full-history scans, each preceded by its own `getState()` clone.
`ActivityInfoModal` calls into these on every render, and it re-renders on every
dispatch while open (B4).

Build one indexed pass: `recordsByActivityId` derived once per state version,
reused by `calculateActivityStatistics`, `getWeightUnitForActivity`,
`extractDurationProgressionData` and `extractStrengthProgressionData`.

**Evidence.** Line numbers above. On the test account that is 4 × 500 days ×
3 records = 6,000 iterations plus ~11 ms of cloning, per render.

**Benefit.** Makes the Activity Details modal and the Statistics modal open
instantly on large accounts instead of visibly hitching.

**Risk.** Low. These are read-only derivations with existing behaviour pinned by
`record-modal.spec.js` (Best/Last figures) and the `betterDirection` rules from
Phase 9.21.

**Difficulty.** M.

---

## Category D — Modal architecture and DOM weight

### D1. 50 KB of fitness modal markup is parsed into live DOM on every page load

**What.** `index.html` is 110,042 bytes. Lines **755–1351 — 50,718 bytes, 46% of
the file** — are the eleven fitness modals (`activity-library-modal`,
`routines-modal`, `routine-builder-modal`, `activity-picker-modal`,
`routine-picker-modal`, `program-details-modal`, `program-builder-modal`,
`activity-info-modal`, `add-activity-modal`, `activity-details-modal`,
`timer-modal`). Every visitor parses and instantiates all of it, including users
who never open the Fitness tab.

Move each modal's shell into its own module and inject it on first open. **The
pattern already exists and works** — `StatsModal._createModal()`
(`StatsModal.js:38–77`) builds its markup as a template string and
`insertAdjacentHTML`s it into `document.body`, removing any previous instance
first. Apply that to the other ten.

**Evidence.** Byte counts measured directly. Node counts: 284 `<div>`, 83
`<button>`, 80 `<span>` in `index.html`.

**Benefit.** ~46% smaller HTML document (~6 KB gzipped saved on the wire, but the
real win is parse time and retained DOM). Removes ~200 elements from the
document for Home-only sessions. Directly extends the work already done in
`docs/architecture/LOADING_PERFORMANCE_AUDIT.md`, which got startup to ~0.70 s — this is the
next lever on that path.

**Risk.** Medium. Ten modals × `_bindStaticHandlers` guarded by
`modal.dataset.listenerAttached` — that guard becomes wrong once the element is
recreated, because a fresh element has no dataset flag but the *module* may
already hold `document`-level listeners (see D3). Do D3 first, or do them
together. Also: `Modal.openModal()` currently does
`document.querySelectorAll('#' + id)` and takes the **last** match
(`Modal.js:12–13`) — a defence against exactly the duplicate-id hazard this
change would multiply. Every migrated modal must remove-then-insert as
`StatsModal` does.

**Difficulty.** L.

---

### D2. Modal shell markup is copy-pasted 17 times

**What.** In `index.html`, the overlay class string
(`modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm …`) appears **17**
times, the content shell (`modal-content glass dark:glass-dark rounded-2xl …`)
**16** times, and the scrollable-body string **17** times — each 200–300
characters. `docs/fitness/FITNESS_OVERHAUL_PLAN.md` §1.3 explicitly mandated this
duplication as an "aesthetic contract".

Once D1 moves modals into JS, replace the copies with a builder:

```js
buildModalShell({ id, z, header, body })
```

**Evidence.** Counts measured with `grep -c` against `index.html`.

**Benefit.** The aesthetic contract becomes a function instead of a convention,
so it cannot drift. Removes several KB of repeated strings. Makes the z-index
ladder (`FITNESS_OVERHAUL_PLAN.md` §1.3) a single table in code rather than 17
hand-written `z-[…]` values.

**Risk.** Low–Medium once D1 has landed; the aesthetic must be pixel-identical.
Compare screenshots per modal.

**Difficulty.** M (blocked on D1).

---

### D3. Eight permanent `document` keydown listeners, one per fitness modal

**What.** Every fitness modal attaches its own `document` `keydown` handler for
Escape and self-filters with `topModalId() !== MODAL_ID`:

`ActivityLibraryModal.js:287`, `RoutinesModal.js:176`,
`RoutineBuilderModal.js:293`, `RoutinePickerModal.js:207`,
`ActivityPickerModal.js:205`, `ActivityInfoModal.js:160`,
`ProgramBuilderModal.js:705`, `ProgramDetailsModal.js:528`,
`StatsModal.js:106`, plus `Timer/TimerModal.js:153`. `AddMenu.js:186,192` adds a
`document` click **and** keydown handler. `ProgramBuilderModal.js:137–138` adds
two more in the **capture** phase.

Replace with one dispatcher in `Modal.js`: modals register
`onEscape(id, handler)`, and `Modal.js` runs only the handler for `topModalId()`.

**Evidence.** Grep, listed above. Every keystroke anywhere in the app currently
runs 10+ handler functions that immediately return.

**Benefit.** Removes ~120 lines of near-identical code. Removes 10 handlers from
every key event. Makes D1 safe (module-level listeners stop being tied to element
lifetime). Makes the "Escape closes only the topmost modal" rule — a Phase 4.8
requirement — enforced in one place rather than asserted ten times.

**Risk.** Low–Medium. The Escape behaviours are *not* uniform:
`ActivityLibraryModal` clears the filter first and only closes on a second press
(`:290–297`); `ProgramDetailsModal` flushes pending notes on close (`:98`). The
registration API must let each modal keep its own behaviour.

**Difficulty.** M.

---

### D4. The `modalClosed` / `ActivityDeleted` refresh listeners are duplicated

**What.** `ActivityLibraryModal.js:278–284` and `ActivityInfoModal.js:168–176`
both listen on `document` for `modalClosed` and `ActivityDeleted` and call
`refresh()`. Once A4/B4 give modals a proper subscription, both are redundant —
a create or delete is a dispatch, and the state subscription already covers it.

**Evidence.** Lines above. `closeModal` (`Modal.js:47–50`) fires `modalClosed`
unconditionally, so both handlers run on *every* modal close in the app.

**Benefit.** Removes two more global listeners and two redundant render paths.

**Risk.** Low, but only *after* B4 — removing them first would break the Phase 3
requirement that a new activity appears in the library immediately.

**Difficulty.** S (blocked on B4).

---

### D5. `openModal()` moves the modal element to `<body>` on every open

**What.** `Modal.js:26–29` re-parents the modal to `document.body` if it is not
already there. Combined with `querySelectorAll('#' + id)` taking the last match
(`:12–13`), this is defensive scaffolding around duplicate ids. After D1, the
duplicate-id hazard is handled at insertion time and both hacks can go.

**Evidence.** `Modal.js:11–30`.

**Benefit.** Removes a DOM move (and its layout invalidation) from every modal
open. Removes a `querySelectorAll` in favour of `getElementById`.

**Risk.** Low, after D1. Before D1, removing the `querySelectorAll` hack could
break `StatsModal` if its remove-first ever fails.

**Difficulty.** S (blocked on D1).

---

### D6. `FitnessModals` eagerly imports all eleven modal modules

**What.** `FitnessModals.js:2–12` statically imports every modal. `FitnessModule`
statically imports `FitnessModals`. So opening the Fitness tab downloads and
evaluates `ProgramBuilderModal` (28 KB), `AddEditActivityModal` (28 KB),
`ProgramDetailsModal` (24 KB) and `ActivityDetailsModal` (24 KB) whether or not
the user opens any of them.

Make each facade method lazy:

```js
async openProgramBuilder(options) {
  const { ProgramBuilderModal } = await import('./Modals/ProgramBuilderModal.js');
  ProgramBuilderModal.openCreateMode(options);
},
```

**Evidence.** `FitnessModals.js:2–12`. Source sizes measured with `du -k`. The
built fitness chunk is a single 136.6 KB / 32.6 KB gz blob (see E1) — the
`manualChunks` split into `fitness-modals` and `fitness-core` in
`vite.config.js` does **not** take effect, precisely because of this static
import graph.

**Benefit.** Splits the fitness chunk roughly in half. First paint of the fitness
page stops waiting on ~104 KB of modal code that most sessions never open. This
is the change that makes the existing `manualChunks` config actually do what it
says.

**Risk.** Low–Medium. Every facade method becomes async, so callers that relied
on synchronous opening need `await`/`void`. `AddMenu.activate()`
(`AddMenu.js:129–135`) already fires and forgets, so it is fine. Watch for
`ProgramTile.js:79` (`openDetails`) and `RoutinesModal`'s edit path. There is
also a real UX risk: a modal that opens one network round-trip later feels
broken on a slow connection — pair with a `<link rel="modulepreload">` or an
idle-time prefetch, mirroring `navigation.js:291–308`.

**Difficulty.** M.

---

## Category E — Bundle and build

### E1. The `manualChunks` fitness split does not produce two chunks

**What.** `vite.config.js` routes `/src/features/fitness/Modals/` to
`fitness-modals` and the rest of `/src/features/fitness/` to `fitness-core`. The
build produces **one** chunk containing both.

Verified: `dist/assets/chunk-CPQo1Qm9.js` (136.62 KB) contains
`program-builder-modal` **and** `routine-picker` **and** `activities-list`
**and** `swipe-container` — i.e. Modals and core together.

Fix by breaking the static import graph (D6). Also consider whether the
hand-written `manualChunks` is earning its keep at all now that Vite 8 / Rolldown
does automatic chunking — the config predates the fitness work.

**Evidence.** `npm run build:local` output plus marker-string grep across
`dist/assets/*.js`.

**Benefit.** Makes the declared code-splitting real.

**Risk.** Low.

**Difficulty.** S (given D6).

---

### E2. `chunkFileNames` throws away every manual chunk's name

**What.** `vite.config.js` `chunkFileNames` derives the name from
`chunkInfo.facadeModuleId`, falling back to the literal string `'chunk'`. Manual
chunks have **no facade module**, so every one of them is emitted as
`chunk-<hash>.js`. The build output confirms it: eight files named `chunk-*`, and
none named `fitness-core`, `fitness-modals`, `habits-core`, `utils` or
`components`.

Use `chunkInfo.name` first, falling back to the facade:

```js
chunkFileNames: (info) => `assets/${info.name || 'chunk'}-[hash].js`,
```

**Evidence.** `dist/assets/` listing after `npm run build:local`.

**Benefit.** Purely diagnostic, but it is the reason nobody noticed E1. Named
chunks make `npm run analyze` and the Network panel legible, and make regressions
in chunking visible in review.

**Risk.** None.

**Difficulty.** S.

---

### E3. The vendor chunk is 1.6 MB raw / 588 KB gzipped

**What.** `dist/assets/chunk-DZ6Z77G-.js` is 1,599 KB raw, **588 KB gzipped** —
Clerk plus Convex. It trips Vite's own `chunkSizeWarningLimit`.

This is outside the fitness feature but it dominates the network cost of every
session, and `docs/architecture/LOADING_PERFORMANCE_AUDIT.md` already did one pass here
(splitting Clerk core from the Clerk component UI, cutting the precache from
3.95 MiB to 2.05 MiB). Worth a second pass: split Convex's client from Clerk's so
the offline/cached path does not need both, and check whether
`@clerk/clerk-js`'s headless build is viable.

**Evidence.** Build output; `grep` confirms both `clerk` and `convex` markers in
that one chunk.

**Benefit.** Potentially the largest single wire-size win available in the repo —
larger than everything in Category D combined.

**Risk.** High. Touching the auth bundle risks the signed-in fast path that the
loading audit worked hard to establish (`cloudBootstrap.js`, the offline lease,
the confirmed-cache gate). Treat as its own project with its own audit, not as
part of the fitness optimisation.

**Difficulty.** XL. **Recommend deferring**; listed because the audit found it
and it would be dishonest to leave a 588 KB chunk out of a bundle-size section.

---

### E4. Four `INEFFECTIVE_DYNAMIC_IMPORT` warnings from the build

**What.** `npm run build:local` reports four modules that are dynamically
imported somewhere and statically imported elsewhere, so the dynamic import buys
nothing and only adds a promise hop:

| Module | Ineffective dynamic import at |
| --- | --- |
| `src/shared/loader.js` | `src/main.js` (also static in `index.html`) |
| `src/shared/datetime.js` | `activities.js:13`, `ActivityDetailsModal.js`, `hh-calendar.js`, `navigation.js:157,164` |
| `src/features/fitness/FitnessModals.js` | `ActivityDetailsModal.js`, `ActivityLibraryModal.js:268` |
| `src/features/habits/HabitsListModule.js` | `HabitReorderModal.js`, `ui/categories.js` |

The fitness ones are the interesting pair. `activities.js:13` does
`await import('../../shared/datetime.js')` **inside `addActivity()`** — for a
module that `routines.js:3` and `FitnessModals.js:15` already import statically.
`ActivityLibraryModal.js:268` dynamically imports `FitnessModals` inside a click
handler, presumably to dodge a circular import; a small event or an injected
callback would do the same without the hop.

**Evidence.** Verbatim build warnings.

**Benefit.** Removes needless async boundaries from user-visible actions
(creating an activity, tapping "+ New" in the library). Makes the build output
clean, so a *real* ineffective-import regression is visible.

**Risk.** Low, except for the `FitnessModals` one — confirm the circular
dependency it was avoiding before making it static.

**Difficulty.** S.

---

### E5. `npm test` runs the migration suite twice

**What.** `package.json`:

```json
"test": "npm run test:unit && npm run test:migration",
"test:unit": "vitest run",
"test:migration": "vitest run tests/migration"
```

`vitest run` with no path already collects `tests/migration/**` — verified: 21
test files, 154 tests, which is `tests/unit` (16) + `tests/migration` (4) +
`tests/convex` (1). So `npm test` re-runs the four migration files.

**Evidence.** `npm run test:unit` output: `Test Files 21 passed (21)`.

**Benefit.** Trivial time saving locally; but it also means CI's "migration tests
pass" signal is not actually an independent gate, which is a correctness-of-CI
issue. Either scope `test:unit` to `tests/unit` or drop the second invocation.

**Risk.** None.

**Difficulty.** S.

---

## Category F — Dead and ghost code

All items verified by grep across `src/`, `tests/`, `convex/` and `index.html`.

### F1. Two dead legacy-migration functions in `FitnessModule`

**What.** `cleanupFitnessFromHabitsCategories()` (`FitnessModule.js:236–258`) and
`clearExistingActivities()` (`:263–279`), plus their call sites at `:128` and
`:131`. Delete both.

**Evidence.** Both begin `if (isCloudBackend()) return;` — and the app is
cloud-backed (`PROJECT_RULES.md`: "Authoritative persistence: Convex in cloud
mode"). Worse, in the legacy path they are **mutually exclusive**: both guard on
the same `localStorage` key `habitsAppFitnessMigrationV1`, and
`cleanupFitnessFromHabitsCategories` runs first and sets it (`:257`), so
`clearExistingActivities` reads `'true'` at `:265` and returns immediately —
**always**. It has never executed after the first ever launch of the app in
legacy mode. `clearExistingActivities` also carries a hardcoded list of sample
activity names (`:270`) for a sample dataset that no longer exists.

**Benefit.** ~50 lines gone, one `localStorage` key retired, one confusing
"why does fitness rewrite habit categories on init?" question removed
permanently.

**Risk.** Low. Only reachable with `VITE_DATA_BACKEND=legacy`, which is the
Playwright test mode — check that no e2e test depends on the sample-activity
purge. (It does not: the specs seed their own data via `storageSeed.js`.)

**Difficulty.** S.

---

### F2. Dead exports in `timer.js`, and a dead callback mechanism

**What.** In `src/features/fitness/timer.js`:
- `setTimerUpdateCallback()` (`:90–92`) — zero references anywhere
- `initializeTimer()` (`:97–113`) — zero references
- `getElapsedForRecording()` (`:119–121`) — zero references
- consequently `updateCallback` (`:16`) is never assigned, so the
  `if (updateCallback) updateCallback();` branch inside `startTimer`'s interval
  (`:42–44`) is **unreachable**

`TimerModal` runs its own `setInterval` polling `getTimerState()`
(`TimerModal.js:65–66, 83–84`), which is why the callback path was orphaned.
That also means two 1-second intervals run concurrently while the timer is open —
harmless but redundant; consider driving the display from `startTimer`'s tick
instead.

**Evidence.** These were the launcher wiring removed in Phase 2.2 of the overhaul
plan (`ActionButtons.js`'s timer branch and `updateTimerButton`). The plan's
Task 7.1 dead-code sweep greped for `updateTimerButton` and `start-timer-btn` but
not for these three.

**Benefit.** ~35 lines, and removes a misleading "the timer supports an update
callback" API that nothing implements.

**Risk.** Low.

**Difficulty.** S.

---

### F3. `Timer.updateButton()` is an empty function

**What.** `TimerModule.js:12–14`:

```js
updateButton() {
},
```

Zero callers. Another Phase 2.2 leftover. Delete it, and the unused re-export
`export { TimerModal, TimerControls, LapList };` at `TimerModule.js:38` (zero
external references).

**Evidence.** Grep for `updateButton` returns only the definition.

**Benefit.** Removes a no-op that reads as "this is wired up but broken".

**Risk.** None.

**Difficulty.** S.

---

### F4. Genuinely unreferenced fitness exports

Zero references anywhere in `src/`, `tests/` or `index.html`, including inside
their own file:

| Symbol | Location |
| --- | --- |
| `recordRoutineForDate()` | `routines.js:114–116` |
| `getActivitiesListContainer()` | `ActivityList/ActivitiesList.js:120–122` |
| `buildSetPills()` | `helpers/activityPills.js:132–139` |
| `FitnessCalendar.destroy` | `FitnessCalendar.js:25–30` (never called) |

**Benefit.** ~40 lines. `recordRoutineForDate` is particularly worth removing —
it is a single-routine wrapper superseded by the multi-select
`recordRoutinesForDate` in Phase 10.22, and leaving it invites someone to use the
wrong one.

**Risk.** None.

**Difficulty.** S.

---

### F5. Over-exported internals (should be module-private)

Referenced only inside their own file — the `export` keyword is noise and blocks
tree-shaking analysis:

| Symbol | File |
| --- | --- |
| `listActivities` | `activities.js:231` |
| `isArchivedRoutine` | `routines.js:52` |
| `getProgramSchedulePhases` | `programs.js:286` |
| `weekdayOf` | `helpers/programProgress.js:59` |
| `toggleSearchCategory` | `ActivityLibrary/CategorySection.js:109` |
| `formatMuscleName` | `helpers/muscleHelpers.js:12` |
| `ROUTINE_COLOR` | `helpers/programItems.js:15` |
| `isAddMenuOpen`, `toggleAddMenu`, `closeAddMenu`, `unmountAddMenu` | `AddMenu.js:26,46,35,60` |
| `generateAddDetailsPrompt`, `generateSetsPills`, `generateTimePills` | `helpers/activityPills.js:35,50,97` |
| `formatBestSession`, `getWeightUnitForActivity`, `prefersLower`, `extractDurationProgressionData`, `extractStrengthProgressionData`, `generateProgressChartSVG` | `helpers/activityStats.js:307,358,477,388,426,566` |

**Caveat.** Check the unit tests first — several of these (`prefersLower`, the
progression extractors) may be exported deliberately so
`tests/unit/programProgress.test.js` and friends can reach them. Exported-for-test
is a legitimate reason to keep an export; add a `/** @internal exported for tests */`
tag rather than removing it.

**Benefit.** Smaller public surface. Makes the *next* dead-code sweep meaningful —
right now the export list is so noisy that a genuinely dead export hides in it
(which is how F4's four items survived Phase 7.1's sweep).

**Risk.** Low, with the test caveat above.

**Difficulty.** S.

---

### F6. Dead Convex mutations and the tests that cover them

**What.** `convex/routines.ts:22` exports `removeCascade`, and
`convex/activities.ts:42` exports `removeCascade`. Nothing in the client calls
either — Phase 10.25 replaced deletion with archiving
(`archiveActivity` → `Actions.updateActivity(id, { archivedAt })`,
`activities.js:214–216`; `archiveRoutine`, `routines.js:43–45`), and
`ActionTypes.DELETE_ROUTINE` no longer exists at all. `persistenceRouter.js:526`
documents this explicitly.

Appendix D says `activities:removeCascade` is kept "for older clients". That is a
real reason — but it should be **stated in the code**, and it should have an
expiry. Add a deprecation comment naming the date after which it can go, and a
note in `docs/architecture/PERSISTENCE_AUDIT.md`.

`tests/convex/domain.test.js:306` tests `routines.removeCascade` — coverage for a
path no client can reach.

**Benefit.** Either the mutation is a compatibility shim (say so, date it) or it
is dead (remove it and its test). Right now it is neither.

**Risk.** Medium if removed outright — an old client on a stale service worker
could still call it. The service worker is `registerType: 'autoUpdate'`, so the
window is short, but not zero. **Recommendation: document and date it now, remove
it in a later release.**

**Difficulty.** S to document, M to remove safely.

---

### F7. `.eslintignore` references files that do not exist

**What.** `.eslintignore` lists `sw.js` and `debug-test.js`; neither exists in the
repo.

**Benefit.** Trivial, but it is exactly the kind of stale config that makes people
distrust the rest of the file.

**Risk.** None.

**Difficulty.** S.

---

### F8. Enable lint rules that would have caught F1–F5 automatically

**What.** `.eslintrc.json` extends only `eslint:recommended` and sets
`no-unused-vars` to `"warn"`. Nothing detects unused *exports* or unused *files*.
Add:

- `no-unused-vars` → `"error"` (it is currently clean, so this costs nothing)
- `eslint-plugin-unused-imports` for auto-fixable unused imports
- `eslint-plugin-import`'s `import/no-unused-modules` with
  `unusedExports: true`, or a `knip` / `ts-prune`-style check in CI

**Evidence.** Phase 7.1's dead-code sweep was a hand-written list of five `grep`
commands. It found what it looked for and missed everything in F1–F5 — including
two functions that can never execute (F1) and a callback mechanism with no
implementation (F2). A grep list only finds the corpses you already suspect.

**Benefit.** Turns dead-code hygiene from a one-off manual phase into a standing
CI gate. This is the highest-leverage item in Category F because it prevents
recurrence.

**Risk.** Low. Expect a noisy first run; land the config with a baseline
allowlist and burn it down, rather than blocking on a green run.

**Difficulty.** M.

---

## Category G — CSS

### G1. 26 CSS classes with zero usage anywhere

**What.** Defined in `src/styles/components.css` / `src/styles/style.css`, never
referenced in any `.js` or in `index.html`:

```
add-btn              bounce-ios           completed-badge      completed-status
counter-unit         counter-value        dropdown-icon        form-input-base
habit-check          habit-status         habit-tag            habits-icon
modal-button-base    modal-content-base   modal-header-base    modal-overlay-base
placeholder-content  scheduled-tag        scheduled-time       section-header
section-label        skipped-badge        status-badge         status-icons
weekly-label         weekly-progress
```

Note the four `*-base` classes: `modal-overlay-base`, `modal-content-base`,
`modal-header-base`, `modal-button-base`. Someone once built exactly the
abstraction that D2 proposes, and it was never adopted — the modals use the
copy-pasted Tailwind strings instead. Worth reading them before writing D2.

**Evidence.** Extracted all 125 top-level class selectors from both files and
grepped each against `src/features`, `src/components`, `src/shared`, `src/core`
and `index.html`.

**Benefit.** Smaller CSS bundle (83.2 KB raw / 15.1 KB gz today). More
importantly, removes 26 false leads for anyone styling this app.

**Risk.** Low. Verify none is applied dynamically via a template string that the
grep would miss — check for `classList.add('` with computed values first.

**Difficulty.** S.

---

### G2. Inline styles in hot templates defeat CSS caching

**What.** `ActivityCard.build()` (`ActivityCard.js:44–45`) emits
`style="border: 3px solid ${category.color}; background-color: ${hexToRgba(...)}"`
per card, recomputed on every render. `CategoryGroup.build()` does the same
(`:26,55`). `ProgramTile.js` emits six inline `style=` attributes (`:56–73`).

Move the per-category colours to CSS custom properties set once on the container
(`--cat-cardio: #EF4444`), and have the cards reference `var(--cat-…)`.

**Evidence.** Line numbers above. `hexToRgba` runs per card per render.

**Benefit.** Smaller HTML strings, less string concatenation per render, and the
colours become themeable in one place. Modest on its own; a natural companion to
B2's reconciliation, where inline styles are the thing that forces a full
re-render instead of a class swap.

**Risk.** Low–Medium. Category colours are user-editable at runtime
(`CategoryColorPicker`, `Actions.updateActivityCategoryColor`), so the custom
properties must be updated on colour change. The Phase 3 verification item
"editing a category colour updates the header colour and the tile borders without
closing the modal" must still pass.

**Difficulty.** M.

---

## Category H — Tests

### H1. Four e2e tests fail depending on the wall clock and the machine's timezone

**What.** These four currently fail:

```
tests/e2e/fitness/program-schedule.spec.js:630 › the dropdown item records the day's scheduled routines
tests/e2e/fitness/program-schedule.spec.js:647 › a day holding other training still gets its session added
tests/e2e/fitness/program-schedule.spec.js:676 › the details modal adds the current day
tests/e2e/fitness/program-schedule.spec.js:687 › a day pinned to an activity records that activity too
```

**Root cause — diagnosed, not guessed.** `makeTodayProgram()`
(`program-schedule.spec.js:614`) pins the routine to
`await page.evaluate(() => new Date().getUTCDay())` — the **UTC** weekday. The
application schedules by the **local** weekday: `scheduledWeekday()`
(`programs.js:415–427`) resolves the date with `getLocalISODate(new Date())` and
only then anchors it to UTC.

Reproduced during this audit at 00:07 BST on 2026-07-29:

```
local weekday 3 (Wed) | UTC weekday 2 (Tue) | local ISO 2026-07-29 | UTC ISO 2026-07-28
```

So the test pins Tuesday, the app asks for Wednesday, nothing is scheduled, and
`#program-details-add-today-btn` never becomes visible. These tests pass all day
and fail between local midnight and 01:00 in BST — and would fail for a much
wider window for any contributor west of UTC.

**Fix.** Two parts:
1. Change the specs to use the **local** weekday (`new Date().getDay()`), matching
   what the app does.
2. Pin the clock. Playwright supports `page.clock.setFixedTime()`; freeze the
   suite at a known local instant so weekday-dependent tests are deterministic
   everywhere. Do this before any optimisation work, so a red test means "your
   change broke something" rather than "check what time it is".

**Benefit.** A trustworthy baseline. This is a **prerequisite** for the rest of
the plan, not an optimisation.

**Risk.** None — the fix makes the tests match the implementation. Note the
implementation is correct here; only the tests are wrong.

**Difficulty.** S.

---

### H2. The e2e suite takes 2.0 minutes and is not parallelised

**What.** `playwright.config.js` sets no `fullyParallel` and no `workers`, so
tests within a file run serially. `program-schedule.spec.js` alone holds 28 tests
in 699 lines. It also runs against `npm run dev` — the Vite **dev** server — so
every navigation pays on-demand transformation, and the suite never exercises the
production bundle the users actually get.

Enable `fullyParallel: true`, and add a second project that runs the smoke subset
against `npm run preview:local`.

**Evidence.** Measured: 123 passed + 4 failed in 2.0 min wall clock (363 s user
time across workers). Config read directly.

**Benefit.** Faster feedback, and coverage of the built artefact — which matters
here specifically, because Phase 10.13 documents a whole class of bug
(`BUILD_TARGET`, base paths, service worker) that only appears in a build.

**Risk.** Medium. `fullyParallel` will expose any cross-test state leakage
through `localStorage` / IndexedDB. Each spec seeds its own storage, so it should
hold — but expect one or two shakedown runs.

**Difficulty.** M.

---

### H3. `seed()` is copy-pasted across six e2e specs

**What.** Six specs define their own `async function seed(page)`, plus two copies
each of `openFitness`, `openBuilder` and `makeRoutine`. There is a
`tests/helpers/storageSeed.js`, but it only covers *legacy* snapshot seeding — no
shared fixture exists for the fitness domain objects the specs actually build
(activities, routines, programs).

Add `tests/e2e/fixtures/fitness.js` exporting a Playwright fixture:
`{ seededPage, makeRoutine, makeProgram, openFitness }`.

**Evidence.** Counted across `tests/e2e/**/*.spec.js`.

**Benefit.** ~250 lines of duplication removed from 3,000 lines of e2e. More
importantly: when D1 or D6 changes how a modal opens, the fix lands in one
fixture instead of eight specs — which is the difference between the optimisation
work being feasible and being a slog.

**Risk.** Low.

**Difficulty.** M.

---

### H4. Nine `waitForTimeout` calls — fixed sleeps in place of assertions

**What.**

```
regression-outside-fitness.spec.js:72, 95, 101, 167   (500, 500, 400, 300 ms)
fitness/page-shell.spec.js:94                          (400 ms)
fitness/program-tile.spec.js:30, 75                    (900, 700 ms)
fitness/activity-library.spec.js:129, 187              (500, 450 ms)
```

Replace each with a web-first assertion (`expect(locator).toBeVisible()`,
`toHaveText`) or `waitForFunction`.

**Evidence.** Grep, listed above. Total ~4.25 s of unconditional sleeping, and
every one is a latent flake: they were tuned against the *current* render cost.
**Category A and B will change that render cost by an order of magnitude** — some
of these will start passing for the wrong reason, and any that were masking a
race will start failing.

**Benefit.** Faster and, crucially, *honest* tests. Do this alongside A1, not
after.

**Risk.** Low. Some sleeps may be papering over a genuine race; converting them
to assertions is how you find out.

**Difficulty.** M.

---

### H5. Redundant and misaligned test coverage

**What.**

- `tests/convex/domain.test.js:306` covers `routines:removeCascade`, which no
  client calls (F6). Either delete or annotate as a compatibility-shim test.
- `docs/fitness/FITNESS_OVERHAUL_PLAN.md` Appendix A lists
  `tests/e2e/fitness/program-modes.spec.js` as created. It does not exist — it was
  superseded by `program-schedule.spec.js` when Phase 10.3/10.4 removed scheduling
  modes. The appendix should be corrected.
- `tests/unit/programProgress.test.js` is 694 lines / 53 tests for a 506-line
  module. That is not excessive for the most subtle logic in the feature — but it
  is the file most likely to be disturbed by C1's memoisation, so read it before
  touching C1.

**Benefit.** Coverage that means what it says.

**Risk.** Low.

**Difficulty.** S.

---

## Category I — Correctness and robustness found in passing

> Not optimisations. Found while auditing, and cheap to fix while the code is
> already open. Listed so they are not lost.

### I1. No HTML escaping anywhere in the fitness templates

**What.** User-controlled text is interpolated raw into `innerHTML` in at least
20 places. Representative:

| Field | Location |
| --- | --- |
| activity name | `ActivityCard.js:42, 49` |
| record notes | `ActivityCard.js:51` |
| category name | `CategoryGroup.js:29, 58`, `SelectableActivityTile.js:53` |
| program name | `ProgramTile.js:56, 64`, `ProgramBuilderModal.js:596` |
| routine name | `ProgramDetailsModal.js:404` |
| activity name | `RoutineBuilderModal.js:149, 151`, `ProgramDetailsModal.js:388` |

There is no `escapeHtml` helper in `src/shared/common.js` or anywhere else.

**Impact.** An activity named `Bench <b>Press` renders as bold and mangles the
layout; a name containing `"` inside an `aria-label` breaks the attribute
(`ActivityCard.js:42`). Data is per-account so this is not a cross-user attack —
but data arrives via `dataManagement.js` **import**, and an imported file is not
necessarily one the user wrote. Treat it as an input-validation gap, not a
theoretical one.

**Fix.** Add `escapeHtml()` to `src/shared/common.js`; apply at every
interpolation of user text. Where the value goes into an attribute, use
`textContent`/`setAttribute` instead — `ActivityInfoModal.js:93` already does this
correctly and is the model to follow.

**Risk.** Low. Difficulty: **M** (mechanical but touches many files).

---

### I2. `adjustActivitiesContainerHeight()` null-dereferences

Covered under B3. Reproduced during the audit. Worth its own one-line commit
before anything else, independent of the CSS rewrite.

**Difficulty.** S.

---

### I3. `window.fitnessCalendarApi` and `window.appData` are global writes

`FitnessCalendar.js:67` assigns `window.fitnessCalendarApi`; `state.js:57–59`
assigns `window.appData` unconditionally. The latter is documented as "for quick
dev inspection in DevTools" but ships to production, exposing the full account —
including anything an extension or injected script can read — and pinning the
whole state graph against GC.

Gate both behind `import.meta.env.DEV`.

**Caveat.** The **e2e suite depends on `window.appData`** —
`program-schedule.spec.js:627` and many others read it. Keep it available under
the Playwright build (`VITE_DATA_BACKEND=legacy`) or expose a narrow test-only
accessor. Do not break the suite for this.

**Risk.** Medium (test coupling). **Difficulty.** S.

---

## 10. Recommended sequencing

Ordered so each step lands on a trustworthy baseline and nothing later has to be
redone.

**Phase 0 — make the baseline honest** *(do first, no exceptions)*
- H1 — fix the four clock-dependent e2e tests and pin the clock
- B3/I2 — the one-line null guard in `fitnessLayout.js`
- E2 — name the chunks, so E1 is visible
- E5, F7 — trivial config corrections

*Gate: `npm run lint`, `npm test`, `npx playwright test` all green, twice, at
different times of day.*

**Phase 1 — the state layer** *(the whole win lives here)*
- A1 step 1: `Object.freeze` in dev, land alone, run everything
- A1 step 2: remove the clone
- A3 — narrow `dispatch`'s `prevState` clone
- A2 — memoised id indexes
- H4 — convert `waitForTimeout` sleeps to assertions *(do this here: render
  timings change by an order of magnitude in this phase)*

*Gate: re-run the §1 benchmarks and record the new numbers in this document.*

**Phase 2 — stop rendering what nobody is looking at**
- B1 — gate the fitness subscription on view visibility
- B6 — collapse the duplicated render callbacks, drop the double render
- B7 — static import for `RestToggle`
- C2, C3 — the free program-lookup wins
- B5 — debounce the library filter

**Phase 3 — computation and reactivity**
- C1 — memoise `getProgramProgress`
- C5 — index `activityStats`'s history scans
- A4 — subscription granularity
- B4, D4 — narrow the modal subscriptions, then drop the redundant document
  listeners

**Phase 4 — dead code, now that lint can enforce it**
- F8 first — turn on the rules
- F1, F2, F3, F4, F5, F6, G1 — burn down what they find

**Phase 5 — DOM and bundle**
- D3 — one Escape dispatcher *(prerequisite for D1)*
- D1 — move modal markup into modules
- D2, D5 — the shell builder and the `openModal` cleanup
- D6 → E1 — lazy modal facade, which makes the chunk split real
- E4 — the ineffective dynamic imports

**Phase 6 — polish and the long tail**
- B2 — keyed reconciliation for the activity list
- G2 — CSS custom properties for category colours
- I1 — HTML escaping
- H2, H3 — parallel e2e and shared fixtures
- I3 — gate the globals

**Deferred, deliberately**
- C4 — do not micro-optimise `programProgress.js`; C1 solves it upstream
- E3 — the 588 KB vendor chunk is its own project with its own risk profile

---

## 11. What this plan does not do

Stated so the boundaries are explicit:

- **No framework.** `docs/development/PROJECT_RULES.md` fixes the browser UI as vanilla
  ES2020 modules. Everything above works within that. B2's reconciliation is
  hand-written and keyed, not a virtual DOM.
- **No behaviour changes.** Every item preserves what the fitness page does. The
  four e2e failures in H1 are fixed by correcting the *tests*, not the app.
- **No aesthetic changes.** D1 and D2 move markup; they must not move a pixel.
  `FITNESS_OVERHAUL_PLAN.md` §1.3's aesthetic contract still binds.
- **No Convex schema changes.** Fields kept as tombstones (`scheduleMode`,
  `anytimeRoutines`, `programPreload`) stay exactly as they are — Appendix D
  explains why, and that reasoning has not changed.
- **No estimate of total speedup.** §1 gives measured per-operation costs. What
  a user perceives depends on their account size, and the largest measured effect
  (~600 ms → ~20 ms for adding a 6-activity routine) is specific to the 722 KB
  test account described there.
