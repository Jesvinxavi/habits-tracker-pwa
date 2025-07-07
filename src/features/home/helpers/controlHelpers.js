import { mutate, appData } from '../../../core/state.js';
import { findNextGroupWithHabits } from './coreHelpers.js';
import { refreshUI } from './refreshHelpers.js';
import { updateDropdownText, saveSectionVisibility } from './uiHelpers.js';
import { sectionVisibility } from './coreHelpers.js';

/* -------------------------------------------------------------------------- */
/*  CONTROL BINDING                                                           */
/* -------------------------------------------------------------------------- */

// Helper functions for group pill swipe navigation
function handleGroupPillStart(e, startX, startY, isSwiping) {
  startX.value = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
  startY.value = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
  isSwiping.value = false;
}

function handleGroupPillMove(e, startX, startY, isSwiping) {
  if (!startX.value) return;
  const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
  const currentY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
  const deltaX = Math.abs(currentX - startX.value);
  const deltaY = Math.abs(currentY - startY.value);

  if (deltaX > 50 && deltaX > deltaY * 2) {
    isSwiping.value = true;
    e.preventDefault();
  }
}

function handleGroupPillEnd(e, startX, startY, isSwiping) {
  if (!isSwiping.value || !startX.value) return;
  const currentX = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
  const deltaX = currentX - startX.value;

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

  startX.value = 0;
  startY.value = 0;
  isSwiping.value = false;
}

export function bindControls() {
  // Group pill swipe navigation
  const groupPill = document.getElementById('group-pill');
  if (groupPill) {
    const startX = { value: 0 };
    const startY = { value: 0 };
    const isSwiping = { value: false };

    const handleStart = (e) => handleGroupPillStart(e, startX, startY, isSwiping);
    const handleMove = (e) => handleGroupPillMove(e, startX, startY, isSwiping);
    const handleEnd = (e) => handleGroupPillEnd(e, startX, startY, isSwiping);

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
