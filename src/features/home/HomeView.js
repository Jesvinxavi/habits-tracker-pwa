// HomeView.js - Main view orchestrator for the home screen
import { HomeHeader } from './components/HomeHeader.js';
import { HomeCalendar } from './components/HomeCalendar.js';
import { HomeProgress } from './components/HomeProgress.js';
import { HomeHabitsList } from './components/HomeHabitsList.js';
import { HomeControls } from './components/HomeControls.js';
import { HomeSectionPills } from './components/HomeSectionPills.js';

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

    // Ensure a pills header exists between header and habits container
    let pillsHeader = this.container.querySelector('.section-pills-header');
    if (!pillsHeader) {
      pillsHeader = document.createElement('div');
      pillsHeader.className = 'section-pills-header home-inset-reduced';
      // Insert after the habits header and before the habits container
      const headerEl = this.container.querySelector('.habits-header');
      if (headerEl && this.habitsContainer && headerEl.parentNode) {
        headerEl.parentNode.insertBefore(pillsHeader, this.habitsContainer);
      }
    }
    this.pillsContainer = pillsHeader;
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

    // Mount section pills BEFORE habits list
    HomeSectionPills.mount(this.pillsContainer, {
      onSectionChange: (section) => {
        // When pills selection changes, update list selection
        if (typeof HomeHabitsList.setSelectedSection === 'function') {
          HomeHabitsList.setSelectedSection(section);
          HomeHabitsList.render();
        }
      },
    });

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
  render(invalidations = {}) {
    const renderAll = Object.keys(invalidations).length === 0;
    if (renderAll || invalidations.header) HomeHeader.render();
    if (renderAll || invalidations.calendar) HomeCalendar.render();
    if (renderAll || invalidations.progress) HomeProgress.render();
    if (renderAll || invalidations.pills) HomeSectionPills.render?.();
    if (renderAll || invalidations.habits || invalidations.pills) {
      HomeHabitsList.setSelectedSection?.(HomeSectionPills.getSelectedSection());
    }
    if (renderAll || invalidations.habits) HomeHabitsList.render();
    if (renderAll) HomeControls.render();
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
