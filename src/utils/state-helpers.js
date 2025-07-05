/**
 * State Management Utilities and Migration Helpers
 *
 * This module provides utilities to help migrate from direct mutations
 * to the new action-based state management system.
 */

import { dispatch, Actions, ActionTypes, Selectors } from '../core/state.js';

// Migration utilities - these help convert common mutation patterns to actions
export const StateHelpers = {
  // Habit management helpers
  addHabit(habitData) {
    return dispatch(Actions.addHabit(habitData));
  },

  updateHabit(habitId, updates) {
    return dispatch(Actions.updateHabit(habitId, updates));
  },

  deleteHabit(habitId) {
    return dispatch(Actions.deleteHabit(habitId));
  },

  setHabitProgress(habitId, date, progress) {
    return dispatch(Actions.setHabitProgress(habitId, date, progress));
  },

  toggleHabitCompleted(habitId, date) {
    return dispatch(Actions.toggleHabitCompleted(habitId, date));
  },

  // Category management helpers
  addCategory(categoryData) {
    return dispatch(Actions.addCategory(categoryData));
  },

  updateCategory(categoryId, updates) {
    return dispatch(Actions.updateCategory(categoryId, updates));
  },

  deleteCategory(categoryId) {
    return dispatch(Actions.deleteCategory(categoryId));
  },

  // Navigation helpers
  setSelectedDate(date) {
    return dispatch(Actions.setSelectedDate(date));
  },

  setSelectedGroup(group) {
    return dispatch(Actions.setSelectedGroup(group));
  },

  // Settings helpers
  updateSettings(settings) {
    return dispatch(Actions.updateSettings(settings));
  },

  toggleDarkMode() {
    return dispatch(Actions.toggleDarkMode());
  },

  // Bulk operations
  importData(data) {
    return dispatch({ type: ActionTypes.IMPORT_DATA, payload: data });
  },

  resetState() {
    return dispatch({ type: ActionTypes.RESET_STATE });
  },
};

// Common selector combinations for UI components
export const UISelectors = {
  // Get habits for current view
  getHabitsForCurrentView() {
    const habits = Selectors.getActiveHabits();

    return habits.filter((habit) => {
      // Add your group filtering logic here
      return true; // Placeholder
    });
  },

  // Get categories with habit counts
  getCategoriesWithCounts() {
    const categories = Selectors.getCategories();
    const habits = Selectors.getHabits();

    return categories.map((category) => ({
      ...category,
      habitCount: habits.filter((h) => h.category === category.id).length,
      activeHabitCount: habits.filter((h) => h.category === category.id && !h.paused).length,
    }));
  },

  // Get progress statistics
  getProgressStats(date) {
    const habits = Selectors.getActiveHabits();
    const completedHabits = Selectors.getCompletedHabitsForDate(date);

    return {
      total: habits.length,
      completed: completedHabits.length,
      percentage: habits.length > 0 ? (completedHabits.length / habits.length) * 100 : 0,
    };
  },

  // Get current theme info
  getThemeInfo() {
    const settings = Selectors.getSettings();
    return {
      isDarkMode: settings.darkMode,
      hideCompleted: settings.hideCompleted,
      hideSkipped: settings.hideSkipped,
    };
  },
};

// Migration patterns - these show how to convert common mutation patterns
export const MigrationPatterns = {
  // Before: mutate((s) => s.habits.push(newHabit))
  // After: StateHelpers.addHabit(newHabit)
  addHabitExample() {
    const newHabit = {
      id: 'habit-123',
      name: 'Morning Exercise',
      category: 'fitness',
      target: 1,
      // ... other properties
    };

    StateHelpers.addHabit(newHabit);
  },

  // Before: mutate((s) => { const h = s.habits.find(h => h.id === id); h.name = newName; })
  // After: StateHelpers.updateHabit(id, { name: newName })
  updateHabitExample() {
    const habitId = 'habit-123';
    const updates = { name: 'Evening Exercise' };

    StateHelpers.updateHabit(habitId, updates);
  },

  // Before: mutate((s) => s.selectedDate = newDate)
  // After: StateHelpers.setSelectedDate(newDate)
  setDateExample() {
    const newDate = new Date().toISOString();
    StateHelpers.setSelectedDate(newDate);
  },

  // Before: mutate((s) => s.settings.darkMode = !s.settings.darkMode)
  // After: StateHelpers.toggleDarkMode()
  toggleThemeExample() {
    StateHelpers.toggleDarkMode();
  },
};

// Advanced patterns for complex state updates
export const AdvancedPatterns = {
  // Batch multiple related updates
  batchHabitUpdates(updates) {
    return dispatch((dispatch, getState) => {
      updates.forEach(({ habitId, updates }) => {
        dispatch(Actions.updateHabit(habitId, updates));
      });
    });
  },

  // Conditional updates based on current state
  conditionalUpdate(condition, action) {
    return dispatch((dispatch, getState) => {
      const currentState = getState();
      if (condition(currentState)) {
        dispatch(action);
      }
    });
  },

  // Complex habit completion with side effects
  completeHabitWithEffects(habitId, date) {
    return dispatch((dispatch, getState) => {
      const state = getState();
      const habit = Selectors.getHabitById(state, habitId);

      if (!habit) return;

      // Mark as completed
      dispatch(Actions.toggleHabitCompleted(habitId, date));

      // Check if this creates a streak
      const updatedState = getState();
      const updatedHabit = Selectors.getHabitById(updatedState, habitId);

      // Add streak logic here if needed
      // eslint-disable-next-line no-console
      console.log('Habit completed:', updatedHabit.name);
    });
  },
};

// Development utilities
export const DevUtils = {
  // Log current state structure
  logState() {
    // eslint-disable-next-line no-console
    console.table({
      habits: Selectors.getHabits().length,
      categories: Selectors.getCategories().length,
      selectedDate: Selectors.getSelectedDate(),
      selectedGroup: Selectors.getSelectedGroup(),
      isDarkMode: Selectors.isDarkMode(),
    });
  },

  // Validate state integrity
  validateState() {
    const habits = Selectors.getHabits();
    const categories = Selectors.getCategories();
    const categoryIds = new Set(categories.map((c) => c.id));

    const issues = [];

    // Check for habits with invalid categories
    habits.forEach((habit) => {
      if (habit.category && !categoryIds.has(habit.category)) {
        issues.push(`Habit "${habit.name}" has invalid category: ${habit.category}`);
      }
    });

    // Check for required fields
    habits.forEach((habit) => {
      if (!habit.id) issues.push(`Habit "${habit.name}" missing ID`);
      if (!habit.name) issues.push(`Habit with ID "${habit.id}" missing name`);
    });

    if (issues.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('State validation issues:', issues);
    } else {
      // eslint-disable-next-line no-console
      console.log('State validation passed');
    }

    return issues;
  },

  // Export state for debugging
  exportState() {
    return {
      habits: Selectors.getHabits(),
      categories: Selectors.getCategories(),
      settings: Selectors.getSettings(),
      selectedDate: Selectors.getSelectedDate(),
      selectedGroup: Selectors.getSelectedGroup(),
    };
  },
};

// Make utilities available globally in development
if (typeof window !== 'undefined' && process.env?.NODE_ENV === 'development') {
  window.StateHelpers = StateHelpers;
  window.UISelectors = UISelectors;
  window.DevUtils = DevUtils;
}

export default StateHelpers;
