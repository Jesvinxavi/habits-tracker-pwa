import { mutation } from "./_generated/server";
import { operationEnvelope, operationResult } from "./lib/envelopes";
import { requireIdentity, requireProfile } from "./lib/auth";
import { findProcessed, recordProcessed } from "./lib/idempotency";
import { assertDate } from "./lib/validators";
import { conflictResult } from "./lib/revisions";

function desiredDateMutation(config: {
  table: "holidaySingles" | "restDays";
  prefix: string;
  mutationName: string;
}) {
  return mutation({
    args: operationEnvelope,
    returns: operationResult,
    handler: async (ctx, args) => {
      const { ownerKey } = await requireIdentity(ctx);
      const processed = await findProcessed(ctx, ownerKey, args.operationId);
      if (processed) return { ...processed.result, status: "duplicate" };
      const profile = await requireProfile(ctx, ownerKey);
      const dateKey = args.payload.dateKey;
      assertDate(dateKey);
      const clientId = `${config.prefix}:${dateKey}`;
      const current = await ctx.db
        .query(config.table)
        .withIndex("by_owner_generation_client", (q) =>
          q
            .eq("ownerKey", ownerKey)
            .eq("generation", profile.activeGeneration)
            .eq("clientId", clientId),
        )
        .unique();
      if (current && args.baseRevision !== current.revision) {
        return conflictResult(
          config.table,
          clientId,
          args.baseRecord,
          current,
          args.payload.desired ? { clientId, dateKey } : null,
          ["dateKey"],
        );
      }
      const now = Date.now();
      const revision = current ? current.revision + 1 : 1;
      let canonicalRecord = null;
      if (!current && args.payload.desired) {
        const id = await ctx.db.insert(config.table, {
          ownerKey,
          generation: profile.activeGeneration,
          clientId,
          dateKey,
          revision,
          updatedAt: now,
          updatedByDeviceId: args.deviceId,
        });
        canonicalRecord = await ctx.db.get(id);
      } else if (current) {
        await ctx.db.patch(current._id, {
          revision,
          updatedAt: now,
          updatedByDeviceId: args.deviceId,
          deletedAt: args.payload.desired ? undefined : now,
        });
        canonicalRecord = await ctx.db.get(current._id);
      }
      const result = { status: "applied", canonicalRecord, revision };
      await recordProcessed(
        ctx,
        ownerKey,
        args.operationId,
        args.deviceId,
        config.mutationName,
        result,
      );
      return result;
    },
  });
}

export const setHolidaySingleDesiredState = desiredDateMutation({
  table: "holidaySingles",
  prefix: "holiday-single",
  mutationName: "holidays.setSingleDesiredState",
});

export const setRestDayDesiredState = desiredDateMutation({
  table: "restDays",
  prefix: "rest-day",
  mutationName: "restDays.setDesiredState",
});
