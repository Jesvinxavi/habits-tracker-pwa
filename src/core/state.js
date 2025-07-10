// Enhanced State Management System with Immutable Updates and Actions

import { deepClone, generateUniqueId } from '../shared/common.js';
import { getLocalMidnightISOString } from '../shared/datetime.js';

// Helper to get local date without timezone issues
function getLocalDateISO() {
  const today = new Date();
  return getLocalMidnightISOString(today);
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

// Application state - private for immutability
const _appData = deepClone(initialState);

// For quick dev inspection in DevTools.
if (typeof window !== 'undefined') {
  window.appData = _appData;
}

// Public immutable state access
export function getState() {
  return deepClone(_appData);
}

// Observer pattern for state changes
export const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => fn(_appData));
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
  REORDER_CATEGORIES: 'REORDER_CATEGORIES',

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
  DELETE_ALL_HOLIDAY_PERIODS: 'DELETE_ALL_HOLIDAY_PERIODS',
  TOGGLE_SINGLE_HOLIDAY: 'TOGGLE_SINGLE_HOLIDAY',
  SET_HOLIDAY_DATES: 'SET_HOLIDAY_DATES',
  UPDATE_HOLIDAY_PERIOD: 'UPDATE_HOLIDAY_PERIOD',

  // Activity actions
  ADD_ACTIVITY: 'ADD_ACTIVITY',
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  DELETE_ACTIVITY: 'DELETE_ACTIVITY',
  RECORD_ACTIVITY: 'RECORD_ACTIVITY',
  UPDATE_ACTIVITY_CATEGORY_COLOR: 'UPDATE_ACTIVITY_CATEGORY_COLOR',

  // Settings actions
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  SET_DARK_MODE: 'SET_DARK_MODE',
  TOGGLE_DARK_MODE: 'TOGGLE_DARK_MODE',
  TOGGLE_COMPLETED: 'TOGGLE_COMPLETED',
  TOGGLE_SKIPPED: 'TOGGLE_SKIPPED',

  // Bulk actions
  RESET_STATE: 'RESET_STATE',
  IMPORT_DATA: 'IMPORT_DATA',

  // New actions
  // UPDATE_HABIT_PROGRESS: 'UPDATE_HABIT_PROGRESS',
  // UPDATE_HABIT_SKIPPED_DATES: 'UPDATE_HABIT_SKIPPED_DATES',
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
  skipHabit: (habitId, date) => ({
    type: ActionTypes.SKIP_HABIT,
    payload: { habitId, date },
  }),
  reorderHabits: (habitIds) => ({
    type: ActionTypes.REORDER_HABITS,
    payload: habitIds,
  }),
  reorderCategories: (categoryIds) => ({
    type: ActionTypes.REORDER_CATEGORIES,
    payload: categoryIds,
  }),

  addCategory: (category) => ({ type: ActionTypes.ADD_CATEGORY, payload: category }),
  updateCategory: (categoryId, updates) => ({
    type: ActionTypes.UPDATE_CATEGORY,
    payload: { categoryId, updates },
  }),
  deleteCategory: (categoryId) => ({ type: ActionTypes.DELETE_CATEGORY, payload: categoryId }),

  setSelectedDate: (date) => ({ type: ActionTypes.SET_SELECTED_DATE, payload: date }),
  setSelectedGroup: (group) => ({ type: ActionTypes.SET_SELECTED_GROUP, payload: group }),
  setFitnessSelectedDate: (date) => ({
    type: ActionTypes.SET_FITNESS_SELECTED_DATE,
    payload: date,
  }),

  addHolidayPeriod: (period) => ({
    type: ActionTypes.ADD_HOLIDAY_PERIOD,
    payload: period,
  }),
  deleteHolidayPeriod: (periodId) => ({
    type: ActionTypes.DELETE_HOLIDAY_PERIOD,
    payload: periodId,
  }),
  deleteAllHolidayPeriods: () => ({ type: ActionTypes.DELETE_ALL_HOLIDAY_PERIODS }),
  updateHolidayPeriod: (period) => ({
    type: ActionTypes.UPDATE_HOLIDAY_PERIOD,
    payload: period,
  }),
  toggleSingleHoliday: (date) => ({
    type: ActionTypes.TOGGLE_SINGLE_HOLIDAY,
    payload: date,
  }),
  setHolidayDates: (dates) => ({
    type: ActionTypes.SET_HOLIDAY_DATES,
    payload: dates,
  }),

  addActivity: (activity) => ({
    type: ActionTypes.ADD_ACTIVITY,
    payload: activity,
  }),
  updateActivity: (activityId, updates) => ({
    type: ActionTypes.UPDATE_ACTIVITY,
    payload: { activityId, updates },
  }),
  deleteActivity: (activityId) => ({
    type: ActionTypes.DELETE_ACTIVITY,
    payload: activityId,
  }),
  recordActivity: (activityId, date, data) => ({
    type: ActionTypes.RECORD_ACTIVITY,
    payload: { activityId, date, data },
  }),
  updateActivityCategoryColor: (categoryId, newColor) => ({
    type: ActionTypes.UPDATE_ACTIVITY_CATEGORY_COLOR,
    payload: { categoryId, newColor },
  }),

  updateSettings: (settings) => ({ type: ActionTypes.UPDATE_SETTINGS, payload: settings }),
  setDarkMode: (isDark) => ({ type: ActionTypes.SET_DARK_MODE, payload: isDark }),
  toggleDarkMode: () => ({ type: ActionTypes.TOGGLE_DARK_MODE }),
  toggleCompleted: () => ({ type: ActionTypes.TOGGLE_COMPLETED }),
  toggleSkipped: () => ({ type: ActionTypes.TOGGLE_SKIPPED }),

  resetState: () => ({ type: ActionTypes.RESET_STATE }),
  importData: (data) => ({ type: ActionTypes.IMPORT_DATA, payload: data }),

  // updateHabitProgress: ({ habitId, progress }) => ({
  //   type: ActionTypes.UPDATE_HABIT_PROGRESS,
  //   payload: { habitId, progress },
  // }),
  // updateHabitSkippedDates: ({ habitId, skippedDates }) => ({
  //   type: ActionTypes.UPDATE_HABIT_SKIPPED_DATES,
  //   payload: { habitId, skippedDates },
  // }),
};

// Enhanced dispatch function with immutable updates
export function dispatch(action) {
  if (typeof action === 'function') {
    // Support for thunk-style actions
    return action(dispatch, () => _appData);
  }

  const prevState = deepClone(_appData);

  try {
    // Apply the action to create new state
    const newState = reducer(prevState, action);

    // Update _appData with new state
    Object.assign(_appData, newState);

    // Notify listeners
    notify();
  } catch (error) {
    console.error('Error dispatching action:', action, error);
    // Restore previous state on error
    Object.assign(_appData, prevState);
  }
}

// Reducer function - Pure function that handles state updates
function reducer(state, action) {
  switch (action.type) {
    case ActionTypes.ADD_HABIT:
      const newHabit = action.payload;
      ensureHabitIntegrity(newHabit);
      return {
        ...state,
        habits: [...state.habits, newHabit],
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

    case ActionTypes.TOGGLE_HABIT_COMPLETED:
      return {
        ...state,
        habits: state.habits.map((habit) => {
          if (habit.id !== action.payload.habitId) return habit;

          const dateKey = action.payload.date; // Expect ISO date string (YYYY-MM-DD)

          // Ensure habit.completed is an object
          const completedObj =
            typeof habit.completed === 'object' && habit.completed !== null
              ? { ...habit.completed }
              : {};

          const isCompleted = completedObj[dateKey] === true;
          completedObj[dateKey] = !isCompleted;

          return {
            ...habit,
            completed: completedObj,
          };
        }),
      };

    case ActionTypes.SKIP_HABIT:
      return {
        ...state,
        habits: state.habits.map((habit) => {
          if (habit.id !== action.payload.habitId) return habit;
          
          const dateKey = action.payload.date;
          const skippedDates = habit.skippedDates || [];
          const isSkipped = skippedDates.includes(dateKey);
          
          return {
            ...habit,
            skippedDates: isSkipped
              ? skippedDates.filter(d => d !== dateKey)
              : [...skippedDates, dateKey]
          };
        }),
      };

    case ActionTypes.REORDER_HABITS:
      return {
        ...state,
        habits: action.payload.map(habitId => 
          state.habits.find(h => h.id === habitId)
        ).filter(Boolean),
      };

    case ActionTypes.REORDER_CATEGORIES:
      return {
        ...state,
        categories: action.payload.map(categoryId => 
          state.categories.find(c => c.id === categoryId)
        ).filter(Boolean),
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
        habits: state.habits.filter((habit) => habit.categoryId !== action.payload),
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

    case ActionTypes.DELETE_ALL_HOLIDAY_PERIODS:
      return {
        ...state,
        holidayPeriods: [],
      };

    case ActionTypes.UPDATE_HOLIDAY_PERIOD:
      return {
        ...state,
        holidayPeriods: state.holidayPeriods.map((period) =>
          period.id === action.payload.id
            ? { ...period, ...action.payload }
            : period
        ),
      };

    case ActionTypes.TOGGLE_SINGLE_HOLIDAY:
      const dateKey = action.payload;
      const currentHolidayDates = state.holidayDates || [];
      const isHoliday = currentHolidayDates.includes(dateKey);
      
      return {
        ...state,
        holidayDates: isHoliday
          ? currentHolidayDates.filter(d => d !== dateKey)
          : [...currentHolidayDates, dateKey],
      };

    case ActionTypes.ADD_ACTIVITY:
      return {
        ...state,
        activities: [...state.activities, action.payload],
      };

    case ActionTypes.UPDATE_ACTIVITY:
      const { activityId: updId, updates } = action.payload;
      
      // Update the activities array
      const updatedActivities = state.activities.map((activity) =>
        activity.id === updId
          ? { ...activity, ...updates, updatedAt: new Date().toISOString() }
          : activity
      );

      // If name or categoryId was not updated, no need to patch recorded activities
      if (!updates || (!updates.name && !updates.categoryId)) {
        return { ...state, activities: updatedActivities };
      }
      
      // Efficiently patch recorded activities
      const recordedActivitiesPatched = Object.entries(state.recordedActivities).reduce(
        (acc, [dateKey, records]) => {
          // Check if any record in this date needs patching
          if (records.some(rec => rec.activityId === updId)) {
            acc[dateKey] = records.map(rec => 
              rec.activityId === updId 
                ? {
                    ...rec,
                    activityName: updates.name !== undefined ? updates.name : rec.activityName,
                    categoryId: updates.categoryId !== undefined ? updates.categoryId : rec.categoryId,
                  } 
                : rec
            );
          } else {
            // No change, keep original array
            acc[dateKey] = records;
          }
          return acc;
        }, {});

      return {
        ...state,
        activities: updatedActivities,
        recordedActivities: recordedActivitiesPatched,
      };

    case ActionTypes.DELETE_ACTIVITY:
      const activityId = action.payload;
      const updatedRecordedActivities = { ...state.recordedActivities };
      
      // Remove recorded activities for this activity
      Object.keys(updatedRecordedActivities).forEach((date) => {
        updatedRecordedActivities[date] = updatedRecordedActivities[date].filter(
          (record) => record.activityId !== activityId
        );
        if (updatedRecordedActivities[date].length === 0) {
          delete updatedRecordedActivities[date];
        }
      });
      
      return {
        ...state,
        activities: state.activities.filter((activity) => activity.id !== activityId),
        recordedActivities: updatedRecordedActivities,
      };

    case ActionTypes.RECORD_ACTIVITY:
      const { activityId: recordActivityId, date, data } = action.payload;
      const isoDate = date.slice(0, 10); // Ensure YYYY-MM-DD format
      const activity = state.activities.find((a) => a.id === recordActivityId);
      
      if (!activity) return state;
      
      const record = {
        id: generateUniqueId(),
        activityId: recordActivityId,
        activityName: activity.name,
        categoryId: activity.categoryId,
        date: isoDate,
        timestamp: new Date().toISOString(),
        duration: data.duration || null,
        intensity: data.intensity || null,
        notes: data.notes || '',
        ...data,
      };
      
      const currentRecordedActivities = state.recordedActivities || {};
      const dateRecords = currentRecordedActivities[isoDate] || [];
      
      return {
        ...state,
        recordedActivities: {
          ...currentRecordedActivities,
          [isoDate]: [...dateRecords, record],
        },
      };

    case ActionTypes.UPDATE_ACTIVITY_CATEGORY_COLOR:
      return {
        ...state,
        activityCategories: state.activityCategories.map((category) =>
          category.id === action.payload.categoryId
            ? { ...category, color: action.payload.newColor }
            : category
        ),
      };

    case ActionTypes.UPDATE_SETTINGS:
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };

    case ActionTypes.SET_DARK_MODE:
      return {
        ...state,
        settings: { ...state.settings, darkMode: action.payload },
      };

    case ActionTypes.TOGGLE_DARK_MODE:
      return {
        ...state,
        settings: { ...state.settings, darkMode: !state.settings.darkMode },
      };

    case ActionTypes.TOGGLE_COMPLETED:
      return {
        ...state,
        settings: { ...state.settings, hideCompleted: !state.settings.hideCompleted },
      };

    case ActionTypes.TOGGLE_SKIPPED:
      return {
        ...state,
        settings: { ...state.settings, hideSkipped: !state.settings.hideSkipped },
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
  getHabits: (state = _appData) => state.habits,
  getHabitById: (state = _appData, habitId) => state.habits.find((h) => h.id === habitId),

  // Category selectors
  getCategories: (state = _appData) => state.categories,

  // Date selectors
  getSelectedDate: (state = _appData) => state.selectedDate,
  getSelectedGroup: (state = _appData) => state.selectedGroup,

  // Settings selectors
  getSettings: (state = _appData) => state.settings,
  isDarkMode: (state = _appData) => state.settings.darkMode,

  // Activity selectors
};

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
_appData.habits.forEach(ensureHabitIntegrity);

export function ensureHolidayIntegrity(state = _appData) {
  if (!Array.isArray(state.holidayDates)) state.holidayDates = [];
  if (!Array.isArray(state.holidayPeriods)) state.holidayPeriods = [];
}

// Ensure defaults exist immediately
ensureHolidayIntegrity(_appData);

// Export enhanced state management utilities
export { initialState, reducer };
