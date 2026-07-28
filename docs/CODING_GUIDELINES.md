# Healthy Habits Tracker – Coding & Contribution Guidelines

This document is the single source-of-truth for **how we write, structure and evolve the codebase**.
Whenever you (or the AI assistant) make a change **refer to this guide first** and follow it _strictly_ – consistency is far more valuable than personal preference.

---

## 1. Project Philosophy

1. **Vanilla-first** – The app intentionally avoids heavy frameworks. All dynamic behaviour is implemented with modern browser APIs (ES2020 Modules, DOM, `fetch`, Service Workers). Keep it that way unless there is a _very strong_ reason.
2. **Honest loading and failure states** – The app requires JavaScript. Keep the
   branded loader or an explicit authentication/storage error visible until the
   account-backed interface is safe to display.
3. **PWA & Offline** – Offline-first is non-negotiable. Persistent commands must commit to the IndexedDB outbox and optimistic cache before changing in-memory state.
4. **Mobile-first, iOS-inspired UI** – CSS/tailwind choices should always consider small touch screens first.
5. **Root-cause fixes over workarounds** – When modifying behaviour, change the underlying code or data directly instead of adding transformation layers or wrappers. Indirect solutions are only acceptable when a direct change would introduce regressions that cannot be resolved immediately; in such cases the pull-request must clearly explain (a) why the direct fix breaks, and (b) why the chosen workaround is safest for now.

---

## 2. Directory Layout & Responsibilities

```
/ (root)
├── index.html           # Single entry HTML (no framework templates)
├── src/                 # All JavaScript source code
│   ├── main.js          # Bootstraps everything (import-only, NO logic)
│   ├── core/            # App-wide state & persistence
│   │   ├── state.js     # Single source of truth – `appData`
│   │   ├── offlineDb.js # Confirmed cache, outbox, lease, backups
│   │   ├── syncEngine.js # Idempotent replay and reconciliation
│   │   └── migration/   # Pure legacy normalization and merge logic
│   ├── components/      # Re-usable UI snippets (confirm dialog, modal…)
│   └── features/        # Home, Habits, Fitness, Holidays, Stats, Profile
├── convex/              # Authenticated schema, queries, and mutations
├── tests/               # Unit, migration, Convex, and browser tests
├── public/              # Static assets only (styles, icons, manifest…)
└── docs/                # Project documentation incl. **this file**
```

• **Do not** introduce new top-level folders without updating this section.
• Feature-specific logic lives under `features/` _unless_ it is strictly UI.

---

## 3. JavaScript Conventions

1. **Language level**: ES2020. Target evergreen browsers – no transpilation.
2. **Modules**: Always use `import ... from './relative/path.js'` with the **`.js` extension included**.
3. **File naming**: `lowerCamelCase.js` for modules, `PascalCase.js` for classes/components exporting a constructor.
4. **Indentation**: 2 spaces, no tabs.
5. **Strings**: Single quotes `'` for JS, double quotes `"` for HTML/JSX strings.
6. **Semicolons**: Required. Always terminate statements.
7. **Trailing commas**: Allowed on the last item of multi-line object/array literals.
8. **Hoisting**: Prefer _function declarations_ (`export function foo() {}`) for exported APIs so they are hoisted; use arrow functions for small inner helpers.
9. **Top-level side-effects**: Restrict them to documented startup modules such
   as `main.js`, `loader.js`, and `autoToday.js`. Domain, migration, and
   validation helpers must remain side-effect free.
10. **JSDoc**: Every exported function _must_ carry a concise `/** … */` block describing params and return values.

---

## 4. State Management (`src/core`)

1. `state.js` exports **one mutable object** `appData` and helper utilities `dispatch`, `Actions`, `subscribe`, `notify`.
2. **Never** replace `appData` – always use `dispatch(Actions.actionName(...))` for state changes.
3. **Always** use `dispatch(Actions.actionName(...))` to change state so subscribers are notified.
4. **Never** access `appData` directly for reading state - use `Selectors` instead.
5. Add new persistent fields to `appData` **together** with migration logic inside `ensureHabitIntegrity` (or a dedicated helper).
6. **Persistence**: In `cloud` mode, Convex is authoritative and `habitsConvexCache` stores confirmed cache/outbox data. Whole-state localStorage/legacy IndexedDB writes are forbidden. `legacy` mode remains available only for safe rollout and recovery.
7. **Ownership**: Backend functions derive `ownerKey` from `ctx.auth.getUserIdentity()` and never accept it as a public argument.
8. **Hydration**: Server/cache hydration actions carry a source marker and must never create outgoing operations.

---

## 5. UI Modules (`src/ui` & `src/components`)

1. Each feature exposes an initialization boundary. The visible Home feature is
   initialized during startup; other feature modules are loaded by navigation
   or on first interaction.
2. **Pure HTML builders**: Functions like `createHabitItem()` must only _return_ template strings – no DOM side effects.
3. **DOM mutations**: Performed via `element.insertAdjacentHTML()` or through standard DOM APIs – never use `innerHTML = ...` if avoidable (security).
4. Keep UI code free of business logic – call utilities from `utils/` and `features/` instead.
5. **Accessibility**: Buttons need `aria-label`; colour-only indicators must have textual fallback.
6. **Icons**: Reuse the established Material Icons or inline SVG patterns. Every
   icon-only control requires an accessible name.

### Calendar Components

Calendar components use the **CalendarController** API for consistent behavior:

```javascript
/**
 * @typedef {Object} CalendarController
 * @prop {Promise<void>} ready            Resolves after DOM & fonts ready
 * @prop {(d:Date)=>void} setDate         Selects new date, re-renders
 * @prop {(o?:{instant?:boolean})=>void} scrollToSelected
 * @prop {()=>void} destroy
 */
```

**Usage Pattern:**
```javascript
// Wait for calendar to be ready before centering
await HomeCalendar.ready;
HomeCalendar.scrollToSelected({ instant: true });

// For user interactions, use smooth scrolling
HomeCalendar.scrollToSelected(); // defaults to smooth
```

**Scroll Helper:**
```javascript
import { centerOnSelector } from '../components/scrollHelpers.js';

// Center an element within its scrollable parent
centerOnSelector(parent, '.day-item.current-day', { instant: false });
```

**Key Points:**
- Always await `calendar.ready` before calling `scrollToSelected`
- Use `{ instant: true }` for initial mount and programmatic changes
- Use smooth scrolling (default) for user interactions
- The double `requestAnimationFrame` pattern ensures iOS A2HS compatibility

---

## 6. Styling (Tailwind CSS)

1. Tailwind is compiled locally through PostCSS. Never add the Tailwind CDN
   runtime to production.
2. Custom colours, content scanning, and font families are defined in
   `tailwind.config.cjs`.
3. Use existing iOS colour variables (`ios-blue`, `ios-orange`, …) to stay on-brand.
4. Whenever dynamic colours are needed, compute Tailwind utility class via helper maps (`utils/constants.js`).

---

## 7. Service Worker & PWA

1. PWA generation is configured through `vite-plugin-pwa` in `vite.config.js`.
2. Precache the application shell and static assets only.
3. Never runtime-cache Clerk or Convex API traffic.
4. Service-worker updates must not clear IndexedDB account caches or outboxes.

---

## 8. Commit & Branching Strategy

1. **Conventional Commits** (`type(scope): subject`): `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`.
2. Each feature/fix should live on a dedicated branch and open a Pull Request.
3. PR description must reference issue ID and checklist:
   - [ ] Added/updated tests
   - [ ] Updated docs (incl. this file if structure changes)

### 8.1 Branching model

```
main    ← production. GitHub Pages deploys from here. Only ever advanced by a release PR.
develop ← integration. Every feature PR targets this. CI runs; nothing deploys.
feature ← one branch per feature/fix, branched from develop.
```

1. **Never open a feature PR against `main`.** Feature and fix branches target `develop`.
2. `main` moves only via a **release PR from `develop`**, opened when `develop` is verified
   sound. That merge is the deploy — `.github/workflows/deploy.yml` triggers on push to `main`.
3. `.github/workflows/ci.yml` runs on every pull request regardless of base, so work merged into
   `develop` is fully gated (lint, unit, migration, Convex types, build, Playwright).
4. If a hotfix ever lands directly on `main`, **back-merge `main` into `develop` immediately**,
   or the next release will silently revert it.

### 8.2 Merge strategy

1. **Squash & merge** is the default for a self-contained feature branch — it keeps `develop`
   readable and drops fixup commits nobody needs permanently.
2. **Use a merge commit when another branch is stacked on the PR's head.** Squash *and*
   rebase-merge both rewrite SHAs; the dependent branch's base commits become orphans and it has
   to be rebased. A merge commit preserves the original SHAs, so the stacked branch stays valid
   and its PR shows only its own commits.
3. **Use a merge commit for release PRs (`develop` → `main`).** Squashing a release would
   collapse several independent features into one commit and destroy `git bisect`'s ability to
   attribute a regression to the feature that caused it.
4. The rule underneath all three: **never rewrite history that another branch is already built
   on.**

---

## 9. Testing

1. Use Vitest for pure logic, reducers, migration, and IndexedDB behavior.
2. Use `fake-indexeddb` for deterministic storage tests.
3. Use Playwright for browser/PWA, authentication-gate, and offline/reconnect flows.
4. Every persistent mutation requires success, duplicate, stale revision, validation, ownership, parent, tombstone, and cascade coverage.

---

## 10. Adding New Code – Checklist

- [ ] Chosen correct directory?
- [ ] Module exported correctly with hoisted function declarations?
- [ ] Added JSDoc?
- [ ] Followed naming, lint & style rules?
- [ ] No direct DOM access in utils?
- [ ] Updated `CACHE_NAME` & manifest if static asset added?
- [ ] Updated docs/tests & this guide if behaviour changed?

---

## 11. Linting & Formatting

ESLint, Vitest, Convex type-checking, production build, and Playwright smoke tests run in CI.

---

## 12. Future Improvements (track in GitHub Issues)

• Expand authenticated browser coverage for reconnect and conflict flows
• Add self-service export, reset, rollback, and account deletion UI
• Enable retention maintenance only after production evidence and review

---

**Remember: Change the code _only_ after validating against this guide.**

## Fitness Activities Card Design Specification

### Habit Tile Structure (Reference Implementation)

Based on audit of `src/ui/home.js` habit cards, the following structure and styling must be replicated for activity tiles:

#### DOM Hierarchy:

```
.swipe-container (relative, overflow-hidden)
├── .restore-btn/.skip-btn (absolute, top-0, right-0, h-full, width:20%, bg-red-600/orange-500)
└── .swipe-slide (transition-transform, width:100%, position:relative, z-index:1, bg-white, border-radius:0.75rem)
    └── .habit-card/.activity-card (flex, items-center, px-3, py-2, rounded-xl, width:100%, margin-bottom:0)
        ├── .habit-icon/.activity-icon (w-9, h-9, flex-shrink-0, rounded-full, flex, items-center, justify-center, mr-1, text-xl, border:2px solid {category.color}, color:{category.color})
        ├── .habit-content/.activity-content (flex-grow)
        │   ├── .habit-name/.activity-name (font-semibold, leading-tight)
        │   └── .category-pill (inline-block, whitespace-nowrap, px-2, py-0.5, rounded-lg, text-xs, font-medium, mt-0, background:{category.color}, color:#fff, border-radius:8px)
        └── .activity-meta (flex, items-center, gap-2)
```

#### Key Styling Requirements:

- **Border**: Category-colored 2px solid border on icon circle
- **Icon**: Category color for both border and text
- **Background**: White with border-radius 0.75rem on slide element
- **Category Pill**: Background uses category color, white text, 8px border-radius
- **Indentation**: Activity cards must have `pl-4` (1rem left padding) for indentation from category header
- **Card Spacing**: `margin-bottom: 0.25rem` on outer container
- **Swipe Button**: Delete button with `bg-red-600`, white "Delete" text, 20% width

#### Indentation Specification:

- Activity tiles should be indented with `pl-4` class (1rem) relative to category headers
- This creates visual hierarchy showing activities belong to their category section

#### Action Button Specification:

- Background: `#DC2626` (Tailwind red-600)
- Text: "Delete" in white color
- Font weight: 600 (font-semibold)
- Position: Absolute right side, 20% width of container

### Consistency Requirements:

- Both habit and activity tiles must maintain identical visual appearance
- Category colors must be applied consistently across icon borders and category pills
- Swipe behavior and timing must be identical (20% width threshold, 0.2s transition)
- Dark mode compatibility required for all elements

## Fitness Activities Card Implementation

### Overview

The fitness page activity tiles now use the exact same visual design and interaction patterns as habit tiles from the home page, ensuring a consistent user experience across views.

### Key Implementation Details:

#### Swipe Integration

- Uses shared `makeCardSwipable()` helper from `src/components/swipeableCard.js`
- Maintains identical swipe thresholds, timing, and button positioning
- Delete action integrated with existing `deleteRecordedActivity()` function

#### Visual Consistency

- Activity cards use identical DOM structure to habit cards
- Category-colored borders on icons (2px solid)
- Same typography, spacing, and rounded corners
- Proper indentation (`pl-4`) relative to category headers

#### Scroll Behavior

- Dedicated `adjustActivitiesContainerHeight()` function mirrors home page behavior
- Fixed header/calendar with scrollable activities section only
- Responsive to window resize events

#### Accessibility & Themes

- Full dark mode support with appropriate color variants
- Proper ARIA labels for screen readers
- Touch actions configured for optimal mobile experience

### Maintenance Notes:

- Any visual changes to habit tiles should be mirrored in activity tiles
- Shared swipe component ensures behavioral consistency
- Category color usage follows established patterns

---

## 12. Fitness Modals, Routines and Programs

Added by the fitness overhaul. Read this before touching anything under
`src/features/fitness/`.

### 12.0 Never await a raw animation frame

`requestAnimationFrame` does not fire while the page is hidden. Anything that
**awaits** a frame therefore stalls indefinitely in a background tab — and
startup used to do it twice, in `navigation.js` and in the loader, so a page
opened in a background tab loaded its data and then sat behind the loading
screen until someone looked at it.

Await `nextPaint()` from `src/shared/nextPaint.js` instead: it resolves at once
when `document.hidden` (nothing can flash on a surface that is not painting) and
otherwise races the frame against a 150ms backstop. Fire-and-forget
`requestAnimationFrame` callbacks — the ones that reposition something once it
is on screen, like `centerHorizontally()` — are fine as they are, since nothing
waits on them.

### 12.1 Modal stack and z-index ladder

`src/components/Modal.js` keeps a module-level `openStack`. `openModal(id)`
pushes and locks body scrolling; `closeModal(id)` pops and only restores
scrolling once the stack is empty. Two helpers exist for stack-aware behaviour:

- `isModalOpen(id)` — whether a modal is currently open. Use it to guard state
  subscriptions so a closed modal does not re-render.
- `topModalId()` — the innermost open modal. **Every Escape handler must check
  this**, or pressing Escape over a stacked modal closes the wrong one.

Never reset `document.body.style.overflow` directly; let `closeModal` decide.

| Modal | id | z-index |
| --- | --- | --- |
| Activity Library | `activity-library-modal` | `z-[1001]` |
| Routines | `routines-modal` | `z-[1001]` |
| Add/Edit Activity | `add-activity-modal` | `z-[1002]` |
| Routine Builder | `routine-builder-modal` | `z-[1002]` |
| Program Builder | `program-builder-modal` | `z-[1002]` |
| Activity Picker (multi-select) | `activity-picker-modal` | `z-[1003]` |
| Routine Picker (multi-select) | `routine-picker-modal` | `z-[1003]` |
| Activity Details | `activity-details-modal` | `z-[1003]` |
| Icon Selection | `icon-selection-modal` | `z-[1004]` |
| Global confirm | `global-confirm-modal` | `z-[1100]` |

The two pickers sit at `1003` because they open **over** the routine and program
builders at `1002`. They never coexist with Activity Details, which shares that
level.

New modal markup lives in `index.html` in ascending z-order, and every modal
module binds its permanent handlers once behind a `modal.dataset.listenerAttached`
guard.

### 12.2 Archiving, not deleting

Removing an activity or a routine sets `archivedAt` — an update, never a delete.
The row stays, so everything that already points at it still resolves: recorded
sessions, past program days, stats. Deleting outright took the history with it.

- `listActivities()` / `getRoutines()` — what the library, the pickers and the
  routines list show. Archived items are gone from all of them.
- `getActivity(id)` / `getRoutine(id)` — resolve **whatever the id names**,
  archived or not. Every historical surface goes through these.
- `getProgramScheduledDays()` drops archived targets, so they leave the plan the
  builder edits and what today asks for. **Progress passes
  `{ includeArchived: true }`** and lets `plannedSlots()` apply the date cutoff:
  filtering them out there instead erased the days they were pinned to before
  they were archived, which is the history the archive exists to protect.

An archived activity's recorded cards stay on the days they were done, carrying
a **Deleted** pill on the row below the name. They are inert apart from swipe-to-delete: no details modal,
and no "Add sets & details" prompt, since there is nothing left to add them to.
`ActivityInfoModal` closes itself if the activity it is showing is archived,
which also covers deleting from the editor stacked on top of it.

There is no restore path in the UI yet. The data is all there — `archivedAt` is
a single field to clear — but nothing surfaces it.

**Names and categories follow the activity, not the record.** A record snapshots
`activityName` and `categoryId` when written, but only as a fallback for a
session whose activity is missing entirely. Cards and grouping resolve the live
activity by id (`recordActivityView()`), so renaming an activity renames every
session of it and moving it between categories moves its history with it. The
reducer deliberately does **not** patch record rows on rename: it used to, while
the server did not, so the two disagreed after a reload.

### 12.3 Read-time referential integrity

Deleting an activity does **not** rewrite routines, and deleting a routine does
**not** rewrite programs. Cascading edits would bump revisions on records the
user never touched, producing spurious sync conflicts and breaking migration
checksums. Dangling ids are filtered where they are read:

- `getRoutineActivities(routineId)` — drops activity ids with no live activity.
  **The only place UI should read a routine's activities.**
- `getProgramScheduledDays(programId)` — drops entries whose routine or activity
  is gone, or whose weekday the program marks as rest. `getProgramProgress()`
  measures against this filtered schedule, so a deleted routine leaves no
  unfillable slot behind.
- `getProgramSchedulePhases(programId)` — a program's superseded schedules.
  Unlike the live one it keeps archived targets: a phase is history, and the
  days in it were planned with those items.

Counts shown to the user must come from these filtered reads, so a routine
referencing deleted activities reports honestly.

### 12.4 Recording several things at once

`recordActivitiesForDate(activityIds, isoDate)` in `fitness/activities.js` is the
single entry point for batch recording. It owns the rest-day guard, the
sequential outbox writes and the partial-failure dialog.
`recordRoutinesForDate(routineIds, isoDate)` resolves routines to activity ids
and delegates, so adding two routines shows **one** Rest Day dialog rather than
one per routine.

Writes are sequential (`await` in a loop, not `Promise.all`): each call commits
an operation to the IndexedDB outbox, and serialising keeps outbox ordering
deterministic. Batch-created records deliberately carry no `duration`,
`intensity` or `sets` — the card renders without metric pills and the user taps
it to fill details in. This is intended behaviour, not a missing field.

### 12.5 Program scheduling

A program is its `scheduledDays`: routines and single activities pinned to
weekdays. A weekday may hold **several** items, so the stored shape allows
repeated `dayOfWeek` entries, and each entry sets exactly one of `routineId` /
`activityId`. There is no second bucket and no mode switch — the pinned day says
where a session belongs, not when it is allowed to count.

`restDays` on the program is a list of **weekday indices** (0 = Sunday), distinct
from `appData.restDays`, which is a map of specific date keys. They act on
different halves of the problem: the weekday list shapes the **plan**, so no slot
is ever placed on a program rest weekday — but it does not veto **work**, and a
session trained on one still counts towards its week. Marking a single date as
rest leaves that date's slots standing (the work moves elsewhere in the week) and
excludes that date from holding a session.

Editing a running program **only affects the future**. So does archiving: an
item is planned right up to the day it was archived and not after.

Credit opens with the week the program was **created** in (`creditFrom`, the
Monday of `program.createdAt`). A backdated block still plans the weeks before
it existed, but nothing recorded in them counts — those sessions were not done
for this plan, and crediting them made a block look part-finished the moment it
was saved. A session earlier in the creation week does count, so making a
program on Wednesday still credits that Monday. The schedule in force
until the edit is closed off as a `schedulePhases` entry — `{startDate, endDate,
scheduledDays, restDays}`, ending yesterday — and the live `scheduledDays` apply
from today on. `plannedSlots()` expands each date against the schedule that was
in force on it (see `scheduleSegments()`), so a week that has already happened
keeps the plan it was measured against: work the edit deleted stays ticked, and
work the edit added never appears in a week the user could not have done it in.
`planUpdateWithHistory()` decides whether a split is needed — it is not, when the
block has not started, when the current schedule has not been in force for a full
day, or when nothing about the week changed. A closed phase also snapshots each
routine's activity ids (`routineSnapshots`), so editing a routine's contents
later cannot change whether a week that has already happened was completed: past
slots match against the routine **as it was**, current ones against the routine
as it is.

`scheduleMode` and `anytimeRoutines` are **retired**. Nothing writes or reads
them, but both stay declared as optional in the Convex schema, and the server
still validates `anytimeRoutines` when a stale client sends it — rows written
before the change still hold values and would otherwise fail validation.
`stateHydration.js` drops both on the way in.

All progress maths lives in `helpers/programProgress.js` as **pure functions** —
no DOM, no `getState()`. Pass data in; `getProgramProgress()` in `programs.js` is
the one place that feeds it from state, so the tile and the details modal can
never disagree. Dates are converted with an explicit UTC time component
(`Date.parse(`${key}T00:00:00.000Z`)`); never parse a bare date string, or day
counts drift across DST boundaries.

Weeks are **calendar weeks, Monday to Sunday**. A block starting mid-week gets a
short first week rather than shifting every later week off the calendar, and the
final week is short for the same reason — "Week 3" has to mean the same span in
the app as it does on a wall planner. The rest-day selector runs Monday-first for
the same reason. `programWeeks()` owns that partition and `currentWeek()` reads
its position from it; nothing recomputes week boundaries elsewhere.

Progress is workout-based, and the unit is a **slot**: one pinned item on one
date. A slot is satisfied by a session anywhere in its week, settled by
allocation rather than a per-date lookup — `allocateWeek()` sweeps every open
slot twice: first for a session on the slot's **own day**, then for one
**anywhere else in that week**, earliest first.

Both passes require a **match**: the session must hold the slot's activity, or —
for a routine slot — one of that routine's activities. Training the program did
not ask for earns nothing. Ticking Tuesday's squats off because the user swam on
Tuesday would say something untrue, and it would then hide Tuesday's real session
from the details modal, which reads its "what's next" from the same allocation.

A claim consumes only the activities it recognises, so one day can satisfy two
slots the user genuinely trained for — a routine and a separate run — while no
session is ever spent twice. Credit never crosses a week boundary, so a burst in
one week cannot cover the next.

### 12.6 The program details modal

Order is deliberate: the block's name and dates (with **Edit** as a small button
inside that tile), then **today's** session, then progress, then notes. The
session card always answers for *today*, never for the day the fitness page is
showing — the user scrolling the page back to last Tuesday must not change what
"what am I doing now" says, and **Add to today** records against today to match.
When today is already logged, or holds nothing (a rest day, or a gap in the
schedule), the card shows the next day the program does schedule something,
named, and hides the add button. A quiet day reads as what is coming rather than
as a dead end.

The week list shows everything up to and including the current week; later weeks
wait behind a disclosure, since the plan ahead is not what the user came for. One
week is expanded at a time, seeded with the current week on open and held on the
modal so a re-render does not collapse what is being read.

Progress bars are graded — red to 33%, amber to 66%, green above — on both the
block bar and each week's. Colour is never the only cue: every bar sits beside
its own *n/m* count.

### 12.7 The routines modals

`RoutinesModal` and `RoutinePickerModal` follow the activity library and picker:
**New** lives in the modal header, and a search sits between the header and the
list. The library-style search (icon, clear button) is for the management list;
the picker gets the picker's plainer filter input. Filtering the picker is a view
over the list and never touches `_selectedIds` — a routine picked before typing
is still confirmed afterwards.

### 12.8 Adding a program's day

A program **never records anything by itself**. Saving one plans days; filling
them is always a user action — "Add today's program" in the `+` dropdown, or
"Add to today" in the details modal. Both go through
`addProgramRoutinesToDate(isoDate)`, which writes only the scheduled activities
that are **not already on that date**. A day holding unrelated training, or half
the session logged by hand, can still be topped up without stacking duplicates.

Its result carries `scheduled` — how much the program wanted for that day —
which is how a caller distinguishes "the program plans nothing here" from "it is
all already recorded", and shows the right dialog for each.

The old `programPreload` preference and `preloadProgramDayIfEnabled()` are gone,
along with the Profile switch. The field survives as optional in the Convex
schema so preference rows written before the removal still validate.

### 12.9 Contrast

The program tile fills left-to-right like a home target-habit card, but with a
translucent fill (`0.45` alpha) rather than home's solid category colour: solid
leaves gray-900 text at 4.42:1 and white at 4.02:1, both under AA. Solid pills
use `#0060C7`, not `ios-blue` — white on `#007AFF` is 4.02:1, while the deeper
shade reaches 6.0:1. `tests/e2e/fitness/program-tile.spec.js` measures every
label's blended contrast and asserts `>= 4.5`, so a colour change cannot silently
regress it.
