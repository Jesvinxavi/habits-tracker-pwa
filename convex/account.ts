import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity, requireProfile } from "./lib/auth";
import { DEFAULT_ACTIVITY_CATEGORIES } from "./lib/defaults";

export const reset = mutation({
  args: {
    deviceId: v.string(),
    confirmation: v.literal("RESET"),
    appFirstOpenDate: v.string(),
  },
  returns: v.object({
    activeGeneration: v.number(),
    previousGeneration: v.number(),
  }),
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    const targetGeneration = profile.activeGeneration + 1;
    const now = Date.now();
    await ctx.db.insert("userPreferences", {
      ownerKey,
      generation: targetGeneration,
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
        generation: targetGeneration,
        ...DEFAULT_ACTIVITY_CATEGORIES[index],
        sortOrder: index,
        isSystemDefault: true,
        revision: 1,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
    }
    await ctx.db.patch(profile._id, {
      previousGeneration: profile.activeGeneration,
      activeGeneration: targetGeneration,
      appFirstOpenDate: args.appFirstOpenDate,
      updatedAt: now,
    });
    return { activeGeneration: targetGeneration, previousGeneration: profile.activeGeneration };
  },
});
