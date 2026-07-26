import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireIdentity, requireProfile } from "./lib/auth";

const ENTITY_TABLES = [
  "userPreferences",
  "habitCategories",
  "habits",
  "habitEntries",
  "holidayPeriods",
  "holidaySingles",
  "activityCategories",
  "activities",
  "activityRecords",
  "routines",
  "programs",
  "restDays",
] as const;

// Call once per entity type. Convex's opaque pagination cursor provides stable
// continuation; sinceUpdatedAt is only the lower bound, never the cursor.
export const listChangedEntities = query({
  args: {
    entityType: v.union(...ENTITY_TABLES.map((table) => v.literal(table))),
    sinceUpdatedAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    const result = await ctx.db
      .query(args.entityType)
      .withIndex("by_owner_generation_updatedAt", (q: any) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .gt("updatedAt", args.sinceUpdatedAt),
      )
      .paginate(args.paginationOpts);
    return {
      generation: profile.activeGeneration,
      entityType: args.entityType,
      ...result,
    };
  },
});
