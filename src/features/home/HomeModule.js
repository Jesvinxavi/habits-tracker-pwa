// HomeModule.js - Main module orchestrator for the home view
import { HomeView } from './HomeView.js';
import { subscribe } from '../../core/state.js';
import { bindControls } from './helpers/controlHelpers.js';
import { setupMenuToggle, updateDropdownText, setSectionVisibility } from './helpers/uiHelpers.js';
import { sectionVisibility } from './helpers/coreHelpers.js';

/**
 * Main HomeModule that orchestrates the home view
 */
export const HomeModule = {
  /**
   * Initializes the home module
   */
  async init() {
    const homeView = document.getElementById('home-view');
    if (!homeView) {
      console.error('Home view container not found');
      return;
    }

    // Mount the home view with all components
    HomeView.mount(homeView, {
      onHabitComplete: this._handleHabitComplete,
      onHabitEdit: this._handleHabitEdit,
      onGroupChange: this._handleGroupChange,
      onDateChange: this._handleDateChange,
      onHolidayToggle: this._handleHolidayToggle,
      onSectionToggle: this._handleSectionToggle,
    });

    // Set up control bindings
    bindControls();

    // Set up menu toggle
    setupMenuToggle();

    // Set global sectionVisibility reference
    setSectionVisibility(sectionVisibility);

    // Initialize dropdown text
    updateDropdownText();

    // Subscribe to state changes for reactive updates
    subscribe(() => {
      this._handleStateChange();
    });

    // Set up responsive behavior
    HomeView.setupResponsiveBehavior();

    // Initial render
    this._handleStateChange();


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
    // Immediately refresh UI like backup7 does
    this._handleStateChange();
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

  // Make HomeModule available globally for component access
  if (typeof window !== 'undefined') {
    window.HomeModule = HomeModule;
    window.HomeView = HomeView;
  }
}
