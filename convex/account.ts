import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity, requireProfile } from "./lib/auth";

const DEFAULT_CATEGORIES = [
  { clientId: "cardio", name: "Cardio", color: "#EF4444", icon: "🏃‍♂️" },
  { clientId: "strength", name: "Strength Training", color: "#2563EB", icon: "💪" },
  { clientId: "stretching", name: "Stretching", color: "#22C55E", icon: "🧘‍♀️" },
  { clientId: "sports", name: "Sports", color: "#F97316", icon: "⚽" },
  { clientId: "other", name: "Other", color: "#EAB308", icon: "🎯" },
];

export const reset = mutation({
  args: {
    deviceId: v.string(),
    confirmation: v.literal("RESET"),
    appFirstOpenDate: v.string(),
  },
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
    for (let index = 0; index < DEFAULT_CATEGORIES.length; index += 1) {
      await ctx.db.insert("activityCategories", {
        ownerKey,
        generation: targetGeneration,
        ...DEFAULT_CATEGORIES[index],
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
