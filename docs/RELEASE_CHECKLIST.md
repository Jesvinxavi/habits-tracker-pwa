# Production Release Checklist

## Product and data

- [ ] Release notes and changelog match the shipped behavior.
- [ ] Privacy notice and store disclosures match actual data processing.
- [ ] Support, export, deletion, and recovery procedures have named owners.
- [ ] Legacy migration fixtures and checksum activation tests pass.
- [ ] Previous generation and raw migration backups remain recoverable.
- [ ] No cleanup or retention job is enabled without production evidence.

## Clerk

- [ ] Production instance is separate from development.
- [ ] Production publishable key is configured as a public build variable.
- [ ] Convex integration and JWT template are active.
- [ ] Authorized origins and redirect URLs include the production Pages URL and
      base path.
- [ ] Account-management and sign-out flows pass on browser and installed PWA.
- [ ] Development-key warning is absent from the production build.

## Convex

- [ ] Production deployment is separate from development.
- [ ] `CLERK_JWT_ISSUER_DOMAIN` matches the production Clerk Frontend API URL.
- [ ] `CONVEX_DEPLOY_KEY` is stored only in protected GitHub secrets.
- [ ] Schema and functions deploy before the PWA artifact.
- [ ] Ownership isolation, active-generation filtering, and indexed queries are
      verified.
- [ ] Every public function has an explicit return validator.
- [ ] Large cascade operations are bounded or have passed the large-history
      transaction-limit test.
- [ ] Reactive queries contain no nondeterministic clock reads.
- [ ] Reset, rollback, migration abandon, and account-deletion drills pass.

## PWA and browser

- [ ] Production build and manifest load from the configured base path.
- [ ] Service worker does not runtime-cache Clerk or Convex API traffic.
- [ ] Installed app opens its confirmed cache offline under a valid lease.
- [ ] First-time and expired-lease offline states explain that connection is
      required.
- [ ] Update prompt handles pending offline operations safely.
- [ ] Home, Habits, Fitness, Statistics, and Profile pass mobile smoke tests.
- [ ] Startup loader never exposes the unhydrated template.

## Quality gates

```bash
npm ci
npm run lint
npm run test:unit
npm run test:migration
npm run test:convex
npm run build
npm run test:e2e
```

- [ ] No secret, `.env.local`, `node_modules`, build output, browser artifact, or
      `.DS_Store` file is tracked.
- [ ] Dependency audit is reviewed and accepted or remediated.
- [ ] Every open item in `RELEASE_RISK_REGISTER.md` is closed or has a named,
      time-bounded acceptance.
- [ ] Production smoke test passes after deployment.
- [ ] Rollback owner and decision threshold are recorded.

## Rollout

- [ ] Development and test accounts
- [ ] Internal production accounts
- [ ] Limited cohort
- [ ] General availability
- [ ] Minimum 30-day retention observation before legacy cleanup

## Rollback

1. Stop further rollout.
2. Disable destructive maintenance.
3. Preserve cloud generations, outboxes, and migration backups.
4. Roll the PWA back to the last verified artifact.
5. Roll Convex functions back only when schema compatibility is confirmed.
6. Use retained `previousGeneration` for account-data recovery.
7. Document affected accounts and the reconciliation plan without logging
   sensitive payloads.
