import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Deliberately not scheduled yet. Retention cleanup must only be enabled after
// the production offline-duration assumptions have been measured.
export const cleanupEligibleRecords = internalMutation({
  args: {
    processedBefore: v.number(),
    tombstonesBefore: v.number(),
    inactiveGenerationsBefore: v.number(),
    dryRun: v.boolean(),
  },
  handler: async (ctx, args) => {
    const processed = await ctx.db
      .query("processedOperations")
      .withIndex("by_processed_at", (q) => q.lt("processedAt", args.processedBefore))
      .take(200);
    if (!args.dryRun) {
      for (const operation of processed) await ctx.db.delete(operation._id);
    }
    return {
      processedOperationsEligible: processed.length,
      tombstoneCutoff: args.tombstonesBefore,
      inactiveGenerationCutoff: args.inactiveGenerationsBefore,
      note: "Tombstone and generation deletion remain disabled pending production validation.",
    };
  },
});
