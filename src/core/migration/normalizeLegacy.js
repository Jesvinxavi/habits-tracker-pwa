import { checksum } from './canonical.js';
import { isRecognizedPeriodKey, periodSortDate } from './periodKeys.js';

export const LEGACY_SCHEMA_VERSION = 0;

const DEVICE_FIELDS = new Set([
  'currentDate',
  'selectedDate',
  'fitnessSelectedDate',
  'selectedGroup',
  'activeTab',
  'modalState',
  'searchState',
  'timer',
  'laps',
]);

const KNOWN_FIELDS = new Set([
  ...DEVICE_FIELDS,
  'categories',
  'habits',
  'appFirstOpenDate',
  'holidayDates',
  'holidayPeriods',
  'settings',
  'activities',
  'activityCategories',
  'recordedActivities',
  'restDays',
  'foodLog',
  'stats',
]);

const DEFAULT_ACTIVITY_CATEGORIES = [
  ['cardio', 'Cardio', '#EF4444', '🏃‍♂️'],
  ['strength', 'Strength Training', '#2563EB', '💪'],
  ['stretching', 'Stretching', '#22C55E', '🧘‍♀️'],
  ['sports', 'Sports', '#F97316', '⚽'],
  ['other', 'Other', '#EAB308', '🎯'],
];

function dateOnly(value, fallback = '1970-01-01') {
  const candidate = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : fallback;
}

function finiteNumber(value, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function expandPeriod(startISO, endISO) {
  const dates = [];
  const cursor = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);
  while (!Number.isNaN(cursor.valueOf()) && cursor <= end && dates.length < 36600) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function shared(clientId) {
  return { clientId: String(clientId), revision: 1 };
}

function normalizeHabit(habit, sortOrder, warnings) {
  const clientId = String(habit.id || habit.clientId || `legacy-habit-${sortOrder}`);
  const createdAtISO = dateOnly(habit.createdAtISO || habit.createdAt);
  const definition = {
    ...shared(clientId),
    categoryClientId: String(habit.categoryClientId || habit.categoryId || ''),
    name: String(habit.name || '').trim(),
    frequency: habit.frequency || 'daily',
    createdAtISO,
    anchorDateISO: habit.anchorDateISO || habit.anchorDate,
    scheduledTime: habit.scheduledTime ?? null,
    days: Array.isArray(habit.days) ? habit.days.map(Number) : undefined,
    monthly: habit.monthly,
    months: Array.isArray(habit.months) ? habit.months.map(Number) : undefined,
    yearInterval: habit.yearInterval ? Number(habit.yearInterval) : undefined,
    paused: Boolean(habit.paused),
    activeOnHolidays: Boolean(habit.activeOnHolidays),
    icon: String(habit.icon || ''),
    target: habit.target == null ? undefined : finiteNumber(habit.target),
    targetFrequency: habit.targetFrequency,
    targetUnit: habit.targetUnit,
    defaultIncrement:
      habit.defaultIncrement == null ? undefined : finiteNumber(habit.defaultIncrement),
    sortOrder,
  };

  const entries = new Map();
  function entryFor(key) {
    const periodKey = String(key);
    const clientEntryId = `habit-entry:${clientId}:${periodKey}`;
    if (!entries.has(clientEntryId)) {
      entries.set(clientEntryId, {
        ...shared(clientEntryId),
        habitClientId: clientId,
        periodKey,
        periodSortDate: periodSortDate(periodKey, createdAtISO),
        completed: false,
        progress: 0,
        skipped: false,
      });
      if (!isRecognizedPeriodKey(periodKey)) {
        warnings.push({
          code: 'unparseable_period_key',
          entityId: clientId,
          periodKey,
          fallbackDate: createdAtISO,
        });
      }
    }
    return entries.get(clientEntryId);
  }

  if (habit.completed === true) {
    warnings.push({ code: 'boolean_completion_requires_review', entityId: clientId });
  } else if (habit.completed && typeof habit.completed === 'object') {
    Object.entries(habit.completed).forEach(([key, completed]) => {
      if (completed === true) entryFor(key).completed = true;
    });
  }
  if (habit.progress && typeof habit.progress === 'object') {
    Object.entries(habit.progress).forEach(([key, progress]) => {
      const parsed = finiteNumber(progress);
      if (parsed !== 0) entryFor(key).progress = parsed;
    });
  }
  (Array.isArray(habit.skippedDates) ? habit.skippedDates : []).forEach((key) => {
    entryFor(key).skipped = true;
  });
  return { definition, entries: [...entries.values()] };
}

export function meaningfulLegacySnapshot(snapshot) {
  return Object.fromEntries(
    Object.entries(snapshot || {}).filter(([key]) => !DEVICE_FIELDS.has(key))
  );
}

export function normalizeLegacySnapshot(snapshot = {}, sideKeys = {}, options = {}) {
  const warnings = [];
  const habits = [];
  const habitEntries = [];
  (Array.isArray(snapshot.habits) ? snapshot.habits : []).forEach((habit, index) => {
    const normalized = normalizeHabit(habit, index, warnings);
    habits.push(normalized.definition);
    habitEntries.push(...normalized.entries);
  });

  const holidayPeriods = (Array.isArray(snapshot.holidayPeriods) ? snapshot.holidayPeriods : [])
    .map((period, index) => ({
      ...shared(period.id || period.clientId || `legacy-period-${index}`),
      startISO: dateOnly(period.startISO || period.start),
      endISO: dateOnly(period.endISO || period.end),
      label: String(period.label || period.name || ''),
    }))
    .filter((period) => period.startISO <= period.endISO);
  const periodDates = new Set(
    holidayPeriods.flatMap((period) => expandPeriod(period.startISO, period.endISO))
  );
  const retainCovered = new Set(options.retainCoveredHolidayDates || []);
  const holidaySingles = [...new Set(Array.isArray(snapshot.holidayDates) ? snapshot.holidayDates : [])]
    .filter((date) => !periodDates.has(date) || retainCovered.has(date))
    .map((date) => ({
      ...shared(`holiday-single:${date}`),
      dateKey: dateOnly(date),
    }));
  const ambiguousHolidayDates = [...new Set(snapshot.holidayDates || [])].filter((date) =>
    periodDates.has(date)
  );
  if (ambiguousHolidayDates.length) {
    warnings.push({ code: 'covered_holiday_dates_ambiguous', dates: ambiguousHolidayDates });
  }

  const legacyRestDays = Array.isArray(sideKeys.fitnessRestDays)
    ? sideKeys.fitnessRestDays
    : [];
  const stateRestDays = Array.isArray(snapshot.restDays)
    ? snapshot.restDays
    : Object.entries(snapshot.restDays || {})
        .filter(([, enabled]) => enabled)
        .map(([date]) => date);
  const restDays = [...new Set([...stateRestDays, ...legacyRestDays])].map((date) => ({
    ...shared(`rest-day:${date}`),
    dateKey: dateOnly(date),
  }));

  const categories = Array.isArray(snapshot.activityCategories)
    ? snapshot.activityCategories
    : [];
  const activityCategorySource = categories.length
    ? categories
    : DEFAULT_ACTIVITY_CATEGORIES.map(([id, name, color, icon]) => ({ id, name, color, icon }));
  const activityCategories = activityCategorySource.map((category, index) => ({
    ...shared(category.id || category.clientId),
    name: String(category.name || ''),
    color: String(category.color || '#64748B'),
    icon: String(category.icon || ''),
    sortOrder: index,
    isSystemDefault: DEFAULT_ACTIVITY_CATEGORIES.some(([id]) => id === category.id),
  }));
  const activities = (snapshot.activities || []).map((activity) => ({
    ...shared(activity.id || activity.clientId),
    name: String(activity.name || ''),
    categoryClientId: String(activity.categoryId || activity.categoryClientId || ''),
    icon: String(activity.icon || ''),
    createdAtISO: dateOnly(activity.createdAtISO || activity.createdAt),
    trackingType: activity.trackingType === 'sets-reps' ? 'sets-reps' : 'time',
    units: activity.units,
    muscleGroup: activity.muscleGroup,
  }));
  const activityRecords = Object.entries(snapshot.recordedActivities || {}).flatMap(
    ([date, records]) =>
      (Array.isArray(records) ? records : []).map((record, index) => ({
        ...shared(record.id || `activity-record:${date}:${index}`),
        activityClientId: String(record.activityId || record.activityClientId || ''),
        activityNameSnapshot: String(record.activityName || ''),
        categoryClientIdSnapshot: String(record.categoryId || ''),
        dateKey: dateOnly(record.date || date),
        timestampISO: String(record.timestampISO || record.timestamp || `${date}T00:00:00.000Z`),
        duration: record.duration == null ? undefined : finiteNumber(record.duration),
        durationUnit: record.durationUnit,
        intensity: record.intensity,
        notes: String(record.notes || ''),
        sets: Array.isArray(record.sets)
          ? record.sets.map((set) => ({
              reps: finiteNumber(set.reps),
              value: set.value == null ? undefined : finiteNumber(set.value),
              unit: String(set.unit || ''),
            }))
          : undefined,
      }))
  );

  const darkMode =
    sideKeys.theme === 'dark'
      ? true
      : sideKeys.theme === 'light'
        ? false
        : Boolean(snapshot.settings?.darkMode);
  const sideVisibility =
    sideKeys.homeSectionVisibility && typeof sideKeys.homeSectionVisibility === 'object'
      ? sideKeys.homeSectionVisibility
      : {};
  const preferences = {
    darkMode,
    hideCompleted: Boolean(snapshot.settings?.hideCompleted),
    hideSkipped: Boolean(snapshot.settings?.hideSkipped),
    holidayMode: Boolean(snapshot.settings?.holidayMode),
    homeSectionVisibility: {
      Completed: sideVisibility.Completed ?? true,
      Skipped: sideVisibility.Skipped ?? true,
    },
    revision: 1,
  };

  const tables = {
    userPreferences: [preferences],
    habitCategories: (snapshot.categories || []).map((category, index) => ({
      ...shared(category.id || category.clientId),
      name: String(category.name || ''),
      color: String(category.color || ''),
      sortOrder: index,
    })),
    habits,
    habitEntries,
    holidayPeriods,
    holidaySingles,
    activityCategories,
    activities,
    activityRecords,
    restDays,
    legacyData: [
      {
        foodLog: snapshot.foodLog ?? [],
        stats: snapshot.stats ?? {},
        unknownTopLevelFields: Object.fromEntries(
          Object.entries(snapshot).filter(([key]) => !KNOWN_FIELDS.has(key))
        ),
        sourceSchemaVersion: LEGACY_SCHEMA_VERSION,
      },
    ],
  };
  const counts = Object.fromEntries(
    Object.entries(tables).map(([table, records]) => [table, records.length])
  );
  const checksums = Object.fromEntries(
    Object.entries(tables).map(([table, records]) => [
      table,
      checksum(
        [...records].sort((left, right) =>
          String(left.clientId || '').localeCompare(String(right.clientId || ''))
        )
      ),
    ])
  );
  return {
    sourceSchemaVersion: LEGACY_SCHEMA_VERSION,
    appFirstOpenDate: dateOnly(snapshot.appFirstOpenDate, new Date().toISOString().slice(0, 10)),
    tables,
    counts,
    checksums,
    warnings,
    ambiguousHolidayDates,
  };
}
