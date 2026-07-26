# Healthy Habits Tracker – Coding & Contribution Guidelines

This document is the single source-of-truth for **how we write, structure and evolve the codebase**.
Whenever you (or the AI assistant) make a change **refer to this guide first** and follow it _strictly_ – consistency is far more valuable than personal preference.

---

## 1. Project Philosophy

1. **Vanilla-first** – The app intentionally avoids heavy frameworks. All dynamic behaviour is implemented with modern browser APIs (ES2020 Modules, DOM, `fetch`, Service Workers). Keep it that way unless there is a _very strong_ reason.
2. **Honest loading and failure states** – The app requires JavaScript. Keep the
   branded loader or an explicit authentication/storage error visible until the
   account-backed interface is safe to display.
3. **PWA & Offline** – Offline-first is non-negotiable. Persistent commands must commit to the IndexedDB outbox and optimistic cache before changing in-memory state.
4. **Mobile-first, iOS-inspired UI** – CSS/tailwind choices should always consider small touch screens first.
5. **Root-cause fixes over workarounds** – When modifying behaviour, change the underlying code or data directly instead of adding transformation layers or wrappers. Indirect solutions are only acceptable when a direct change would introduce regressions that cannot be resolved immediately; in such cases the pull-request must clearly explain (a) why the direct fix breaks, and (b) why the chosen workaround is safest for now.

---

## 2. Directory Layout & Responsibilities

```
/ (root)
├── index.html           # Single entry HTML (no framework templates)
├── src/                 # All JavaScript source code
│   ├── main.js          # Bootstraps everything (import-only, NO logic)
│   ├── core/            # App-wide state & persistence
│   │   ├── state.js     # Single source of truth – `appData`
│   │   ├── offlineDb.js # Confirmed cache, outbox, lease, backups
│   │   ├── syncEngine.js # Idempotent replay and reconciliation
│   │   └── migration/   # Pure legacy normalization and merge logic
│   ├── components/      # Re-usable UI snippets (confirm dialog, modal…)
│   └── features/        # Home, Habits, Fitness, Holidays, Stats, Profile
├── convex/              # Authenticated schema, queries, and mutations
├── tests/               # Unit, migration, Convex, and browser tests
├── public/              # Static assets only (styles, icons, manifest…)
└── docs/                # Project documentation incl. **this file**
```

• **Do not** introduce new top-level folders without updating this section.
• Feature-specific logic lives under `features/` _unless_ it is strictly UI.

---

## 3. JavaScript Conventions

1. **Language level**: ES2020. Target evergreen browsers – no transpilation.
2. **Modules**: Always use `import ... from './relative/path.js'` with the **`.js` extension included**.
3. **File naming**: `lowerCamelCase.js` for modules, `PascalCase.js` for classes/components exporting a constructor.
4. **Indentation**: 2 spaces, no tabs.
5. **Strings**: Single quotes `'` for JS, double quotes `"` for HTML/JSX strings.
6. **Semicolons**: Required. Always terminate statements.
7. **Trailing commas**: Allowed on the last item of multi-line object/array literals.
8. **Hoisting**: Prefer _function declarations_ (`export function foo() {}`) for exported APIs so they are hoisted; use arrow functions for small inner helpers.
9. **Top-level side-effects**: Restrict them to documented startup modules such
   as `main.js`, `loader.js`, and `autoToday.js`. Domain, migration, and
   validation helpers must remain side-effect free.
10. **JSDoc**: Every exported function _must_ carry a concise `/** … */` block describing params and return values.

---

## 4. State Management (`src/core`)

1. `state.js` exports **one mutable object** `appData` and helper utilities `dispatch`, `Actions`, `subscribe`, `notify`.
2. **Never** replace `appData` – always use `dispatch(Actions.actionName(...))` for state changes.
3. **Always** use `dispatch(Actions.actionName(...))` to change state so subscribers are notified.
4. **Never** access `appData` directly for reading state - use `Selectors` instead.
5. Add new persistent fields to `appData` **together** with migration logic inside `ensureHabitIntegrity` (or a dedicated helper).
6. **Persistence**: In `cloud` mode, Convex is authoritative and `habitsConvexCache` stores confirmed cache/outbox data. Whole-state localStorage/legacy IndexedDB writes are forbidden. `legacy` mode remains available only for safe rollout and recovery.
7. **Ownership**: Backend functions derive `ownerKey` from `ctx.auth.getUserIdentity()` and never accept it as a public argument.
8. **Hydration**: Server/cache hydration actions carry a source marker and must never create outgoing operations.

---

## 5. UI Modules (`src/ui` & `src/components`)

1. Each feature exposes an initialization boundary. The visible Home feature is
   initialized during startup; other feature modules are loaded by navigation
   or on first interaction.
2. **Pure HTML builders**: Functions like `createHabitItem()` must only _return_ template strings – no DOM side effects.
3. **DOM mutations**: Performed via `element.insertAdjacentHTML()` or through standard DOM APIs – never use `innerHTML = ...` if avoidable (security).
4. Keep UI code free of business logic – call utilities from `utils/` and `features/` instead.
5. **Accessibility**: Buttons need `aria-label`; colour-only indicators must have textual fallback.
6. **Icons**: Reuse the established Material Icons or inline SVG patterns. Every
   icon-only control requires an accessible name.

### Calendar Components

Calendar components use the **CalendarController** API for consistent behavior:

```javascript
/**
 * @typedef {Object} CalendarController
 * @prop {Promise<void>} ready            Resolves after DOM & fonts ready
 * @prop {(d:Date)=>void} setDate         Selects new date, re-renders
 * @prop {(o?:{instant?:boolean})=>void} scrollToSelected
 * @prop {()=>void} destroy
 */
```

**Usage Pattern:**
```javascript
// Wait for calendar to be ready before centering
await HomeCalendar.ready;
HomeCalendar.scrollToSelected({ instant: true });

// For user interactions, use smooth scrolling
HomeCalendar.scrollToSelected(); // defaults to smooth
```

**Scroll Helper:**
```javascript
import { centerOnSelector } from '../components/scrollHelpers.js';

// Center an element within its scrollable parent
centerOnSelector(parent, '.day-item.current-day', { instant: false });
```

**Key Points:**
- Always await `calendar.ready` before calling `scrollToSelected`
- Use `{ instant: true }` for initial mount and programmatic changes
- Use smooth scrolling (default) for user interactions
- The double `requestAnimationFrame` pattern ensures iOS A2HS compatibility

---

## 6. Styling (Tailwind CSS)

1. Tailwind is compiled locally through PostCSS. Never add the Tailwind CDN
   runtime to production.
2. Custom colours, content scanning, and font families are defined in
   `tailwind.config.cjs`.
3. Use existing iOS colour variables (`ios-blue`, `ios-orange`, …) to stay on-brand.
4. Whenever dynamic colours are needed, compute Tailwind utility class via helper maps (`utils/constants.js`).

---

## 7. Service Worker & PWA

1. PWA generation is configured through `vite-plugin-pwa` in `vite.config.js`.
2. Precache the application shell and static assets only.
3. Never runtime-cache Clerk or Convex API traffic.
4. Service-worker updates must not clear IndexedDB account caches or outboxes.

---

## 8. Commit & Branching Strategy

1. **Conventional Commits** (`type(scope): subject`): `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`.
2. Each feature/fix should live on a dedicated branch and open a Pull Request.
3. PR description must reference issue ID and checklist:
   - [ ] Added/updated tests
   - [ ] Updated docs (incl. this file if structure changes)
4. **Squash & merge** to keep history linear.

---

## 9. Testing

1. Use Vitest for pure logic, reducers, migration, and IndexedDB behavior.
2. Use `fake-indexeddb` for deterministic storage tests.
3. Use Playwright for browser/PWA, authentication-gate, and offline/reconnect flows.
4. Every persistent mutation requires success, duplicate, stale revision, validation, ownership, parent, tombstone, and cascade coverage.

---

## 10. Adding New Code – Checklist

- [ ] Chosen correct directory?
- [ ] Module exported correctly with hoisted function declarations?
- [ ] Added JSDoc?
- [ ] Followed naming, lint & style rules?
- [ ] No direct DOM access in utils?
- [ ] Updated `CACHE_NAME` & manifest if static asset added?
- [ ] Updated docs/tests & this guide if behaviour changed?

---

## 11. Linting & Formatting

ESLint, Vitest, Convex type-checking, production build, and Playwright smoke tests run in CI.

---

## 12. Future Improvements (track in GitHub Issues)

• Expand authenticated browser coverage for reconnect and conflict flows
• Add self-service export, reset, rollback, and account deletion UI
• Enable retention maintenance only after production evidence and review

---

**Remember: Change the code _only_ after validating against this guide.**

## Fitness Activities Card Design Specification

### Habit Tile Structure (Reference Implementation)

Based on audit of `src/ui/home.js` habit cards, the following structure and styling must be replicated for activity tiles:

#### DOM Hierarchy:

```
.swipe-container (relative, overflow-hidden)
├── .restore-btn/.skip-btn (absolute, top-0, right-0, h-full, width:20%, bg-red-600/orange-500)
└── .swipe-slide (transition-transform, width:100%, position:relative, z-index:1, bg-white, border-radius:0.75rem)
    └── .habit-card/.activity-card (flex, items-center, px-3, py-2, rounded-xl, width:100%, margin-bottom:0)
        ├── .habit-icon/.activity-icon (w-9, h-9, flex-shrink-0, rounded-full, flex, items-center, justify-center, mr-1, text-xl, border:2px solid {category.color}, color:{category.color})
        ├── .habit-content/.activity-content (flex-grow)
        │   ├── .habit-name/.activity-name (font-semibold, leading-tight)
        │   └── .category-pill (inline-block, whitespace-nowrap, px-2, py-0.5, rounded-lg, text-xs, font-medium, mt-0, background:{category.color}, color:#fff, border-radius:8px)
        └── .activity-meta (flex, items-center, gap-2)
```

#### Key Styling Requirements:

- **Border**: Category-colored 2px solid border on icon circle
- **Icon**: Category color for both border and text
- **Background**: White with border-radius 0.75rem on slide element
- **Category Pill**: Background uses category color, white text, 8px border-radius
- **Indentation**: Activity cards must have `pl-4` (1rem left padding) for indentation from category header
- **Card Spacing**: `margin-bottom: 0.25rem` on outer container
- **Swipe Button**: Delete button with `bg-red-600`, white "Delete" text, 20% width

#### Indentation Specification:

- Activity tiles should be indented with `pl-4` class (1rem) relative to category headers
- This creates visual hierarchy showing activities belong to their category section

#### Action Button Specification:

- Background: `#DC2626` (Tailwind red-600)
- Text: "Delete" in white color
- Font weight: 600 (font-semibold)
- Position: Absolute right side, 20% width of container

### Consistency Requirements:

- Both habit and activity tiles must maintain identical visual appearance
- Category colors must be applied consistently across icon borders and category pills
- Swipe behavior and timing must be identical (20% width threshold, 0.2s transition)
- Dark mode compatibility required for all elements

## Fitness Activities Card Implementation

### Overview

The fitness page activity tiles now use the exact same visual design and interaction patterns as habit tiles from the home page, ensuring a consistent user experience across views.

### Key Implementation Details:

#### Swipe Integration

- Uses shared `makeCardSwipable()` helper from `src/components/swipeableCard.js`
- Maintains identical swipe thresholds, timing, and button positioning
- Delete action integrated with existing `deleteRecordedActivity()` function

#### Visual Consistency

- Activity cards use identical DOM structure to habit cards
- Category-colored borders on icons (2px solid)
- Same typography, spacing, and rounded corners
- Proper indentation (`pl-4`) relative to category headers

#### Scroll Behavior

- Dedicated `adjustActivitiesContainerHeight()` function mirrors home page behavior
- Fixed header/calendar with scrollable activities section only
- Responsive to window resize events

#### Accessibility & Themes

- Full dark mode support with appropriate color variants
- Proper ARIA labels for screen readers
- Touch actions configured for optimal mobile experience

### Maintenance Notes:

- Any visual changes to habit tiles should be mirrored in activity tiles
- Shared swipe component ensures behavioral consistency
- Category color usage follows established patterns
