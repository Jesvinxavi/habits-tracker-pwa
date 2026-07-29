import { normalizeHexColor } from './sanitize.js';

const ACTIVITY_UNITS = new Set(['none', 'kg', 'seconds', 'minutes']);
const DURATION_UNITS = new Set(['seconds', 'minutes', 'hours']);
const INTENSITIES = new Set(['light', 'moderate', 'vigorous']);
const TRACKING_TYPES = new Set(['time', 'sets-reps']);
const DIRECTIONS = new Set(['higher', 'lower']);

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function allowed(value, values, fallback) {
  return values.has(value) ? value : fallback;
}

function finiteInRange(value, minimum, maximum, { integer = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) return null;
  return integer ? Math.trunc(number) : number;
}

/**
 * Keeps icons as a short plain-text token. Markup-shaped, empty and oversized
 * imported values use a harmless fallback; rendering still escapes the result.
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
export function normalizeFitnessIcon(value, fallback = '🎯') {
  const candidate = String(value ?? '').trim();
  if (!candidate || candidate.length > 32 || /[<>]/.test(candidate)) return fallback;
  return candidate;
}

export function normalizeActivityCategory(category) {
  if (!category || typeof category !== 'object') return category;
  const normalized = { ...category };
  if (hasOwn(category, 'color')) normalized.color = normalizeHexColor(category.color);
  if (hasOwn(category, 'icon')) normalized.icon = normalizeFitnessIcon(category.icon);
  return normalized;
}

export function normalizeActivityPresentation(activity) {
  if (!activity || typeof activity !== 'object') return activity;
  const normalized = { ...activity };
  if (hasOwn(activity, 'icon')) normalized.icon = normalizeFitnessIcon(activity.icon);
  if (hasOwn(activity, 'trackingType')) {
    normalized.trackingType = allowed(activity.trackingType, TRACKING_TYPES, 'time');
  }
  if (hasOwn(activity, 'units')) {
    normalized.units = allowed(activity.units, ACTIVITY_UNITS, 'none');
  }
  if (hasOwn(activity, 'betterDirection')) {
    normalized.betterDirection = allowed(activity.betterDirection, DIRECTIONS, 'higher');
  }
  return normalized;
}

export function normalizeRecordedActivity(record) {
  if (!record || typeof record !== 'object') return record;
  const normalized = { ...record };
  if (hasOwn(record, 'duration')) {
    normalized.duration =
      record.duration == null ? null : finiteInRange(record.duration, 0.01, 999);
  }
  if (hasOwn(record, 'durationUnit')) {
    normalized.durationUnit =
      record.durationUnit == null
        ? null
        : allowed(record.durationUnit, DURATION_UNITS, 'minutes');
  }
  if (hasOwn(record, 'intensity')) {
    normalized.intensity =
      record.intensity == null ? null : allowed(record.intensity, INTENSITIES, null);
  }
  if (hasOwn(record, 'sets')) {
    normalized.sets = Array.isArray(record.sets)
      ? record.sets
          .map((set) => {
            const reps = finiteInRange(set?.reps, 1, 999, { integer: true });
            if (reps == null) return null;
            const normalizedSet = {
              ...set,
              reps,
              unit: allowed(set?.unit, ACTIVITY_UNITS, 'none'),
            };
            if (hasOwn(set || {}, 'value')) {
              normalizedSet.value =
                set.value == null ? null : finiteInRange(set.value, 0.01, 999999);
            }
            return normalizedSet;
          })
          .filter(Boolean)
      : null;
  }
  return normalized;
}

/**
 * Applies safe presentation fallbacks at import/hydration ownership boundaries
 * without dropping unrelated legacy fields.
 * @param {object} payload
 * @returns {object}
 */
export function normalizeFitnessPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const normalized = { ...payload };
  if (Array.isArray(payload.activityCategories)) {
    normalized.activityCategories = payload.activityCategories.map(normalizeActivityCategory);
  }
  if (Array.isArray(payload.activities)) {
    normalized.activities = payload.activities.map(normalizeActivityPresentation);
  }
  if (payload.recordedActivities && typeof payload.recordedActivities === 'object') {
    normalized.recordedActivities = Object.fromEntries(
      Object.entries(payload.recordedActivities).map(([date, records]) => [
        date,
        Array.isArray(records) ? records.map(normalizeRecordedActivity) : [],
      ])
    );
  }
  return normalized;
}
