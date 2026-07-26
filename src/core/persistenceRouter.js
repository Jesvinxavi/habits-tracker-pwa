import { ActionTypes } from './state.js';
import { commitOptimisticOperation } from './offlineDb.js';
import { getCloudRuntime } from './cloudRuntime.js';
import { periodSortDate } from './migration/periodKeys.js';
import {
  sanitizeActivityDefinition,
  sanitizeActivityRecord,
} from './operationPayload.js';
import { generateUuid } from '../shared/common.js';

const PERSISTENT_ACTIONS = new Set([
  ActionTypes.ADD_HABIT,
  ActionTypes.UPDATE_HABIT,
  ActionTypes.DELETE_HABIT,
  ActionTypes.TOGGLE_HABIT_COMPLETED,
  ActionTypes.SET_HABIT_PROGRESS,
  ActionTypes.SKIP_HABIT,
  ActionTypes.REORDER_HABITS,
  ActionTypes.REORDER_CATEGORIES,
  ActionTypes.ADD_CATEGORY,
  ActionTypes.UPDATE_CATEGORY,
  ActionTypes.DELETE_CATEGORY,
  ActionTypes.ADD_HOLIDAY_PERIOD,
  ActionTypes.DELETE_HOLIDAY_PERIOD,
  ActionTypes.DELETE_ALL_HOLIDAY_PERIODS,
  ActionTypes.TOGGLE_SINGLE_HOLIDAY,
  ActionTypes.UPDATE_HOLIDAY_PERIOD,
  ActionTypes.ADD_ACTIVITY,
  ActionTypes.UPDATE_ACTIVITY,
  ActionTypes.DELETE_ACTIVITY,
  ActionTypes.RECORD_ACTIVITY,
  ActionTypes.DELETE_RECORDED_ACTIVITY,
  ActionTypes.UPDATE_RECORDED_ACTIVITY,
  ActionTypes.UPDATE_ACTIVITY_CATEGORY_COLOR,
  ActionTypes.SET_REST_DAY,
  ActionTypes.UPDATE_SETTINGS,
  ActionTypes.SET_DARK_MODE,
  ActionTypes.TOGGLE_DARK_MODE,
  ActionTypes.TOGGLE_COMPLETED,
  ActionTypes.TOGGLE_SKIPPED,
  ActionTypes.UPDATE_HOME_SECTION_VISIBILITY,
]);

export function isPersistentAction(action) {
  return PERSISTENT_ACTIONS.has(action?.type);
}

function sharedOperation(runtime, entityType, clientId, mutationName, payload, baseRecord, optimistic) {
  return {
    operation: {
      operationId: generateUuid(),
      ownerKey: runtime.ownerKey,
      generation: runtime.generation,
      entityType,
      clientId,
      mutationName,
      payload,
      deviceId: runtime.deviceId,
    },
    confirmedBase: baseRecord || null,
    optimisticEntity: optimistic || null,
  };
}

function categoryRecord(category, sortOrder) {
  return {
    clientId: category.id || category.clientId,
    name: category.name,
    color: category.color || '',
    sortOrder,
    revision: category.revision || 0,
  };
}

export function habitRecord(habit, sortOrder) {
  const record = {
    clientId: habit.id || habit.clientId,
    categoryClientId: habit.categoryId || habit.categoryClientId,
    name: habit.name,
    frequency: habit.frequency,
    createdAtISO: String(habit.createdAt || habit.createdAtISO || '').slice(0, 10),
    paused: Boolean(habit.paused),
    activeOnHolidays: Boolean(habit.activeOnHolidays),
    icon: habit.icon || '',
    sortOrder,
    revision: habit.revision || 0,
  };
  const optionalFields = [
    'anchorDateISO',
    'scheduledTime',
    'days',
    'months',
    'yearInterval',
    'target',
    'targetFrequency',
    'targetUnit',
    'defaultIncrement',
  ];
  optionalFields.forEach((field) => {
    if (habit[field] !== undefined && habit[field] !== null) {
      record[field] = habit[field];
    }
  });
  if (habit.scheduledTime === null) record.scheduledTime = null;
  if (habit.monthly != null) {
    record.monthly = {
      interval: habit.monthly.interval,
      mode: habit.monthly.mode,
    };
    if (habit.monthly.dates != null) record.monthly.dates = [...habit.monthly.dates];
    if (habit.monthly.combinations != null) {
      record.monthly.combinations = [...habit.monthly.combinations];
    }
  }
  return record;
}

export function activityCategoryRecord(category, sortOrder) {
  return {
    clientId: category.id || category.clientId,
    name: category.name,
    color: category.color,
    icon: category.icon || '',
    sortOrder,
    isSystemDefault: Boolean(category.isSystemDefault),
    revision: category.revision || 0,
  };
}

function entryOperation(runtime, state, action) {
  const habit = state.habits.find((item) => item.id === action.payload.habitId);
  if (!habit) throw new Error('Habit no longer exists');
  const periodKey = action.payload.date;
  const existingCompleted = Boolean(habit.completed?.[periodKey]);
  const existingProgress = Number(habit.progress?.[periodKey] || 0);
  const existingSkipped = Boolean(habit.skippedDates?.includes(periodKey));
  const desired = {
    habitClientId: habit.id,
    periodKey,
    periodSortDate: periodSortDate(periodKey, habit.createdAt),
    completed:
      action.type === ActionTypes.TOGGLE_HABIT_COMPLETED
        ? !existingCompleted
        : existingCompleted,
    progress:
      action.type === ActionTypes.SET_HABIT_PROGRESS
        ? Number(action.payload.progress)
        : existingProgress,
    skipped: action.type === ActionTypes.SKIP_HABIT ? !existingSkipped : existingSkipped,
  };
  const clientId = `habit-entry:${habit.id}:${periodKey}`;
  const baseRecord = {
    clientId,
    ...desired,
    completed: existingCompleted,
    progress: existingProgress,
    skipped: existingSkipped,
    revision: habit.entryRevisions?.[periodKey] || 0,
  };
  return sharedOperation(
    runtime,
    'habitEntries',
    clientId,
    'habitEntries:setDesiredState',
    desired,
    baseRecord.revision ? baseRecord : null,
    { ...desired, clientId, revision: baseRecord.revision }
  );
}

function activityRecord(record) {
  return sanitizeActivityRecord({
    clientId: record.id || record.clientId,
    activityClientId: record.activityId || record.activityClientId,
    activityNameSnapshot: record.activityName || record.activityNameSnapshot || '',
    categoryClientIdSnapshot: record.categoryId || record.categoryClientIdSnapshot || '',
    dateKey: String(record.date || record.dateKey).slice(0, 10),
    timestampISO: record.timestamp || record.timestampISO,
    duration: record.duration == null ? undefined : Number(record.duration),
    durationUnit: record.durationUnit,
    intensity: record.intensity,
    notes: record.notes || '',
    sets: record.sets,
    revision: record.revision || 0,
  });
}

function activityDefinition(activity) {
  return sanitizeActivityDefinition({
    clientId: activity.id || activity.clientId,
    name: activity.name,
    categoryClientId: activity.categoryId || activity.categoryClientId,
    icon: activity.icon || '',
    createdAtISO: String(activity.createdAt || activity.createdAtISO).slice(0, 10),
    trackingType: activity.trackingType === 'sets-reps' ? 'sets-reps' : 'time',
    units: activity.units,
    muscleGroup: activity.muscleGroup,
    revision: activity.revision || 0,
  });
}

export async function persistStateAction(action, state) {
  const runtime = getCloudRuntime();
  if (!runtime) throw new Error('Cloud persistence is not ready');
  if (runtime.writeBlocked) throw new Error('Writes are paused while migration is unresolved');
  const operations = [];
  const findCategory = (id) => state.categories.find((item) => item.id === id);
  const findHabit = (id) => state.habits.find((item) => item.id === id);

  switch (action.type) {
    case ActionTypes.ADD_CATEGORY: {
      const optimistic = categoryRecord(action.payload, state.categories.length);
      operations.push(
        sharedOperation(
          runtime,
          'habitCategories',
          optimistic.clientId,
          'habitCategories:create',
          { ...optimistic, revision: undefined },
          null,
          optimistic
        )
      );
      break;
    }
    case ActionTypes.UPDATE_CATEGORY: {
      const current = findCategory(action.payload.categoryId);
      const optimistic = categoryRecord(
        { ...current, ...action.payload.updates },
        state.categories.indexOf(current)
      );
      operations.push(
        sharedOperation(
          runtime,
          'habitCategories',
          optimistic.clientId,
          'habitCategories:update',
          optimistic,
          categoryRecord(current, state.categories.indexOf(current)),
          optimistic
        )
      );
      break;
    }
    case ActionTypes.DELETE_CATEGORY: {
      const current = findCategory(action.payload);
      operations.push(
        sharedOperation(
          runtime,
          'habitCategories',
          current.id,
          'habitCategories:removeCascade',
          { clientId: current.id },
          categoryRecord(current, state.categories.indexOf(current)),
          { ...categoryRecord(current, state.categories.indexOf(current)), deletedAt: Date.now() }
        )
      );
      break;
    }
    case ActionTypes.ADD_HABIT: {
      const optimistic = habitRecord(action.payload, state.habits.length);
      operations.push(
        sharedOperation(
          runtime,
          'habits',
          optimistic.clientId,
          'habits:create',
          { ...optimistic, revision: undefined },
          null,
          optimistic
        )
      );
      break;
    }
    case ActionTypes.UPDATE_HABIT: {
      const current = findHabit(action.payload.habitId);
      const optimistic = habitRecord(
        { ...current, ...action.payload.updates },
        state.habits.indexOf(current)
      );
      operations.push(
        sharedOperation(
          runtime,
          'habits',
          optimistic.clientId,
          'habits:update',
          optimistic,
          habitRecord(current, state.habits.indexOf(current)),
          optimistic
        )
      );
      break;
    }
    case ActionTypes.DELETE_HABIT: {
      const current = findHabit(action.payload);
      const base = habitRecord(current, state.habits.indexOf(current));
      operations.push(
        sharedOperation(
          runtime,
          'habits',
          current.id,
          'habits:removeCascade',
          { clientId: current.id },
          base,
          { ...base, deletedAt: Date.now() }
        )
      );
      break;
    }
    case ActionTypes.TOGGLE_HABIT_COMPLETED:
    case ActionTypes.SET_HABIT_PROGRESS:
    case ActionTypes.SKIP_HABIT:
      operations.push(entryOperation(runtime, state, action));
      break;
    case ActionTypes.REORDER_HABITS:
    case ActionTypes.REORDER_CATEGORIES: {
      const collection =
        action.type === ActionTypes.REORDER_HABITS ? 'habits' : 'habitCategories';
      operations.push(
        sharedOperation(
          runtime,
          `${collection}.order`,
          collection,
          'reorder:collection',
          {
            collection,
            orderedClientIds: action.payload,
            collectionRevision: runtime.collectionRevisions?.[collection] || 0,
          },
          { revision: runtime.collectionRevisions?.[collection] || 0 },
          null
        )
      );
      break;
    }
    case ActionTypes.ADD_HOLIDAY_PERIOD:
    case ActionTypes.UPDATE_HOLIDAY_PERIOD:
    case ActionTypes.DELETE_HOLIDAY_PERIOD: {
      const source =
        action.type === ActionTypes.DELETE_HOLIDAY_PERIOD
          ? state.holidayPeriods.find((item) => item.id === action.payload)
          : action.payload;
      const existing = state.holidayPeriods.find((item) => item.id === source.id);
      const payload = {
        clientId: source.id,
        startISO: source.startISO || source.start,
        endISO: source.endISO || source.end,
        label: source.label || '',
        revision: source.revision,
      };
      const kind =
        action.type === ActionTypes.ADD_HOLIDAY_PERIOD
          ? 'createPeriod'
          : action.type === ActionTypes.UPDATE_HOLIDAY_PERIOD
            ? 'updatePeriod'
            : 'removePeriod';
      operations.push(
        sharedOperation(
          runtime,
          'holidayPeriods',
          source.id,
          `holidays:${kind}`,
          action.type === ActionTypes.DELETE_HOLIDAY_PERIOD
            ? { clientId: source.id }
            : payload,
          existing
            ? {
                clientId: existing.id,
                startISO: existing.startISO || existing.start,
                endISO: existing.endISO || existing.end,
                label: existing.label || '',
                revision: existing.revision || 0,
              }
            : null,
          action.type === ActionTypes.DELETE_HOLIDAY_PERIOD
            ? { ...payload, deletedAt: Date.now() }
            : payload
        )
      );
      break;
    }
    case ActionTypes.DELETE_ALL_HOLIDAY_PERIODS:
      state.holidayPeriods.forEach((period) => {
        operations.push(
          sharedOperation(
            runtime,
            'holidayPeriods',
            period.id,
            'holidays:removePeriod',
            { clientId: period.id },
            {
              clientId: period.id,
              startISO: period.startISO || period.start,
              endISO: period.endISO || period.end,
              label: period.label || '',
              revision: period.revision || 0,
            },
            { ...period, clientId: period.id, deletedAt: Date.now() }
          )
        );
      });
      break;
    case ActionTypes.TOGGLE_SINGLE_HOLIDAY: {
      const dateKey = action.payload.date;
      const desired = action.payload.desired;
      const revision = state.holidaySingleRevisions?.[dateKey] || 0;
      operations.push(
        sharedOperation(
          runtime,
          'holidaySingles',
          `holiday-single:${dateKey}`,
          'holidays:setSingleDesiredState',
          { dateKey, desired },
          revision
            ? {
                clientId: `holiday-single:${dateKey}`,
                dateKey,
                revision,
              }
            : null,
          {
            clientId: `holiday-single:${dateKey}`,
            dateKey,
            revision: 0,
            deletedAt: desired ? undefined : Date.now(),
          }
        )
      );
      break;
    }
    case ActionTypes.ADD_ACTIVITY: {
      const optimistic = activityDefinition(action.payload);
      operations.push(
        sharedOperation(
          runtime,
          'activities',
          optimistic.clientId,
          'activities:create',
          { ...optimistic, revision: undefined },
          null,
          optimistic
        )
      );
      break;
    }
    case ActionTypes.UPDATE_ACTIVITY:
    case ActionTypes.DELETE_ACTIVITY: {
      const id =
        action.type === ActionTypes.DELETE_ACTIVITY
          ? action.payload
          : action.payload.activityId;
      const current = state.activities.find((item) => item.id === id);
      const base = activityDefinition(current);
      const optimistic =
        action.type === ActionTypes.DELETE_ACTIVITY
          ? { ...base, deletedAt: Date.now() }
          : activityDefinition({ ...current, ...action.payload.updates });
      operations.push(
        sharedOperation(
          runtime,
          'activities',
          id,
          action.type === ActionTypes.DELETE_ACTIVITY
            ? 'activities:removeCascade'
            : 'activities:update',
          action.type === ActionTypes.DELETE_ACTIVITY ? { clientId: id } : optimistic,
          base,
          optimistic
        )
      );
      break;
    }
    case ActionTypes.RECORD_ACTIVITY: {
      const optimistic = activityRecord(action.payload.data);
      operations.push(
        sharedOperation(
          runtime,
          'activityRecords',
          optimistic.clientId,
          'activityRecords:create',
          { ...optimistic, revision: undefined },
          null,
          optimistic
        )
      );
      break;
    }
    case ActionTypes.UPDATE_RECORDED_ACTIVITY:
    case ActionTypes.DELETE_RECORDED_ACTIVITY: {
      const records = state.recordedActivities[action.payload.date] || [];
      const current = records.find((item) => item.id === action.payload.recordId);
      const base = activityRecord(current);
      const optimistic =
        action.type === ActionTypes.DELETE_RECORDED_ACTIVITY
          ? { ...base, deletedAt: Date.now() }
          : activityRecord({ ...current, ...action.payload.data });
      operations.push(
        sharedOperation(
          runtime,
          'activityRecords',
          current.id,
          action.type === ActionTypes.DELETE_RECORDED_ACTIVITY
            ? 'activityRecords:remove'
            : 'activityRecords:update',
          action.type === ActionTypes.DELETE_RECORDED_ACTIVITY
            ? { clientId: current.id }
            : optimistic,
          base,
          optimistic
        )
      );
      break;
    }
    case ActionTypes.SET_REST_DAY: {
      const { dateKey, desired } = action.payload;
      const revision = state.restDayRevisions?.[dateKey] || 0;
      operations.push(
        sharedOperation(
          runtime,
          'restDays',
          `rest-day:${dateKey}`,
          'restDays:setDesiredState',
          { dateKey, desired },
          revision
            ? { clientId: `rest-day:${dateKey}`, dateKey, revision }
            : null,
          {
            clientId: `rest-day:${dateKey}`,
            dateKey,
            revision,
            deletedAt: desired ? undefined : Date.now(),
          }
        )
      );
      break;
    }
    case ActionTypes.UPDATE_ACTIVITY_CATEGORY_COLOR: {
      const current = state.activityCategories.find(
        (item) => item.id === action.payload.categoryId
      );
      const base = activityCategoryRecord(
        current,
        state.activityCategories.indexOf(current)
      );
      const optimistic = { ...base, color: action.payload.newColor };
      operations.push(
        sharedOperation(
          runtime,
          'activityCategories',
          current.id,
          'activityCategories:update',
          optimistic,
          base,
          optimistic
        )
      );
      break;
    }
    default: {
      const current = runtime.preferences;
      let patch = action.payload || {};
      if (action.type === ActionTypes.SET_DARK_MODE) patch = { darkMode: action.payload };
      if (action.type === ActionTypes.TOGGLE_DARK_MODE) {
        patch = { darkMode: !state.settings.darkMode };
      }
      if (action.type === ActionTypes.TOGGLE_COMPLETED) {
        patch = { hideCompleted: !state.settings.hideCompleted };
      }
      if (action.type === ActionTypes.TOGGLE_SKIPPED) {
        patch = { hideSkipped: !state.settings.hideSkipped };
      }
      if (action.type === ActionTypes.UPDATE_HOME_SECTION_VISIBILITY) {
        patch = { homeSectionVisibility: action.payload };
      }
      operations.push(
        sharedOperation(
          runtime,
          'userPreferences',
          'preferences',
          'preferences:patch',
          patch,
          current,
          { ...current, ...patch }
        )
      );
    }
  }
  for (const operation of operations) {
    await commitOptimisticOperation(operation);
  }
  runtime.syncEngine?.requestReplay();
}
