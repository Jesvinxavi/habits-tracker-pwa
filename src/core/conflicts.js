const SERVER_METADATA = new Set([
  '_id',
  '_creationTime',
  'ownerKey',
  'generation',
  'updatedAt',
  'updatedByDeviceId',
  'revision',
  'deletedAt',
  'optimistic',
]);

function equal(left, right) {
  if (Object.is(left, right)) return true;
  if (left == null || right == null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => equal(item, right[index]))
    );
  }
  if (typeof left === 'object' && typeof right === 'object') {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].every((key) => equal(left[key], right[key]));
  }
  return false;
}

function mergeNode(base, server, local, path, conflicts) {
  if (equal(local, base)) return structuredClone(server);
  if (equal(server, base)) return structuredClone(local);
  if (equal(server, local)) return structuredClone(server);

  const canRecurse =
    base &&
    server &&
    local &&
    !Array.isArray(base) &&
    !Array.isArray(server) &&
    !Array.isArray(local) &&
    typeof base === 'object' &&
    typeof server === 'object' &&
    typeof local === 'object';
  if (!canRecurse) {
    conflicts.push(path);
    return structuredClone(server);
  }
  const result = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(server), ...Object.keys(local)]);
  keys.forEach((key) => {
    if (SERVER_METADATA.has(key)) {
      result[key] = structuredClone(server[key]);
      return;
    }
    const childPath = path ? `${path}.${key}` : key;
    const value = mergeNode(base[key], server[key], local[key], childPath, conflicts);
    if (value !== undefined) result[key] = value;
  });
  return result;
}

export function threeWayMerge(baseRecord, serverRecord, attemptedRecord) {
  if (!serverRecord && attemptedRecord) {
    return {
      mergedRecord: null,
      conflictingFields: ['deletedAt'],
      conflictType: 'update_delete',
    };
  }
  if (serverRecord && !attemptedRecord) {
    const serverChanged = !equal(
      Object.fromEntries(
        Object.entries(serverRecord).filter(([key]) => !SERVER_METADATA.has(key))
      ),
      Object.fromEntries(
        Object.entries(baseRecord || {}).filter(([key]) => !SERVER_METADATA.has(key))
      )
    );
    return {
      mergedRecord: serverChanged ? serverRecord : null,
      conflictingFields: serverChanged ? ['deletedAt'] : [],
      conflictType: serverChanged ? 'update_delete' : null,
    };
  }
  const conflictingFields = [];
  const mergedRecord = mergeNode(
    baseRecord || {},
    serverRecord || {},
    attemptedRecord || {},
    '',
    conflictingFields
  );
  return {
    mergedRecord,
    conflictingFields,
    conflictType: conflictingFields.length ? 'field_conflict' : null,
  };
}
