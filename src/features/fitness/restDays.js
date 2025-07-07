/**
 * Unified rest-day store (Phase 5) – uses appData.restDays so it's persisted with
 * the main state JSON/IndexedDB and included in export/import flows.
 */

import { appData, mutate } from '../../core/state.js';

// Legacy migration: pull old array from localStorage once and then delete it.
const LEGACY_KEY = 'fitnessRestDays';
try {
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy && typeof legacy === 'string') {
    const arr = JSON.parse(legacy);
    if (Array.isArray(arr)) {
      mutate((s) => {
        if (!s.restDays) s.restDays = {};
        arr.forEach((k) => {
          s.restDays[k] = true;
        });
      });
    }
    localStorage.removeItem(LEGACY_KEY);
  }
} catch {
  /* ignore corrupt legacy data */
}

/*********** API ***********/

export function isRestDay(iso) {
  return !!appData.restDays?.[iso];
}

export function toggleRestDay(iso) {
  mutate((s) => {
    if (!s.restDays) s.restDays = {};
    if (s.restDays[iso]) delete s.restDays[iso];
    else s.restDays[iso] = true;
  });
}
