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

const historyEntityType = v.union(
  v.literal("habitEntries"),
  v.literal("activityRecords"),
  v.literal("restDays"),
);

export const getHistorySignals = query({
  args: {},
  returns: v.object({
    generation: v.number(),
    signals: v.array(
      v.object({
        entityType: historyEntityType,
        revision: v.number(),
        updatedAt: v.number(),
        updatedByDeviceId: v.string(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    const rows = await ctx.db
      .query("historySyncSignals")
      .withIndex("by_owner_generation_entity", (q) =>
        q.eq("ownerKey", ownerKey).eq("generation", profile.activeGeneration),
      )
      .take(3);
    return {
      generation: profile.activeGeneration,
      signals: rows.map((row) => ({
        entityType: row.entityType,
        revision: row.revision,
        updatedAt: row.updatedAt,
        updatedByDeviceId: row.updatedByDeviceId,
      })),
    };
  },
});

// Call once per entity type. Convex's opaque pagination cursor provides stable
// continuation. The inclusive lower bound deliberately re-reads records that
// share the watermark timestamp, preventing a later equal-timestamp write from
// being skipped. Client-side revision checks make those repeats cheap.
export const listChangedEntities = query({
  args: {
    entityType: v.union(...ENTITY_TABLES.map((table) => v.literal(table))),
    sinceUpdatedAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    generation: v.number(),
    entityType: v.union(...ENTITY_TABLES.map((table) => v.literal(table))),
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null()),
    ),
  }),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    const result = await ctx.db
      .query(args.entityType)
      .withIndex("by_owner_generation_updatedAt", (q: any) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .gte("updatedAt", args.sinceUpdatedAt),
      )
      .paginate(args.paginationOpts);
    return {
      generation: profile.activeGeneration,
      entityType: args.entityType,
      ...result,
    };
  },
});
