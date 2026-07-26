import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity } from "./lib/auth";

const DEFAULT_CATEGORIES = [
  { clientId: "cardio", name: "Cardio", color: "#EF4444", icon: "🏃‍♂️" },
  {
    clientId: "strength",
    name: "Strength Training",
    color: "#2563EB",
    icon: "💪",
  },
  { clientId: "stretching", name: "Stretching", color: "#22C55E", icon: "🧘‍♀️" },
  { clientId: "sports", name: "Sports", color: "#F97316", icon: "⚽" },
  { clientId: "other", name: "Other", color: "#EAB308", icon: "🎯" },
];

export const provision = mutation({
  args: { deviceId: v.string(), appFirstOpenDate: v.string() },
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
      migrationStatus: "not_started",
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
    for (let index = 0; index < DEFAULT_CATEGORIES.length; index += 1) {
      await ctx.db.insert("activityCategories", {
        ownerKey,
        generation: 1,
        ...DEFAULT_CATEGORIES[index],
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

export const get = query({
  args: {},
  handler: async (ctx) => {
    const { ownerKey } = await requireIdentity(ctx);
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
      .unique();
  },
});
