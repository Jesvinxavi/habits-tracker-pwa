function omitNullishFields(record, fields) {
  const sanitized = { ...record };
  fields.forEach((field) => {
    if (sanitized[field] == null) delete sanitized[field];
  });
  return sanitized;
}

export function sanitizeActivityDefinition(record) {
  return omitNullishFields(record, ['units', 'muscleGroup', 'notes', 'betterDirection', 'archivedAt']);
}

export function sanitizeActivityRecord(record) {
  const sanitized = omitNullishFields(record, [
    'duration',
    'durationUnit',
    'intensity',
    'sets',
  ]);
  if (Array.isArray(sanitized.sets)) {
    sanitized.sets = sanitized.sets.map((set) =>
      omitNullishFields(set, ['value'])
    );
  }
  return sanitized;
}

export function sanitizeOperationRecord(entityType, record) {
  if (!record) return record;
  if (entityType === 'activities') return sanitizeActivityDefinition(record);
  if (entityType === 'activityRecords') return sanitizeActivityRecord(record);
  return record;
}

export function sanitizeMutationPayload(mutationName, payload) {
  if (mutationName === 'activities:create' || mutationName === 'activities:update') {
    return sanitizeActivityDefinition(payload);
  }
  if (
    mutationName === 'activityRecords:create' ||
    mutationName === 'activityRecords:update'
  ) {
    return sanitizeActivityRecord(payload);
  }
  return payload;
}
