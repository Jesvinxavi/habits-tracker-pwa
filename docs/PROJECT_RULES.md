# Project Rules & Constraints

## What We ARE Doing

### ✅ **PHASE 1 – Environment & Tooling** (COMPLETE)
- ✅ ESLint & Prettier configuration
- ✅ Husky pre-commit hooks
- ✅ Vite build system
- ✅ Security vulnerability fixes

### ✅ **PHASE 3 – Robust State & Persistence Layer** (COMPLETE)
- ✅ Enhanced state management with action-based system
- ✅ Storage abstraction with localStorage + IndexedDB fallback
- ✅ State helpers and documentation

### ✅ **PHASE 4 – UI Architecture & Accessibility** (PARTIALLY COMPLETE)
- ✅ Component organization and modular structure
- ✅ Tailwind CSS with iOS-style design system
- ⚠️ Accessibility audit (optional - only if critical issues found)

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

## Current Focus Areas

### 🔴 **CRITICAL PRIORITY** (COMPLETED)
1. ✅ Fix security vulnerabilities
2. ✅ Fix ESLint/Prettier issues
3. ✅ Re-enable lint in husky pre-commit hook

### 🟡 **HIGH PRIORITY** (Optional)
1. Accessibility audit (only if critical issues found)
2. Performance optimization (only if bundle size > 150KB)
3. Code quality improvements (unused variables, console statements)

### 🟢 **MEDIUM PRIORITY** (Optional)
1. Bundle size optimization
2. Enhanced CI/CD pipeline
3. Documentation updates

## Project Status

- **Browser architecture**: Vanilla JavaScript and Vite
- **Authoritative persistence**: Convex in cloud mode
- **Offline persistence**: IndexedDB confirmed cache and durable outbox
- **Authentication**: Clerk with a 30-day device-local offline lease
- **Testing**: Vitest, fake-indexeddb, Convex type-checking, and Playwright
- **Deployment**: Convex functions followed by GitHub Pages artifact

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
