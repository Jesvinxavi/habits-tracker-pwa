import type { MutationCtx } from "../_generated/server";

const HISTORY_ENTITY_TYPES = new Set(["habitEntries", "activityRecords", "restDays"]);

type HistoryEntityType = "habitEntries" | "activityRecords" | "restDays";

export async function touchHistorySyncSignal(
  ctx: MutationCtx,
  ownerKey: string,
  generation: number,
  entityType: HistoryEntityType,
  deviceId: string,
  updatedAt = Date.now(),
) {
  const signal = await ctx.db
    .query("historySyncSignals")
    .withIndex("by_owner_generation_entity", (query) =>
      query.eq("ownerKey", ownerKey).eq("generation", generation).eq("entityType", entityType),
    )
    .unique();
  if (signal) {
    await ctx.db.patch(signal._id, {
      revision: signal.revision + 1,
      updatedAt,
      updatedByDeviceId: deviceId,
    });
    return;
  }
  await ctx.db.insert("historySyncSignals", {
    ownerKey,
    generation,
    entityType,
    revision: 1,
    updatedAt,
    updatedByDeviceId: deviceId,
  });
}

export async function findProcessed(ctx: MutationCtx, ownerKey: string, operationId: string) {
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
  const processedAt = Date.now();
  await ctx.db.insert("processedOperations", {
    ownerKey,
    operationId,
    deviceId,
    processedAt,
    mutationName,
    result,
  });

  const entityType = mutationName.split(".")[0];
  if (!HISTORY_ENTITY_TYPES.has(entityType)) return;

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_owner", (query) => query.eq("ownerKey", ownerKey))
    .unique();
  if (!profile) return;
  await touchHistorySyncSignal(
    ctx,
    ownerKey,
    profile.activeGeneration,
    entityType as HistoryEntityType,
    deviceId,
    processedAt,
  );
}
