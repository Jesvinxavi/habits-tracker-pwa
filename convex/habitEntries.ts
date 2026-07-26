import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireIdentity, requireProfile } from "./lib/auth";
import { operationEnvelope } from "./lib/envelopes";
import { findProcessed, recordProcessed } from "./lib/idempotency";
import { requireLiveParent } from "./lib/domain";
import { assertDate, assertNonBlank } from "./lib/validators";
import { changedFields, conflictResult } from "./lib/revisions";

export const setDesiredState = mutation({
  args: operationEnvelope,
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const processed = await findProcessed(ctx, ownerKey, args.operationId);
    if (processed) return { ...processed.result, status: "duplicate" };
    const profile = await requireProfile(ctx, ownerKey);
    const payload = args.payload;
    assertNonBlank(payload.habitClientId, "habitClientId");
    assertNonBlank(payload.periodKey, "periodKey");
    assertDate(payload.periodSortDate, "periodSortDate");
    if (!Number.isFinite(payload.progress) || payload.progress < 0) {
      throw new Error("INVALID_PROGRESS");
    }
    await requireLiveParent(
      ctx,
      "habits",
      ownerKey,
      profile.activeGeneration,
      payload.habitClientId,
    );
    const clientId = `habit-entry:${payload.habitClientId}:${payload.periodKey}`;
    const current = await ctx.db
      .query("habitEntries")
      .withIndex("by_owner_generation_client", (q) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .eq("clientId", clientId),
      )
      .unique();
    if (current && args.baseRevision !== current.revision) {
      return conflictResult(
        "habitEntries",
        clientId,
        args.baseRecord,
        current,
        { ...payload, clientId },
        changedFields(args.baseRecord, payload),
      );
    }
    const now = Date.now();
    const empty = !payload.completed && payload.progress === 0 && !payload.skipped;
    let canonicalRecord = null;
    let revision = current ? current.revision + 1 : 1;
    if (!current && !empty) {
      const id = await ctx.db.insert("habitEntries", {
        ownerKey,
        generation: profile.activeGeneration,
        clientId,
        habitClientId: payload.habitClientId,
        periodKey: payload.periodKey,
        periodSortDate: payload.periodSortDate,
        completed: Boolean(payload.completed),
        progress: payload.progress,
        skipped: Boolean(payload.skipped),
        revision,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
      canonicalRecord = await ctx.db.get(id);
    } else if (current) {
      await ctx.db.patch(current._id, {
        completed: Boolean(payload.completed),
        progress: payload.progress,
        skipped: Boolean(payload.skipped),
        periodSortDate: payload.periodSortDate,
        revision,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
        deletedAt: empty ? now : undefined,
      });
      canonicalRecord = await ctx.db.get(current._id);
    } else {
      revision = 0;
    }
    const result = { status: "applied", canonicalRecord, revision };
    await recordProcessed(
      ctx,
      ownerKey,
      args.operationId,
      args.deviceId,
      "habitEntries.setDesiredState",
      result,
    );
    return result;
  },
});

export const listByDateRange = query({
  args: {
    fromDate: v.string(),
    toDate: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    return await ctx.db
      .query("habitEntries")
      .withIndex("by_owner_generation_sort_date", (q) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .gte("periodSortDate", args.fromDate)
          .lte("periodSortDate", args.toDate),
      )
      .paginate(args.paginationOpts);
  },
});

export const listByHabit = query({
  args: { habitClientId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    return await ctx.db
      .query("habitEntries")
      .withIndex("by_owner_generation_habit", (q) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .eq("habitClientId", args.habitClientId),
      )
      .paginate(args.paginationOpts);
  },
});
