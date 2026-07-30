import { ActionTypes } from './state.js';
import { commitOptimisticOperations } from './offlineDb.js';
import { getCloudRuntime } from './cloudRuntime.js';
import { periodSortDate } from '../shared/periodKeys.js';
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
  ActionTypes.RECORD_ACTIVITY,
  ActionTypes.RECORD_ACTIVITIES,
  ActionTypes.DELETE_RECORDED_ACTIVITY,
  ActionTypes.UPDATE_RECORDED_ACTIVITY,
  ActionTypes.UPDATE_ACTIVITY_CATEGORY_COLOR,
  ActionTypes.SET_REST_DAY,
  ActionTypes.ADD_ROUTINE,
  ActionTypes.UPDATE_ROUTINE,
  ActionTypes.ADD_PROGRAM,
  ActionTypes.UPDATE_PROGRAM,
  ActionTypes.DELETE_PROGRAM,
  ActionTypes.SET_ACTIVE_PROGRAM,
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
    'archivedAt',
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
    completed: existingCompleted,
    progress: existingProgress,
    skipped: existingSkipped,
  };
  if (action.type === ActionTypes.TOGGLE_HABIT_COMPLETED) {
    desired.completed = !existingCompleted;
    if (desired.completed) desired.skipped = false;
    if (!desired.completed && habit.target > 0) desired.progress = 0;
  }
  if (action.type === ActionTypes.SET_HABIT_PROGRESS) {
    desired.progress = Number(action.payload.progress);
    if (habit.target > 0 && desired.progress >= habit.target) {
      desired.completed = true;
      desired.skipped = false;
    }
  }
  if (action.type === ActionTypes.SKIP_HABIT) {
    desired.skipped = !existingSkipped;
    if (desired.skipped) {
      desired.completed = false;
      desired.progress = 0;
    }
  }
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
    notes: activity.notes,
    betterDirection: activity.betterDirection === 'lower' ? 'lower' : undefined,
    archivedAt: activity.archivedAt,
    revision: activity.revision || 0,
  });
}

/**
 * Shapes an in-app routine into its Convex record form.
 * @param {object} routine In-app routine (or an already-shaped record).
 * @param {number} sortOrder Position of the routine within the collection.
 * @returns {object} Convex-shaped routine record.
 */
export function routineRecord(routine, sortOrder) {
  const record = {
    clientId: routine.id || routine.clientId,
    name: routine.name,
    activityClientIds: [...(routine.activityIds || routine.activityClientIds || [])],
    createdAtISO: String(routine.createdAt || routine.createdAtISO).slice(0, 10),
    sortOrder,
    revision: routine.revision || 0,
  };
  // Absent rather than undefined, so the optional Convex field stays unset for
  // a routine that has never been archived.
  if (routine.archivedAt != null) record.archivedAt = routine.archivedAt;
  return record;
}

/**
 * Shapes an in-app program into its Convex record form.
 * @param {object} program In-app program (or an already-shaped record).
 * @param {number} sortOrder Position of the program within the collection.
 * @returns {object} Convex-shaped program record.
 */
export function programRecord(program, sortOrder) {
  return {
    clientId: program.id || program.clientId,
    name: program.name,
    startDateISO: String(program.startDate || program.startDateISO).slice(0, 10),
    endDateISO: String(program.endDate || program.endDateISO).slice(0, 10),
    restDays: [...(program.restDays || [])].map(Number),
    scheduledDays: (program.scheduledDays || []).map((day) => {
      // A day pins a routine or a single activity. Only the key in use is
      // written, so the other stays absent rather than undefined.
      const activityClientId = day.activityId || day.activityClientId;
      if (activityClientId) return { dayOfWeek: Number(day.dayOfWeek), activityClientId };
      return {
        dayOfWeek: Number(day.dayOfWeek),
        routineClientId: day.routineId || day.routineClientId,
      };
    }),
    // Superseded schedules, so a running program's past weeks keep the plan they
    // were measured against when it is edited.
    schedulePhases: (program.schedulePhases || []).map((phase) => ({
      startDateISO: String(phase.startDate || phase.startDateISO).slice(0, 10),
      endDateISO: String(phase.endDate || phase.endDateISO).slice(0, 10),
      scheduledDays: (phase.scheduledDays || []).map((day) => {
        const activityClientId = day.activityId || day.activityClientId;
        if (activityClientId) return { dayOfWeek: Number(day.dayOfWeek), activityClientId };
        return {
          dayOfWeek: Number(day.dayOfWeek),
          routineClientId: day.routineId || day.routineClientId,
        };
      }),
      restDays: [...(phase.restDays || [])].map(Number),
    })),
    // scheduleMode and anytimeRoutines are not written: one scheduling model
    // survives, and a session counts anywhere in its week. Both stay in the
    // Convex schema as optional so rows written by an older client still load.
    notes: program.notes || '',
    active: Boolean(program.active),
    createdAtISO: String(program.createdAt || program.createdAtISO).slice(0, 10),
    sortOrder,
    revision: program.revision || 0,
  };
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
      // Archive instead of cascading so habitEntries remain available to
      // historical Home dates and Stats, matching Fitness activity semantics.
      const id = action.payload?.habitId || action.payload;
      const current = findHabit(id);
      const base = habitRecord(current, state.habits.indexOf(current));
      const optimistic = habitRecord(
        {
          ...current,
          archivedAt: action.payload?.archivedAt || Date.now(),
        },
        state.habits.indexOf(current)
      );
      operations.push(
        sharedOperation(
          runtime,
          'habits',
          id,
          'habits:update',
          optimistic,
          base,
          optimistic
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
    case ActionTypes.UPDATE_ACTIVITY: {
      // Archiving is an update carrying archivedAt, not a delete: the records
      // are the history, and activities:removeCascade would tombstone them.
      const id = action.payload.activityId;
      const current = state.activities.find((item) => item.id === id);
      const base = activityDefinition(current);
      const optimistic = activityDefinition({ ...current, ...action.payload.updates });
      operations.push(
        sharedOperation(runtime, 'activities', id, 'activities:update', optimistic, base, optimistic)
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
    case ActionTypes.RECORD_ACTIVITIES: {
      action.payload.records.forEach((record) => {
        const optimistic = activityRecord(record);
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
      });
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
    case ActionTypes.ADD_ROUTINE: {
      const optimistic = routineRecord(action.payload, state.routines.length);
      operations.push(
        sharedOperation(
          runtime,
          'routines',
          optimistic.clientId,
          'routines:create',
          { ...optimistic, revision: undefined },
          null,
          optimistic
        )
      );
      break;
    }
    case ActionTypes.UPDATE_ROUTINE: {
      // As with activities, archiving travels as an update.
      const id = action.payload.routineId;
      const current = state.routines.find((item) => item.id === id);
      const sortOrder = state.routines.indexOf(current);
      const base = routineRecord(current, sortOrder);
      const optimistic = routineRecord({ ...current, ...action.payload.updates }, sortOrder);
      operations.push(
        sharedOperation(runtime, 'routines', id, 'routines:update', optimistic, base, optimistic)
      );
      break;
    }
    case ActionTypes.ADD_PROGRAM: {
      const optimistic = programRecord(action.payload, state.programs.length);
      operations.push(
        sharedOperation(
          runtime,
          'programs',
          optimistic.clientId,
          'programs:create',
          { ...optimistic, revision: undefined },
          null,
          optimistic
        )
      );
      break;
    }
    case ActionTypes.UPDATE_PROGRAM:
    case ActionTypes.DELETE_PROGRAM: {
      const id =
        action.type === ActionTypes.DELETE_PROGRAM ? action.payload : action.payload.programId;
      const current = state.programs.find((item) => item.id === id);
      const sortOrder = state.programs.indexOf(current);
      const base = programRecord(current, sortOrder);
      const optimistic =
        action.type === ActionTypes.DELETE_PROGRAM
          ? { ...base, deletedAt: Date.now() }
          : programRecord({ ...current, ...action.payload.updates }, sortOrder);
      operations.push(
        sharedOperation(
          runtime,
          'programs',
          id,
          action.type === ActionTypes.DELETE_PROGRAM
            ? 'programs:removeCascade'
            : 'programs:update',
          action.type === ActionTypes.DELETE_PROGRAM ? { clientId: id } : optimistic,
          base,
          optimistic
        )
      );
      break;
    }
    case ActionTypes.SET_ACTIVE_PROGRAM: {
      // Only the programs whose `active` flag actually flips are written. Emitting
      // an update for an unchanged program would burn a revision for nothing and
      // invite avoidable sync conflicts.
      state.programs.forEach((program, sortOrder) => {
        const desired = program.id === action.payload;
        if (Boolean(program.active) === desired) return;
        const base = programRecord(program, sortOrder);
        const optimistic = { ...base, active: desired };
        operations.push(
          sharedOperation(
            runtime,
            'programs',
            program.id,
            'programs:update',
            optimistic,
            base,
            optimistic
          )
        );
      });
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
  await commitOptimisticOperations(operations);
  runtime.syncEngine?.requestReplay();
}
