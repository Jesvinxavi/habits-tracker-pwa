# Loading Performance Audit

## Scope

This audit covers the signed-in warm-launch path on the local Vite server using
the same Chrome profile, account, device cache, and network connection before
and after the changes.

## Baseline

The application remained behind the loading screen for approximately 2.56
seconds.

The critical path included work that was not required to display Home:

- Loading the complete Clerk component UI for an already signed-in user.
- Waiting for Convex authentication, profile provisioning, and the core query.
- Querying and caching a three-year history window.
- Re-reading all legacy persistence sources on every launch.
- Loading and mounting hidden Fitness and Statistics views.
- Initializing the complete habit form before it was opened.
- A 220 ms loader exit transition.

## Implemented changes

- Clerk core authentication loads independently from the large component UI.
  The sign-in and account-management UI is downloaded from the account's Clerk
  frontend only when it is opened.
- A returning user can open a matching, server-confirmed account cache after
  Clerk validates the signed-in identity. Convex authentication, history
  refresh, subscriptions, and outbox replay continue in the background.
- Cache access validates the Clerk user, offline lease owner, active generation,
  and migration state before displaying data.
- Legacy source inspection is skipped on devices whose migration inspection was
  already verified. Unverified devices still inspect legacy sources before the
  fast path is permitted.
- Cache entity types are read concurrently instead of through sequential
  IndexedDB transactions.
- The visible Home view is the only feature view initialized before reveal.
  Fitness and Statistics remain navigation-loaded.
- The habit form initializes on first use.
- The loader transition was shortened to 140 ms while preserving the atomic
  hydrated-view handoff.
- Lightweight startup phase marks are exposed on the root element as
  `data-startup-timings` for repeatable diagnostics.
- Startup no longer waits on an animation frame that a hidden page never
  produces. `navigation.js` awaited a pair of `requestAnimationFrame` callbacks
  and the loader awaited three more, so a page opened in a background tab
  finished loading its data and then sat behind the loading screen until the tab
  was looked at — `initializeNavigation()` never returned, so the reveal was
  never reached. Both await `nextPaint()` (`src/shared/nextPaint.js`), which
  resolves at once on a hidden page and races a 150 ms backstop on a visible
  one. Measured on a hidden tab: previously indefinite, now `visible` at 267 ms.
- Removing the bundled Clerk component UI reduced the generated service-worker
  precache from about 3.95 MiB to about 2.05 MiB.

## Result

The same warm signed-in launch reached the usable Home screen in approximately
0.70 seconds, a reduction of about 73%.

Representative optimized phase timings:

| Phase | Time from navigation |
|---|---:|
| Bootstrap begins | 106 ms |
| Clerk confirms the signed-in session | 434 ms |
| Confirmed cache hydrated | 437 ms |
| Home initial render complete | 516 ms |
| Loader transition complete | 669 ms |

Convex authentication and canonical refresh continue after Home becomes usable.
New accounts, expired leases, generation changes, unresolved migrations, and
devices without a confirmed cache intentionally remain on the fully verified
network path.
