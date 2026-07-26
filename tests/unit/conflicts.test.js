import { describe, expect, it } from 'vitest';
import { threeWayMerge } from '../../src/core/conflicts.js';

describe('three-way merge', () => {
  it('merges disjoint fields including nested schedule fields', () => {
    const base = { name: 'Walk', completed: false, monthly: { interval: 1, mode: 'each' } };
    const server = { ...base, completed: true };
    const local = { ...base, monthly: { interval: 2, mode: 'each' } };
    const result = threeWayMerge(base, server, local);
    expect(result.conflictingFields).toEqual([]);
    expect(result.mergedRecord).toMatchObject({
      completed: true,
      monthly: { interval: 2, mode: 'each' },
    });
  });

  it('reports same-field divergent changes', () => {
    const result = threeWayMerge(
      { progress: 1 },
      { progress: 2 },
      { progress: 3 }
    );
    expect(result.conflictingFields).toEqual(['progress']);
  });

  it('accepts the same value chosen independently', () => {
    const result = threeWayMerge(
      { skipped: false },
      { skipped: true },
      { skipped: true }
    );
    expect(result.conflictingFields).toEqual([]);
    expect(result.mergedRecord.skipped).toBe(true);
  });
});
