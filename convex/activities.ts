import { createCrudMutations, requireLiveParent } from "./lib/domain";
import { assertNonBlank } from "./lib/validators";

const crud = createCrudMutations({
  table: "activities",
  entityType: "activities",
  validate: async (payload, ctx, profile, ownerKey) => {
    assertNonBlank(payload.clientId, "clientId");
    assertNonBlank(payload.name, "name");
    await requireLiveParent(
      ctx,
      "activityCategories",
      ownerKey,
      profile.activeGeneration,
      payload.categoryClientId,
    );
  },
  afterDelete: async (ctx, activity, profile, ownerKey, args) => {
    const records = await ctx.db
      .query("activityRecords")
      .withIndex("by_owner_generation_activity", (q: any) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .eq("activityClientId", activity.clientId),
      )
      .collect();
    const now = Date.now();
    for (const record of records.filter((item: any) => !item.deletedAt)) {
      await ctx.db.patch(record._id, {
        deletedAt: now,
        revision: record.revision + 1,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
    }
  },
});

export const create = crud.create;
export const update = crud.update;
export const removeCascade = crud.remove;
