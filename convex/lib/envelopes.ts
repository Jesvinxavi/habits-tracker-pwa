import { v } from "convex/values";

export const operationEnvelope = {
  operationId: v.string(),
  deviceId: v.string(),
  baseRevision: v.optional(v.number()),
  baseRecord: v.optional(v.any()),
  payload: v.any(),
};

export const operationResult = v.union(
  v.object({
    status: v.union(v.literal("applied"), v.literal("duplicate")),
    canonicalRecord: v.any(),
    revision: v.number(),
  }),
  v.object({
    status: v.literal("conflict"),
    conflict: v.object({
      entityType: v.string(),
      clientId: v.string(),
      baseRecord: v.any(),
      serverRecord: v.any(),
      attemptedRecord: v.any(),
      conflictingFields: v.array(v.string()),
    }),
  }),
);

export const paginatedAnyResult = v.object({
  page: v.array(v.any()),
  isDone: v.boolean(),
  continueCursor: v.string(),
  splitCursor: v.optional(v.union(v.string(), v.null())),
  pageStatus: v.optional(
    v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null()),
  ),
});
