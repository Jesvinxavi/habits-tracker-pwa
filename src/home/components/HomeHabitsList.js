// HomeHabitsList.js - Habits list component for the home view
import * as scheduleUtils from '../schedule.js';
import { appData, mutate } from '../../core/state.js';
import { makeCardSwipable } from '../../components/swipeableCard.js';
import { hexToRgba, tintedLinearGradient } from '../../utils/color.js';
import { dateToKey } from '../../utils/datetime.js';
import { sectionVisibility } from '../helpers/coreHelpers.js';

// Local aliases for schedule helpers
const {
  belongsToSelectedGroup,
  isHabitScheduledOnDate,
  isHabitCompleted,
  isHabitSkippedToday,
  getPeriodKey,
  setHabitCompleted,
  toggleHabitCompleted,
} = scheduleUtils;

// Track collapse state for Completed & Skipped sections so it persists across re-renders
const sectionCollapseState = {
  Completed: false,
  Skipped: false,
};

/**
 * HomeHabitsList component that manages habit rendering
 */
export const HomeHabitsList = {
  /**
   * Mounts the habits list component
   */
  mount(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this._createContainer();
    this.render();
  },

  /**
   * Creates the container structure
   */
  _createContainer() {
    // The container is already the .habits-container element
    // We just need to clean up any existing content and prepare it for dynamic rendering
    if (this.container) {
      // Remove white background box from habits container (static HTML)
      this.container.classList.remove('bg-white', 'dark:bg-gray-800', 'shadow-ios', 'rounded-2xl');
      this.container.style.background = 'transparent';
      this.container.style.boxShadow = 'none';
      this.container.style.borderRadius = '0';
    }

    // Clean up any static demo cards that were hard-coded in the HTML
    this.container.querySelectorAll('.habit-card').forEach((el) => el.remove());
  },

  /**
   * Renders the habits list
   */
  render() {
    if (!this.container) return;

    // Clear previous dynamic content
    this.container.innerHTML = '';

    const date = new Date(appData.selectedDate);
    const group = appData.selectedGroup;

    // Filter habits
    const habits = appData.habits.filter(
      (h) => belongsToSelectedGroup(h, group) && isHabitScheduledOnDate(h, date)
    );

    // If no habits scheduled, render placeholder
    if (habits.length === 0) {
      this._renderEmptyPlaceholder(group);
      return;
    }

    // Categorize habits
    const skippedArr = habits.filter(
      (h) => !isHabitCompleted(h, date) && isHabitSkippedToday(h, date)
    );
    const incompleteActive = habits.filter(
      (h) => !isHabitCompleted(h, date) && !isHabitSkippedToday(h, date)
    );
    const anytime = incompleteActive.filter((h) => !h.scheduledTime);
    const scheduled = incompleteActive.filter((h) => h.scheduledTime);
    const completedArr = habits.filter((h) => isHabitCompleted(h, date));

    // Build sections
    const frag = document.createDocumentFragment();

    const anytimeSection = this._buildSection('Anytime', anytime);
    const schedSection = this._buildSection('Scheduled', scheduled);
    const completedSection = this._buildSection('Completed', completedArr);
    const skippedSection = this._buildSection('Skipped', skippedArr);

    if (anytimeSection) frag.appendChild(anytimeSection);
    if (schedSection) frag.appendChild(schedSection);
    if (completedSection) frag.appendChild(completedSection);
    if (skippedSection) frag.appendChild(skippedSection);

    this.container.appendChild(frag);
  },

  /**
   * Renders empty placeholder
   */
  _renderEmptyPlaceholder(group) {
    const placeholder = document.createElement('div');
    placeholder.className =
      'empty-placeholder flex flex-col items-center justify-center py-10 mt-6 text-gray-400';

    const msgMap = {
      daily: 'No Scheduled Habits Today',
      weekly: 'No Scheduled Habits This Week',
      monthly: 'No Scheduled Habits This Month',
      yearly: 'No Scheduled Habits This Year',
    };
    const msg = msgMap[group] || 'No Scheduled Habits';

    placeholder.innerHTML = `
      <div class="w-[4.5rem] h-[4.5rem] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <svg class="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 17l-4-4 1.41-1.41L9 14.17l8.59-8.59L19 7l-10 10z"/>
        </svg>
      </div>
      <p class="text-lg font-medium">${msg}</p>`;

    this.container.appendChild(placeholder);
  },

  /**
   * Builds a section of habits
   */
  _buildSection(title, list) {
    // If section hidden return null early
    if (
      (title === 'Completed' && !sectionVisibility.Completed) ||
      (title === 'Skipped' && !sectionVisibility.Skipped)
    ) {
      return null;
    }

    const wrapper = document.createElement('div');
    const isCollapsible = title === 'Completed' || title === 'Skipped';
    wrapper.className = 'habits-section' + (isCollapsible ? ' collapsible' : '');
    if (isCollapsible) {
      wrapper.id = title.toLowerCase() + '-section';
    }

    // Inline padding for tighter vertical spacing
    wrapper.style.paddingTop = '0.5rem';
    wrapper.style.paddingBottom = '0.5rem';

    // Header row with optional toggle
    let headerHTML = `<h3 class="section-label text-base font-semibold m-0">${title}${isCollapsible ? ` <span class="opacity-60">(${list.length})</span>` : ''}</h3>`;
    if (isCollapsible) {
      const isCollapsed = sectionCollapseState[title] || false;
      headerHTML +=
        '<button class="toggle-section flex items-center gap-1 text-sm font-medium select-none ml-auto self-start p-0 bg-none border-none outline-none cursor-pointer" style="user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">' +
        `<span style="user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;">${isCollapsed ? 'Show' : 'Hide'}</span>` +
        `<svg class="w-4 h-4 transition-transform duration-200" viewBox="0 0 24 24" stroke="currentColor" fill="none" ${isCollapsed ? 'transform rotate-180' : ''}>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>`;
    }

    wrapper.innerHTML = `<div class="section-header flex items-center mb-0.5 home-inset">${headerHTML}</div>`;

    if (list.length === 0) {
      return null;
    }

    // Apply collapsed state before adding cards
    if (isCollapsible && sectionCollapseState[title]) {
      wrapper.classList.add('collapsed');
    }

    // Add habit cards
    list.forEach((habit) => {
      const card = this._buildHabitCard(habit);
      if (card) {
        // Determine if we need swipe functionality
        const date = new Date(appData.selectedDate);
        let cardToAdd = card;

        if (isHabitCompleted(habit, date) || isHabitSkippedToday(habit, date)) {
          // Create swipe-to-restore container
          cardToAdd = this._createSwipeToRestoreContainer(card, habit);
        } else {
          // Create swipe-to-skip container
          cardToAdd = this._createSwipeToSkipContainer(card, habit);
        }

        wrapper.appendChild(cardToAdd);
      }
    });

    // Toggle handler
    if (isCollapsible) {
      const toggleBtn = wrapper.querySelector('.toggle-section');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const collapsed = wrapper.classList.toggle('collapsed');
          sectionCollapseState[title] = collapsed;

          // Update arrow rotation and label
          const svg = toggleBtn.querySelector('svg');
          if (svg) svg.style.transform = collapsed ? 'rotate(180deg)' : 'rotate(0deg)';
          const textSpan = toggleBtn.querySelector('span');
          if (textSpan) textSpan.textContent = collapsed ? 'Show' : 'Hide';
        });
      }
    }

    return wrapper;
  },

  /**
   * Builds a single habit card
   */
  _buildHabitCard(habit) {
    const date = new Date(appData.selectedDate);
    const hasTarget = typeof habit.target === 'number' && habit.target > 0;
    const cat = appData.categories.find((c) => c.id === habit.categoryId) || {
      color: '#888',
      name: '',
    };

    const card = document.createElement('div');
    card.className = 'habit-card flex items-center px-4 py-2 rounded-xl';
    card.style.marginBottom = '0.25rem';
    card.dataset.habitId = habit.id;
    card.style.width = '100%';

    // Determine today progress
    const periodKey = getPeriodKey(habit, date);
    let curProgress = hasTarget && habit.progress ? habit.progress[periodKey] || 0 : 0;

    // Build card content
    const left = `<div class="habit-icon w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center mr-1 text-xl" style="border:2px solid ${cat.color}; color:${cat.color}">${
      habit.icon || '📋'
    }</div>`;

    let middle = `<div class="habit-content flex-grow">
        <div class="habit-name font-semibold leading-tight">${habit.name}</div>`;

    // Category pill
    middle += `<span class="category-pill inline-block whitespace-nowrap px-2 py-0.5 rounded-lg text-xs font-medium mt-0" style="display:inline-block;width:max-content;background:${cat.color};color:#fff;border-radius:8px;">${cat.name || ''}</span>`;

    // Build right side
    let right = '';
    if (hasTarget) {
      // Target habit - progress indicator
      card.style.position = 'relative';
      const setFill = (pct) => {
        card.style.background = tintedLinearGradient(cat.color, pct);
      };
      setFill(habit.target ? Math.min(curProgress / habit.target, 1) : 0);

      const progressBox = document.createElement('div');
      progressBox.className = 'progress-box px-2 py-0.5 text-xs font-bold rounded-md mb-1';
      progressBox.style.border = `1px solid ${cat.color}`;
      progressBox.style.color = '#000';
      progressBox.style.background = '#FFFFFF';
      progressBox.textContent = `${curProgress}/${habit.target}`;

      const unitText = habit.targetUnit && habit.targetUnit !== 'none' ? habit.targetUnit : null;

      const rightWrap = document.createElement('div');
      rightWrap.className = 'ml-auto flex flex-col items-end';
      rightWrap.style.position = 'relative';
      rightWrap.style.zIndex = '1';
      rightWrap.appendChild(progressBox);

      if (unitText) {
        const unitPill = document.createElement('span');
        unitPill.className =
          'unit-pill whitespace-nowrap px-2 py-0.5 rounded-lg text-xs font-medium';
        unitPill.style.background = `${cat.color}`;
        unitPill.style.color = '#fff';
        unitPill.textContent = unitText;
        rightWrap.appendChild(unitPill);
      }

      card.appendChild(rightWrap);
    } else {
      // Non-target habit - completion toggle
      const checked = isHabitCompleted(habit, date) ? '✔️' : '';
      let timePill = '';
      if (habit.scheduledTime) {
        timePill = `<span class="time-pill whitespace-nowrap px-3 py-1 rounded-lg text-sm font-semibold mr-1" style="background:${cat.color}; color:#fff;border-radius:8px;font-size:0.875rem;">${habit.scheduledTime}</span>`;
      }
      right = `<div class="ml-auto flex items-center gap-1">${timePill}<button class="complete-toggle w-8 h-8 rounded-full flex items-center justify-center" style="border:2px solid ${cat.color}; color:${cat.color}">${checked}</button></div>`;
    }

    middle += '</div>';
    card.innerHTML = left + middle + right;

    // Background and border
    if (!hasTarget) {
      card.style.background = hexToRgba(cat.color, 0.07);
    }
    card.style.border = `3px solid ${cat.color}`;

    // Add event listeners
    if (!hasTarget) {
      const toggleBtn = card.querySelector('.complete-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          mutate((s) => {
            const h = s.habits.find((hh) => hh.id === habit.id);
            if (!h) return;
            toggleHabitCompleted(h, new Date(appData.selectedDate));
          });

          if (this.callbacks.onHabitComplete) {
            this.callbacks.onHabitComplete(habit.id, !isHabitCompleted(habit, date));
          }
        });
      }
    }

    // Handle completed/skipped styling
    if (isHabitCompleted(habit, date)) {
      this._applyCompletedStyling(card, habit);
    } else if (isHabitSkippedToday(habit, date)) {
      this._applySkippedStyling(card, habit);
    }

    return card;
  },

  /**
   * Applies completed styling to a card
   */
  _applyCompletedStyling(card, habit) {
    card.style.border = '3px solid #4B5563';
    card.style.background = '#F3F4F6';

    const catPill = card.querySelector('.category-pill');
    if (catPill) {
      catPill.style.background = '#9CA3AF';
      catPill.style.color = '#fff';
    }

    // Remove existing right-side elements
    card
      .querySelectorAll(
        '.ml-auto, .habit-counter, .target-pill, .complete-toggle, .time-pill, .progress-box'
      )
      .forEach((el) => el.remove());

    // Add completed pill
    const donePill = document.createElement('div');
    donePill.className = 'completed-pill flex items-center gap-1 px-3 py-1 rounded-lg';
    donePill.style.border = '2px solid #16A34A';
    donePill.style.background = '#DCFCE7';
    donePill.style.color = '#16A34A';
    donePill.innerHTML =
      '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.2l-3.5-3.5 1.42-1.42L9 13.34 17.59 4.75 19 6.17z"/></svg><span class="text-sm font-semibold">Completed</span>';

    card.appendChild(donePill);

    // Grey icon border
    const iconEl = card.querySelector('.habit-icon');
    if (iconEl) {
      iconEl.style.border = '2px solid #9CA3AF';
      iconEl.style.color = '#9CA3AF';
    }

    // Swipe functionality will be added after the card is in the DOM
  },

  /**
   * Applies skipped styling to a card
   */
  _applySkippedStyling(card, habit) {
    card.style.border = '3px solid #4B5563';
    card.style.background = '#F3F4F6';

    const iconEl = card.querySelector('.habit-icon');
    if (iconEl) {
      iconEl.style.border = '2px solid #9CA3AF';
      iconEl.style.color = '#9CA3AF';
    }

    const catPill = card.querySelector('.category-pill');
    if (catPill) {
      catPill.style.background = '#9CA3AF';
      catPill.style.color = '#fff';
    }

    card
      .querySelectorAll(
        '.ml-auto, .habit-counter, .target-pill, .complete-toggle, .time-pill, .progress-box'
      )
      .forEach((el) => el.remove());

    const skipPill = document.createElement('div');
    skipPill.className = 'skipped-pill flex items-center gap-1 px-3 py-1 rounded-lg';
    skipPill.style.border = '2px solid #F97316';
    skipPill.style.background = '#FFEDD5';
    skipPill.style.color = '#F97316';
    skipPill.innerHTML =
      '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zm9-12v12h2V6h-2z"/></svg><span class="text-sm font-semibold">Skipped</span>';

    card.appendChild(skipPill);

    // Swipe functionality will be added after the card is in the DOM
  },

  /**
   * Creates a swipe-to-restore container
   */
  _createSwipeToRestoreContainer(card, habit) {
    const swipeContainer = document.createElement('div');
    swipeContainer.className = 'swipe-container relative overflow-visible home-inset';

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'restore-btn absolute top-0 right-0 h-full';
    restoreBtn.style.width = '20%';
    restoreBtn.style.background = '#16A34A';
    restoreBtn.style.color = '#fff';
    restoreBtn.style.borderRadius = '0.75rem';
    restoreBtn.style.fontWeight = '600';
    restoreBtn.textContent = 'Restore';

    const slideEl = document.createElement('div');
    slideEl.className = 'swipe-slide transition-transform';
    slideEl.style.width = '100%';
    slideEl.style.position = 'relative';
    slideEl.style.zIndex = '1';
    slideEl.style.background = '#FFFFFF';
    slideEl.style.borderRadius = '0.75rem';

    swipeContainer.appendChild(restoreBtn);
    swipeContainer.appendChild(slideEl);

    // Add the card to the slide element
    slideEl.appendChild(card);

    // Determine the restore action based on habit state
    const date = new Date(appData.selectedDate);
    const isCompleted = isHabitCompleted(habit, date);
    const isSkipped = isHabitSkippedToday(habit, date);

    if (isCompleted) {
      // For completed habits: set completion to false and clear progress
      makeCardSwipable(swipeContainer, slideEl, habit, {
        onRestore: () => {
          mutate((s) => {
            const h = s.habits.find((hh) => hh.id === habit.id);
            if (!h) return;
            setHabitCompleted(h, new Date(appData.selectedDate), false);
            if (h.target) {
              const key = getPeriodKey(h, new Date(appData.selectedDate));
              if (h.progress) delete h.progress[key];
            }
          });
        },
      });
    } else if (isSkipped) {
      // For skipped habits: remove from skippedDates array
      makeCardSwipable(swipeContainer, slideEl, habit, {
        onRestore: () => {
          const dayKey = dateToKey(new Date(appData.selectedDate));
          mutate((s) => {
            const h = s.habits.find((hh) => hh.id === habit.id);
            if (!h) return;
            if (Array.isArray(h.skippedDates)) {
              h.skippedDates = h.skippedDates.filter((d) => d !== dayKey);
            }
          });
        },
      });
    }

    return swipeContainer;
  },

  /**
   * Creates a swipe-to-skip container
   */
  _createSwipeToSkipContainer(card, habit) {
    const swipeContainer = document.createElement('div');
    swipeContainer.className = 'swipe-container relative overflow-visible home-inset';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'skip-btn absolute top-0 right-0 h-full';
    skipBtn.style.width = '20%';
    skipBtn.style.background = '#F97316';
    skipBtn.style.color = '#fff';
    skipBtn.style.borderRadius = '0.75rem';
    skipBtn.style.fontWeight = '600';
    skipBtn.textContent = 'Skip';

    const slideEl = document.createElement('div');
    slideEl.className = 'swipe-slide transition-transform';
    slideEl.style.width = '100%';
    slideEl.style.position = 'relative';
    slideEl.style.zIndex = '1';
    slideEl.style.background = '#FFFFFF';
    slideEl.style.borderRadius = '0.75rem';

    swipeContainer.appendChild(skipBtn);
    swipeContainer.appendChild(slideEl);

    // Add the card to the slide element
    slideEl.appendChild(card);

    makeCardSwipable(swipeContainer, slideEl, habit);

    // Skip action
    skipBtn.addEventListener('click', () => {
      const dayKey = dateToKey(new Date(appData.selectedDate));
      mutate((s) => {
        const h = s.habits.find((hh) => hh.id === habit.id);
        if (!h) return;
        if (!Array.isArray(h.skippedDates)) h.skippedDates = [];
        if (!h.skippedDates.includes(dayKey)) h.skippedDates.push(dayKey);
      });
    });

    return swipeContainer;
  },

  /**
   * Unmounts the habits list component
   */
  unmount() {
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  },
};

/**
 * Standalone function for rendering habits (for external use)
 */
export function renderHabitsForHome() {
  HomeHabitsList.render();
}
