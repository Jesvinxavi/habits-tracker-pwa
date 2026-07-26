import { createCrudMutations } from "./lib/domain";
import { assertDate, assertNonBlank } from "./lib/validators";

const crud = createCrudMutations({
  table: "holidayPeriods",
  entityType: "holidayPeriods",
  validate: (payload) => {
    assertNonBlank(payload.clientId, "clientId");
    assertDate(payload.startISO, "start");
    assertDate(payload.endISO, "end");
    if (payload.startISO > payload.endISO) throw new Error("INVALID_DATE_RANGE");
  },
});

export const create = crud.create;
export const update = crud.update;
export const remove = crud.remove;
