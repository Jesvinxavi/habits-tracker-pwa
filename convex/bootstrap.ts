import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity, requireProfile } from "./lib/auth";

// These are explicit per-account definition limits, not pagination defaults.
// History is loaded separately. If an account exceeds a limit we fail loudly
// rather than returning an incomplete core snapshot.
const CORE_LIMITS = {
  habitCategories: 200,
  habits: 1_500,
  holidayPeriods: 500,
  holidaySingles: 2_000,
  activityCategories: 200,
  activities: 1_500,
  routines: 500,
  programs: 500,
} as const;

export const getCore = query({
  args: {},
  returns: v.object({
    profile: v.any(),
    preferences: v.union(v.any(), v.null()),
    habitCategories: v.array(v.any()),
    habits: v.array(v.any()),
    holidayPeriods: v.array(v.any()),
    holidaySingles: v.array(v.any()),
    activityCategories: v.array(v.any()),
    activities: v.array(v.any()),
    routines: v.array(v.any()),
    programs: v.array(v.any()),
    collectionRevisions: v.record(v.string(), v.number()),
    generation: v.number(),
    schemaVersion: v.number(),
  }),
  handler: async (ctx) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    const generation = profile.activeGeneration;
    const collectBounded = async (table: keyof typeof CORE_LIMITS): Promise<any[]> => {
      const limit = CORE_LIMITS[table];
      const rows = await ctx.db
        .query(table)
        .withIndex("by_owner_generation", (q: any) =>
          q.eq("ownerKey", ownerKey).eq("generation", generation),
        )
        .take(limit + 1);
      if (rows.length > limit) {
        throw new Error(`ACCOUNT_DEFINITION_LIMIT_EXCEEDED:${table}:${limit}`);
      }
      return rows;
    };
    const [
      preferences,
      habitCategories,
      habits,
      holidayPeriods,
      holidaySingles,
      activityCategories,
      activities,
      routines,
      programs,
      collectionRevisionRows,
    ] = await Promise.all([
      ctx.db
        .query("userPreferences")
        .withIndex("by_owner_generation", (q) =>
          q.eq("ownerKey", ownerKey).eq("generation", generation),
        )
        .unique(),
      collectBounded("habitCategories"),
      collectBounded("habits"),
      collectBounded("holidayPeriods"),
      collectBounded("holidaySingles"),
      collectBounded("activityCategories"),
      collectBounded("activities"),
      // Routines and programs are small, always-needed definition data, so they
      // belong in getCore rather than the paginated history window.
      collectBounded("routines"),
      collectBounded("programs"),
      ctx.db
        .query("collectionRevisions")
        .withIndex("by_owner_generation_collection", (q) =>
          q.eq("ownerKey", ownerKey).eq("generation", generation),
        )
        .take(2),
    ]);
    const collectionRevisions = Object.fromEntries(
      collectionRevisionRows.map((row) => [row.collection, row.revision]),
    );
    return {
      profile,
      preferences,
      habitCategories,
      habits,
      holidayPeriods,
      holidaySingles,
      activityCategories,
      activities,
      routines,
      programs,
      collectionRevisions,
      generation,
      schemaVersion: profile.dataSchemaVersion,
    };
  },
});
