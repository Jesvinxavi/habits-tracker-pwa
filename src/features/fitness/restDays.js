/**
 * Unified rest-day store (Phase 5) – uses appData.restDays so it's persisted with
 * the main state JSON/IndexedDB and included in export/import flows.
 */

import { getState, dispatch, Actions } from '../../core/state.js';


const LEGACY_KEY = 'fitnessRestDays';
try {
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy && typeof legacy === 'string') {
    const arr = JSON.parse(legacy);
    if (Array.isArray(arr)) {
      dispatch((dispatch, getState) => {
        const state = getState();
        const restDays = { ...state.restDays };
        arr.forEach((k) => {
          restDays[k] = true;
        });
        dispatch(Actions.importData({ restDays }));
      });
    }
    localStorage.removeItem(LEGACY_KEY);
  }
} catch {
  /* ignore corrupt legacy data */
}

/*********** API ***********/

export function isRestDay(iso) {
  return !!getState().restDays?.[iso];
}

export function toggleRestDay(iso) {
  dispatch((dispatch, getState) => {
    const state = getState();
    const restDays = { ...state.restDays };
    if (restDays[iso]) delete restDays[iso];
    else restDays[iso] = true;
    dispatch(Actions.importData({ restDays }));
  });
}
