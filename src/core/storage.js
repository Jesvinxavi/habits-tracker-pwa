import { appData, subscribe, notify } from './state.js';
import { ensureHolidayIntegrity } from './state.js';
import { debounce, safeJsonParse, safeJsonStringify } from '../utils/common.js';

const STORAGE_KEY = 'healthyHabitsData';

/**
 * Check if localStorage is both available and writable.
 * Some browser contexts (Safari private mode, older IE, etc.) throw or silently
 * fail when touching localStorage. We fall back to in-memory storage in that case.
 */
function isLocalStorageAvailable() {
  try {
    if (typeof localStorage === 'undefined') return false;
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch (_) {
    return false;
  }
}

// Fallback polyfill when localStorage is unavailable (rare desktop/private tabs).
const memoryStorage = (() => {
  let _store = {};
  return {
    getItem: (k) => _store[k] ?? null,
    setItem: (k, v) => {
      _store[k] = v;
    },
    removeItem: (k) => {
      delete _store[k];
    },
  };
})();

const storageBackend = isLocalStorageAvailable() ? localStorage : memoryStorage;

// Debounce helper moved to utils/common.js for centralization

// ----------------------------- Migration helpers -----------------------------
function migrateDataIfNeeded(data) {
  return data;
}

// ----------------------- IndexedDB fallback ---------------------------------
const IDB_DB_NAME = 'healthyHabitsDB';
const IDB_STORE = 'state';
let _idbPromise = null;
function openIDB() {
  if (_idbPromise) return _idbPromise;
  _idbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null); // fall back silently
  });
  return _idbPromise;
}
async function idbGet(key) {
  const db = await openIDB();
  if (!db) return null;
  return new Promise((res) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const getReq = store.get(key);
    getReq.onsuccess = () => res(getReq.result || null);
    getReq.onerror = () => res(null);
  });
}
async function idbSet(key, val) {
  const db = await openIDB();
  if (!db) return;
  return new Promise((res) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}
// ---------------------------------------------------------------------------

// Flag indicating whether the initial load from storage has completed.
let _hasLoaded = false;

export function loadDataFromLocalStorage() {
  return new Promise((resolve) => {
    const storedRaw = storageBackend.getItem(STORAGE_KEY);

    if (storedRaw) {
      try {
        const parsedData = migrateDataIfNeeded(safeJsonParse(storedRaw, {}));

        Object.assign(appData, parsedData);

        // Preserve theme setting - don't let storage override it
        const currentTheme = appData.settings.darkMode;
        appData.settings.darkMode = currentTheme;

        // Always reset date fields to today on startup so the calendar defaults to current date
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset to local midnight to avoid timezone issues
        // Use local date format to avoid timezone issues
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const localTodayIso = `${year}-${month}-${day}T00:00:00.000Z`;
        appData.selectedDate = localTodayIso;
        if (appData.currentDate) {
          appData.currentDate = localTodayIso;
        }
        appData.fitnessSelectedDate = localTodayIso;
        // Always default to Daily group on startup for consistency
        appData.selectedGroup = 'daily';
        ensureHolidayIntegrity(appData);

        // After state is populated, rebuild holiday caches so manualSingles matches stored dates.
        import('../utils/holidays.js').then((m) => m.initializeHolidays());
      } catch (error) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.error('[storage] Error parsing stored data:', error);
        }
      }
    } else {
      // No stored data; still ensure holiday utilities have correct caches (empty but synced)
      import('../utils/holidays.js').then((m) => m.initializeHolidays());
    }
    // Mark load complete so subsequent state changes are persisted
    _hasLoaded = true;

    // Attempt to upgrade from IndexedDB if present (async, non-blocking)
    idbGet('appData')
      .then((data) => {
        if (data && typeof data === 'object') {
          Object.assign(appData, data);

          // Preserve theme setting - don't let IndexedDB override it
          const currentTheme = appData.settings.darkMode;
          appData.settings.darkMode = currentTheme;

          // Apply the same date corrections as above to prevent timezone issues
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Reset to local midnight to avoid timezone issues
          // Use local date format to avoid timezone issues
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const localTodayIso = `${year}-${month}-${day}T00:00:00.000Z`;
          appData.selectedDate = localTodayIso;
          if (appData.currentDate) {
            appData.currentDate = localTodayIso;
          }
          appData.fitnessSelectedDate = localTodayIso;
          // Always default to Daily group on startup for consistency
          appData.selectedGroup = 'daily';

          notify();
        }
        resolve(); // Resolve after IndexedDB check completes
      })
      .catch((error) => {
        resolve(); // Resolve even if IndexedDB fails
      });
  });
}

function rawSave() {
  try {
    const payload = safeJsonStringify(appData, '{}');
    storageBackend.setItem(STORAGE_KEY, payload);
    idbSet('appData', appData);
  } catch (error) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.error('[storage] Error saving data to localStorage:', error);
    }
  }
}

// Debounced saver to avoid excessive writes on rapid state changes.
const saveDataToLocalStorage = debounce(() => {
  if (!_hasLoaded) return; // Skip writes until initial load finished
  rawSave();
}, 250);

export { saveDataToLocalStorage }; // Expose for manual save calls if needed

// Auto-save on each state change
subscribe(saveDataToLocalStorage);

// ---------------------- Cross-tab synchronisation ----------------------------
// When a different browser tab writes to localStorage, update the current tab.
if (typeof window !== 'undefined' && isLocalStorageAvailable()) {
  window.addEventListener('storage', (evt) => {
    if (evt.key === STORAGE_KEY && evt.newValue && _hasLoaded) {
      try {
        Object.assign(appData, migrateDataIfNeeded(JSON.parse(evt.newValue)));
        notify(); // Inform listeners of state update originating from another tab
      } catch (e) {
        // ignore corrupt cross-tab payloads
      }
    }
  });
}

// -------------------------- Export / Import utils ----------------------------
export function exportAppData() {
  return JSON.stringify(appData, null, 2);
}

/**
 * Load app data from a JSON string (e.g. user paste).  Completely replaces
 * existing appData and triggers save.
 */
export function importAppData(jsonString) {
  try {
    Object.assign(appData, migrateDataIfNeeded(JSON.parse(jsonString)));
    ensureHolidayIntegrity(appData);
    saveDataToLocalStorage();
    return true;
  } catch (e) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.error('[storage] Failed to import data:', e);
    }
    return false;
  }
}
