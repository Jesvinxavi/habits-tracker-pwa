import { createCrudMutations } from "./lib/domain";
import { touchHistorySyncSignal } from "./lib/idempotency";
import { assertNonBlank } from "./lib/validators";

const MAX_CASCADE_HABITS = 100;
const MAX_CASCADE_ENTRIES = 5_000;

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
      .take(MAX_CASCADE_HABITS + 1);
    if (habits.length > MAX_CASCADE_HABITS) {
      throw new Error(`ACCOUNT_CASCADE_LIMIT_EXCEEDED:habits:${MAX_CASCADE_HABITS}`);
    }
    const liveHabits = habits.filter((item: any) => !item.deletedAt);
    const entriesByHabit = new Map<string, any[]>();
    let entryCount = 0;
    for (const habit of liveHabits) {
      const remaining = MAX_CASCADE_ENTRIES - entryCount;
      const entries = await ctx.db
        .query("habitEntries")
        .withIndex("by_owner_generation_habit", (q: any) =>
          q
            .eq("ownerKey", ownerKey)
            .eq("generation", profile.activeGeneration)
            .eq("habitClientId", habit.clientId),
        )
        .take(remaining + 1);
      if (entries.length > remaining) {
        throw new Error(`ACCOUNT_CASCADE_LIMIT_EXCEEDED:habitEntries:${MAX_CASCADE_ENTRIES}`);
      }
      const liveEntries = entries.filter((item: any) => !item.deletedAt);
      entriesByHabit.set(habit.clientId, liveEntries);
      entryCount += entries.length;
    }
    const now = Date.now();
    for (const habit of liveHabits) {
      await ctx.db.patch(habit._id, {
        deletedAt: now,
        revision: habit.revision + 1,
        updatedAt: now,
        updatedByDeviceId: args.deviceId,
      });
      for (const entry of entriesByHabit.get(habit.clientId) ?? []) {
        await ctx.db.patch(entry._id, {
          deletedAt: now,
          revision: entry.revision + 1,
          updatedAt: now,
          updatedByDeviceId: args.deviceId,
        });
      }
    }
    if (entryCount > 0) {
      await touchHistorySyncSignal(
        ctx,
        ownerKey,
        profile.activeGeneration,
        "habitEntries",
        args.deviceId,
        now,
      );
    }
  },
});

export const create = crud.create;
export const update = crud.update;
export const removeCascade = crud.remove;
