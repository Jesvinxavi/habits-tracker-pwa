# Brief: separate the Convex and Clerk environments, and make schema deploys automatic

Status: **Convex done 2026-08-01. Clerk split out and still open.**
Written 2026-08-01, after 1.1.0 shipped; closed out the same day.

This is a work brief for whoever picks the task up — human or agent. It states
the situation as it actually is, what has to change, and how to prove each step
worked. It is deliberately explicit about the things only the account owner can
do, because roughly half of this cannot be done by an agent at all.

## What happened

The Convex half was completed as written. The deployed app now reads the
production deployment `hushed-elephant-959`, which has its own database, its own
`CLERK_JWT_ISSUER_DOMAIN`, and the full function and schema set. The workflow
deploys the schema on every publish and now **fails** rather than skipping when
`CONVEX_DEPLOY_KEY` is absent, which is the specific failure mode that nearly
shipped the 1.1.0 `pausedAt` field without its schema change.

The Clerk half could not be done, and it is not a matter of effort. A Clerk
production instance requires a domain the account owner controls and can add DNS
records to. The app is served from `jesvinxavi.github.io`, whose DNS zone belongs
to GitHub, so no `pk_live_…` key can be issued for it. Parts A.2–A.4 below are
therefore superseded by
[`CLERK_PRODUCTION_INSTANCE_BRIEF.md`](./CLERK_PRODUCTION_INSTANCE_BRIEF.md),
which restates them with the domain prerequisite made explicit.

The consequence is that the production Convex deployment authenticates against
the **development** Clerk instance. That is a deliberate, documented compromise
and not the state section 1 describes: the databases are genuinely separate, the
user pool is not. Because the issuer domain is unchanged, `ownerKey` values are
identical across both deployments, which is what allowed the existing profile to
be copied from dev into production by snapshot import.

---

## 1. The situation as it stood, before this work

Everything in this section describes the state on the morning of 2026-08-01.
See "What happened" above for what is true now.

The deployed app at <https://jesvinxavi.github.io/habits-tracker-pwa/> ran
against the **development** backend:

| Setting | Where it lives | Current value |
|---|---|---|
| `VITE_CONVEX_URL` | GitHub repository *variable* | `https://hallowed-mandrill-729.convex.cloud` (the **dev** deployment) |
| `VITE_CLERK_PUBLISHABLE_KEY` | GitHub repository *variable* | a `pk_test_…` key (a **development** Clerk instance) |
| `CONVEX_DEPLOY_KEY` | GitHub secret | **not set** |

Three consequences follow, and all three are live right now:

1. **Production and development share one database.** Anything written from a
   local `npm run dev` session appears in the deployed app, and vice versa.
   There is no separation between experimenting and real data.
2. **Clerk is in development mode.** The sign-in card shows a "Development mode"
   badge, and Clerk applies strict usage limits to development instances. Those
   limits are low enough to matter with more than a handful of users.
3. **Schema changes do not reach the backend on deploy.** The workflow has a
   "Deploy Convex functions" step, but it is conditioned on `CONVEX_DEPLOY_KEY`
   being non-empty, so it is skipped on every run. Schema must currently be
   pushed by hand.

Point 3 has already bitten once. Release 1.1.0 added an optional `pausedAt`
field to the `habits` table. Convex validates documents strictly by default, so
a client sending a field the deployment does not declare has its write
*rejected* — pausing a habit would have failed to sync. It was caught before
release and pushed manually with `npx convex dev --once`. The next such change
will not necessarily be caught.

### Why `npx convex deploy` was the wrong command here

**No longer true as of 2026-08-01 — kept for the reasoning.**

`npx convex deploy` targets the project's **production** Convex deployment.
While the app was pointed at the **dev** deployment, `convex deploy` would push
the schema somewhere the app did not read from, and the problem would have
looked fixed while remaining broken. The correct manual command was then:

```bash
npx convex dev --once
```

Now that `VITE_CONVEX_URL` points at production, `npx convex deploy` is correct
and CI runs it automatically. `npx convex dev --once` still targets the dev
deployment, which is what local development wants.

---

## 2. What has to change

The work splits into three parts. Parts A and C need account access and cannot
be delegated to an agent; part B can be.

### Part A — create the production instances *(account owner only)*

1. **Convex production deployment.** In the Convex dashboard for the
   `healthy-habits-tracker` project, create or identify the production
   deployment and note its `https://<name>.convex.cloud` URL.
2. **Clerk production instance.** In the Clerk dashboard, create a production
   instance for this application. Note its `pk_live_…` publishable key and its
   Frontend API URL.
3. **Wire Clerk to Convex.** In the production Clerk instance, add the JWT
   template Convex expects, and set `CLERK_JWT_ISSUER_DOMAIN` on the production
   Convex deployment to the production Clerk Frontend API URL. The development
   pair is already configured this way and can be copied.
4. **Authorised origins.** Add `https://jesvinxavi.github.io` — and the
   `/habits-tracker-pwa/` base path where Clerk asks for full URLs — to the
   production Clerk instance's allowed origins and redirect URLs. Sign-in fails
   silently without this.
5. **Deploy key.** Generate a Convex *production* deploy key and add it to the
   repository as the secret `CONVEX_DEPLOY_KEY`. It is a credential: it belongs
   in GitHub secrets and nowhere else, and it must not be pasted into chat, a
   file, or a commit.

### Part B — point the build at them *(delegable)*

Once part A is done and the values are available:

1. Update the two repository variables:

   ```bash
   gh variable set VITE_CONVEX_URL --body "https://<production>.convex.cloud"
   gh variable set VITE_CLERK_PUBLISHABLE_KEY --body "pk_live_…"
   ```

   These two are *public* values — they are compiled into the browser bundle by
   design — so they are variables, not secrets. `CONVEX_DEPLOY_KEY` is the
   opposite and must stay a secret.

2. Confirm `.env.local` still points at the **development** deployment, so local
   work does not touch production data. It should keep
   `CONVEX_DEPLOYMENT=dev:…` and the `pk_test_…` key.

3. Push to `main` (or run the deploy workflow manually — that now works, see
   §4) and confirm the "Deploy Convex functions" step runs instead of being
   skipped.

### Part C — verify the separation holds *(mixed)*

1. Sign in to the deployed app with a fresh account and create one habit.
2. Confirm it does **not** appear in a local `npm run dev` session, and that a
   habit created locally does not appear in the deployed app.
3. Confirm the "Development mode" badge is gone from the deployed sign-in card.
4. Pause a habit in the deployed app and confirm it syncs — this is the specific
   case the missing `pausedAt` field would have broken, and it exercises the
   schema-deploy path end to end.
5. Work through `docs/release/RELEASE_CHECKLIST.md`, which contains the fuller
   list this brief is a subset of.

---

## 3. Acceptance criteria

- [x] `gh variable list` shows a production Convex URL
      (`https://hushed-elephant-959.convex.cloud`).
- [ ] `gh variable list` shows a `pk_live_…` key. **Blocked** — needs a domain;
      see the Clerk brief.
- [x] `gh secret list` shows `CONVEX_DEPLOY_KEY`.
- [x] A deploy run shows "Deploy Convex functions" as **success**, not skipped.
      Run `30704683707`, 2026-08-01: every step green, and the published bundle
      resolves to `hushed-elephant-959.convex.cloud`.
- [ ] The deployed sign-in card shows no "Development mode" badge. **Blocked** —
      same reason.
- [ ] A habit created in the deployed app is absent from the local dev database.
- [ ] Pausing a habit in the deployed app syncs without error.
- [ ] `docs/release/RELEASE_RISK_REGISTER.md` has its "Production identity" gate
      marked closed. Recorded as *partly* closed; it stays open on Clerk.

## 4. Notes for whoever does this

- **The manual deploy button works now.** It used to gate every publishing step
  on `github.event_name == 'push'`, so a `workflow_dispatch` run linted, tested,
  built, reported success and published nothing. Fixed in `ebd8e435`. Trigger a
  deploy with `gh workflow run "Deploy to GitHub Pages" --ref main`.
- **Adding a Convex field is a two-sided change.** Client and schema must move
  together, and the schema should land first. Until `CONVEX_DEPLOY_KEY` is set,
  that means running the push by hand *before* merging the client change.
- **This brief does not close the other release gates.**
  `docs/release/RELEASE_RISK_REGISTER.md` also lists missing Convex return
  validators, unbounded cascade mutations, a nondeterministic clock read in a
  reactive query, and operator-assisted account deletion. Those are separate
  work and are not in scope here.
- **Do not reuse the development instances for production**, even temporarily.
  That is the state this brief exists to undo, and it was only ever a deliberate
  short-term trade to get a working deployment.
