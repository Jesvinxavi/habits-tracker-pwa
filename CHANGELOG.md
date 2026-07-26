# Changelog

All notable user-facing and operational changes are documented here.

## [Unreleased]

### Added

- Routines: named, ordered sets of activities, created and edited from a
  Routines modal reached by the new **Routines** button
- Training programs with a fixed date block and one of two scheduling modes —
  a prescriptive weekly schedule where a weekday may hold several routines, or a
  flexible mode with weekly targets that can be met on any day
- Program rest days chosen from a weekday selector matching the habit schedule
  picker; rest weekdays drop out of the schedule entirely
- Program adherence tile on the fitness page showing the date range, current
  week, sessions completed against planned, and a fill that tracks progress
- Activity Library modal replacing the inline expanding search panel, with an
  always-visible filter and a **+ New** button
- Multi-select activity and routine pickers behind the `+` menu, so several
  activities or whole routines can be logged in one action
- **Save as routine**, turning a day's recorded activities into a reusable
  routine with duplicates collapsed
- `Preload program routines` preference: when enabled, opening a scheduled day
  fills it with that day's routines; otherwise routines are added on demand from
  the `+` menu or the program builder
- `routines` and `programs` threaded through the full persistence chain — Convex
  schema and mutations, sync, bootstrap, migration, export, offline cache and
  outbox, state and hydration

### Changed

- The fitness page's action buttons are now **Activity** and **Routines**; the
  timer moved into the `+` menu and keeps all of its behaviour
- The routine builder lists only the activities chosen for the routine, with
  browsing delegated to the activity picker
- The fitness empty state points at the **Activity** button rather than a
  "Record Activity" control that never existed

### Fixed

- Closing a stacked modal no longer restores page scrolling while a modal
  underneath is still open
- A sync replay requested while a replay was already running is no longer
  dropped, which previously left the last operation of a batch stranded in
  `pending` until an unrelated dispatch
- `FitnessView` passed the rest-toggle a bare callback where an options object
  was expected, so its `onToggle` had never fired

### Removed

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
