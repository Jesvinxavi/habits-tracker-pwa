# Privacy Notice

Effective date: 26 July 2026

Healthy Habits Tracker stores the information needed to provide account-based
habit and fitness tracking. This notice describes the application behavior in
the current release; it is not a substitute for jurisdiction-specific legal
review before commercial distribution.

## Data processed

The application may process:

- Account identifiers and profile information provided by Clerk, such as user
  ID, display name, email address, and profile image
- Habit categories, habit definitions, schedules, targets, ordering, completion
  history, progress, and skips
- Holiday periods and individual holiday dates
- Fitness categories, activities, recorded workouts, notes, sets/reps, and rest
  days
- Synchronized display preferences
- Migration backups and unknown fields from explicitly detected legacy data
- Technical synchronization metadata such as revisions, operation IDs, device
  IDs, timestamps, and dataset generations

The application does not require advertising identifiers, location, contacts,
photos, health-platform data, or payment information.

## Purpose

Data is used to:

- Authenticate the account
- Store and synchronize the user's tracker data
- Support offline changes and multi-device reconciliation
- Migrate and recover legacy browser data
- Detect duplicate operations and resolve synchronization conflicts

The application does not sell account data and does not include advertising or
cross-app tracking.

## Service providers

- **Clerk** provides authentication and account-management services.
- **Convex** stores and synchronizes account data.
- **GitHub Pages** may host the application shell.

Those providers process data according to their own terms and privacy notices.

## Data stored on the device

IndexedDB stores a per-account confirmed cache, pending offline operations,
migration backups, a device identifier, synchronization metadata, and an
offline authorization lease. The PWA service worker stores application-shell
assets.

A previously authenticated device can access its confirmed account cache and
create offline changes for up to 30 days after the last successful online
authentication. Explicit sign-out revokes this lease.

## Sign-out and deletion

When signing out, pending offline changes must be synchronized or explicitly
discarded. The application then removes that account's readable cache and
outbox from the browser.

Account deletion is an operational support procedure in this release and is not
yet exposed as a self-service button. Requests should follow
[SUPPORT.md](SUPPORT.md). Operators must delete the Clerk identity, active and
inactive Convex generations, processed operations, migration records, and any
retained backups associated with the authenticated account.

## Retention

- Active account data is retained while the account exists.
- Processed operation records are targeted for 90-day retention.
- Tombstones are targeted for 180-day retention.
- At least two prior generations and 30 days of recovery history are retained
  before cleanup.
- Automated cleanup remains disabled until offline-duration and rollback
  assumptions have been validated in production.

## Security

Backend ownership is derived from the authenticated token rather than accepted
from browser input. Mutations validate payloads, revisions, parent records, and
active generations. Migration activation requires matching counts and
checksums.

No internet service can guarantee absolute security. Do not store highly
sensitive medical diagnoses or emergency information in free-text fields.

## Children

The application is not intentionally designed for children under the minimum
digital-consent age applicable in their jurisdiction. A commercial release
should configure age and consent requirements in Clerk and obtain legal review.

## Changes

Material privacy changes must update this notice, the
[changelog](../release/CHANGELOG.md), and the release metadata before
deployment.
