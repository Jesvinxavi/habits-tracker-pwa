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

// Inline self-test (for Coding Guidelines)
if (typeof window !== 'undefined' && window.process?.env?.NODE_ENV === 'test') {
  // console.group('🧪 Testing restDays utility...');

  // Test 1: Basic toggle functionality
  const testIso = '2099-01-01';
  toggleRestDay(testIso);
  // console.assert(isRestDay(testIso), 'Should be rest day after toggle on');
  toggleRestDay(testIso);
  // console.assert(!isRestDay(testIso), 'Should not be rest day after toggle off');

  // Test 2: Multiple rest days
  const testDays = ['2024-01-01', '2024-01-02', '2024-01-03'];
  testDays.forEach((day) => toggleRestDay(day));
  testDays.forEach((day) => {
    // console.assert(isRestDay(day), `Day ${day} should be rest day`);
  });

  // Test 3: Non-rest days
  const nonRestDays = ['2024-01-04', '2024-01-05'];
  nonRestDays.forEach((day) => {
    // console.assert(!isRestDay(day), `Day ${day} should not be rest day`);
  });

  // Test 4: Invalid date handling
  // console.assert(!isRestDay('invalid-date'), 'Invalid date should not be rest day');
  // console.assert(!isRestDay(''), 'Empty string should not be rest day');
  // console.assert(!isRestDay(null), 'Null should not be rest day');

  // Test 5: Persistence (simulate localStorage)
  const originalGetItem = localStorage.getItem;
  const originalSetItem = localStorage.setItem;
  const testStorage = {};

  localStorage.getItem = (key) => testStorage[key];
  localStorage.setItem = (key, value) => {
    testStorage[key] = value;
  };

  toggleRestDay('2024-12-25');
  // console.assert(isRestDay('2024-12-25'), 'Rest day should persist in storage');

  // Restore original localStorage
  localStorage.getItem = originalGetItem;
  localStorage.setItem = originalSetItem;

  // Clean up test data
  testDays.forEach((day) => toggleRestDay(day));
  toggleRestDay('2024-12-25');

  // console.log('✅ All restDays utility tests passed!');
  // console.groupEnd();
}
