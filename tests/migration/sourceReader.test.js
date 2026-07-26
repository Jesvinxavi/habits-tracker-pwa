import { beforeEach, describe, expect, it } from 'vitest';
import {
  readLegacySources,
  selectLegacyDefault,
  summarizeLegacySources,
} from '../../src/core/migration/sourceReader.js';
import { seedLegacyStorage } from '../helpers/storageSeed.js';
import { emptyLegacySnapshot } from '../fixtures/legacy.js';

beforeEach(async () => {
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('healthyHabitsDB');
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
});

describe('legacy source precedence', () => {
  it('preserves current IndexedDB-over-localStorage startup precedence', async () => {
    const localSnapshot = { ...emptyLegacySnapshot(), marker: 'local' };
    const indexedSnapshot = { ...emptyLegacySnapshot(), marker: 'indexed' };
    await seedLegacyStorage({ localSnapshot, indexedSnapshot });
    const sources = await readLegacySources();
    expect(selectLegacyDefault(sources)).toMatchObject({
      selected: 'indexed',
      snapshot: { marker: 'indexed' },
    });
    expect(summarizeLegacySources(sources).local.readable).toBe(true);
    expect(summarizeLegacySources(sources).indexed.readable).toBe(true);
  });
});
