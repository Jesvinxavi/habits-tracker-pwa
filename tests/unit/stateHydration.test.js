import { describe, expect, it } from 'vitest';
import {
  normalizedToCompatibilityState,
  overlayPendingOperations,
} from '../../src/core/stateHydration.js';

describe('compatibility hydration', () => {
  it('rebuilds embedded habit and fitness history without emitting commands', () => {
    const state = normalizedToCompatibilityState({
      profile: { appFirstOpenDate: '2024-01-01' },
      preferences: { darkMode: true, homeSectionVisibility: { Completed: true, Skipped: false } },
      habitCategories: [{ clientId: 'cat', sortOrder: 0 }],
      habits: [
        {
          clientId: 'habit',
          categoryClientId: 'cat',
          createdAtISO: '2024-01-01',
          sortOrder: 0,
        },
      ],
      habitEntries: [
        {
          habitClientId: 'habit',
          periodKey: '2025-01-01',
          completed: true,
          progress: 2,
          skipped: false,
        },
      ],
      holidayPeriods: [],
      holidaySingles: [],
      activityCategories: [],
      activities: [],
      activityRecords: [],
      restDays: [{ dateKey: '2025-01-02' }],
    });
    expect(state.habits[0].completed['2025-01-01']).toBe(true);
    expect(state.habits[0].progress['2025-01-01']).toBe(2);
    expect(state.restDays['2025-01-02']).toBe(true);
  });

  it('hydrates live holiday singles after a reload', () => {
    const state = normalizedToCompatibilityState({
      profile: { appFirstOpenDate: '2024-01-01' },
      preferences: {},
      habitCategories: [],
      habits: [],
      habitEntries: [],
      holidayPeriods: [],
      holidaySingles: [
        {
          clientId: 'holiday-single:2025-07-25',
          dateKey: '2025-07-25',
          revision: 2,
        },
      ],
      activityCategories: [],
      activities: [],
      activityRecords: [],
      restDays: [],
    });
    expect(state.manualHolidayDates).toEqual(['2025-07-25']);
    expect(state.holidayDates).toEqual(['2025-07-25']);
    expect(state.holidaySingleRevisions['2025-07-25']).toBe(2);
  });

  it('keeps pending category and activity creates visible during cloud hydration', () => {
    const cache = {
      profile: { activeGeneration: 1 },
      preferences: {},
      habitCategories: [],
      habits: [],
      habitEntries: [],
      holidayPeriods: [],
      holidaySingles: [],
      activityCategories: [],
      activities: [],
      activityRecords: [],
      restDays: [],
    };
    const overlaid = overlayPendingOperations(cache, [
      {
        generation: 1,
        entityType: 'habitCategories',
        attemptedRecord: {
          clientId: 'category-1',
          name: 'Health',
          color: '#fff',
          sortOrder: 0,
        },
      },
      {
        generation: 1,
        entityType: 'activities',
        attemptedRecord: {
          clientId: 'activity-1',
          name: 'Walk',
          categoryClientId: 'cardio',
          trackingType: 'time',
        },
      },
    ]);
    const state = normalizedToCompatibilityState(overlaid);
    expect(state.categories.map((category) => category.id)).toEqual(['category-1']);
    expect(state.activities.map((activity) => activity.id)).toEqual(['activity-1']);
  });

  it('keeps pending holiday periods visible and pending rest-day removals hidden', () => {
    const cache = {
      profile: { activeGeneration: 1 },
      preferences: {},
      habitCategories: [],
      habits: [],
      habitEntries: [],
      holidayPeriods: [],
      holidaySingles: [],
      activityCategories: [],
      activities: [],
      activityRecords: [],
      restDays: [{ clientId: 'rest-day:2026-07-25', dateKey: '2026-07-25' }],
    };
    const overlaid = overlayPendingOperations(cache, [
      {
        generation: 1,
        entityType: 'holidayPeriods',
        attemptedRecord: {
          clientId: 'period-1',
          label: 'Summer break',
          startISO: '2026-08-01',
          endISO: '2026-08-07',
        },
      },
      {
        generation: 1,
        entityType: 'restDays',
        attemptedRecord: {
          clientId: 'rest-day:2026-07-25',
          dateKey: '2026-07-25',
          deletedAt: 123,
        },
      },
    ]);
    const state = normalizedToCompatibilityState(overlaid);
    expect(state.holidayPeriods.map((period) => period.id)).toEqual(['period-1']);
    expect(state.restDays).toEqual({});
  });

  it('round-trips routines and programs from cache shape to in-app shape', () => {
    const state = normalizedToCompatibilityState({
      profile: { appFirstOpenDate: '2024-01-01' },
      preferences: {},
      habitCategories: [],
      habits: [],
      habitEntries: [],
      holidayPeriods: [],
      holidaySingles: [],
      activityCategories: [],
      activities: [],
      activityRecords: [],
      restDays: [],
      routines: [
        {
          clientId: 'routine-b',
          name: 'Second',
          activityClientIds: ['act-2'],
          createdAtISO: '2026-02-02',
          sortOrder: 1,
          revision: 2,
        },
        {
          clientId: 'routine-a',
          name: 'First',
          activityClientIds: ['act-1', 'act-3'],
          createdAtISO: '2026-01-01',
          sortOrder: 0,
          revision: 1,
        },
        {
          clientId: 'routine-dead',
          name: 'Gone',
          activityClientIds: [],
          createdAtISO: '2026-01-01',
          sortOrder: 2,
          revision: 3,
          deletedAt: 1750000000000,
        },
      ],
      programs: [
        {
          clientId: 'program-1',
          name: 'Autumn',
          startDateISO: '2026-10-19',
          endDateISO: '2026-12-13',
          scheduleMode: 'freeform',
          restDays: [0],
          scheduledDays: [
            { dayOfWeek: 1, routineClientId: 'routine-a' },
            { dayOfWeek: 4, activityClientId: 'act-1' },
          ],
          anytimeRoutines: [{ routineClientId: 'routine-b', count: 2 }],
          schedulePhases: [
            {
              startDateISO: '2026-10-19',
              endDateISO: '2026-10-27',
              scheduledDays: [{ dayOfWeek: 2, activityClientId: 'act-1' }],
              restDays: [0],
            },
          ],
          notes: 'Deload in week 5',
          active: true,
          createdAtISO: '2026-07-26',
          sortOrder: 0,
          revision: 1,
        },
      ],
    });

    // Tombstoned rows are dropped and the rest come back in sortOrder.
    expect(state.routines.map((routine) => routine.id)).toEqual(['routine-a', 'routine-b']);
    expect(state.routines[0].activityIds).toEqual(['act-1', 'act-3']);
    expect(state.routines[0].createdAt).toBe('2026-01-01');

    const program = state.programs[0];
    expect(program.id).toBe('program-1');
    expect(program.startDate).toBe('2026-10-19');
    expect(program.endDate).toBe('2026-12-13');
    expect(program.restDays).toEqual([0]);
    // The two-mode fields are dropped on the way in: a row written by an older
    // client still holds them, but nothing in the app reads them any more.
    expect(program).not.toHaveProperty('scheduleMode');
    expect(program).not.toHaveProperty('anytimeRoutines');
    // An activity pinned to a day comes back as activityId, never as an empty
    // routineId that would then read as a deleted routine.
    expect(program.scheduledDays).toEqual([
      { dayOfWeek: 1, routineId: 'routine-a' },
      { dayOfWeek: 4, activityId: 'act-1' },
    ]);
    // A superseded schedule comes back in the in-app shape, ids and all.
    expect(program.schedulePhases).toEqual([
      {
        startDate: '2026-10-19',
        endDate: '2026-10-27',
        scheduledDays: [{ dayOfWeek: 2, activityId: 'act-1' }],
        restDays: [0],
      },
    ]);
    expect(program.notes).toBe('Deload in week 5');
    expect(program.createdAt).toBe('2026-07-26');
  });

  it('reads a program written before rest days and notes existed', () => {
    const state = normalizedToCompatibilityState({
      profile: {},
      preferences: {},
      habitCategories: [],
      habits: [],
      habitEntries: [],
      holidayPeriods: [],
      holidaySingles: [],
      activityCategories: [],
      activities: [],
      activityRecords: [],
      restDays: [],
      routines: [],
      programs: [
        {
          clientId: 'legacy-program',
          name: 'Old',
          startDateISO: '2026-01-01',
          endDateISO: '2026-02-01',
          scheduledDays: [{ dayOfWeek: 2, routineClientId: 'routine-a' }],
          active: false,
          createdAtISO: '2026-01-01',
          sortOrder: 0,
          revision: 1,
        },
      ],
    });

    expect(state.programs[0].restDays).toEqual([]);
    expect(state.programs[0].scheduledDays).toEqual([{ dayOfWeek: 2, routineId: 'routine-a' }]);
  });

  it('overlays pending routine and program operations onto the cache', () => {
    const overlaid = overlayPendingOperations(
      { profile: { activeGeneration: 1 }, routines: [], programs: [] },
      [
        {
          generation: 1,
          entityType: 'routines',
          attemptedRecord: { clientId: 'routine-a', name: 'Pending', activityClientIds: [] },
        },
        {
          generation: 1,
          entityType: 'programs',
          attemptedRecord: { clientId: 'program-1', name: 'Pending Program' },
        },
      ]
    );

    expect(overlaid.routines).toHaveLength(1);
    expect(overlaid.routines[0].name).toBe('Pending');
    expect(overlaid.programs).toHaveLength(1);
    expect(overlaid.programs[0].name).toBe('Pending Program');
  });
});
