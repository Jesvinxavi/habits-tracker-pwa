import { functionReference, getConvexClient } from './convexClient.js';
import { getCloudRuntime } from './cloudRuntime.js';
import {
  getSyncMetadata,
  listCachedEntities,
  listOutbox,
} from './offlineDb.js';
import { normalizeLegacySnapshot } from './migration/normalizeLegacy.js';
import { checksum } from './migration/canonical.js';
import { uploadAndActivateMigration } from './migration/coordinator.js';
import { mergeNormalizedTables } from './migration/mergeNormalized.js';

export const EXPORT_FORMAT_VERSION = 1;

const TABLES = [
  'userPreferences',
  'habitCategories',
  'habits',
  'habitEntries',
  'holidayPeriods',
  'holidaySingles',
  'activityCategories',
  'activities',
  'activityRecords',
  'restDays',
  'legacyData',
];

export async function exportCloudData(client = getConvexClient()) {
  const runtime = getCloudRuntime();
  if (!runtime) throw new Error('No active cloud account');
  const generation = runtime.generation;
  const tables = {};
  for (const table of TABLES) {
    const records = [];
    let cursor = null;
    do {
      const result = await client.query(functionReference('dataTransfer:getExportPage'), {
        generation,
        table,
        paginationOpts: { numItems: 500, cursor },
      });
      if (result.generation !== generation) throw new Error('EXPORT_GENERATION_CHANGED');
      records.push(...result.page);
      cursor = result.isDone ? null : result.continueCursor;
    } while (cursor);
    tables[table] = records;
  }
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    generation,
    serverConfirmed: true,
    pendingOperationCount: (await listOutbox(runtime.ownerKey)).length,
    tables,
  };
}

export async function exportOfflineCache(ownerKey) {
  const metadata = await getSyncMetadata(ownerKey);
  if (!metadata?.activeGeneration) throw new Error('No cached generation is available');
  const tables = {};
  for (const table of TABLES) {
    tables[table] = (await listCachedEntities(ownerKey, metadata.activeGeneration, table)).map(
      ({
        ownerKey: ignoredOwner,
        generation: ignoredGeneration,
        entityType: ignoredType,
        optimistic: ignoredOptimistic,
        _id: ignoredId,
        _creationTime: ignoredCreationTime,
        updatedByDeviceId: ignoredDevice,
        ...record
      }) => record
    );
  }
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    cachedAt: metadata.lastCompletedSyncTimestamp || null,
    generation: metadata.activeGeneration,
    serverConfirmed: false,
    pendingOperationCount: (await listOutbox(ownerKey)).length,
    tables,
  };
}

export function previewImport(value) {
  if (!value || typeof value !== 'object') throw new Error('Import must be a JSON object');
  if (value.formatVersion === EXPORT_FORMAT_VERSION && value.tables) {
    const counts = Object.fromEntries(
      TABLES.map((table) => [table, Array.isArray(value.tables[table]) ? value.tables[table].length : 0])
    );
    return {
      formatVersion: EXPORT_FORMAT_VERSION,
      normalized: {
        tables: Object.fromEntries(
          TABLES.map((table) => [table, value.tables[table] || []])
        ),
        counts,
        checksums: Object.fromEntries(
          TABLES.map((table) => [
            table,
            checksum(
              [...(value.tables[table] || [])].sort((left, right) =>
                String(left.clientId || '').localeCompare(String(right.clientId || ''))
              )
            ),
          ])
        ),
        warnings: [],
      },
    };
  }
  return { formatVersion: 0, normalized: normalizeLegacySnapshot(value) };
}

export async function commitImport(value, { replaceConfirmation } = {}) {
  const runtime = getCloudRuntime();
  if (!runtime) throw new Error('No active cloud account');
  if (replaceConfirmation !== undefined && replaceConfirmation !== 'REPLACE') {
    throw new Error('Type REPLACE to replace the active dataset');
  }
  const preview = previewImport(value);
  const normalized =
    replaceConfirmation === 'REPLACE'
      ? preview.normalized
      : mergeNormalizedTables(
          (await exportCloudData()).tables,
          preview.normalized.tables
        );
  return uploadAndActivateMigration({
    normalized,
    sourceFingerprint: checksum(value),
    deviceId: runtime.deviceId,
  });
}

export async function resetCloudAccount(confirmation) {
  if (confirmation !== 'RESET') throw new Error('Type RESET to reset this account');
  const runtime = getCloudRuntime();
  if (!runtime) throw new Error('No active cloud account');
  return getConvexClient().mutation(functionReference('account:reset'), {
    deviceId: runtime.deviceId,
    confirmation,
    appFirstOpenDate: new Date().toISOString().slice(0, 10),
  });
}
