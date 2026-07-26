import { canonicalStringify, checksum } from './canonical.js';

const TABLES = [
  'userPreferences',
  'habitCategories',
  'habits',
  'habitEntries',
  'holidayPeriods',
  'holidaySingles',
  'activityCategories',
  'activities',
  'activityRecords',
  'routines',
  'programs',
  'restDays',
  'legacyData',
];

function recordKey(record, index) {
  return String(record.clientId || `singleton:${index}`);
}

function mergeHabitEntry(cloud, local, conflicts) {
  const merged = { ...cloud };
  for (const field of ['completed', 'progress', 'skipped']) {
    const empty = field === 'progress' ? 0 : false;
    if (cloud[field] === local[field]) continue;
    if (cloud[field] === empty) merged[field] = local[field];
    else if (local[field] !== empty) {
      conflicts.push({
        table: 'habitEntries',
        clientId: cloud.clientId,
        field,
        cloudValue: cloud[field],
        localValue: local[field],
        defaultResolution: 'cloud',
      });
    }
  }
  return merged;
}

export function mergeNormalizedTables(cloudTables, localTables) {
  const conflicts = [];
  const tables = {};
  for (const table of TABLES) {
    const cloudRecords = cloudTables[table] || [];
    const localRecords = localTables[table] || [];
    const merged = new Map(
      cloudRecords.map((record, index) => [recordKey(record, index), record])
    );
    localRecords.forEach((local, index) => {
      const key = recordKey(local, index);
      const cloud = merged.get(key);
      if (!cloud) {
        merged.set(key, local);
      } else if (canonicalStringify(cloud) !== canonicalStringify(local)) {
        if (table === 'habitEntries') {
          merged.set(key, mergeHabitEntry(cloud, local, conflicts));
        } else {
          conflicts.push({
            table,
            clientId: key,
            cloudRecord: cloud,
            localRecord: local,
            defaultResolution: 'cloud',
          });
        }
      }
    });
    tables[table] = [...merged.values()];
  }
  const counts = Object.fromEntries(
    TABLES.map((table) => [table, tables[table].length])
  );
  const checksums = Object.fromEntries(
    TABLES.map((table) => [
      table,
      checksum(
        [...tables[table]].sort((left, right) =>
          String(left.clientId || '').localeCompare(String(right.clientId || ''))
        )
      ),
    ])
  );
  return { tables, counts, checksums, conflicts, warnings: conflicts };
}
