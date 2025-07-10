import { getState, dispatch, Actions } from '../../core/state.js';
import { isHoliday } from '../../features/holidays/holidays.js';
import {
  getISOWeekNumber,
  isSamePeriod,
  advanceDate,
  dateToKey,
  getLocalISODate,
  getLocalMidnightISOString,
} from '../../shared/datetime.js';
import { centerOnSelector } from '../../components/scrollHelpers.js';
import { MONTH_NAMES_SHORT as MONTHS, DAY_NAMES_SHORT as DAYS } from '../../shared/constants.js';
import { isRestDay } from '../../features/fitness/restDays.js';

/**
 * @typedef {Object} CalendarController
 * @prop {Promise<void>} ready            Resolves after DOM & fonts ready
 * @prop {(d:Date)=>void} setDate         Selects new date, re-renders
 * @prop {(o?:{instant?:boolean})=>void} scrollToSelected
 * @prop {()=>void} destroy
 */

// Near top or after helper declarations (after getPeriodStart)
// Group anchors are now per-instance to avoid conflicts between home and fitness calendars

// ---------------------------------------------------------------------------
//  REUSABLE CALENDAR MOUNTER
// ---------------------------------------------------------------------------

/**
 * Creates a scroll-able week calendar inside the given container element.
 *
 * options:
 *   container   – DOM node that will host (or already contains) a .week-days div.
 *   stateKey    – key inside appData to read/write (default 'currentDate').
 *   onDateChange(cb) – optional callback invoked after the date changes.
 */
export function mountCalendar({ container, stateKey = 'currentDate', onDateChange } = {}) {
  if (!container) throw new Error('[calendar] mountCalendar: container is required');

  // Group anchors are now per-instance to avoid conflicts between home and fitness calendars
  const _groupAnchors = {};

  // Ensure week-days strip exists.
  let weekDays = container.querySelector('.week-days');
  if (!weekDays) {
    weekDays = document.createElement('div');
    weekDays.className = 'week-days';
    container.appendChild(weekDays);
  }

  // Ready promise setup
  let _resolveReady;
  const ready = new Promise((resolve) => {
    _resolveReady = resolve;
  });

  function getStateDate() {
    return new Date(getState()[stateKey]);
  }

  function setStateDate(dateObj) {
    // Use timezone-safe local midnight ISO for all calendars to prevent timezone issues
    if (stateKey === 'fitnessSelectedDate') {
      dispatch(Actions.setFitnessSelectedDate(getLocalMidnightISOString(dateObj)));
    } else {
      dispatch(Actions.setSelectedDate(getLocalMidnightISOString(dateObj)));
    }
    if (typeof onDateChange === 'function') onDateChange(dateObj);
  }

  /* -------------------- helpers -------------------- */
  function center(dayEl) {
    centerOnSelector(weekDays, '.day-item.current-day', { instant: false });
  }

  function scrollToSelected({ instant = false } = {}) {
    // Ensure the selected tile is visible and centered
    const selectedTile = weekDays.querySelector('.day-item.current-day');
    if (selectedTile) {
      centerOnSelector(
        weekDays, // parent scroller
        '.day-item.current-day', // selected tile
        { instant }
      );
    }
  }

  function setDate(dateObj) {
    setStateDate(dateObj);
    updateClasses();
    scrollToSelected({ instant: true });
  }

  function buildDays() {
    weekDays.innerHTML = '';
    const baseDate = getStateDate();
    // For fitness calendar, always use 'daily' group for proper day-by-day navigation
    const group = stateKey === 'fitnessSelectedDate' ? 'daily' : getState().selectedGroup || 'daily';

    // Determine earliest period for calendar generation
    function getEarliestDate() {
      // For fitness calendar, use the currently selected fitness date as the anchor –
      // this is effectively the "first" day (installation day).
      // No days before this will be generated, matching Home calendars.
      if (stateKey === 'fitnessSelectedDate') {
        const sel = getStateDate();
        if (sel && !isNaN(sel)) {
          return new Date(sel);
        }
        // Fallback to today if somehow invalid
        return new Date();
      }

      // For home calendar, find the earliest habit creation date to prevent showing
      // tiles before the first habit was created
      const earliestHabitDate = (getState().habits || []).reduce((acc, h) => {
        let d = null;
        if (h.createdAt) {
          // Parse timezone-safe creation date
          d = new Date(h.createdAt);
        } else if (typeof h.id === 'string' && /^\d{13}/.test(h.id)) {
          // Extract timestamp from habit ID and create local date
          const ts = parseInt(h.id.slice(0, 13), 10);
          if (!Number.isNaN(ts)) {
            const utcDate = new Date(ts);
            // Convert to local date to avoid timezone issues
            d = new Date(utcDate.getFullYear(), utcDate.getMonth(), utcDate.getDate());
          }
        }
        return !acc || (d && d < acc) ? d : acc;
      }, null);

      // Return the earliest habit date or today if no habits exist
      return earliestHabitDate || new Date();
    }

    const earliestDate = getEarliestDate();
    const earliestPeriodStart = getPeriodStart(earliestDate, group);

    // Always reset anchor to earliest period each time build runs (prevents drift when switching groups)
    _groupAnchors[group] = new Date(earliestPeriodStart);

    const start = new Date(_groupAnchors[group]);

    // Generate a fixed number of periods for each group for consistent UX
    const periodCounts = {
      daily: stateKey === 'fitnessSelectedDate' ? 270 : 180, // 9 months for fitness, 6 months for habits
      weekly: 156, // 3 years
      monthly: 36, // 3 years
      yearly: 40, // 40 years
    };

    const periodsToGenerate = periodCounts[group] || 180;

    let date = new Date(start);

    for (let i = 0; i < periodsToGenerate; i++) {
      // For fitness calendar, always use daily labels regardless of selectedGroup
      const lbl =
        stateKey === 'fitnessSelectedDate'
          ? getCalendarLabels(date, 'daily')
          : getCalendarLabels(date);
      const el = document.createElement('div');
      el.className = 'day-item';
      if (group === 'yearly') {
        el.style.paddingTop = '16px';
        el.style.paddingBottom = '16px';
      }

      // Use timezone-safe local midnight ISO for all calendars to prevent timezone issues
      el.dataset.date = getLocalMidnightISOString(date);

      el.innerHTML = `<span class="day-name block text-xs">${lbl.name}</span>
                      <span class="day-number block text-lg font-semibold">${lbl.number}</span>
                      <span class="day-month text-xs mt-0.5 ${lbl.month ? '' : 'hidden'}">${lbl.month}</span>`;

      // classes (selected / today)
      const isToday = isSamePeriod(date, new Date(), group);
      const isSel = isSamePeriod(date, baseDate, group);
      if (isSel) el.classList.add('current-day');
      else if (isToday) el.classList.add('today');

      // adjust padding per group
      fixTilePadding(el, group, isSel);

      // Holiday badge – only in Daily group and not fitness calendar
      if (stateKey !== 'fitnessSelectedDate') {
        const hol = group === 'daily' && isHoliday(dateToKey(date));
        el.classList.toggle('holiday', hol);
        const hasIcon = !!el.querySelector('.holiday-icon');
        if (hol && !hasIcon) {
          el.insertAdjacentHTML(
            'beforeend',
            '<span class="material-icons holiday-icon">flight</span>'
          );
        } else if (!hol && hasIcon) {
          el.querySelector('.holiday-icon').remove();
        }
      }

      // Rest day badge – only for fitnessSelectedDate calendar
      if (stateKey === 'fitnessSelectedDate') {
        const iso = getLocalISODate(date);
        const isRest = isRestDay(iso);

        el.classList.toggle('rest-day', isRest);
        const rIcon = el.querySelector('.rest-icon');
        if (isRest && !rIcon) {
          el.insertAdjacentHTML(
            'beforeend',
            '<span class="material-icons rest-icon block mt-0.5 text-lg">bed</span>'
          );
        } else if (!isRest && rIcon) {
          rIcon.remove();
        }
      }

      weekDays.appendChild(el);

      // advance to next period
      advanceDate(date, group, +1);
    }
    // Reset scroll position so leading padding works as intended
    weekDays.scrollLeft = 0;
    const firstTile = weekDays.querySelector('.day-item');
    if (firstTile) {
      let contW = container.getBoundingClientRect().width;
      if (!contW && container.parentElement) {
        // Fallback to parent width if container is not yet in DOM
        contW = container.parentElement.getBoundingClientRect().width;
      }
      if (!contW && typeof window !== 'undefined') {
        // Final fallback to viewport width
        contW = window.innerWidth;
      }
      const tileW = firstTile.getBoundingClientRect().width;
      weekDays.style.paddingLeft = `${Math.max(0, contW / 2 - tileW / 2)}px`;
    }
  }

  function updateClasses() {
    // For fitness calendar, always use 'daily' for selection logic
    const group = stateKey === 'fitnessSelectedDate' ? 'daily' : getState().selectedGroup || 'daily';
    weekDays.querySelectorAll('.day-item').forEach((el) => {
      const d = new Date(el.dataset.date);
      const isSel = isSamePeriod(d, getStateDate(), group);
      const isToday = isSamePeriod(d, new Date(), group);
      el.classList.toggle('current-day', isSel);
      el.classList.toggle('today', isToday && !isSel);
      // Update numbers/names if month/day may have changed (e.g. locale change)
      // For fitness calendar, always use daily labels
      const lblUpd =
        stateKey === 'fitnessSelectedDate'
          ? getCalendarLabels(new Date(el.dataset.date), 'daily')
          : getCalendarLabels(new Date(el.dataset.date));
      const nameEl = el.querySelector('.day-name');
      const numEl = el.querySelector('.day-number');
      const monthEl = el.querySelector('.day-month');
      if (nameEl) {
        nameEl.textContent = lblUpd.name;
        nameEl.style.display = lblUpd.name ? '' : 'none';
      }
      if (numEl) {
        numEl.textContent = lblUpd.number;
      }
      if (monthEl) {
        monthEl.textContent = lblUpd.month;
        monthEl.style.display = lblUpd.month ? '' : 'none';
      }
      if (group === 'daily' && monthEl) {
        const shouldShow = d.getDate() === 1 || isSel || isToday;
        if (shouldShow) {
          monthEl.textContent = new Date(d).toLocaleString('en-US', { month: 'short' });
          monthEl.style.display = '';
        } else {
          monthEl.style.display = 'none';
        }
      }
      // Holiday badge – skip for fitness calendar
      if (stateKey !== 'fitnessSelectedDate') {
        const hol = group === 'daily' && isHoliday(dateToKey(d));
        el.classList.toggle('holiday', hol);
        const hasIcon = !!el.querySelector('.holiday-icon');
        if (hol && !hasIcon) {
          el.insertAdjacentHTML(
            'beforeend',
            '<span class="material-icons holiday-icon">flight</span>'
          );
        } else if (!hol && hasIcon) {
          el.querySelector('.holiday-icon').remove();
        }
      }

      // Rest day styling for fitness calendar
      if (stateKey === 'fitnessSelectedDate') {
        const iso = getLocalISODate(d);
        const isRest = isRestDay(iso);

        el.classList.toggle('rest-day', isRest);
        const rIcon = el.querySelector('.rest-icon');
        if (isRest && !rIcon) {
          el.insertAdjacentHTML(
            'beforeend',
            '<span class="material-icons rest-icon block mt-0.5 text-lg">bed</span>'
          );
        } else if (!isRest && rIcon) {
          rIcon.remove();
        }
      }

      if (group === 'yearly') {
        const pad = isSel ? 22 : 16;
        el.style.paddingTop = pad + 'px';
        el.style.paddingBottom = pad + 'px';
      }

      fixTilePadding(el, group, isSel);
    });
  }

  function handleClick(e) {
    const dayEl = e.target.closest('.day-item');
    if (!dayEl) return;
    const picked = new Date(dayEl.dataset.date);
    setStateDate(picked);
    updateClasses();
    center(dayEl);
  }

  /* -------------------- init -------------------- */
  async function mount() {
    // a. Build tiles
    buildDays();
    updateClasses();

    // b. await document.fonts.ready
    await document.fonts.ready;

    // c. Small delay to ensure DOM is fully rendered
    await new Promise((resolve) => setTimeout(resolve, 50));

    // d. Resolve ready promise
    _resolveReady();

    // e. Call scrollToSelected with instant
    scrollToSelected({ instant: true });
  }

  // Start mounting process
  mount();

  weekDays.addEventListener('click', handleClick);

  // Optional nav arrows inside the container
  container.querySelectorAll('.nav-arrow').forEach((arrow) => {
    arrow.addEventListener('click', () => {
      let cur = getStateDate();
      // For fitness calendar, always use 'daily' group for proper day-by-day navigation
      const grp = stateKey === 'fitnessSelectedDate' ? 'daily' : getState().selectedGroup || 'daily';
      const isPrev = arrow.classList.contains('prev-week');
      const isNext = arrow.classList.contains('next-week');

      if (isPrev || isNext) {
        const dir = isPrev ? -1 : +1;
        switch (grp) {
          case 'weekly':
            cur.setDate(cur.getDate() + dir * 28); // 4 weeks
            break;
          case 'monthly':
            cur.setMonth(cur.getMonth() + dir * 6); // 6 months
            break;
          case 'yearly':
            cur.setFullYear(cur.getFullYear() + dir * 5); // 5 years
            break;
          case 'daily':
          default:
            cur.setDate(cur.getDate() + dir * 7); // 1 week
            break;
        }
      } else if (arrow.classList.contains('prev-day') || arrow.classList.contains('next-day')) {
        const dirDay = arrow.classList.contains('prev-day') ? -1 : +1;
        // For fitness calendar, always move by single day regardless of group
        // For home calendar, respect the group settings
        if (stateKey === 'fitnessSelectedDate') {
          cur.setDate(cur.getDate() + dirDay);
        } else {
          switch (grp) {
            case 'weekly':
              cur.setDate(cur.getDate() + dirDay * 7);
              break;
            case 'monthly':
              cur.setMonth(cur.getMonth() + dirDay);
              break;
            case 'yearly':
              cur.setFullYear(cur.getFullYear() + dirDay);
              break;
            case 'daily':
            default:
              cur.setDate(cur.getDate() + dirDay);
          }
        }
      }
      const anchor = _groupAnchors[grp] ? new Date(_groupAnchors[grp]) : null;
      if (anchor && cur < anchor) {
        cur = new Date(anchor);
      }
      setStateDate(cur);
      updateClasses();
      const selEl = weekDays.querySelector('.day-item.current-day');
      if (selEl) center(selEl);
    });
  });

  // Today button – jump back to real today
  const todayBtn = container.querySelector('.today-btn');
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const today = new Date();
      setStateDate(today);
      updateClasses();
      const selEl = weekDays.querySelector('.day-item.current-day');
      if (selEl) center(selEl);
    });
  }

  // For fitness calendar, always track 'daily' as the last group reference
  let lastGroupRef = stateKey === 'fitnessSelectedDate' ? 'daily' : getState().selectedGroup;

  // Visibility guard
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scrollToSelected({ instant: true });
  });

  // Expose the CalendarController API
  return {
    ready,
    setDate,
    scrollToSelected,
    destroy: () => {
      // Cleanup if needed
      weekDays.removeEventListener('click', handleClick);
    },
    refresh: () => {
      // For fitness calendar, don't rebuild when selectedGroup changes
      if (stateKey === 'fitnessSelectedDate') {
        // If paddingLeft is zero, it likely means buildDays() ran before the container was in the DOM
        const currentPadding = parseFloat(weekDays.style.paddingLeft || '0');
        if (!currentPadding) {
          buildDays();
        }
        updateClasses();
        const selEl = weekDays.querySelector('.day-item.current-day');
        if (selEl) center(selEl);
      } else {
        const currentGroup = getState().selectedGroup;
        if (currentGroup !== lastGroupRef) {
          // reset anchor for new group to earliest period
          const earliestDate = (getState().habits || []).reduce((acc, h) => {
            let d = null;
            if (h.createdAt) {
              // Parse timezone-safe creation date
              d = new Date(h.createdAt);
            } else if (typeof h.id === 'string' && /^\d{13}/.test(h.id)) {
              // Extract timestamp from habit ID and create local date
              const ts = parseInt(h.id.slice(0, 13), 10);
              if (!Number.isNaN(ts)) {
                const utcDate = new Date(ts);
                // Convert to local date to avoid timezone issues
                d = new Date(utcDate.getFullYear(), utcDate.getMonth(), utcDate.getDate());
              }
            }
            return !acc || (d && d < acc) ? d : acc;
          }, null) || new Date();
          _groupAnchors[currentGroup] = getPeriodStart(earliestDate, currentGroup);
          buildDays();
          lastGroupRef = currentGroup;
        }
        updateClasses();
        const selEl = weekDays.querySelector('.day-item.current-day');
        if (selEl) center(selEl);
      }
    },
  };
}

// -------------------- GROUP-AWARE CALENDAR LABELS --------------------
/**
 * Returns label strings for the calendar item based on the currently selected
 * habit group. We re-use the existing three spans (.day-name, .day-number,
 * .day-month) but may hide some of them by returning an empty string.
 */
function getCalendarLabels(date, forceGroup = null) {
  const group = forceGroup || getState().selectedGroup || 'daily';
  const yearFull = date.getFullYear();
  const yearShort = String(yearFull).slice(-2);
  const monthAbbr = MONTHS[date.getMonth()];
  switch (group) {
    case 'weekly': {
      return {
        name: String(yearFull),
        number: `W${getISOWeekNumber(date)}`,
        month: '', // hide
      };
    }
    case 'monthly': {
      return {
        name: monthAbbr,
        number: yearShort,
        month: '',
      };
    }
    case 'yearly': {
      return {
        name: '',
        number: yearShort,
        month: '',
      };
    }
    case 'daily':
    default: {
      return {
        name: DAYS[date.getDay()],
        number: date.getDate(),
        month: date.getDate() === 1 ? monthAbbr : '',
      };
    }
  }
}

// Return the first date representing the current period for the given group
function getPeriodStart(date, group = getState().selectedGroup || 'daily') {
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

// Ensure tile heights align across groups by adjusting vertical padding.
function fixTilePadding(el, group, isSel = false) {
  if (!el) return;
  if (group === 'daily') return; // daily already desired height

  if (group === 'weekly') {
    // Use same padding as monthly for consistent heights
    const pad = isSel ? 16 : 12;
    el.style.paddingTop = pad + 'px';
    el.style.paddingBottom = pad + 'px';
    return;
  }
  if (group === 'monthly') {
    const pad = isSel ? 16 : 12;
    el.style.paddingTop = pad + 'px';
    el.style.paddingBottom = pad + 'px';
    return;
  }

  if (group === 'yearly') {
    const pad = isSel ? '22px' : '18px';
    el.style.paddingTop = pad;
    el.style.paddingBottom = pad;
  }
}



// ---------------------------------------------------------------------------
//  HOME CALENDAR EXPORT
// ---------------------------------------------------------------------------

let _homeCalendarApi = null;

export const HomeCalendar = {
  ready: null,
  setDate: null,
  scrollToSelected: null,
  destroy: () => {
    if (_homeCalendarApi) {
      _homeCalendarApi.destroy();
      _homeCalendarApi = null;
    }
  },
};

// Store home calendar API reference
export function setHomeCalendarApi(api) {
  _homeCalendarApi = api;
  HomeCalendar.ready = api.ready;
  HomeCalendar.setDate = api.setDate;
  HomeCalendar.scrollToSelected = api.scrollToSelected;
  if (typeof window !== 'undefined') {
    window._homeCalendarApi = api;
  }
}
