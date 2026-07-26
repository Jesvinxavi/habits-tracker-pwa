export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function assertNonBlank(value: string, field: string) {
  if (!value.trim()) throw new Error(`INVALID_${field.toUpperCase()}`);
}

export function assertDate(value: string, field = "date") {
  if (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
}

export function assertFinitePositive(value: number | undefined, field: string) {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
}

export function assertHabitPayload(payload: Record<string, any>) {
  assertNonBlank(payload.clientId, "clientId");
  assertNonBlank(payload.name, "name");
  assertNonBlank(payload.categoryClientId, "categoryClientId");
  if (payload.scheduledTime != null && !TIME_PATTERN.test(payload.scheduledTime)) {
    throw new Error("INVALID_SCHEDULED_TIME");
  }
  for (const day of payload.days ?? []) {
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error("INVALID_DAY");
  }
  for (const interval of [payload.monthly?.interval, payload.yearInterval]) {
    if (interval !== undefined && (!Number.isInteger(interval) || interval <= 0)) {
      throw new Error("INVALID_INTERVAL");
    }
  }
  assertFinitePositive(payload.target, "target");
  assertFinitePositive(payload.defaultIncrement, "defaultIncrement");
}
