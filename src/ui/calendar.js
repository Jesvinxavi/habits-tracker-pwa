import { appData } from '../core/state.js';
import { mutate } from '../core/state.js';
import { isHoliday, dateToKey } from '../utils/holidays.js';
import { getISOWeekNumber, isSamePeriod, advanceDate, getLocalISODate } from '../utils/datetime.js';
import { centerHorizontally } from '../components/scrollHelpers.js';
import { MONTH_NAMES_SHORT as MONTHS, DAY_NAMES_SHORT as DAYS } from '../utils/constants.js';
import { isRestDay } from '../utils/restDays.js';

// Near top or after helper declarations (after getPeriodStart)
const _groupAnchors = {};

function updateWeekCalendar() {
  let currentDate = new Date(appData.currentDate);
  const dayItems = document.querySelectorAll('.day-item');
  dayItems.forEach((item) => {
    const date = new Date(item.dataset.date);
    const lblU = getCalendarLabels(date);
    const nameEl = item.querySelector('.day-name');
    const numEl = item.querySelector('.day-number');
    const monthEl = item.querySelector('.day-month');
    if (nameEl) {
      nameEl.textContent = lblU.name;
      nameEl.style.display = lblU.name ? '' : 'none';
    }
    if (numEl) numEl.textContent = lblU.number;
    if (monthEl) {
      monthEl.textContent = lblU.month;
      monthEl.style.display = lblU.month ? '' : 'none';
    }
    const isSel = isSamePeriod(date, currentDate, appData.selectedGroup);
    const isToday = isSamePeriod(date, new Date(), appData.selectedGroup);
    const showHoliday = appData.selectedGroup === 'daily';
    const isHol = showHoliday && isHoliday(dateToKey(date));
    item.classList.toggle('current-day', isSel);
    item.classList.toggle('today', isToday && !isSel);
    item.classList.toggle('holiday', isHol);
    if (appData.selectedGroup === 'daily') {
      const shouldShow = date.getDate() === 1 || isSel || isToday;
      if (shouldShow) {
        monthEl.textContent = new Date(date).toLocaleString('en-US', { month: 'short' });
        monthEl.style.display = '';
      } else {
        monthEl.style.display = 'none';
      }
    }

    // Icon handling – only for Daily group
    const hol = showHoliday && isHoliday(dateToKey(date));
    const hasIcon = !!item.querySelector('.holiday-icon');
    if (hol && !hasIcon) {
      item.insertAdjacentHTML(
        'beforeend',
        '<span class="material-icons holiday-icon">flight</span>'
      );
    } else if (!hol && hasIcon) {
      item.querySelector('.holiday-icon').remove();
    }

    if (appData.selectedGroup === 'yearly') {
      const pad = isSel ? 22 : 16;
      item.style.paddingTop = pad + 'px';
      item.style.paddingBottom = pad + 'px';
    }

    fixTilePadding(item, appData.selectedGroup, isSel);
  });
  // After updating all day items, ensure the selected day is centered in view
  const currentEl = document.querySelector('.day-item.current-day');
  if (currentEl) {
    centerHorizontally(currentEl);
  }
}

function populateCalendar() {
  const container = document.querySelector('.week-days');
  if (!container) return;
  container.innerHTML = '';
  const baseDate = new Date(appData.currentDate);
  const group = appData.selectedGroup || 'daily';
  if (!_groupAnchors[group]) _groupAnchors[group] = getPeriodStart(baseDate, group);
  let startDate = new Date(_groupAnchors[group]);

  const selStart = getPeriodStart(baseDate, group);
  if (selStart < _groupAnchors[group]) {
    _groupAnchors[group] = new Date(selStart);
    startDate = new Date(selStart);
  }

  let date = new Date(startDate);
  const endDate = new Date(startDate);
  if (group === 'yearly') endDate.setFullYear(endDate.getFullYear() + 15);
  else if (group === 'monthly') endDate.setMonth(endDate.getMonth() + 24);
  else if (group === 'weekly') endDate.setDate(endDate.getDate() + 730);
  else endDate.setDate(endDate.getDate() + 730);

  const advance = (d) => advanceDate(d, group, +1);

  while (date <= endDate) {
    const lbl = getCalendarLabels(date);
    const dayEl = document.createElement('div');
    dayEl.className = 'day-item';
    if (group === 'yearly') {
      dayEl.style.paddingTop = '16px';
      dayEl.style.paddingBottom = '16px';
    }
    dayEl.dataset.date = date.toISOString();
    dayEl.innerHTML = `<span class="day-name block text-xs">${lbl.name}</span>
      <span class="day-number block text-lg font-semibold">${lbl.number}</span>
      <span class="day-month text-xs mt-0.5 ${lbl.month ? '' : 'hidden'}">${lbl.month}</span>`;
    // Holiday badge – only render for Daily group
    if (group === 'daily' && isHoliday(dateToKey(date))) {
      dayEl.classList.add('holiday');
      if (!dayEl.querySelector('.holiday-icon')) {
        dayEl.insertAdjacentHTML(
          'beforeend',
          '<span class="material-icons holiday-icon">flight</span>'
        );
      }
    }
    let sel = false;
    if (date.toDateString() === appData.currentDate) {
      dayEl.classList.add('current-day');
      sel = true;
    } else if (date.toDateString() === new Date().toDateString()) {
      dayEl.classList.add('today');
    }
    fixTilePadding(dayEl, group, sel);
    container.appendChild(dayEl);
    // advance to next period
    advance(date);
  }
  // Reset scroll position so leading padding works as intended
  container.scrollLeft = 0;
  const firstTile = container.querySelector('.day-item');
  if (firstTile) {
    const contW = container.getBoundingClientRect().width;
    const tileW = firstTile.getBoundingClientRect().width;
    container.style.paddingLeft = `${Math.max(0, contW / 2 - tileW / 2)}px`;
  }
  updateWeekCalendar();
  const currentEl = container.querySelector('.day-item.current-day');
  if (currentEl) setTimeout(() => centerHorizontally(currentEl), 10);
}

function initializeWeekCalendarInteractions() {
  const container = document.querySelector('.week-days');
  if (!container) return;
  container.addEventListener('click', (e) => {
    const dayEl = e.target.closest('.day-item');
    if (!dayEl) return;
    container.querySelectorAll('.day-item').forEach((el) => el.classList.remove('current-day'));
    dayEl.classList.add('current-day');
    const index = Array.from(container.children).indexOf(dayEl);
    if (index !== -1) {
      const currentDate = new Date(appData.currentDate);
      const selectedDate = new Date(currentDate);
      selectedDate.setDate(currentDate.getDate() - 3 + index);
      appData.currentDate = selectedDate.toISOString();
    }
    updateWeekCalendar();
  });
}

export function initializeCalendar() {
  populateCalendar();
  initializeWeekCalendarInteractions();
  // Navigation arrows
  document.querySelectorAll('.nav-arrow').forEach((arrow) => {
    arrow.addEventListener('click', () => {
      let currentDate = new Date(appData.currentDate);
      const grp = appData.selectedGroup || 'daily';
      const isPrev = arrow.classList.contains('prev-week');
      const isNext = arrow.classList.contains('next-week');

      if (isPrev || isNext) {
        const dir = isPrev ? -1 : +1;
        switch (grp) {
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + dir * 28); // 4 weeks
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + dir * 6); // 6 months
            break;
          case 'yearly':
            currentDate.setFullYear(currentDate.getFullYear() + dir * 5); // 5 years
            break;
          case 'daily':
          default:
            currentDate.setDate(currentDate.getDate() + dir * 7); // 1 week
            break;
        }
      } else if (arrow.classList.contains('prev-day') || arrow.classList.contains('next-day')) {
        const dirDay = arrow.classList.contains('prev-day') ? -1 : +1;
        switch (grp) {
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + dirDay * 7);
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + dirDay);
            break;
          case 'yearly':
            currentDate.setFullYear(currentDate.getFullYear() + dirDay);
            break;
          case 'daily':
          default:
            currentDate.setDate(currentDate.getDate() + dirDay);
        }
      }
      // Clamp to earliest anchor
      const anchor = _groupAnchors[grp] ? new Date(_groupAnchors[grp]) : null;
      if (anchor && currentDate < anchor) {
        currentDate = new Date(anchor);
      }
      appData.currentDate = currentDate.toISOString();
      updateWeekCalendar();
    });
  });
}

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

  // Ensure week-days strip exists.
  let weekDays = container.querySelector('.week-days');
  if (!weekDays) {
    weekDays = document.createElement('div');
    weekDays.className = 'week-days';
    container.appendChild(weekDays);
  }

  function getStateDate() {
    return new Date(appData[stateKey]);
  }

  function setStateDate(dateObj) {
    mutate((s) => {
      // For fitness calendar, ensure we always store local dates to avoid timezone issues
      if (stateKey === 'fitnessSelectedDate') {
        // Create ISO string manually without timezone conversion
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const localISOString = `${year}-${month}-${day}T00:00:00.000Z`;
        s[stateKey] = localISOString;
      } else {
        s[stateKey] = dateObj.toISOString();
      }
    });
    if (typeof onDateChange === 'function') onDateChange(dateObj);
  }

  /* -------------------- helpers -------------------- */
  function center(dayEl) {
    centerHorizontally(dayEl);
  }

  function buildDays() {
    weekDays.innerHTML = '';
    const baseDate = getStateDate();
    const group = appData.selectedGroup || 'daily';

    if (!_groupAnchors[group]) {
      _groupAnchors[group] = getPeriodStart(baseDate, group);
    }
    const start = new Date(_groupAnchors[group]);

    // We will render from current period (start) onward – no earlier tiles
    // Determine stepping logic based on group
    let date = new Date(start);
    const end = new Date(start);
    // show 1 year worth of periods after start for smooth scrolling
    if (group === 'yearly') end.setFullYear(end.getFullYear() + 15);
    else if (group === 'monthly') end.setMonth(end.getMonth() + 24);
    else if (group === 'weekly') end.setDate(end.getDate() + 730);
    else end.setDate(end.getDate() + 730);

    const advance = (d) => advanceDate(d, group, +1);

    // If current selection precedes stored anchor, extend anchor backwards once.
    const selStart = getPeriodStart(baseDate, group);
    if (selStart < _groupAnchors[group]) {
      _groupAnchors[group] = new Date(selStart);
      date = new Date(_groupAnchors[group]);
    }

    while (date <= end) {
      const lbl = getCalendarLabels(date);
      const el = document.createElement('div');
      el.className = 'day-item';
      if (group === 'yearly') {
        el.style.paddingTop = '16px';
        el.style.paddingBottom = '16px';
      }

      // For fitness calendar, ensure tile dates are stored as proper local dates
      if (stateKey === 'fitnessSelectedDate') {
        // Create ISO string manually without timezone conversion
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const localISOString = `${year}-${month}-${day}T00:00:00.000Z`;
        el.dataset.date = localISOString;
      } else {
        el.dataset.date = date.toISOString();
      }

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
      advance(date);
    }
    // Reset scroll position so leading padding works as intended
    weekDays.scrollLeft = 0;
    const firstTile = weekDays.querySelector('.day-item');
    if (firstTile) {
      const contW = container.getBoundingClientRect().width;
      const tileW = firstTile.getBoundingClientRect().width;
      weekDays.style.paddingLeft = `${Math.max(0, contW / 2 - tileW / 2)}px`;
    }
  }

  function updateClasses() {
    // Apply a helper class on the calendar wrapper so that CSS can style
    // weekly-group tiles differently (e.g. extra padding for height parity).
    const group = appData.selectedGroup || 'daily';
    container.classList.toggle('weekly-group', group === 'weekly');

    const selDt = getStateDate();
    const todayDate = new Date();
    weekDays.querySelectorAll('.day-item').forEach((el) => {
      const d = new Date(el.dataset.date);
      const isSel = isSamePeriod(d, selDt, group);
      const isToday = isSamePeriod(d, todayDate, group);
      el.classList.toggle('current-day', isSel);
      el.classList.toggle('today', isToday && !isSel);
      // Update numbers/names if month/day may have changed (e.g. locale change)
      const lblUpd = getCalendarLabels(new Date(el.dataset.date));
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
      if (appData.selectedGroup === 'daily' && monthEl) {
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

      if (appData.selectedGroup === 'yearly') {
        const pad = isSel ? 22 : 16;
        el.style.paddingTop = pad + 'px';
        el.style.paddingBottom = pad + 'px';
      }

      fixTilePadding(el, appData.selectedGroup, isSel);
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
  buildDays();
  updateClasses();
  const curEl = weekDays.querySelector('.day-item.current-day');
  if (curEl) setTimeout(() => center(curEl), 10);

  weekDays.addEventListener('click', handleClick);

  // Optional nav arrows inside the container
  container.querySelectorAll('.nav-arrow').forEach((arrow) => {
    arrow.addEventListener('click', () => {
      let cur = getStateDate();
      const grp = appData.selectedGroup || 'daily';
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

  let lastGroupRef = appData.selectedGroup;

  // Expose a minimal API if caller wants to force-refresh later
  return {
    refresh: () => {
      const currentGroup = appData.selectedGroup;
      if (currentGroup !== lastGroupRef) {
        buildDays();
        lastGroupRef = currentGroup;
      }
      updateClasses();
      const selEl = weekDays.querySelector('.day-item.current-day');
      if (selEl) center(selEl);
    },
  };
}

// -------------------- GROUP-AWARE CALENDAR LABELS --------------------
/**
 * Returns label strings for the calendar item based on the currently selected
 * habit group. We re-use the existing three spans (.day-name, .day-number,
 * .day-month) but may hide some of them by returning an empty string.
 */
function getCalendarLabels(date) {
  const group = appData.selectedGroup || 'daily';
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
function getPeriodStart(date, group = appData.selectedGroup || 'daily') {
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
    const pad = isSel ? 8 : 4;
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
