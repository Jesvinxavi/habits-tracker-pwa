// Enhanced State Management System with Immutable Updates and Actions

import { deepClone, generateUniqueId } from '../shared/common.js';
import { getLocalMidnightISOString } from '../shared/datetime.js';
import { normalizeHexColor } from '../shared/sanitize.js';
import {
  normalizeActivityPresentation,
  normalizeFitnessPayload,
  normalizeRecordedActivity,
} from '../shared/fitnessValidation.js';
import { installTestHarnessApi, isTestHarnessEnabled } from './testHarness.js';
import { getCloudRuntime } from './cloudRuntime.js';
import { mergeHabitUpdate } from './habitLifecycle.js';

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
  // First ever local-midnight ISO date string when the app was first opened
  appFirstOpenDate: getLocalDateISO(),
  selectedGroup: 'daily',
  holidayDates: [],
  manualHolidayDates: [],
  holidayPeriods: [],
  settings: {
    darkMode: false,
    hideCompleted: false,
    hideSkipped: false,
    holidayMode: false,
    // Off by default: pulling a program's routines into a day writes records, so
    // it stays an explicit choice until the user opts in.
  },
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
  routines: [], // Named, ordered sets of activities performed together
  programs: [], // Training blocks with a weekly routine schedule
  restDays: {}, // Map dateKey (YYYY-MM-DD) -> true
  homeSectionVisibility: { Completed: true, Skipped: true },
  syncStatus: isTestHarnessEnabled() ? 'synced' : 'syncing',
};

/**
 * Recursively freezes state in development so accidental writes fail at the
 * call site. Production skips the walk; immutable reducer updates still provide
 * stable references for selectors without paying a deep-freeze cost.
 * @param {unknown} value
 * @returns {unknown}
 */
function freezeForDevelopment(value) {
  if (!import.meta.env.DEV || value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.values(value).forEach(freezeForDevelopment);
  return value;
}

const initialAppData = deepClone(initialState);
initialAppData.habits.forEach(ensureHabitIntegrity);
ensureHolidayIntegrity(initialAppData);

// Application state - private for immutability. The root reference is replaced
// after every committed action, allowing cheap identity-based subscriptions.
let _appData = freezeForDevelopment(initialAppData);

// Public immutable state access. The development freeze protects this shared
// snapshot; callers must dispatch actions rather than mutating it.
export function getState() {
  return _appData;
}

// Observer pattern for state changes
export const listeners = new Set();

/**
 * Subscribes either to all committed state changes (`subscribe(listener)`) or
 * to one selected slice (`subscribe(selector, listener, options)`). Slice
 * listeners run only when their selected value changes by the equality check.
 * @param {Function} selectorOrListener
 * @param {Function} [listener]
 * @param {{equalityFn?: Function, fireImmediately?: boolean}} [options]
 * @returns {Function} Unsubscribe callback
 */
export function subscribe(selectorOrListener, listener, options = {}) {
  const isSelectorSubscription = typeof listener === 'function';
  const subscription = isSelectorSubscription
    ? {
        selector: selectorOrListener,
        listener,
        equalityFn: options.equalityFn || Object.is,
        selected: selectorOrListener(_appData),
      }
    : {
        selector: null,
        listener: selectorOrListener,
        equalityFn: null,
        selected: undefined,
      };

  listeners.add(subscription);
  if (isSelectorSubscription && options.fireImmediately) {
    listener(subscription.selected, undefined, _appData, undefined);
  }
  return () => listeners.delete(subscription);
}

/**
 * Notifies subscriptions independently. A broken view must not roll back an
 * already committed reducer transition or prevent other views from updating.
 * @param {object} [nextState]
 * @param {object} [previousState]
 * @param {object} [action]
 * @returns {void}
 */
export function notify(nextState = _appData, previousState = _appData, action) {
  listeners.forEach((subscription) => {
    try {
      if (!subscription.selector) {
        subscription.listener(nextState, previousState, action);
        return;
      }

      const nextSelected = subscription.selector(nextState);
      if (subscription.equalityFn(subscription.selected, nextSelected)) return;
      const previousSelected = subscription.selected;
      subscription.selected = nextSelected;
      subscription.listener(nextSelected, previousSelected, nextState, action);
    } catch (error) {
      console.error('Error in state subscriber:', error);
    }
  });
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
  SET_GROUP_AND_DATE: 'SET_GROUP_AND_DATE',
  SET_FITNESS_SELECTED_DATE: 'SET_FITNESS_SELECTED_DATE',
  SET_APP_FIRST_OPEN_DATE: 'SET_APP_FIRST_OPEN_DATE',

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
  RECORD_ACTIVITY: 'RECORD_ACTIVITY',
  RECORD_ACTIVITIES: 'RECORD_ACTIVITIES',
  DELETE_RECORDED_ACTIVITY: 'DELETE_RECORDED_ACTIVITY',
  UPDATE_RECORDED_ACTIVITY: 'UPDATE_RECORDED_ACTIVITY',
  UPDATE_ACTIVITY_CATEGORY_COLOR: 'UPDATE_ACTIVITY_CATEGORY_COLOR',
  SET_REST_DAY: 'SET_REST_DAY',

  // Routine actions
  ADD_ROUTINE: 'ADD_ROUTINE',
  UPDATE_ROUTINE: 'UPDATE_ROUTINE',

  // Program actions
  ADD_PROGRAM: 'ADD_PROGRAM',
  UPDATE_PROGRAM: 'UPDATE_PROGRAM',
  DELETE_PROGRAM: 'DELETE_PROGRAM',
  SET_ACTIVE_PROGRAM: 'SET_ACTIVE_PROGRAM',

  // Settings actions
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  SET_DARK_MODE: 'SET_DARK_MODE',
  TOGGLE_DARK_MODE: 'TOGGLE_DARK_MODE',
  TOGGLE_COMPLETED: 'TOGGLE_COMPLETED',
  TOGGLE_SKIPPED: 'TOGGLE_SKIPPED',
  UPDATE_HOME_SECTION_VISIBILITY: 'UPDATE_HOME_SECTION_VISIBILITY',

  // Bulk actions
  RESET_STATE: 'RESET_STATE',
  IMPORT_DATA: 'IMPORT_DATA',
  HYDRATE_CACHE: 'HYDRATE_CACHE',
  APPLY_OPTIMISTIC_OPERATION: 'APPLY_OPTIMISTIC_OPERATION',
  CONFIRM_OPERATION: 'CONFIRM_OPERATION',
  APPLY_REMOTE_CHANGE: 'APPLY_REMOTE_CHANGE',
  ROLLBACK_OPERATION: 'ROLLBACK_OPERATION',
  SET_SYNC_STATUS: 'SET_SYNC_STATUS',

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
  deleteHabit: (habitId, archivedAt = Date.now()) => ({
    type: ActionTypes.DELETE_HABIT,
    payload: { habitId, archivedAt },
  }),
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

  setSelectedDate: (date) => ({
    type: ActionTypes.SET_SELECTED_DATE,
    payload: date,
    meta: { source: 'device' },
  }),
  setSelectedGroup: (group) => ({
    type: ActionTypes.SET_SELECTED_GROUP,
    payload: group,
    meta: { source: 'device' },
  }),
  setGroupAndDate: (group, date) => ({
    type: ActionTypes.SET_GROUP_AND_DATE,
    payload: { group, date },
    meta: { source: 'device' },
  }),
  setFitnessSelectedDate: (date) => ({
    type: ActionTypes.SET_FITNESS_SELECTED_DATE,
    payload: date,
    meta: { source: 'device' },
  }),
  setAppFirstOpenDate: (date) => ({
    type: ActionTypes.SET_APP_FIRST_OPEN_DATE,
    payload: date,
    meta: { source: 'device' },
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
  toggleSingleHoliday: (date, desired) => ({
    type: ActionTypes.TOGGLE_SINGLE_HOLIDAY,
    payload: { date, desired },
  }),
  setHolidayDates: (dates) => ({
    type: ActionTypes.SET_HOLIDAY_DATES,
    payload: dates,
    meta: { source: 'device' },
  }),

  addActivity: (activity) => ({
    type: ActionTypes.ADD_ACTIVITY,
    payload: activity,
  }),
  updateActivity: (activityId, updates) => ({
    type: ActionTypes.UPDATE_ACTIVITY,
    payload: { activityId, updates },
  }),
  recordActivity: (activityId, date, data) => ({
    type: ActionTypes.RECORD_ACTIVITY,
    payload: { activityId, date, data },
  }),
  recordActivities: (date, records) => ({
    type: ActionTypes.RECORD_ACTIVITIES,
    payload: { date, records },
  }),
  deleteRecordedActivity: (recordId, date) => ({
    type: ActionTypes.DELETE_RECORDED_ACTIVITY,
    payload: { recordId, date },
  }),
  updateRecordedActivity: (recordId, date, data) => ({
    type: ActionTypes.UPDATE_RECORDED_ACTIVITY,
    payload: { recordId, date, data },
  }),
  updateActivityCategoryColor: (categoryId, newColor) => ({
    type: ActionTypes.UPDATE_ACTIVITY_CATEGORY_COLOR,
    payload: { categoryId, newColor },
  }),
  setRestDay: (dateKey, desired) => ({
    type: ActionTypes.SET_REST_DAY,
    payload: { dateKey, desired },
  }),

  addRoutine: (routine) => ({
    type: ActionTypes.ADD_ROUTINE,
    payload: routine,
  }),
  updateRoutine: (routineId, updates) => ({
    type: ActionTypes.UPDATE_ROUTINE,
    payload: { routineId, updates },
  }),

  addProgram: (program) => ({
    type: ActionTypes.ADD_PROGRAM,
    payload: program,
  }),
  updateProgram: (programId, updates) => ({
    type: ActionTypes.UPDATE_PROGRAM,
    payload: { programId, updates },
  }),
  deleteProgram: (programId) => ({
    type: ActionTypes.DELETE_PROGRAM,
    payload: programId,
  }),
  // A null payload deactivates every program.
  setActiveProgram: (programId) => ({
    type: ActionTypes.SET_ACTIVE_PROGRAM,
    payload: programId,
  }),

  updateSettings: (settings) => ({ type: ActionTypes.UPDATE_SETTINGS, payload: settings }),
  setDarkMode: (isDark) => ({ type: ActionTypes.SET_DARK_MODE, payload: isDark }),
  toggleDarkMode: () => ({ type: ActionTypes.TOGGLE_DARK_MODE }),
  toggleCompleted: () => ({ type: ActionTypes.TOGGLE_COMPLETED }),
  toggleSkipped: () => ({ type: ActionTypes.TOGGLE_SKIPPED }),
  updateHomeSectionVisibility: (visibility) => ({
    type: ActionTypes.UPDATE_HOME_SECTION_VISIBILITY,
    payload: visibility,
  }),

  resetState: () => ({ type: ActionTypes.RESET_STATE }),
  importData: (data) => ({ type: ActionTypes.IMPORT_DATA, payload: data }),
  hydrateCache: (data) => ({
    type: ActionTypes.HYDRATE_CACHE,
    payload: data,
    meta: { source: 'hydration' },
  }),
  applyOptimisticOperation: (data) => ({
    type: ActionTypes.APPLY_OPTIMISTIC_OPERATION,
    payload: data,
    meta: { source: 'optimistic' },
  }),
  confirmOperation: (data) => ({
    type: ActionTypes.CONFIRM_OPERATION,
    payload: data,
    meta: { source: 'server' },
  }),
  applyRemoteChange: (data) => ({
    type: ActionTypes.APPLY_REMOTE_CHANGE,
    payload: data,
    meta: { source: 'server' },
  }),
  rollbackOperation: (data) => ({
    type: ActionTypes.ROLLBACK_OPERATION,
    payload: data,
    meta: { source: 'rollback' },
  }),
  setSyncStatus: (status) => ({
    type: ActionTypes.SET_SYNC_STATUS,
    payload: status,
    meta: { source: 'sync' },
  }),

  // updateHabitProgress: ({ habitId, progress }) => ({
  //   type: ActionTypes.UPDATE_HABIT_PROGRESS,
  //   payload: { habitId, progress },
  // }),
  // updateHabitSkippedDates: ({ habitId, skippedDates }) => ({
  //   type: ActionTypes.UPDATE_HABIT_SKIPPED_DATES,
  //   payload: { habitId, skippedDates },
  // }),
};

// A deliberately narrow, explicitly enabled hook for browser UI tests.
// Production and ordinary development builds expose no mutable state global.
installTestHarnessApi({ getState, dispatch, actionTypes: ActionTypes });

// Enhanced dispatch function with immutable updates
export function dispatch(action) {
  if (typeof action === 'function') {
    // Support for thunk-style actions
    return action(dispatch, () => _appData);
  }

  const prevState = _appData;

  if (
    !isTestHarnessEnabled() &&
    !action.meta?.source &&
    typeof action.type === 'string'
  ) {
    return import('./persistenceRouter.js').then(({ isPersistentAction, persistStateAction }) => {
      if (!isPersistentAction(action)) {
        dispatch({ ...action, meta: { source: 'device' } });
        return true;
      }
      // A cloud write may only proceed after bootstrap has supplied an
      // authenticated, generation-bound runtime. Do not fall back to a direct
      // reducer commit: that would make a visible user change disappear after
      // reload when IndexedDB/outbox setup failed.
      if (!getCloudRuntime()) {
        const error = new Error('Cloud persistence is not ready');
        console.error('[persistence] Local durable write failed:', error);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('persistence-storage-error', { detail: { message: error.message } })
          );
        }
        return false;
      }
      return persistStateAction(action, prevState)
        .then(() => {
          dispatch({ ...action, meta: { source: 'optimistic' } });
          return true;
        })
        .catch((error) => {
          console.error('[persistence] Local durable write failed:', error);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('persistence-storage-error', { detail: { message: error.message } })
            );
          }
          return false;
        });
    });
  }

  try {
    // Apply the action to create new state
    const newState = reducer(prevState, action);
    if (newState === prevState) return true;

    // Commit before notifying. Subscribers are isolated from reducer failures
    // and from one another, so a rendering error cannot undo valid user data.
    _appData = freezeForDevelopment(newState);

    // Notify listeners
    notify(_appData, prevState, action);
    return true;
  } catch (error) {
    console.error('Error dispatching action:', action, error);
    return false;
  }
}

// Reducer function - Pure function that handles state updates
function reducer(state, action) {
  switch (action.type) {
    case ActionTypes.ADD_HABIT:
      const newHabit = deepClone(action.payload);
      ensureHabitIntegrity(newHabit);
      return {
        ...state,
        habits: [...state.habits, newHabit],
      };

    case ActionTypes.UPDATE_HABIT:
      return {
        ...state,
        habits: state.habits.map((habit) => {
          if (habit.id !== action.payload.habitId) return habit;
          return mergeHabitUpdate(habit, action.payload.updates);
        }),
      };

    case ActionTypes.DELETE_HABIT: {
      const habitId = action.payload?.habitId || action.payload;
      const archivedAt =
        action.payload?.archivedAt ||
        Date.parse(state.currentDate || state.selectedDate || '') ||
        1;
      return {
        ...state,
        // Removing a habit archives its definition instead of destroying the
        // embedded completion history. Historical Home dates and Stats can
        // still resolve the habit while active surfaces hide it.
        habits: state.habits.map((habit) =>
          habit.id === habitId ? { ...habit, archivedAt } : habit
        ),
      };
    }

    case ActionTypes.SET_HABIT_PROGRESS:
      return {
        ...state,
        habits: state.habits.map((habit) => {
          if (habit.id !== action.payload.habitId) return habit;
          const periodKey = action.payload.date;
          const progress = Number(action.payload.progress);
          const reachedTarget =
            typeof habit.target === 'number' && habit.target > 0 && progress >= habit.target;
          const completed = { ...(habit.completed || {}) };
          let skippedDates = [...(habit.skippedDates || [])];
          if (reachedTarget) {
            completed[periodKey] = true;
            skippedDates = skippedDates.filter((key) => key !== periodKey);
          }
          return {
            ...habit,
            completed,
            skippedDates,
            progress: {
              ...habit.progress,
              [periodKey]: progress,
            },
          };
        }),
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
          const nextCompleted = !isCompleted;
          completedObj[dateKey] = nextCompleted;
          const progress = { ...(habit.progress || {}) };
          if (!nextCompleted && habit.target > 0) progress[dateKey] = 0;

          return {
            ...habit,
            completed: completedObj,
            progress,
            skippedDates: nextCompleted
              ? (habit.skippedDates || []).filter((key) => key !== dateKey)
              : habit.skippedDates || [],
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
          const nextSkipped = !isSkipped;
          const completed = { ...(habit.completed || {}) };
          const progress = { ...(habit.progress || {}) };
          if (nextSkipped) {
            delete completed[dateKey];
            progress[dateKey] = 0;
          }
          
          return {
            ...habit,
            completed,
            progress,
            skippedDates: isSkipped
              ? skippedDates.filter(d => d !== dateKey)
              : [...skippedDates, dateKey]
          };
        }),
      };

    case ActionTypes.REORDER_HABITS:
      {
        const reordered = action.payload
          .map((habitId) => state.habits.find((habit) => habit.id === habitId))
          .filter(Boolean);
        const archived = state.habits.filter(
          (habit) => habit.archivedAt && !action.payload.includes(habit.id)
        );
        return {
          ...state,
          habits: [...reordered, ...archived],
        };
      }

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
        categories: [...state.categories, deepClone(action.payload)],
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
      if (state.selectedDate === action.payload) return state;
      return {
        ...state,
        selectedDate: action.payload,
      };

    case ActionTypes.SET_SELECTED_GROUP:
      if (state.selectedGroup === action.payload) return state;
      return {
        ...state,
        selectedGroup: action.payload,
      };

    case ActionTypes.SET_GROUP_AND_DATE:
      if (
        state.selectedGroup === action.payload.group &&
        state.selectedDate === action.payload.date
      ) {
        return state;
      }
      return {
        ...state,
        selectedGroup: action.payload.group,
        selectedDate: action.payload.date,
      };

    case ActionTypes.SET_FITNESS_SELECTED_DATE:
      if (state.fitnessSelectedDate === action.payload) return state;
      return {
        ...state,
        fitnessSelectedDate: action.payload,
      };

    case ActionTypes.SET_APP_FIRST_OPEN_DATE:
      if (state.appFirstOpenDate === action.payload) return state;
      return {
        ...state,
        appFirstOpenDate: action.payload,
      };

    case ActionTypes.SET_HOLIDAY_DATES:
      return {
        ...state,
        holidayDates: [...action.payload],
      };

    case ActionTypes.ADD_HOLIDAY_PERIOD:
      return {
        ...state,
        holidayPeriods: [...state.holidayPeriods, deepClone(action.payload)],
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
      const dateKey = action.payload.date;
      const manualHolidayDates = state.manualHolidayDates || [];
      const desired =
        action.payload.desired ?? !manualHolidayDates.includes(dateKey);
      return {
        ...state,
        manualHolidayDates: desired
          ? [...new Set([...manualHolidayDates, dateKey])]
          : manualHolidayDates.filter((date) => date !== dateKey),
      };

    case ActionTypes.ADD_ACTIVITY:
      return {
        ...state,
        activities: [
          ...state.activities,
          normalizeActivityPresentation(deepClone(action.payload)),
        ],
      };

    case ActionTypes.UPDATE_ACTIVITY:
      const { activityId: updId, updates } = action.payload;
      
      // Update the activities array
      const updatedActivities = state.activities.map((activity) =>
        activity.id === updId
          ? normalizeActivityPresentation({
              ...activity,
              ...updates,
              updatedAt: new Date().toISOString(),
            })
          : activity
      );

      // Recorded sessions are not patched: a record snapshots the name only as
      // a fallback, and every surface resolves the live activity by id. That
      // keeps a rename applying to past sessions without rewriting their rows —
      // which the server never did anyway, so the two used to disagree after a
      // reload.
      return { ...state, activities: updatedActivities };

    case ActionTypes.RECORD_ACTIVITY:
      const { activityId: recordActivityId, date, data } = action.payload;
      const isoDate = date.slice(0, 10); // Ensure YYYY-MM-DD format
      const activity = state.activities.find((a) => a.id === recordActivityId);
      
      if (!activity) return state;
      
      const record = normalizeRecordedActivity({
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
      });
      
      const currentRecordedActivities = state.recordedActivities || {};
      const dateRecords = currentRecordedActivities[isoDate] || [];
      
      return {
        ...state,
        recordedActivities: {
          ...currentRecordedActivities,
          [isoDate]: [...dateRecords, record],
        },
      };

    case ActionTypes.RECORD_ACTIVITIES: {
      const batchDate = String(action.payload.date).slice(0, 10);
      const activityIds = new Set(state.activities.map((item) => item.id));
      const batchRecords = action.payload.records
        .filter((item) => activityIds.has(item.activityId))
        .map((item) => normalizeRecordedActivity({ ...deepClone(item), date: batchDate }));
      if (batchRecords.length === 0) return state;
      const currentRecordedActivities = state.recordedActivities || {};
      return {
        ...state,
        recordedActivities: {
          ...currentRecordedActivities,
          [batchDate]: [...(currentRecordedActivities[batchDate] || []), ...batchRecords],
        },
      };
    }

    case ActionTypes.DELETE_RECORDED_ACTIVITY: {
      const { recordId, date } = action.payload;
      const records = { ...state.recordedActivities };
      records[date] = (records[date] || []).filter((item) => item.id !== recordId);
      if (!records[date].length) delete records[date];
      return { ...state, recordedActivities: records };
    }

    case ActionTypes.UPDATE_RECORDED_ACTIVITY: {
      const { recordId, date, data } = action.payload;
      return {
        ...state,
        recordedActivities: {
          ...state.recordedActivities,
          [date]: (state.recordedActivities[date] || []).map((item) =>
            item.id === recordId ? normalizeRecordedActivity({ ...item, ...data }) : item
          ),
        },
      };
    }

    case ActionTypes.UPDATE_ACTIVITY_CATEGORY_COLOR:
      if (
        !state.activityCategories.some(
          (category) =>
            category.id === action.payload.categoryId &&
            category.color !== normalizeHexColor(action.payload.newColor, category.color)
        )
      ) {
        return state;
      }
      return {
        ...state,
        activityCategories: state.activityCategories.map((category) =>
          category.id === action.payload.categoryId
            ? {
                ...category,
                color: normalizeHexColor(action.payload.newColor, category.color),
              }
            : category
        ),
      };

    case ActionTypes.ADD_ROUTINE:
      return {
        ...state,
        routines: [...state.routines, deepClone(action.payload)],
      };

    case ActionTypes.UPDATE_ROUTINE:
      return {
        ...state,
        routines: state.routines.map((routine) =>
          routine.id === action.payload.routineId
            ? { ...routine, ...action.payload.updates }
            : routine
        ),
      };


    case ActionTypes.ADD_PROGRAM:
      return {
        ...state,
        programs: [...state.programs, deepClone(action.payload)],
      };

    case ActionTypes.UPDATE_PROGRAM:
      return {
        ...state,
        programs: state.programs.map((program) =>
          program.id === action.payload.programId
            ? { ...program, ...action.payload.updates }
            : program
        ),
      };

    case ActionTypes.DELETE_PROGRAM:
      return {
        ...state,
        programs: state.programs.filter((program) => program.id !== action.payload),
      };

    case ActionTypes.SET_ACTIVE_PROGRAM:
      return {
        ...state,
        programs: state.programs.map((program) => ({
          ...program,
          active: program.id === action.payload,
        })),
      };

    case ActionTypes.SET_REST_DAY: {
      if (Boolean(state.restDays[action.payload.dateKey]) === Boolean(action.payload.desired)) {
        return state;
      }
      const restDays = { ...state.restDays };
      if (action.payload.desired) restDays[action.payload.dateKey] = true;
      else delete restDays[action.payload.dateKey];
      return { ...state, restDays };
    }

    case ActionTypes.UPDATE_SETTINGS:
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };

    case ActionTypes.SET_DARK_MODE:
      if (state.settings.darkMode === action.payload) return state;
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

    case ActionTypes.UPDATE_HOME_SECTION_VISIBILITY:
      return { ...state, homeSectionVisibility: { ...action.payload } };

    case ActionTypes.IMPORT_DATA:
      return { ...state, ...normalizeFitnessPayload(deepClone(action.payload)) };

    case ActionTypes.HYDRATE_CACHE:
      return { ...state, ...normalizeFitnessPayload(deepClone(action.payload)) };

    case ActionTypes.SET_SYNC_STATUS:
      if (state.syncStatus === action.payload) return state;
      return { ...state, syncStatus: action.payload };

    case ActionTypes.APPLY_OPTIMISTIC_OPERATION:
    case ActionTypes.APPLY_REMOTE_CHANGE:
    case ActionTypes.ROLLBACK_OPERATION:
      return action.payload?.statePatch
        ? { ...state, ...deepClone(action.payload.statePatch) }
        : state;

    case ActionTypes.CONFIRM_OPERATION: {
      const { entityType, canonicalRecord } = action.payload || {};
      if (!canonicalRecord) return state;
      if (entityType === 'habitEntries') {
        return {
          ...state,
          habits: state.habits.map((habit) => {
            if (habit.id !== canonicalRecord.habitClientId) return habit;
            const completed = { ...(habit.completed || {}) };
            const progress = { ...(habit.progress || {}) };
            let skippedDates = [...(habit.skippedDates || [])];
            const key = canonicalRecord.periodKey;
            if (!canonicalRecord.deletedAt && canonicalRecord.completed) completed[key] = true;
            else delete completed[key];
            if (!canonicalRecord.deletedAt && canonicalRecord.progress) {
              progress[key] = canonicalRecord.progress;
            } else {
              delete progress[key];
            }
            if (!canonicalRecord.deletedAt && canonicalRecord.skipped) {
              skippedDates = [...new Set([...skippedDates, key])];
            } else {
              skippedDates = skippedDates.filter((date) => date !== key);
            }
            return {
              ...habit,
              completed,
              progress,
              skippedDates,
              entryRevisions: {
                ...(habit.entryRevisions || {}),
                [key]: canonicalRecord.revision,
              },
            };
          }),
        };
      }
      if (entityType === 'habits') {
        const habitId = canonicalRecord.clientId;
        if (canonicalRecord.deletedAt) {
          return {
            ...state,
            habits: state.habits.filter((habit) => habit.id !== habitId),
          };
        }
        return {
          ...state,
          habits: state.habits.map((habit) =>
            habit.id === habitId
              ? {
                  ...habit,
                  ...canonicalRecord,
                  id: habitId,
                  categoryId: canonicalRecord.categoryClientId,
                  createdAt: canonicalRecord.createdAtISO,
                  // Explicit assignment also clears a rejected optimistic
                  // archive when conflict resolution keeps the server record.
                  archivedAt: canonicalRecord.archivedAt,
                }
              : habit
          ),
        };
      }
      if (entityType === 'holidaySingles') {
        const desired = !canonicalRecord.deletedAt;
        return {
          ...state,
          manualHolidayDates: desired
            ? [...new Set([...(state.manualHolidayDates || []), canonicalRecord.dateKey])]
            : (state.manualHolidayDates || []).filter(
                (date) => date !== canonicalRecord.dateKey
              ),
          holidaySingleRevisions: {
            ...(state.holidaySingleRevisions || {}),
            [canonicalRecord.dateKey]: canonicalRecord.revision,
          },
        };
      }
      if (entityType === 'restDays') {
        return {
          ...state,
          restDayRevisions: {
            ...(state.restDayRevisions || {}),
            [canonicalRecord.dateKey]: canonicalRecord.revision,
          },
        };
      }
      if (entityType === 'userPreferences') {
        return {
          ...state,
          settings: {
            darkMode: canonicalRecord.darkMode,
            hideCompleted: canonicalRecord.hideCompleted,
            hideSkipped: canonicalRecord.hideSkipped,
            holidayMode: canonicalRecord.holidayMode,
          },
          homeSectionVisibility: canonicalRecord.homeSectionVisibility,
        };
      }
      return state;
    }

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

export function ensureHolidayIntegrity(state = _appData) {
  if (!Array.isArray(state.holidayDates)) state.holidayDates = [];
  if (!Array.isArray(state.holidayPeriods)) state.holidayPeriods = [];
}

// Export enhanced state management utilities
export { freezeForDevelopment, initialState, reducer };
