import { mutate, appData } from '../../../core/state.js';
import { getPeriodKey, setHabitCompleted } from '../schedule.js';
import { makeCardSwipable } from '../../../components/swipeableCard.js';

/* -------------------------------------------------------------------------- */
/*  SECTION VISIBILITY HELPERS                                                */
/* -------------------------------------------------------------------------- */

// Global sectionVisibility reference
let globalSectionVisibility = { Completed: true, Skipped: true };

export function setSectionVisibility(visibility) {
  globalSectionVisibility = visibility;
}

export function saveSectionVisibility(sectionVisibility) {
  localStorage.setItem('homeSectionVisibility', JSON.stringify(sectionVisibility));
}

export function updateDropdownText(sectionVisibility = globalSectionVisibility) {
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

    menuBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      menuDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (ev) => {
      if (!menuDropdown.contains(ev.target) && !menuBtn.contains(ev.target)) {
        menuDropdown.classList.add('hidden');
      }
    });

    // Handle dropdown menu item clicks
    menuDropdown.addEventListener('click', (ev) => {
      const menuItem = ev.target.closest('.dropdown-item');
      if (!menuItem) return;

      const action = menuItem.dataset.action;
      if (!action) return;

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
        case 'toggle-completed':
          mutate((s) => {
            s.settings.hideCompleted = !s.settings.hideCompleted;
          });
          break;
        case 'toggle-skipped':
          mutate((s) => {
            s.settings.hideSkipped = !s.settings.hideSkipped;
          });
          break;
      }
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  PROGRESS UTILITIES                                                         */
/* -------------------------------------------------------------------------- */

export function adjustProgress(habitId, max, delta) {
  mutate((s) => {
    const h = s.habits.find((hh) => hh.id === habitId);
    if (!h) return;
    const key = getPeriodKey(h, new Date(appData.selectedDate));
    if (typeof h.progress !== 'object' || h.progress === null) h.progress = {};
    const cur = h.progress[key] || 0;
    let next = cur + delta;
    if (next < 0) next = 0;
    if (next > max) next = max;
    h.progress[key] = next;
  });
}

/* -------------------------------------------------------------------------- */
/*  SWIPE RESTORE HELPER                                                      */
/* -------------------------------------------------------------------------- */

export function attachSwipeBehaviour(swipeContainer, slideEl, habit) {
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
}
