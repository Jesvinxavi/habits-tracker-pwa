import { describe, expect, it } from 'vitest';
import { checksum } from '../../src/core/migration/canonical.js';
import {
  meaningfulLegacySnapshot,
  normalizeLegacySnapshot,
} from '../../src/core/migration/normalizeLegacy.js';
import { periodSortDate } from '../../src/core/migration/periodKeys.js';
import {
  comprehensiveLegacySnapshot,
  legacySourcePairs,
} from '../fixtures/legacy.js';

describe('legacy normalizer', () => {
  it('is deterministic and preserves normalized domain data', () => {
    const snapshot = comprehensiveLegacySnapshot();
    const first = normalizeLegacySnapshot(snapshot, { fitnessRestDays: ['2025-01-04'] });
    const second = normalizeLegacySnapshot(snapshot, { fitnessRestDays: ['2025-01-04'] });

    expect(first.checksums).toEqual(second.checksums);
    expect(first.tables.habitEntries).toHaveLength(5);
    expect(first.tables.activityRecords[0].duration).toBe(15);
    expect(first.tables.activityRecords[0].sets[0]).toMatchObject({ reps: 5, value: 40 });
    expect(first.tables.restDays.map((item) => item.dateKey)).toEqual([
      '2025-01-03',
      '2025-01-04',
    ]);
    expect(first.tables.legacyData[0].unknownTopLevelFields).toHaveProperty(
      'experimentalField'
    );
  });

  it('defaults period-covered holiday dates to derived-only and reports ambiguity', () => {
    const result = normalizeLegacySnapshot(comprehensiveLegacySnapshot());
    expect(result.tables.holidaySingles.map((item) => item.dateKey)).toEqual(['2025-08-01']);
    expect(result.ambiguousHolidayDates).toEqual(['2025-07-02']);
  });

  it('emits empty routines and programs tables with counts and checksums', () => {
    // Legacy snapshots predate both features, but the keys must exist or the
    // count and checksum maps will not line up with the server's TABLES list and
    // migration verification fails.
    const result = normalizeLegacySnapshot(comprehensiveLegacySnapshot());

    expect(result.tables.routines).toEqual([]);
    expect(result.tables.programs).toEqual([]);
    expect(result.counts).toHaveProperty('routines', 0);
    expect(result.counts).toHaveProperty('programs', 0);
    expect(result.checksums).toHaveProperty('routines');
    expect(result.checksums).toHaveProperty('programs');
    expect(result.checksums.routines).toBe(checksum([]));
    expect(result.checksums.programs).toBe(checksum([]));
  });

  it('treats routines and programs as known fields rather than unknown extras', () => {
    const snapshot = {
      ...comprehensiveLegacySnapshot(),
      routines: [{ id: 'r1', name: 'Push' }],
      programs: [{ id: 'p1', name: 'Block' }],
    };
    const result = normalizeLegacySnapshot(snapshot);

    const unknown = result.tables.legacyData[0].unknownTopLevelFields;
    expect(unknown).not.toHaveProperty('routines');
    expect(unknown).not.toHaveProperty('programs');
    // Still normalised to empty: a legacy snapshot cannot describe the new shapes.
    expect(result.tables.routines).toEqual([]);
    expect(result.tables.programs).toEqual([]);
  });

  it('excludes device-only fields from meaningful fingerprints', () => {
    const pair = legacySourcePairs().deviceOnlyDifference;
    expect(checksum(meaningfulLegacySnapshot(pair.localSnapshot))).toBe(
      checksum(meaningfulLegacySnapshot(pair.indexedSnapshot))
    );
  });
});

describe('periodSortDate', () => {
  it.each([
    ['2025-01-02', '2025-01-02'],
    ['2025-W2', '2025-01-06'],
    ['2025-BW3', '2025-01-13'],
    ['2025-07', '2025-07-01'],
    ['2025', '2025-01-01'],
    ['unknown', '2024-03-04'],
  ])('normalizes %s', (key, expected) => {
    expect(periodSortDate(key, '2024-03-04')).toBe(expected);
  });
});
