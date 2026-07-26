import { query } from "./_generated/server";
import { requireIdentity, requireProfile } from "./lib/auth";

export const getCore = query({
  args: {},
  handler: async (ctx) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    const generation = profile.activeGeneration;
    const collect = (table: any) =>
      ctx.db
        .query(table)
        .withIndex("by_owner_generation", (q: any) =>
          q.eq("ownerKey", ownerKey).eq("generation", generation),
        )
        .collect();
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
      legacyData,
      collectionRevisionRows,
    ] = await Promise.all([
      collect("userPreferences"),
      collect("habitCategories"),
      collect("habits"),
      collect("holidayPeriods"),
      collect("holidaySingles"),
      collect("activityCategories"),
      collect("activities"),
      // Routines and programs are small, always-needed definition data, so they
      // belong in getCore rather than the paginated history window.
      collect("routines"),
      collect("programs"),
      collect("legacyData"),
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
      preferences: preferences[0] ?? null,
      habitCategories,
      habits,
      holidayPeriods,
      holidaySingles,
      activityCategories,
      activities,
      routines,
      programs,
      legacyData: legacyData[0] ?? null,
      collectionRevisions,
      generation,
      serverTimestamp: Date.now(),
      schemaVersion: profile.dataSchemaVersion,
    };
  },
});
