import type { MutationCtx } from "../_generated/server";

export async function findProcessed(
  ctx: MutationCtx,
  ownerKey: string,
  operationId: string,
) {
  return await ctx.db
    .query("processedOperations")
    .withIndex("by_owner_operation", (query) =>
      query.eq("ownerKey", ownerKey).eq("operationId", operationId),
    )
    .unique();
}

export async function recordProcessed(
  ctx: MutationCtx,
  ownerKey: string,
  operationId: string,
  deviceId: string,
  mutationName: string,
  result: unknown,
) {
  await ctx.db.insert("processedOperations", {
    ownerKey,
    operationId,
    deviceId,
    processedAt: Date.now(),
    mutationName,
    result,
  });
}
