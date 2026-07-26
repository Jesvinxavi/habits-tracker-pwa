import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { operationEnvelope } from "./lib/envelopes";
import { requireIdentity, requireProfile } from "./lib/auth";
import { findProcessed, recordProcessed } from "./lib/idempotency";
import { conflictResult } from "./lib/revisions";

export const collection = mutation({
  args: operationEnvelope,
  handler: async (ctx, args) => {
    const collection = args.payload.collection as "habitCategories" | "habits";
    const orderedClientIds = args.payload.orderedClientIds as string[];
    if (!["habitCategories", "habits"].includes(collection)) {
      throw new Error("INVALID_REORDER_COLLECTION");
    }
    const { ownerKey } = await requireIdentity(ctx);
    const processed = await findProcessed(ctx, ownerKey, args.operationId);
    if (processed) return { ...processed.result, status: "duplicate" };
    const profile = await requireProfile(ctx, ownerKey);
    const revisionRecord = await ctx.db
      .query("collectionRevisions")
      .withIndex("by_owner_generation_collection", (q) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .eq("collection", collection),
      )
      .unique();
    const currentRevision = revisionRecord?.revision ?? 0;
    const records = await ctx.db
      .query(collection)
      .withIndex("by_owner_generation", (q: any) =>
        q.eq("ownerKey", ownerKey).eq("generation", profile.activeGeneration),
      )
      .collect();
    const live = records.filter((record: any) => !record.deletedAt);
    const currentOrder = [...live]
      .sort((left: any, right: any) => left.sortOrder - right.sortOrder)
      .map((record: any) => record.clientId);
    if (
      currentRevision !== args.baseRevision ||
      new Set(orderedClientIds).size !== live.length ||
      live.some((record: any) => !orderedClientIds.includes(record.clientId))
    ) {
      return conflictResult(
        `${collection}.order`,
        collection,
        { revision: args.baseRevision },
        { revision: currentRevision, orderedClientIds: currentOrder },
        { orderedClientIds },
        ["sortOrder"],
      );
    }
    const now = Date.now();
    for (let index = 0; index < orderedClientIds.length; index += 1) {
      const record = live.find((item: any) => item.clientId === orderedClientIds[index]);
      await ctx.db.patch(record!._id, {
        sortOrder: index,
        revision: record!.revision + 1,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
    }
    const nextRevision = currentRevision + 1;
    if (revisionRecord) {
      await ctx.db.patch(revisionRecord._id, {
        revision: nextRevision,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
    } else {
      await ctx.db.insert("collectionRevisions", {
        ownerKey,
        generation: profile.activeGeneration,
        collection,
        revision: nextRevision,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
    }
    const result = {
      status: "applied",
      revision: nextRevision,
      canonicalRecord: { orderedClientIds },
    };
    await recordProcessed(
      ctx,
      ownerKey,
      args.operationId,
      args.deviceId,
      `${collection}.reorder`,
      result,
    );
    return result;
  },
});
