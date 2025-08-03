import { dispatch, Actions } from '../../../core/state.js';
import { getPeriodKey } from '../schedule.js';
import { makeCardSwipable } from '../../../components/swipeableCard.js';
import { updateSectionVisibility, sectionVisibility as visObj } from './coreHelpers.js';
import { HomeHabitsList } from '../components/HomeHabitsList.js';

/* -------------------------------------------------------------------------- */
/*  SECTION VISIBILITY HELPERS                                                */
/* -------------------------------------------------------------------------- */

export function saveSectionVisibility(sectionVis) {
  localStorage.setItem('homeSectionVisibility', JSON.stringify(sectionVis));
}

export function setSectionVisibility(sectionVis) {
  // Set global reference to sectionVisibility for component access
  if (typeof window !== 'undefined') {
    window.sectionVisibility = sectionVis;
  }
}

export function updateDropdownText(sectionVisibility = visObj) {
  const completedItem = document.querySelector('[data-action="toggle-completed"] span:last-child');
  const skippedItem = document.querySelector('[data-action="toggle-skipped"] span:last-child');
  const eye =
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>';
  const eyeOff =
    '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.94 17.94A10.37 10.37 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 5-5" stroke-width="2"/><path d="M1 1l22 22" stroke-width="2"/></svg>';

  if (completedItem) {
    const iconSpan = completedItem.parentElement.querySelector('span:first-child');
    if (iconSpan) {
      iconSpan.innerHTML = sectionVisibility.Completed ? eyeOff : eye;
    }
    completedItem.textContent = (sectionVisibility.Completed ? 'Hide' : 'Show') + ' Completed';
  }
  if (skippedItem) {
    const iconSpan = skippedItem.parentElement.querySelector('span:first-child');
    if (iconSpan) {
      iconSpan.innerHTML = sectionVisibility.Skipped ? eyeOff : eye;
    }
    skippedItem.textContent = (sectionVisibility.Skipped ? 'Hide' : 'Show') + ' Skipped';
  }
}

/* -------------------------------------------------------------------------- */
/*  MENU TOGGLE HELPERS                                                        */
/* -------------------------------------------------------------------------- */

export function setupMenuToggle() {
  const menuBtn = document.getElementById('menu-toggle');
  const menuDropdown = document.getElementById('dropdown-menu');
  if (menuBtn && menuDropdown) {
    menuDropdown.classList.add('hidden');

    // Function to update the "Add New Habit" menu item state
    const updateAddHabitMenuItem = async () => {
      const addHabitItem = menuDropdown.querySelector('[data-action="add-habit"]');
      if (!addHabitItem) return;
      
      const { getState } = await import('../../../core/state.js');
      const hasCategories = getState().categories.length > 0;
      
      if (hasCategories) {
        addHabitItem.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        addHabitItem.title = '';
      } else {
        addHabitItem.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        addHabitItem.title = 'Create a category first before adding habits';
      }
    };

    // Initial state update
    updateAddHabitMenuItem();

    // Subscribe to state changes to update menu item when categories change
    import('../../../core/state.js').then((m) => {
      m.subscribe(() => {
        updateAddHabitMenuItem();
      });
    });

    menuBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // Update menu item state before showing dropdown
      updateAddHabitMenuItem();
      menuDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (ev) => {
      if (!menuDropdown.contains(ev.target) && !menuBtn.contains(ev.target)) {
        menuDropdown.classList.add('hidden');
      }
    });

    // Handle dropdown menu item clicks
    menuDropdown.addEventListener('click', async (ev) => {
      const menuItem = ev.target.closest('.dropdown-item');
      if (!menuItem) return;

      const action = menuItem.dataset.action;
      if (!action) return;

      // Check if the item is disabled
      if (menuItem.classList.contains('pointer-events-none')) {
        return;
      }

      // Hide the dropdown after clicking
      menuDropdown.classList.add('hidden');

      // Handle different actions
      switch (action) {
        case 'add-habit':
          import('../../../features/habits/modals/HabitFormModal.js').then((m) =>
            m.openAddHabitModal()
          );
          break;
        case 'manage-holidays':
          import('../../../features/holidays/manage.js').then((m) => m.openHolidayModal());
          break;
        case 'toggle-completed': {
          updateSectionVisibility(!visObj.Completed, visObj.Skipped);
          saveSectionVisibility(visObj);
          updateDropdownText();
          // Immediately refresh list without relying on global HomeView reference
          HomeHabitsList.render?.();
          break;
        }
        case 'toggle-skipped': {
          updateSectionVisibility(visObj.Completed, !visObj.Skipped);
          saveSectionVisibility(visObj);
          updateDropdownText();
          HomeHabitsList.render?.();
          break;
        }
      }
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  PROGRESS UTILITIES                                                         */
/* -------------------------------------------------------------------------- */

export function adjustProgress(habitId, max, delta) {
  dispatch((dispatch, getState) => {
    const state = getState();
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;
    
    const key = getPeriodKey(habit, new Date(state.selectedDate));
    const currentProgress = habit.progress?.[key] || 0;
    let next = currentProgress + delta;
    if (next < 0) next = 0;
    if (next > max) next = max;
    
    dispatch(Actions.setHabitProgress(habitId, key, next));
  });
}

/* -------------------------------------------------------------------------- */
/*  SWIPE RESTORE HELPER                                                      */
/* -------------------------------------------------------------------------- */

export function attachSwipeBehaviour(swipeContainer, slideEl, habit) {
  makeCardSwipable(swipeContainer, slideEl, habit, {
    onRestore: () => {
      dispatch((dispatch, getState) => {
        const state = getState();
        const habitState = state.habits.find((h) => h.id === habit.id);
        if (!habitState) return;
        
        // Toggle completion to false
        dispatch(Actions.toggleHabitCompleted(habit.id, getPeriodKey(habit, new Date(state.selectedDate))));
        
        // Clear progress if it's a target habit
        if (habitState.target) {
          const key = getPeriodKey(habitState, new Date(state.selectedDate));
          dispatch(Actions.setHabitProgress(habit.id, key, 0));
        }
      });
    },
  });
}
