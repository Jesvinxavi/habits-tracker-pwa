# Changelog

All notable user-facing and operational changes are documented here.

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
