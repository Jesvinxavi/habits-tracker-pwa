// HabitsModule.js - Main module orchestrator for the habits view
import { HabitsView } from './HabitsView.js';
import { subscribe } from '../../core/state.js';
import { shallowArrayEqual } from '../../shared/equality.js';
// New/Edit Habit must already be available when this page is mounted; see the
// matching phone-preview rationale in Home's uiHelpers.
import { openAddHabitModal } from './modals/HabitFormModal.js';

/**
 * Main HabitsModule that orchestrates the habits view
 */
export const HabitsModule = {
  _initialized: false,
  _unsubscribe: null,

  /**
   * Initializes the habits module
   */
  async init() {
    if (this._initialized) return;
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

    // Set up responsive behavior
    HabitsView.setupResponsiveBehavior();

    // Initialize reorder event wiring ONCE
    import('./modals/HabitReorderModal.js').then((m) => m.initializeReorder());

    // Initial render
    this._handleStateChange();
    this._initialized = true;
  },

  activate() {
    if (!this._initialized || this._unsubscribe) return;
    HabitsView.activate();
    this._unsubscribe = subscribe(
      (state) => [state.categories, state.habits, state.settings],
      () => this._handleStateChange(),
      { equalityFn: shallowArrayEqual }
    );
    this._handleStateChange();
  },

  deactivate() {
    this._unsubscribe?.();
    this._unsubscribe = null;
    HabitsView.deactivate();
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
    openAddHabitModal();
  },

  /**
   * Handles search functionality
   */
  _handleSearch() {
    // Search is handled by the search module internally
  },

  /**
   * Handles habit item click
   */
  _handleHabitClick() {
    // This will be handled by the list module
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
