import { createCrudMutations } from "./lib/domain";
import { assertDate, assertNonBlank } from "./lib/validators";

// No afterDelete cascade: deleting a program never rewrites routines. See
// convex/routines.ts for the rationale behind read-time referential integrity.
const crud = createCrudMutations({
  table: "programs",
  entityType: "programs",
  validate: (payload) => {
    assertNonBlank(payload.clientId, "clientId");
    assertNonBlank(payload.name, "name");
    assertDate(payload.startDateISO, "startDateISO");
    assertDate(payload.endDateISO, "endDateISO");
    if (payload.startDateISO > payload.endDateISO) {
      throw new Error("INVALID_PROGRAM_RANGE");
    }
    if (!Array.isArray(payload.scheduledDays)) {
      throw new Error("INVALID_PROGRAM_SCHEDULE");
    }
    for (const day of payload.scheduledDays) {
      if (!Number.isInteger(day?.dayOfWeek) || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        throw new Error("INVALID_PROGRAM_SCHEDULE");
      }
    }
  },
});

export const create = crud.create;
export const update = crud.update;
export const removeCascade = crud.remove;
