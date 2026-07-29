# Changelog

All notable user-facing and operational changes are documented here.

## [Unreleased]

### Added

- Routines: named, ordered sets of activities, created and edited from a
  Routines modal reached by the new **Routines** button, with a search and a
  **New** button in its header
- Training programs: a fixed date block with a weekly schedule of routines and
  single activities pinned to weekdays, any weekday holding several
- Program rest days chosen from a Monday-first weekday selector; rest weekdays
  drop out of the schedule entirely
- Program adherence tile on the fitness page showing the date range, current
  week, sessions completed against planned, and a fill that tracks progress
- Program details modal: today's session, then progress week by week — one pill
  per calendar week with its own bar, opening onto the days it plans and what
  has been ticked off them
- Weekly credit: a session counts towards the day it was pinned to as long as it
  falls in the same week, whether it was done before that day or after
- Schedule history: editing a running program only changes it from today, so
  weeks that have already happened keep the plan they were measured against
- Activity Library modal replacing the inline expanding search panel, with an
  always-visible filter and a **+ New** button
- Multi-select activity and routine pickers behind the `+` menu, so several
  activities or whole routines can be logged in one action
- **Save as routine**, turning a day's recorded activities into a reusable
  routine with duplicates collapsed
- `routines` and `programs` threaded through the full persistence chain — Convex
  schema and mutations, sync, bootstrap, migration, export, offline cache and
  outbox, state and hydration
- Separate build targets for GitHub Pages and a local server, with
  `npm run preview:phone` for testing on a phone over the local network; see
  `docs/operations/BUILD_AND_DEPLOY.md`
- Regression gates for Fitness render delivery, large-account state reads,
  lazy modal recovery, offline modal chunks, and bundle budgets

### Changed

- Deleting an activity or a routine now **archives** it: the sessions already
  recorded against it are kept, along with the days a program had planned it on
  before the deletion. It leaves the library, the pickers and the plan going
  forward, and its recorded cards carry a **Deleted** pill
- Renaming an activity, or moving it to another category, applies to every
  session of it, past ones included
- Program weeks are calendar weeks, Monday to Sunday, so a block starting
  mid-week gets a short first week rather than shifting every later week
- A program slot is only satisfied by a session for that activity, or one in
  that routine; unrelated training no longer ticks it off
- A backdated program credits nothing from the weeks before it was created
- The fitness page's action buttons are now **Activities** and **Routines**; the
  timer has its own button beside the `+`
- The routine builder lists only the activities chosen for the routine, with
  browsing delegated to the activity picker
- Activity Library and Add Activities categories now share a smooth,
  reduced-motion-aware collapsible disclosure
- Fitness state reads use a stable snapshot, activity batches notify once, and
  inactive top-level pages stop rendering until revisited
- Fitness modal shells and code load on demand rather than living in the startup
  DOM and entry chunk
- The fitness empty state points at the `+` rather than a "Record Activity"
  control that never existed

### Fixed

- Deleting a second activity in one session did nothing until a reload: the
  editor's delete button acted on whichever activity had been opened first
- Deleting an activity erased it from the program weeks it had already been
  planned in, instead of only from the plan going forward
- Startup stalled indefinitely in a background tab. Two steps awaited an
  animation frame, which browsers do not run while a page is hidden, so the app
  loaded its data and then sat behind the loading screen until the tab was
  looked at
- Closing a stacked modal no longer restores page scrolling while a modal
  underneath is still open
- A sync replay requested while a replay was already running is no longer
  dropped, which previously left the last operation of a batch stranded in
  `pending` until an unrelated dispatch
- `FitnessView` passed the rest-toggle a bare callback where an options object
  was expected, so its `onToggle` had never fired
- The performance workflow built for GitHub Pages and served the result from the
  root, so Lighthouse was scoring a page whose assets all 404'd
- The first Fitness visit after a hard reload no longer exposes the calendar at
  its first date or animates it to Today; returning from another page after
  selecting a different date still performs the intended Today sweep
- The program tile no longer briefly replaces an identical first-load DOM tree,
  and activity-category expansion now uses one uninterrupted animation clock

### Removed

- The two program scheduling modes and the "anytime that week" bucket: one
  model remains, and a pinned day already counts anywhere in its week
- The `Preload program routines` preference. A program never records anything by
  itself; its day is added from the `+` menu or the details modal, which now
  tops a day up rather than refusing one that already holds training
- The inline expanding search panel, its expand/collapse and blur machinery, and
  the dead CSS and layout helpers that supported it
- Timer button state code targeting the removed `#start-timer-btn`

## [1.0.0] - 2026-07-26

### Added

- Clerk account authentication and profile management
- Convex normalized account storage and realtime subscriptions
- Per-account IndexedDB confirmed cache and durable offline outbox
- Thirty-day offline authorization lease for previously authenticated devices
- Idempotent operation replay, dependency ordering, and three-way conflict
  handling
- Atomic generation-based legacy migration with raw backups and checksums
- Additional-device preview and merge support
- Profile tab for account, synchronization, and preference controls
- Vitest, fake-indexeddb, Convex type-checking, migration fixtures, and
  Playwright smoke coverage
- Production Tailwind/PostCSS build pipeline
- Release, privacy, support, recovery, and performance documentation

### Changed

- Convex is the authoritative store for cloud-mode account data
- Habit and fitness history are normalized instead of embedded in large state
  objects
- Returning signed-in launches use a verified cache-first path while Convex
  reconciles in the background
- Warm signed-in startup improved from approximately 2.56 seconds to
  approximately 0.6–0.7 seconds in the audited development environment
- Fitness, Statistics, habit forms, and Clerk account components load on demand
- Calendar navigation and date selection now update on the first interaction
- Holiday period and category/activity mutations refresh immediately
- The branded loading screen remains visible until the hydrated account view is
  ready
- First-time navigation keeps the current page visible until the lazy-loaded
  destination is fully mounted, with idle preloading for all top-level pages

### Fixed

- Persistent changes failing to reach the database
- Holiday selections and periods failing to survive refresh
- Categories and activities appearing to save without rendering
- Holiday-period lists requiring an unrelated second action to update
- Double-tap behavior in Fitness calendar navigation
- Incorrect Fitness Today navigation
- Startup flashes of the empty Home template and redundant account-checking view
- Progress-ring rotation, global typography regressions, and page positioning
- Holiday-mode toggle animation regression

### Security and privacy

- Removed tracked dependency directories and macOS metadata
- Kept secrets out of browser configuration and source control
- Added authenticated ownership checks, strict validators, tombstones,
  generation isolation, and exact-target legacy cleanup guidance
