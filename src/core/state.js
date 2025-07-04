// Helper to get local date without timezone issues
function getLocalDateISO() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

export const appData = {
  categories: [],
  habits: [],
  currentDate: getLocalDateISO(),
  selectedDate: getLocalDateISO(),
  fitnessSelectedDate: getLocalDateISO(),
  selectedGroup: 'daily',
  holidayDates: [],
  holidayPeriods: [],
  settings: {
    darkMode: false,
    hideCompleted: false,
    hideSkipped: false,
    holidayMode: false,
  },
  foodLog: [],
  stats: {},
  // Fitness activities data
  activities: [],
  activityCategories: [
    { id: 'cardio', name: 'Cardio', color: '#EF4444', icon: '🏃‍♂️' },
    { id: 'strength', name: 'Strength Training', color: '#2563EB', icon: '💪' },
    { id: 'stretching', name: 'Stretching', color: '#22C55E', icon: '🧘‍♀️' },
    { id: 'sports', name: 'Sports', color: '#F97316', icon: '⚽' },
    { id: 'other', name: 'Other', color: '#EAB308', icon: '🎯' },
  ],
  recordedActivities: {}, // Map of date -> array of activity records
};

// For quick dev inspection in DevTools.
if (typeof window !== 'undefined') {
  window.appData = appData;
}

export const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => fn(appData));
}

export function mutate(mutator) {
  mutator(appData);
  notify();
}

// --- Integrity helper ---
// Ensures that when data is loaded (or a habit is added) it contains
// the new fields used by the Home-screen target mechanic.
export function ensureHabitIntegrity(habit) {
  if (!habit) return;
  if (typeof habit.progress !== 'object' || habit.progress === null) {
    habit.progress = {}; // map of isoDate -> number
  }
  if (!Array.isArray(habit.skippedDates)) {
    habit.skippedDates = []; // array of isoDate strings
  }
}

// Patch existing habits right away (in case data was loaded before introduce)
appData.habits.forEach(ensureHabitIntegrity);

export function ensureHolidayIntegrity(state = appData) {
  if (!Array.isArray(state.holidayDates)) state.holidayDates = [];
  if (!Array.isArray(state.holidayPeriods)) state.holidayPeriods = [];
}

// Ensure defaults exist immediately
ensureHolidayIntegrity(appData);
