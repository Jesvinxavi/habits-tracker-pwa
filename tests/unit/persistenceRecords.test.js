import { describe, expect, it } from 'vitest';
import {
  activityCategoryRecord,
  habitRecord,
} from '../../src/core/persistenceRouter.js';

describe('persistent entity records', () => {
  it('whitelists habit fields when updating a hydrated Convex record', () => {
    const record = habitRecord(
      {
        _id: 'convex-id',
        _creationTime: 123,
        ownerKey: 'private-owner',
        generation: 4,
        updatedAt: 456,
        updatedByDeviceId: 'device',
        optimistic: false,
        entityType: 'habits',
        entryRevisions: { '2026-01-01': 2 },
        id: 'habit-1',
        categoryId: 'category-1',
        name: 'Walk',
        frequency: 'weekly',
        createdAt: '2026-01-01',
        scheduledTime: null,
        days: [1, 3, 5],
        paused: false,
        activeOnHolidays: true,
        icon: '🚶',
        revision: 3,
      },
      2
    );

    expect(record).toEqual({
      clientId: 'habit-1',
      categoryClientId: 'category-1',
      name: 'Walk',
      frequency: 'weekly',
      createdAtISO: '2026-01-01',
      scheduledTime: null,
      days: [1, 3, 5],
      paused: false,
      activeOnHolidays: true,
      icon: '🚶',
      sortOrder: 2,
      revision: 3,
    });
    expect(record).not.toHaveProperty('ownerKey');
    expect(record).not.toHaveProperty('entryRevisions');
  });

  it('whitelists activity-category fields before a color update', () => {
    expect(
      activityCategoryRecord(
        {
          _id: 'convex-id',
          ownerKey: 'private-owner',
          generation: 1,
          id: 'cardio',
          name: 'Cardio',
          color: '#f00',
          icon: '🏃',
          isSystemDefault: true,
          revision: 4,
        },
        0
      )
    ).toEqual({
      clientId: 'cardio',
      name: 'Cardio',
      color: '#f00',
      icon: '🏃',
      sortOrder: 0,
      isSystemDefault: true,
      revision: 4,
    });
  });
});
