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
});
