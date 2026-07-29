// HomeModule.js - Main module orchestrator for the home view
import { HomeView } from './HomeView.js';
import { subscribe } from '../../core/state.js';
import { bindControls } from './helpers/controlHelpers.js';
import { setupMenuToggle, updateDropdownText, setSectionVisibility } from './helpers/uiHelpers.js';
import { sectionVisibility } from './helpers/coreHelpers.js';
import { shallowArrayEqual } from '../../shared/equality.js';

/**
 * Main HomeModule that orchestrates the home view
 */
export const HomeModule = {
  _initialized: false,
  _unsubscribe: null,

  /**
   * Initializes the home module
   */
  async init() {
    if (this._initialized) return;
    const homeView = document.getElementById('home-view');
    if (!homeView) {
      console.error('Home view container not found');
      return;
    }

    // Mount the home view with all components
    HomeView.mount(homeView, {
      onHabitComplete: this._handleHabitComplete.bind(this),
      onHabitEdit: this._handleHabitEdit.bind(this),
      onGroupChange: this._handleGroupChange.bind(this),
      onDateChange: this._handleDateChange.bind(this),
      onHolidayToggle: this._handleHolidayToggle.bind(this),
      onSectionToggle: this._handleSectionToggle.bind(this),
    });

    // Set up control bindings
    bindControls();

    // Set up menu toggle
    setupMenuToggle();

    // Set global sectionVisibility reference
    setSectionVisibility(sectionVisibility);

    // Initialize dropdown text
    updateDropdownText();

    // Set up responsive behavior
    HomeView.setupResponsiveBehavior();

    // Initial render
    this._handleStateChange();
    this._initialized = true;
  },

  activate() {
    if (!this._initialized || this._unsubscribe) return;
    this._unsubscribe = subscribe(
      (state) => [
        state.categories,
        state.habits,
        state.selectedDate,
        state.selectedGroup,
        state.settings,
        state.holidayDates,
        state.manualHolidayDates,
        state.holidayPeriods,
        state.homeSectionVisibility,
      ],
      () => this._handleStateChange(),
      { equalityFn: shallowArrayEqual }
    );
    this._handleStateChange();
  },

  deactivate() {
    this._unsubscribe?.();
    this._unsubscribe = null;
  },



  /**
   * Handles habit completion
   */
  _handleHabitComplete() {
    // State change will trigger HomeView.render() via subscription
  },

  /**
   * Handles habit editing
   */
  _handleHabitEdit() {
    // This will be handled by the home view internally
  },

  /**
   * Handles group change
   */
  _handleGroupChange() {
    // State change will trigger HomeView.render() via subscription
  },

  /**
   * Handles date change
   */
  _handleDateChange() {
    // State change will trigger HomeView.render() via subscription
  },

  /**
   * Handles holiday toggle
   */
  _handleHolidayToggle() {
    // The committed state change triggers the active-view subscription.
  },

  /**
   * Handles section toggle (Completed/Skipped)
   */
  _handleSectionToggle(section, collapsed) {
    if (section === 'completed') {
      sectionVisibility.Completed = !collapsed;
    } else if (section === 'skipped') {
      sectionVisibility.Skipped = !collapsed;
    }
    // State change will trigger HomeView.render() via subscription
    updateDropdownText();
  },

  /**
   * Handles state changes and re-renders the view
   */
  _handleStateChange() {
    // Re-render the home view when state changes
    HomeView.render();
  },


};

/**
 * Initialize function for lazy loading
 */
export async function init() {
  await HomeModule.init();
}
