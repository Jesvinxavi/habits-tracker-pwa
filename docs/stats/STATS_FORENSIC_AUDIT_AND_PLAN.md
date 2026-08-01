# Statistics Forensic Audit and Implementation Plan

> **Implemented and shipped** in 1.1.0. The findings below were all addressed; see
> [§13 Implementation record](#13-implementation-record) for what changed, what
> the measurements became, and the two things the audit got wrong. The findings
> and evidence are kept because they are what the changes argue from.

Date: 2026-07-31. Branch: `stats-audit` from `develop` at `0cef3904` (clean
tree). Scope: every statistics surface and every calculation feeding one —
the Stats page (`src/features/stats/stats.js`), the activity statistics modal
(`src/features/fitness/Modals/StatsModal.js` +
`src/features/fitness/helpers/activityStats.js`), the habit statistics modal
(`src/features/habits/modals/HabitStatsModal.js` +
`src/features/habits/helpers/habitStats.js`), the shared schedule/completion
primitives they call (`src/features/home/schedule.js`,
`src/shared/ScheduleEngine.js`, `src/selectors/progress.js`,
`src/shared/datetime.js`, `src/features/holidays/holidays.js`,
`src/shared/restDays.js`, `src/features/fitness/helpers/recordedHistory.js`),
the lazy-modal loader implicated in the "Unable to connect" report
(`src/features/fitness/FitnessModals.js`), and the Convex schema
(`convex/schema.ts`) as the ground truth for what data the app collects.

Nothing here is speculative. Every calculation finding was verified by reading
the arithmetic and, where marked **[verified live]**, additionally reproduced
in a running dev build (`VITE_TEST_HARNESS=1`) with seeded data, driving the
real UI and reading the rendered numbers.

## 0. How to read this document

- Section 1 describes the statistics architecture as found.
- Section 2 is the executive summary.
- Section 3 is the root-cause analysis of the reported bug: the activity
  stats modal replaced by an "Unable to Open — check your connection" dialog
  (category **M**).
- Sections 4–8 are the findings: **C** (fitness/activity calculation
  correctness), **H** (habit calculation correctness), **X** (cross-surface
  consistency and duplication), **U** (UI/markup defects in stats surfaces),
  **P** (performance). Each finding states the evidence, the proposed change,
  and the risk of making it.
- Section 9 lists decisions that need the owner's intent confirmed before
  implementation (they change what numbers mean, not just how they are
  computed).
- Section 10 proposes new statistics, grounded in fields the app already
  collects but never surfaces.
- Section 11 is the phased implementation plan; section 12 the verification
  matrix.

## 1. Architecture as found

Three independent statistics surfaces exist, each with its own calculation
code:

1. **Stats page** (`src/features/stats/stats.js`, 1,330 lines). Renders an
   overview strip (total habits, completed today, fitness sessions 30d,
   longest 100% daily streak), a Habits/Fitness toggle, and a detailed section
   per toggle. Contains its own habit completion-rate, streak, weekly/monthly
   rate, group-series, and fitness aggregate calculators. Identity-memoised
   view-model cache keyed on eight state slices plus the local calendar day;
   re-renders on state changes while active and at midnight.
2. **Activity stats modal** (`StatsModal.js` + `activityStats.js`). Opened
   from the activity-info modal's "View full statistics" button through the
   lazy-modal loader in `FitnessModals.js`. Pure-function calculator over
   `getRecordedHistoryIndex().byActivity`.
3. **Habit stats modal** (`HabitStatsModal.js` + `habitStats.js`). Opened from
   the stats button on each row of the Habits page. Contains a *third*
   habit-calculation suite (rates, streaks, per-group windows), overlapping
   the Stats page's but drifted from it (§ X1).

All three sit on the same completion primitives: `isHabitScheduledOnDate`
(creation/archival guard + `ScheduleEngine.isDue`), `isHabitCompleted`
(period-key lookup into `habit.completed`), `isHabitSkippedToday`
(`habit.skippedDates`), plus `isHoliday`/`isRestDay`. The home progress ring
(`src/selectors/progress.js`) is a fourth consumer of the same primitives and
is used in this audit as the reference for intended semantics (it excludes
skipped days; several stats calculators do not — § H1).

Recorded fitness sessions are indexed once per `recordedActivities` object by
`getRecordedHistoryIndex()`: `allRecords`, `byActivity` (sorted by
`timestamp`), `byDate`. A record carries `date` (the calendar day the user
logged it against) and `timestamp` (the wall-clock moment it was written) —
two different things once the user backdates a session, which the record flow
explicitly supports (the fitness page's `+` button records onto the selected
day).

What the app collects (from `convex/schema.ts`) and therefore what statistics
can legitimately be built from: per-habit schedule definitions
(daily/weekly/biweekly/monthly/yearly with day/date/ordinal configs), per-period
completion, **numeric progress against targets** (`habitEntries.progress`),
per-period skips, pause/archive lifecycle, holiday singles and periods,
per-activity `trackingType`, `muscleGroup`, `betterDirection`, free-text notes,
per-record `sets[{reps, value, unit}]`, `duration`+`durationUnit`, `intensity`,
rest days, routines, and programs with `scheduledDays`, per-program `restDays`
and historical `schedulePhases`. Sections 4–8 show that a substantial part of
this (progress-vs-target, muscleGroup, categoriesUsed, betterDirection beyond
one label) is collected but never surfaced (§ 10).

## 2. Executive summary

| Theme | Outcome |
|---|---|
| Reported bug ("Unable to connect" instead of activity stats modal) | Root cause identified in the lazy-modal loader's error handling: **every** failure — including runtime exceptions inside the modal and stale-deploy chunk 404s — is reported as a connectivity problem. The modal itself opens correctly in dev **[verified live]**. Fix: split error paths, integrate the PWA update prompt on chunk failure, prefetch the stats chunk. |
| Fitness calculation correctness | 9 findings. Two are user-visible data corruption: decimal durations truncated (90-minute run counted as 60 — **[verified live]**, the same modal shows "Total 1h 30m" and "Best session 90 min" from the same two records), and "Best Session" chosen by best single set rather than best session. |
| Habit calculation correctness | 14 findings. The largest: skipped days count as failures in every rate and streak except the home ring and the group streak, which treat them as neutral — the same skipped day produces three different truths across surfaces **[verified live]**. Pausing a habit retroactively erases its entire statistical history. Archived habits drag category averages toward 0%. |
| Consistency / duplication | Three habit-stat calculation suites and three carousel implementations with drifted semantics (streak caps, creation-date parsing, autoscroll cadence). One shared calculation module proposed. |
| UI defects | Habit stats modal bypasses the shared modal stack (no scroll lock, focus trap, Escape, aria), injects unescaped user strings, and its empty state is unreachable. Duplicate element IDs across page and modal carousels. |
| Performance | Stats page recompute is O(days-since-first-habit × habits × completion-entries). Measured **[verified live]**: 12 daily habits × 1 year ≈ 0.5 s main-thread block per recompute; 12 × 2 years froze the renderer beyond 30 s. Fix is a per-habit start-date memo + bounded series; target <50 ms. |
| New statistics | 16 proposals grounded in already-collected data, prioritised; headline items: target-habit progress stats (currently invisible), personal records incl. est. 1RM, weekly volume by muscle group, program adherence, day-of-week analysis, completion heatmap. |

## 3. Category M — The "Unable to connect" dialog over the activity stats modal

### M1. The lazy-modal loader blames the connection for every failure

**Evidence.** All fitness dialogs load through
`openLazyModal(name, open)` (`src/features/fitness/FitnessModals.js:28-55`):

```js
const pending = loadModal(name)
  .then(open)
  .catch((error) => {
    loaded.delete(name);
    console.error(`Unable to open ${name}:`, error);
    showConfirm({
      title: 'Unable to Open',
      message: 'This screen could not be loaded. Check your connection and try again.',
      ...
```

The `.catch` sits after `.then(open)`, so it swallows **two unrelated failure
classes** and reports both as a connectivity problem:

1. **Chunk-load failures** — `import('./Modals/StatsModal.js')` rejecting.
2. **Any runtime exception inside `StatsModal.open()`** — a calculation or
   rendering throw would also surface as "check your connection".

The modal itself is healthy: driven live in dev with representative data
(time and sets-reps activities, quick-records with `duration: null`, decimal
durations, bodyweight sets), `openStats` builds and shows the modal correctly
every time **[verified live]**. No plausible data-dependent throw was found in
`calculateActivityStatistics`/`buildStatsContent` (nulls and missing
categories are guarded; `normalizeHexColor` falls back). That leaves class 1
as the prime suspect for the report, and there are two concrete, known
mechanisms in this project:

- **Stale deployed shell.** `StatsModal-[hash].js` is its own lazily loaded
  chunk in the production build (verified by building: `dist/assets/StatsModal-EYG0hzoa.js`).
  The PWA registers with `registerType: 'prompt'` (`vite.config.js:95`), so a
  client that postponed the update keeps running the old shell. After a
  redeploy replaces the gh-pages tree, the old hashed chunk URL no longer
  exists on the network; if the old service worker's precache no longer holds
  it either (evicted, or the SW updated its precache while the open client
  still runs old code), the dynamic import rejects — **while fully online**.
- **The dist-clobber footgun** (documented in
  `docs/architecture/…` history and the project's operational notes):
  `npm run test:pwa` / `check:bundle:pages` write a *Pages* build into the
  same `dist/` a local phone preview serves. Chunk URLs then resolve to the
  SPA HTML fallback; the import parses HTML as JS and rejects — again while
  online, and again surfaced as "check your connection".

Eager modals opened earlier in the session (library, info modal) are already
cached by the module loader, which is why the failure presents as "only the
stats modal won't open".

**Change.**

1. **Split the error paths.** Attach the connectivity-flavoured catch to
   `loadModal(name)` only. Wrap `open(modal)` separately; on throw, log and
   show an error dialog that names the screen and does not mention the
   network ("Statistics couldn't be displayed. If this keeps happening,
   please report it.").
2. **Treat import failure as a probable stale deploy.** On dynamic-import
   rejection when `navigator.onLine === true`, offer "Update and reload"
   (route through `PwaUpdateCoordinator` when a waiting worker exists, else
   plain `location.reload()`); keep the connectivity message only for the
   `navigator.onLine === false` case.
3. **Prefetch the stats chunk.** `FitnessModule.js:177-189` prefetches the
   library/routines/picker chunks on pointerdown, but nothing prefetches
   `stats`: the info modal's "View full statistics" button
   (`ActivityInfoModal.js:145-147`) always pays a cold import at tap time.
   Call `prefetchFitnessModal('stats')` (and `'addEditActivity'`) when the
   activity-info modal opens. This closes most of the failure window and
   makes the tap instant.
4. **Keep the diagnostic.** The existing
   `console.error('Unable to open stats:', error)` is the confirmation
   channel: when the user next reproduces this, that line distinguishes a
   `TypeError: Failed to fetch dynamically imported module` (class 1) from a
   calculation throw (class 2).

**Risk.** Low. Error-path refactor plus one prefetch call; no calculation
changes. Testable by stubbing a rejecting loader (unit) and by an e2e that
blocks the chunk URL and asserts the new dialog copy.

### M2. Hard-coded z-index on the stats modal contradicts the modal stack

**Evidence.** `StatsModal.js:46` bakes `z-[1004]` into the overlay with a
comment explaining the ladder, but `openModal` (`components/Modal.js:83`)
assigns `style.zIndex = 1000 + stack index` on every open, overriding the
class. The class and its comment are dead and misleading.

**Change.** Remove the class; the stack is the source of truth. Cosmetic.

## 4. Category C — Fitness/activity calculation correctness

### C1. `parseInt` truncates decimal durations — wrong totals on two surfaces

**Evidence.** Durations are stored as numbers (schema
`duration: v.optional(v.number())`; the record modal writes
`Number(duration)`, `ActivityDetailsModal.js:430-433`), so `1.5` hours is a
legitimate stored value. Both aggregate paths truncate it:

- `activityStats.js:98` — `let durationInMinutes = parseInt(record.duration) || 0;`
- `stats.js:740` — same pattern in the Stats page's fitness totals.

`parseInt(1.5)` → `1`, so a 1.5-hour session contributes 60 minutes, not 90.
**[verified live]**: seeding a 1.5 h run + a 30 min run, the stats modal shows
**Total Duration 1h 30m** (should be 2h) while its own **Best Session** card
shows **90 min** for the same record — `formatBestSession`
(`activityStats.js:319-330`) multiplies without truncating. The Stats page's
"Total Time" tile shows the same wrong 1h 30m.

Seconds are also mishandled by rounding *after* division in one path and not
the other (`activityStats.js:327` rounds to whole minutes; `:104` keeps the
fraction), and `extractDurationProgressionData` (`activityStats.js:384`)
already does the whole thing correctly with `parseFloat`.

**Change.** One shared `durationToMinutes(record)` helper (float, unit-aware)
used by the stats modal, the Stats page, best-session formatting, and the
progression extractor. Delete the three divergent inline conversions.

**Risk.** None beyond numbers becoming correct.

### C2. "Best Session" for strength activities is chosen by best single set

**Evidence.** `activityStats.js:64-84`: inside `record.sets.forEach`, each
set's `weight × reps` is compared against `maxVolume` and the *record* is
captured when a *single set* beats the running best. A session of 3×(50×10)
(1,500 total) loses to a session with one 60×10 set (600 per set) — the
comment says "Track best session by total volume" and the card then displays
the winning session's *total* (`formatBestSession`, `:300-306`), presenting a
number that never won the comparison. Sets with `unit === 'none'`
(bodyweight) are also excluded from volume entirely, so a bodyweight activity
can never have a best session.

**Change.** Accumulate `sessionVolume` per record, compare after the inner
loop. Decide bodyweight semantics alongside C8/N8 (reps-only volume or
best-by-total-reps for `unit === 'none'` activities).

**Risk.** Low; displayed "best" may change for existing data — that is the
fix working.

### C3. Averages divide by all sessions, including sessions with no data

**Evidence.** `activityStats.js:86-87, 125`: `averageSets`, `averageReps`,
`averageDuration` divide by `totalSessions`, but quick-records deliberately
carry no sets/duration (`recordActivitiesForDate`,
`activities.js:112-122` — "This is deliberate, not a missing field").
**[verified live]**: 90 + 30 minutes over two timed sessions plus one
quick-record shows **Avg Duration 30m** (page: **18m** across five mixed
sessions) instead of 60m. The same applies to the Stats page
`averageSessionDuration` (`stats.js:763-764`), whose denominator even
includes sets-reps sessions that *cannot* have durations.

**Change.** Divide by sessions carrying the metric (`sessionsWithDuration`,
`sessionsWithSets`). Optionally surface the quick-record count separately
("3 sessions unlogged") rather than silently averaging them in.

**Risk.** Low. Semantics decision noted in § 9 (D4).

### C4. Recency stats use `timestamp` (when logged) instead of `date` (when performed)

**Evidence.** `lastPerformed` (`activityStats.js:53`), `recentFrequency`
(`:135-139`), and `weeklyAverage`'s first-session anchor (`:142-146`) all read
`record.timestamp`. Backdating is a first-class flow (the `+` button records
onto the selected calendar day), so logging last month's sessions today makes
them all "performed today" and inflates the 30-day frequency; conversely a
session logged at 00:30 for yesterday shifts. The progression charts already
use `record.date` (`activityStats.js:387, 432-435`) — the same modal
disagrees with its own chart. `byActivity` sort order is also
timestamp-based (`recordedHistory.js:32`), so "last record in array" ≠ latest
performed date.

**Change.** Compute recency and ordering from `dateKey` (with timestamp as a
tiebreaker within a day). Sort `byActivity` by `(date, timestamp)`.

**Risk.** Low; `formatLastPerformed` already accepts date-only input.

### C5. "Per Week Average" explodes for young activities

**Evidence.** `activityStats.js:142-146`: `weeksSinceFirst = max(1 day,
now − firstSession)/7`. Two sessions recorded yesterday → `2 / (1/7)` = **14
per week**. Compounded by C4 (anchor is the first *timestamp*).

**Change.** Floor the window at 7 days (or label the stat "since first
session" and show the raw span). Anchor on `date` per C4.

### C6. The Stats page's "last 30 days" is three different windows

**Evidence.** `stats.js:750-760` counts sessions with
`recordDate >= today − 30 days at current wall-clock time` (a 30-day window
whose boundary day is excluded after midnight); `stats.js:766-780` counts rest
days by iterating `thirtyDaysAgo..today` **inclusive** — 31 calendar days —
then divides by 30 (`:780`), so 31 rest days would display **103.3%**. The
activity modal's `recentFrequency` uses a third variant (timestamp-based
strict `>`).

**Change.** One shared "last N calendar days" helper (today inclusive, N
days, local keys) used by all three; divide by the actual window length.

### C7. Computed-but-never-rendered fitness stats; duplicated tile

**Evidence.** `calculateFitnessStatistics` computes `totalSessions` and
`categoriesUsed` (`stats.js:718-748`) — neither appears in any template; the
all-time session count is displayed nowhere in the app. Meanwhile the
overview's purple tile and the fitness section's indigo tile both show
`recentSessions` with near-identical labels ("Fitness Sessions / Last 30
days" vs "Recent Sessions / Last 30 days") — the same number twice on one
screen.

**Change.** Show `totalSessions` (all-time) on one of the two tiles; either
render a category-breakdown (see N10) or stop computing `categoriesUsed`.

### C8. Strength progression chart contradicts its own contract

**Evidence.** `extractStrengthProgressionData` (`activityStats.js:419-438`):
the comment says "Ignore sets with unit === 'none'" but the code maxes
`parseFloat(set.value)` over **all** sets, coercing missing values to 0 — a
bodyweight session plots as a 0 point, dragging the chart to the floor.
`getWeightUnitForActivity` (`:350-367`) then labels the axis with the most
recent non-'none' unit and falls back to `'lbs'`, mixing kg and lbs sessions
on one unlabelled scale if the user ever switched units.

**Change.** Filter to weighted sets as documented; skip sessions with no
weighted sets; if an activity's records mix units, convert into the latest
unit (fixed factor) or annotate per-point. Fallback default should come from
the activity's own `units` field before guessing `'lbs'`.

### C9. Empty-state check erases real history for archived-only libraries

**Evidence.** `renderStatsContent` (`stats.js:186-190`) appends the overview,
toggle and detail sections, then — if `historicalHabits === 0 &&
totalActivities === 0` — `renderEmptyState` **replaces** `container.innerHTML`,
destroying what was just rendered. `totalActivities` excludes archived
activities (`stats.js:713`), but recorded sessions of archived activities
remain valid history: a fitness-only user who archives all activities sees
"No Data Yet" despite months of sessions (and the wasted render every time).

**Change.** Gate on "no habits AND no recorded sessions AND no activities"
and decide the empty state *before* rendering sections, not after.

## 5. Category H — Habit calculation correctness

### H1. Skipped days count as failures in rates and streaks — against the app's own semantics

**Evidence.** The home progress ring excludes skipped days from the
denominator (`selectors/progress.js:39, 54`: `isHabitScheduledOnDate && !isHabitSkippedToday`),
and the Stats page's daily group series does the same
(`stats.js:655-660`), with the group streak explicitly treating all-skipped
days as neutral (`stats.js:624-627`). But **every per-habit calculator counts
a skipped day as a scheduled miss**:

- Stats page: `calculateHabitCompletionRate` (`stats.js:441-447`),
  `calculateCurrentStreak` (`:572-580` — a skipped day breaks the streak),
  `calculateLongestStreak` (`:594-606`), weekly/monthly variants.
- Habit modal: `calculateHabitCompletionRate` (`habitStats.js:517-525`),
  `calculateCurrentStreak` (`:539-547`), `calculateLongestStreak`
  (`:565-575`).

**[verified live]**: one skipped day in an otherwise 4-for-6 week renders
**57.1%** (4/7) in the habit modal and on the Stats page carousel where the
home surface's own convention yields 66.7% (4/6); the same skipped day resets
"Current Streak" to 0 while the group streak sails through it. The modal
simultaneously reports "Times Skipped — 6.7% of actions" as a separate,
correct metric — the skip is both *neutral bookkeeping* and *a failure* in
the same modal.

**Change.** Adopt one rule — recommended: **skip = neutral** (excluded from
denominators, does not break streaks), matching the home ring, the group
series, and the fact that skips are already surfaced separately. Implement in
the shared calculators (X1) so every surface inherits it.

**Risk.** All completion percentages and streaks can change (upward). Needs
the owner's sign-off (§ 9 D1) and a changelog note.

### H2. "Current Streak" shows 0 until today's habit is completed

**Evidence.** Both current-streak implementations start the walk at *today*
(`habitStats.js:533-547`, `stats.js:567-580`): a habit completed 30 days
running shows **Current Streak 0** all day until today's checkmark lands
**[verified live]**. Habit-tracker convention (and the least surprising
reading) is that an as-yet-incomplete today is *pending*, not *broken*: the
streak should count from yesterday and grow when today completes.

**Change.** Skip today in the walk when today is scheduled-but-not-yet
completed (and not skipped); count it once completed.

### H3. The Stats page's 7d/30d completion carousel has three window defects

**Evidence.** `calculateDailyCompletionPeriods` (`stats.js:676-705`):

1. Zero-active days (all habits skipped, or holiday with no active-on-holiday
   habits) carry `percentage: 0` and are averaged into the 7d/30d windows as
   failures — while the "All Time" slide in the *same carousel* filters
   `active > 0` (`:695-698`) and the group streak treats them as neutral.
   **[verified live]**: 57.1% where the active-day average is 66.7%.
2. The fallback branch for sparse histories (`:686-692`) averages only days
   with `completed > 0` — days where everything was missed are silently
   dropped, inflating the figure for exactly the users it should warn.
3. `series[0]` is today, included from midnight at 0% (compare H2).

**Change.** Define the window as "last N *active* days" (or "last N calendar
days excluding zero-active days"), drop the completed-days-only fallback, and
exclude a pending today. One definition, shared by all three slides.

### H4. "Completed Today" counts period completions, not today's completions

**Evidence.** `stats.js:288-290` counts `isHabitScheduledOnDate(today) &&
isHabitCompleted(today)`. For weekly/monthly/yearly *target* habits,
`isHabitScheduledOnDate` is always true (`ScheduleEngine.js:43-53`) and
`isHabitCompleted` keys on the **period** (`schedule.js:250-255`) — a weekly
habit completed Monday counts toward "Completed Today" every day that week.

**Change.** Either restrict the tile to the daily group, or count a
non-daily habit only on the day its completion was recorded. (The overview
tile's purpose reads as "what did I do today"; recommend the latter.)

### H5. Archived habits drag every aggregate toward zero

**Evidence.** `calculateHabitStatistics` iterates **all** validated habits
including archived (`stats.js:213, 244`) — only `totalHabits` filters them
(`:214-218`). Consequences:

- Category breakdown counts archived habits ("N habits") and averages their
  completion rates (`:292-318`); a habit archived >30 days ago has 0
  scheduled days in the window (`schedule.js:99-109` stops scheduling at
  `archivedAt`), so `calculateHabitCompletionRate` returns 0 (`:451`) and the
  category average sinks toward 0% forever.
- The same zeros feed `dailyCompletionRate` (`:321-326`) and the
  weekly/monthly group averages (`:328-342`).
- The daily group series correctly keeps archived habits' *historical* days
  (their pre-archive record is real) — the defect is only the fixed-window
  rates that mostly or entirely postdate the archive.

**Change.** Exclude archived habits from current-facing aggregates (category
counts/averages, 30-day rates); keep them in the historical series. If a
habit was archived mid-window, evaluate its rate only up to `archivedAt`.

### H6. Pausing a habit retroactively erases its statistical history

**Evidence.** `ScheduleEngine._isHabitScheduledOnDate` returns false for
paused habits **on every date, past included** (`ScheduleEngine.js:34`). The
habit modal is reachable for paused habits (the Habits page renders its stats
button regardless), and every number in it — completions, rates, streaks —
computes to zero because no historical day is "scheduled" anymore. The Stats
page separately skips paused habits in aggregation (`stats.js:245`) while
still counting them in `pausedHabits`. Unpausing restores everything, so the
data is intact — the *presentation* claims it is gone.

**Change.** Make pause date-aware for statistics: treat `paused` as "not
scheduled from the pause onward" (requires storing `pausedAt`, which the
schema doesn't yet have — an additive optional field), or at minimum have the
stats calculators evaluate past dates ignoring the pause flag. The second is
implementable today with a `{ ignorePause }` option on the shared calculators.

**Risk.** Medium: touches `ScheduleEngine` consumers or adds a parallel path;
needs the regression suite from Phase 0 first.

### H7. Three divergent creation-date derivations, one of them timezone-buggy

**Evidence.**

- `stats.js:380-418` (`getHabitCreationDate` + `dateFromStoredValue`):
  parses `YYYY-MM-DD` as a **local** date, verifies round-trip, unit-tested
  (`tests/unit/statsCreationDate.test.js`). Correct.
- `habitStats.js:233-271` (`getHabitStartDate`): `new Date(habit.createdAt)`
  and `new Date('YYYY-MM-DD')` — bare date keys parse as **UTC** midnight, so
  in UTC-negative timezones every derived start date shifts one day earlier
  (off-by-one in daysTracked, rates, streak windows). Also never normalises a
  timestamped `createdAt` to local midnight, so first-day comparisons
  (`date < creationDate`, `:515`) are time-of-day-dependent.
- `schedule.js:44-92` (`_getEarliestStartDate`): a third variant mixing
  `createdAt`, id-timestamp and earliest data evidence, UTC-parsing completed
  keys, run on **every scheduling check** (see P1).

**Change.** One exported helper (the tested `stats.js` one), extended with
the earliest-data-evidence fallback, used by all three call sites; local-safe
parsing throughout; memoised per habit object (P1).

### H8. Habit-modal daily windows are DST- and time-of-day-fragile

**Evidence.** `habitStats.js:306-308, 506-508`: days-since-creation via
`(today − creationDate) / 86_400_000` floors — across a DST fall-back the
fraction shifts and the count can be off by one; `stats.js` already has the
correct calendar-day arithmetic (`calendarDaysBetween`, `:395-402`). Same file
iterates `date = new Date(today); date.setDate(today.getDate() - i)` keeping
the current wall-clock time, then compares against an un-normalised creation
date (see H7).

**Change.** Use `calendarDaysBetween`/`startOfLocalDay` from the shared
module everywhere.

### H9. Weekly "last completed" can be a date in the future

**Evidence.** `habitStats.js:380-386` (weekly), `:426` (monthly), `:470`
(yearly) record `stats.lastCompleted = periodEnd.toISOString()` — the end of
the *current* week/month/year is usually in the future, and
`formatLastPerformed` (`datetime.js:236-248`) then computes a negative day
diff and renders strings like "-2 days ago" for a habit completed this week.
It is also semantically wrong: it reports the period boundary, not when the
user acted.

**Change.** Track the actual completion day (walk the period's days for the
completed date, or clamp at today). Add a guard in `formatLastPerformed` for
future dates ("Today" at minimum).

### H10. A third of the computed habit statistics are never rendered

**Evidence.** Computed and dropped on the floor:

- Stats page: per-habit `streaks[]` (`stats.js:272-285`),
  `averageCompletionRate` (`:344-350`), `dailyCompletionRate` (`:321-326`),
  `activeHabits`/`pausedHabits` (`:220-221`), `completionRates` beyond the
  category breakdown.
- Habit modal: `weeklyAverage` (`habitStats.js:357-358, 402, 446, 488`) and
  `targetProgress` (`:292`, never assigned a real value either) are absent
  from `buildHabitStatsContent`.

This is wasted computation on the hot path (P1) and hidden product value —
"most consistent habit", "average per week" are exactly the numbers a stats
page is for (§ 10 N5).

**Change.** For each: render it (preferred, see N4/N5) or delete the
computation. No third option.

### H11. Group longest streak silently caps at 366 days over an all-time series

**Evidence.** `buildDailyGroupCompletionSeries` walks from the earliest habit
creation to today — years of days (cost: P1) — then
`calculateLongestGroupStreak` reads only `series.slice(0, 366)`
(`stats.js:622`). The tile is labelled "Longest 100% Streak (Daily)" with no
window qualifier: a 400-day perfect run reports as 366 (and the remaining
series was built for nothing).

**Change.** Compute over the full series (it exists; the cap saves nothing
once P1 lands) or label the tile "(last year)". Recommend the former.

### H12. Monthly window arithmetic only survives one year-wrap

**Evidence.** `stats.js:526-531`: `targetMonth = today.getMonth() − i` with a
single `+12`/`−1 year` adjustment — correct for `i ≤ 12` only. Currently
latent (windows of 3), but it is a copy-paste trap: `habitStats.js` already
has the correct cursor-based iteration (`:121-134`).

**Change.** Use the cursor form in the shared module; delete this variant.

### H13. Weekly windows are Monday-based but weekly target keys are ISO-week-based

**Evidence.** Weekly rate/streak windows are built with local Monday starts
(`habitStats.js:26-33`, `stats.js:471-479`), while a weekly target habit's
completion key is `YYYY-W{ISOWeekNumber}` (`schedule.js:225-228`) — and
`getISOWeekNumber` computes the ISO week number against the *calendar* year
start (`datetime.js:13-20`), not the ISO week-year: dates in the week
spanning New Year can produce week 53/1 mismatches, letting a completed week
at the year boundary evaluate as uncompleted (or leak into the neighbour).
Low frequency, but it is the user's holiday week.

**Change.** Fix `getISOWeekNumber` to use the ISO week-year pair (or key
weekly periods by the Monday date, which removes the ambiguity outright —
schema-compatible since `periodKey` is a free string, but requires a key
migration; the `getISOWeekNumber` fix alone is the safe first step).

### H14. `validateHabitData` silently drops malformed habits from all statistics

**Evidence.** `stats.js:213, 1162-1169` requires `typeof paused ===
'boolean'`; a habit missing the flag (hand-imported data, partial sync)
vanishes from every Stats page number with no signal, while the Habits page
still renders it. Current write paths always set it (`HabitFormModal.js:364`,
schema requires it), so this is a latent divergence, not an active bug.

**Change.** Coerce (`paused: Boolean(h.paused)`) instead of dropping, or log
loudly when validation rejects.

## 6. Category X — Cross-surface consistency and duplication

### X1. Three habit-stat calculation suites with drifted semantics

**Evidence.** The Stats page (`stats.js:420-609`) and the habit modal
(`habitStats.js:99-578`) each implement completion-rate, current-streak,
longest-streak, and weekly/monthly window calculators; the home selectors
(`progress.js`) implement period progress a third way. Confirmed drift:
creation-date derivation (H7), skip handling (H1 — plus `progress.js` which
differs from both), streak search windows (page caps at 365/366 days,
`stats.js:572, 594`; modal walks unbounded to creation, `habitStats.js:539,
565`), day-count arithmetic (H8). Any future fix applied to one file silently
misses the others — several findings above exist *because* that already
happened.

**Change.** One `src/features/habits/helpers/habitCalculations.js` (pure,
unit-tested) exporting the calculators with explicit options
(`{ skipPolicy, includeToday, ignorePause, window }`); page, modal and
selectors consume it. This is the enabling refactor for most of category H
and is Phase 1's core.

### X2. Three carousel implementations, two autoscroll cadences, duplicate IDs

**Evidence.** `renderHabitCompletionCarousel` +
`initializeHabitCompletionCarousel` exist in `stats.js:1184-1330` (30 s
autoscroll) and `HabitStatsModal.js:234-445` (10 s autoscroll), both creating
`id="habit-completion-carousel"` — duplicate IDs in one document when the
modal opens over the Stats page's persistent DOM (`stats.js` looks up by ID,
`HabitStatsModal` scopes by root — one midnight re-render away from grabbing
the wrong node). Touch/mouse handlers are near-identical copies; the modal
version re-adds a `mouseleave` interval even after `closeModal` cleared it if
the pointer exits after close.

**Change.** One carousel component (module-scoped, no global IDs, one
cadence), used by both.

### X3. Record field types differ between quick-records and the schema

**Evidence.** Convex stores `duration`, `sets[].reps` as numbers,
`sets[].value` optional number (`schema.ts:186-200`); local seeds and older
local records carry strings; calculators defensively `parseInt`/`parseFloat`
strings (C1). The client's own record modal writes numbers. Two
representations of the same record flow through the same math.

**Change.** Normalise at the index boundary (`getRecordedHistoryIndex`
coerces once), so calculators consume one shape.

### X4. `timestamp` vs `date` divergence

Covered as C4; listed here because the *inconsistency* (charts use `date`,
stats use `timestamp`, in the same modal) is the cross-surface defect.

## 7. Category U — UI defects in the stats surfaces

### U1. The habit stats modal bypasses the shared modal system

**Evidence.** `HabitStatsModal.js:39-117` hand-rolls its overlay: no
`openModal`/`closeModal`, therefore no body scroll-lock (background scrolls
behind it), no focus trap or focus restore, no `role="dialog"`/aria
attributes, no Escape handling, and a hard-coded `z-50` outside the
1000-based stack. The fitness `StatsModal` does all of this correctly through
`components/Modal.js`. One app, two modal behaviours.

**Change.** Route it through `openModal`/`closeModal` like every fitness
dialog.

### U2. The habit stats modal injects unescaped user strings

**Evidence.** `HabitStatsModal.js:45-50`: `${habit.name}`, `${habit.icon}`,
`${category?.name}` interpolate raw into `innerHTML`; the fitness stats modal
escapes the equivalent fields (`StatsModal.js:51-54`,
`escapeHtml`). A habit named `<img src=x onerror=…>` executes. Self-inflicted
only (own data), but it violates the codebase's own sanitisation contract
(`shared/sanitize.js` docblock) and will bite the moment shared/imported data
exists.

**Change.** `escapeHtml` all interpolated strings in
`buildHabitStatsContent`/`openHabitStatsModal` (and audit the Habits list
markup, which has the same pattern).

### U3. The habit modal's empty state is unreachable

**Evidence.** `buildHabitStatsContent` gates on `stats.daysTracked === 0`
(`HabitStatsModal.js:128`), but every group computes `daysTracked ≥ 1`
(daily: `Math.max(1, …)`, `habitStats.js:306-308`; weekly/monthly/yearly
counts are `…+ 1`). A brand-new habit shows a wall of zeros instead of the
designed "No data available yet" card.

**Change.** Gate on "no completions and no skips ever" (`totalCompletions
=== 0 && totalSkipped === 0 && recentActivity === 0`), or pass an explicit
`hasAnyData` flag from the calculator.

### U4. Stats page toggle labels omit their windows

**Evidence.** The detailed tiles say "Weekly habits avg" / "Monthly habits
avg" (`stats.js:843-867`) but the numbers are fixed 4-week / 3-month windows
(`:330, 338`); the habit modal's equivalents are explicitly labelled 4w/12w
and 3m/12m. Users comparing the two see different numbers under the same
implied metric.

**Change.** Label the windows ("4-week avg", "3-month avg") or align the
windows with the modal's.

### U5. Error and empty states destroy sibling sections

Covered as C9 (`renderEmptyState` clobbering); the error path
(`stats.js:192-206`) replaces the whole container too, which is correct for a
failed compute but shares the pattern — after C9's fix, both states should be
decided before any section renders.

## 8. Category P — Performance

### P1. Stats page recompute is O(days × habits × completion-entries) and can freeze the app

**Evidence.** `buildDailyGroupCompletionSeries` (`stats.js:638-674`) walks
every day from the earliest habit creation to today; each day calls
`isHabitScheduledOnDate` per habit; each such call runs
`_getEarliestStartDate` (`schedule.js:44-92`), which iterates **every key of
`habit.completed`** (and `skippedDates`) allocating `Date` objects — so the
series alone is `days × habits × entries`. On top: per-habit
`calculateLongestStreak` (366 × schedule checks), `calculateHabitCompletionRate`
(30 ×), weekly/monthly loops (up to ~90 day-iterations per habit), and
`holidayDaysThisYear` (365 × `isHoliday`).

Measured **[verified live]**, dev build on this machine:

- 12 daily habits × 1 year of completions: **~470–770 ms** main-thread block
  per stats recompute (every relevant state change while the view is active,
  every activation, every midnight).
- 12 daily habits × 2 years: the first render **froze the renderer for >30 s**
  (tool calls into the page timed out; the tab eventually recovered).

A two-year-old account with a dozen habits makes the Stats tab effectively
unusable, and `getStatsViewModel`'s cache only helps until any habit toggles.

**Change.**

1. Memoise the derived per-habit start date on the habit object reference
   (WeakMap) — turns `_getEarliestStartDate` from per-call O(entries) to
   amortised O(1) and benefits *every* consumer of
   `isHabitScheduledOnDate`, not just stats.
2. Build each habit's completed/skipped day-key `Set` once per recompute
   (already the natural shape of `habit.completed`) instead of re-deriving
   period keys per day where possible.
3. Bound the daily series to the window anything actually consumes
   (`max(366, all-time-average window)`) — or keep all-time but compute it
   from the completion entries directly (O(entries)) rather than day-walking.
4. Add a perf regression test in the spirit of
   `tests/e2e/fitness/optimisation-invariants.spec.js` (`FITNESS_PERF=1`):
   seed 12 habits × 2 years, assert stats view-model build under a budget
   (target <50 ms; hard gate <150 ms).

**Risk.** Medium-touch refactor of hot shared code; must land after Phase 0's
characterisation tests.

### P2. Duplicated work per render

`renderHabitStatsSection` re-renders via full `innerHTML` and re-initialises
the carousel behind a 100 ms `setTimeout` (`stats.js:938-941`) — fine at
today's scale once P1 lands; noted for the consolidation (X2), not as an
independent fix.

## 9. Decisions — confirmed by the owner 2026-07-31

| # | Question | **Decision** |
|---|---|---|
| D1 | Skip semantics (H1): is a skipped day neutral, or a miss? | **Neutral everywhere** — excluded from denominators, does not break streaks. Skips keep their own separate metric. |
| D2 | Pending today (H2/H3): does an incomplete today break streaks / drag today's rate? | **Pending** — today is excluded until completed or the day ends. |
| D3 | Paused habits (H6): should pause hide history in stats? | **Keep full history, freeze at the pause.** A paused habit's own stats modal shows its complete record up to the moment it was paused; no new days accrue while paused, and it contributes nothing to page-level aggregates until unpaused. Requires an additive `pausedAt`. |
| D4 | Sessions without metrics (C3): average over all sessions or only sessions with data? | **Only sessions carrying the metric**, with an "N unlogged" note so quick-records stay visible. |
| D5 | Archived habits (H5): appear in category breakdown? | **Excluded from current-facing aggregates**; their own record and their historical days are kept. |
| D6 | "Completed Today" (H4): period-completions or literal today? | **Literally today.** |
| D7 | Longest streak window (H11): all-time or last-year? | **All-time, no cap.** |

Design scope, also confirmed: **full reorganisation** of the Stats page and
both modals — one consistent card system, labelled sections, progressive
disclosure (summary above, detail below), and charts where a bare number does
not carry the meaning.

## 10. New statistics the collected data already supports

Ordered per surface, highest value first. Everything below uses fields that
exist in `convex/schema.ts` today; no new collection is required.

### Habit stats modal

- **N1 — Target-habit progress stats.** `habit.progress[periodKey]` (numeric,
  vs `habit.target`, with `targetUnit`) is tracked on the Home screen and
  **invisible in every stats surface**. Show: average progress vs target,
  total units accumulated (e.g. "412 glasses"), best period, current period
  progress. The modal already computes a `targetProgress: null` placeholder
  (`habitStats.js:292`) that was never finished — this completes it.
- **N2 — Completion calendar heatmap.** Last-12-weeks grid
  (GitHub-style) from `habit.completed` day keys — the single most requested
  visual in habit trackers; the data is a direct lookup, and the SVG
  competence already exists (`generateProgressChartSVG`).
- **N3 — Day-of-week breakdown.** Completion rate per weekday (best day /
  worst day), from the same day keys. Directly actionable ("you never
  meditate on Fridays").
- **N4 — Surface the already-computed numbers** (H10): weekly average
  ("×3.2/week"), and for daily habits a small "completions this
  month vs last month" delta.

### Stats page — Habits

- **N5 — Most consistent / most struggling habit (30d).** The
  `completionRates` map is already computed and unused (`stats.js:249-258`);
  render top and bottom entries with names and rates.
- **N6 — Current group streak** beside the longest (the series exists;
  it is one more pass), plus **perfect days this month** (`completed ===
  active` count from the series).
- **N7 — Skip analytics.** Total skips this month, most-skipped habit, skips
  by weekday — from `skippedDates`, complementing D1's neutral-skip rule so
  skips stay visible.

### Activity stats modal

- **N8 — Personal records.** Max weight ever (+date), best session volume
  (fixes C2), estimated 1RM (Epley: `w × (1 + reps/30)`) for sets-reps;
  longest/fastest session honouring `betterDirection` for time-based;
  "PR set N days ago" recency line.
- **N9 — Session frequency sparkline.** Sessions/week over the last 12 weeks
  (reuses the existing SVG chart) — turns the bare "Per Week Average" into a
  trend.
- **N10 — Intensity distribution.** The full split (`low/moderate/high`
  percentages) instead of only the mode (`mostCommonIntensity`).

### Stats page — Fitness

- **N11 — Sessions by category.** `categoriesUsed` is computed and dropped
  (C7); render a per-category session count/percentage using the category
  colours (mirrors the habits "By Category" block).
- **N12 — Weekly training volume.** Total tonnage (Σ weight×reps) and total
  duration per week, trend over 8–12 weeks.
- **N13 — Volume by muscle group.** `activities.muscleGroup` is collected and
  never surfaced anywhere; weekly sets per muscle group is the standard
  hypertrophy-tracking view and is a straight join of records → activity →
  muscleGroup.
- **N14 — Training streaks.** Consecutive weeks with ≥1 session
  (current/longest), rest-day-aware ("active weeks" streak) — mirrors habit
  streaks on the fitness side.
- **N15 — Program adherence.** Programs define planned sessions
  (`scheduledDays` per week, minus per-program `restDays`, phase-accurate via
  `schedulePhases`): planned vs recorded sessions per program week → "week 3:
  4/5 sessions, 80%". Surfaced in `ProgramDetailsModal` and/or the Stats
  page. This is the highest-leverage *new* number in the fitness feature —
  programs currently have no feedback loop at all.

### Overview strip

- **N16 — Combined "active day" metrics.** A day counts active if any habit
  was completed or any session recorded: total active days, current/longest
  combined streak — the one number that spans both halves of the app.

## 11. Implementation plan

Phases are ordered so that every calculation change lands on top of a test
harness that would catch a regression, and the user-facing bug (M1) ships
early without waiting for the calculation work.

### Phase 0 — Characterisation tests (no behaviour change)

1. Extract nothing yet; write unit tests around the *current* public
   calculators (`calculateHabitStatistics` page + modal variants,
   `calculateActivityStatistics`, `calculateDailyCompletionPeriods`,
   `calculateLongestGroupStreak`) with fixture datasets covering: decimal
   durations, quick-records, backdated records, skips, holidays, paused,
   archived, target habits (daily/weekly/biweekly/monthly/yearly), DST
   boundaries, year boundaries. Mark the assertions that encode *wrong*
   current behaviour (C1, H1…) as such so Phase 1 flips them deliberately.
2. Add the e2e seed helpers used in this audit (harness `seed` snapshots for
   stats scenarios) under `tests/fixtures/`.

Gate: suite green on unmodified code.

### Phase 1 — Shared calculation module + correctness fixes

1. Create `src/features/habits/helpers/habitCalculations.js` (X1) and
   `src/features/fitness/helpers/recordMetrics.js` (`durationToMinutes`,
   session volume, date-based recency) — pure, option-driven, unit-tested.
2. Land the decided semantics (§ 9): D1 skip-neutral, D2 pending-today, D4
   metric-aware averages, D5 archived exclusion, D6 literal today, D3
   stats-ignore-pause.
3. Fix, in the shared modules: C1, C2, C3, C4, C5, C6, C8, H1, H2, H3, H4,
   H5, H7, H8, H9, H11, H12, H13 (the `getISOWeekNumber` week-year fix),
   H14, X3, X4.
4. Point Stats page, both modals and `progress.js` at the shared modules;
   delete the superseded local calculators. Flip the Phase 0 assertions to
   the corrected values.

Gate: unit + e2e green; manual matrix (§ 12) on seeded dev build.

### Phase 2 — Modal loading failure and UI hygiene

1. M1: split `openLazyModal` error paths; online-vs-offline messaging; PWA
   update integration on chunk failure; prefetch `stats` (and
   `addEditActivity`) from the activity-info modal; M2 z-index cleanup.
2. U1 (habit modal onto the shared modal stack), U2 (escaping), U3
   (reachable empty state), U4 (window labels), C7/C9/U5 (render/empty-state
   ordering, deduplicated tiles, all-time sessions tile).
3. X2: single carousel component.

Gate: e2e for the failure dialog (blocked chunk → update prompt, offline →
connectivity copy), axe/aria pass on both modals, visual check both themes.

### Phase 3 — Performance

1. P1 items 1–3 (start-date memo, per-recompute key sets, bounded/derived
   series).
2. P1 item 4: perf budget test (12 habits × 2 years, view-model <50 ms
   target, <150 ms gate) wired like `FITNESS_PERF`.

Gate: budget test green; no numeric drift against Phase 1's unit fixtures.

### Phase 4 — New statistics

Recommended order: N1 (target progress — completes an unfinished feature),
N8 (PRs), N5+N6+N7 (page habit tiles from already-computed data), N11
(categories — data already computed), N2 (heatmap), N13 (muscle groups), N9,
N3, N12, N14, N10, N4, N16, N15 (program adherence last — biggest scope,
touches program phases).

Each ships with its unit fixtures and a screenshot in the PR description.

## 12. Verification matrix

| Area | Automated | Manual |
|---|---|---|
| Duration math (C1, C3) | Unit: fixtures with 1.5 h, seconds, quick-records | Stats modal + page totals agree with hand-computed values |
| Best session (C2) | Unit: multi-set vs single-heavy-set sessions | Modal card shows the true best |
| Recency (C4–C6) | Unit: backdated records; window boundary at midnight | Backdate a record; last-performed follows the date |
| Skip semantics (H1, H3) | Unit: skip day in each window; group vs individual parity | Same skipped day reads identically on home ring, page carousel, habit modal |
| Streaks (H2, H11) | Unit: pending today; >366-day runs | Morning check: streak persists before today's completion |
| Paused/archived (H5, H6) | Unit: archived mid-window; paused with history | Pause a habit → modal history intact |
| Modal loading (M1) | e2e: route-block the stats chunk → update dialog; offline → connectivity dialog | Kill dev server between open and tap |
| Modal a11y (U1–U3) | e2e: focus trap, Escape, scroll-lock on habit modal | VoiceOver spot-check |
| Performance (P1) | Perf spec: 12×2yr <150 ms hard gate | Stats tab feels instant on the large seed |
| New stats (N*) | Unit fixtures per stat | Screenshot review per PR |

---

*Produced on branch `stats-audit` and merged to `develop` in PR #5, released in
1.1.0. Kept as the record of what was wrong, what was decided, and why.*

---

## 13. Implementation record

Completed 2026-07-31 on `stats-audit`. Every phase in §11 was carried out. This
section records what actually changed, what the numbers became, and where the
audit above was wrong.

### 13.1 What the code looks like now

Five new modules carry everything the surfaces used to each implement:

| Module | Responsibility |
|---|---|
| `src/features/habits/helpers/habitCalculations.js` | Every habit calculation, option-driven. The four semantic decisions live here and nowhere else. |
| `src/features/fitness/helpers/recordMetrics.js` | Every reading of a recorded session: durations, volume, reps, one-rep-max estimates, performed-date, windows. |
| `src/features/stats/habitPageStats.js` | The whole-collection habit view for the Stats page. |
| `src/features/stats/fitnessStats.js` | The whole-library fitness view, including programme adherence. |
| `src/features/stats/statsUi.js` + `completionCarousel.js` | One card, section, comparison row, heatmap, bar chart and carousel, shared by the page and both modals. |

`habitStats.js` and `activityStats.js` remain as the per-modal view models but
now only *ask questions*; they hold no arithmetic of their own. The three
divergent calculator suites (X1) and the two carousel copies (X2) are gone.

### 13.2 Findings and their resolutions

All of **C1–C9**, **H1–H14**, **X1–X4**, **U1–U5**, **P1–P2**, **M1–M2** are
resolved. Notes where the resolution differed from the proposal:

- **H6 / D3** — implemented with an additive `pausedAt` (client, Convex schema,
  persistence router, and a reducer that stamps it on the false→true edge and
  clears it on resume). A habit paused before the field existed has no stamp, so
  its whole history stays visible and only the live pause flag hides it from
  today. `isHabitScheduledOnDate` gained an `{ ignorePause }` option that only
  statistics pass, so everyday surfaces are untouched.
- **H13** — the audit blamed `getISOWeekNumber`, which is in fact correct. The
  real defect was `getPeriodKey` pairing the correct week number with the
  *calendar* year, so the week spanning New Year split into two keys. Fixed with
  a new `getISOWeekYear` helper. Noted in §13.4.
- **H11 / D7** — the 366-day cap is gone; longest streaks are all-time, which
  the performance work made free.
- **C7 / C9** — the duplicated overview tile is gone, all-time session count is
  shown, and the empty state is now decided *before* any section renders.
- **U2** — see §13.4: the injection this fixed was not only in the statistics
  modal.

### 13.3 Measurements

Stats view-model build, dev build, this machine, median of repeated runs:

| Account | Before | After |
|---|---|---|
| 12 daily habits × 1 year | ~470–770 ms | — |
| 12 daily habits × 2 years | froze the renderer | **28 ms** |
| 20 daily habits × 5 years | not measurable | **68 ms** |

Two indexes did most of it: the derived habit start date and the skipped-day
lookup, both keyed on habit object identity in a `WeakMap`, which immutable
state updates invalidate for free. The current-streak walk also stops at the
first miss instead of materialising the whole history first.
`tests/unit/statsPerformance.test.js` holds a 400 ms gate and separately asserts
that cost stays linear in history length.

### 13.4 Two things the audit got wrong

1. **The >30 s freeze was partly an artefact.** The original measurement used
   `requestAnimationFrame` to time a render while the browser pane was hidden,
   and rAF does not fire in a hidden pane, so the tool call timed out for a
   reason unrelated to the app. The underlying quadratic cost was real and is
   measured above; the "30 seconds" figure was not a fair reading.
2. **The injection (U2) was worse than reported.** The audit found unescaped
   interpolation in the habit statistics modal. Writing the end-to-end test for
   it showed a habit named `<img src=x onerror=…>` executes from the **Habits
   list** and the **Home list** before any statistics screen is opened —
   `HabitsListModule.js` and `HomeHabitsList.js` interpolated names, icons,
   category names and scheduled times raw. All three surfaces now escape.

### 13.5 Coverage added

- `tests/unit/habitCalculations.test.js` — 26 cases pinning the semantics.
- `tests/unit/statsCharacterisation.test.js` — the before/after suite; its
  `BUG(...)` assertions are now `FIXED(...)`.
- `tests/unit/lazyModalFailure.test.js` — the three distinct causes of a screen
  failing to open.
- `tests/unit/statsPerformance.test.js` — the budget and the growth check.
- `tests/unit/habitPauseStamp.test.js` — the pause stamp's lifecycle.
- `tests/e2e/stats-surfaces.spec.js` — the page's sections, the habit modal's
  dialog behaviour and focus, the injection test, and the activity modal opening
  through the real lazy-load chain.

Suite at close: 273 unit tests, 157 e2e, lint, Convex typecheck, dead-code,
cycles and bundle budgets all green.

### 13.6 New statistics shipped

N1–N16 are all in, with two placement notes: weekly training **load** and
**programme adherence** landed on the Stats page's fitness half rather than in a
modal, and programme adherence reuses `computeProgramProgress` rather than
reimplementing it. Skip analytics (N7) gained a "most often" line naming the
habit being stood down most, which was not in the original proposal.
