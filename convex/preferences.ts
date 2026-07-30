import { mutation } from "./_generated/server";
import { operationEnvelope, operationResult } from "./lib/envelopes";
import { requireIdentity, requireProfile } from "./lib/auth";
import { findProcessed, recordProcessed } from "./lib/idempotency";
import { conflictResult } from "./lib/revisions";

const ALLOWED = new Set([
  "darkMode",
  "hideCompleted",
  "hideSkipped",
  "holidayMode",
  "homeSectionVisibility",
]);

export const patch = mutation({
  args: operationEnvelope,
  returns: operationResult,
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const processed = await findProcessed(ctx, ownerKey, args.operationId);
    if (processed) return { ...processed.result, status: "duplicate" };
    const profile = await requireProfile(ctx, ownerKey);
    const current = await ctx.db
      .query("userPreferences")
      .withIndex("by_owner_generation", (q) =>
        q.eq("ownerKey", ownerKey).eq("generation", profile.activeGeneration),
      )
      .unique();
    if (!current || args.baseRevision !== current.revision) {
      return conflictResult(
        "userPreferences",
        "preferences",
        args.baseRecord,
        current,
        args.payload,
        Object.keys(args.payload),
      );
    }
    const patchValue = Object.fromEntries(
      Object.entries(args.payload).filter(([key]) => ALLOWED.has(key)),
    );
    const revision = current.revision + 1;
    await ctx.db.patch(current._id, {
      ...patchValue,
      revision,
      updatedAt: Date.now(),
      updatedByDeviceId: args.deviceId,
    });
    const canonicalRecord = await ctx.db.get(current._id);
    const result = { status: "applied", canonicalRecord, revision };
    await recordProcessed(
      ctx,
      ownerKey,
      args.operationId,
      args.deviceId,
      "preferences.patch",
      result,
    );
    return result;
  },
});
