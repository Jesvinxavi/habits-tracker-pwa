import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireIdentity, requireProfile } from "./lib/auth";
import { paginatedAnyResult } from "./lib/envelopes";

export const listActivityRecordsByDateRange = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginatedAnyResult,
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    return await ctx.db
      .query("activityRecords")
      .withIndex("by_owner_generation_date", (q) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .gte("dateKey", args.fromDate)
          .lte("dateKey", args.toDate),
      )
      .paginate(args.paginationOpts);
  },
});

export const listRestDaysByDateRange = query({
  args: { fromDate: v.string(), toDate: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (args.fromDate > args.toDate) throw new Error("INVALID_DATE_RANGE");
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    const limit = 5_000;
    const rows = await ctx.db
      .query("restDays")
      .withIndex("by_owner_generation_date", (q) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .gte("dateKey", args.fromDate)
          .lte("dateKey", args.toDate),
      )
      .take(limit + 1);
    if (rows.length > limit) {
      throw new Error(`ACCOUNT_HISTORY_WINDOW_LIMIT_EXCEEDED:restDays:${limit}`);
    }
    return rows;
  },
});
