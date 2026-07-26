import { canonicalStringify } from './canonical.js';

const DEVICE_FIELDS = new Set([
  'currentDate',
  'selectedDate',
  'fitnessSelectedDate',
  'selectedGroup',
  'activeTab',
]);

function mergeById(local = [], indexed = [], entityType, conflicts) {
  const result = new Map();
  local.forEach((record, index) => {
    result.set(String(record.id || record.clientId || `${entityType}:local:${index}`), record);
  });
  indexed.forEach((record, index) => {
    const id = String(record.id || record.clientId || `${entityType}:indexed:${index}`);
    const existing = result.get(id);
    if (existing && canonicalStringify(existing) !== canonicalStringify(record)) {
      conflicts.push({
        code: 'legacy_same_id_conflict',
        entityType,
        clientId: id,
        localRecord: existing,
        indexedRecord: record,
        defaultResolution: 'indexed',
      });
    }
    result.set(id, { ...(existing || {}), ...record });
  });
  return [...result.values()];
}

function mergeRecorded(local = {}, indexed = {}, conflicts) {
  const dates = new Set([...Object.keys(local), ...Object.keys(indexed)]);
  return Object.fromEntries(
    [...dates].map((date) => [
      date,
      mergeById(local[date] || [], indexed[date] || [], 'activityRecords', conflicts),
    ])
  );
}

export function mergeLegacySnapshots(localSnapshot, indexedSnapshot) {
  if (!localSnapshot) return { snapshot: indexedSnapshot, conflicts: [] };
  if (!indexedSnapshot) return { snapshot: localSnapshot, conflicts: [] };
  const conflicts = [];
  const snapshot = { ...localSnapshot, ...indexedSnapshot };
  DEVICE_FIELDS.forEach((field) => {
    if (localSnapshot[field] !== undefined) snapshot[field] = localSnapshot[field];
  });
  snapshot.categories = mergeById(
    localSnapshot.categories,
    indexedSnapshot.categories,
    'habitCategories',
    conflicts
  );
  snapshot.habits = mergeById(
    localSnapshot.habits,
    indexedSnapshot.habits,
    'habits',
    conflicts
  );
  snapshot.holidayPeriods = mergeById(
    localSnapshot.holidayPeriods,
    indexedSnapshot.holidayPeriods,
    'holidayPeriods',
    conflicts
  );
  snapshot.holidayDates = [
    ...new Set([...(localSnapshot.holidayDates || []), ...(indexedSnapshot.holidayDates || [])]),
  ];
  snapshot.activityCategories = mergeById(
    localSnapshot.activityCategories,
    indexedSnapshot.activityCategories,
    'activityCategories',
    conflicts
  );
  snapshot.activities = mergeById(
    localSnapshot.activities,
    indexedSnapshot.activities,
    'activities',
    conflicts
  );
  snapshot.recordedActivities = mergeRecorded(
    localSnapshot.recordedActivities,
    indexedSnapshot.recordedActivities,
    conflicts
  );
  snapshot.restDays = {
    ...(localSnapshot.restDays || {}),
    ...(indexedSnapshot.restDays || {}),
  };
  snapshot.settings = {
    ...(localSnapshot.settings || {}),
    ...(indexedSnapshot.settings || {}),
  };
  return { snapshot, conflicts };
}
