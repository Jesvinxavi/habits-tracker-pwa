# Brief: move Clerk to a production instance

Status: **not scheduled — accepted as-is on 2026-08-01.** Blocked on a custom
domain, and Jesvin decided not to pursue one for now. Written 2026-08-01, split
out of `CONVEX_ENVIRONMENT_SEPARATION_BRIEF.md` when the domain requirement
surfaced.

This is a standing brief, not open work. Nobody should pick it up unprompted.
The trigger to revisit it is **user growth**: Clerk's development-instance
limits are the binding constraint, so if this app moves beyond a small circle of
users, this becomes necessary rather than optional. The other trigger is a
domain being acquired for unrelated reasons, which makes the whole thing cheap.

Do it sooner rather than later if you do it at all — see the note at the end
about orphaned data. The migration cost grows with every day of real use.

## Why this is separate

The Convex half of the environment separation is done: the deployed app has its
own production database and the schema deploys automatically. Clerk could not
follow, because a Clerk **production instance requires a domain you own and can
add DNS records to**. Clerk's deployment documentation is explicit that free
hosting subdomains do not work, and `jesvinxavi.github.io` is one — the DNS zone
belongs to GitHub.

So until a domain exists, the deployed app keeps using the **development** Clerk
instance (`stirring-haddock-8.clerk.accounts.dev`, a `pk_test_…` key). What that
costs, concretely:

- The sign-in card shows a "Development mode" badge.
- Clerk applies development-instance usage limits, which are low enough to
  matter beyond a handful of users.
- Sessions are not isolated between local and deployed use. The two share one
  Clerk user pool, so the same account signs in to both — but they now read and
  write **different databases**, which is the separation that mattered most.

## Prerequisite

Buy a domain and be able to edit its DNS records. Point the site at it: GitHub
Pages serves a custom domain via a `CNAME` file in the published artefact plus
an `ALIAS`/`A` record at the apex, or a `CNAME` record on a subdomain. Doing
this changes the app's base path — `vite.config.js` currently derives the base
from `REPO_NAME`, and a custom apex domain serves from `/` rather than
`/habits-tracker-pwa/`. Check that before assuming the switch is DNS-only.

## Steps once the domain exists *(account owner only)*

1. **Create the Clerk production instance** for this application in the Clerk
   dashboard. Note its `pk_live_…` publishable key and its Frontend API URL.
2. **Add the DNS records** Clerk shows on its Domains page. Allow up to 48 hours
   for propagation, and make sure the CAA records permit Clerk's certificate
   issuance.
3. **Add the JWT template** Convex expects (`applicationID: "convex"`, matching
   `convex/auth.config.ts`). The development instance is already configured this
   way and can be copied.
4. **Repoint the production Convex deployment's issuer** at the new instance:

   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<production-frontend-api> --prod
   ```

   Leave the development deployment pointing at the development Clerk instance.
5. **Authorised origins.** Add the production site URL to the production Clerk
   instance's allowed origins and redirect URLs. Sign-in fails silently without
   this.
6. **Repoint the build:**

   ```bash
   gh variable set VITE_CLERK_PUBLISHABLE_KEY --body "pk_live_…"
   ```

   This is a public value, compiled into the browser bundle by design, so it is
   a repository variable and not a secret.

## Verification

- [ ] The deployed sign-in card shows no "Development mode" badge.
- [ ] A fresh account can sign up, sign in, and sign out on the deployed site.
- [ ] That account's habits appear in the **production** Convex deployment
      (`hushed-elephant-959`) and not in the development one.
- [ ] Local `npm run dev` still signs in against the development Clerk instance.
- [ ] `docs/release/RELEASE_RISK_REGISTER.md` has its "Production identity" gate
      marked closed, with the date and who verified it.

## Note

Existing users live in the development Clerk instance's user pool. A production
instance starts empty — Clerk does not migrate users between instances as part
of the switch. Everyone signs up again, and because `ownerKey` embeds the issuer
domain, their existing Convex data will not be reachable from the new identity.
Decide deliberately whether to do this before or after the app has users worth
keeping.
