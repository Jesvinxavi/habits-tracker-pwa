function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result: Record<string, any>, key) => {
        if (value[key] !== undefined) result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return Number.isNaN(value) ? null : value;
}

export function checksum(value: any) {
  const input = JSON.stringify(canonicalize(value));
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function portableMigrationRecord(record: any) {
  const {
    _id,
    _creationTime,
    ownerKey,
    generation,
    updatedAt,
    updatedByDeviceId,
    deletedAt,
    ...portable
  } = record;
  return portable;
}

export function tableChecksum(records: any[]) {
  return checksum(
    records
      .map(portableMigrationRecord)
      .sort((left, right) =>
        String(left.clientId || "").localeCompare(String(right.clientId || "")),
      ),
  );
}
