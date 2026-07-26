import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireIdentity, requireProfile } from "./lib/auth";

export const listActivityRecordsByDateRange = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
    paginationOpts: paginationOptsValidator,
  },
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

export const listActivityRecordsByActivity = query({
  args: { activityClientId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    return await ctx.db
      .query("activityRecords")
      .withIndex("by_owner_generation_activity", (q) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .eq("activityClientId", args.activityClientId),
      )
      .paginate(args.paginationOpts);
  },
});

export const listRestDaysByDateRange = query({
  args: { fromDate: v.string(), toDate: v.string() },
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    return await ctx.db
      .query("restDays")
      .withIndex("by_owner_generation_date", (q) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .gte("dateKey", args.fromDate)
          .lte("dateKey", args.toDate),
      )
      .collect();
  },
});
