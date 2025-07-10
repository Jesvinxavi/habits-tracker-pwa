import { getState, subscribe, dispatch, Actions } from './state.js';
import { debounce, safeJsonParse, safeJsonStringify } from '../shared/common.js';
import { getLocalMidnightISOString } from '../shared/datetime.js';

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
        const parsedData = safeJsonParse(storedRaw, {});

        // Use dispatch to import data
        dispatch(Actions.importData(parsedData));

        // Always reset date fields to today on startup so the calendar defaults to current date
        const today = new Date();
        const localTodayIso = getLocalMidnightISOString(today);
        dispatch(Actions.setSelectedDate(localTodayIso));
        dispatch(Actions.setFitnessSelectedDate(localTodayIso));
        dispatch(Actions.setSelectedGroup('daily'));

        // After state is populated, rebuild holiday caches so manualSingles matches stored dates.
      } catch (error) {
        console.error('[storage] Error parsing stored data:', error);
      }
    } else {
      // No stored data; still ensure holiday utilities have correct caches (empty but synced)
    }
    // Mark load complete so subsequent state changes are persisted
    _hasLoaded = true;

    // Attempt to upgrade from IndexedDB if present (async, non-blocking)
    idbGet('appData')
      .then((data) => {
        if (data && typeof data === 'object') {
          dispatch(Actions.importData(data));

          // Apply the same date corrections as above to prevent timezone issues
          const today = new Date();
          const localTodayIso = getLocalMidnightISOString(today);
          dispatch(Actions.setSelectedDate(localTodayIso));
          dispatch(Actions.setFitnessSelectedDate(localTodayIso));
          dispatch(Actions.setSelectedGroup('daily'));
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
    const payload = safeJsonStringify(getState(), '{}');
    storageBackend.setItem(STORAGE_KEY, payload);
    idbSet('appData', getState());
  } catch (error) {
    console.error('[storage] Error saving data to localStorage:', error);
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
        dispatch(Actions.importData(JSON.parse(evt.newValue)));
      } catch (e) {
        // ignore corrupt cross-tab payloads
      }
    }
  });
}

// -------------------------- Export / Import utils ----------------------------
export function exportAppData() {
  return JSON.stringify(getState(), null, 2);
}

/**
 * Load app data from a JSON string (e.g. user paste).  Completely replaces
 * existing appData and triggers save.
 */
export function importAppData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    dispatch(Actions.importData(data));
    saveDataToLocalStorage();
    return true;
  } catch (error) {
    console.error('[storage] Error importing data:', error);
    return false;
  }
}
