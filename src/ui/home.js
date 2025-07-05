// Home screen controller – bridges Swift HomeView functionality to our web stack
// The implementation focuses on state management & DOM interactions. Fine-grained styling is handled
// in index.html / Tailwind classes.

import { appData, mutate, subscribe } from '../core/state.js';
import { updateProgressRing } from './progressRing.js';
import { mountCalendar } from './calendar.js';
import * as scheduleUtils from '../features/home/schedule.js';
import { makeCardSwipable } from '../components/swipeableCard.js';
import { hexToRgba, tintedLinearGradient } from '../utils/color.js';
import { updateProgressPills } from '../components/HomeProgressPills.js';
import { dateToKey } from '../utils/datetime.js';
import { capitalize } from '../utils/common.js';
import { isSameDay } from '../utils/datetime.js';
import { centerHorizontally } from '../components/scrollHelpers.js';

/* -------------------------------------------------------------------------- */
/*  CONSTANTS                                                                 */
/* -------------------------------------------------------------------------- */

export const GROUPS = ['daily', 'weekly', 'monthly', 'yearly'];

// Map each group to a Material Design icon name
const GROUP_ICONS = {
  daily: 'today', // calendar today icon
  weekly: 'view_week', // weekly calendar columns icon
  monthly: 'date_range', // month range icon
  yearly: 'event', // general calendar/event icon
};

/* -------------------------------------------------------------------------- */
/*  HABIT FILTERING / SCHEDULING                                              */
/* -------------------------------------------------------------------------- */

// Local aliases for schedule helpers (shared util).

const {
  belongsToSelectedGroup,
  isHabitScheduledOnDate,
  getPeriodKey,
  isHabitCompleted,
  setHabitCompleted,
  toggleHabitCompleted,
  isHabitSkippedToday,
} = scheduleUtils;

// Track collapse state for Completed & Skipped sections so it persists across re-renders
const sectionCollapseState = {
  Completed: false,
  Skipped: false,
};

// Persisted visibility for Completed and Skipped sections
const sectionVisibility = JSON.parse(
  localStorage.getItem('sectionVisibility') || '{"Completed":true,"Skipped":true}'
);

function saveSectionVisibility() {
  localStorage.setItem('sectionVisibility', JSON.stringify(sectionVisibility));
}

// Reference to mounted calendar API so we can refresh labels when group/date changes
let _calendarApi = null;

// Ensure the habits container takes remaining viewport height and becomes the sole scrollable region
function adjustHabitsContainerHeight() {
  if (typeof window === 'undefined') return;
  const container = document.querySelector('#home-view .habits-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  // Subtract bottom padding (e.g. from pb-20 on .content-area) so last items are fully visible
  let bottomPadding = 0;
  const content = document.querySelector('#home-view').closest('.content-area');
  if (content) {
    const cs = window.getComputedStyle(content);
    bottomPadding = parseFloat(cs.paddingBottom) || 0;
  }
  const available = window.innerHeight - rect.top - bottomPadding;
  if (available > 0) {
    container.style.maxHeight = available + 'px';
    container.style.overflowY = 'auto';
  }
}

function renderHabitsForHome() {
  const container = document.querySelector('#home-view .habits-container');
  if (!container) {
    return;
  }

  // Clear previous dynamic content but keep the static header inside .habits-container
  const headerEl = container.querySelector('.habits-header');
  container.innerHTML = '';
  if (headerEl) container.appendChild(headerEl);

  const date = new Date(appData.selectedDate);
  const group = appData.selectedGroup;

  // Filter habits
  const habits = appData.habits.filter(
    (h) => belongsToSelectedGroup(h, group) && isHabitScheduledOnDate(h, date)
  );

  // If no habits scheduled for today, render friendly placeholder instead of sections
  if (habits.length === 0) {
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

    container.appendChild(placeholder);
    return; // nothing else to render
  }

  const skippedArr = habits.filter(
    (h) => !isHabitCompleted(h, date) && isHabitSkippedToday(h, date)
  );
  const incompleteActive = habits.filter(
    (h) => !isHabitCompleted(h, date) && !isHabitSkippedToday(h, date)
  );

  const anytime = incompleteActive.filter((h) => !h.scheduledTime);
  const scheduled = incompleteActive.filter((h) => h.scheduledTime);

  const completedArr = habits.filter((h) => isHabitCompleted(h, date));

  const frag = document.createDocumentFragment();

  function buildSection(title, list) {
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
    wrapper.style.paddingTop = '0.5rem'; // py-2
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

    list.forEach((habit) => {
      let cardRefForAppend;

      const card = document.createElement('div');
      card.className = 'habit-card flex items-center px-4 py-2 rounded-xl';
      // Remove margin from card itself to avoid affecting button height
      card.style.marginBottom = '0';
      card.dataset.habitId = habit.id;
      card.style.width = '100%';

      const hasTarget = typeof habit.target === 'number' && habit.target > 0;

      // Determine today progress
      const periodKey = getPeriodKey(habit, date);
      let curProgress = hasTarget && habit.progress ? habit.progress[periodKey] || 0 : 0;

      // Determine category color (defaults)
      const cat = appData.categories.find((c) => c.id === habit.categoryId) || { color: '#888' };

      const left = `<div class="habit-icon w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center mr-1 text-xl" style="border:2px solid ${cat.color}; color:${cat.color}">${
        habit.icon || '📋'
      }</div>`;

      let middle = `<div class="habit-content flex-grow">
          <div class="habit-name font-semibold leading-tight">${habit.name}</div>`;

      // category pill
      middle += `<span class="category-pill inline-block whitespace-nowrap px-2 py-0.5 rounded-lg text-xs font-medium mt-0" style="display:inline-block;width:max-content;background:${cat.color};color:#fff;border-radius:8px;">${cat.name || ''}</span>`;

      // prepare right html string (for non-target)
      let right = '';
      let rightWrap = null; // for target habits we build later

      if (hasTarget) {
        // Right-side UI for target habits: progress indicator background + progress box + unit pill
        // Create background fill that grows with progress
        card.style.position = 'relative';
        const setFill = (pct) => {
          card.style.background = tintedLinearGradient(cat.color, pct);
        };

        setFill(habit.target ? Math.min(curProgress / habit.target, 1) : 0);

        // Progress box
        const progressBox = document.createElement('div');
        progressBox.className = 'progress-box px-2 py-0.5 text-xs font-bold rounded-md mb-1';
        progressBox.style.border = `1px solid ${cat.color}`;
        progressBox.style.color = '#000'; // black text
        progressBox.textContent = `${curProgress}/${habit.target}`;

        // Determine unit pill text
        const unitText = habit.targetUnit && habit.targetUnit !== 'none' ? habit.targetUnit : null;

        rightWrap = document.createElement('div');
        rightWrap.className = 'ml-auto flex flex-col items-end';
        rightWrap.style.position = 'relative';
        rightWrap.style.zIndex = '1';
        rightWrap.appendChild(progressBox);

        // Ensure progress box itself has opaque background
        progressBox.style.background = '#FFFFFF';

        if (unitText) {
          const unitPill = document.createElement('span');
          unitPill.className =
            'unit-pill whitespace-nowrap px-2 py-0.5 rounded-lg text-xs font-medium';
          unitPill.style.background = `${cat.color}`;
          unitPill.style.color = '#fff';
          unitPill.textContent = unitText;
          rightWrap.appendChild(unitPill);
        }

        /* ---------------- EDIT MODE TOGGLE ---------------- */
        const enterEditMode = () => {
          if (card.dataset.editing === '1') return;
          card.dataset.editing = '1';
          // hide normal content
          const habitContentNode = card.querySelector('.habit-content');
          if (habitContentNode) habitContentNode.style.display = 'none';
          rightWrap.style.display = 'none';

          // Build edit controls container
          const editCont = document.createElement('div');
          editCont.className = 'edit-controls flex items-center gap-2 mx-auto';
          editCont.style.transform = 'translateX(-28px)';

          // Minus button (red circle)
          const minusCircle = document.createElement('button');
          minusCircle.className =
            'minus-edit rounded-full flex items-center justify-center font-extrabold text-white border-2 border-black';
          minusCircle.style.background = '#DC2626'; /* Tailwind red-600 */
          minusCircle.style.fontSize = '1.8rem';
          minusCircle.style.width = '44px';
          minusCircle.style.height = '44px';
          minusCircle.textContent = '−';

          // Value box
          let currentIncrement = habit.defaultIncrement || 1;

          const valueBox = document.createElement('div');
          valueBox.className =
            'value-box px-4 border-2 border-black bg-white text-xl font-bold rounded-lg cursor-pointer select-none flex items-center justify-center';
          valueBox.textContent = curProgress;
          valueBox.style.height = '44px';

          // Determine min width for two-digit number ("88") to keep box stable for 1–2 digits
          const measureWidth = (txt) => {
            const span = document.createElement('span');
            span.style.visibility = 'hidden';
            span.style.font = 'inherit';
            span.textContent = txt;
            document.body.appendChild(span);
            const w = span.getBoundingClientRect().width;
            span.remove();
            return w;
          };

          const baseWidth = measureWidth('88') + 16; // approximate padding for px-6
          let lockedWidth = baseWidth;
          valueBox.style.minWidth = lockedWidth + 'px';
          valueBox.classList.add('text-center', 'font-mono');

          // Allow user to set custom increment (ensure handler always attached)
          valueBox.onclick = (e) => {
            e.stopPropagation();
            if (valueBox.querySelector('input')) return; // already editing
            // lock current width so box doesn't expand when cleared
            const rectBefore = valueBox.getBoundingClientRect();
            lockedWidth = rectBefore.width;
            valueBox.style.width = lockedWidth + 'px';
            valueBox.style.minWidth = lockedWidth + 'px';

            const input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'numeric';
            input.pattern = '[0-9]*';
            input.className = 'w-full text-center outline-none';
            input.placeholder = curProgress; // show current count as grey placeholder
            input.style.MozAppearance = 'textfield';
            input.style.WebkitAppearance = 'none';
            input.style.appearance = 'textfield'; // remove spin buttons
            input.style.border = 'none';
            input.style.background = 'transparent';
            valueBox.textContent = '';
            valueBox.appendChild(input);
            input.focus();

            currentIncrement = 0;

            const finalize = () => {
              const val = parseInt(input.value, 10);
              if (!isNaN(val) && val > 0) {
                currentIncrement = val;
              } else {
                currentIncrement = habit.defaultIncrement || 1;
              }
              valueBox.textContent = curProgress;
              // keep minWidth baseline; no explicit width reset needed
            };

            input.addEventListener('keydown', (evt) => {
              if (evt.key === 'Enter') {
                finalize();
              }
            });
            input.addEventListener('blur', finalize);

            // Dynamically adjust box width as user types
            const adjustBoxWidth = () => {
              const span = document.createElement('span');
              span.style.visibility = 'hidden';
              span.style.position = 'absolute';
              span.style.whiteSpace = 'pre';
              span.style.font = getComputedStyle(input).font;
              span.textContent = input.value || '0';
              document.body.appendChild(span);
              const textW = span.getBoundingClientRect().width;
              span.remove();

              const styles = getComputedStyle(valueBox);
              const pad = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
              const border =
                parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth);
              const desired = Math.max(baseWidth, textW + pad + border + 4); // extra 4px buffer

              valueBox.style.width = desired + 'px';
            };

            input.addEventListener('input', () => requestAnimationFrame(adjustBoxWidth));
          };

          // Plus button (green circle)
          const plusCircle = document.createElement('button');
          plusCircle.className =
            'plus-edit rounded-full flex items-center justify-center font-extrabold text-white border-2 border-black';
          plusCircle.style.background = '#16A34A'; /* Tailwind green-600 */
          plusCircle.style.fontSize = '1.8rem';
          plusCircle.style.width = '44px';
          plusCircle.style.height = '44px';
          plusCircle.textContent = '+';

          // Confirm button (smaller green circle)
          const confirmBtn = document.createElement('button');
          confirmBtn.className =
            'confirm-edit w-8 h-8 rounded-full flex items-center justify-center text-white border-2 border-black absolute right-0';
          confirmBtn.style.background = '#16A34A';
          confirmBtn.textContent = '✔';

          editCont.appendChild(minusCircle);
          editCont.appendChild(valueBox);
          editCont.appendChild(plusCircle);

          const editWrapper = document.createElement('div');
          editWrapper.className = 'flex items-center relative w-full';
          editWrapper.appendChild(editCont);
          editWrapper.appendChild(confirmBtn);

          card.appendChild(editWrapper);

          const updateDisplay = (newVal) => {
            valueBox.textContent = newVal;
            progressBox.textContent = `${newVal}/${habit.target}`;
            // Expand minWidth if content wider than current
            const contentW = valueBox.scrollWidth + 1; // slight buffer
            if (contentW > lockedWidth) {
              lockedWidth = contentW;
              valueBox.style.minWidth = lockedWidth + 'px';
            }
            // adjust background fill width
            const pct = habit.target ? Math.min(newVal / habit.target, 1) : 0;
            setFill(pct);
          };

          const applyDelta = (deltaUnits) => {
            if (currentIncrement === 0) return; // do nothing until user sets custom increment
            const delta = deltaUnits * currentIncrement;
            curProgress += delta;
            if (curProgress < 0) curProgress = 0;
            if (curProgress > habit.target) curProgress = habit.target;
            updateDisplay(curProgress);
            adjustProgress(habit.id, habit.target, delta);
            currentIncrement = habit.defaultIncrement || 1; // reset to default after first apply
          };

          plusCircle.addEventListener('click', (e) => {
            e.stopPropagation();
            applyDelta(+1);
          });

          minusCircle.addEventListener('click', (e) => {
            e.stopPropagation();
            applyDelta(-1);
          });

          confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // exit edit mode
            card.dataset.editing = '0';
            editWrapper.remove();
            const habitContentNodeBack = card.querySelector('.habit-content');
            if (habitContentNodeBack) habitContentNodeBack.style.display = '';
            rightWrap.style.display = '';

            // Auto-complete when progress hits target
            mutate((s) => {
              const h = s.habits.find((hh) => hh.id === habit.id);
              if (!h) return;
              const key = getPeriodKey(h, new Date(appData.selectedDate));
              const val = (h.progress && h.progress[key]) || 0;
              if (h.target && val >= h.target) {
                setHabitCompleted(h, new Date(appData.selectedDate), true);
              }
            });

            window._skipHomeRefresh = false;
            refreshUI();
          });

          // Prevent global re-render during edit mode
          window._skipHomeRefresh = true;

          // After insertion, equalise circle size to valueBox height
          const boxH = valueBox.offsetHeight;
          const diameter = boxH + 'px';
          [minusCircle, plusCircle].forEach((btn) => {
            btn.style.width = diameter;
            btn.style.height = diameter;
            btn.style.fontSize = boxH * 0.6 + 'px';
          });

          // after valueBox.classList.add line
          valueBox.style.pointerEvents = 'auto';
          valueBox.style.zIndex = '5';
        };

        rightWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          enterEditMode();
        });
      } else {
        // show check circle and, if scheduledTime exists, a time pill just before it
        const checked = isHabitCompleted(habit, date) ? '✔️' : '';
        let timePill = '';
        if (habit.scheduledTime) {
          timePill = `<span class="time-pill whitespace-nowrap px-3 py-1 rounded-lg text-sm font-semibold mr-1" style="background:${cat.color}; color:#fff;border-radius:8px;font-size:0.875rem;">${habit.scheduledTime}</span>`;
        }
        right = `<div class="ml-auto flex items-center gap-1">${timePill}<button class="complete-toggle w-8 h-8 rounded-full flex items-center justify-center" style="border:2px solid ${cat.color}; color:${cat.color}">${checked}</button></div>`;
      }

      // close middle div
      middle += '</div>';

      card.innerHTML = left + middle + right;

      // If target habit, append rightWrap (no plus/minus listeners now)
      if (rightWrap) {
        card.appendChild(rightWrap);
      }

      // Background fill: for non-target habits use subtle tint; for target habits the gradient is already set.
      if (!hasTarget) {
        card.style.background = hexToRgba(cat.color, 0.07);
      }

      // Apply category-coloured border around the entire card with 3px thickness to match habits page
      card.style.border = `3px solid ${cat.color}`;

      // Completion toggle for non-target via right button
      if (!hasTarget) {
        card.querySelector('.complete-toggle').addEventListener('click', (e) => {
          e.stopPropagation();
          mutate((s) => {
            const h = s.habits.find((hh) => hh.id === habit.id);
            if (!h) return;
            toggleHabitCompleted(h, new Date(appData.selectedDate));
          });
        });
      }

      /* ---------------- Completed styling ---------------- */
      if (isHabitCompleted(habit, date)) {
        // grey tones
        card.style.border = '3px solid #4B5563'; // dark grey
        card.style.background = '#F3F4F6'; // light grey

        // Adjust category pill
        const catPill = card.querySelector('.category-pill');
        if (catPill) {
          catPill.style.background = '#9CA3AF'; // mid grey
          catPill.style.color = '#fff';
        }

        // Remove existing right-side elements
        card
          .querySelectorAll(
            '.ml-auto, .habit-counter, .target-pill, .complete-toggle, .time-pill, .progress-box'
          )
          .forEach((el) => el.remove());

        // Completed pill to be shown after swipe or static if no swipe
        const donePill = document.createElement('div');
        donePill.className = 'completed-pill flex items-center gap-1 px-3 py-1 rounded-lg';
        donePill.style.border = '2px solid #16A34A'; // green border
        donePill.style.background = '#DCFCE7'; // light green fill
        donePill.style.color = '#16A34A';
        donePill.innerHTML =
          '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.2l-3.5-3.5 1.42-1.42L9 13.34 17.59 4.75 19 6.17z"/></svg><span class="text-sm font-semibold">Completed</span>';

        // Build swipe container
        const swipeContainer = document.createElement('div');
        swipeContainer.className = 'swipe-container relative overflow-visible home-inset';

        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'restore-btn absolute top-0 right-0 h-full';
        restoreBtn.style.width = '20%';
        restoreBtn.style.background = '#16A34A';
        restoreBtn.style.color = '#fff';
        restoreBtn.style.borderRadius = '0.75rem';
        restoreBtn.textContent = 'Restore';
        restoreBtn.style.fontWeight = '600'; // semi-bold

        const slideEl = document.createElement('div');
        slideEl.className = 'swipe-slide transition-transform';
        slideEl.style.width = '100%';
        slideEl.style.position = 'relative';
        slideEl.style.zIndex = '1';
        slideEl.style.background = '#FFFFFF'; // opaque layer hides Skip button under transparent card
        slideEl.style.borderRadius = '0.75rem';
        slideEl.appendChild(card);

        swipeContainer.appendChild(restoreBtn);
        swipeContainer.appendChild(slideEl);

        // Match slide rounded corners to card to prevent green bleed
        slideEl.style.borderRadius = '0.75rem';

        // replace card reference to swipeContainer when appending to wrapper later
        cardRefForAppend = swipeContainer;

        attachSwipeBehaviour(swipeContainer, slideEl, habit);

        // after donePill innerHTML line and before building swipe container insert append
        card.appendChild(donePill);

        // Grey icon border (overwrite any previous category colour)
        const iconEl = card.querySelector('.habit-icon');
        if (iconEl) {
          iconEl.style.border = '2px solid #9CA3AF';
          iconEl.style.color = '#9CA3AF';
        }
      } else if (isHabitSkippedToday(habit, date)) {
        // Skipped styling (same greys, orange pill)
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

        // wrap for restore swipe similar to completed
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
        slideEl.style.borderRadius = '0.75rem';
        slideEl.style.background = '#FFFFFF'; // opaque layer hides Skip button under transparent card
        slideEl.appendChild(card);

        swipeContainer.appendChild(restoreBtn);
        swipeContainer.appendChild(slideEl);
        cardRefForAppend = swipeContainer;
        attachSwipeBehaviour(swipeContainer, slideEl, habit);
        // restore action remove skipped date
        const dayKey = dateToKey(new Date(appData.selectedDate));
        restoreBtn.addEventListener('click', () => {
          mutate((s) => {
            const h = s.habits.find((hh) => hh.id === habit.id);
            if (!h) return;
            h.skippedDates = h.skippedDates.filter((d) => d !== dayKey);
          });
        });
      }

      // ---------------- Swipe-to-Skip for active habits ----------------
      if (!isHabitCompleted(habit, date) && !isHabitSkippedToday(habit, date)) {
        // Build swipe-to-skip wrapper
        const swipeContainer = document.createElement('div');
        swipeContainer.className = 'swipe-container relative overflow-visible home-inset';

        const skipBtn = document.createElement('button');
        skipBtn.className = 'skip-btn absolute top-0 right-0 h-full';
        skipBtn.style.width = '20%';
        skipBtn.style.background = '#F97316'; // orange-500
        skipBtn.style.color = '#fff';
        skipBtn.style.borderRadius = '0.75rem';
        skipBtn.style.fontWeight = '600';
        skipBtn.textContent = 'Skip';

        const slideEl = document.createElement('div');
        slideEl.className = 'swipe-slide transition-transform';
        slideEl.style.width = '100%';
        slideEl.style.position = 'relative';
        slideEl.style.zIndex = '1';
        slideEl.style.background = '#FFFFFF'; // opaque layer hides Skip button under transparent card
        slideEl.style.borderRadius = '0.75rem';
        slideEl.appendChild(card);

        swipeContainer.appendChild(skipBtn);
        swipeContainer.appendChild(slideEl);

        // Ensure the wrapper is used when appending
        cardRefForAppend = swipeContainer;

        // Make interactive
        attachSwipeBehaviour(swipeContainer, slideEl, habit);

        // Skip action – add today to skippedDates
        skipBtn.addEventListener('click', () => {
          const dayKey = dateToKey(new Date(appData.selectedDate));
          mutate((s) => {
            const h = s.habits.find((hh) => hh.id === habit.id);
            if (!h) return;
            if (!Array.isArray(h.skippedDates)) h.skippedDates = [];
            if (!h.skippedDates.includes(dayKey)) h.skippedDates.push(dayKey);
          });
        });
      }

      const cardToAdd = cardRefForAppend || card;
      // Apply spacing after the container to keep consistent gap between tiles
      cardToAdd.style.marginBottom = '0.25rem'; // mb-1
      wrapper.appendChild(cardToAdd);
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
          if (toggleBtn) {
            toggleBtn.style.alignSelf = 'flex-start';
            toggleBtn.style.padding = '0';
            toggleBtn.style.border = 'none';
            toggleBtn.style.outline = 'none';
          }
        });
      }
    }

    return wrapper;
  }

  const anytimeSection = buildSection('Anytime', anytime);
  const schedSection = buildSection('Scheduled', scheduled);
  const completedSection = buildSection('Completed', completedArr);
  const skippedSection = buildSection('Skipped', skippedArr);

  if (anytimeSection) frag.appendChild(anytimeSection);
  if (schedSection) frag.appendChild(schedSection);
  if (completedSection) frag.appendChild(completedSection);
  if (skippedSection) frag.appendChild(skippedSection);

  container.appendChild(frag);

  // After fragment insertion, log actual pill widths to see if they span the full card or hug text.
  document.querySelectorAll('#home-view .category-pill').forEach((el) => {
    // Pill width logging removed for cleaner code
  });
}

/* -------------------------------------------------------------------------- */
/*  INITIAL RENDER                                                            */
/* -------------------------------------------------------------------------- */

export function initializeHome() {
  buildHeader();
  buildCalendar();

  // Remove white background box from habits container (static HTML)
  const staticContainer = document.querySelector('#home-view .habits-container');
  if (staticContainer) {
    staticContainer.classList.remove('bg-white', 'dark:bg-gray-800', 'shadow-ios', 'rounded-2xl');
    staticContainer.style.background = 'transparent';
    staticContainer.style.boxShadow = 'none';
    staticContainer.style.borderRadius = '0';
  }

  // Clean up any static demo cards that were hard-coded in the HTML so that only
  // dynamically rendered habits remain. We leave the surrounding layout intact.
  document.querySelectorAll('#home-view .habit-card').forEach((el) => el.remove());

  bindControls();

  // Whenever the appData mutates we may need to refresh UI.
  subscribe(refreshUI);

  refreshUI();

  // Update container height on viewport resize
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', adjustHabitsContainerHeight);
  }
}

function buildHeader() {
  // We place the group pill inside the Home-view header (outside the scrollable habits container)
  const titleContainer = document.querySelector('#home-view .habits-header .habits-title');
  if (!titleContainer) return;

  // Avoid duplicating if we've already inserted it.
  if (titleContainer.querySelector('#group-pill')) return;

  // Remove the existing sun icon / text so only the pill remains.
  titleContainer.innerHTML = '';

  const pill = document.createElement('div');
  pill.id = 'group-pill';
  pill.className =
    'flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-gray-800 rounded-full cursor-pointer select-none w-full justify-center text-lg font-bold home-inset';

  // Ensure pill stretches to container width if desired
  titleContainer.style.display = 'flex';
  titleContainer.style.justifyContent = 'center';

  pill.innerHTML = `<span id="group-icon" class="material-icons text-xl">${GROUP_ICONS[appData.selectedGroup]}</span>
                    <span id="group-title" class="text-xl font-bold">${capitalize(appData.selectedGroup)} Habits</span>`;

  titleContainer.appendChild(pill);

  // Build Holiday toggle and insert to the right of header row root
  buildHolidayToggle();

  // Reduce bottom padding of header to tighten space below pill
  const headerEl = titleContainer.closest('.habits-header');
  if (headerEl) headerEl.style.paddingBottom = '8px';
}

/** Build or update holiday mode toggle in Home header */
function buildHolidayToggle() {
  const header = document.querySelector('#home-view .habits-header');
  if (!header) return;

  // Ensure header uses flex layout spaced between
  header.classList.add('justify-between');

  let toggle = document.getElementById('holiday-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'holiday-toggle';
    toggle.className =
      'relative flex items-center justify-center h-9 bg-gray-200 text-gray-500 rounded-full overflow-hidden select-none mr-4';
    toggle.style.width = '36px';
    toggle.innerHTML =
      '<span class="plane material-icons absolute left-2 top-1/2 -translate-y-1/2 transition-transform text-2xl">flight</span><span class="label whitespace-nowrap ml-1 text-sm font-medium opacity-0 transition-opacity">Holiday Mode</span>';
    toggle.addEventListener('click', () => {
      const targetISO = dateToKey(new Date(appData.selectedDate));
      Promise.all([import('../utils/holidays.js'), import('../components/ConfirmDialog.js')]).then(
        ([hol, { showConfirm }]) => {
          const { toggleSingleHoliday } = hol;
          const inPeriod = appData.holidayPeriods.some(
            (p) => targetISO >= p.startISO && targetISO <= p.endISO
          );
          if (inPeriod) {
            showConfirm({
              title: 'Managed by Holiday Period',
              message:
                'This date is set as a holiday through a holiday period. Please edit using the Holiday Period manager.',
              okText: 'OK',
              cancelText: '',
              onOK: () => {},
            });
            return;
          }
          toggleSingleHoliday(targetISO);
          refreshUI();
        }
      );
    });
    header.appendChild(toggle);
  }

  updateHolidayToggle();
}

function updateHolidayToggle() {
  const toggle = document.getElementById('holiday-toggle');
  if (!toggle) return;
  import('../utils/holidays.js').then(({ isHoliday, dateToKey }) => {
    const group = appData.selectedGroup || 'daily';
    // Show toggle only in Daily group – hide in Weekly and all others
    if (group !== 'daily') {
      toggle.style.display = 'none';
      return;
    }
    toggle.style.display = '';
    const refISO = dateToKey(new Date(appData.selectedDate));
    const isOn = isHoliday(refISO);
    toggle.classList.toggle('bg-ios-orange', isOn);
    toggle.classList.toggle('bg-gray-200', !isOn);
    toggle.classList.toggle('text-white', isOn);
    toggle.classList.toggle('text-gray-500', !isOn);

    const planeEl = toggle.querySelector('.plane');
    const labelEl = toggle.querySelector('.label');
    if (planeEl) {
      if (isOn) {
        planeEl.style.left = '8px';
        planeEl.style.transform = 'translateY(-50%) rotate(-90deg)';
      } else {
        planeEl.style.left = '50%';
        planeEl.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
      }
    }

    if (labelEl) {
      if (isOn) {
        labelEl.classList.add('opacity-100');
        toggle.classList.add('pl-9', 'pr-4');
        toggle.classList.remove('justify-center');
        toggle.style.width = '140px';
      } else {
        labelEl.classList.remove('opacity-100');
        toggle.classList.remove('pl-9', 'pr-4');
        toggle.classList.add('justify-center');
        toggle.style.width = '36px';
      }
    }
  });
}

function buildCalendar() {
  const wrap =
    document.querySelector('#home-calendar') || document.querySelector('#home-view .week-calendar');
  if (!wrap) return;
  _calendarApi = mountCalendar({
    container: wrap,
    stateKey: 'selectedDate',
    onDateChange: refreshUI,
  });
}

function bindControls() {
  // Group pill swipe left/right cycles through groups with habits
  const pill = document.getElementById('group-pill');
  if (pill) {
    let startX = 0;
    pill.addEventListener('pointerdown', (e) => {
      startX = e.touches ? e.touches[0].clientX : e.clientX;
    });
    pill.addEventListener('pointerup', (e) => {
      const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const delta = endX - startX;
      if (Math.abs(delta) < 40) return; // threshold
      const dir = delta < 0 ? +1 : -1; // left swipe -> next (+1)
      mutate((s) => {
        const nextGroup = findNextGroupWithHabits(s.selectedGroup, dir);
        s.selectedGroup = nextGroup;
        // Always reset selectedDate to today so the new group's calendar
        // starts on the current period (today/this week/this month/this year)
        s.selectedDate = new Date().toISOString();
      });
    });
    // Prevent default click behaviour so accidental taps don't change group
    pill.addEventListener('click', (e) => e.preventDefault());
    pill.style.touchAction = 'pan-y'; // allow horizontal
  }

  function findNextGroupWithHabits(current, dir) {
    const idx = GROUPS.indexOf(current);
    for (let i = 1; i <= GROUPS.length; i++) {
      const nextIdx = (idx + dir * i + GROUPS.length) % GROUPS.length;
      const g = GROUPS[nextIdx];
      // Allow navigation if the user has any habits under that group at all,
      // even when none are scheduled for the *current* date. This ensures e.g.
      // Monthly group is still reachable outside the months where Yearly habits
      // are active.
      const hasAny =
        g === 'daily'
          ? true
          : appData.habits.some((h) => belongsToSelectedGroup(h, g) && !h.paused);
      if (hasAny) return g;
    }
    return current; // fallback
  }

  // Dropdown menu actions
  document.querySelectorAll('#home-view .dropdown-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      const action = el.dataset.action;
      if (action === 'add-habit') {
        import('../components/Modal.js').then((m) => m.openModal('add-habit-modal'));
      }
      if (action === 'manage-holidays') {
        import('./holidays/manage.js').then((m) => m.openHolidayModal());
      }
      if (action === 'toggle-completed') {
        sectionVisibility.Completed = !sectionVisibility.Completed;
        saveSectionVisibility();
        refreshUI();
        updateDropdownText();
      }
      if (action === 'toggle-skipped') {
        sectionVisibility.Skipped = !sectionVisibility.Skipped;
        saveSectionVisibility();
        refreshUI();
        updateDropdownText();
      }
    });
  });

  function updateDropdownText() {
    const completedItem = document.querySelector(
      '[data-action="toggle-completed"] span:last-child'
    );
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

  updateDropdownText();

  /* ----------------------- HEADER MENU TOGGLE ------------------------ */
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
  }

  // Keep toggle in sync on every refresh UI call
  updateHolidayToggle();
}

/* -------------------------------------------------------------------------- */
/*  RENDER HELPERS                                                            */
/* -------------------------------------------------------------------------- */

function refreshUI() {
  if (typeof window !== 'undefined' && window._skipHomeRefresh) return;

  // Update pill text/icon
  const titleEl = document.getElementById('group-title');
  const iconEl = document.getElementById('group-icon');
  if (titleEl) titleEl.textContent = `${capitalize(appData.selectedGroup)} Habits`;
  if (iconEl) {
    // Ensure class present in case this element was created before patch
    iconEl.classList.add('material-icons');
    iconEl.textContent = GROUP_ICONS[appData.selectedGroup];
  }

  // Highlight selected day in calendar
  const dayItems = document.querySelectorAll(
    '#home-calendar .day-item, #home-view .week-calendar .day-item'
  );
  dayItems.forEach((el) => {
    const match = isSameDay(new Date(el.dataset.date), new Date(appData.selectedDate));
    el.classList.toggle('current-day', match);

    const isToday = isSameDay(new Date(el.dataset.date), new Date());
    el.classList.toggle('today', isToday && !match);
  });

  // Recalculate progress
  const progress = calculateProgressForCurrentContext();
  updateProgressRing(progress);

  // Update stacked progress pills for other groups
  updateProgressPills();

  // Re-render habit cards for current context
  renderHabitsForHome();

  // After toggling classes, center selected day
  const current = document.querySelector(
    '#home-calendar .day-item.current-day, #home-view .week-calendar .day-item.current-day'
  );
  if (current) centerHorizontally(current);

  // Refresh calendar labels to reflect current selected group
  if (_calendarApi && typeof _calendarApi.refresh === 'function') {
    _calendarApi.refresh();
  }

  // Sync holiday toggle with newly selected date
  updateHolidayToggle();

  // Recalculate scrollable area height after any UI change
  adjustHabitsContainerHeight();
}

/* -------------------------------------------------------------------------- */
/*  PROGRESS CALCULATION                                                      */
/* -------------------------------------------------------------------------- */

function calculateProgressForCurrentContext() {
  const dateObj = new Date(appData.selectedDate);

  // 1) Habits that belong to the currently selected group
  // 2) Are actually scheduled for the selected date (takes holiday mode into account)
  const scheduledHabits = appData.habits.filter(
    (h) => belongsToSelectedGroup(h, appData.selectedGroup) && isHabitScheduledOnDate(h, dateObj)
  );

  // 3) Remove any that the user explicitly skipped
  const activeHabits = scheduledHabits.filter((h) => !isHabitSkippedToday(h, dateObj));

  // 4) Determine how many of the remaining active habits are completed
  const completed = activeHabits.filter((h) => isHabitCompleted(h, dateObj));

  const progress = activeHabits.length ? (completed.length / activeHabits.length) * 100 : 0;
  return progress;
}

/* -------------------------------------------------------------------------- */
/*  UTILITIES                                                                 */
/* -------------------------------------------------------------------------- */

function adjustProgress(habitId, max, delta) {
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

// -------------------- SWIPE RESTORE HELPER --------------------
// Adapter that delegates to the shared component and wires the restore logic
// specific to the Home view.

function attachSwipeBehaviour(swipeContainer, slideEl, habit) {
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

/* -------------------------------------------------------------------------- */
/*  PERIOD KEY UTIL                                                           */
/* -------------------------------------------------------------------------- */

/* ----------------------- CALENDAR HELPER ------------------------ */

// Expose for console debugging
if (typeof window !== 'undefined') {
  window.renderHabitsForHome = renderHabitsForHome;
  window.belongsToSelectedGroup = belongsToSelectedGroup;
  window.isHabitScheduledOnDate = isHabitScheduledOnDate;
}
