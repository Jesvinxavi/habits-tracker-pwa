import { mutation } from "../_generated/server";
import { findProcessed, recordProcessed } from "./idempotency";
import { operationEnvelope, operationResult } from "./envelopes";
import { requireIdentity, requireProfile } from "./auth";
import { changedFields, conflictResult } from "./revisions";

type Config = {
  table: string;
  entityType: string;
  validate: (payload: any, ctx: any, profile: any, ownerKey: string) => Promise<void> | void;
  afterDelete?: (ctx: any, record: any, profile: any, ownerKey: string, args: any) => Promise<void>;
};

const PROTECTED_PAYLOAD_FIELDS = new Set([
  "_id",
  "_creationTime",
  "ownerKey",
  "generation",
  "revision",
  "updatedAt",
  "updatedByDeviceId",
  "deletedAt",
]);

function mutablePayload(payload: any): Record<string, any> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("INVALID_OPERATION_PAYLOAD");
  }
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !PROTECTED_PAYLOAD_FIELDS.has(key)),
  ) as Record<string, any>;
}

function portable(record: any) {
  if (!record) return null;
  const { _id, _creationTime, ownerKey, generation, updatedAt, updatedByDeviceId, ...value } =
    record;
  return value;
}

function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        if (value[key] !== undefined) result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

function recordsEqual(left: any, right: any) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

async function findCurrent(
  ctx: any,
  config: Config,
  ownerKey: string,
  generation: number,
  clientId: string,
) {
  return await ctx.db
    .query(config.table)
    .withIndex("by_owner_generation_client", (query: any) =>
      query.eq("ownerKey", ownerKey).eq("generation", generation).eq("clientId", clientId),
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
    returns: operationResult,
    handler: async (ctx, args) => {
      const { ownerKey } = await requireIdentity(ctx);
      const duplicate = await duplicateResult(ctx, ownerKey, args.operationId);
      if (duplicate) return duplicate;
      const profile = await requireProfile(ctx, ownerKey);
      const payload = mutablePayload(args.payload);
      await config.validate(payload, ctx, profile, ownerKey);
      const current = await findCurrent(
        ctx,
        config,
        ownerKey,
        profile.activeGeneration,
        payload.clientId,
      );
      if (current) {
        if (recordsEqual(portable(current), { ...payload, revision: 1 })) {
          const result = {
            status: "applied",
            canonicalRecord: current,
            revision: current.revision,
          };
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
          payload.clientId,
          null,
          current,
          payload,
          ["clientId"],
        );
      }
      const now = Date.now();
      const id = await ctx.db.insert(config.table as any, {
        ...payload,
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
    returns: operationResult,
    handler: async (ctx, args) => {
      const { ownerKey } = await requireIdentity(ctx);
      const duplicate = await duplicateResult(ctx, ownerKey, args.operationId);
      if (duplicate) return duplicate;
      const profile = await requireProfile(ctx, ownerKey);
      const payload = mutablePayload(args.payload);
      await config.validate(payload, ctx, profile, ownerKey);
      const current = await findCurrent(
        ctx,
        config,
        ownerKey,
        profile.activeGeneration,
        payload.clientId,
      );
      if (!current || current.deletedAt || args.baseRevision !== current.revision) {
        return conflictResult(
          config.entityType,
          payload.clientId,
          args.baseRecord,
          current,
          payload,
          changedFields(args.baseRecord, payload),
        );
      }
      const revision = current.revision + 1;
      await ctx.db.patch(current._id, {
        ...payload,
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
    returns: operationResult,
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
