// HabitsModule.js - Main module orchestrator for the habits view
import { HabitsView } from './HabitsView.js';
import { appData, subscribe } from '../core/state.js';

/**
 * Main HabitsModule that orchestrates the habits view
 */
export const HabitsModule = {
  /**
   * Initializes the habits module
   */
  async init() {
    const habitsView = document.getElementById('habits-view');
    if (!habitsView) {
      console.error('Habits view container not found');
      return;
    }

    // Mount the habits view with all components
    HabitsView.mount(habitsView, {
      onReorder: () => import('./modals/HabitReorderModal.js').then((m) => m.toggleReorderMode()),
      onNewCategory: this._handleNewCategory,
      onNewHabit: this._handleNewHabit,
      onSearch: this._handleSearch,
      onHabitClick: this._handleHabitClick,
    });

    // Subscribe to state changes for reactive updates
    subscribe(() => {
      this._handleStateChange();
    });

    // Set up responsive behavior
    HabitsView.setupResponsiveBehavior();

    // Initialize reorder event wiring ONCE
    import('./modals/HabitReorderModal.js').then((m) => m.initializeReorder());

    // Initial render
    this._handleStateChange();
  },

  /**
   * Handles new category button click
   */
  _handleNewCategory() {
    import('./ui/categories.js').then((m) => {
      m.initializeCategories();
      m.openAddCategoryModal();
    });
  },

  /**
   * Handles new habit button click
   */
  _handleNewHabit() {
    import('./modals/HabitFormModal.js').then((m) => m.openAddHabitModal());
  },

  /**
   * Handles search functionality
   */
  _handleSearch(searchTerm) {
    // Search is handled by the search module internally
    console.log('Search:', searchTerm);
  },

  /**
   * Handles habit item click
   */
  _handleHabitClick(habitId) {
    // This will be handled by the list module
    console.log('Habit clicked:', habitId);
  },

  /**
   * Handles state changes and re-renders the view
   */
  _handleStateChange() {
    // Re-render the habits list when state changes
    HabitsView.renderHabits(this._handleHabitClick);
  },
};

/**
 * Initialize function for lazy loading
 */
export async function init() {
  await HabitsModule.init();
}
