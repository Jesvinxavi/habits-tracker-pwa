import { describe, expect, it } from 'vitest';
import {
  activityCategoryRecord,
  habitRecord,
  programRecord,
  routineRecord,
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

  it('shapes a routine, mapping ids and slicing the created date', () => {
    const record = routineRecord(
      {
        _id: 'convex-id',
        ownerKey: 'private-owner',
        generation: 3,
        entityType: 'routines',
        optimistic: true,
        id: 'routine-1',
        name: 'Push Day',
        activityIds: ['act-1', 'act-2'],
        createdAt: '2026-07-26T00:00:00.000',
        revision: 4,
      },
      2
    );

    expect(record).toEqual({
      clientId: 'routine-1',
      name: 'Push Day',
      activityClientIds: ['act-1', 'act-2'],
      createdAtISO: '2026-07-26',
      sortOrder: 2,
      revision: 4,
    });
    expect(record).not.toHaveProperty('ownerKey');
    expect(record).not.toHaveProperty('activityIds');
  });

  it('copies the routine activity list instead of aliasing it', () => {
    const activityIds = ['act-1'];
    const record = routineRecord({ id: 'r', name: 'R', activityIds, createdAt: '2026-01-01' }, 0);
    activityIds.push('act-2');
    expect(record.activityClientIds).toEqual(['act-1']);
  });

  it('accepts an already-shaped routine record for re-serialisation', () => {
    const record = routineRecord(
      {
        clientId: 'routine-1',
        name: 'Push Day',
        activityClientIds: ['act-1'],
        createdAtISO: '2026-07-26',
        revision: 2,
      },
      0
    );
    expect(record.clientId).toBe('routine-1');
    expect(record.activityClientIds).toEqual(['act-1']);
    expect(record.createdAtISO).toBe('2026-07-26');
  });

  it('shapes a program, mapping dates, schedule and anytime targets', () => {
    const record = programRecord(
      {
        _id: 'convex-id',
        ownerKey: 'private-owner',
        generation: 1,
        id: 'program-1',
        name: 'Autumn',
        startDate: '2026-10-19T00:00:00.000',
        endDate: '2026-12-13',
        scheduleMode: 'freeform',
        restDays: ['0', 6],
        scheduledDays: [{ dayOfWeek: '1', routineId: 'routine-1' }],
        anytimeRoutines: [{ routineId: 'routine-2', count: 2 }],
        active: true,
        createdAt: '2026-07-26',
        revision: 5,
      },
      1
    );

    expect(record).toEqual({
      clientId: 'program-1',
      name: 'Autumn',
      startDateISO: '2026-10-19',
      endDateISO: '2026-12-13',
      scheduleMode: 'freeform',
      restDays: [0, 6],
      scheduledDays: [{ dayOfWeek: 1, routineClientId: 'routine-1' }],
      anytimeRoutines: [{ routineClientId: 'routine-2', count: 2 }],
      active: true,
      createdAtISO: '2026-07-26',
      sortOrder: 1,
      revision: 5,
    });
    expect(record).not.toHaveProperty('startDate');
    expect(record).not.toHaveProperty('ownerKey');
  });

  it('defaults an unknown program schedule mode to prescriptive', () => {
    const record = programRecord(
      {
        id: 'program-1',
        name: 'Autumn',
        startDate: '2026-10-19',
        endDate: '2026-12-13',
        createdAt: '2026-07-26',
      },
      0
    );
    expect(record.scheduleMode).toBe('prescriptive');
    expect(record.restDays).toEqual([]);
    expect(record.scheduledDays).toEqual([]);
    expect(record.anytimeRoutines).toEqual([]);
    expect(record.active).toBe(false);
    expect(record.revision).toBe(0);
  });
});
