import { checksum } from './canonical.js';
import { meaningfulLegacySnapshot } from './normalizeLegacy.js';

const LEGACY_KEYS = {
  snapshot: 'healthyHabitsData',
  theme: 'theme',
  homeSectionVisibility: 'homeSectionVisibility',
  activeTab: 'activeHabitTrackerTab',
  fitnessMarker: 'habitsAppFitnessMigrationV1',
  restDays: 'fitnessRestDays',
};

function parseJson(raw) {
  if (raw == null) return { value: null, error: null };
  try {
    return { value: JSON.parse(raw), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

export function readLegacyLocalStorage(storage = localStorage) {
  const raw = storage.getItem(LEGACY_KEYS.snapshot);
  const parsed = parseJson(raw);
  const visibilityRaw = storage.getItem(LEGACY_KEYS.homeSectionVisibility);
  const restDaysRaw = storage.getItem(LEGACY_KEYS.restDays);
  return {
    location: 'localStorage/healthyHabitsData',
    raw,
    snapshot:
      parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)
        ? parsed.value
        : null,
    parseError: parsed.error,
    sideKeys: {
      theme: storage.getItem(LEGACY_KEYS.theme),
      homeSectionVisibility: parseJson(visibilityRaw).value,
      activeHabitTrackerTab: storage.getItem(LEGACY_KEYS.activeTab),
      fitnessMigrationMarker: storage.getItem(LEGACY_KEYS.fitnessMarker),
      fitnessRestDays: parseJson(restDaysRaw).value,
    },
  };
}

export function readLegacyIndexedDb(factory = indexedDB) {
  return new Promise((resolve) => {
    const request = factory.open('healthyHabitsDB', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('state')) {
        request.result.createObjectStore('state');
      }
    };
    request.onerror = () =>
      resolve({
        location: 'healthyHabitsDB/state/appData',
        raw: null,
        snapshot: null,
        parseError: request.error?.message || 'IndexedDB could not be opened',
      });
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('state', 'readonly');
      const getRequest = transaction.objectStore('state').get('appData');
      getRequest.onsuccess = () => {
        const value = getRequest.result;
        db.close();
        resolve({
          location: 'healthyHabitsDB/state/appData',
          raw: value,
          snapshot: value && typeof value === 'object' && !Array.isArray(value) ? value : null,
          parseError:
            value == null || (typeof value === 'object' && !Array.isArray(value))
              ? null
              : 'IndexedDB appData is not an object',
        });
      };
      getRequest.onerror = () => {
        db.close();
        resolve({
          location: 'healthyHabitsDB/state/appData',
          raw: null,
          snapshot: null,
          parseError: getRequest.error?.message || 'IndexedDB appData could not be read',
        });
      };
    };
  });
}

export async function readLegacySources({ storage = localStorage, factory = indexedDB } = {}) {
  const local = readLegacyLocalStorage(storage);
  const indexed = await readLegacyIndexedDb(factory);
  return { local, indexed };
}

export function selectLegacyDefault(sources) {
  if (sources.indexed?.snapshot) return { selected: 'indexed', snapshot: sources.indexed.snapshot };
  if (sources.local?.snapshot) return { selected: 'local', snapshot: sources.local.snapshot };
  return { selected: 'none', snapshot: null };
}

export function summarizeLegacySources(sources) {
  function summary(source) {
    const snapshot = source?.snapshot;
    return {
      location: source?.location,
      readable: Boolean(snapshot),
      parseError: source?.parseError || null,
      fingerprint: snapshot ? checksum(meaningfulLegacySnapshot(snapshot)) : null,
      counts: snapshot
        ? {
            categories: snapshot.categories?.length || 0,
            habits: snapshot.habits?.length || 0,
            holidayPeriods: snapshot.holidayPeriods?.length || 0,
            activities: snapshot.activities?.length || 0,
            activityRecords: Object.values(snapshot.recordedActivities || {}).reduce(
              (total, records) => total + (Array.isArray(records) ? records.length : 0),
              0
            ),
          }
        : null,
    };
  }
  return { local: summary(sources.local), indexed: summary(sources.indexed) };
}
