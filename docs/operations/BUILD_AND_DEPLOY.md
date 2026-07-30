# Build and deploy

Read this before running any build. There is no default build command, on purpose.

## The one thing that goes wrong

The app is served from **a different path** depending on where it is going:

| Destination | URL | Base path baked into `index.html` |
| --- | --- | --- |
| GitHub Pages | `https://jesvinxavi.github.io/habits-tracker-pwa/` | `/habits-tracker-pwa/` |
| Any local server | `http://localhost:4180/` | `/` |

That path is written into `index.html` **at build time**, so a build made for one
and served from the other returns 404 for every stylesheet and script. The page
still renders — `index.html` contains the whole app shell as static markup — so
what you see is unstyled HTML stuck on "Loading your habits…". It looks like the
app is broken. It is the wrong build.

This used to be guessed from `NODE_ENV`, which `vite build` sets to `production`
itself, so every plain `npm run build` silently produced a Pages build. Now the
target must be stated and `vite build` refuses without it.

## Which command

### Deploying to GitHub Pages

```bash
npm run deploy
```

Builds with base `/habits-tracker-pwa/` and pushes `dist/` to the `gh-pages`
branch. To build without publishing: `npm run build:pages`.

Pushing to `main` also deploys through `.github/workflows/deploy.yml`, which sets
`REPO_NAME` from the repository itself — so a rename cannot break the base path.

### Testing on this machine

```bash
npm run preview:local
```

Builds with base `/` and serves `dist/` at http://localhost:4180.

### Testing on your phone

```bash
npm run preview:phone
```

The same local build, bound to `0.0.0.0`. It prints the address to open on your
phone — `http://<your-mac's-LAN-ip>:4180` — which needs both devices on the same
Wi-Fi.

### Working on the code

```bash
npm run dev
```

Vite dev server on port 3000, with hot reload. Serves from `/`, so the base path
question never arises. The app has one data backend: Clerk authenticates the
user and Convex is the authoritative remote store, with IndexedDB retaining the
confirmed cache and offline outbox. Configure only the public development
variables in `.env.local`:

```bash
VITE_CONVEX_URL=https://<development-deployment>.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Never set `VITE_DATA_BACKEND`: the retired legacy backend switch is not a
supported recovery path. `VITE_TEST_HARNESS=1` is exclusively for Playwright.
Normal production builds reject it. `npm run test:pwa` has a deliberately
narrow exception requiring all three of `PWA_TEST_BUILD=1`, `VITE_PWA_TEST=1`,
and `VITE_TEST_HARNESS=1`; the resulting Pages-shaped artifact is a test fixture
and must never be deployed. The harness flags must never be placed in `.env`,
`.env.local`, GitHub Actions variables, or a Pages deployment.

### Safely recovering a development schema/data experiment

Do not point an import command at production while experimenting. First select
the development Convex deployment, take a dated local snapshot, and keep it
outside version control:

```bash
backup_dir="../healthy-habits-dev-backups"
mkdir -p "$backup_dir"
npx convex export --deployment dev --path "$backup_dir/dev-before-schema-change.zip"
```

Apply and verify the schema change with `npx convex dev`, then run the relevant
unit and browser tests. If the development data needs to be restored, inspect
the snapshot and import it back into that same development deployment:

```bash
npx convex import --deployment dev "$backup_dir/dev-before-schema-change.zip"
```

`--replace` and especially `--replace-all` delete existing documents. Use them
only after creating a fresh export, confirming the deployment name is `dev`,
and reviewing the CLI's interactive summary. Never commit snapshots, auth
tokens, owner identifiers, or exported account data.

## Service workers

A `pages` build registers a service worker; a `local` build does not.

This is deliberate. A stale service worker keeps serving an old precached build
long after the files on disk change, which is indistinguishable from "my change
did nothing" — and it will happily serve a *Pages* build's assets from a page
that has since been rebuilt for local. Local builds are for looking at the code
you just wrote, so they ship no worker at all.

If a device has already cached an older build:

- **Desktop Chrome** — DevTools → Application → Service Workers → Unregister, then
  Storage → Clear site data.
- **iOS Safari** — Settings → Safari → Advanced → Website Data → swipe the entry
  away. Or just open the address in a Private tab.
- **Android Chrome** — Settings → Privacy → Clear browsing data, or long-press the
  reload button → Empty cache and hard reload.

## Every script

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, port 3000, hot reload |
| `npm run build:pages` | Build for GitHub Pages (base `/habits-tracker-pwa/`, service worker on) |
| `npm run build:local` | Build for a local server (base `/`, service worker off) |
| `npm run preview:local` | `build:local`, then serve on http://localhost:4180 |
| `npm run preview:phone` | `build:local`, then serve on the LAN for phone testing |
| `npm run deploy` | `build:pages`, then publish `dist/` to `gh-pages` |
| `npm run lint` | ESLint over `src` and `tests` |
| `npm test` | Unit and Convex-domain tests (Vitest) |
| `npm run test:e2e` | Playwright browser tests |
| `npm run test:fitness:perf` | Isolated one-worker, 4× CPU large-account Fitness diagnostic |
| `npm run test:pwa` | Pages-shaped harness build; offline Fitness, local icons/reorder, and controlled-update lifecycle tests |
| `npm run test:convex` | Type-check the Convex functions |
| `npm run check:dead-code` | Knip gate for unused files, exports, and dependencies |
| `npm run check:cycles` | Knip gate for circular imports |
| `npm run check:bundle` | Local build plus HTML, Fitness, modal, and JavaScript budgets |
| `npm run check:bundle:pages` | Pages build plus the same budgets and the PWA precache budget |
| `npm run analyze` | Local build with the `analyze` mode bundle report |
| `npm run clean` | Remove `dist/` and Vite's cache |

`vite build` on its own fails with a message pointing back here. That is the
intended behaviour, not a broken config.
