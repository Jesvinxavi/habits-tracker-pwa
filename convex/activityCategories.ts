import { createCrudMutations } from "./lib/domain";
import { assertNonBlank } from "./lib/validators";

const crud = createCrudMutations({
  table: "activityCategories",
  entityType: "activityCategories",
  validate: (payload) => {
    assertNonBlank(payload.clientId, "clientId");
    assertNonBlank(payload.name, "name");
  },
});

export const create = crud.create;
export const update = crud.update;
export const remove = crud.remove;
