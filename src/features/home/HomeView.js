// HomeView.js - Main view orchestrator for the home screen
import { HomeHeader } from './components/HomeHeader.js';
import { HomeCalendar } from './components/HomeCalendar.js';
import { HomeProgress } from './components/HomeProgress.js';
import { HomeHabitsList } from './components/HomeHabitsList.js';
import { HomeControls } from './components/HomeControls.js';

/**
 * Main HomeView that orchestrates all home components
 */
export const HomeView = {
  /**
   * Mounts the home view with all components
   */
  mount(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    // Don't clear existing content - work with the existing HTML structure
    // container.innerHTML = '';

    // Create the main structure
    this._createStructure();

    // Mount all components
    this._mountComponents();

    // Set up responsive behavior
    this.setupResponsiveBehavior();
  },

  /**
   * Creates the main DOM structure
   */
  _createStructure() {
    // Don't replace the existing HTML structure - work with what's already there
    // The HTML already has the proper structure, we just need to mount components to existing elements

    // Store references to existing containers
    this.headerContainer = this.container.querySelector('.habits-header .habits-title');
    this.calendarContainer = this.container.querySelector('.week-calendar');
    this.progressContainer = this.container.querySelector('.progress-section');
    this.habitsContainer = this.container.querySelector('.habits-container');
    this.controlsContainer = this.container.querySelector('.habits-header');
  },

  /**
   * Mounts all individual components
   */
  _mountComponents() {
    // Mount header
    HomeHeader.mount(this.headerContainer, {
      onGroupChange: this.callbacks.onGroupChange,
      onHolidayToggle: this.callbacks.onHolidayToggle,
    });

    // Mount calendar
    HomeCalendar.mount(this.calendarContainer, {
      onDateChange: this.callbacks.onDateChange,
    });

    // Mount progress
    HomeProgress.mount(this.progressContainer);

    // Mount habits list
    HomeHabitsList.mount(this.habitsContainer, {
      onHabitComplete: this.callbacks.onHabitComplete,
      onHabitEdit: this.callbacks.onHabitEdit,
      onSectionToggle: this.callbacks.onSectionToggle,
    });

    // Mount controls
    HomeControls.mount(this.controlsContainer, {
      onHabitComplete: this.callbacks.onHabitComplete,
      onHabitEdit: this.callbacks.onHabitEdit,
    });
  },

  /**
   * Renders the entire home view
   */
  render() {
    // Update all components
    HomeHeader.render();
    HomeCalendar.render();
    HomeProgress.render();
    HomeHabitsList.render();
    HomeControls.render();
  },

  /**
   * Sets up responsive behavior
   */
  setupResponsiveBehavior() {
    // Adjust habits container height for mobile
    this._adjustHabitsContainerHeight();

    // Listen for window resize
    window.addEventListener('resize', () => {
      this._adjustHabitsContainerHeight();
    });
  },

  /**
   * Adjusts the habits container height for mobile
   */
  _adjustHabitsContainerHeight() {
    if (typeof window === 'undefined') return;

    const container = this.habitsContainer;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    // Subtract bottom padding (e.g. from pb-20 on .content-area) so last items are fully visible
    let bottomPadding = 0;
    const content = this.container.closest('.content-area');
    if (content) {
      const cs = window.getComputedStyle(content);
      bottomPadding = parseFloat(cs.paddingBottom) || 0;
    }
    const available = window.innerHeight - rect.top - bottomPadding;
    if (available > 0) {
      container.style.maxHeight = available + 'px';
      container.style.overflowY = 'auto';
    }
  },

  /**
   * Unmounts the home view
   */
  unmount() {
    // Unmount all components
    HomeHeader.unmount();
    HomeCalendar.unmount();
    HomeProgress.unmount();
    HomeHabitsList.unmount();
    HomeControls.unmount();

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  },
};
