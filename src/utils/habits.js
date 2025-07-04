import {
  BG_COLOR_CLASS_MAP,
  TEXT_COLOR_CLASS_MAP,
  DAY_NAMES_SHORT as DAY_NAMES,
  MONTH_NAMES_SHORT as MONTH_NAMES,
} from './constants.js';
import { capitalize } from './string.js';

// ---------------- Inlined schedule-formatting helpers ----------------

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function joinOrCount(arr = [], label) {
  if (arr.length === 0) return '';
  if (arr.length <= 3) return arr.join(', ');
  return `${arr.length} ${label}`;
}

export function describeMonthly(monthly = {}) {
  if (!monthly) return 'Monthly';

  const every = monthly.interval || 1;
  const base = every > 1 ? `Every ${every} Months` : 'Monthly';

  if (monthly.mode === 'on') {
    const combArr = Array.isArray(monthly.combinations) ? monthly.combinations : [];
    if (combArr.length === 0) return base;

    const formatted = combArr.map((c) => {
      const [ord, day] = c.split('-');
      return `${capitalize(ord)} ${capitalize(day)}`;
    });

    return combineList(formatted, 'dates', base);
  }

  const datesArr = Array.isArray(monthly.dates) ? monthly.dates.map(ordinal) : [];
  return combineList(datesArr, 'dates', base);
}

export function describeYearly({ months = [], yearInterval = 1 } = {}) {
  const base = yearInterval > 1 ? `Every ${yearInterval} Years` : 'Yearly';
  if (!months || months.length === 0) return base;

  const monthsArr = months.map((m) => MONTH_NAMES[m]);
  return combineList(monthsArr, 'months', base);
}

function combineList(items, labelPlural, baseText) {
  if (items.length === 1) return `${items[0]} ${baseText}`.trim();
  if (items.length > 1) return `${items.length} ${labelPlural} ${baseText}`.trim();
  return baseText;
}

// --------------------------------------------------------------------

export function getCSSColorClass(color) {
  return BG_COLOR_CLASS_MAP[color] || 'bg-gray-50 dark:bg-gray-900 dark:bg-opacity-30';
}

export function getTextColorClass(color) {
  return TEXT_COLOR_CLASS_MAP[color] || 'text-gray-600 dark:text-gray-300';
}

export function getFrequencyIcon(habit) {
  // For target-based habits (numeric target), use a bullseye/target icon; else calendar icon
  if (habit && typeof habit.target === 'number' && habit.target > 0) {
    // Material design target (bullseye)
    return `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke-width="2"/>
      <circle cx="12" cy="12" r="6" stroke-width="2"/>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="currentColor" stroke-width="2"/>
    </svg>`;
  }
  // Calendar icon for schedule-based habits
  return `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export function getFrequencyText(habit) {
  const dayNames = DAY_NAMES;
  const monthNames = MONTH_NAMES;

  const cap = capitalize;
  let text = '';
  switch (habit.frequency) {
    case 'daily':
      text = 'Daily';
      break;
    case 'weekly':
    case 'biweekly': {
      const daysArr = Array.isArray(habit.days) ? habit.days.map((d) => dayNames[d]) : [];
      const part = joinOrCount(daysArr, 'days');
      text = part ? `${part} ${cap(habit.frequency)}` : cap(habit.frequency);
      break;
    }
    case 'monthly': {
      text = describeMonthly(habit.monthly);
      break;
    }
    case 'yearly': {
      text = describeYearly({ months: habit.months, yearInterval: habit.yearInterval });
      break;
    }
    default:
      text = habit.frequency;
  }
  if (habit.target) {
    const unit = habit.targetUnit && habit.targetUnit !== 'none' ? habit.targetUnit : '';
    const freq = cap(habit.targetFrequency || habit.frequency);
    text = `${habit.target} ${unit} ${freq}`.replace(/\s+/g, ' ').trim();
  }
  if (habit.scheduledTime) text += ` • ${habit.scheduledTime}`;
  if (habit.paused) text += ' • Paused';
  return text;
}
