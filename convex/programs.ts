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
      // Exactly one target per entry: a routine or a single activity.
      const hasRoutine = Boolean(day.routineClientId);
      const hasActivity = Boolean(day.activityClientId);
      if (hasRoutine === hasActivity) {
        throw new Error("INVALID_PROGRAM_SCHEDULE");
      }
    }
    if (payload.restDays !== undefined) {
      if (!Array.isArray(payload.restDays)) throw new Error("INVALID_PROGRAM_REST_DAYS");
      for (const day of payload.restDays) {
        if (!Number.isInteger(day) || day < 0 || day > 6) {
          throw new Error("INVALID_PROGRAM_REST_DAYS");
        }
      }
    }
    if (payload.schedulePhases !== undefined) {
      if (!Array.isArray(payload.schedulePhases)) {
        throw new Error("INVALID_PROGRAM_SCHEDULE_PHASES");
      }
      for (const phase of payload.schedulePhases) {
        assertDate(phase?.startDateISO, "phase.startDateISO");
        assertDate(phase?.endDateISO, "phase.endDateISO");
        if (phase.startDateISO > phase.endDateISO) {
          throw new Error("INVALID_PROGRAM_SCHEDULE_PHASES");
        }
        if (!Array.isArray(phase.scheduledDays)) {
          throw new Error("INVALID_PROGRAM_SCHEDULE_PHASES");
        }
        for (const day of phase.scheduledDays) {
          if (!Number.isInteger(day?.dayOfWeek) || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
            throw new Error("INVALID_PROGRAM_SCHEDULE_PHASES");
          }
          // Exactly one target per entry, as on the live schedule.
          if (Boolean(day.routineClientId) === Boolean(day.activityClientId)) {
            throw new Error("INVALID_PROGRAM_SCHEDULE_PHASES");
          }
        }
      }
    }

    // Legacy only: the current client never sends anytimeRoutines, but a device
    // still running an older build might, and a stale write must not be able to
    // put a malformed entry in the table.
    if (payload.anytimeRoutines !== undefined) {
      if (!Array.isArray(payload.anytimeRoutines)) {
        throw new Error("INVALID_PROGRAM_ANYTIME");
      }
      for (const entry of payload.anytimeRoutines) {
        if (!Number.isInteger(entry?.count) || entry.count < 1) {
          throw new Error("INVALID_PROGRAM_ANYTIME");
        }
        // Exactly one target per entry: a routine or a single activity.
        if (Boolean(entry.routineClientId) === Boolean(entry.activityClientId)) {
          throw new Error("INVALID_PROGRAM_ANYTIME");
        }
      }
    }
  },
});

export const create = crud.create;
export const update = crud.update;
export const removeCascade = crud.remove;
