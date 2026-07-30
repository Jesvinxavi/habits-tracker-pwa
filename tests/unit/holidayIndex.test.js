import { describe, expect, it } from 'vitest';
import {
  deriveHolidayIndex,
  getHolidayIndex,
} from '../../src/features/holidays/holidays.js';

describe('holiday derived index', () => {
  it('normalizes reversed periods and expands inclusive local calendar days', () => {
    const index = deriveHolidayIndex(
      ['2026-03-28'],
      [{ startISO: '2026-03-30', endISO: '2026-03-29' }]
    );

    expect(index.orderedKeys).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
    ]);
    expect(index.periods).toEqual([
      { startISO: '2026-03-29', endISO: '2026-03-30' },
    ]);
  });

  it('reuses one Set until a holiday source collection identity changes', () => {
    const singles = ['2026-07-30'];
    const periods = [];
    const first = getHolidayIndex({ manualHolidayDates: singles, holidayPeriods: periods });
    const second = getHolidayIndex({ manualHolidayDates: singles, holidayPeriods: periods });
    const changed = getHolidayIndex({
      manualHolidayDates: [...singles, '2026-07-31'],
      holidayPeriods: periods,
    });

    expect(second).toBe(first);
    expect(changed).not.toBe(first);
    expect(changed.keys.has('2026-07-31')).toBe(true);
  });
});
