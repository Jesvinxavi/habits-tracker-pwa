import { describe, expect, it } from 'vitest';
import { mergeLegacySnapshots } from '../../src/core/migration/mergeLegacy.js';

describe('legacy source merge', () => {
  it('unions missing entities and reports divergent matching IDs', () => {
    const local = {
      categories: [{ id: 'a', name: 'Local' }, { id: 'only-local', name: 'L' }],
      habits: [],
    };
    const indexed = {
      categories: [{ id: 'a', name: 'Indexed' }, { id: 'only-indexed', name: 'I' }],
      habits: [],
    };
    const result = mergeLegacySnapshots(local, indexed);
    expect(result.snapshot.categories.map((category) => category.id)).toEqual([
      'a',
      'only-local',
      'only-indexed',
    ]);
    expect(result.snapshot.categories[0].name).toBe('Indexed');
    expect(result.conflicts).toEqual([
      expect.objectContaining({ entityType: 'habitCategories', clientId: 'a' }),
    ]);
  });

  it('never treats absence as deletion', () => {
    const result = mergeLegacySnapshots(
      { categories: [{ id: 'local' }], habits: [] },
      { categories: [], habits: [] }
    );
    expect(result.snapshot.categories).toEqual([{ id: 'local' }]);
  });
});
