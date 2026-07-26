import { Actions, dispatch } from './state.js';

let hydrating = false;

function live(records = []) {
  return records.filter((record) => !record.deletedAt);
}

function upsertRecord(records, record) {
  const index = records.findIndex((item) => item.clientId === record.clientId);
  if (index === -1) return [...records, record];
  return records.map((item, itemIndex) => (itemIndex === index ? record : item));
}

function markDeleted(records, predicate, deletedAt) {
  return records.map((record) =>
    predicate(record) ? { ...record, deletedAt: record.deletedAt || deletedAt } : record
  );
}

export function overlayPendingOperations(cache, operations = []) {
  const overlaid = {
    ...cache,
    habitCategories: [...(cache.habitCategories || [])],
    habits: [...(cache.habits || [])],
    habitEntries: [...(cache.habitEntries || [])],
    holidayPeriods: [...(cache.holidayPeriods || [])],
    holidaySingles: [...(cache.holidaySingles || [])],
    activityCategories: [...(cache.activityCategories || [])],
    activities: [...(cache.activities || [])],
    activityRecords: [...(cache.activityRecords || [])],
    restDays: [...(cache.restDays || [])],
  };

  operations.forEach((operation) => {
    if (operation.generation && cache.profile?.activeGeneration) {
      if (operation.generation !== cache.profile.activeGeneration) return;
    }

    if (operation.entityType === 'userPreferences' && operation.attemptedRecord) {
      overlaid.preferences = { ...overlaid.preferences, ...operation.attemptedRecord };
      return;
    }

    if (operation.entityType === 'habits.order') {
      const order = operation.payload?.orderedClientIds || [];
      const positions = new Map(order.map((clientId, index) => [clientId, index]));
      overlaid.habits = overlaid.habits.map((habit) =>
        positions.has(habit.clientId)
          ? { ...habit, sortOrder: positions.get(habit.clientId) }
          : habit
      );
      return;
    }

    if (operation.entityType === 'habitCategories.order') {
      const order = operation.payload?.orderedClientIds || [];
      const positions = new Map(order.map((clientId, index) => [clientId, index]));
      overlaid.habitCategories = overlaid.habitCategories.map((category) =>
        positions.has(category.clientId)
          ? { ...category, sortOrder: positions.get(category.clientId) }
          : category
      );
      return;
    }

    const collection = overlaid[operation.entityType];
    const attempted = operation.attemptedRecord;
    if (!Array.isArray(collection) || !attempted?.clientId) return;
    overlaid[operation.entityType] = upsertRecord(collection, attempted);

    if (!attempted.deletedAt) return;
    if (operation.entityType === 'habitCategories') {
      const habitIds = new Set(
        overlaid.habits
          .filter((habit) => habit.categoryClientId === attempted.clientId)
          .map((habit) => habit.clientId)
      );
      overlaid.habits = markDeleted(
        overlaid.habits,
        (habit) => habitIds.has(habit.clientId),
        attempted.deletedAt
      );
      overlaid.habitEntries = markDeleted(
        overlaid.habitEntries,
        (entry) => habitIds.has(entry.habitClientId),
        attempted.deletedAt
      );
    }
    if (operation.entityType === 'habits') {
      overlaid.habitEntries = markDeleted(
        overlaid.habitEntries,
        (entry) => entry.habitClientId === attempted.clientId,
        attempted.deletedAt
      );
    }
    if (operation.entityType === 'activities') {
      overlaid.activityRecords = markDeleted(
        overlaid.activityRecords,
        (record) => record.activityClientId === attempted.clientId,
        attempted.deletedAt
      );
    }
  });

  return overlaid;
}

function expandHolidayPeriods(periods) {
  const dates = [];
  periods.forEach((period) => {
    const cursor = new Date(`${period.startISO}T00:00:00Z`);
    const end = new Date(`${period.endISO}T00:00:00Z`);
    while (!Number.isNaN(cursor.valueOf()) && cursor <= end && dates.length < 36600) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  });
  return dates;
}

export function normalizedToCompatibilityState(cache, deviceState = {}) {
  const entriesByHabit = new Map();
  live(cache.habitEntries).forEach((entry) => {
    if (!entriesByHabit.has(entry.habitClientId)) entriesByHabit.set(entry.habitClientId, []);
    entriesByHabit.get(entry.habitClientId).push(entry);
  });
  const habits = live(cache.habits)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((habit) => {
      const entries = entriesByHabit.get(habit.clientId) || [];
      return {
        ...habit,
        id: habit.clientId,
        categoryId: habit.categoryClientId,
        createdAt: habit.createdAtISO,
        completed: Object.fromEntries(
          entries.filter((entry) => entry.completed).map((entry) => [entry.periodKey, true])
        ),
        progress: Object.fromEntries(
          entries.filter((entry) => entry.progress !== 0).map((entry) => [entry.periodKey, entry.progress])
        ),
        skippedDates: entries.filter((entry) => entry.skipped).map((entry) => entry.periodKey),
        entryRevisions: Object.fromEntries(
          entries.map((entry) => [entry.periodKey, entry.revision])
        ),
      };
    });
  const holidayPeriods = live(cache.holidayPeriods).map((period) => ({
    ...period,
    id: period.clientId,
    start: period.startISO,
    end: period.endISO,
  }));
  const holidayDates = [
    ...new Set([
      ...live(cache.holidaySingles).map((single) => single.dateKey),
      ...expandHolidayPeriods(holidayPeriods),
    ]),
  ];
  const manualHolidayDates = live(cache.holidaySingles).map((single) => single.dateKey);
  const holidaySingleRevisions = Object.fromEntries(
    cache.holidaySingles.map((single) => [single.dateKey, single.revision])
  );
  const recordedActivities = {};
  live(cache.activityRecords).forEach((record) => {
    const list = recordedActivities[record.dateKey] || [];
    list.push({
      ...record,
      id: record.clientId,
      activityId: record.activityClientId,
      activityName: record.activityNameSnapshot,
      categoryId: record.categoryClientIdSnapshot,
      date: record.dateKey,
      timestamp: record.timestampISO,
    });
    recordedActivities[record.dateKey] = list;
  });
  return {
    categories: live(cache.habitCategories)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((category) => ({ ...category, id: category.clientId })),
    habits,
    appFirstOpenDate: cache.profile?.appFirstOpenDate,
    settings: {
      darkMode: cache.preferences?.darkMode || false,
      hideCompleted: cache.preferences?.hideCompleted || false,
      hideSkipped: cache.preferences?.hideSkipped || false,
      holidayMode: cache.preferences?.holidayMode || false,
    },
    homeSectionVisibility: cache.preferences?.homeSectionVisibility,
    holidayPeriods,
    holidayDates,
    manualHolidayDates,
    holidaySingleRevisions,
    activityCategories: live(cache.activityCategories)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((category) => ({ ...category, id: category.clientId })),
    activities: live(cache.activities).map((activity) => ({
      ...activity,
      id: activity.clientId,
      categoryId: activity.categoryClientId,
      createdAt: activity.createdAtISO,
    })),
    recordedActivities,
    restDays: Object.fromEntries(
      live(cache.restDays).map((restDay) => [restDay.dateKey, true])
    ),
    restDayRevisions: Object.fromEntries(
      cache.restDays.map((restDay) => [restDay.dateKey, restDay.revision])
    ),
    foodLog: cache.legacyData?.foodLog || [],
    stats: cache.legacyData?.stats || {},
    ...deviceState,
  };
}

export function hydrateCompatibilityState(cache, deviceState) {
  if (hydrating) return;
  hydrating = true;
  try {
    dispatch(Actions.hydrateCache(normalizedToCompatibilityState(cache, deviceState)));
  } finally {
    hydrating = false;
  }
}

export function isHydratingCompatibilityState() {
  return hydrating;
}
