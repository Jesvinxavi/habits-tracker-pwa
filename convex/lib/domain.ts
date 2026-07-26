import { mutation } from "../_generated/server";
import { findProcessed, recordProcessed } from "./idempotency";
import { operationEnvelope } from "./envelopes";
import { requireIdentity, requireProfile } from "./auth";
import { changedFields, conflictResult } from "./revisions";

type Config = {
  table: string;
  entityType: string;
  validate: (payload: any, ctx: any, profile: any, ownerKey: string) => Promise<void> | void;
  afterDelete?: (
    ctx: any,
    record: any,
    profile: any,
    ownerKey: string,
    args: any,
  ) => Promise<void>;
};

function portable(record: any) {
  if (!record) return null;
  const {
    _id,
    _creationTime,
    ownerKey,
    generation,
    updatedAt,
    updatedByDeviceId,
    deletedAt,
    ...value
  } = record;
  return value;
}

async function findCurrent(ctx: any, config: Config, ownerKey: string, generation: number, clientId: string) {
  return await ctx.db
    .query(config.table)
    .withIndex("by_owner_generation_client", (query: any) =>
      query
        .eq("ownerKey", ownerKey)
        .eq("generation", generation)
        .eq("clientId", clientId),
    )
    .unique();
}

async function duplicateResult(ctx: any, ownerKey: string, operationId: string) {
  const processed = await findProcessed(ctx, ownerKey, operationId);
  return processed ? { ...processed.result, status: "duplicate" } : null;
}

export function createCrudMutations(config: Config) {
  const create = mutation({
    args: operationEnvelope,
    handler: async (ctx, args) => {
      const { ownerKey } = await requireIdentity(ctx);
      const duplicate = await duplicateResult(ctx, ownerKey, args.operationId);
      if (duplicate) return duplicate;
      const profile = await requireProfile(ctx, ownerKey);
      await config.validate(args.payload, ctx, profile, ownerKey);
      const current = await findCurrent(
        ctx,
        config,
        ownerKey,
        profile.activeGeneration,
        args.payload.clientId,
      );
      if (current) {
        if (JSON.stringify(portable(current)) === JSON.stringify({ ...args.payload, revision: 1 })) {
          const result = { status: "applied", canonicalRecord: current, revision: current.revision };
          await recordProcessed(
            ctx,
            ownerKey,
            args.operationId,
            args.deviceId,
            `${config.entityType}.create`,
            result,
          );
          return result;
        }
        return conflictResult(
          config.entityType,
          args.payload.clientId,
          null,
          current,
          args.payload,
          ["clientId"],
        );
      }
      const now = Date.now();
      const id = await ctx.db.insert(config.table as any, {
        ...args.payload,
        ownerKey,
        generation: profile.activeGeneration,
        revision: 1,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
      const canonicalRecord = await ctx.db.get(id);
      const result = { status: "applied", canonicalRecord, revision: 1 };
      await recordProcessed(
        ctx,
        ownerKey,
        args.operationId,
        args.deviceId,
        `${config.entityType}.create`,
        result,
      );
      return result;
    },
  });

  const update = mutation({
    args: operationEnvelope,
    handler: async (ctx, args) => {
      const { ownerKey } = await requireIdentity(ctx);
      const duplicate = await duplicateResult(ctx, ownerKey, args.operationId);
      if (duplicate) return duplicate;
      const profile = await requireProfile(ctx, ownerKey);
      await config.validate(args.payload, ctx, profile, ownerKey);
      const current = await findCurrent(
        ctx,
        config,
        ownerKey,
        profile.activeGeneration,
        args.payload.clientId,
      );
      if (!current || current.deletedAt || args.baseRevision !== current.revision) {
        return conflictResult(
          config.entityType,
          args.payload.clientId,
          args.baseRecord,
          current,
          args.payload,
          changedFields(args.baseRecord, args.payload),
        );
      }
      const revision = current.revision + 1;
      await ctx.db.patch(current._id, {
        ...args.payload,
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
        `${config.entityType}.update`,
        result,
      );
      return result;
    },
  });

  const remove = mutation({
    args: operationEnvelope,
    handler: async (ctx, args) => {
      const { ownerKey } = await requireIdentity(ctx);
      const duplicate = await duplicateResult(ctx, ownerKey, args.operationId);
      if (duplicate) return duplicate;
      const profile = await requireProfile(ctx, ownerKey);
      const current = await findCurrent(
        ctx,
        config,
        ownerKey,
        profile.activeGeneration,
        args.payload.clientId,
      );
      if (!current || current.deletedAt || args.baseRevision !== current.revision) {
        return conflictResult(
          config.entityType,
          args.payload.clientId,
          args.baseRecord,
          current,
          null,
          ["deletedAt"],
        );
      }
      const now = Date.now();
      const revision = current.revision + 1;
      await ctx.db.patch(current._id, {
        deletedAt: now,
        revision,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
      if (config.afterDelete) {
        await config.afterDelete(ctx, current, profile, ownerKey, args);
      }
      const canonicalRecord = await ctx.db.get(current._id);
      const result = { status: "applied", canonicalRecord, revision };
      await recordProcessed(
        ctx,
        ownerKey,
        args.operationId,
        args.deviceId,
        `${config.entityType}.remove`,
        result,
      );
      return result;
    },
  });

  return { create, update, remove };
}

export async function requireLiveParent(
  ctx: any,
  table: string,
  ownerKey: string,
  generation: number,
  clientId: string,
) {
  const parent = await ctx.db
    .query(table)
    .withIndex("by_owner_generation_client", (query: any) =>
      query.eq("ownerKey", ownerKey).eq("generation", generation).eq("clientId", clientId),
    )
    .unique();
  if (!parent || parent.deletedAt) throw new Error("MISSING_OR_DELETED_PARENT");
  return parent;
}
