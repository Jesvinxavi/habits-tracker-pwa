import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Measurement only. No destructive retention job is registered or scheduled.
// The caller repeats with a later cutoff after production offline-duration and
// idempotency windows have been measured.
export const measureProcessedOperationRetention = internalQuery({
  args: {
    processedBefore: v.number(),
    observedAt: v.number(),
    sampleLimit: v.number(),
  },
  returns: v.object({
    cutoff: v.number(),
    eligibleInSample: v.number(),
    hasMore: v.boolean(),
    oldestProcessedAt: v.union(v.number(), v.null()),
    newestProcessedAt: v.union(v.number(), v.null()),
    ageBuckets: v.object({
      under7Days: v.number(),
      days7To30: v.number(),
      days31To90: v.number(),
      over90Days: v.number(),
    }),
    note: v.string(),
  }),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.sampleLimit) || args.sampleLimit < 1 || args.sampleLimit > 500) {
      throw new Error("INVALID_RETENTION_SAMPLE_LIMIT");
    }
    if (args.observedAt < args.processedBefore) {
      throw new Error("INVALID_RETENTION_OBSERVATION_TIME");
    }
    const processed = await ctx.db
      .query("processedOperations")
      .withIndex("by_processed_at", (q) => q.lt("processedAt", args.processedBefore))
      .order("asc")
      .take(args.sampleLimit + 1);
    const sample = processed.slice(0, args.sampleLimit);
    const ageBuckets = {
      under7Days: 0,
      days7To30: 0,
      days31To90: 0,
      over90Days: 0,
    };
    const day = 24 * 60 * 60 * 1_000;
    for (const operation of sample) {
      const age = args.observedAt - operation.processedAt;
      if (age < 7 * day) ageBuckets.under7Days += 1;
      else if (age < 30 * day) ageBuckets.days7To30 += 1;
      else if (age < 90 * day) ageBuckets.days31To90 += 1;
      else ageBuckets.over90Days += 1;
    }
    return {
      cutoff: args.processedBefore,
      eligibleInSample: sample.length,
      hasMore: processed.length > args.sampleLimit,
      oldestProcessedAt: sample[0]?.processedAt ?? null,
      newestProcessedAt: sample[sample.length - 1]?.processedAt ?? null,
      ageBuckets,
      note: "Measurement only; processed-operation deletion is disabled.",
    };
  },
});
