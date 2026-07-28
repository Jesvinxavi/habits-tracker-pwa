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
question never arises. `.env.local` decides the data backend: it is set to
`cloud`, which needs a Clerk sign-in. To run against on-device storage instead:

```bash
VITE_DATA_BACKEND=legacy npm run dev
```

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
| `npm test` | Unit and migration tests (Vitest) |
| `npm run test:e2e` | Playwright browser tests |
| `npm run test:convex` | Type-check the Convex functions |
| `npm run analyze` | Local build with the `analyze` mode bundle report |
| `npm run clean` | Remove `dist/` and Vite's cache |

`vite build` on its own fails with a message pointing back here. That is the
intended behaviour, not a broken config.
