// (no external imports required)
// Frequency Section module extracted from form.js
// Handles weekly, bi-weekly, monthly and yearly scheduling controls in the Habit form modal.
// Public API:
//   initFrequencySection()   – wire up DOM listeners (call once when form modal is first rendered)
//   selectedWeeklyDays … selectedYearlyDates – Sets storing current selections
//   monthlyMode            – current monthly mode ("each" | "on")
//   setMonthlyMode()       – switch monthly mode programmatically
//   handleFrequencyChange() – syncs visibility of frequency-specific sub-sections
//   updateCombinationsList() – re-renders the list of monthly weekday/ordinal combinations

import {
  ORDINALS,
  DAYS_OF_WEEK,
  FREQUENCIES,
  MONTH_NAMES_SHORT as MONTHS,
} from '../../utils/constants.js';
import { capitalize } from '../../utils/string.js';

/* ----- Selection state (exported) ----- */
export const selectedWeeklyDays = new Set(); // indices 0-6
export const selectedBiweeklyDays = new Set();
export const selectedMonthlyDates = new Set();
export const selectedCombinations = new Set();
export const selectedMonths = new Set(); // 0-11
export const selectedYearlyDates = new Set();

/* ----- Monthly helpers ----- */
export let monthlyMode = 'each'; // or 'on'

export function setMonthlyMode(mode) {
  monthlyMode = mode;
  handleFrequencyChange();
  // Toggle button font weight
  document.getElementById('monthly-each-btn')?.classList.toggle('font-semibold', mode === 'each');
  document.getElementById('monthly-on-btn')?.classList.toggle('font-semibold', mode === 'on');
  // Toggle sub-sections
  document.getElementById('monthly-dates-section')?.classList.toggle('hidden', mode !== 'each');
  document
    .getElementById('monthly-combinations-section')
    ?.classList.toggle('hidden', mode !== 'on');
}

/* ----- Internal helpers ----- */
function syncDayButtonsWithSet(set) {
  document.querySelectorAll('.day-button').forEach((btn) => {
    const idx = parseInt(btn.dataset.day, 10);
    if (set.has(idx)) btn.classList.add('selected');
    else btn.classList.remove('selected');
  });
}

export function handleFrequencyChange() {
  const freq = document.getElementById('frequency-select')?.value;
  const daysSel = document.getElementById('days-selection');
  const monthlyDetails = document.getElementById('monthly-details');
  const yearlyDetails = document.getElementById('yearly-details');

  if (daysSel) daysSel.classList.toggle('hidden', !(freq === 'weekly' || freq === 'biweekly'));
  if (monthlyDetails) monthlyDetails.classList.toggle('hidden', freq !== 'monthly');
  if (yearlyDetails) yearlyDetails.classList.toggle('hidden', freq !== 'yearly');

  if (freq === 'weekly') {
    syncDayButtonsWithSet(selectedWeeklyDays);
  } else if (freq === 'biweekly') {
    syncDayButtonsWithSet(selectedBiweeklyDays);
  }

  // Update counters for active section so displayed numbers are accurate
  if (freq === 'monthly') {
    updateMonthlyDatesCount();
  }
  if (freq === 'yearly') {
    updateMonthsCount();
    updateYearlyDatesCount();
  }
}

function handleDayButtonClick(e) {
  const btn = e.target.closest('.day-button');
  if (!btn) return;
  const dayIndex = parseInt(btn.dataset.day, 10);
  const freq = document.getElementById('frequency-select')?.value;
  if (isNaN(dayIndex) || !(freq === 'weekly' || freq === 'biweekly')) return;

  const set = freq === 'weekly' ? selectedWeeklyDays : selectedBiweeklyDays;
  if (btn.classList.toggle('selected')) set.add(dayIndex);
  else set.delete(dayIndex);
}

function selectAllDays(select) {
  const freq = document.getElementById('frequency-select')?.value;
  if (!(freq === 'weekly' || freq === 'biweekly')) return;
  const set = freq === 'weekly' ? selectedWeeklyDays : selectedBiweeklyDays;
  set.clear();
  document.querySelectorAll('.day-button').forEach((btn) => {
    if (select) {
      btn.classList.add('selected');
      set.add(parseInt(btn.dataset.day, 10));
    } else {
      btn.classList.remove('selected');
    }
  });
}

function handleMonthlyDateClick(e) {
  if (!e.target.classList.contains('date-button')) return;
  const date = parseInt(e.target.dataset.date, 10);
  e.target.classList.toggle('selected');
  if (e.target.classList.contains('selected')) selectedMonthlyDates.add(date);
  else selectedMonthlyDates.delete(date);

  updateMonthlyDatesCount();
}

function toggleAllMonthlyDates(select) {
  selectedMonthlyDates.clear();
  document.querySelectorAll('.date-button').forEach((btn) => {
    if (select) {
      btn.classList.add('selected');
      selectedMonthlyDates.add(parseInt(btn.dataset.date, 10));
    } else {
      btn.classList.remove('selected');
    }
  });

  updateMonthlyDatesCount();
}

function handleMonthButtonClick(e) {
  if (!e.target.classList.contains('month-button')) return;
  const month = parseInt(e.target.dataset.month, 10);
  e.target.classList.toggle('selected');
  if (e.target.classList.contains('selected')) selectedMonths.add(month);
  else selectedMonths.delete(month);

  updateMonthsCount();
}

function handleYearlyDateClick(e) {
  if (!e.target.classList.contains('yearly-date-button')) return;
  const date = parseInt(e.target.dataset.date, 10);
  e.target.classList.toggle('selected');
  if (e.target.classList.contains('selected')) selectedYearlyDates.add(date);
  else selectedYearlyDates.delete(date);

  updateYearlyDatesCount();
}

function toggleAllMonths(select) {
  selectedMonths.clear();
  document.querySelectorAll('.month-button').forEach((btn) => {
    if (select) {
      btn.classList.add('selected');
      selectedMonths.add(parseInt(btn.dataset.month, 10));
    } else {
      btn.classList.remove('selected');
    }
  });

  updateMonthsCount();
}

function toggleAllYearlyDates(select) {
  selectedYearlyDates.clear();
  document.querySelectorAll('.yearly-date-button').forEach((btn) => {
    if (select) {
      btn.classList.add('selected');
      selectedYearlyDates.add(parseInt(btn.dataset.date, 10));
    } else {
      btn.classList.remove('selected');
    }
  });

  updateYearlyDatesCount();
}

function addMonthlyCombination() {
  const ordinal = document.getElementById('ordinal-select')?.value;
  const dayOfWeek = document.getElementById('day-of-week-select')?.value;
  if (!ordinal || !dayOfWeek) return;
  const combo = `${ordinal}-${dayOfWeek}`;
  if (!selectedCombinations.has(combo)) {
    selectedCombinations.add(combo);
    updateCombinationsList();
  }
}

export function updateCombinationsList() {
  const container = document.getElementById('combinations-list');
  if (!container) return;
  container.innerHTML = '';
  if (selectedCombinations.size === 0) {
    const span = document.createElement('span');
    span.textContent = 'No combinations added yet';
    span.className = 'text-gray-500 text-sm';
    container.appendChild(span);
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'space-y-2';
  selectedCombinations.forEach((comb) => {
    const [ord, day] = comb.split('-');
    const row = document.createElement('div');
    row.className =
      'flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 w-full';
    const text = document.createElement('span');
    text.className = 'text-gray-900 dark:text-white text-sm font-semibold';
    text.textContent = `${capitalize(ord)} ${capitalize(day)}`;
    const delBtn = document.createElement('button');
    delBtn.className =
      'w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 ml-3';
    delBtn.innerHTML = '×';
    delBtn.onclick = () => {
      selectedCombinations.delete(comb);
      updateCombinationsList();
    };
    row.appendChild(text);
    row.appendChild(delBtn);
    wrap.appendChild(row);
  });
  container.appendChild(wrap);
}

/* ----- UI counter helpers ----- */
function updateMonthsCount() {
  const el = document.getElementById('selected-months-count');
  if (el) el.textContent = selectedMonths.size;
}

function updateMonthlyDatesCount() {
  const el = document.getElementById('selected-dates-count');
  if (el) el.textContent = selectedMonthlyDates.size;
}

function updateYearlyDatesCount() {
  const el = document.getElementById('selected-yearly-dates-count');
  if (el) el.textContent = selectedYearlyDates.size;
}

/* ----- Public initializer ----- */
export function initFrequencySection() {
  buildMonthlyDateGrid();
  buildMonthGrid();
  buildYearlyDateGrid();
  buildDayButtonsGrid();
  buildFrequencySelect();
  buildIntervalOptions('month-interval-select', 12);
  buildIntervalOptions('year-interval-select', 5);
  buildCombinationSelectors();
  updatePluralText('month-interval-select', 'month-text', 'month', 'months');
  updatePluralText('year-interval-select', 'year-text', 'year', 'years');
  // Wiring global listeners
  document.getElementById('frequency-select')?.addEventListener('change', handleFrequencyChange);

  // Weekly / Bi-weekly day buttons
  document.addEventListener('click', handleDayButtonClick);
  document.getElementById('select-all-days')?.addEventListener('click', () => selectAllDays(true));
  document.getElementById('clear-all-days')?.addEventListener('click', () => selectAllDays(false));

  // Monthly controls
  document
    .getElementById('monthly-each-btn')
    ?.addEventListener('click', () => setMonthlyMode('each'));
  document.getElementById('monthly-on-btn')?.addEventListener('click', () => setMonthlyMode('on'));

  document.addEventListener('click', handleMonthlyDateClick);
  document
    .getElementById('select-all-dates')
    ?.addEventListener('click', () => toggleAllMonthlyDates(true));
  document
    .getElementById('clear-dates')
    ?.addEventListener('click', () => toggleAllMonthlyDates(false));

  document.getElementById('add-combination-btn')?.addEventListener('click', addMonthlyCombination);
  document.getElementById('clear-all-combinations')?.addEventListener('click', () => {
    selectedCombinations.clear();
    updateCombinationsList();
  });

  // Yearly controls
  document.addEventListener('click', handleMonthButtonClick);
  document.addEventListener('click', handleYearlyDateClick);
  document
    .getElementById('select-all-months')
    ?.addEventListener('click', () => toggleAllMonths(true));
  document.getElementById('clear-months')?.addEventListener('click', () => toggleAllMonths(false));
  document
    .getElementById('select-all-yearly-dates')
    ?.addEventListener('click', () => toggleAllYearlyDates(true));
  document
    .getElementById('clear-yearly-dates')
    ?.addEventListener('click', () => toggleAllYearlyDates(false));
  document
    .getElementById('yearly-specify-dates-toggle')
    ?.addEventListener('change', handleYearlySpecifyDatesToggle);

  // Initial state sync
  handleFrequencyChange();
  handleYearlySpecifyDatesToggle();
  updateCombinationsList();

  // Initialise counters in case form opens with pre-selected values (edit mode)
  updateMonthsCount();
  updateMonthlyDatesCount();
  updateYearlyDatesCount();

  document
    .getElementById('month-interval-select')
    ?.addEventListener('change', () =>
      updatePluralText('month-interval-select', 'month-text', 'month', 'months')
    );
  document
    .getElementById('year-interval-select')
    ?.addEventListener('change', () =>
      updatePluralText('year-interval-select', 'year-text', 'year', 'years')
    );
}

/* ----- Dynamic grid builders ----- */
function buildMonthlyDateGrid() {
  const container = document.getElementById('monthly-date-grid');
  if (!container || container.childElementCount) return;
  const frag = document.createDocumentFragment();
  for (let d = 1; d <= 31; d++) {
    const btn = document.createElement('button');
    btn.className =
      'date-button w-full aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-medium text-sm hover:border-ios-blue hover:bg-ios-blue/5 transition-all';
    btn.dataset.date = d;
    btn.textContent = d;
    frag.appendChild(btn);
  }
  container.appendChild(frag);
}

function buildMonthGrid() {
  const container = document.getElementById('yearly-month-grid');
  if (!container || container.childElementCount) return;
  const months = MONTHS;
  const frag = document.createDocumentFragment();
  months.forEach((label, idx) => {
    const btn = document.createElement('button');
    btn.className =
      'month-button w-full py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-medium text-sm hover:border-ios-blue hover:bg-ios-blue/10 transition-colors selected:border-[#007AFF] selected:bg-[#007AFF] selected:text-white';
    btn.dataset.month = idx;
    btn.textContent = label;
    frag.appendChild(btn);
  });
  container.appendChild(frag);
}

function buildYearlyDateGrid() {
  const container = document.getElementById('yearly-date-grid');
  if (!container || container.childElementCount) return;
  const frag = document.createDocumentFragment();
  for (let d = 1; d <= 31; d++) {
    const btn = document.createElement('button');
    btn.className =
      'yearly-date-button w-full aspect-square rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-medium text-sm hover:border-ios-blue hover:bg-ios-blue/10 transition-colors selected:border-[#007AFF] selected:bg-[#007AFF] selected:text-white';
    btn.dataset.date = d;
    btn.textContent = d;
    frag.appendChild(btn);
  }
  container.appendChild(frag);
}

function buildDayButtonsGrid() {
  const container = document.getElementById('weekly-day-grid');
  if (!container || container.childElementCount) return;
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const frag = document.createDocumentFragment();
  labels.forEach((label, idx) => {
    const btn = document.createElement('button');
    btn.className =
      'day-button flex-1 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium text-sm hover:border-ios-blue transition-colors selected:border-[#007AFF] selected:bg-[#007AFF] selected:text-white';
    btn.dataset.day = idx;
    btn.textContent = label;
    frag.appendChild(btn);
  });
  container.appendChild(frag);
}

export { buildMonthlyDateGrid, buildMonthGrid, buildYearlyDateGrid };

function handleYearlySpecifyDatesToggle() {
  const checked = document.getElementById('yearly-specify-dates-toggle')?.checked ?? false;
  document.getElementById('yearly-dates-section')?.classList.toggle('hidden', !checked);
  if (!checked) {
    // Clear selections
    selectedYearlyDates.clear();
    document
      .querySelectorAll('.yearly-date-button.selected')
      .forEach((btn) => btn.classList.remove('selected'));
    updateYearlyDatesCount();
  }
}

/* ----- Interval option builders ----- */
function buildIntervalOptions(selectId, max) {
  const select = document.getElementById(selectId);
  if (!select || select.dataset.enhanced) return;
  for (let i = 1; i <= max; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    select.appendChild(opt);
  }
  select.dataset.enhanced = '1';
}

function updatePluralText(selectId, spanId, singular, plural) {
  const val = parseInt(document.getElementById(selectId)?.value || '1', 10);
  const span = document.getElementById(spanId);
  if (span) span.textContent = val === 1 ? singular : plural;
}

function buildCombinationSelectors() {
  const ordinalSel = document.getElementById('ordinal-select');
  const daySel = document.getElementById('day-of-week-select');
  if (ordinalSel && !ordinalSel.dataset.enhanced) {
    ordinalSel.innerHTML = '';
    ORDINALS.forEach((ord) => {
      const opt = document.createElement('option');
      opt.value = ord;
      opt.textContent = capitalize(ord);
      ordinalSel.appendChild(opt);
    });
    ordinalSel.dataset.enhanced = '1';
  }
  if (daySel && !daySel.dataset.enhanced) {
    daySel.innerHTML = '';
    DAYS_OF_WEEK.forEach((day) => {
      const opt = document.createElement('option');
      opt.value = day;
      opt.textContent = capitalize(day);
      daySel.appendChild(opt);
    });
    daySel.dataset.enhanced = '1';
  }
}

function buildFrequencySelect() {
  const select = document.getElementById('frequency-select');
  if (!select || select.dataset.enhanced) return;
  select.innerHTML = '';
  FREQUENCIES.forEach((freq) => {
    const opt = document.createElement('option');
    opt.value = freq;
    opt.textContent = capitalize(freq);
    select.appendChild(opt);
  });
  select.dataset.enhanced = '1';
}
