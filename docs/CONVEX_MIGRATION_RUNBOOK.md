# Convex Migration Runbook

## Development connection

1. Create or select a Clerk application and activate its Convex integration.
2. Create or select a Convex project.
3. Run `npx convex dev` from the repository and select the development project.
4. Set `CLERK_JWT_ISSUER_DOMAIN` in the Convex deployment to the Clerk Frontend
   API URL.
5. Create `.env.local` from `.env.example` and set:

   ```text
   VITE_DATA_BACKEND=cloud
   VITE_CONVEX_URL=<development deployment URL>
   VITE_CLERK_PUBLISHABLE_KEY=<Clerk publishable key>
   ```

6. Run `npm test`, `npm run test:convex`, `npm run lint`, and `npm run build:local`.

`npx convex dev` regenerates `convex/_generated` with deployment/schema-specific
types. Commit those generated bindings.

## Production

- Use separate Clerk and Convex production instances.
- Configure the protected `CONVEX_DEPLOY_KEY` GitHub Actions secret.
- Configure `VITE_DATA_BACKEND`, `VITE_CONVEX_URL`, and
  `VITE_CLERK_PUBLISHABLE_KEY` as GitHub environment variables.
- Add the GitHub Pages origin and base-path redirects to Clerk.
- Allow the production Clerk Frontend API origin to serve the on-demand account
  component bundle.
- Deploy Convex before the Pages artifact. The workflow enforces this ordering.
- Record the deployed Convex version, Pages commit, Clerk instance, and release
  owner before cohort rollout.

## Release verification

1. Migrate a representative legacy localStorage-only fixture.
2. Migrate a divergent localStorage/IndexedDB fixture and verify preview output.
3. Interrupt and resume a staged upload.
4. Confirm a checksum mismatch cannot activate.
5. Confirm the old generation remains readable after activation.
6. Open two authenticated devices and verify realtime convergence.
7. Make an offline edit, terminate the PWA, reopen, reconnect, and verify one
   canonical operation.
8. Confirm explicit sign-out handles pending operations and revokes the lease.
9. Export recovery evidence without owner keys, device IDs, auth tokens, or
   Convex IDs.

## Recovery

- Migration records are staged in `activeGeneration + 1`; normal queries can
  only see `userProfiles.activeGeneration`.
- A checksum failure prevents activation.
- `migration.abandon` refuses to delete the active generation.
- Activation retains `previousGeneration`.
- Raw localStorage and legacy IndexedDB sources remain in
  `migrationBackups`; the initial release never deletes legacy browser data.
- Set `VITE_DATA_BACKEND=legacy` only for pre-cutover recovery. For a cloud
  account, prefer a read-only recovery build so cloud and legacy writes cannot
  diverge.
- If the PWA must be rolled back, preserve schema compatibility with the
  already-deployed Convex functions. Do not roll back the backend blindly after
  newer clients have written data.

## Retention

`maintenance.cleanupEligibleRecords` is intentionally unscheduled. Enable
processed-operation, tombstone, and inactive-generation cleanup only after at
least 30 days of production offline-duration evidence. Initial targets are 90
days, 180 days, and at least two prior generations/30 days respectively.
