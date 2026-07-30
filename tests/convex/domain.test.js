import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');

function authenticated(testBackend, subject) {
  return testBackend.withIdentity({
    subject,
    issuer: 'https://clerk.test',
    tokenIdentifier: `https://clerk.test|${subject}`,
  });
}

async function provision(client, deviceId = 'device-1') {
  return client.mutation(anyApi.profiles.provision, {
    deviceId,
    appFirstOpenDate: '2026-01-01',
  });
}

function operation(operationId, payload, overrides = {}) {
  return {
    operationId,
    deviceId: 'device-1',
    payload,
    ...overrides,
  };
}

describe('Convex authenticated domain API', () => {
  it('rejects anonymous account access', async () => {
    const testBackend = convexTest(schema, modules);

    await expect(testBackend.query(anyApi.bootstrap.getCore, {})).rejects.toThrow(
      'UNAUTHENTICATED',
    );
  });

  it('provisions and isolates users by token identifier', async () => {
    const testBackend = convexTest(schema, modules);
    const alice = authenticated(testBackend, 'alice');
    const bob = authenticated(testBackend, 'bob');

    const aliceResult = await provision(alice, 'alice-device');
    const bobResult = await provision(bob, 'bob-device');
    const aliceProfile = aliceResult.profile;
    const bobProfile = bobResult.profile;

    expect(aliceProfile.ownerKey).toBe('https://clerk.test|alice');
    expect(bobProfile.ownerKey).toBe('https://clerk.test|bob');
    expect(aliceProfile._id).not.toBe(bobProfile._id);

    const documents = await testBackend.run(async (ctx) => ({
      profiles: await ctx.db.query('userProfiles').collect(),
      preferences: await ctx.db.query('userPreferences').collect(),
      activityCategories: await ctx.db.query('activityCategories').collect(),
    }));
    expect(documents.profiles).toHaveLength(2);
    expect(documents.preferences).toHaveLength(2);
    expect(documents.activityCategories).toHaveLength(10);
  });

  it('deduplicates an operation and cascades category tombstones', async () => {
    const testBackend = convexTest(schema, modules);
    const client = authenticated(testBackend, 'cascade-user');
    await provision(client);

    const categoryOperation = operation('category-create', {
      clientId: 'health',
      name: 'Health',
      color: '#123456',
      sortOrder: 0,
    });
    const created = await client.mutation(
      anyApi.habitCategories.create,
      categoryOperation,
    );
    const duplicate = await client.mutation(
      anyApi.habitCategories.create,
      categoryOperation,
    );

    expect(created.status).toBe('applied');
    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.canonicalRecord._id).toBe(created.canonicalRecord._id);

    const habitPayload = {
      clientId: 'drink-water',
      categoryClientId: 'health',
      name: 'Drink water',
      frequency: 'monthly',
      createdAtISO: '2026-01-01',
      paused: false,
      activeOnHolidays: true,
      icon: '💧',
      sortOrder: 0,
      monthly: {
        interval: 1,
        mode: 'on',
        dates: [2],
      },
    };
    const habit = await client.mutation(
      anyApi.habits.create,
      operation('habit-create', habitPayload),
    );
    expect(habit.status).toBe('applied');

    const reorderedHabit = await client.mutation(
      anyApi.habits.create,
      operation('habit-create-reordered', {
        monthly: {
          dates: [2],
          mode: 'on',
          interval: 1,
        },
        sortOrder: 0,
        icon: '💧',
        activeOnHolidays: true,
        paused: false,
        createdAtISO: '2026-01-01',
        frequency: 'monthly',
        name: 'Drink water',
        categoryClientId: 'health',
        clientId: 'drink-water',
      }),
    );
    expect(['applied', 'duplicate']).toContain(reorderedHabit.status);
    expect(reorderedHabit.canonicalRecord._id).toBe(habit.canonicalRecord._id);

    await client.mutation(
      anyApi.habitEntries.setDesiredState,
      operation('entry-create', {
        habitClientId: 'drink-water',
        periodKey: '2026-01-02',
        periodSortDate: '2026-01-02',
        completed: true,
        progress: 1,
        skipped: false,
      }),
    );

    const removed = await client.mutation(
      anyApi.habitCategories.removeCascade,
      operation(
        'category-remove',
        { clientId: 'health' },
        { baseRevision: 1, baseRecord: created.canonicalRecord },
      ),
    );
    expect(removed.status).toBe('applied');

    const tombstones = await testBackend.run(async (ctx) => {
      const category = await ctx.db
        .query('habitCategories')
        .filter((query) => query.eq(query.field('clientId'), 'health'))
        .unique();
      const habit = await ctx.db
        .query('habits')
        .filter((query) => query.eq(query.field('clientId'), 'drink-water'))
        .unique();
      const entry = await ctx.db
        .query('habitEntries')
        .filter((query) =>
          query.eq(
            query.field('clientId'),
            'habit-entry:drink-water:2026-01-02',
          ),
        )
        .unique();
      return { category, habit, entry };
    });

    expect(tombstones.category.deletedAt).toEqual(expect.any(Number));
    expect(tombstones.habit.deletedAt).toEqual(expect.any(Number));
    expect(tombstones.entry.deletedAt).toEqual(expect.any(Number));

    const historySignals = await client.query(anyApi.sync.getHistorySignals, {});
    expect(historySignals.signals).toEqual([
      expect.objectContaining({ entityType: 'habitEntries', revision: 2 }),
    ]);

    const recreateTombstonedCategory = await client.mutation(
      anyApi.habitCategories.create,
      operation('category-recreate-after-tombstone', categoryOperation.payload),
    );
    expect(recreateTombstonedCategory.status).toBe('conflict');
  });

  it('returns and advances collection revisions for repeat reorders', async () => {
    const testBackend = convexTest(schema, modules);
    const client = authenticated(testBackend, 'reorder-user');
    await provision(client);

    await client.mutation(
      anyApi.habitCategories.create,
      operation('category-create-reorder', {
        clientId: 'health',
        name: 'Health',
        color: '#123456',
        sortOrder: 0,
      }),
    );

    const first = await client.mutation(
      anyApi.reorder.collection,
      operation(
        'category-reorder-1',
        {
          collection: 'habitCategories',
          orderedClientIds: ['health'],
          collectionRevision: 0,
        },
        { baseRevision: 0, baseRecord: { revision: 0 } },
      ),
    );
    expect(first.status).toBe('applied');
    expect(first.revision).toBe(1);

    const core = await client.query(anyApi.bootstrap.getCore, {});
    expect(core.collectionRevisions).toEqual({ habitCategories: 1 });

    const second = await client.mutation(
      anyApi.reorder.collection,
      operation(
        'category-reorder-2',
        {
          collection: 'habitCategories',
          orderedClientIds: ['health'],
          collectionRevision: 1,
        },
        { baseRevision: 1, baseRecord: { revision: 1 } },
      ),
    );
    expect(second.status).toBe('applied');
    expect(second.revision).toBe(2);
  });

  it('archives a habit without tombstoning its historical entries', async () => {
    const testBackend = convexTest(schema, modules);
    const client = authenticated(testBackend, 'habit-archive-user');
    await provision(client);

    await client.mutation(
      anyApi.habitCategories.create,
      operation('archive-category-create', {
        clientId: 'health',
        name: 'Health',
        color: '#123456',
        sortOrder: 0,
      }),
    );
    const habitPayload = {
      clientId: 'walk',
      categoryClientId: 'health',
      name: 'Walk',
      frequency: 'daily',
      createdAtISO: '2026-01-01',
      paused: false,
      activeOnHolidays: false,
      icon: '🚶',
      sortOrder: 0,
    };
    const created = await client.mutation(
      anyApi.habits.create,
      operation('archive-habit-create', habitPayload),
    );
    await client.mutation(
      anyApi.habitEntries.setDesiredState,
      operation('archive-entry-create', {
        habitClientId: 'walk',
        periodKey: '2026-07-29',
        periodSortDate: '2026-07-29',
        completed: true,
        progress: 0,
        skipped: false,
      }),
    );

    const archivedAt = 1785412800000;
    const archived = await client.mutation(
      anyApi.habits.update,
      operation(
        'archive-habit-update',
        { ...habitPayload, archivedAt, revision: 1 },
        { baseRevision: 1, baseRecord: created.canonicalRecord },
      ),
    );
    expect(archived.status).toBe('applied');
    expect(archived.canonicalRecord.archivedAt).toBe(archivedAt);
    expect(archived.canonicalRecord.deletedAt).toBeUndefined();

    const entry = await testBackend.run(async (ctx) =>
      ctx.db
        .query('habitEntries')
        .withIndex('by_owner_generation_habit', (query) =>
          query
            .eq('ownerKey', 'https://clerk.test|habit-archive-user')
            .eq('generation', 1)
            .eq('habitClientId', 'walk'),
        )
        .unique(),
    );
    expect(entry.completed).toBe(true);
    expect(entry.deletedAt).toBeUndefined();
  });

  it('keeps routine create and update idempotent', async () => {
    const testBackend = convexTest(schema, modules);
    const client = authenticated(testBackend, 'routine-user');
    await provision(client);

    const payload = {
      clientId: 'routine-1',
      name: 'Push Day',
      activityClientIds: ['act-1', 'act-2'],
      createdAtISO: '2026-07-26',
      sortOrder: 0,
    };

    const created = await client.mutation(anyApi.routines.create, operation('op-1', payload));
    expect(created.status).toBe('applied');
    expect(created.revision).toBe(1);
    expect(created.canonicalRecord.name).toBe('Push Day');

    // Replaying the same operation id is a duplicate, not a second row.
    const replay = await client.mutation(anyApi.routines.create, operation('op-1', payload));
    expect(replay.status).toBe('duplicate');
    const rows = await testBackend.run(async (ctx) => ctx.db.query('routines').collect());
    expect(rows).toHaveLength(1);

    const updated = await client.mutation(
      anyApi.routines.update,
      operation('op-2', { ...payload, name: 'Push A' }, { baseRevision: 1 })
    );
    expect(updated.status).toBe('applied');
    expect(updated.revision).toBe(2);
    expect(updated.canonicalRecord.name).toBe('Push A');

  });

  it('reports a conflict for a stale routine revision', async () => {
    const testBackend = convexTest(schema, modules);
    const client = authenticated(testBackend, 'routine-conflict');
    await provision(client);

    const payload = {
      clientId: 'routine-1',
      name: 'Push Day',
      activityClientIds: [],
      createdAtISO: '2026-07-26',
      sortOrder: 0,
    };
    await client.mutation(anyApi.routines.create, operation('op-1', payload));

    const stale = await client.mutation(
      anyApi.routines.update,
      operation('op-2', { ...payload, name: 'Stale' }, { baseRevision: 99 })
    );
    expect(stale.status).toBe('conflict');
  });

  it('does not let mutation payloads overwrite account or revision metadata', async () => {
    const testBackend = convexTest(schema, modules);
    const client = authenticated(testBackend, 'protected-fields');
    await provision(client);
    const payload = {
      clientId: 'routine-1',
      name: 'Push Day',
      activityClientIds: [],
      createdAtISO: '2026-07-26',
      sortOrder: 0,
    };
    const created = await client.mutation(
      anyApi.routines.create,
      operation('protected-create', payload),
    );

    const updated = await client.mutation(
      anyApi.routines.update,
      operation(
        'protected-update',
        {
          ...payload,
          name: 'Push A',
          ownerKey: 'another-account',
          generation: 999,
          revision: 999,
          updatedAt: 1,
          updatedByDeviceId: 'another-device',
          deletedAt: 1,
        },
        { baseRevision: created.revision },
      ),
    );

    expect(updated.status).toBe('applied');
    expect(updated.canonicalRecord).toEqual(
      expect.objectContaining({
        ownerKey: 'https://clerk.test|protected-fields',
        generation: 1,
        revision: 2,
        updatedByDeviceId: 'device-1',
      }),
    );
    expect(updated.canonicalRecord.deletedAt).toBeUndefined();
  });

  it('rejects invalid routine payloads', async () => {
    const testBackend = convexTest(schema, modules);
    const client = authenticated(testBackend, 'routine-validation');
    await provision(client);

    await expect(
      client.mutation(
        anyApi.routines.create,
        operation('op-blank', {
          clientId: 'routine-1',
          name: '   ',
          activityClientIds: [],
          createdAtISO: '2026-07-26',
          sortOrder: 0,
        })
      )
    ).rejects.toThrow('INVALID_NAME');

    await expect(
      client.mutation(
        anyApi.routines.create,
        operation('op-list', {
          clientId: 'routine-2',
          name: 'Push',
          activityClientIds: 'not-an-array',
          createdAtISO: '2026-07-26',
          sortOrder: 0,
        })
      )
    ).rejects.toThrow('INVALID_ACTIVITY_LIST');
  });

  it('validates program ranges, weekdays, rest days and schedule targets', async () => {
    const testBackend = convexTest(schema, modules);
    const client = authenticated(testBackend, 'program-validation');
    await provision(client);

    const base = {
      clientId: 'program-1',
      name: 'Autumn',
      startDateISO: '2026-10-19',
      endDateISO: '2026-12-13',
      scheduledDays: [{ dayOfWeek: 1, routineClientId: 'routine-1' }],
      active: true,
      createdAtISO: '2026-07-26',
      sortOrder: 0,
    };

    await expect(
      client.mutation(
        anyApi.programs.create,
        operation('op-range', { ...base, startDateISO: '2026-12-13', endDateISO: '2026-10-19' })
      )
    ).rejects.toThrow('INVALID_PROGRAM_RANGE');

    await expect(
      client.mutation(
        anyApi.programs.create,
        operation('op-weekday', {
          ...base,
          scheduledDays: [{ dayOfWeek: 9, routineClientId: 'routine-1' }],
        })
      )
    ).rejects.toThrow('INVALID_PROGRAM_SCHEDULE');

    await expect(
      client.mutation(anyApi.programs.create, operation('op-rest', { ...base, restDays: [7] }))
    ).rejects.toThrow('INVALID_PROGRAM_REST_DAYS');

    // A scheduled day targets exactly one thing: neither zero nor both.
    await expect(
      client.mutation(
        anyApi.programs.create,
        operation('op-no-target', { ...base, scheduledDays: [{ dayOfWeek: 1 }] })
      )
    ).rejects.toThrow('INVALID_PROGRAM_SCHEDULE');

    await expect(
      client.mutation(
        anyApi.programs.create,
        operation('op-two-targets', {
          ...base,
          scheduledDays: [
            { dayOfWeek: 1, routineClientId: 'routine-1', activityClientId: 'act-1' },
          ],
        })
      )
    ).rejects.toThrow('INVALID_PROGRAM_SCHEDULE');

    const created = await client.mutation(
      anyApi.programs.create,
      operation('op-ok', {
        ...base,
        restDays: [0, 6],
      })
    );
    expect(created.status).toBe('applied');
    expect(created.canonicalRecord.restDays).toEqual([0, 6]);

    const current = await client.mutation(
      anyApi.programs.create,
      operation('op-current', { ...base, clientId: 'program-2', restDays: [0], sortOrder: 1 })
    );
    expect(current.status).toBe('applied');
  });

  it('accepts several routines pinned to the same weekday', async () => {
    const testBackend = convexTest(schema, modules);
    const client = authenticated(testBackend, 'program-multi');
    await provision(client);

    const created = await client.mutation(
      anyApi.programs.create,
      operation('op-multi', {
        clientId: 'program-1',
        name: 'Split',
        startDateISO: '2026-10-19',
        endDateISO: '2026-12-13',
        restDays: [],
        scheduledDays: [
          { dayOfWeek: 1, routineClientId: 'routine-1' },
          { dayOfWeek: 1, routineClientId: 'routine-2' },
        ],
        active: true,
        createdAtISO: '2026-07-26',
        sortOrder: 0,
      })
    );
    expect(created.status).toBe('applied');
    expect(created.canonicalRecord.scheduledDays).toHaveLength(2);
  });

  it('accepts an activity pinned to a weekday alongside a routine', async () => {
    const testBackend = convexTest(schema, modules);
    const client = authenticated(testBackend, 'program-activity-day');
    await provision(client);

    const created = await client.mutation(
      anyApi.programs.create,
      operation('op-activity-day', {
        clientId: 'program-1',
        name: 'Split',
        startDateISO: '2026-10-19',
        endDateISO: '2026-12-13',
        restDays: [],
        scheduledDays: [
          { dayOfWeek: 1, routineClientId: 'routine-1' },
          { dayOfWeek: 1, activityClientId: 'act-1' },
        ],
        notes: 'Deload in week 5',
        active: true,
        createdAtISO: '2026-07-26',
        sortOrder: 0,
      })
    );
    expect(created.status).toBe('applied');
    expect(created.canonicalRecord.scheduledDays[1]).toEqual({
      dayOfWeek: 1,
      activityClientId: 'act-1',
    });
    expect(created.canonicalRecord.notes).toBe('Deload in week 5');
  });
});
