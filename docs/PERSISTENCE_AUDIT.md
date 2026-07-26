# Persistence Audit

This document freezes the pre-Convex persistence contract. `legacySchemaVersion`
is `0`.

## Whole-state stores and precedence

| Store | Location | Key | Legacy behavior | Migration behavior |
|---|---|---|---|---|
| Full snapshot | localStorage | `healthyHabitsData` | Loaded first and saved after every state notification | Read independently, back up verbatim, then normalize |
| Full snapshot | IndexedDB `healthyHabitsDB` v1 / `state` | `appData` | Loaded asynchronously over the localStorage snapshot | Read independently, back up verbatim, and use as the default winner when meaningful data differs |

The two writes are not atomic and the IndexedDB write is not awaited. Both
sources are evidence; neither is deleted by migration. Device-only fields are
excluded from source fingerprints.

## Side keys

| Key | Storage | Classification |
|---|---|---|
| `theme` | localStorage | Merge into synced `darkMode` |
| `homeSectionVisibility` | localStorage | Merge into synced home visibility |
| `activeHabitTrackerTab` | localStorage | Device-only; retire |
| `habitsAppFitnessMigrationV1` | localStorage | Migration evidence only |
| `fitnessRestDays` | localStorage | Merge into normalized rest days |
| `bootForcedHome` | sessionStorage | Session-only |
| `__storage_test__` | localStorage | Temporary availability probe; ignore |

The service worker persists only the application shell through Workbox. Timer,
lap, modal, prompt, search, current/selected date, selected group, and active-tab
state are device/session state.

## Top-level state classification

| Legacy field | Target |
|---|---|
| `categories` | `habitCategories` |
| `habits` definition fields | `habits` |
| `habits[].completed`, `progress`, `skippedDates` | `habitEntries` |
| `appFirstOpenDate` | `userProfiles` |
| `holidayPeriods` | `holidayPeriods` |
| uncovered/manual `holidayDates` | `holidaySingles` |
| `settings` | `userPreferences` |
| `activities` | `activities` |
| `activityCategories` | `activityCategories` |
| `recordedActivities` | `activityRecords` |
| `restDays` and `fitnessRestDays` | `restDays` |
| `foodLog`, `stats`, unknown top-level fields | `legacyData` |
| `currentDate`, `selectedDate`, `fitnessSelectedDate`, `selectedGroup` | device/session only |

Array order is authoritative category/habit order. Deleting a habit category
cascades to habits and their embedded history. Deleting an activity cascades to
recorded activity history.

## Persistent callers

- Preferences: `core/theme.js`, `HabitsListModule.js`, home section helpers.
- Habit categories: `features/habits/ui/categories.js`,
  `HabitReorderModal.js`.
- Habits and order: `HabitFormModal.js`, `HabitReorderModal.js`.
- Habit history: `HomeHabitsList.js`, home UI helpers,
  `HabitsListModule.js`.
- Holidays: `features/holidays/holidays.js` and management UI.
- Fitness categories: `fitness/SearchPanelModule.js`.
- Activities/history: `fitness/activities.js`, activity editor/details.
- Rest days: `fitness/restDays.js`.

## Known defects retained as migration evidence

- IndexedDB wins at startup even when it is older.
- `IMPORT_DATA` is a shallow merge with no validation.
- Period-expanded holiday dates were mixed into the manual set. Covered dates
  are therefore ambiguous and default to derived-only in migration preview.
- Both fitness cleanup routines share one marker, so the second can be skipped.
- Embedded habit and fitness history is unbounded.

The source reader is read-only. Activation of a verified Convex generation, not
the presence of cloud documents, is the authority cutover.
