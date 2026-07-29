# Project Rules & Constraints

## What We ARE Doing

### ✅ **PHASE 1 – Environment & Tooling** (COMPLETE)
- ✅ ESLint & Prettier configuration
- ✅ Husky pre-commit hooks
- ✅ Vite build system
- ✅ Security vulnerability fixes

### ✅ **PHASE 3 – Robust State & Persistence Layer** (COMPLETE)
- ✅ Enhanced state management with action-based system
- ✅ Authenticated Convex authority with normalized records
- ✅ Per-account IndexedDB confirmed cache and durable offline outbox
- ✅ Generation-based legacy migration, backups, checksums, and recovery

### ✅ **PHASE 4 – UI Architecture & Accessibility** (COMPLETE)
- ✅ Component organization and modular structure
- ✅ Tailwind CSS with iOS-style design system
- ✅ Dialog focus management, keyboard operation, reduced motion, and
  screen-reader state covered by automated and browser checks

### ✅ **PHASE 5 – Progressive-Web-App Hardening** (COMPLETE)
- ✅ Service Worker configuration
- ✅ Manifest and icons
- ✅ Build optimization

### ✅ **PHASE 7 – Documentation & Knowledge Sharing** (COMPLETE)
- ✅ README and coding guidelines
- ✅ Architecture documentation

## What We are NOT Doing

### ✅ **Language boundary**
- The browser application remains vanilla JavaScript.
- Convex backend functions use TypeScript and are type-checked independently.
- Do not migrate the browser UI to a framework or TypeScript as part of
  unrelated persistence work.

### ✅ **Persistence Testing Infrastructure**
- Vitest is required for reducers, schedules, migration, and offline storage.
- `fake-indexeddb` is required for deterministic IndexedDB tests.
- Playwright covers PWA and browser persistence flows.
- CI must run lint, unit/migration tests, Convex type-checking, build, and browser smoke tests.
- Builds state their destination: `npm run build:pages` for GitHub Pages,
  `npm run build:local` for anything served from the root. `vite build` fails
  without `BUILD_TARGET` rather than guessing. See
  `docs/operations/BUILD_AND_DEPLOY.md`.

## Current Focus Areas

### 🔴 **CRITICAL PRIORITY** (COMPLETED)
1. ✅ Fix security vulnerabilities
2. ✅ Fix ESLint/Prettier issues
3. ✅ Re-enable lint in husky pre-commit hook

### 🟡 **HIGH PRIORITY**
1. Production identity, release, retention, and account-lifecycle gates
2. Auth/vendor bundle audit as a separately scoped project
3. Continued reconnect, conflict, migration, and installed-PWA verification

### 🟢 **MEDIUM PRIORITY** (Optional)
1. Restore archived activities and routines from the UI
2. Enhanced CI/CD pipeline
3. Further performance work only when browser measurements justify it

## Project Status

- **Browser architecture**: Vanilla JavaScript and Vite
- **Authoritative persistence**: Convex in cloud mode
- **Offline persistence**: IndexedDB confirmed cache and durable outbox
- **Authentication**: Clerk with a 30-day device-local offline lease
- **Testing**: Vitest, fake-indexeddb, Convex type-checking, and Playwright
- **Deployment**: Convex functions followed by GitHub Pages artifact
- **Fitness**: Overhaul and optimisation complete; routines, programs, lazy
  modals, lifecycle-bound rendering, and browser performance gates are integrated

## Decision Rationale

1. **Vanilla browser UI**: The application remains framework-free. Convex uses
   its native TypeScript function model without changing the browser language.

2. **Persistence tests are mandatory**: Cloud migration and exactly-once offline replay require executable fixtures and deterministic browser-storage tests.

3. **Focus on Stability**: Priority is given to maintaining a working, secure, and well-formatted codebase over adding new technologies.

## Future Considerations

If the project requirements change significantly, these decisions can be revisited. For now, the focus remains on:
- Code quality and formatting
- Security and performance
- Documentation and maintainability
