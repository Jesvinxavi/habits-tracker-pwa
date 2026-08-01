import { describe, expect, it } from 'vitest';
import { habitStartDate } from '../../src/features/habits/helpers/habitCalculations.js';

describe('Statistics habit start date', () => {
  it('prefers explicit createdAt for cloud UUID habits', () => {
    const result = habitStartDate(
      {
        id: 'cloud-generated-uuid',
        createdAt: '2025-01-15',
      },
      new Date(2026, 6, 30)
    );

    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(15);
  });

  it('retains timestamp-prefixed IDs only as a compatibility fallback', () => {
    const timestamp = new Date(2024, 3, 12, 12).getTime();
    const result = habitStartDate({ id: `${timestamp}-legacy` }, new Date(2026, 6, 30));

    // Normalised to that day's local midnight: a start date is a calendar day,
    // and keeping the time of day made day counts depend on the hour a habit
    // happened to be created at.
    expect(result.getTime()).toBe(new Date(2024, 3, 12).getTime());
  });

  it('falls back to the earliest day the habit has any record of', () => {
    const result = habitStartDate(
      { id: 'no-created-at', completed: { '2025-03-04': true, '2025-05-01': true } },
      new Date(2026, 6, 30)
    );

    expect(result.getTime()).toBe(new Date(2025, 2, 4).getTime());
  });
});
