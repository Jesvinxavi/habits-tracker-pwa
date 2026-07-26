import { v } from "convex/values";

export const operationEnvelope = {
  operationId: v.string(),
  deviceId: v.string(),
  baseRevision: v.optional(v.number()),
  baseRecord: v.optional(v.any()),
  payload: v.any(),
};
