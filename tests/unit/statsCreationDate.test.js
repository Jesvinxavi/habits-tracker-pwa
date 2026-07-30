import { describe, expect, it } from 'vitest';
import { getHabitCreationDate } from '../../src/features/stats/stats.js';

describe('Statistics habit creation date', () => {
  it('prefers explicit createdAt for cloud UUID habits', () => {
    const result = getHabitCreationDate(
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
    const result = getHabitCreationDate(
      { id: `${timestamp}-legacy` },
      new Date(2026, 6, 30)
    );

    expect(result.getTime()).toBe(timestamp);
  });
});
