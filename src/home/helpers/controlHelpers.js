import { mutate, appData } from '../../core/state.js';
import { belongsToSelectedGroup } from '../schedule.js';
import { findNextGroupWithHabits } from './coreHelpers.js';
import { refreshUI } from './refreshHelpers.js';
import { updateDropdownText, saveSectionVisibility } from './uiHelpers.js';
import { sectionVisibility } from './coreHelpers.js';

/* -------------------------------------------------------------------------- */
/*  CONTROL BINDING                                                           */
/* -------------------------------------------------------------------------- */

export function bindControls() {
  // Group pill swipe navigation
  const groupPill = document.getElementById('group-pill');
  if (groupPill) {
    let startX = 0;
    let startY = 0;
    let isSwiping = false;

    function handleStart(e) {
      startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      isSwiping = false;
    }

    function handleMove(e) {
      if (!startX) return;
      const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
      const currentY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      const deltaX = Math.abs(currentX - startX);
      const deltaY = Math.abs(currentY - startY);

      if (deltaX > 50 && deltaX > deltaY * 2) {
        isSwiping = true;
        e.preventDefault();
      }
    }

    function handleEnd(e) {
      if (!isSwiping || !startX) return;
      const currentX = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
      const deltaX = currentX - startX;

      if (Math.abs(deltaX) > 50) {
        const direction = deltaX > 0 ? -1 : 1;
        const nextGroup = findNextGroupWithHabits(appData.selectedGroup, direction);
        if (nextGroup !== appData.selectedGroup) {
          mutate((s) => {
            s.selectedGroup = nextGroup;
          });
          refreshUI();
        }
      }

      startX = 0;
      startY = 0;
      isSwiping = false;
    }

    groupPill.addEventListener('touchstart', handleStart, { passive: false });
    groupPill.addEventListener('touchmove', handleMove, { passive: false });
    groupPill.addEventListener('touchend', handleEnd);

    groupPill.addEventListener('mousedown', handleStart);
    groupPill.addEventListener('mousemove', handleMove);
    groupPill.addEventListener('mouseup', handleEnd);
    groupPill.addEventListener('mouseleave', handleEnd);
  }

  // Section visibility dropdown
  document.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    if (action === 'toggle-completed') {
      sectionVisibility.Completed = !sectionVisibility.Completed;
      saveSectionVisibility(sectionVisibility);
      refreshUI();
      updateDropdownText();
    }
    if (action === 'toggle-skipped') {
      sectionVisibility.Skipped = !sectionVisibility.Skipped;
      saveSectionVisibility(sectionVisibility);
      refreshUI();
      updateDropdownText();
    }
  });
}
