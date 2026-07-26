import { createCrudMutations, requireLiveParent } from "./lib/domain";
import { assertDate, assertFinitePositive, assertNonBlank } from "./lib/validators";

const crud = createCrudMutations({
  table: "activityRecords",
  entityType: "activityRecords",
  validate: async (payload, ctx, profile, ownerKey) => {
    assertNonBlank(payload.clientId, "clientId");
    assertDate(payload.dateKey);
    if (payload.duration !== undefined) assertFinitePositive(payload.duration, "duration");
    for (const set of payload.sets ?? []) {
      assertFinitePositive(set.reps, "reps");
      if (set.value !== undefined) assertFinitePositive(set.value, "value");
    }
    await requireLiveParent(
      ctx,
      "activities",
      ownerKey,
      profile.activeGeneration,
      payload.activityClientId,
    );
  },
});

export const create = crud.create;
export const update = crud.update;
export const remove = crud.remove;
