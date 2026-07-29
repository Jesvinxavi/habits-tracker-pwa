# Support and Data Requests

## User support

Open a GitHub issue in
[Jesvinxavi/habits-tracker-pwa](https://github.com/Jesvinxavi/habits-tracker-pwa/issues)
for reproducible application problems. Do not include authentication tokens,
private health notes, raw exports, or screenshots containing sensitive data.

Include:

- App version or commit
- Browser and operating system
- Installed-PWA or browser-tab usage
- Whether the device was online
- The visible synchronization state
- Reproduction steps and expected behavior

## Account-data request procedure

Identity, export, correction, or deletion requests must be verified against the
Clerk account before an operator accesses account data.

For deletion:

1. Confirm or resolve pending offline operations.
2. Offer a portable export when requested.
3. Record the active and retained Convex generations.
4. Delete the Clerk identity.
5. Delete all user-owned Convex documents, operation receipts, migration
   batches, backups, and retained generations.
6. Ask the user to sign out on remaining devices so local readable caches are
   purged.
7. Record completion without retaining exported user content.

## Incident reporting

Security issues should not be filed with sensitive exploit details in a public
issue. Use GitHub's private vulnerability-reporting feature when enabled for the
repository.
