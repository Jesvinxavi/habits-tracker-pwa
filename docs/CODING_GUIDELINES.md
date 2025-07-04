# Healthy Habits Tracker – Coding & Contribution Guidelines

This document is the single source-of-truth for **how we write, structure and evolve the codebase**.
Whenever you (or the AI assistant) make a change **refer to this guide first** and follow it _strictly_ – consistency is far more valuable than personal preference.

---

## 1. Project Philosophy
1. **Vanilla-first** – The app intentionally avoids heavy frameworks. All dynamic behaviour is implemented with modern browser APIs (ES2020 Modules, DOM, `fetch`, Service Workers). Keep it that way unless there is a _very strong_ reason.
2. **Progressive Enhancement** – The default experience must work without JavaScript; JS only makes it richer.
3. **PWA & Offline** – Offline-first is non-negotiable. Changes that break offline support are regressions.
4. **Mobile-first, iOS-inspired UI** – CSS/tailwind choices should always consider small touch screens first.
5. **Root-cause fixes over workarounds** – When modifying behaviour, change the underlying code or data directly instead of adding transformation layers or wrappers. Indirect solutions are only acceptable when a direct change would introduce regressions that cannot be resolved immediately; in such cases the pull-request must clearly explain (a) why the direct fix breaks, and (b) why the chosen workaround is safest for now.

---
## 2. Directory Layout & Responsibilities
```
/ (root)
├── index.html           # Single entry HTML (no framework templates)
├── service-worker.js    # PWA cache logic – keep tiny & explicit
├── src/                 # All JavaScript source code
│   ├── main.js          # Bootstraps everything (import-only, NO logic)
│   ├── core/            # App-wide state & persistence
│   │   ├── state.js     # Single source of truth – `appData`
│   │   └── storage.js   # LocalStorage persistence helpers
│   ├── utils/           # Pure, framework-agnostic helpers (NO DOM)
│   │   ├── activities.js # Fitness activity management
│   │   ├── restDays.js  # Rest day tracking utilities
│   │   └── …
│   ├── components/      # Re-usable UI snippets (confirm dialog, modal…)
│   ├── ui/              # View-layer modules (DOM helpers + event listeners)
│   │   ├── habits/      # View sub-folders if a view needs many files
│   │   ├── fitness.js   # Fitness page controller & UI
│   │   ├── theme.js
│   │   └── …
│   └── features/        # Cross-view business logic (e.g. schedule engine)
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
9. **Top-level side-effects**: Keep them _only_ in `main.js`. Other modules must export pure functions.
10. **JSDoc**: Every exported function _must_ carry a concise `/** … */` block describing params and return values.

---
## 4. State Management (`src/core`)
1. `state.js` exports **one mutable object** `appData` and helper utilities `mutate`, `subscribe`, `notify`.
2. **Never** replace `appData` – always mutate properties so references remain valid.
3. Wrap every change in `mutate((state)=>{ … })` so subscribers are notified.
4. Add new persistent fields to `appData` **together** with migration logic inside `ensureHabitIntegrity` (or a dedicated helper).
5. **Persistence**: LocalStorage (`storage.js`) automatically serialises after `notify()`. Do not write to LocalStorage directly anywhere else.

---
## 5. UI Modules (`src/ui` & `src/components`)
1. Each module exposes an `initializeX()` that attaches all its listeners. Call it from `main.js` only.
2. **Pure HTML builders**: Functions like `createHabitItem()` must only _return_ template strings – no DOM side effects.
3. **DOM mutations**: Performed via `element.insertAdjacentHTML()` or through standard DOM APIs – never use `innerHTML = ...` if avoidable (security).
4. Keep UI code free of business logic – call utilities from `utils/` and `features/` instead.
5. **Accessibility**: Buttons need `aria-label`; colour-only indicators must have textual fallback.
6. **Icons**: Always use the Google **Material Design Icons** font ( `<span class="material-icons">icon_name</span>` ). Avoid custom inline SVGs unless the required symbol is not available in the Material set.

---
## 6. Styling (Tailwind CSS)
1. Tailwind is loaded via CDN; no build step. Only use **class strings** inside template literals – do _not_ add `<style>` tags in JS.
2. Custom colours & font families are declared inline in `index.html`'s `tailwind.config` override – extend there if new tokens are required.
3. Use existing iOS colour variables (`ios-blue`, `ios-orange`, …) to stay on-brand.
4. Whenever dynamic colours are needed, compute Tailwind utility class via helper maps (`utils/constants.js`).

---
## 7. Service Worker & PWA
1. Increase `CACHE_NAME` when adding cache-worthy assets.
2. `urlsToCache` must include every _critical_ asset for offline first-load.
3. Avoid caching large images – rely on network fallback.
4. Remember to version-bust old caches during the `activate` event.

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
1. No formal test runner yet; critical logic (helpers in `utils/` & `features/`) must include **inline self-tests** (`console.assert`) wrapped in `if (process.env.NODE_ENV==='test')` style guards (temporary until test setup exists).
2. Do **not** add DOM-dependent tests here; those belong to end-to-end Cypress tests (future work).

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
Currently no automated linter is configured. **Until ESLint/Prettier is added you _must_ self-police** the rules above. PR reviews will reject inconsistent code.

---
## 12. Future Improvements (track in GitHub Issues)
• Add ESLint + Prettier CI
• Introduce Vitest for unit testing
• Migrate inline Tailwind config to `tailwind.config.js` build pipeline for production optimisation
• Replace Alpine.js with smallest possible reactive helper or custom hook system

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