import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity } from "./lib/auth";
import { DEFAULT_ACTIVITY_CATEGORIES } from "./lib/defaults";

export const provision = mutation({
  args: { deviceId: v.string(), appFirstOpenDate: v.string() },
  returns: v.object({
    profile: v.any(),
    cacheOwnerKey: v.string(),
    clerkUserId: v.string(),
  }),
  handler: async (ctx, args) => {
    const { ownerKey, identity } = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
      .unique();
    if (existing) {
      return {
        profile: existing,
        cacheOwnerKey: ownerKey,
        clerkUserId: identity.subject,
      };
    }
    const now = Date.now();
    const profileId = await ctx.db.insert("userProfiles", {
      ownerKey,
      activeGeneration: 1,
      dataSchemaVersion: 1,
      appFirstOpenDate: args.appFirstOpenDate,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("userPreferences", {
      ownerKey,
      generation: 1,
      darkMode: false,
      hideCompleted: false,
      hideSkipped: false,
      holidayMode: false,
      homeSectionVisibility: { Completed: true, Skipped: true },
      revision: 1,
      updatedAt: now,
      updatedByDeviceId: args.deviceId,
    });
    for (let index = 0; index < DEFAULT_ACTIVITY_CATEGORIES.length; index += 1) {
      await ctx.db.insert("activityCategories", {
        ownerKey,
        generation: 1,
        ...DEFAULT_ACTIVITY_CATEGORIES[index],
        sortOrder: index,
        isSystemDefault: true,
        revision: 1,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
    }
    return {
      profile: await ctx.db.get(profileId),
      cacheOwnerKey: ownerKey,
      clerkUserId: identity.subject,
    };
  },
});
