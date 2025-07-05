// HomeModule.js - Main module orchestrator for the home view
import { HomeView } from './HomeView.js';
import { appData, subscribe } from '../core/state.js';
import { refreshUI, setCalendarApi } from './helpers/refreshHelpers.js';
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
    console.log('HomeModule: Initializing...');

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

    // Expose debug functions
    this._exposeDebugFunctions();

    console.log('HomeModule: Initialized successfully');
  },

  /**
   * Sets the calendar API reference for refresh coordination
   */
  setCalendarApi(api) {
    setCalendarApi(api);
  },

  /**
   * Handles habit completion
   */
  _handleHabitComplete(habitId, completed) {
    console.log('Habit completed:', habitId, completed);
    refreshUI();
  },

  /**
   * Handles habit editing
   */
  _handleHabitEdit(habitId) {
    console.log('Habit edit:', habitId);
    // This will be handled by the home view internally
  },

  /**
   * Handles group change
   */
  _handleGroupChange(group) {
    console.log('Group changed:', group);
    refreshUI();
  },

  /**
   * Handles date change
   */
  _handleDateChange(date) {
    console.log('Date changed:', date);
    refreshUI();
  },

  /**
   * Handles holiday toggle
   */
  _handleHolidayToggle(enabled) {
    console.log('Holiday toggle:', enabled);
    refreshUI();
  },

  /**
   * Handles section toggle (Completed/Skipped)
   */
  _handleSectionToggle(section, collapsed) {
    console.log('Section toggle:', section, collapsed);
    if (section === 'completed') {
      sectionVisibility.Completed = !collapsed;
    } else if (section === 'skipped') {
      sectionVisibility.Skipped = !collapsed;
    }
    refreshUI();
    updateDropdownText();
  },

  /**
   * Handles state changes and re-renders the view
   */
  _handleStateChange() {
    // Re-render the home view when state changes
    HomeView.render();
    refreshUI();
  },

  /**
   * Exposes refreshUI for external use
   */
  refresh() {
    refreshUI();
  },

  /**
   * Exposes functions for console debugging
   */
  _exposeDebugFunctions() {
    if (typeof window !== 'undefined') {
      window.renderHabitsForHome = () => {
        if (window.HomeView) {
          window.HomeView.render();
        }
      };
      // Note: These functions are available from schedule.js but we'll expose them
      // through the HomeModule for debugging purposes
      window.belongsToSelectedGroup = (habit, group) => {
        // This will be available after the module loads
        console.log('belongsToSelectedGroup called with:', habit, group);
        return true; // Fallback
      };
      window.isHabitScheduledOnDate = (habit, date) => {
        // This will be available after the module loads
        console.log('isHabitScheduledOnDate called with:', habit, date);
        return true; // Fallback
      };
    }
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
