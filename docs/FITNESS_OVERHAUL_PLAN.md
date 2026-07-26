# Fitness Overhaul — Implementation Plan

**Branch:** `claude/fitness-overhaul`
**Status:** Planning complete — no code written yet
**Author:** Planning pass, 2026-07-26
**Inspiration:** [Spotr](https://www.spotr.fit/) — structured program scheduling, routine-first logging, program progress analytics

---

## 0. How to use this document

This is a **working checklist**. Tick each box as you complete it. Do not skip ahead: every
phase depends on the one before it. Each phase has:

- **Goal** — what the phase achieves and why it exists
- **Context you need** — files, conventions and existing patterns relevant to the phase
- **Tasks** — numbered, step-by-step instructions with exact file paths, IDs and class names
- **Verification** — a checklist that must be 100% green before moving to the next phase

Rules that apply to **every** phase:

- [ ] Follow `docs/CODING_GUIDELINES.md` strictly (vanilla ES2020 modules, `.js` extensions in
      imports, 2-space indent, single quotes, semicolons, JSDoc on every exported function).
- [ ] Never mutate `appData` directly — always `dispatch(Actions.x(...))`.
- [ ] Never write whole-state blobs to `localStorage`. Convex is authoritative; IndexedDB holds
      the confirmed cache + outbox.
- [ ] Aesthetics must not change. Reuse existing Tailwind class strings verbatim (see §1.3).
- [ ] Run `npm run lint` and `npm run test:unit` after every phase.
- [ ] Commit at the end of each phase with a Conventional Commit message
      (e.g. `feat(fitness): add routines data model`).

---

## 1. Decisions, scope and design contract

### 1.1 Confirmed product decisions

| Question | Decision |
| --- | --- |
| Where do programs come from? | **The user builds them.** A Program Builder modal: name, start date, end date, and a weekly schedule assigning saved routines to weekdays. |
| Timer feature | **Kept.** The Timer button leaves the action row; access moves into the new `+` dropdown so nothing is lost. |
| Persistence for routines & programs | **Full Convex pipeline** — new tables, CRUD mutations, sync, offline outbox, hydration, migration and export wiring, identical treatment to `activities`. |
| Where does the program tile live? | **On the fitness page**, directly beneath the two new buttons. Renders **nothing** when no program is active; renders the program tile when a program is active. |
| How is "add a program" reached? | A **fourth item on the `+` dropdown**: *New Program*. |

### 1.2 Feature summary (what the fitness page becomes)

**Removed**
- `New Activity` button
- `Timer` button
- The inline, expanding search bar and its whole expand/collapse/blur machinery

**Added**
- Two action buttons: **Activity** and **Routines** (same pill styling as the buttons they replace)
- **Activity Library modal** — the full categorised activity list that used to live in the search
  panel, plus a plain always-visible filter input (filters in place, no expand animation) and an
  **+ New Activity** button that opens the existing Add Activity modal
- **Routines modal** — list of saved routines, empty state, **+ New Routine** button
- **Routine Builder modal** — name a routine and multi-select activities into it; also used to
  edit an existing routine and to trim the auto-populated "save today's activities" routine
- **`+` pill** beside the existing *Activities* pill, opening a dropdown with four actions:
  1. Add activity to today's activities
  2. Add routine to today's activities
  3. Save recorded activities as a routine
  4. New program
- **Program Builder modal** — name, start date, end date, weekly routine schedule
- **Program tile** on the fitness page — program name, date range (e.g. *20 Oct – 13 Dec*),
  progress bar, current week (*Week 4 of 8*), and workouts completed (*11 of 24 workouts*)

### 1.3 Aesthetic contract (do not deviate)

These strings already exist in the codebase. Copy them exactly.

**Modal overlay** (vary only the `z-[...]` level):
```html
class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-[1001] hidden flex items-center justify-center p-4 animate-in fade-in duration-300"
```

**Modal content shell:**
```html
class="modal-content glass dark:glass-dark rounded-2xl w-full max-w-md mx-auto overflow-hidden max-h-[85vh] shadow-2xl border border-white/20 dark:border-gray-700/50 transform transition-all duration-300 scale-95 opacity-0 modal-animate flex flex-col"
```

**Modal header:**
```html
class="modal-header flex justify-between items-center px-6 py-1 bg-white/90 dark:bg-gray-800/90 border-b border-gray-200/50 dark:border-gray-700/50 flex-shrink-0 rounded-t-2xl backdrop-blur-xl"
```

**Scrollable modal body:**
```html
class="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-500 scrollbar-track-gray-100 dark:scrollbar-track-gray-800"
```

**Header buttons:** Cancel — `px-4 py-2 text-ios-blue hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-lg transition-all duration-200 font-medium`.
Confirm — same plus `opacity-50` while `disabled`.

**Action-row pill button** (used by *Activity* / *Routines*):
```html
class="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-1.5 px-4 rounded-xl font-semibold flex items-center justify-center gap-2"
```

**Grouped form section:** `space-y-3 p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl`
**Text input / select:** `w-full px-4 py-3 bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue/50 focus:border-ios-blue transition-all duration-200 h-12`
**Destructive button:** `w-full py-3 px-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors`
**Dropdown menu** (copy `#dropdown-menu` in `index.html:83`): `absolute ... bg-gray-100 dark:bg-gray-900 rounded-[14px] shadow-lg min-w-max z-50 overflow-hidden hidden p-1` with items `dropdown-item flex items-center h-[36px] gap-2 px-4 py-0 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors text-sm font-medium`

**Modal z-index ladder** (existing values in brackets; new modals slot in without disturbing them):

| Modal | z-index |
| --- | --- |
| `activity-library-modal` (new) | `z-[1001]` |
| `routines-modal` (new) | `z-[1001]` |
| `program-tile` (page element, not a modal) | n/a |
| `add-activity-modal` (existing) | `z-[1002]` |
| `routine-builder-modal` (new) | `z-[1002]` |
| `routine-picker-modal` (new) | `z-[1002]` |
| `program-builder-modal` (new) | `z-[1002]` |
| `activity-details-modal` (existing) | `z-[1003]` |
| `icon-selection-modal` (existing) | `z-[1004]` |
| `global-confirm-modal` (existing) | `z-[1100]` |

### 1.4 Architecture map (what you are touching)

```
src/features/fitness/
├── FitnessModule.js          ← wiring, callbacks, subscriptions
├── FitnessView.js            ← mounts header, action buttons, calendar, rest row, list
├── FitnessModals.js          ← modal facade (add the new modals here)
├── ActivityList/             ← the "recorded today" list (unchanged behaviour)
├── SearchPanel/              ← RENAMED to ActivityLibrary/ in Phase 3
├── Modals/                   ← AddEditActivityModal, ActivityDetailsModal, StatsModal
├── Timer/ + TimerModule.js   ← kept, entry point moves
├── activities.js             ← activity CRUD + queries
├── routines.js               ← NEW (Phase 1)
├── programs.js               ← NEW (Phase 1)
└── helpers/                  ← pills, stats, layout, muscle groups
```

Persistence chain for any new entity type (all six links are mandatory):

```
state.js (ActionTypes/Actions/reducer/initialState)
   → persistenceRouter.js (PERSISTENT_ACTIONS + record shaper + operation case)
      → offlineDb.js (outbox + optimistic cache — generic, no change needed)
         → syncEngine.js (replay — generic, no change needed)
            → convex/<entity>.ts (createCrudMutations) + convex/schema.ts
               → convex/sync.ts + convex/bootstrap.ts + convex/migration.ts + convex/dataTransfer.ts
                  → cloudBootstrap.js + stateHydration.js (back into appData)
```

---

## PHASE 1 — Routines & Programs data layer (end-to-end persistence)

### Goal

Create the `routines` and `programs` entity types and thread them through the **entire**
persistence chain — Convex schema, mutations, sync queries, bootstrap, migration, export,
IndexedDB cache, optimistic outbox, state reducer and hydration — before a single pixel of UI
exists. Doing this first means every later phase can just `dispatch` and trust the data survives
a reload, an offline period and a second device.

At the end of this phase there is **no visible change** in the app, but you can create a routine
from the browser console and see it survive a reload.

### Context you need

- `convex/schema.ts` — `shared` field set and `sharedIndexes()` helper (lines 13–27)
- `convex/lib/domain.ts` — `createCrudMutations()` gives you create/update/remove with
  idempotency, revision checks and conflict results for free
- `convex/activities.ts` — the smallest possible reference implementation of an entity module
- `src/core/persistenceRouter.js` — `activityDefinition()` and the `ADD_ACTIVITY` case are your
  templates
- `src/core/stateHydration.js` — `normalizedToCompatibilityState()` maps `clientId` → `id`
- `src/core/cloudBootstrap.js` — `ENTITY_TYPES`, `emptyCache()`, `mergeCoreIntoCache()`,
  `cacheCore()` all need the new types

### Data shapes

**Routine — in-app shape (`appData.routines`)**
```js
{
  id: 'uuid',                    // clientId
  name: 'Push Day',
  activityIds: ['act-1', 'act-2'],   // ordered, may reference deleted activities
  createdAt: '2026-07-26',           // YYYY-MM-DD
  sortOrder: 0,
  revision: 3,
}
```

**Routine — Convex record**
```ts
routines: sharedIndexes(
  defineTable({
    ...shared,
    name: v.string(),
    activityClientIds: v.array(v.string()),
    createdAtISO: v.string(),
    sortOrder: v.number(),
  }),
).index("by_owner_generation_order", ["ownerKey", "generation", "sortOrder"]),
```

**Program — in-app shape (`appData.programs`)**
```js
{
  id: 'uuid',
  name: 'Autumn Hypertrophy',
  startDate: '2026-10-20',       // YYYY-MM-DD inclusive
  endDate: '2026-12-13',         // YYYY-MM-DD inclusive
  scheduledDays: [               // one entry per training day of the week
    { dayOfWeek: 1, routineId: 'routine-1' },   // 0 = Sunday … 6 = Saturday
    { dayOfWeek: 3, routineId: 'routine-2' },
    { dayOfWeek: 5, routineId: 'routine-1' },
  ],
  active: true,                  // exactly zero or one program may be active
  createdAt: '2026-07-26',
  sortOrder: 0,
  revision: 1,
}
```

**Program — Convex record**
```ts
programs: sharedIndexes(
  defineTable({
    ...shared,
    name: v.string(),
    startDateISO: v.string(),
    endDateISO: v.string(),
    scheduledDays: v.array(
      v.object({ dayOfWeek: v.number(), routineClientId: v.string() }),
    ),
    active: v.boolean(),
    createdAtISO: v.string(),
    sortOrder: v.number(),
  }),
).index("by_owner_generation_start", ["ownerKey", "generation", "startDateISO"]),
```

**Referential integrity decision (important):** deleting an activity does **not** rewrite
routines, and deleting a routine does **not** rewrite programs. Dangling IDs are filtered at
**read time** by the selectors you write in Task 1.9. Rationale: cascading edits across entities
would bump revisions on records the user never touched, producing spurious sync conflicts and
breaking migration checksums. Read-time filtering is deterministic and conflict-free.

### Tasks

#### Convex backend

- [x] **1.1** In `convex/schema.ts`, add the `routines` and `programs` tables exactly as
      specified above. Place them immediately after the `activityRecords` table so related
      tables stay grouped.

- [x] **1.2** Create `convex/routines.ts` modelled on `convex/activities.ts`:
  ```ts
  import { createCrudMutations } from "./lib/domain";
  import { assertNonBlank } from "./lib/validators";

  const crud = createCrudMutations({
    table: "routines",
    entityType: "routines",
    validate: (payload) => {
      assertNonBlank(payload.clientId, "clientId");
      assertNonBlank(payload.name, "name");
      if (!Array.isArray(payload.activityClientIds)) {
        throw new Error("INVALID_ACTIVITY_LIST");
      }
    },
  });

  export const create = crud.create;
  export const update = crud.update;
  export const removeCascade = crud.remove;
  ```
  Do **not** add an `afterDelete` cascade (see the integrity decision above).

- [x] **1.3** Create `convex/programs.ts` the same way, with validation that:
  - `clientId` and `name` are non-blank
  - `startDateISO` and `endDateISO` pass `assertDate` (import from `./lib/validators`)
  - `startDateISO <= endDateISO`, else `throw new Error("INVALID_PROGRAM_RANGE")`
  - `scheduledDays` is an array and every `dayOfWeek` is an integer 0–6, else
    `throw new Error("INVALID_PROGRAM_SCHEDULE")`

- [x] **1.4** Register the new tables in every server-side table list:
  - `convex/sync.ts` → add `"routines"` and `"programs"` to `ENTITY_TABLES`
  - `convex/migration.ts` → add both to the `TABLES` const
  - `convex/dataTransfer.ts` → add both to its `TABLES` const
  - `convex/bootstrap.ts` → add `collect("routines")` and `collect("programs")` to the
    `Promise.all`, destructure them, and include them in the returned object. They belong in
    `getCore` (not the paginated history window) because they are small, always-needed
    definition data, exactly like `activities`.

- [x] **1.5** Run `npm run test:convex` — it must pass with zero type errors.

#### Client persistence

- [x] **1.6** In `src/core/state.js`:
  - Add `routines: []` and `programs: []` to `initialState` (place them after
    `recordedActivities`).
  - Add these `ActionTypes`: `ADD_ROUTINE`, `UPDATE_ROUTINE`, `DELETE_ROUTINE`,
    `ADD_PROGRAM`, `UPDATE_PROGRAM`, `DELETE_PROGRAM`, `SET_ACTIVE_PROGRAM`.
  - Add matching `Actions` creators following the existing shape, e.g.
    `addRoutine: (routine) => ({ type: ActionTypes.ADD_ROUTINE, payload: routine })`,
    `updateRoutine: (routineId, updates) => ({ type: ..., payload: { routineId, updates } })`,
    `setActiveProgram: (programId) => ({ type: ..., payload: programId })` (a `null` payload
    deactivates all programs).
  - Add reducer cases mirroring the activity cases. `SET_ACTIVE_PROGRAM` maps over
    `state.programs` setting `active: program.id === action.payload`.
  - `DELETE_PROGRAM` simply filters `state.programs`.

- [x] **1.7** In `src/core/persistenceRouter.js`:
  - Add all seven new action types to `PERSISTENT_ACTIONS`.
  - Add two record shapers next to `activityDefinition()`:
    ```js
    function routineRecord(routine, sortOrder) {
      return {
        clientId: routine.id || routine.clientId,
        name: routine.name,
        activityClientIds: [...(routine.activityIds || routine.activityClientIds || [])],
        createdAtISO: String(routine.createdAt || routine.createdAtISO).slice(0, 10),
        sortOrder,
        revision: routine.revision || 0,
      };
    }
    ```
    and `programRecord(program, sortOrder)` mapping `startDate → startDateISO`,
    `endDate → endDateISO`, `scheduledDays[].routineId → routineClientId`, plus `active`,
    `createdAtISO`, `sortOrder`, `revision`.
  - Add switch cases: `ADD_ROUTINE` → `routines:create`, `UPDATE_ROUTINE` → `routines:update`,
    `DELETE_ROUTINE` → `routines:removeCascade`; same trio for programs.
  - `SET_ACTIVE_PROGRAM` must emit **one `programs:update` operation per program whose `active`
    flag actually changes** (at most two: the one being activated and the one being deactivated).
    Skip programs whose flag is unchanged so you do not burn revisions.

- [x] **1.8** In `src/core/stateHydration.js`:
  - Add `routines: [...(cache.routines || [])]` and `programs: [...(cache.programs || [])]` to
    the `overlaid` object in `overlayPendingOperations()`.
  - In `normalizedToCompatibilityState()`, map both collections back to in-app shape:
    ```js
    routines: live(cache.routines)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((routine) => ({
        ...routine,
        id: routine.clientId,
        activityIds: routine.activityClientIds || [],
        createdAt: routine.createdAtISO,
      })),
    programs: live(cache.programs)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((program) => ({
        ...program,
        id: program.clientId,
        startDate: program.startDateISO,
        endDate: program.endDateISO,
        scheduledDays: (program.scheduledDays || []).map((day) => ({
          dayOfWeek: day.dayOfWeek,
          routineId: day.routineClientId,
        })),
        createdAt: program.createdAtISO,
      })),
    ```

- [x] **1.9** Create `src/features/fitness/routines.js` with JSDoc'd exports:
  - `addRoutine(data)` — generates `id` via `generateUniqueId()`, sets `createdAt` from
    `getLocalMidnightISOString(new Date()).slice(0, 10)` and `sortOrder` from
    `getState().routines.length`; dispatches `Actions.addRoutine`; returns the routine or `null`.
  - `updateRoutine(routineId, updates)` / `deleteRoutine(routineId)` — thin dispatch wrappers.
  - `getRoutines()` — returns `getState().routines` sorted by `sortOrder`.
  - `getRoutine(routineId)`.
  - `getRoutineActivities(routineId)` — **read-time integrity filter**: maps `activityIds` through
    `getActivity()` and drops any `undefined` result. This is the only place UI should read a
    routine's activities from.

- [x] **1.10** Create `src/features/fitness/programs.js` with:
  - `addProgram(data)`, `updateProgram(id, updates)`, `deleteProgram(id)`,
    `setActiveProgram(id)`.
  - `getPrograms()`, `getProgram(id)`.
  - `getActiveProgram()` — returns the single program with `active === true`, or `null`.
  - `getProgramScheduledDays(programId)` — filters out entries whose `routineId` no longer
    resolves to a live routine (read-time integrity filter).

- [x] **1.11** In `src/core/cloudBootstrap.js`:
  - Add `'routines'` and `'programs'` to `ENTITY_TYPES`.
  - Add `routines: []` and `programs: []` to `emptyCache()`.
  - Add both to `mergeCoreIntoCache()`.
  - Add two `putConfirmedEntities(...)` calls for them in `cacheCore()`.

- [x] **1.12** Add both table names to the client-side table lists:
  - `src/core/dataManagement.js` → `TABLES`
  - `src/core/migration/mergeNormalized.js` → `TABLES`
  - `src/core/migration/coordinator.js` → its upload table list

- [x] **1.13** In `src/core/migration/normalizeLegacy.js`:
  - Add `'routines'` and `'programs'` to `KNOWN_FIELDS`.
  - Emit `routines: []` and `programs: []` in the returned `tables` object. Legacy snapshots
    predate these features so they are always empty, but the keys **must** exist or the count and
    checksum maps will not line up with the server's `TABLES` list and migration verification
    will fail.

### Verification — Phase 1

- [x] `npm run lint` passes with no new warnings.
- [x] `npm run test:convex` passes (Convex types compile).
- [x] `npm run test:unit` passes.
- [x] `grep -rn "routines" convex/ src/core/ | wc -l` shows hits in **all** of: `schema.ts`,
      `routines.ts`, `sync.ts`, `migration.ts`, `dataTransfer.ts`, `bootstrap.ts`, `state.js`,
      `persistenceRouter.js`, `stateHydration.js`, `cloudBootstrap.js`, `dataManagement.js`,
      `mergeNormalized.js`, `coordinator.js`, `normalizeLegacy.js`. Repeat for `programs`.
- [x] In `npm run dev` with a signed-in account, from the browser console:
      ```js
      const { addRoutine } = await import('/src/features/fitness/routines.js');
      await addRoutine({ name: 'Console Test', activityIds: [] });
      window.appData.routines;   // → one routine
      ```
      Reload the page. `window.appData.routines` still contains it. **This is the critical
      proof that the whole chain is wired.**
- [x] With DevTools set to Offline, create another routine, confirm it appears in
      `appData.routines`, then go back online and confirm the sync status pill returns to
      `synced` and the routine persists after a reload.
- [x] Add a program with an invalid range (`startDate > endDate`) via the console and confirm the
      Convex mutation rejects with `INVALID_PROGRAM_RANGE`.
- [x] Existing migration tests (`npm run test:migration`) still pass — the new empty tables did
      not break count/checksum verification.

---

## PHASE 2 — Fitness page restructure: buttons, modal stack, timer relocation

### Goal

Reshape the fitness page skeleton. Replace the two old action buttons with **Activity** and
**Routines**, tear out the inline expanding search panel, add the `+` pill next to the Activities
label, and reserve the empty slot where the program tile will render in Phase 6. Also fix a
latent modal-stacking bug that the new nested modals would otherwise expose.

After this phase the page looks right and the buttons exist, but they open nothing yet
(placeholder no-ops). That is expected.

### Context you need

- `src/shared/ActionButtons.js` — the `type: 'fitness'` branch builds `#new-activity-btn` and
  `#start-timer-btn`
- `src/features/fitness/FitnessView.js` — mounts header → action buttons → search panel →
  calendar → rest toggle → activity list, in that DOM order
- `src/features/fitness/RestToggle.js` — builds the row containing `#activities-label`
  (the "Activities" pill) and `#rest-toggle`
- `src/components/Modal.js` — `openModal`/`closeModal` set and clear
  `document.body.style.overflow`

### Known bug to fix in this phase

`closeModal()` unconditionally resets `document.body.style.overflow = ''`. With stacked modals
(Activity Library → Add Activity), closing the top modal restores body scrolling while the
underlying modal is still open, letting the page scroll behind it. Phases 3–6 stack modals
constantly, so fix it here.

### Tasks

- [x] **2.1** In `src/components/Modal.js`, introduce a module-level open-modal stack:
  ```js
  const openStack = [];
  ```
  - In `openModal(id)`: push `id` onto `openStack` if not already present, then set
    `document.body.style.overflow = 'hidden'` as today.
  - In `closeModal(id)`: remove `id` from `openStack`, and only reset
    `document.body.style.overflow = ''` when `openStack.length === 0`.
  - Export `function isModalOpen(id)` returning `openStack.includes(id)` and
    `function topModalId()` returning the last element — later phases use these.
  - Keep the existing `modalClosed` CustomEvent dispatch untouched; `SearchPanelModule` listens
    for it today and other modules may too.

- [x] **2.2** In `src/shared/ActionButtons.js`, rewrite the `type === 'fitness'` branch:
  - Replace the two buttons with:
    ```html
    <button id="fitness-activity-btn" class="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-1.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2" aria-label="Open activity library">
      <span class="material-icons text-xl">fitness_center</span>
      Activity
    </button>
    <button id="fitness-routines-btn" class="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-1.5 px-4 rounded-xl font-medium flex items-center justify-center gap-2" aria-label="Open routines">
      <span class="material-icons text-xl">repeat</span>
      Routines
    </button>
    ```
  - Keep the existing `.classList.add('font-semibold')` pass over both buttons.
  - Bind `callbacks.onActivityLibrary` and `callbacks.onRoutines`.
  - **Delete** the timer wiring from this file: the `initializeTimer()` /
    `setTimerUpdateCallback()` / `updateTimerButton()` calls and the
    `import { getTimerState, setTimerUpdateCallback, initializeTimer }` line.
  - **Delete** the exported `updateTimerButton()` function from this file. Search the repo for
    other importers first (`grep -rn "updateTimerButton" src/`) and clean them up —
    `FitnessView.updateTimerButton()` and its call inside `FitnessModule`'s `subscribe()` both go.
  - Leave the `type === 'habits'` branch completely untouched.

- [x] **2.3** In `src/features/fitness/FitnessView.js`:
  - Remove the `mountSearchPanel` import and the block that appends `searchPanel`.
  - Pass the two new callbacks into `mountActionButtons`:
    `onActivityLibrary: callbacks.onActivityLibrary`, `onRoutines: callbacks.onRoutines`.
  - Insert a **program tile host** immediately after the action buttons and before the calendar
    wrapper:
    ```js
    const programHost = document.createElement('div');
    programHost.id = 'fitness-program-host';
    programHost.className = 'px-4';
    container.appendChild(programHost);
    ```
    Leave it empty — Phase 6 fills it. An empty div with no padding-producing children renders
    as zero height, satisfying "nothing if no program added".
  - Remove `updateTimerButton()` from the exported object.
  - In `setupResponsiveBehavior()`, delete the `updateSearchSectionHeight()` calls and the
    `setTimeout` block that resizes `.activities-search-content`. Keep
    `adjustActivitiesContainerHeight()` on both `resize` and `orientationchange`.

- [x] **2.4** In `src/features/fitness/RestToggle.js`, add the `+` pill immediately to the right
      of `#activities-label`, inside the same flex row. Wrap the label and the new button in a
      grouping div so the rest toggle stays pushed to the far right:
  ```html
  <div class="flex items-center gap-2">
    <div id="activities-label" class="...unchanged...">…</div>
    <button id="fitness-add-menu-btn"
            class="w-9 h-9 rounded-full bg-blue-50 dark:bg-gray-800 text-ios-blue flex items-center justify-center transition-colors hover:bg-blue-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-ios-blue"
            aria-label="Add to today" aria-haspopup="true" aria-expanded="false">
      <span class="material-icons text-xl">add</span>
    </button>
  </div>
  ```
  - The outer row keeps `flex items-center justify-between px-4 py-1 rest-toggle-row`.
  - The button is a **no-op for now** — Phase 5 wires the dropdown. Do not attach a handler yet.

- [x] **2.5** In `src/features/fitness/FitnessModule.js`:
  - Replace `onNewActivity` in the `FitnessView.mount` callbacks with
    `onActivityLibrary: () => {}` and `onRoutines: () => {}` (placeholders; Phases 3–4 fill them).
  - Delete `FitnessView.updateTimerButton()` from the `subscribe()` callback.
  - **Keep** `Timer.bindEvents()` — the timer modal still works, it just has no launcher yet.

- [x] **2.6** Relocate the timer entry point. For this phase, add a temporary launcher so the
      feature is never unreachable: in `src/shared/HeaderBar.js`, no change is needed **if** you
      instead defer the launcher to Phase 5's dropdown. Choose one and record it here:
  - [x] Timer launcher lives in the Phase 5 `+` dropdown (preferred — one less UI surface).
  - [ ] If you need it reachable before Phase 5 for testing, call `Timer.openModal()` from the
        console; do **not** ship an interim button.

- [x] **2.7** In `src/styles/style.css`, delete the now-dead search-panel rules:
      `#fitness-view.search-expanded …` (all three selectors),
      `#fitness-view .activities-search-section` and every descendant/`::before`/scrollbar rule,
      `#fitness-view .activities-search-content` and its dark-theme variants
      (roughly lines 968–1090 — verify line numbers before deleting).
      **Do not** delete `.search-container` rules if the habits view still uses them —
      `grep -n "search-container" src/ index.html` first.

### Verification — Phase 2

- [x] `npm run lint` and `npm run test:unit` pass.
- [x] `npm run dev` → Fitness tab renders with exactly two buttons labelled **Activity** and
      **Routines**, same size, colour, corner radius and spacing as the old pair. Compare against
      a screenshot of `main` side by side.
- [x] No search bar appears anywhere on the fitness page.
- [x] The `+` pill sits immediately right of the "Activities" pill, is vertically centred with
      it, and the rest-day toggle remains flush right. Check at 375px, 768px and 1280px widths.
- [x] The calendar, rest-day toggle and recorded-activities list all still work: change dates,
      toggle a rest day, tap a recorded activity to edit it, swipe to delete.
- [x] `#fitness-program-host` exists in the DOM and has zero rendered height.
- [x] `grep -rn "mountSearchPanel\|updateSearchSectionHeight\|search-expanded" src/` returns only
      matches inside files scheduled for deletion in Phase 3 (`SearchPanelModule.js`,
      `SearchInput.js`, `SearchResults.js`) — nothing in live code paths.
- [x] Modal stack fix: open the Add Activity modal from the console
      (`Modals.openAddActivity()`), then open the icon picker on top of it, close the icon
      picker, and confirm the page behind is **still** scroll-locked.
- [x] Dark mode: toggle the theme and confirm both new buttons and the `+` pill use the dark
      variants correctly.

---

## PHASE 3 — Activity Library modal

### Goal

Move the entire categorised activity list out of the page and into a modal that opens from the
**Activity** button. The filter input lives inside the modal, is always visible, and filters the
list in place with no expand/collapse animation and no page blur. A **+ New Activity** button in
the modal opens the existing Add Activity modal on top.

### Context you need

- `src/features/fitness/SearchPanelModule.js` — `populateSearchSectionContent()` holds the
  grouping logic you are keeping (categories, strength → muscle-group sub-headers, empty states)
- `src/features/fitness/SearchPanel/CategorySection.js` — `buildCategorySection()` and
  `bindCategorySectionEvents()`: **keep, reuse as-is**
- `src/features/fitness/SearchPanel/ActivityTile.js` — `bindActivityTileEvents()`: **keep**
- `src/features/fitness/SearchPanel/CategoryColorPicker.js` — category colour editing: **keep**
- `src/features/fitness/SearchPanel/SearchInput.js` / `SearchResults.js` — expand/collapse and
  tap-count machinery: **delete**

### Tasks

- [ ] **3.1** Rename the folder `src/features/fitness/SearchPanel/` →
      `src/features/fitness/ActivityLibrary/` using `git mv` so history is preserved:
      ```bash
      git mv src/features/fitness/SearchPanel src/features/fitness/ActivityLibrary
      ```

- [ ] **3.2** Delete `ActivityLibrary/SearchInput.js` and `ActivityLibrary/SearchResults.js`.
      Delete `src/features/fitness/SearchPanelModule.js`.

- [ ] **3.3** In `src/features/fitness/helpers/fitnessLayout.js`, delete
      `calculateAvailableHeight()` and `updateSearchSectionHeight()`. Keep
      `adjustActivitiesContainerHeight()`. Update the file's JSDoc header.

- [ ] **3.4** Add the modal markup to `index.html`, immediately **before** the existing
      `<!-- Add Activity Modal -->` block so DOM order matches z-order:
  ```html
  <!-- Activity Library Modal -->
  <div id="activity-library-modal" class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-[1001] hidden flex items-center justify-center p-4 animate-in fade-in duration-300">
    <div class="modal-content glass dark:glass-dark rounded-2xl w-full max-w-md mx-auto overflow-hidden max-h-[85vh] shadow-2xl border border-white/20 dark:border-gray-700/50 transform transition-all duration-300 scale-95 opacity-0 modal-animate flex flex-col">
      <div class="modal-header flex justify-between items-center px-6 py-1 bg-white/90 dark:bg-gray-800/90 border-b border-gray-200/50 dark:border-gray-700/50 flex-shrink-0 rounded-t-2xl backdrop-blur-xl">
        <button id="close-activity-library" class="px-4 py-2 text-ios-blue hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-lg transition-all duration-200 font-medium">Close</button>
        <span class="text-lg font-semibold text-gray-900 dark:text-white">Activities</span>
        <button id="library-new-activity-btn" class="px-4 py-2 text-ios-blue rounded-lg font-medium hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-all duration-200 flex items-center gap-1" aria-label="Create a new activity">
          <span class="material-icons text-lg">add</span>New
        </button>
      </div>
      <div class="px-4 pt-3 pb-2 flex-shrink-0">
        <div class="relative border-2 border-gray-300 dark:border-gray-500 rounded-xl bg-gray-100 dark:bg-gray-700 transition-all duration-200">
          <svg class="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <input id="activity-library-filter" type="text" placeholder="Search activities..." autocomplete="off" spellcheck="false"
                 class="w-full pl-10 pr-10 py-2 bg-transparent text-gray-700 dark:text-gray-300 rounded-xl border-none outline-none focus:ring-0 placeholder-gray-500 dark:placeholder-gray-400">
          <button id="activity-library-filter-clear" class="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors hidden rounded-full hover:bg-gray-200 dark:hover:bg-gray-600" aria-label="Clear filter">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-500 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
        <div id="activity-library-content" class="px-4 pb-4"></div>
      </div>
    </div>
  </div>
  ```
  The filter input **must not** be inside the scrolling container — it stays pinned while the
  list scrolls.

- [ ] **3.5** Create `src/features/fitness/Modals/ActivityLibraryModal.js` exporting an
      `ActivityLibraryModal` object (mirror the shape of `AddEditActivityModal`):
  - `open(callbacks)` — stores `callbacks` on the module, resets the filter input to `''`, hides
    the clear button, calls `this._render('')`, then `openModal('activity-library-modal')`.
    Bind handlers **once** using the `dataset.listenerAttached` guard the codebase already uses.
  - `_render(query)` — port `populateSearchSectionContent()` from the deleted
    `SearchPanelModule.js` verbatim, changing only the output target to
    `#activity-library-content`. Keep:
    - grouping by category via `getActivitiesByCategory()`
    - the `category.id === 'strength'` branch that calls `groupActivitiesByMuscleGroup()`
    - the query branch using `searchActivities(query)` re-grouped by category
    - both empty states (no activities / no matches), unchanged copy and icons
  - `_bindContentEvents()` — call `bindCategorySectionEvents(content, handleCategoryColorChange)`
    and `bindActivityTileEvents(content, onActivityClick, onStatsClick, onEditClick)` after every
    render. Port `handleCategoryColorChange` / `updateCategoryColor` from `SearchPanelModule.js`;
    after a colour change, re-render with the current query.
  - `close()` — `closeModal('activity-library-modal')`.
  - `refresh()` — re-render with the current filter value; used by state subscriptions.

- [ ] **3.6** Wire the filter input in `ActivityLibraryModal`:
  - `input` event → `this._render(e.target.value)` and toggle the clear button's `hidden` class
    on `value.length > 0`.
  - Clear button click → set value `''`, `this._render('')`, hide clear button, refocus input.
  - `keydown` Escape → if the filter has text, clear it; otherwise `this.close()`.
  - **Do not** port the two-tap/`allowFocus`/`temp-focus` logic. The input focuses normally on tap.

- [ ] **3.7** Wire the two header buttons:
  - `#close-activity-library` → `this.close()`.
  - `#library-new-activity-btn` → `Modals.openAddActivity()`. The Add Activity modal
    (`z-[1002]`) opens **on top of** the library (`z-[1001]`); the library stays open behind it.
  - Listen for the `modalClosed` event with `detail.modalId === 'add-activity-modal'` and call
    `this.refresh()` so a newly created activity appears immediately.
  - Also refresh on the existing `ActivityDeleted` CustomEvent.

- [ ] **3.8** Add a click-outside handler: clicking the overlay (`e.target === modal`) closes the
      library. Match how `AddEditActivityModal._setupActivityIconPicker` does it for the icon modal.

- [ ] **3.9** In `src/features/fitness/FitnessModals.js`, add a facade method:
  ```js
  openActivityLibrary(callbacks) {
    ActivityLibraryModal.open(callbacks);
  },
  ```
  with the import at the top.

- [ ] **3.10** In `src/features/fitness/FitnessModule.js`, replace the Phase 2 placeholder:
  ```js
  onActivityLibrary: () =>
    Modals.openActivityLibrary({
      onActivityClick: (activityId) => handleActivityClick(activityId),
      onStatsClick: (activityId) => Modals.openStats(activityId),
      onEditClick: (activityId) => Modals.openEditActivity(activityId),
    }),
  ```
  `handleActivityClick` already blocks recording on rest days and shows the confirm dialog —
  reuse it unchanged.

- [ ] **3.11** Subscribe the library to state changes so it stays live while open: inside
      `ActivityLibraryModal.open()`, register a `subscribe()` listener that calls `refresh()` only
      when `isModalOpen('activity-library-modal')` is true, and store the unsubscribe function so
      `close()` can call it. Not unsubscribing leaks a listener on every open.

### Verification — Phase 3

- [ ] `npm run lint` and `npm run test:unit` pass.
- [ ] Tapping **Activity** opens a modal whose shell (glass, radius, header, shadow) is visually
      identical to the Add Activity modal.
- [ ] Category sections render with the same coloured headers, the same expand/collapse chevron
      behaviour, the same coloured edit pill, and the same 2.5px category-coloured activity tiles
      as the old search panel. Diff against a screenshot from `main`.
- [ ] Strength Training still shows muscle-group sub-headers.
- [ ] Typing in the filter narrows the list **immediately**, in place. The modal does **not**
      grow, animate open, or blur the page behind it.
- [ ] Clearing the filter restores the full grouped list; the clear button appears only when text
      is present.
- [ ] Empty states: with zero activities, the "No activities available" state shows; with a
      non-matching query, "No activities found" shows.
- [ ] Tapping an activity tile opens the Activity Details modal and recording works; the library
      remains open behind it and the page behind stays scroll-locked.
- [ ] On a rest day, tapping an activity shows the "Rest Day" confirm dialog and does not record.
- [ ] The stats button opens the Stats modal; the edit button opens Edit Activity.
- [ ] **+ New** opens the Add Activity modal above the library; saving a new activity closes it
      and the new activity is immediately visible in the library list underneath.
- [ ] Editing a category colour updates the header colour and the tile borders without closing
      the modal.
- [ ] Closing the library restores page scrolling exactly once (no double-reset).
- [ ] Open and close the library 10 times, then check that `listeners.size` in `state.js` has not
      grown (paste `(await import('/src/core/state.js')).listeners.size` in the console before and
      after) — proves the subscription is being cleaned up.
- [ ] `grep -rn "SearchPanel" src/ index.html` returns nothing.

---

## PHASE 4 — Routines modal and Routine Builder

### Goal

Give the user a place to see, create, edit and delete named routines — an ordered set of
activities they perform together. The Routines modal lists saved routines with an empty state and
a **+ New Routine** button. The Routine Builder is a multi-select over the activity library with
a name field; it is reused later (Phase 5) for editing and for "save today's activities as a
routine".

### Context you need

- `src/features/fitness/routines.js` (Phase 1) — all routine CRUD and the
  `getRoutineActivities()` integrity filter
- `src/features/fitness/ActivityLibrary/CategorySection.js` — for the builder's grouped list you
  need a **selection variant** of the tile, not the record/stats/edit variant
- `src/components/ConfirmDialog.js` — `showConfirm()` for delete confirmation

### Tasks

- [ ] **4.1** Add the Routines modal markup to `index.html`, after the Activity Library modal:
  ```html
  <!-- Routines Modal -->
  <div id="routines-modal" class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-[1001] hidden flex items-center justify-center p-4 animate-in fade-in duration-300">
    <div class="modal-content glass dark:glass-dark rounded-2xl w-full max-w-md mx-auto overflow-hidden max-h-[85vh] shadow-2xl border border-white/20 dark:border-gray-700/50 transform transition-all duration-300 scale-95 opacity-0 modal-animate flex flex-col">
      <div class="modal-header flex justify-between items-center px-6 py-1 bg-white/90 dark:bg-gray-800/90 border-b border-gray-200/50 dark:border-gray-700/50 flex-shrink-0 rounded-t-2xl backdrop-blur-xl">
        <button id="close-routines-modal" class="px-4 py-2 text-ios-blue hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-lg transition-all duration-200 font-medium">Close</button>
        <span class="text-lg font-semibold text-gray-900 dark:text-white">Routines</span>
        <span class="w-[72px]"></span>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-500 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
        <div class="p-4 space-y-4">
          <button id="new-routine-btn" class="w-full py-3 px-4 bg-ios-blue/10 text-ios-blue rounded-xl font-semibold hover:bg-ios-blue/20 transition-colors flex items-center justify-center gap-2">
            <span class="material-icons text-xl">add</span>New Routine
          </button>
          <div id="routines-list" class="space-y-2"></div>
        </div>
      </div>
    </div>
  </div>
  ```
  The spacer `<span class="w-[72px]">` keeps the title optically centred against the Close button.

- [ ] **4.2** Add the Routine Builder modal markup to `index.html`, after the Routines modal:
  ```html
  <!-- Routine Builder Modal -->
  <div id="routine-builder-modal" class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-[1002] hidden flex items-center justify-center p-4 animate-in fade-in duration-300">
    <div class="modal-content glass dark:glass-dark rounded-2xl w-full max-w-md mx-auto overflow-hidden max-h-[85vh] shadow-2xl border border-white/20 dark:border-gray-700/50 transform transition-all duration-300 scale-95 opacity-0 modal-animate flex flex-col">
      <div class="modal-header flex justify-between items-center px-6 py-1 bg-white/90 dark:bg-gray-800/90 border-b border-gray-200/50 dark:border-gray-700/50 flex-shrink-0 rounded-t-2xl backdrop-blur-xl">
        <button id="cancel-routine-builder" class="px-4 py-2 text-ios-blue hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-lg transition-all duration-200 font-medium">Cancel</button>
        <button id="save-routine-builder" class="px-4 py-2 text-ios-blue rounded-lg font-medium opacity-50 transition-all duration-200 hover:bg-gray-100/50 dark:hover:bg-gray-800/50" disabled>Save</button>
      </div>
      <div class="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-500 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
        <div class="p-3 space-y-4">
          <div>
            <h2 id="routine-builder-title" class="text-2xl font-bold text-gray-900 dark:text-white mb-2">New Routine</h2>
            <p class="text-gray-600 dark:text-gray-400 text-sm">Name your routine and choose the activities it contains.</p>
          </div>
          <div class="space-y-3 p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl">
            <h3 class="text-gray-700 dark:text-gray-300 text-sm font-semibold">Details</h3>
            <input id="routine-name-input" maxlength="32" required placeholder="Routine name"
                   class="w-full px-4 py-3 bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue/50 focus:border-ios-blue transition-all duration-200 h-12">
          </div>
          <div class="space-y-3 p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl">
            <div class="flex items-center justify-between">
              <h3 class="text-gray-700 dark:text-gray-300 text-sm font-semibold">Activities</h3>
              <span id="routine-selection-count" class="text-xs font-medium text-gray-500 dark:text-gray-400">0 selected</span>
            </div>
            <input id="routine-activity-filter" type="text" placeholder="Filter activities..." autocomplete="off"
                   class="w-full px-4 py-2 bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ios-blue/50 transition-all duration-200">
            <div id="routine-activity-picker" class="space-y-2 max-h-[40vh] overflow-y-auto scrollbar-thin"></div>
          </div>
          <button id="delete-routine-btn" class="w-full py-3 px-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors hidden">
            Delete Routine
          </button>
        </div>
      </div>
    </div>
  </div>
  ```

- [ ] **4.3** Create `src/features/fitness/ActivityLibrary/SelectableActivityTile.js` exporting:
  - `buildSelectableCategorySection(category, activities, selectedIds, muscleGroups)` — same
    visual structure as `buildCategorySection()` (coloured header, chevron, indented tiles) but
    each tile:
    - carries `data-activity-id` and a `.selectable-activity-item` class
    - replaces the stats/edit action buttons with a right-aligned checkmark indicator:
      ```html
      <span class="selection-indicator w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
            style="border-color:${category.color};">
        <span class="material-icons text-base text-white" style="display:none;">check</span>
      </span>
      ```
    - when selected, the tile gets `ring-2 ring-ios-blue` and the indicator's background is filled
      with `category.color` and the check icon is shown
  - `bindSelectableTileEvents(container, onToggle)` — clicking anywhere on a tile calls
    `onToggle(activityId)`
  - Reuse `hexToRgba` from `src/shared/color.js` for tile backgrounds so colours match the library.

- [ ] **4.4** Create `src/features/fitness/Modals/RoutineBuilderModal.js` exporting
      `RoutineBuilderModal` with:
  - Module state: `_selectedIds = []` (ordered — **selection order is routine order**),
    `_editRoutineId = null`, `_onSaved = null`.
  - `openCreateMode({ presetActivityIds = [], presetName = '', title = 'New Routine', onSaved } = {})`
    — resets state, seeds `_selectedIds` from `presetActivityIds` (filtered through
    `getActivity()` so dead IDs never enter), sets the title and name field, hides the delete
    button, renders and opens.
  - `openEditMode(routineId, { onSaved } = {})` — loads via `getRoutine()`, sets
    `_editRoutineId`, seeds name and `_selectedIds` from `getRoutineActivities()` (already
    filtered), sets title to `Edit Routine`, **shows** the delete button, renders and opens.
  - `_renderPicker(query)` — builds the grouped selectable list into `#routine-activity-picker`
    using `getActivitiesByCategory()` / `searchActivities()` and the strength → muscle-group
    branch, exactly like the library. Then `bindSelectableTileEvents`.
  - `_toggle(activityId)` — push if absent, splice if present; re-render; update
    `#routine-selection-count` to `${n} selected`; call `_validate()`.
  - `_validate()` — enable `#save-routine-builder` only when the trimmed name is non-empty **and**
    at least one activity is selected; mirror the `opacity-50` toggle used by
    `AddEditActivityModal._setupFormValidation`.
  - `_handleSave()` — `await updateRoutine(_editRoutineId, {...})` or `await addRoutine({...})`;
    bail without closing if the dispatch returns falsy (this is how the codebase surfaces a
    failed durable write); otherwise `closeModal('routine-builder-modal')` and invoke `_onSaved`.
  - `_handleDelete()` — `showConfirm({ title: 'Delete Routine?', message: 'This routine will be
    permanently removed. This action cannot be undone.', okText: 'Delete', cancelText: 'Cancel',
    onOK: async () => { … } })`, then `deleteRoutine`, close, invoke `_onSaved`.
  - Filter input, Cancel button and overlay-click behave as in the Activity Library modal.

- [ ] **4.5** Create `src/features/fitness/Modals/RoutinesModal.js` exporting `RoutinesModal`:
  - `open()` — render the list, then `openModal('routines-modal')`.
  - `_render()` — read `getRoutines()`. If empty, render the empty state into `#routines-list`:
    ```html
    <div class="flex flex-col items-center justify-center py-10 text-center space-y-2">
      <span class="material-icons text-4xl text-gray-400">repeat</span>
      <p class="text-gray-600 dark:text-gray-400 font-medium">No routines saved</p>
      <p class="text-sm text-gray-500">Create a new routine to group activities you do together.</p>
    </div>
    ```
    (Copy required by spec: *"no routine saved. create a new routine"* — the two lines above
    carry that meaning in the app's existing sentence-case voice.)
  - Otherwise render one card per routine:
    ```html
    <div class="routine-card flex items-center px-3 py-3 rounded-xl w-full bg-white/80 dark:bg-gray-700/80 border border-gray-200 dark:border-gray-600 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600" data-routine-id="${routine.id}" tabindex="0">
      <div class="w-9 h-9 flex-shrink-0 rounded-lg bg-ios-blue/10 flex items-center justify-center mr-3">
        <span class="material-icons text-ios-blue text-xl">repeat</span>
      </div>
      <div class="flex-grow text-left min-w-0">
        <div class="font-semibold leading-tight text-gray-900 dark:text-white truncate">${routine.name}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400">${count} ${count === 1 ? 'activity' : 'activities'}</div>
      </div>
      <button class="edit-routine-btn w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ml-3" data-routine-id="${routine.id}" aria-label="Edit routine">
        <span class="material-icons text-lg">edit</span>
      </button>
    </div>
    ```
    where `count = getRoutineActivities(routine.id).length` — **use the filtered count**, so a
    routine referencing deleted activities reports honestly.
  - Bind: `#new-routine-btn` → `RoutineBuilderModal.openCreateMode({ onSaved: () => this._render() })`;
    `.edit-routine-btn` → `openEditMode(id, { onSaved: () => this._render() })` (stop propagation);
    card body click → same as edit (the card *is* the edit affordance);
    `#close-routines-modal` and overlay click → `closeModal('routines-modal')`.
  - Escape key closes the modal.

- [ ] **4.6** Add both to the `Modals` facade in `src/features/fitness/FitnessModals.js`:
      `openRoutines()`, `openRoutineBuilder(options)`, `openEditRoutine(routineId, options)`.

- [ ] **4.7** In `FitnessModule.js`, replace the Phase 2 placeholder with
      `onRoutines: () => Modals.openRoutines()`.

- [ ] **4.8** Escape-key and overlay-click handling must respect the modal stack: pressing Escape
      while the builder is open over the routines modal closes **only** the builder. Use
      `topModalId()` from Phase 2 to guard the Escape handler in both modules.

### Verification — Phase 4

- [ ] `npm run lint` and `npm run test:unit` pass.
- [ ] With zero routines, tapping **Routines** shows the empty state text and the
      **+ New Routine** button above it.
- [ ] **+ New Routine** opens the builder over the routines modal; the routines modal is visible
      behind the dimmed overlay.
- [ ] Save is disabled until both a name and at least one activity are provided; the disabled
      state uses `opacity-50` like every other modal in the app.
- [ ] Selecting activities toggles the ring and filled checkmark; the "N selected" counter tracks
      correctly; deselecting works.
- [ ] The builder's activity filter narrows the picker without losing already-made selections
      (select an activity, filter to something else, clear the filter — it is still selected).
- [ ] Saving creates the routine, closes the builder, and the routines list behind it updates
      immediately with the correct activity count.
- [ ] Reload the page — the routine is still listed (Convex round-trip proven).
- [ ] Tapping a routine card opens Edit mode with the name and the exact selected activities
      pre-populated **in the saved order**.
- [ ] Editing the name and selection saves correctly; the list reflects the change.
- [ ] Delete Routine shows the shared confirm dialog and, on confirm, removes the routine from
      the list and from `appData.routines`.
- [ ] Integrity: create a routine with 3 activities, delete one of those activities from the
      Activity Library, reopen the routine — it shows **2 activities**, opens in the builder
      without errors, and no console warnings appear.
- [ ] Escape closes only the topmost modal; body scroll-lock is released only when the last modal
      closes.
- [ ] Dark mode renders all new cards, inputs and indicators correctly.

---

## PHASE 5 — The `+` dropdown and its four actions

### Goal

Wire the `+` pill added in Phase 2 to a dropdown offering the four actions from the spec, and
implement each one. This is the phase that makes routines actually useful day to day.

Menu items, in order:
1. **Add activity** — opens the Activity Library modal (tap to record for the selected date)
2. **Add routine** — opens a routine picker; choosing one records every activity in it for the
   selected date
3. **Save as routine** — opens the Routine Builder pre-filled with the activities recorded on the
   selected date, so the user can trim and name it
4. **New program** — opens the Program Builder (stub until Phase 6)

Plus a fifth, non-spec item required by the Phase 2 timer decision:
5. **Timer** — opens the existing timer modal

### Context you need

- `src/features/home/components/HomeHeader.js` / `index.html:83` — the existing dropdown pattern
  (position, classes, `aria-expanded`, click-outside close)
- `src/features/fitness/activities.js` — `recordActivity(activityId, date, data)` and
  `getActivitiesForDate(date)`
- `src/features/fitness/FitnessModule.js` — `handleActivityClick()` contains the rest-day guard

### Tasks

- [ ] **5.1** Create `src/features/fitness/AddMenu.js` exporting:
  - `mountAddMenu(anchorButton, actions)` — builds and appends the dropdown as a sibling of the
    anchor inside a `relative` wrapper, returns the menu element.
  - `toggleAddMenu()`, `closeAddMenu()`.
  - Markup (copy the home dropdown's classes; note `right-0` so it opens leftwards and never
    overflows the viewport on a 375px screen):
    ```html
    <div id="fitness-add-menu" class="absolute top-full left-0 mt-2 bg-gray-100 dark:bg-gray-900 rounded-[14px] shadow-lg min-w-max z-50 overflow-hidden hidden p-1" role="menu" aria-labelledby="fitness-add-menu-btn">
      <div class="dropdown-item flex items-center h-[36px] gap-2 px-4 py-0 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors text-sm font-medium" data-action="add-activity" role="menuitem" tabindex="0">
        <span class="material-icons text-[18px]">fitness_center</span><span>Add activity</span>
      </div>
      <div class="dropdown-item …" data-action="add-routine" role="menuitem" tabindex="0">
        <span class="material-icons text-[18px]">repeat</span><span>Add routine</span>
      </div>
      <div class="dropdown-item …" data-action="save-routine" role="menuitem" tabindex="0">
        <span class="material-icons text-[18px]">bookmark_add</span><span>Save as routine</span>
      </div>
      <div class="dropdown-item …" data-action="new-program" role="menuitem" tabindex="0">
        <span class="material-icons text-[18px]">calendar_month</span><span>New program</span>
      </div>
      <div class="dropdown-item …" data-action="timer" role="menuitem" tabindex="0">
        <span class="material-icons text-[18px]">schedule</span><span>Timer</span>
      </div>
    </div>
    ```
  - Behaviour: toggling sets `aria-expanded` on the anchor; a `document` click listener closes it
    when the click is outside both the menu and the anchor; Escape closes it; selecting an item
    closes it before invoking the action. Register the document listener **once** per mount and
    remove it if the menu is ever unmounted.

- [ ] **5.2** In `src/features/fitness/RestToggle.js`, wrap `#activities-label` +
      `#fitness-add-menu-btn` in a `relative` container so the absolutely-positioned menu anchors
      correctly, and call `mountAddMenu()` with the action callbacks passed through
      `mountRestToggle(options)`.

- [ ] **5.3** In `FitnessView.js` and `FitnessModule.js`, thread a new
      `callbacks.addMenu` object down to `mountRestToggle`:
  ```js
  addMenu: {
    onAddActivity: () => Modals.openActivityLibrary({ /* same callbacks as the Activity button */ }),
    onAddRoutine: () => Modals.openRoutinePicker({ onPick: (routineId) => recordRoutine(routineId) }),
    onSaveAsRoutine: () => openSaveTodayAsRoutine(),
    onNewProgram: () => Modals.openProgramBuilder(),   // stub until Phase 6
    onTimer: () => Timer.openModal(),
  }
  ```

- [ ] **5.4** Add the **Routine Picker** modal markup to `index.html` (after the Routine Builder):
      id `routine-picker-modal`, `z-[1002]`, same shell, header `Cancel` + centred title
      *Add Routine*, body `#routine-picker-list`. Reuse the routine-card markup from Phase 4 but
      **without** the edit button. Empty state: *"No routines saved"* plus a
      **Create a routine** button that closes the picker and opens the builder.

- [ ] **5.5** Create `src/features/fitness/Modals/RoutinePickerModal.js` exporting
      `RoutinePickerModal.open({ onPick })`. Card click → `closeModal('routine-picker-modal')`
      then `onPick(routineId)`.

- [ ] **5.6** Implement routine recording in `src/features/fitness/routines.js`:
  ```js
  /**
   * Records every activity in a routine for the given date.
   * @param {string} routineId
   * @param {string} isoDate YYYY-MM-DD
   * @returns {Promise<{recorded: number, failed: number}>}
   */
  export async function recordRoutineForDate(routineId, isoDate) { … }
  ```
  - Guard first: if `isRestDay(isoDate)`, show the existing Rest Day confirm dialog (same title,
    message, `okText: 'OK'`, `cancelText: ''`) and return `{ recorded: 0, failed: 0 }`.
  - For each activity from `getRoutineActivities(routineId)`, `await recordActivity(activityId,
    isoDate, {})` **sequentially** — not `Promise.all`. Each call commits an operation to the
    IndexedDB outbox; serialising keeps outbox ordering deterministic and avoids hammering the
    transaction queue.
  - Records are created with no `duration`, `intensity` or `sets`. The activity card renders with
    no metric pills, and the user taps it to fill in details via the existing
    `openActivityDetailsWithRecord` flow. **Document this in a code comment** so it is not
    mistaken for a bug.
  - Count failures (a falsy dispatch result) and, if `failed > 0`, surface a `showConfirm` with
    `okText: 'OK'`, `cancelText: ''` explaining that some activities could not be added.
  - After the loop, dispatch nothing extra — the state subscription in `FitnessModule` re-renders
    the list automatically. Also fire the existing `ActivityRecorded` CustomEvent once at the end.

- [ ] **5.7** Implement **Save as routine** in `FitnessModule.js` (or a small helper module):
  ```js
  function openSaveTodayAsRoutine() {
    const iso = getLocalISODate(getState().fitnessSelectedDate || new Date().toISOString());
    const records = getActivitiesForDate(iso);
    const activityIds = [...new Set(records.map((record) => record.activityId))]
      .filter((id) => Boolean(getActivity(id)));
    if (activityIds.length === 0) {
      showConfirm({
        title: 'Nothing to Save',
        message: 'Record at least one activity before saving it as a routine.',
        okText: 'OK', cancelText: '', onOK: () => {},
      });
      return;
    }
    Modals.openRoutineBuilder({
      presetActivityIds: activityIds,
      title: 'Save as Routine',
      onSaved: () => {},
    });
  }
  ```
  De-duplication matters: the same activity recorded three times in a day becomes **one** entry in
  the routine. The builder opens in normal edit-capable mode so the user can remove entries and
  name it, exactly as specified.

- [ ] **5.8** Wire `Modals.openRoutinePicker` and `Modals.openProgramBuilder` into
      `FitnessModals.js`. `openProgramBuilder` may be a no-op stub in this phase; Phase 6 replaces
      it. Do **not** leave the menu item without a handler — a dead menu item that does nothing on
      tap reads as a bug.

- [ ] **5.9** Accessibility pass on the dropdown: arrow keys move between items, Enter/Space
      activates, Escape closes and returns focus to `#fitness-add-menu-btn`, and every item has a
      visible focus ring.

### Verification — Phase 5

- [ ] `npm run lint` and `npm run test:unit` pass.
- [ ] Tapping `+` opens a dropdown styled identically to the home-screen menu (same background,
      radius, shadow, item height, hover tint).
- [ ] The dropdown is fully on-screen at 375px width — it does not clip at the right edge.
- [ ] Tapping outside, pressing Escape, or choosing an item all close the menu, and
      `aria-expanded` tracks the state.
- [ ] **Add activity** opens the Activity Library; recording from it adds to the selected date.
- [ ] **Add routine** lists saved routines; picking one adds **every** activity in that routine to
      the selected day's list, grouped correctly by category, with no metric pills.
- [ ] Each routine-added card opens the Activity Details modal on tap and lets you fill in
      duration or sets; saving updates the card's pills.
- [ ] Adding a routine on a **rest day** shows the Rest Day dialog and records nothing.
- [ ] Adding a routine whose activities were partly deleted records only the surviving ones and
      does not throw.
- [ ] Go offline, add a routine to today, confirm the cards appear; reload while still offline —
      the cards are still there; go online — sync status returns to `synced` and the records
      persist after another reload.
- [ ] **Save as routine** with nothing recorded shows the "Nothing to Save" dialog.
- [ ] **Save as routine** with three activities recorded (one of them twice) opens the builder
      titled *Save as Routine* with exactly three unique activities pre-selected; removing one and
      saving produces a two-activity routine visible in the Routines modal.
- [ ] **Timer** opens the existing timer modal, which starts, laps, resets and closes exactly as
      it did on `main`.
- [ ] **New program** opens the Program Builder (stub is acceptable in this phase, but it must
      visibly do something).
- [ ] Keyboard: Tab to the `+` button, Enter opens, arrows navigate, Enter activates, Escape
      returns focus to the button.

---

## PHASE 6 — Programs: builder and the fitness-page program tile

### Goal

Let the user define a training program — a named block of time with a weekly schedule of routines
— and surface its progress on the fitness page. The tile is the payoff of the whole overhaul: at
a glance the user sees where they are in their plan.

The tile renders **only** when a program is active. When no program is active,
`#fitness-program-host` stays empty and the page looks exactly as it did after Phase 2.

### Progress semantics (implement exactly this)

Given an active program with `startDate`, `endDate` and `scheduledDays`:

- **Total weeks** = `ceil(inclusiveDayCount(startDate, endDate) / 7)`
- **Current week** = `clamp(floor(daysSince(startDate, today) / 7) + 1, 1, totalWeeks)`
  - Before `startDate` → week 1 with a "Starts in N days" label instead of the week counter
  - After `endDate` → `totalWeeks`, and the tile shows a "Completed" state
- **Planned workouts** = the number of dates in `[startDate, endDate]` whose weekday appears in
  `scheduledDays`
- **Completed workouts** = the number of *planned* dates that are `<= today`, are **not** rest
  days, and have at least one record in `getActivitiesForDate(date)`
- **Progress %** = `plannedWorkouts === 0 ? 0 : round(completedWorkouts / plannedWorkouts * 100)`

Progress is **workout-based, not time-based** — a user who is behind schedule sees a bar that
honestly reflects sessions done, which is what "how much of the program has been completed"
means. All of this is derivable from data the app already stores, so no new persisted counters
are needed and the numbers can never drift out of sync.

### Tasks

- [ ] **6.1** Create `src/features/fitness/helpers/programProgress.js` — **pure functions only**,
      no DOM access, no `getState()` calls (pass data in). This makes it unit-testable, which the
      guidelines require.
  - `inclusiveDayCount(startISO, endISO)`
  - `plannedDates(startISO, endISO, scheduledDays)` → array of `YYYY-MM-DD`
  - `currentWeek(startISO, endISO, todayISO)` → `{ week, totalWeeks, phase: 'before'|'during'|'after' }`
  - `computeProgramProgress({ program, todayISO, recordedActivities, restDays })` →
    `{ plannedWorkouts, completedWorkouts, percent, week, totalWeeks, phase }`
  - Use `getLocalISODate` / date helpers from `src/shared/datetime.js`; **never** construct dates
    with `new Date(isoString)` without an explicit time component — the codebase has an
    established timezone-safe pattern (`getLocalMidnightISOString`) and drifting a day here would
    silently corrupt every number on the tile.

- [ ] **6.2** Add the **Program Builder** modal markup to `index.html` after the Routine Picker:
      id `program-builder-modal`, `z-[1002]`, standard shell.
  - Header: `Cancel` / `Save` (Save disabled until valid).
  - Title block: *New Program* / *Edit Program* with subtitle
    *"Plan a block of training and schedule your routines."*
  - **Details** section (`bg-gray-50/50` card): `#program-name-input` (maxlength 32).
  - **Dates** section: `#program-start-input` and `#program-end-input` as
    `<input type="date">` styled like the holiday-period modal's date inputs
    (`index.html:744-745`) — reuse those exact classes.
  - **Weekly schedule** section: seven rows, Monday-first, each:
    ```html
    <div class="flex items-center justify-between gap-3">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300 w-10">Mon</span>
      <div class="relative flex-1">
        <select class="program-day-select w-full px-4 py-2 …h-10" data-day-of-week="1">
          <option value="">Rest</option>
          <!-- routine options injected by JS -->
        </select>
      </div>
    </div>
    ```
  - Destructive `#delete-program-btn` (hidden in create mode).

- [ ] **6.3** Create `src/features/fitness/Modals/ProgramBuilderModal.js`:
  - `openCreateMode()` — clears the form, defaults `startDate` to today and `endDate` to today +
    55 days (8 weeks), populates all seven selects from `getRoutines()`, hides delete, opens.
  - `openEditMode(programId)` — loads the program, fills every field including the day selects,
    shows delete, opens.
  - Validation (`_validate()`): name non-blank, both dates present, `start <= end`, and **at least
    one day scheduled**. Enable/disable Save with the `opacity-50` convention. Show an inline
    error under the date inputs when `start > end`:
    `<p class="text-xs text-red-600 dark:text-red-400">End date must be on or after the start date.</p>`
  - `_handleSave()` — builds `scheduledDays` from the non-empty selects, then:
    - `await addProgram({...})` or `await updateProgram(id, {...})`
    - if the new/updated program is meant to be active, `await setActiveProgram(id)` — which
      deactivates any other active program (Phase 1, Task 1.7)
    - a newly created program is **active by default**; note this in a comment
    - bail without closing if any dispatch returns falsy
  - `_handleDelete()` — `showConfirm` with the standard delete copy, then `deleteProgram(id)`.
  - If the user has **zero routines**, the schedule section shows an inline notice
    *"Create a routine first to schedule it."* and Save stays disabled. Do not open the builder
    into a dead end without explanation.

- [ ] **6.4** Create `src/features/fitness/ProgramTile.js` exporting:
  - `renderProgramTile()` — reads `getActiveProgram()`; if `null`, sets
    `#fitness-program-host` `innerHTML = ''` and returns. Otherwise renders:
    ```html
    <div id="program-tile" class="program-tile mb-2 mt-2 p-4 rounded-2xl bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700" data-program-id="${program.id}" role="button" tabindex="0" aria-label="Edit program ${program.name}">
      <div class="flex items-start justify-between gap-3 mb-2">
        <div class="min-w-0">
          <h3 class="font-bold text-base text-gray-900 dark:text-white truncate">${program.name}</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">${dateRangeLabel}</p>
        </div>
        <span class="text-xs font-semibold px-2 py-1 rounded-lg bg-ios-blue/10 text-ios-blue whitespace-nowrap">${weekLabel}</span>
      </div>
      <div class="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div class="h-full rounded-full bg-ios-blue transition-all duration-300" style="width:${percent}%"></div>
      </div>
      <div class="flex items-center justify-between mt-2">
        <span class="text-xs text-gray-600 dark:text-gray-400">${completedWorkouts} of ${plannedWorkouts} workouts</span>
        <span class="text-xs font-semibold text-gray-900 dark:text-white">${percent}%</span>
      </div>
    </div>
    ```
  - `dateRangeLabel` — format as `20 Oct – 13 Dec` (`toLocaleDateString` with
    `{ day: 'numeric', month: 'short' }`); append the year when start and end fall in different
    years.
  - `weekLabel` — `Week ${week} of ${totalWeeks}`; when `phase === 'before'`,
    `Starts in ${n} days`; when `phase === 'after'`, `Completed`.
  - Tapping the tile opens `ProgramBuilderModal.openEditMode(program.id)`.
  - Add an `aria-label` on the bar wrapper: `role="progressbar"` with `aria-valuenow`,
    `aria-valuemin="0"`, `aria-valuemax="100"` — a colour-only indicator needs a textual
    fallback per the guidelines.

- [ ] **6.5** In `FitnessModule.js`, call `renderProgramTile()` on mount and inside the existing
      `subscribe()` callback so the tile updates whenever programs, records or rest days change.
      Guard it the same way the rest-toggle update is guarded — re-render only when relevant
      state changed, or accept the cheap full re-render if profiling shows it is negligible
      (it is a single small template, so a plain re-render is acceptable).

- [ ] **6.6** Replace the Phase 5 stub: `onNewProgram: () => Modals.openProgramBuilder()` now
      calls `ProgramBuilderModal.openCreateMode()`. Add `openProgramBuilder()` and
      `openEditProgram(id)` to the `FitnessModals.js` facade.

- [ ] **6.7** Write unit tests in `tests/unit/programProgress.test.js` covering:
  - a 8-week program, 3 days/week → `plannedWorkouts === 24`
  - `currentWeek` at the start date, mid-program, on the end date and after the end date
  - `phase === 'before'` for a future program and `'after'` for a past one
  - completed counting skips rest days and dates with no records
  - `plannedWorkouts === 0` → `percent === 0` (no division by zero)
  - a program spanning a DST boundary produces the correct day count (use a fixed
    `todayISO` argument so the test is deterministic)

### Verification — Phase 6

- [ ] `npm run lint`, `npm run test:unit` (including the new `programProgress` tests) pass.
- [ ] With no program, `#fitness-program-host` is empty and the fitness page layout is pixel-
      identical to Phase 2's result.
- [ ] `+` → **New program** opens the builder; with zero routines it shows the "Create a routine
      first" notice and Save stays disabled.
- [ ] With routines available, every weekday select lists all saved routines plus "Rest".
- [ ] Save is disabled until name, valid dates and at least one scheduled day are present; an
      inverted date range shows the inline error.
- [ ] Saving a program renders the tile immediately, directly beneath the Activity/Routines
      buttons and above the calendar.
- [ ] Tile content is correct for a known case: create a program from 20 Oct to 13 Dec with
      Mon/Wed/Fri scheduled → date range reads `20 Oct – 13 Dec`, total weeks is 8, planned
      workouts is 24.
- [ ] Record activities on a scheduled date → completed count and the bar both increase.
- [ ] Mark a scheduled date as a rest day → it is not counted as completed.
- [ ] Create a program starting next month → the pill reads `Starts in N days` and the bar is 0%.
- [ ] Create a program that ended last month → the pill reads `Completed`.
- [ ] Tapping the tile opens the builder in edit mode with every field pre-populated.
- [ ] Deleting the program removes the tile and leaves the host empty.
- [ ] Creating a second program deactivates the first — only one tile ever renders, and
      `appData.programs.filter((p) => p.active).length === 1`.
- [ ] Reload — the active program, its schedule and its computed progress all survive.
- [ ] Offline: create a program, reload while offline, confirm it renders; reconnect and confirm
      it syncs.
- [ ] Dark mode and 375px width both render the tile without overflow or truncation problems.

---

## PHASE 7 — Cleanup, tests, docs and release readiness

### Goal

Leave the codebase cleaner than you found it. Remove every trace of the deleted search-panel
architecture, cover the new logic with tests at the level the guidelines demand, update the
documentation that now describes a page that no longer exists, and run the full pre-merge gate.

### Tasks

- [ ] **7.1** Dead-code sweep. Each of these must return **zero** hits in live source:
  ```bash
  grep -rn "SearchPanel\|mountSearchPanel\|refreshSearchPanel\|clearSearchPanel" src/ index.html
  grep -rn "activities-search-section\|activities-search-content\|search-expanded" src/ index.html
  grep -rn "updateSearchSectionHeight\|calculateAvailableHeight" src/
  grep -rn "new-activity-btn\|start-timer-btn" src/ index.html
  grep -rn "updateTimerButton" src/
  ```

- [ ] **7.2** Confirm the timer is intact and reachable: `src/features/fitness/TimerModule.js`,
      `Timer/*.js`, `timer.js` and the `#timer-modal` markup all remain, and the only launcher is
      the `+` dropdown item.

- [ ] **7.3** Unit tests to add:
  - `tests/unit/routines.test.js` — `getRoutineActivities()` filters deleted activity IDs;
    `addRoutine` assigns `sortOrder` and a `YYYY-MM-DD` `createdAt`.
  - `tests/unit/programs.test.js` — `getActiveProgram()` returns exactly one; scheduled-day
    filtering drops dead routine references.
  - `tests/unit/programProgress.test.js` — from Phase 6 (already written).
  - Extend `tests/unit/persistenceRecords.test.js` with `routineRecord()` and `programRecord()`
    shape assertions (field names, `clientId` mapping, date slicing to 10 chars).
  - Extend `tests/unit/stateHydration.test.js` to assert that `routines` and `programs` round-trip
    from normalized cache shape to in-app shape (`clientId → id`, `activityClientIds →
    activityIds`, `startDateISO → startDate`, `scheduledDays[].routineClientId → routineId`).
  - Extend `tests/convex/domain.test.js` with success, duplicate-operation, stale-revision,
    validation-failure and tombstone cases for `routines:create/update/removeCascade` — the
    guidelines require this coverage for **every** persistent mutation.

- [ ] **7.4** Migration tests: extend `tests/migration/normalizeLegacy.test.js` to assert that a
      legacy snapshot produces `tables.routines === []` and `tables.programs === []`, and that the
      counts/checksums maps contain both keys. Extend `mergeNormalized.test.js` similarly.

- [ ] **7.5** Playwright smoke test in `tests/e2e/` covering the new page shell: fitness tab
      renders exactly two action buttons, no search input is present, the `+` button exists and
      opens a menu with five items.

- [ ] **7.6** Documentation:
  - `docs/CODING_GUIDELINES.md` — the "Fitness Activities Card Design Specification" section is
    still accurate for the recorded-activities list; **add** a short subsection documenting the
    fitness modal stack, the z-index ladder from §1.3 of this plan, and the read-time referential
    integrity rule for routines and programs.
  - `docs/PERSISTENCE_AUDIT.md` — add `routines` and `programs` to the entity inventory.
  - `README.md` — update the feature list to mention routines and programs.
  - `CHANGELOG.md` — add an entry under a new Unreleased heading.

- [ ] **7.7** Full gate, in order:
  ```bash
  npm run lint
  npm run test:unit
  npm run test:migration
  npm run test:convex
  npm run build
  npm run test:e2e
  ```

- [ ] **7.8** Manual regression pass on the **rest of the app** — this overhaul touched shared
      files (`ActionButtons.js`, `Modal.js`, `state.js`, `persistenceRouter.js`,
      `stateHydration.js`), so verify:
  - Home view: habit completion, skip, progress, calendar navigation, holiday mode
  - Habits view: **New Category** and **New Habit** buttons still work (shared `ActionButtons.js`)
  - Habits reorder mode, habit stats, icon picker
  - Profile view: export/import data (the export now includes two new tables)
  - Theme toggle, sync status pill, offline banner

- [ ] **7.9** Open the PR against `main` with the guidelines' required checklist:
      `- [ ] Added/updated tests` and `- [ ] Updated docs`.

### Verification — Phase 7

- [ ] Every `grep` in Task 7.1 returns zero hits.
- [ ] All six commands in Task 7.7 exit `0`.
- [ ] Test count increased by at least the files listed in 7.3 and 7.4; no test is skipped or
      `.only`'d.
- [ ] Bundle size checked: `npm run analyze` — the fitness chunk did not grow disproportionately
      (deleting the search panel should roughly offset the new modals).
- [ ] A fresh account (new browser profile, sign in, no legacy data) completes the whole flow:
      create activity → create routine → add routine to today → save as routine → create program
      → see the tile → reload → everything persists.
- [ ] An existing account with legacy localStorage data still migrates cleanly (the migration
      preview appears, completes, and the new empty tables do not break verification).
- [ ] Manual regression pass in 7.8 shows no behaviour changes outside the fitness page.

---

## Appendix A — Files created, modified and deleted

**Created**
```
src/features/fitness/routines.js
src/features/fitness/programs.js
src/features/fitness/AddMenu.js
src/features/fitness/ProgramTile.js
src/features/fitness/ActivityLibrary/SelectableActivityTile.js
src/features/fitness/Modals/ActivityLibraryModal.js
src/features/fitness/Modals/RoutinesModal.js
src/features/fitness/Modals/RoutineBuilderModal.js
src/features/fitness/Modals/RoutinePickerModal.js
src/features/fitness/Modals/ProgramBuilderModal.js
src/features/fitness/helpers/programProgress.js
convex/routines.ts
convex/programs.ts
tests/unit/routines.test.js
tests/unit/programs.test.js
tests/unit/programProgress.test.js
```

**Renamed**
```
src/features/fitness/SearchPanel/  →  src/features/fitness/ActivityLibrary/
```

**Deleted**
```
src/features/fitness/SearchPanelModule.js
src/features/fitness/ActivityLibrary/SearchInput.js
src/features/fitness/ActivityLibrary/SearchResults.js
```

**Modified**
```
index.html                              (5 new modals, 0 removed)
src/components/Modal.js                 (open-modal stack)
src/shared/ActionButtons.js             (fitness branch rewritten, timer wiring removed)
src/core/state.js                       (routines + programs)
src/core/persistenceRouter.js           (routines + programs operations)
src/core/stateHydration.js              (routines + programs hydration)
src/core/cloudBootstrap.js              (entity types, cache, core merge)
src/core/dataManagement.js              (export tables)
src/core/migration/mergeNormalized.js   (tables)
src/core/migration/coordinator.js       (upload tables)
src/core/migration/normalizeLegacy.js   (known fields, empty tables)
src/features/fitness/FitnessView.js     (no search panel, program host)
src/features/fitness/FitnessModule.js   (new callbacks, program tile)
src/features/fitness/FitnessModals.js   (facade methods)
src/features/fitness/RestToggle.js      (+ pill and dropdown)
src/features/fitness/helpers/fitnessLayout.js  (search helpers removed)
src/styles/style.css                    (search-panel rules removed)
convex/schema.ts                        (2 tables)
convex/sync.ts, bootstrap.ts, migration.ts, dataTransfer.ts   (table lists)
docs/CODING_GUIDELINES.md, docs/PERSISTENCE_AUDIT.md, README.md, CHANGELOG.md
```

## Appendix B — Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| New entity types omitted from one of the ~14 table lists | Silent data loss, or migration checksum failure | Phase 1 verification greps every list by name; migration tests assert both keys exist |
| Modal stacking breaks body scroll-lock | Page scrolls behind an open modal | Phase 2 Task 2.1 open-modal stack, verified explicitly |
| Timezone drift in program date maths | Wrong week number and workout counts | `programProgress.js` is pure and unit-tested with fixed `todayISO`; reuse `src/shared/datetime.js` helpers only |
| Deleted activities leave dangling routine references | Crash on render or wrong counts | Read-time filtering in `getRoutineActivities()` / `getProgramScheduledDays()`, verified with an explicit delete-then-open test |
| Routine recording floods the outbox | Slow UI, transaction contention | Sequential `await` per activity, documented in code |
| Shared `ActionButtons.js` change breaks the Habits page | Regression outside fitness | Habits branch untouched; Phase 7 manual regression covers it |
| State subscription leak from modals | Growing memory, redundant renders | Store and call the unsubscribe function on close; verified by comparing `listeners.size` |

## Appendix C — Spotr influences applied

| Spotr concept | How it appears here |
| --- | --- |
| Routine-first logging | Routines modal + one-tap "Add routine" that logs a whole session |
| Structured program scheduling | Program Builder with a weekly routine schedule over a fixed date block |
| Adherence analytics | Program tile: progress bar, current week, workouts completed vs planned |
| Low-friction capture | "Save as routine" turns a session you already logged into a reusable template |
| Not adopted | AI coach, voice logging, wearable/HRV recovery data, social sharing — out of scope for a vanilla PWA with no backend inference |
