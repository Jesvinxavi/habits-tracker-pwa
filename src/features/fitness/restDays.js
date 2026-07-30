import { getState, dispatch, Actions } from '../../core/state.js';

/*********** API ***********/

export function isRestDay(iso) {
  return !!getState().restDays?.[iso];
}

export async function toggleRestDay(iso) {
  return dispatch(Actions.setRestDay(iso, !isRestDay(iso)));
}
