// HomeModule.js - Main module orchestrator for the home view
import { HomeView } from './HomeView.js';
import { getState, subscribe } from '../../core/state.js';
import { bindControls } from './helpers/controlHelpers.js';
import {
  activateMenuToggleState,
  deactivateMenuToggleState,
  setupMenuToggle,
  updateDropdownText,
  setSectionVisibility,
} from './helpers/uiHelpers.js';
import { sectionVisibility } from './helpers/coreHelpers.js';
import { shallowArrayEqual } from '../../shared/equality.js';

const HOME_SLICE = Object.freeze({
  categories: 0,
  habits: 1,
  selectedDate: 2,
  selectedGroup: 3,
  holidayDates: 4,
  manualHolidayDates: 5,
  holidayPeriods: 6,
  homeSectionVisibility: 7,
});

function selectHomeState(state) {
  return [
    state.categories,
    state.habits,
    state.selectedDate,
    state.selectedGroup,
    state.holidayDates,
    state.manualHolidayDates,
    state.holidayPeriods,
    state.homeSectionVisibility,
  ];
}

/**
 * Translate the Home selector tuple into component-level invalidations.
 * Keeping this explicit prevents a theme, sync-status, or header-only update
 * from destroying and rebuilding every swipeable habit card.
 */
export function getHomeInvalidations(next, previous) {
  if (!previous) {
    return {
      header: true,
      calendar: true,
      progress: true,
      pills: true,
      habits: true,
    };
  }

  const changed = (slice) => !Object.is(next[slice], previous[slice]);
  const habitsChanged = changed(HOME_SLICE.habits);
  const dateChanged = changed(HOME_SLICE.selectedDate);
  const groupChanged = changed(HOME_SLICE.selectedGroup);
  const holidaysChanged =
    changed(HOME_SLICE.holidayDates) ||
    changed(HOME_SLICE.manualHolidayDates) ||
    changed(HOME_SLICE.holidayPeriods);
  const visibilityChanged = changed(HOME_SLICE.homeSectionVisibility);

  return {
    header: dateChanged || groupChanged || holidaysChanged,
    calendar: habitsChanged || dateChanged || groupChanged || holidaysChanged,
    progress: habitsChanged || dateChanged || groupChanged || holidaysChanged,
    pills: habitsChanged || dateChanged || groupChanged || holidaysChanged || visibilityChanged,
    habits:
      changed(HOME_SLICE.categories) ||
      habitsChanged ||
      dateChanged ||
      groupChanged ||
      holidaysChanged ||
      visibilityChanged,
  };
}

/**
 * Main HomeModule that orchestrates the home view
 */
export const HomeModule = {
  _initialized: false,
  _unsubscribe: null,
  _renderedSelection: null,

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

    // Initial render
    this._handleStateChange();
    this._initialized = true;
  },

  activate() {
    if (!this._initialized || this._unsubscribe) return;
    activateMenuToggleState();
    this._unsubscribe = subscribe(
      selectHomeState,
      (next, previous) => this._handleStateChange(next, previous),
      { equalityFn: shallowArrayEqual }
    );
    this._handleStateChange();
  },

  deactivate() {
    this._unsubscribe?.();
    this._unsubscribe = null;
    deactivateMenuToggleState();
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
  _handleStateChange(next = selectHomeState(getState()), previous = this._renderedSelection) {
    HomeView.render(getHomeInvalidations(next, previous));
    this._renderedSelection = next;
  },


};

/**
 * Initialize function for lazy loading
 */
export async function init() {
  await HomeModule.init();
}
