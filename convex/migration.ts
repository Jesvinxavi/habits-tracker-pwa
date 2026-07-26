import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity, requireProfile } from "./lib/auth";
import { tableChecksum } from "./lib/checksum";
import { assertDate } from "./lib/validators";

const TABLES = [
  "userPreferences",
  "habitCategories",
  "habits",
  "habitEntries",
  "holidayPeriods",
  "holidaySingles",
  "activityCategories",
  "activities",
  "activityRecords",
  "restDays",
  "legacyData",
] as const;

const tableValidator = v.union(...TABLES.map((table) => v.literal(table)));

async function getBatch(ctx: any, ownerKey: string, batchId: string) {
  const batch = await ctx.db
    .query("migrationBatches")
    .withIndex("by_owner_batch", (q: any) =>
      q.eq("ownerKey", ownerKey).eq("batchId", batchId),
    )
    .unique();
  if (!batch) throw new Error("MIGRATION_BATCH_NOT_FOUND");
  return batch;
}

async function targetRecords(ctx: any, table: string, ownerKey: string, generation: number) {
  return await ctx.db
    .query(table)
    .withIndex("by_owner_generation", (q: any) =>
      q.eq("ownerKey", ownerKey).eq("generation", generation),
    )
    .collect();
}

async function currentCounts(ctx: any, ownerKey: string, generation: number) {
  const result: Record<string, number> = {};
  for (const table of TABLES) {
    result[table] = (await targetRecords(ctx, table, ownerKey, generation)).length;
  }
  return result;
}

export const begin = mutation({
  args: {
    batchId: v.string(),
    deviceId: v.string(),
    sourceFingerprint: v.string(),
    appFirstOpenDate: v.string(),
    expectedCounts: v.any(),
    expectedChecksums: v.any(),
  },
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    assertDate(args.appFirstOpenDate, "appFirstOpenDate");
    const profile = await requireProfile(ctx, ownerKey);
    const reused = await ctx.db
      .query("migrationBatches")
      .withIndex("by_owner_batch", (q) =>
        q.eq("ownerKey", ownerKey).eq("batchId", args.batchId),
      )
      .unique();
    if (reused) {
      if (reused.sourceFingerprint !== args.sourceFingerprint) {
        throw new Error("BATCH_ID_FINGERPRINT_MISMATCH");
      }
      return reused;
    }
    if (profile.activeMigrationBatchId) throw new Error("MIGRATION_ALREADY_ACTIVE");
    const targetGeneration = profile.activeGeneration + 1;
    const now = Date.now();
    const id = await ctx.db.insert("migrationBatches", {
      ownerKey,
      batchId: args.batchId,
      deviceId: args.deviceId,
      sourceFingerprint: args.sourceFingerprint,
      appFirstOpenDate: args.appFirstOpenDate,
      baseGeneration: profile.activeGeneration,
      targetGeneration,
      expectedCounts: args.expectedCounts,
      expectedChecksums: args.expectedChecksums,
      uploadedCounts: Object.fromEntries(TABLES.map((table) => [table, 0])),
      status: "staging",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(profile._id, {
      activeMigrationBatchId: args.batchId,
      migrationStatus: "staging",
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const uploadChunk = mutation({
  args: {
    batchId: v.string(),
    table: tableValidator,
    records: v.array(v.any()),
    chunkChecksum: v.string(),
  },
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const batch = await getBatch(ctx, ownerKey, args.batchId);
    if (batch.status !== "staging") throw new Error("MIGRATION_NOT_STAGING");
    if (args.records.length > 100) throw new Error("MIGRATION_CHUNK_TOO_LARGE");
    if (tableChecksum(args.records) !== args.chunkChecksum) {
      throw new Error("MIGRATION_CHUNK_CHECKSUM_MISMATCH");
    }
    for (const raw of args.records) {
      const record = { ...raw };
      delete record._id;
      delete record._creationTime;
      delete record.ownerKey;
      delete record.generation;
      delete record.updatedAt;
      delete record.updatedByDeviceId;
      delete record.deletedAt;
      let existing;
      if (args.table === "userPreferences" || args.table === "legacyData") {
        existing = (
          await targetRecords(ctx, args.table, ownerKey, batch.targetGeneration)
        )[0];
      } else {
        if (!record.clientId) throw new Error("MIGRATION_CLIENT_ID_REQUIRED");
        existing = await ctx.db
          .query(args.table)
          .withIndex("by_owner_generation_client", (q: any) =>
            q
              .eq("ownerKey", ownerKey)
              .eq("generation", batch.targetGeneration)
              .eq("clientId", record.clientId),
          )
          .unique();
      }
      if (existing) {
        if (tableChecksum([existing]) !== tableChecksum([record])) {
          throw new Error("MIGRATION_RECORD_COLLISION");
        }
        continue;
      }
      const now = Date.now();
      await ctx.db.insert(args.table, {
        ...record,
        ownerKey,
        generation: batch.targetGeneration,
        ...(args.table === "legacyData"
          ? { updatedAt: now }
          : {
              revision: record.revision ?? 1,
              updatedAt: now,
              updatedByDeviceId: batch.deviceId,
            }),
      });
    }
    const uploadedCounts = await currentCounts(ctx, ownerKey, batch.targetGeneration);
    await ctx.db.patch(batch._id, { uploadedCounts, updatedAt: Date.now() });
    return { uploadedCounts };
  },
});

export const verify = mutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const batch = await getBatch(ctx, ownerKey, args.batchId);
    if (batch.status !== "staging" && batch.status !== "verifying") {
      throw new Error("MIGRATION_CANNOT_VERIFY");
    }
    await ctx.db.patch(batch._id, { status: "verifying", updatedAt: Date.now() });
    const actualCounts: Record<string, number> = {};
    const actualChecksums: Record<string, string> = {};
    for (const table of TABLES) {
      const records = await targetRecords(ctx, table, ownerKey, batch.targetGeneration);
      actualCounts[table] = records.length;
      actualChecksums[table] = tableChecksum(records);
    }
    const countsMatch = TABLES.every(
      (table) => actualCounts[table] === batch.expectedCounts[table],
    );
    const checksumsMatch = TABLES.every(
      (table) => actualChecksums[table] === batch.expectedChecksums[table],
    );
    const status = countsMatch && checksumsMatch ? "verified" : "failed";
    await ctx.db.patch(batch._id, { status, updatedAt: Date.now() });
    const profile = await requireProfile(ctx, ownerKey);
    await ctx.db.patch(profile._id, {
      migrationStatus: status === "verified" ? "verifying" : "failed",
      updatedAt: Date.now(),
    });
    return { status, actualCounts, actualChecksums, countsMatch, checksumsMatch };
  },
});

export const activate = mutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const batch = await getBatch(ctx, ownerKey, args.batchId);
    const profile = await requireProfile(ctx, ownerKey);
    if (batch.status !== "verified") throw new Error("MIGRATION_NOT_VERIFIED");
    if (
      profile.activeGeneration !== batch.baseGeneration ||
      profile.activeMigrationBatchId !== batch.batchId
    ) {
      throw new Error("MIGRATION_BASE_GENERATION_CHANGED");
    }
    if (batch.conflictSummary?.unresolvedCount > 0) {
      throw new Error("MIGRATION_HAS_UNRESOLVED_CONFLICTS");
    }
    const now = Date.now();
    await ctx.db.patch(profile._id, {
      previousGeneration: profile.activeGeneration,
      activeGeneration: batch.targetGeneration,
      appFirstOpenDate: batch.appFirstOpenDate,
      migrationStatus: "completed",
      migrationCompletedAt: now,
      activeMigrationBatchId: undefined,
      updatedAt: now,
    });
    await ctx.db.patch(batch._id, {
      status: "activated",
      committedAt: now,
      updatedAt: now,
    });
    return {
      activeGeneration: batch.targetGeneration,
      previousGeneration: batch.baseGeneration,
    };
  },
});

export const abandon = mutation({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    const { ownerKey } = await requireIdentity(ctx);
    const batch = await getBatch(ctx, ownerKey, args.batchId);
    const profile = await requireProfile(ctx, ownerKey);
    if (batch.targetGeneration === profile.activeGeneration) {
      throw new Error("CANNOT_ABANDON_ACTIVE_GENERATION");
    }
    for (const table of TABLES) {
      const records = await targetRecords(ctx, table, ownerKey, batch.targetGeneration);
      for (const record of records) await ctx.db.delete(record._id);
    }
    const now = Date.now();
    await ctx.db.patch(batch._id, { status: "abandoned", updatedAt: now });
    if (profile.activeMigrationBatchId === batch.batchId) {
      await ctx.db.patch(profile._id, {
        activeMigrationBatchId: undefined,
        migrationStatus: "not_started",
        updatedAt: now,
      });
    }
    return { status: "abandoned" };
  },
});

export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const { ownerKey } = await requireIdentity(ctx);
    const profile = await requireProfile(ctx, ownerKey);
    const batch = profile.activeMigrationBatchId
      ? await ctx.db
          .query("migrationBatches")
          .withIndex("by_owner_batch", (q) =>
            q.eq("ownerKey", ownerKey).eq("batchId", profile.activeMigrationBatchId!),
          )
          .unique()
      : null;
    return { migrationStatus: profile.migrationStatus, batch };
  },
});
