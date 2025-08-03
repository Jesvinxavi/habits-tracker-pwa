// src/components/hh-calendar.js
// Web-component wrapper around the existing mountCalendar() API.
// Phase 4 – Calendar 2.0 step 4.1/4.2.

import { mountCalendar } from '../features/home/calendar.js';
import { getState, dispatch, Actions } from '../core/state.js';

export class HHCalendar extends HTMLElement {
  constructor() {
    super();
    this._api = null;
    this._readyPromise = new Promise((r) => (this._resolveReady = r));
  }

  static get observedAttributes() {
    return ['selected-key'];
  }

  connectedCallback() {
    // Ensure only initialised once
    if (this._initialised) return;
    this._initialised = true;

    // We render into light DOM so existing Tailwind styles continue to apply.
    const container = document.createElement('div');
    container.className = 'week-calendar';
    this.appendChild(container);

    // Read config from attributes
    const stateKey = this.getAttribute('state-key') || 'currentDate';

    // mountCalendar still returns the familiar API; we expose it after ready.
    this._api = mountCalendar({
      container,
      stateKey,
      onDateChange: (d) => {
        // Re-emit as DOM CustomEvent for consumers
        this.dispatchEvent(
          new CustomEvent('select', { detail: { date: d }, bubbles: true, composed: true })
        );
      },
    });
    // Resolve ready after underlying calendar signals ready.
    if (this._api && this._api.ready) {
      this._api.ready.then(() => {
        this._addNavigation();
        this._resolveReady();
        if (!this._autoScrolled) {
          requestAnimationFrame(() => {
            this._api?.scrollToSelected?.({ instant: false });
            this._autoScrolled = true;
          });
        }
      });
    } else {
      this._addNavigation();
      this._resolveReady();
    }
  }

  _addNavigation() {
    if (this.querySelector('.calendar-nav')) return;

    const weekDays = this.querySelector('.week-days');
    if (!weekDays) return; // not ready yet

    const navContainer = document.createElement('div');
    navContainer.className = 'calendar-nav flex justify-center items-center gap-4 lg:gap-6';
    navContainer.innerHTML = `
      <button class="nav-arrow prev-week text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">‹‹</button>
      <button class="nav-arrow prev-day text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">‹</button>
      <button class="today-btn bg-ios-blue text-white rounded-full font-medium hover:bg-blue-600 transition-colors spring lg:px-6 lg:text-lg">Today</button>
      <button class="nav-arrow next-day text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">›</button>
      <button class="nav-arrow next-week text-ios-blue p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors spring font-bold lg:p-3 lg:text-lg">››</button>
    `;

    // Insert nav after weekDays (below calendar)
    weekDays.insertAdjacentElement('afterend', navContainer);

    // Bind actions
    navContainer.querySelectorAll('.nav-arrow').forEach((arrow) => {
      arrow.addEventListener('click', async () => {
        const stateKey = this.getAttribute('state-key') || 'currentDate';
        let cur = new Date(getState()[stateKey]);
        const group =
          stateKey === 'fitnessSelectedDate' ? 'daily' : getState().selectedGroup || 'daily';
        const isPrev = arrow.classList.contains('prev-week');
        const isNext = arrow.classList.contains('next-week');

        if (isPrev || isNext) {
          const dir = isPrev ? -1 : +1;
          switch (group) {
            case 'weekly':
              cur.setDate(cur.getDate() + dir * 28);
              break;
            case 'monthly':
              cur.setMonth(cur.getMonth() + dir * 6);
              break;
            case 'yearly':
              cur.setFullYear(cur.getFullYear() + dir * 5);
              break;
            default:
              cur.setDate(cur.getDate() + dir * 7);
          }
        } else if (arrow.classList.contains('prev-day') || arrow.classList.contains('next-day')) {
          const dirDay = arrow.classList.contains('prev-day') ? -1 : +1;
          // For fitness calendar, always move by single day regardless of group
          // For home calendar, respect the group settings
          if (stateKey === 'fitnessSelectedDate') {
            cur.setDate(cur.getDate() + dirDay);
          } else {
            switch (group) {
              case 'weekly':
                cur.setDate(cur.getDate() + dirDay * 7);
                break;
              case 'monthly':
                cur.setMonth(cur.getMonth() + dirDay);
                break;
              case 'yearly':
                cur.setFullYear(cur.getFullYear() + dirDay);
                break;
              default:
                cur.setDate(cur.getDate() + dirDay);
            }
          }
        }

        // Check against anchor date to prevent going before the first available day
        const anchor = this._getAnchorDate(stateKey, group);
        if (anchor && cur < anchor) {
          cur = new Date(anchor);
        }

        // Update global state via dispatched action so other views update too
        const { getLocalMidnightISOString } = await import('../shared/datetime.js');
        if (stateKey === 'fitnessSelectedDate') {
          dispatch(Actions.setFitnessSelectedDate(getLocalMidnightISOString(cur)));
        } else {
          dispatch(Actions.setSelectedDate(getLocalMidnightISOString(cur)));
        }
        // Refresh tiles to reflect new selection colour immediately
        this._api?.refresh?.();

        // Now smooth-scroll to center AFTER colour change
        requestAnimationFrame(() => {
          this._api?.scrollToSelected?.({ instant: false });
        });
      });
    });

    navContainer.querySelector('.today-btn')?.addEventListener('click', async () => {
      const today = new Date();
      await this.setDate(today, { smooth: true });
    });

    // ensure helpers ready
    this._applyVirtualWindow();
    this._setupResizeObserver();
  }

  // Helper method to get the anchor date for preventing navigation before first day
  _getAnchorDate(stateKey, group) {
    // For fitness calendar, find the earliest activity date or use today as fallback
    if (stateKey === 'fitnessSelectedDate') {
      // Find the earliest activity creation date
      const earliestActivityDate = (getState().activities || []).reduce((acc, activity) => {
        let d = null;
        if (activity.createdAt) {
          d = new Date(activity.createdAt);
        } else if (typeof activity.id === 'string' && /^\d{13}/.test(activity.id)) {
          const ts = parseInt(activity.id.slice(0, 13), 10);
          if (!Number.isNaN(ts)) {
            const utcDate = new Date(ts);
            d = new Date(utcDate.getFullYear(), utcDate.getMonth(), utcDate.getDate());
          }
        }
        return !acc || (d && d < acc) ? d : acc;
      }, null);

      // If we have activities, use the earliest activity date; otherwise use today
      if (earliestActivityDate) {
        return this._getPeriodStart(earliestActivityDate, 'daily');
      }
      
      // Fallback to today if no activities exist
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return this._getPeriodStart(today, 'daily');
    }

    // For home calendar, find the earliest habit creation date
    const earliestHabitDate = (getState().habits || []).reduce((acc, h) => {
      let d = null;
      if (h.createdAt) {
        d = new Date(h.createdAt);
      } else if (typeof h.id === 'string' && /^\d{13}/.test(h.id)) {
        const ts = parseInt(h.id.slice(0, 13), 10);
        if (!Number.isNaN(ts)) {
          const utcDate = new Date(ts);
          d = new Date(utcDate.getFullYear(), utcDate.getMonth(), utcDate.getDate());
        }
      }
      return !acc || (d && d < acc) ? d : acc;
    }, null);

    if (earliestHabitDate) {
      return this._getPeriodStart(earliestHabitDate, group);
    }

    // Fallback to today if no habits exist
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this._getPeriodStart(today, group);
  }

  // Helper method to get period start date
  _getPeriodStart(date, group) {
    const d = new Date(date);
    switch (group) {
      case 'weekly': {
        // Monday as first day of week
        const day = d.getDay();
        const diff = (day + 6) % 7; // 0 (Sun)->6, 1 (Mon)->0 ...
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case 'monthly':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
      case 'yearly':
        d.setMonth(0, 1);
        d.setHours(0, 0, 0, 0);
        return d;
      case 'daily':
      default:
        d.setHours(0, 0, 0, 0);
        return d;
    }
  }

  /* ----------------- Virtual Window ------------------ */
  _applyVirtualWindow() {
    const weekDays = this.querySelector('.week-days');
    if (!weekDays) return;

    const stateKey = this.getAttribute('state-key') || 'currentDate';
    const centerDate = new Date(getState()[stateKey]);
    if (isNaN(centerDate)) return;

    const group = stateKey === 'fitnessSelectedDate' ? 'daily' : getState().selectedGroup || 'daily';

    const rangeMap = {
      daily: 90,
      weekly: 540, // ~18 months
      monthly: 3650, // ~10 years
      yearly: 36500, // ~100 years
    };
    const spanDays = rangeMap[group] || 365;

    const windowStart = new Date(centerDate);
    windowStart.setDate(windowStart.getDate() - spanDays);
    const windowEnd = new Date(centerDate);
    windowEnd.setDate(windowEnd.getDate() + spanDays);

    weekDays.querySelectorAll('.day-item').forEach((el) => {
      const d = new Date(el.dataset.date);
      const hide = d < windowStart || d > windowEnd;
      el.style.display = hide ? 'none' : '';
    });
  }

  /* ----------------- Resize padding ------------------ */
  _setupResizeObserver() {
    const weekDays = this.querySelector('.week-days');
    if (!weekDays) return;

    if (this._ro) return; // already set

    this._ro = new ResizeObserver(() => this._recalcPadding());
    this._ro.observe(this);
  }

  _recalcPadding() {
    const weekDays = this.querySelector('.week-days');
    if (!weekDays) return;
    const firstTile = weekDays.querySelector('.day-item');
    if (!firstTile) return;
    let contW = this.getBoundingClientRect().width;
    if (!contW && typeof window !== 'undefined') contW = window.innerWidth;
    const tileW = firstTile.getBoundingClientRect().width;
    weekDays.style.paddingLeft = `${Math.max(0, contW / 2 - tileW / 2)}px`;
  }

  /* -------------- Override calendar API -------------- */
  async setDate(date, { smooth = false } = {}) {
    const stateKey = this.getAttribute('state-key') || 'currentDate';
    const { getLocalMidnightISOString } = await import('../shared/datetime.js');
    if (stateKey === 'fitnessSelectedDate') {
      dispatch(Actions.setFitnessSelectedDate(getLocalMidnightISOString(date)));
    } else {
      dispatch(Actions.setSelectedDate(getLocalMidnightISOString(date)));
    }
    this._api?.refresh?.();
    this._applyVirtualWindow();
    if (smooth) {
      requestAnimationFrame(() => {
        this._api?.scrollToSelected?.({ instant: false });
      });
    }
  }

  refresh() {
    this._api?.refresh?.();
    this._applyVirtualWindow();
    this._recalcPadding();
  }

  // Expose invalidate for external callers
  invalidate() {
    this.refresh();
  }

  // -------- Imperative API wrappers --------
  get ready() {
    return this._readyPromise;
  }

  scrollToSelected(opts = {}) {
    this._api?.scrollToSelected?.(opts);
  }

  disconnectedCallback() {
    this._api?.destroy?.();
  }
}

// Define once
if (!customElements.get('hh-calendar')) {
  customElements.define('hh-calendar', HHCalendar);
}
