import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { anyApi } from 'convex/server';
import schema from '../../convex/schema';
import { checksum } from '../../src/core/migration/canonical.js';

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

    await expect(testBackend.query(anyApi.profiles.get, {})).rejects.toThrow(
      'UNAUTHENTICATED',
    );
  });

  it('provisions and isolates users by token identifier', async () => {
    const testBackend = convexTest(schema, modules);
    const alice = authenticated(testBackend, 'alice');
    const bob = authenticated(testBackend, 'bob');

    await provision(alice, 'alice-device');
    await provision(bob, 'bob-device');

    const aliceProfile = await alice.query(anyApi.profiles.get, {});
    const bobProfile = await bob.query(anyApi.profiles.get, {});

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

    await client.mutation(
      anyApi.habits.create,
      operation('habit-create', {
        clientId: 'drink-water',
        categoryClientId: 'health',
        name: 'Drink water',
        frequency: 'daily',
        createdAtISO: '2026-01-01',
        paused: false,
        activeOnHolidays: true,
        icon: '💧',
        sortOrder: 0,
      }),
    );
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

  it('keeps a staged generation invisible until checksum-verified activation', async () => {
    const testBackend = convexTest(schema, modules);
    const client = authenticated(testBackend, 'migration-user');
    await provision(client);

    const preferences = [{
      darkMode: true,
      hideCompleted: true,
      hideSkipped: false,
      holidayMode: false,
      homeSectionVisibility: { Completed: false, Skipped: true },
      revision: 1,
    }];
    const tableNames = [
      'userPreferences',
      'habitCategories',
      'habits',
      'habitEntries',
      'holidayPeriods',
      'holidaySingles',
      'activityCategories',
      'activities',
      'activityRecords',
      'routines',
      'programs',
      'restDays',
      'legacyData',
    ];
    const expectedCounts = Object.fromEntries(
      tableNames.map((table) => [table, table === 'userPreferences' ? 1 : 0]),
    );
    const expectedChecksums = Object.fromEntries(
      tableNames.map((table) => [
        table,
        checksum(table === 'userPreferences' ? preferences : []),
      ]),
    );

    await client.mutation(anyApi.migration.begin, {
      batchId: 'migration-batch',
      deviceId: 'migration-device',
      sourceFingerprint: 'source-fingerprint',
      appFirstOpenDate: '2020-02-03',
      expectedCounts,
      expectedChecksums,
    });
    await client.mutation(anyApi.migration.uploadChunk, {
      batchId: 'migration-batch',
      table: 'userPreferences',
      records: preferences,
      chunkChecksum: checksum(preferences),
    });

    const stagedProfile = await client.query(anyApi.profiles.get, {});
    expect(stagedProfile.activeGeneration).toBe(1);
    expect(stagedProfile.appFirstOpenDate).toBe('2026-01-01');

    const verification = await client.mutation(anyApi.migration.verify, {
      batchId: 'migration-batch',
    });
    expect(verification.status).toBe('verified');

    await client.mutation(anyApi.migration.activate, {
      batchId: 'migration-batch',
    });
    const activeProfile = await client.query(anyApi.profiles.get, {});
    expect(activeProfile.activeGeneration).toBe(2);
    expect(activeProfile.previousGeneration).toBe(1);
    expect(activeProfile.appFirstOpenDate).toBe('2020-02-03');
  });
});
