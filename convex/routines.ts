import { createCrudMutations } from "./lib/domain";
import { assertNonBlank } from "./lib/validators";

// No afterDelete cascade: routines are referenced by programs and reference
// activities, but dangling ids are filtered at read time on the client. Cascading
// here would bump revisions on records the user never touched, producing spurious
// sync conflicts.
const crud = createCrudMutations({
  table: "routines",
  entityType: "routines",
  validate: (payload) => {
    assertNonBlank(payload.clientId, "clientId");
    assertNonBlank(payload.name, "name");
    if (!Array.isArray(payload.activityClientIds)) {
      throw new Error("INVALID_ACTIVITY_LIST");
    }
  },
});

export const create = crud.create;
export const update = crud.update;
