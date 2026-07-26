import { createCrudMutations, requireLiveParent } from "./lib/domain";
import { assertHabitPayload } from "./lib/validators";

const crud = createCrudMutations({
  table: "habits",
  entityType: "habits",
  validate: async (payload, ctx, profile, ownerKey) => {
    assertHabitPayload(payload);
    await requireLiveParent(
      ctx,
      "habitCategories",
      ownerKey,
      profile.activeGeneration,
      payload.categoryClientId,
    );
  },
  afterDelete: async (ctx, habit, profile, ownerKey, args) => {
    const entries = await ctx.db
      .query("habitEntries")
      .withIndex("by_owner_generation_habit", (q: any) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .eq("habitClientId", habit.clientId),
      )
      .collect();
    const now = Date.now();
    for (const entry of entries.filter((item: any) => !item.deletedAt)) {
      await ctx.db.patch(entry._id, {
        deletedAt: now,
        revision: entry.revision + 1,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
    }
  },
});

export const create = crud.create;
export const update = crud.update;
export const removeCascade = crud.remove;
