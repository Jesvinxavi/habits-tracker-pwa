import { describe, expect, it } from 'vitest';
import { mergeNormalizedTables } from '../../src/core/migration/mergeNormalized.js';

describe('additional-device normalized merge', () => {
  it('unions unique entities and merges disjoint habit-entry fields', () => {
    const cloud = {
      habits: [{ clientId: 'cloud-habit' }],
      habitEntries: [
        {
          clientId: 'habit-entry:h:2025-01-01',
          completed: true,
          progress: 0,
          skipped: false,
        },
      ],
    };
    const local = {
      habits: [{ clientId: 'local-habit' }],
      habitEntries: [
        {
          clientId: 'habit-entry:h:2025-01-01',
          completed: false,
          progress: 2,
          skipped: false,
        },
      ],
    };
    const result = mergeNormalizedTables(cloud, local);
    expect(result.tables.habits.map((habit) => habit.clientId)).toEqual([
      'cloud-habit',
      'local-habit',
    ]);
    expect(result.tables.habitEntries[0]).toMatchObject({
      completed: true,
      progress: 2,
    });
    expect(result.conflicts).toEqual([]);
  });

  it('reports divergent matching definitions without treating absence as deletion', () => {
    const result = mergeNormalizedTables(
      { habits: [{ clientId: 'h', name: 'Cloud' }] },
      { habits: [{ clientId: 'h', name: 'Local' }] }
    );
    expect(result.tables.habits[0].name).toBe('Cloud');
    expect(result.conflicts[0]).toMatchObject({ table: 'habits', clientId: 'h' });
  });
});
