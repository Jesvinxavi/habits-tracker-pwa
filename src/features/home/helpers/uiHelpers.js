import { getState, dispatch, Actions, subscribe } from '../../../core/state.js';
import { updateSectionVisibility, sectionVisibility as visObj } from './coreHelpers.js';
import { HomeHabitsList } from '../components/HomeHabitsList.js';
import { HomeSectionPills } from '../components/HomeSectionPills.js';

/* -------------------------------------------------------------------------- */
/*  SECTION VISIBILITY HELPERS                                                */
/* -------------------------------------------------------------------------- */

export async function saveSectionVisibility(sectionVis) {
  return dispatch(Actions.updateHomeSectionVisibility(sectionVis));
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

let menuCategoryUpdater = null;
let menuCategoryUnsubscribe = null;

export function activateMenuToggleState() {
  if (!menuCategoryUpdater || menuCategoryUnsubscribe) return;
  menuCategoryUnsubscribe = subscribe(
    (state) => state.categories,
    () => menuCategoryUpdater()
  );
  menuCategoryUpdater();
}

export function deactivateMenuToggleState() {
  menuCategoryUnsubscribe?.();
  menuCategoryUnsubscribe = null;
}

export function setupMenuToggle() {
  const menuBtn = document.getElementById('menu-toggle');
  const menuDropdown = document.getElementById('dropdown-menu');
  if (menuBtn && menuDropdown) {
    menuDropdown.classList.add('hidden');

    // Function to update the "Add New Habit" menu item state
    const updateAddHabitMenuItem = () => {
      const addHabitItem = menuDropdown.querySelector('[data-action="add-habit"]');
      if (!addHabitItem) return;
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
    menuCategoryUpdater = updateAddHabitMenuItem;

    menuBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // Update menu item state before showing dropdown
      updateAddHabitMenuItem();
      menuDropdown.classList.toggle('hidden');
      menuBtn.setAttribute('aria-expanded', String(!menuDropdown.classList.contains('hidden')));
    });

    document.addEventListener('click', (ev) => {
      if (!menuDropdown.contains(ev.target) && !menuBtn.contains(ev.target)) {
        menuDropdown.classList.add('hidden');
        menuBtn.setAttribute('aria-expanded', 'false');
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
      menuBtn.setAttribute('aria-expanded', 'false');

      // Handle different actions
      switch (action) {
        case 'add-habit': {
          const { openAddHabitModal } = await import(
            '../../habits/modals/HabitFormModal.js'
          );
          openAddHabitModal();
          break;
        }
        case 'manage-holidays': {
          const { openHolidayModal } = await import('../../holidays/manage.js');
          openHolidayModal();
          break;
        }
        case 'toggle-completed': {
          const previous = { ...visObj };
          updateSectionVisibility(!visObj.Completed, visObj.Skipped);
          const saved = await saveSectionVisibility(visObj);
          if (!saved) {
            updateSectionVisibility(previous.Completed, previous.Skipped);
            break;
          }
          updateDropdownText();
          HomeSectionPills.render?.();
          if (typeof HomeHabitsList.setSelectedSection === 'function') {
            HomeHabitsList.setSelectedSection(HomeSectionPills.getSelectedSection?.() || 'Anytime');
          }
          HomeHabitsList.render?.();
          break;
        }
        case 'toggle-skipped': {
          const previous = { ...visObj };
          updateSectionVisibility(visObj.Completed, !visObj.Skipped);
          const saved = await saveSectionVisibility(visObj);
          if (!saved) {
            updateSectionVisibility(previous.Completed, previous.Skipped);
            break;
          }
          updateDropdownText();
          HomeSectionPills.render?.();
          if (typeof HomeHabitsList.setSelectedSection === 'function') {
            HomeHabitsList.setSelectedSection(HomeSectionPills.getSelectedSection?.() || 'Anytime');
          }
          HomeHabitsList.render?.();
          break;
        }
      }
    });
  }
}
