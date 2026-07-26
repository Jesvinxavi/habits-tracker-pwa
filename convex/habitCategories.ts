import { createCrudMutations } from "./lib/domain";
import { assertNonBlank } from "./lib/validators";

const crud = createCrudMutations({
  table: "habitCategories",
  entityType: "habitCategories",
  validate: (payload) => {
    assertNonBlank(payload.clientId, "clientId");
    assertNonBlank(payload.name, "name");
  },
  afterDelete: async (ctx, category, profile, ownerKey, args) => {
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_owner_generation_category", (q: any) =>
        q
          .eq("ownerKey", ownerKey)
          .eq("generation", profile.activeGeneration)
          .eq("categoryClientId", category.clientId),
      )
      .collect();
    const now = Date.now();
    for (const habit of habits.filter((item: any) => !item.deletedAt)) {
      await ctx.db.patch(habit._id, {
        deletedAt: now,
        revision: habit.revision + 1,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
      const entries = await ctx.db
        .query("habitEntries")
        .withIndex("by_owner_generation_habit", (q: any) =>
          q
            .eq("ownerKey", ownerKey)
            .eq("generation", profile.activeGeneration)
            .eq("habitClientId", habit.clientId),
        )
        .collect();
      for (const entry of entries.filter((item: any) => !item.deletedAt)) {
        await ctx.db.patch(entry._id, {
          deletedAt: now,
          revision: entry.revision + 1,
          updatedAt: now,
          updatedByDeviceId: args.deviceId,
        });
      }
    }
  },
});

export const create = crud.create;
export const update = crud.update;
export const removeCascade = crud.remove;
