# Healthy Habits Tracker 1.0.0 Release

Release date: 26 July 2026

## App-store-style metadata

**Name:** Healthy Habits Tracker

**Subtitle:** Habits, fitness, and progress

**Category:** Health & Fitness / Productivity

**Short description:** Build routines, record fitness activity, and keep your
progress synchronized across devices—even when you temporarily lose your
connection.

**Keywords:** habits, routine, goals, fitness, workout, tracker, progress,
offline, calendar, productivity

## What's New

Healthy Habits Tracker now supports secure accounts, realtime cloud
synchronization, durable offline changes, and migration of existing browser
data. This release also adds a Profile tab, repairs calendar navigation and
holiday persistence, restores the intended interface styling and animations,
and reduces returning-user startup time by approximately 73% in the audited
environment.

## Full release notes

- Sign in with Clerk and synchronize account data through Convex.
- Continue using a previously authenticated device offline for up to 30 days.
- Create habits, categories, activities, records, holidays, and rest days with
  durable offline writes.
- Receive realtime updates on additional devices.
- Review and resolve conflicting edits.
- Preview, back up, normalize, verify, and atomically activate legacy data.
- Manage account and synchronization controls from the Profile tab.
- Use corrected one-tap Fitness calendar navigation and Today behavior.
- Launch without redundant account-checking or empty-template screens.

## Review notes

- Authentication requires a configured production Clerk instance and Convex
  JWT integration.
- Returning devices use a confirmed cache while cloud reconciliation continues
  in the background.
- First-time offline access is intentionally unavailable.
- Timers and laps are session-only by design.
- Statistics are derived from source records.
- The current account-deletion flow is operator-assisted and documented in
  `SUPPORT.md`.

## Privacy disclosure summary

Data linked to the user:

- Contact information: email address
- User content: habits, schedules, workout records, notes, preferences
- Identifiers: account ID and device-local synchronization identifier
- Usage-related technical data: operation revisions and synchronization
  timestamps

Data is used for app functionality and account synchronization. The application
does not include advertising or cross-app tracking.
