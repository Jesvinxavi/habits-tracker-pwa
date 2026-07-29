# Healthy Habits Tracker

Healthy Habits Tracker is an installable, offline-capable PWA for habit
schedules, completion history, holidays, fitness activities, rest days, and
progress statistics.

The current release uses Clerk for account authentication and Convex as the
authoritative account-data store. IndexedDB provides a confirmed per-account
cache and a durable offline outbox, so an authenticated device can continue
working without a connection and reconcile changes later.

## Product capabilities

- Daily, weekly, biweekly, monthly, and yearly habit schedules
- Completion targets, progress, skips, pause state, and ordering
- Holiday periods and individual holiday dates
- Fitness activity definitions, history, sets/reps, timed records, and rest days
- Reusable routines: named, ordered sets of activities logged in one action
- Training programs with a fixed date block and either a prescriptive weekly
  schedule or flexible weekly targets, plus an adherence tile on the fitness page
- One-tap adding of a program's scheduled session to a day
- Derived habit and fitness statistics
- Realtime multi-device updates
- Thirty-day device-local offline authorization lease
- Durable offline writes with idempotent replay and conflict detection
- Dark mode and synchronized display preferences
- Installable PWA shell with controlled updates

## Architecture

```text
Vanilla JavaScript feature UI
        ↓
State compatibility layer and domain persistence router
        ↓
IndexedDB confirmed cache + durable operation outbox
        ↓
Authenticated Convex queries and mutations
        ↓
Normalized, generation-scoped account data
```

- `src/core/` contains authentication, persistence routing, cache hydration,
  synchronization, migration, and state management.
- `src/features/` contains the Home, Habits, Fitness, Holidays, Statistics, and
  Profile interfaces.
- `convex/` contains the authenticated schema, queries, mutations, migration,
  export/import, reset, and maintenance functions.
- `tests/` contains Vitest, fake-IndexedDB, migration, Convex, and Playwright
  coverage.

## Local development

Requirements:

- Node.js 20.19 or newer
- npm
- A Clerk application with its Convex integration enabled
- A Convex development deployment

```bash
npm ci
cp .env.example .env.local
npx convex dev
npm run dev
```

Configure `.env.local` with public browser values:

```text
VITE_DATA_BACKEND=cloud
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Set `CLERK_JWT_ISSUER_DOMAIN` in the Convex deployment. Never place Clerk
secret keys or Convex deploy keys in a `VITE_*` variable.

## Validation

```bash
npm run lint
npm run check:dead-code
npm run test:unit
npm run test:migration
npm run test:convex
npm run build:local
npm run check:bundle
npm run test:e2e
npm run test:pwa
```

## Building and deploying

There is no plain `npm run build`: a build is made either for GitHub Pages or for
a local server, and the two bake different asset paths into `index.html`.
`vite build` refuses to guess.

```bash
npm run build:pages     # GitHub Pages  (base /habits-tracker-pwa/)
npm run build:local     # a local server (base /)
npm run preview:local   # build local, serve on http://localhost:4180
npm run preview:phone   # the same, reachable from a phone on the same Wi-Fi
npm run deploy          # build:pages, then publish to the gh-pages branch
```

`docs/operations/BUILD_AND_DEPLOY.md` explains what goes wrong when the two are
mixed up, and how to clear a stale service worker.

GitHub Actions verifies the application, deploys Convex functions when
`CONVEX_DEPLOY_KEY` is configured, builds the PWA with protected environment
configuration, and publishes the artifact to GitHub Pages.

Production must use separate Clerk and Convex instances from development.
Review the release checklist before promoting a build.

## Documentation

The [documentation index](docs/README.md) groups current engineering guidance,
operations, policies, release material, architecture evidence, and historical
Fitness implementation records.

- [Build and deployment guide](docs/operations/BUILD_AND_DEPLOY.md)
- [Coding guidelines](docs/development/CODING_GUIDELINES.md)
- [Fitness documentation](docs/fitness/README.md)
- [Release notes](docs/release/RELEASE_1.0.0.md)
- [Privacy notice](docs/policies/PRIVACY.md)
- [Support and account-data requests](docs/policies/SUPPORT.md)

## Data safety

- Backend ownership is derived from the authenticated identity.
- Public functions never accept an account ownership key.
- Migration data is invisible until checksum verification and one atomic
  generation activation.
- Explicit sign-out revokes offline access and removes that account's readable
  browser cache after pending operations are handled.
- Legacy browser data is retained during the initial migration period for
  recovery.

## License

MIT.
