const REST_DAYS_KEY = 'fitnessRestDays';

function getRestDays() {
  try {
    const data = localStorage.getItem(REST_DAYS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveRestDays(days) {
  localStorage.setItem(REST_DAYS_KEY, JSON.stringify(days));
}

/**
 * Checks if the given ISO date is a rest day.
 * @param {string} iso - ISO date string
 * @returns {boolean}
 */
export function isRestDay(iso) {
  const days = getRestDays();
  return days.includes(iso);
}

/**
 * Toggles the rest day status for the given ISO date.
 * @param {string} iso - ISO date string
 */
export function toggleRestDay(iso) {
  const days = getRestDays();
  const idx = days.indexOf(iso);
  if (idx === -1) {
    days.push(iso);
  } else {
    days.splice(idx, 1);
  }
  saveRestDays(days);
}
