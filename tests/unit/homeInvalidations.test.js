import { describe, expect, it } from 'vitest';
import { getHomeInvalidations } from '../../src/features/home/HomeModule.js';

function selection(overrides = {}) {
  const values = {
    categories: [],
    habits: [],
    selectedDate: '2026-07-30',
    selectedGroup: 'daily',
    holidayDates: [],
    manualHolidayDates: [],
    holidayPeriods: [],
    homeSectionVisibility: {},
    ...overrides,
  };
  return [
    values.categories,
    values.habits,
    values.selectedDate,
    values.selectedGroup,
    values.holidayDates,
    values.manualHolidayDates,
    values.holidayPeriods,
    values.homeSectionVisibility,
  ];
}

describe('Home component invalidation', () => {
  it('renders every component for the initial state', () => {
    expect(getHomeInvalidations(selection(), null)).toEqual({
      header: true,
      calendar: true,
      progress: true,
      pills: true,
      habits: true,
    });
  });

  it('does not rebuild cards when all selected slice identities are unchanged', () => {
    const current = selection();
    expect(getHomeInvalidations(current, current)).toEqual({
      header: false,
      calendar: false,
      progress: false,
      pills: false,
      habits: false,
    });
  });

  it('limits category and section-visibility changes to their consumers', () => {
    const previous = selection();
    const categoryChange = selection({
      habits: previous[1],
      holidayDates: previous[4],
      manualHolidayDates: previous[5],
      holidayPeriods: previous[6],
      homeSectionVisibility: previous[7],
    });
    expect(getHomeInvalidations(categoryChange, previous)).toEqual({
      header: false,
      calendar: false,
      progress: false,
      pills: false,
      habits: true,
    });

    const visibilityChange = previous.slice();
    visibilityChange[7] = { Completed: false, Skipped: true };
    expect(getHomeInvalidations(visibilityChange, previous)).toEqual({
      header: false,
      calendar: false,
      progress: false,
      pills: true,
      habits: true,
    });
  });
});
