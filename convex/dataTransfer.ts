import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireIdentity, requireProfile } from "./lib/auth";
import { portableMigrationRecord } from "./lib/checksum";

const TABLES = [
  "userPreferences",
  "habitCategories",
  "habits",
  "habitEntries",
  "holidayPeriods",
  "holidaySingles",
  "activityCategories",
  "activities",
  "activityRecords",
  "restDays",
  "legacyData",
] as const;

export const getExportPage = query({
  args: {
    generation: v.number(),
    table: v.union(...TABLES.map((table) => v.literal(table))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    if (profile.activeGeneration !== args.generation) {
      throw new Error("EXPORT_GENERATION_CHANGED");
    }
    const page = await ctx.db
      .query(args.table)
      .withIndex("by_owner_generation", (q: any) =>
        q.eq("ownerKey", ownerKey).eq("generation", args.generation),
      )
      .paginate(args.paginationOpts);
    return {
      generation: args.generation,
      table: args.table,
      ...page,
      page: page.page.map(portableMigrationRecord),
    };
  },
});
