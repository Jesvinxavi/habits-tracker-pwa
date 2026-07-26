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
npm run test:unit
npm run test:migration
npm run test:convex
npm run build
npm run test:e2e
```

## Deployment

GitHub Actions verifies the application, deploys Convex functions when
`CONVEX_DEPLOY_KEY` is configured, builds the PWA with protected environment
configuration, and publishes the artifact to GitHub Pages.

Production must use separate Clerk and Convex instances from development.
Review the release checklist before promoting a build.

## Documentation

- [Release notes](docs/RELEASE_1.0.0.md)
- [Privacy notice](docs/PRIVACY.md)
- [Support and account-data requests](docs/SUPPORT.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Release risk register](docs/RELEASE_RISK_REGISTER.md)
- [Convex migration and recovery runbook](docs/CONVEX_MIGRATION_RUNBOOK.md)
- [Persistence audit](docs/PERSISTENCE_AUDIT.md)
- [Loading performance audit](docs/LOADING_PERFORMANCE_AUDIT.md)
- [Coding guidelines](docs/CODING_GUIDELINES.md)

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
