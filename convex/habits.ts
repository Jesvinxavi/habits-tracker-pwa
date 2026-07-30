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
});

export const create = crud.create;
export const update = crud.update;
