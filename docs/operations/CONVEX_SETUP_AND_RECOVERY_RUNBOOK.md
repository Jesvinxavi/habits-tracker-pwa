# Convex Setup and Recovery Runbook

Clerk plus Convex is the only persistence path. The legacy browser-local
backend, its side keys, and the whole localStorage/IndexedDB migration pipeline
were removed on `codex/whole-app-optimisation`. This runbook describes the
backend that exists now.

The retired migration procedure is preserved as a historical record in
[the persistence audit](../architecture/PERSISTENCE_AUDIT.md) and the
[whole-app optimisation audit](../architecture/WHOLE_APP_OPTIMISATION_AUDIT_AND_PLAN.md).
Do not follow it as an active procedure: the functions, tables, and client
modules it names no longer exist.

## Development connection

1. Create or select a Clerk application and activate its Convex integration.
2. Create or select a Convex project.
3. Run `npx convex dev` from the repository and select the development project.
4. Set `CLERK_JWT_ISSUER_DOMAIN` in the Convex deployment to the Clerk Frontend
   API URL.
5. Create `.env.local` from `.env.example` and set:

   ```text
   VITE_CONVEX_URL=<development deployment URL>
   VITE_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
   ```

   No backend-selection variable exists. Do not reintroduce one.

6. Run `npm run audit`, which is the same gate set as pull-request CI.

`npx convex dev` regenerates `convex/_generated` with deployment/schema-specific
types. Commit those generated bindings.

## Production

- Use separate Clerk and Convex production instances.
- Configure the protected `CONVEX_DEPLOY_KEY` GitHub Actions secret.
- Configure `VITE_CONVEX_URL` and `VITE_CLERK_PUBLISHABLE_KEY` as GitHub
  environment variables.
- Add the GitHub Pages origin and base-path redirects to Clerk.
- Allow the production Clerk Frontend API origin to serve the on-demand account
  component bundle.
- Deploy Convex before the Pages artifact. The workflow enforces this ordering.
- Record the deployed Convex version, Pages commit, Clerk instance, and release
  owner before rollout.

## Narrowing the schema on a deployment that already holds data

Convex validates every document in a table the schema declares, and an object
validator rejects both missing required fields and undeclared extra fields.
Removing a field from the schema therefore cannot be a single push while
documents still carry it, and stripping the field from documents first cannot be
a single import while the deployed schema still requires it.

The order that works, on a development deployment only:

1. Export the deployment: `npx convex export --path <backup>.zip`. Record its
   SHA-256 outside the repository.
2. Build a transformed copy of that archive with the retired fields removed.
   Copy every retained value as raw text. A `JSON.parse`/`JSON.stringify` round
   trip rewrites `1.0` as `1`, which turns a float64 into an int64 and the
   import is rejected.
3. Push an intermediate schema in which each retired field is
   `v.optional(v.any())`. Documents that still carry the field and documents
   that no longer do are both valid against it.
4. Import the transformed archive:
   `npx convex import --deployment dev --replace <transformed>.zip`. Never
   `--prod`. Never `--replace-all`, which deletes tables absent from the
   archive.
5. Restore the committed schema and push it. Every document now validates.
6. Export again and diff against the intended transformed archive.

A failed import leaves the deployment unchanged: Convex stages and swaps, so a
validation error part-way through rolls the whole import back. Verify that by
re-exporting rather than assuming it.

Tables that exist in the deployment but are absent from the schema are tolerated
and left untyped; their indexes are dropped on the next push. The CLI has no
drop-table command, so empty retired tables are removed from the dashboard.

## Release verification

1. Sign in on a fresh browser profile and confirm exactly one default activity
   category set is provisioned.
2. Relaunch against the trusted confirmed cache and confirm Home renders before
   any network response.
3. Open two authenticated devices and verify realtime convergence for a recent
   record and for a record older than one history page.
4. Make an offline edit, terminate the PWA, reopen, reconnect, and verify one
   canonical operation.
5. Force a conflicting concurrent edit and confirm the conflict surface appears
   rather than silent loss.
6. Confirm explicit sign-out handles pending operations and revokes the lease.
7. Reset the account and confirm a new generation is created and the previous
   generation is retained.
8. Export recovery evidence without owner keys, device IDs, auth tokens, or
   Convex IDs.

## Recovery

- Generations are the account epoch. A reset moves `activeGeneration` forward
  and retains `previousGeneration`; the old rows stay readable.
- `habitsConvexCache` in the browser holds the only durable copy of pending
  offline work. Never instruct a user to delete it as a troubleshooting step.
- Take an `npx convex export` snapshot before any schema narrowing, destructive
  import, or generation operation, and verify its SHA-256.
- Restore only to the deployment the snapshot came from. Keep a failed
  transformed archive for diagnosis rather than deleting it.
- If the PWA must be rolled back, preserve schema compatibility with the
  already-deployed Convex functions. Do not roll back the backend blindly after
  newer clients have written data.

## Retention

`maintenance.measureProcessedOperationRetention` is an internal query that
reports counts and an age distribution only. No destructive retention job is
registered or scheduled, and none should be until the maximum offline lease and
the idempotency replay window have been measured together against real usage.
Deleting a processed operation ID before its client stops replaying turns a
replayed create into a duplicate entity attempt.
