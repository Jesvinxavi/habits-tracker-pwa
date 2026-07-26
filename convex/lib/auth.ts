import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("UNAUTHENTICATED");
  return { identity, ownerKey: identity.tokenIdentifier };
}

export async function requireProfile(ctx: QueryCtx | MutationCtx, ownerKey: string) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_owner", (query) => query.eq("ownerKey", ownerKey))
    .unique();
  if (!profile) throw new Error("PROFILE_NOT_PROVISIONED");
  return profile;
}
