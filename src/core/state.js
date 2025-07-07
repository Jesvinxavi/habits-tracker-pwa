// Enhanced State Management System with Immutable Updates and Actions

import { deepClone } from '../shared/common.js';

// Helper to get local date without timezone issues
function getLocalDateISO() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
}

// Initial state structure
const initialState = {
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
  restDays: {}, // Map dateKey (YYYY-MM-DD) -> true
};

// Application state - mutable for backward compatibility
export const appData = deepClone(initialState);

// For quick dev inspection in DevTools.
if (typeof window !== 'undefined') {
  window.appData = appData;
}

// Observer pattern for state changes
export const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => fn(appData));
}

// Action Types - Centralized action constants
export const ActionTypes = {
  // Habit actions
  ADD_HABIT: 'ADD_HABIT',
  UPDATE_HABIT: 'UPDATE_HABIT',
  DELETE_HABIT: 'DELETE_HABIT',
  TOGGLE_HABIT_COMPLETED: 'TOGGLE_HABIT_COMPLETED',
  SET_HABIT_PROGRESS: 'SET_HABIT_PROGRESS',
  SKIP_HABIT: 'SKIP_HABIT',
  REORDER_HABITS: 'REORDER_HABITS',

  // Category actions
  ADD_CATEGORY: 'ADD_CATEGORY',
  UPDATE_CATEGORY: 'UPDATE_CATEGORY',
  DELETE_CATEGORY: 'DELETE_CATEGORY',

  // Date/Navigation actions
  SET_SELECTED_DATE: 'SET_SELECTED_DATE',
  SET_SELECTED_GROUP: 'SET_SELECTED_GROUP',
  SET_FITNESS_SELECTED_DATE: 'SET_FITNESS_SELECTED_DATE',

  // Holiday actions
  ADD_HOLIDAY_PERIOD: 'ADD_HOLIDAY_PERIOD',
  DELETE_HOLIDAY_PERIOD: 'DELETE_HOLIDAY_PERIOD',
  TOGGLE_SINGLE_HOLIDAY: 'TOGGLE_SINGLE_HOLIDAY',
  SET_HOLIDAY_DATES: 'SET_HOLIDAY_DATES',

  // Activity actions
  ADD_ACTIVITY: 'ADD_ACTIVITY',
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  DELETE_ACTIVITY: 'DELETE_ACTIVITY',
  RECORD_ACTIVITY: 'RECORD_ACTIVITY',

  // Settings actions
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  TOGGLE_DARK_MODE: 'TOGGLE_DARK_MODE',

  // Bulk actions
  RESET_STATE: 'RESET_STATE',
  IMPORT_DATA: 'IMPORT_DATA',
};

// Action Creators - Functions that create action objects
export const Actions = {
  addHabit: (habit) => ({ type: ActionTypes.ADD_HABIT, payload: habit }),
  updateHabit: (habitId, updates) => ({
    type: ActionTypes.UPDATE_HABIT,
    payload: { habitId, updates },
  }),
  deleteHabit: (habitId) => ({ type: ActionTypes.DELETE_HABIT, payload: habitId }),
  toggleHabitCompleted: (habitId, date) => ({
    type: ActionTypes.TOGGLE_HABIT_COMPLETED,
    payload: { habitId, date },
  }),
  setHabitProgress: (habitId, date, progress) => ({
    type: ActionTypes.SET_HABIT_PROGRESS,
    payload: { habitId, date, progress },
  }),

  addCategory: (category) => ({ type: ActionTypes.ADD_CATEGORY, payload: category }),
  updateCategory: (categoryId, updates) => ({
    type: ActionTypes.UPDATE_CATEGORY,
    payload: { categoryId, updates },
  }),
  deleteCategory: (categoryId) => ({ type: ActionTypes.DELETE_CATEGORY, payload: categoryId }),

  setSelectedDate: (date) => ({ type: ActionTypes.SET_SELECTED_DATE, payload: date }),
  setSelectedGroup: (group) => ({ type: ActionTypes.SET_SELECTED_GROUP, payload: group }),

  updateSettings: (settings) => ({ type: ActionTypes.UPDATE_SETTINGS, payload: settings }),
  toggleDarkMode: () => ({ type: ActionTypes.TOGGLE_DARK_MODE }),
};

// Enhanced dispatch function with immutable updates
export function dispatch(action) {
  if (typeof action === 'function') {
    // Support for thunk-style actions
    return action(dispatch, () => appData);
  }

  const prevState = deepClone(appData);

  try {
    // Apply the action to create new state
    const newState = reducer(prevState, action);

    // Update appData with new state
    Object.assign(appData, newState);

    // Notify listeners
    notify();
  } catch (error) {
    console.error('Error dispatching action:', action, error);
    // Restore previous state on error
    Object.assign(appData, prevState);
  }
}

// Reducer function - Pure function that handles state updates
function reducer(state, action) {
  switch (action.type) {
    case ActionTypes.ADD_HABIT:
      return {
        ...state,
        habits: [...state.habits, action.payload],
      };

    case ActionTypes.UPDATE_HABIT:
      return {
        ...state,
        habits: state.habits.map((habit) =>
          habit.id === action.payload.habitId ? { ...habit, ...action.payload.updates } : habit
        ),
      };

    case ActionTypes.DELETE_HABIT:
      return {
        ...state,
        habits: state.habits.filter((habit) => habit.id !== action.payload),
      };

    case ActionTypes.SET_HABIT_PROGRESS:
      return {
        ...state,
        habits: state.habits.map((habit) =>
          habit.id === action.payload.habitId
            ? {
                ...habit,
                progress: {
                  ...habit.progress,
                  [action.payload.date]: action.payload.progress,
                },
              }
            : habit
        ),
      };

    case ActionTypes.ADD_CATEGORY:
      return {
        ...state,
        categories: [...state.categories, action.payload],
      };

    case ActionTypes.UPDATE_CATEGORY:
      return {
        ...state,
        categories: state.categories.map((category) =>
          category.id === action.payload.categoryId
            ? { ...category, ...action.payload.updates }
            : category
        ),
      };

    case ActionTypes.DELETE_CATEGORY:
      return {
        ...state,
        categories: state.categories.filter((category) => category.id !== action.payload),
      };

    case ActionTypes.SET_SELECTED_DATE:
      return {
        ...state,
        selectedDate: action.payload,
      };

    case ActionTypes.SET_SELECTED_GROUP:
      return {
        ...state,
        selectedGroup: action.payload,
      };

    case ActionTypes.SET_FITNESS_SELECTED_DATE:
      return {
        ...state,
        fitnessSelectedDate: action.payload,
      };

    case ActionTypes.SET_HOLIDAY_DATES:
      return {
        ...state,
        holidayDates: [...action.payload],
      };

    case ActionTypes.ADD_HOLIDAY_PERIOD:
      return {
        ...state,
        holidayPeriods: [...state.holidayPeriods, action.payload],
      };

    case ActionTypes.DELETE_HOLIDAY_PERIOD:
      return {
        ...state,
        holidayPeriods: state.holidayPeriods.filter((period) => period.id !== action.payload),
      };

    case ActionTypes.UPDATE_SETTINGS:
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };

    case ActionTypes.TOGGLE_DARK_MODE:
      return {
        ...state,
        settings: { ...state.settings, darkMode: !state.settings.darkMode },
      };

    case ActionTypes.IMPORT_DATA:
      return { ...state, ...action.payload };

    case ActionTypes.RESET_STATE:
      return deepClone(initialState);

    default:
      return state;
  }
}

// Selectors - Functions to compute derived state
export const Selectors = {
  // Habit selectors
  getHabits: (state = appData) => state.habits,
  getHabitById: (state = appData, habitId) => state.habits.find((h) => h.id === habitId),
  getHabitsByCategory: (state = appData, categoryId) =>
    state.habits.filter((h) => h.category === categoryId),
  getActiveHabits: (state = appData) => state.habits.filter((h) => !h.paused),
  getCompletedHabitsForDate: (state = appData, date) =>
    state.habits.filter((h) => h.completedDates?.includes(date)),

  // Category selectors
  getCategories: (state = appData) => state.categories,
  getCategoryById: (state = appData, categoryId) =>
    state.categories.find((c) => c.id === categoryId),
  getCategoriesWithHabits: (state = appData) =>
    state.categories.filter((c) => state.habits.some((h) => h.category === c.id)),

  // Date selectors
  getSelectedDate: (state = appData) => state.selectedDate,
  getSelectedGroup: (state = appData) => state.selectedGroup,
  getFitnessSelectedDate: (state = appData) => state.fitnessSelectedDate,

  // Holiday selectors
  getHolidayDates: (state = appData) => state.holidayDates,
  getHolidayPeriods: (state = appData) => state.holidayPeriods,
  isHolidayDate: (state = appData, date) => state.holidayDates.includes(date),

  // Settings selectors
  getSettings: (state = appData) => state.settings,
  isDarkMode: (state = appData) => state.settings.darkMode,
  shouldHideCompleted: (state = appData) => state.settings.hideCompleted,
  shouldHideSkipped: (state = appData) => state.settings.hideSkipped,

  // Activity selectors
  getActivities: (state = appData) => state.activities,
  getActivityCategories: (state = appData) => state.activityCategories,
  getRecordedActivities: (state = appData) => state.recordedActivities,
  getRecordedActivitiesForDate: (state = appData, date) => state.recordedActivities[date] || [],
};

// Legacy mutate function for backward compatibility
export function mutate(mutator) {
  const prevState = deepClone(appData);
  try {
    mutator(appData);
    notify();
  } catch (error) {
    console.error('Error in mutate function:', error);
    // Restore previous state on error
    Object.assign(appData, prevState);
  }
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

// Export enhanced state management utilities
export { initialState, reducer };
