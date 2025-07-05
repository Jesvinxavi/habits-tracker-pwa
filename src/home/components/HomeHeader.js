// HomeHeader.js - Header component for the home view
import * as scheduleUtils from '../schedule.js';
import { appData, mutate } from '../../core/state.js';
import { capitalize } from '../../utils/common.js';
import { dateToKey } from '../../utils/datetime.js';

// Map each group to a Material Design icon name
const GROUP_ICONS = {
  daily: 'today', // calendar today icon
  weekly: 'view_week', // weekly calendar columns icon
  monthly: 'date_range', // month range icon
  yearly: 'event', // general calendar/event icon
};

/**
 * HomeHeader component that manages the group pill and holiday toggle
 */
export const HomeHeader = {
  /**
   * Mounts the header component
   */
  mount(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this._createHeader();
    this._bindEvents();
  },

  /**
   * Creates the header structure
   */
  _createHeader() {
    // The container is already the .habits-title element
    // We just need to build the group pill and holiday toggle
    this.titleContainer = this.container;
    this.headerEl = this.container.closest('.habits-header');

    this._buildGroupPill();
    this._buildHolidayToggle();
  },

  /**
   * Builds the group pill
   */
  _buildGroupPill() {
    if (!this.titleContainer) return;

    // Avoid duplicating if we've already inserted it
    if (this.titleContainer.querySelector('#group-pill')) return;

    // Remove the existing content so only the pill remains
    this.titleContainer.innerHTML = '';

    const pill = document.createElement('div');
    pill.id = 'group-pill';
    pill.className =
      'flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-gray-800 rounded-full cursor-pointer select-none w-full justify-center text-lg font-bold home-inset';

    // Ensure pill stretches to container width if desired
    this.titleContainer.style.display = 'flex';
    this.titleContainer.style.justifyContent = 'center';

    pill.innerHTML = `
      <span id="group-icon" class="material-icons text-xl">${GROUP_ICONS[appData.selectedGroup]}</span>
      <span id="group-title" class="text-xl font-bold">${capitalize(appData.selectedGroup)} Habits</span>
    `;

    this.titleContainer.appendChild(pill);

    // Reduce bottom padding of header to tighten space below pill
    if (this.headerEl) this.headerEl.style.paddingBottom = '8px';
  },

  /**
   * Builds the holiday toggle
   */
  _buildHolidayToggle() {
    if (!this.headerEl) return;

    // Ensure header uses flex layout spaced between
    this.headerEl.classList.add('justify-between');

    let toggle = document.getElementById('holiday-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.id = 'holiday-toggle';
      toggle.className =
        'relative flex items-center justify-center h-9 bg-gray-200 text-gray-500 rounded-full overflow-hidden select-none mr-4';
      toggle.style.width = '36px';
      toggle.innerHTML =
        '<span class="plane material-icons absolute left-2 top-1/2 -translate-y-1/2 transition-transform text-2xl">flight</span><span class="label whitespace-nowrap ml-1 text-sm font-medium opacity-0 transition-opacity">Holiday Mode</span>';

      this.headerEl.appendChild(toggle);
    }

    this._updateHolidayToggle();
  },

  /**
   * Updates the holiday toggle state
   */
  _updateHolidayToggle() {
    const toggle = document.getElementById('holiday-toggle');
    if (!toggle) return;

    Promise.all([import('../../utils/holidays.js'), import('../../utils/datetime.js')]).then(
      ([{ isHoliday }, { dateToKey }]) => {
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
      }
    );
  },

  /**
   * Binds event handlers
   */
  _bindEvents() {
    // Holiday toggle click handler
    const toggle = document.getElementById('holiday-toggle');
    if (toggle) {
      toggle.addEventListener('click', this._handleHolidayToggle.bind(this));
    }

    // Group pill swipe handler
    const pill = document.getElementById('group-pill');
    if (pill) {
      this._bindGroupPillEvents(pill);
    }
  },

  /**
   * Handles holiday toggle click
   */
  _handleHolidayToggle() {
    const targetISO = dateToKey(new Date(appData.selectedDate));
    Promise.all([
      import('../../utils/holidays.js'),
      import('../../components/ConfirmDialog.js'),
    ]).then(([hol, { showConfirm }]) => {
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

      if (this.callbacks.onHolidayToggle) {
        this.callbacks.onHolidayToggle(true);
      }
    });
  },

  /**
   * Binds group pill swipe events
   */
  _bindGroupPillEvents(pill) {
    let startX = 0;
    let isDragging = false;
    let hasMoved = false;
    let isMouseDown = false;

    // Handle both touch and mouse events
    const handleStart = (e) => {
      // Don't start dragging if clicking on actual button elements
      if (e.target.tagName === 'BUTTON') {
        return;
      }

      startX = e.touches ? e.touches[0].clientX : e.clientX;
      isDragging = true;
      hasMoved = false;
      isMouseDown = true;
    };

    const handleMove = (e) => {
      if (!isDragging || !isMouseDown) return;

      const currentX = e.touches ? e.touches[0].clientX : e.clientX;
      const delta = Math.abs(currentX - startX);

      // Only prevent default and mark as moved if we've moved enough
      if (delta > 5) {
        hasMoved = true;
        e.preventDefault(); // Prevent default behavior during drag
      }
    };

    const handleEnd = (e) => {
      if (!isDragging) return;

      const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const delta = endX - startX;

      // Only trigger group change if we actually moved and exceeded threshold
      if (hasMoved && Math.abs(delta) >= 40) {
        const dir = delta < 0 ? +1 : -1; // left swipe -> next (+1)
        const nextGroup = this._findNextGroupWithHabits(appData.selectedGroup, dir);

        mutate((s) => {
          s.selectedGroup = nextGroup;
          // Always reset selectedDate to today so the new group's calendar
          // starts on the current period (today/this week/this month/this year)
          s.selectedDate = new Date().toISOString();
        });

        if (this.callbacks.onGroupChange) {
          this.callbacks.onGroupChange(nextGroup);
        }
      }

      isDragging = false;
      hasMoved = false;
      isMouseDown = false;
    };

    // Touch events for mobile
    pill.addEventListener('touchstart', handleStart, { passive: true });
    pill.addEventListener('touchmove', handleMove, { passive: false });
    pill.addEventListener('touchend', handleEnd, { passive: true });

    // Mouse events for desktop
    pill.addEventListener('mousedown', handleStart);
    pill.addEventListener('mousemove', handleMove);
    pill.addEventListener('mouseup', handleEnd);
    pill.addEventListener('mouseleave', handleEnd);
  },

  /**
   * Finds the next group with habits
   */
  _findNextGroupWithHabits(current, dir) {
    const groups = ['daily', 'weekly', 'monthly', 'yearly'];
    const idx = groups.indexOf(current);

    for (let i = 1; i <= groups.length; i++) {
      const nextIdx = (idx + dir * i + groups.length) % groups.length;
      const g = groups[nextIdx];

      // Allow navigation if the user has any habits under that group at all,
      // even when none are scheduled for the *current* date. This ensures e.g.
      // Monthly group is still reachable outside the months where Yearly habits
      // are active.
      const hasAny =
        g === 'daily'
          ? true
          : appData.habits.some((h) => scheduleUtils.belongsToSelectedGroup(h, g) && !h.paused);

      if (hasAny) return g;
    }

    return current; // fallback
  },

  /**
   * Renders the header
   */
  render() {
    this._updateGroupPill();
    this._updateHolidayToggle();
  },

  /**
   * Updates the group pill
   */
  _updateGroupPill() {
    const iconEl = document.getElementById('group-icon');
    const titleEl = document.getElementById('group-title');

    if (iconEl) {
      iconEl.textContent = GROUP_ICONS[appData.selectedGroup];
    }

    if (titleEl) {
      titleEl.textContent = `${capitalize(appData.selectedGroup)} Habits`;
    }
  },

  /**
   * Unmounts the header component
   */
  unmount() {
    // Remove event listeners
    const toggle = document.getElementById('holiday-toggle');
    if (toggle) {
      toggle.removeEventListener('click', this._handleHolidayToggle);
    }

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  },
};

/**
 * Standalone function for updating holiday toggle (for external use)
 */
export function updateHolidayToggle() {
  if (HomeHeader._updateHolidayToggle) {
    HomeHeader._updateHolidayToggle();
  }
}
