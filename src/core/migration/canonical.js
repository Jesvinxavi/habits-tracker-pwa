export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return Number.isNaN(value) ? null : value;
}

export function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

// Deterministic, portable 64-bit FNV-1a. This is an integrity checksum, not a
// password or authenticity primitive.
export function checksum(value) {
  const input = typeof value === 'string' ? value : canonicalStringify(value);
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}
