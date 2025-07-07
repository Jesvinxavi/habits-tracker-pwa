// src/components/hh-calendar.js
// Web-component wrapper around the existing mountCalendar() API.
// Phase 4 – Calendar 2.0 step 4.1/4.2.

import { mountCalendar } from '../features/home/calendar.js';
import { appData } from '../core/state.js';

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
          });
          this._autoScrolled = true;
        }
      });
    } else {
      this._addNavigation();
      this._resolveReady();
    }
  }

  _addNavigation() {
    // Avoid duplicate nav
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
        let cur = new Date(appData[stateKey]);
        const group =
          stateKey === 'fitnessSelectedDate' ? 'daily' : appData.selectedGroup || 'daily';
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

        // Manually update state without triggering internal instant scroll
        if (stateKey === 'fitnessSelectedDate') {
          const { getLocalMidnightISOString } = await import('../shared/datetime.js');
          appData[stateKey] = getLocalMidnightISOString(cur);
        } else {
          appData[stateKey] = cur.toISOString();
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

  /* ----------------- Virtual Window ------------------ */
  _applyVirtualWindow() {
    const weekDays = this.querySelector('.week-days');
    if (!weekDays) return;

    const stateKey = this.getAttribute('state-key') || 'currentDate';
    const centerDate = new Date(appData[stateKey]);
    if (isNaN(centerDate)) return;

    const windowStart = new Date(centerDate);
    windowStart.setDate(windowStart.getDate() - 90);
    const windowEnd = new Date(centerDate);
    windowEnd.setDate(windowEnd.getDate() + 90);

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
    if (stateKey === 'fitnessSelectedDate') {
      const { getLocalMidnightISOString } = await import('../shared/datetime.js');
      appData[stateKey] = getLocalMidnightISOString(date);
    } else {
      appData[stateKey] = date.toISOString();
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
