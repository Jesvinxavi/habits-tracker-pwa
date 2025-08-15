// HomeHabitsList.js - Habits list component for the home view
import * as scheduleUtils from '../schedule.js';
import { getState, dispatch, Actions } from '../../../core/state.js';
import { makeCardSwipable } from '../../../components/swipeableCard.js';
import { hexToRgba, tintedLinearGradient } from '../../../shared/color.js';
import { dateToKey } from '../../../shared/datetime.js';
import { sectionVisibility } from '../helpers/coreHelpers.js';
import { getPeriodKey } from '../schedule.js';
import { getCategorizedHabitsForSelectedContext } from '../helpers/habitCategorization.js';
import { HomeSectionPills } from './HomeSectionPills.js';

// Local aliases for schedule helpers
const {
  // belongsToSelectedGroup, // no longer needed here
  // isHabitScheduledOnDate, // handled in helper
  isHabitCompleted,
  isHabitSkippedToday,
} = scheduleUtils;

// Import cache invalidation function
import { invalidatePillsCache } from './HomeProgressPills.js';

/**
 * HomeHabitsList component that manages habit rendering
 */
export const HomeHabitsList = {
  test() {
    return true;
  },
  /**
   * Mounts the habits list component
   */
  mount(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.isInEditMode = false; // Add edit mode flag
    this.useTabbedMode = true; // Enable tabbed mode for section switching
    this.selectedSection = null; // Will be determined on first render

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

    const { sections } = getCategorizedHabitsForSelectedContext();
    
    // Total count across all sections
    const totalCount =
      sections.Anytime.length +
      sections.Scheduled.length +
      sections.Completed.length +
      sections.Skipped.length;

    if (totalCount === 0) {
      this._renderEmptyPlaceholder(getState().selectedGroup);
      return;
    }

    // Ensure a valid selection exists
    this._ensureValidSelection(sections);

    // Build only the selected section in tabbed mode
    const frag = document.createDocumentFragment();

    const title = this.selectedSection;
    const list = sections[title] || [];

    const selectedSectionEl = this._buildSection(title, list);
    if (selectedSectionEl) frag.appendChild(selectedSectionEl);

    this.container.appendChild(frag);

    // Adjust container height after rendering
    this._adjustContainerHeight();

    // Sync pills selection with the list-selected section
    HomeSectionPills.setSelectedSection?.(this.selectedSection, { silent: true });
  },

  /**
   * Adjusts the habits container height for mobile
   */
  _adjustContainerHeight() {
    if (typeof window === 'undefined') return;

    const rect = this.container.getBoundingClientRect();
    // Subtract bottom padding (e.g. from pb-20 on .content-area) so last items are fully visible
    let bottomPadding = 0;
    const content = this.container.closest('.content-area');
    if (content) {
      const cs = window.getComputedStyle(content);
      bottomPadding = parseFloat(cs.paddingBottom) || 0;
    }
    const available = window.innerHeight - rect.top - bottomPadding;
    if (available > 0) {
      this.container.style.maxHeight = available + 'px';
      this.container.style.overflowY = 'auto';
    }
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
   * Builds a section of habits (without header/toggle in tabbed mode)
   */
  _buildSection(title, list) {
    // Respect visibility toggles for Completed/Skipped
    if (
      (title === 'Completed' && !sectionVisibility.Completed) ||
      (title === 'Skipped' && !sectionVisibility.Skipped)
    ) {
      return null;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'habits-section';

    // Minimal spacing
    wrapper.style.paddingTop = '0.5rem';
    wrapper.style.paddingBottom = '0.5rem';

    // If empty in tabbed mode, show a simple placeholder
    if (list.length === 0) {
      if (this.useTabbedMode) {
        const empty = document.createElement('div');
        empty.className = 'empty-section-placeholder text-gray-400 text-sm text-center py-6';
        empty.textContent = `No ${title.toLowerCase()} habits`;
        wrapper.appendChild(empty);
        return wrapper;
      }
      return null;
    }

    // Add habit cards
    list.forEach((habit) => {
      const card = this._buildHabitCard(habit);
      if (card) {
        const date = new Date(getState().selectedDate);
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

    return wrapper;
  },

  setSelectedSection(section) {
    const valid = ['Anytime', 'Scheduled', 'Completed', 'Skipped'];
    if (!valid.includes(section)) return;
    this.selectedSection = section;
  },

  _ensureValidSelection(sections) {
    const validKeys = ['Anytime', 'Scheduled', 'Completed', 'Skipped'];
    let sel = this.selectedSection;
    if (!validKeys.includes(sel)) sel = null;

    // If selected is hidden by visibility, invalidate it
    if (sel === 'Completed' && !sectionVisibility.Completed) sel = null;
    if (sel === 'Skipped' && !sectionVisibility.Skipped) sel = null;

    // Default selection if invalid or not set
    if (!sel) {
      // Prefer Anytime -> Scheduled -> Completed -> Skipped if present (counts > 0),
      // else fallback to Anytime.
      const order = ['Anytime', 'Scheduled', 'Completed', 'Skipped'];
      sel =
        order.find((k) => {
          if (k === 'Completed' && !sectionVisibility.Completed) return false;
          if (k === 'Skipped' && !sectionVisibility.Skipped) return false;
          return (sections[k] && sections[k].length > 0) || k === 'Anytime';
        }) || 'Anytime';
      }

    this.selectedSection = sel;
  },

  /**
   * Builds a single habit card
   */
  _buildHabitCard(habit) {
    const date = new Date(getState().selectedDate);
    const hasTarget = typeof habit.target === 'number' && habit.target > 0;
    const cat = getState().categories.find((c) => c.id === habit.categoryId) || {
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
    let rightWrap = null;

    if (hasTarget) {
      // Target habit - progress indicator
      card.style.position = 'relative';
      const setFill = (pct) => {
        card.style.background = tintedLinearGradient(cat.color, pct);
      };
      setFill(habit.target ? Math.min(curProgress / habit.target, 1) : 0);

      // Progress box
      const progressBox = document.createElement('div');
      progressBox.className = 'progress-box px-2 py-0.5 text-xs font-bold rounded-md mb-1';
      progressBox.style.border = `1px solid ${cat.color}`;
      progressBox.style.color = '#000';
      progressBox.style.background = '#FFFFFF';
      progressBox.textContent = `${curProgress}/${habit.target}`;

      // Determine unit pill text
      const unitText = habit.targetUnit && habit.targetUnit !== 'none' ? habit.targetUnit : null;

      rightWrap = document.createElement('div');
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

      /* ---------------- EDIT MODE TOGGLE ---------------- */
      const enterEditMode = () => {
        if (card.dataset.editing === '1') return;
        card.dataset.editing = '1';
        this.isInEditMode = true; // Set edit mode flag

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
            const border = parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth);
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
          this._adjustProgress(habit.id, habit.target, delta);
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
          this._exitEditMode(card);

          // Save the final progress state using proper dispatch
          dispatch(Actions.setHabitProgress(habit.id, periodKey, curProgress));

          // Auto-complete when progress hits target
          if (habit.target && curProgress >= habit.target) {
            dispatch(Actions.toggleHabitCompleted(habit.id, getPeriodKey(habit, date)));
          }

          // Trigger UI refresh only when exiting edit mode
          if (this.callbacks.onHabitComplete) {
            this.callbacks.onHabitComplete(habit.id, curProgress >= habit.target);
          }
        });

        // After insertion, equalise circle size to valueBox height
        const boxH = valueBox.offsetHeight;
        const diameter = boxH + 'px';
        [minusCircle, plusCircle].forEach((btn) => {
          btn.style.width = diameter;
          btn.style.height = diameter;
          btn.style.fontSize = boxH * 0.6 + 'px';
        });

        valueBox.style.pointerEvents = 'auto';
        valueBox.style.zIndex = '5';
      };

      rightWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        enterEditMode();
      });
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

    // If target habit, append rightWrap
    if (rightWrap) {
      card.appendChild(rightWrap);
    }

    // Background and border
    if (!hasTarget) {
      card.style.background = hexToRgba(cat.color, 0.07);
    }
    card.style.border = `3px solid ${cat.color}`;

    // Add event listeners for non-target habits
    if (!hasTarget) {
      const toggleBtn = card.querySelector('.complete-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dispatch(Actions.toggleHabitCompleted(habit.id, getPeriodKey(habit, date)));

          // Invalidate pills cache when habit completion changes
          invalidatePillsCache();

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
    swipeContainer.className = 'swipe-container relative overflow-visible home-inset-reduced';

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
    const date = new Date(getState().selectedDate);
    const isCompleted = isHabitCompleted(habit, date);
    const isSkipped = isHabitSkippedToday(habit, date);

    if (isCompleted) {
      // For completed habits: set completion to false and clear progress
      makeCardSwipable(swipeContainer, slideEl, habit, {
        onRestore: () => {
          // Mark as not completed
          dispatch(
            Actions.toggleHabitCompleted(
              habit.id,
              getPeriodKey(habit, new Date(getState().selectedDate))
            )
          );
          // Reset period progress to 0 (needed for target habits)
          const key = getPeriodKey(habit, new Date(getState().selectedDate));
          dispatch(
            Actions.updateHabit(habit.id, {
              progress: { [key]: 0 }
            })
          );
          // Invalidate pills cache when habit is restored
          invalidatePillsCache();
        },
      });
    } else if (isSkipped) {
      // For skipped habits: set up swipe-to-restore action
      makeCardSwipable(swipeContainer, slideEl, habit, {
        onRestore: () => {
          const dayKey = dateToKey(new Date(getState().selectedDate));
          dispatch(
            Actions.updateHabit(habit.id, {
              skippedDates: getState().habits
                .find((h) => h.id === habit.id)
                .skippedDates.filter((d) => d !== dayKey)
            })
          );

          // Reset period progress to 0 (needed for target habits)
          const key = getPeriodKey(habit, new Date(getState().selectedDate));
          dispatch(
            Actions.updateHabit(habit.id, {
              progress: { [key]: 0 }
            })
          );

          // Invalidate pills cache when habit is restored
          invalidatePillsCache();
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
    swipeContainer.className = 'swipe-container relative overflow-visible home-inset-reduced';

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
      const dayKey = dateToKey(new Date(getState().selectedDate));
      dispatch(Actions.updateHabit(habit.id, {
        skippedDates: [...getState().habits.find((h) => h.id === habit.id).skippedDates, dayKey]
      }));
      // Invalidate pills cache when habit is skipped
      invalidatePillsCache();
    });

    return swipeContainer;
  },

  /**
   * Bind edit mode exit handler
   */
  _exitEditMode(card) {
    card.dataset.editing = '0';
    this.isInEditMode = false;
    const habitContentNode = card.querySelector('.habit-content');
    if (habitContentNode) habitContentNode.style.display = '';
    const rightWrap = card.querySelector('.ml-auto.flex.flex-col.items-end');
    if (rightWrap) rightWrap.style.display = '';
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
