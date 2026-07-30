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
});

export const create = crud.create;
export const update = crud.update;
