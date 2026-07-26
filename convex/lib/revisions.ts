export function conflictResult(
  entityType: string,
  clientId: string,
  baseRecord: unknown,
  serverRecord: unknown,
  attemptedRecord: unknown,
  conflictingFields: string[],
) {
  return {
    status: "conflict" as const,
    conflict: {
      entityType,
      clientId,
      baseRecord: baseRecord ?? null,
      serverRecord: serverRecord ?? null,
      attemptedRecord: attemptedRecord ?? null,
      conflictingFields,
    },
  };
}

export function changedFields(base: any, attempted: any) {
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(attempted ?? {})]);
  return [...keys].filter(
    (key) => JSON.stringify(base?.[key]) !== JSON.stringify(attempted?.[key]),
  );
}
