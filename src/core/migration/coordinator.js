import { functionReference, getConvexClient } from '../convexClient.js';
import { checksum } from './canonical.js';
import { saveMigrationBackup } from '../offlineDb.js';
import { generateUuid } from '../../shared/common.js';

const TABLE_ORDER = [
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

function sortedRecords(records) {
  return [...records].sort((left, right) =>
    String(left.clientId || '').localeCompare(String(right.clientId || ''))
  );
}

export async function backUpLegacySources(ownerKey, sources) {
  for (const source of [sources.local, sources.indexed]) {
    if (source.raw == null) continue;
    await saveMigrationBackup({
      ownerKey,
      sourceLocation: source.location,
      rawValue: source.raw,
      fingerprint: source.snapshot ? checksum(source.snapshot) : checksum(String(source.raw)),
      verificationState: 'preserved',
    });
  }
}

export async function uploadAndActivateMigration({
  normalized,
  sourceFingerprint,
  deviceId,
  batchId = generateUuid(),
  onProgress = () => {},
  client = getConvexClient(),
}) {
  const batch = await client.mutation(functionReference('migration:begin'), {
    batchId,
    deviceId,
    sourceFingerprint,
    appFirstOpenDate: normalized.appFirstOpenDate,
    expectedCounts: normalized.counts,
    expectedChecksums: normalized.checksums,
  });
  let uploaded = 0;
  const total = Object.values(normalized.counts).reduce((sum, count) => sum + count, 0);
  for (const table of TABLE_ORDER) {
    const records = sortedRecords(normalized.tables[table] || []);
    for (let offset = 0; offset < records.length; offset += 100) {
      const chunk = records.slice(offset, offset + 100);
      await client.mutation(functionReference('migration:uploadChunk'), {
        batchId,
        table,
        records: chunk,
        chunkChecksum: checksum(sortedRecords(chunk)),
      });
      uploaded += chunk.length;
      onProgress({ phase: 'uploading', table, uploaded, total });
    }
  }
  onProgress({ phase: 'verifying', uploaded, total });
  const verification = await client.mutation(functionReference('migration:verify'), {
    batchId,
  });
  if (verification.status !== 'verified') {
    throw new Error('Server migration checksums do not match the source');
  }
  const activation = await client.mutation(functionReference('migration:activate'), {
    batchId,
  });
  const core = await client.query(functionReference('bootstrap:getCore'), {});
  if (core.generation !== activation.activeGeneration) {
    throw new Error('The client did not observe the activated generation');
  }
  return { batch: { ...batch, batchId }, verification, activation, core };
}

export function renderMigrationPreview({
  normalized,
  selectedSource,
  onMigrate,
  onCancel = () => {},
}) {
  const overlay = document.createElement('div');
  overlay.id = 'migration-preview';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10001;background:rgba(15,23,42,.72);display:grid;place-items:center;padding:20px';
  const panel = document.createElement('section');
  panel.style.cssText =
    'width:min(680px,100%);max-height:90vh;overflow:auto;background:var(--background,#fff);color:var(--text,#111);border-radius:16px;padding:24px';
  const counts = Object.entries(normalized.counts)
    .map(([table, count]) => `<li>${table}: ${count}</li>`)
    .join('');
  panel.innerHTML = `
    <h2>Move this account to cloud sync</h2>
    <p>Selected source: <strong>${selectedSource}</strong>. Both browser snapshots have already been preserved.</p>
    <ul>${counts}</ul>
    <p>${normalized.warnings.length} migration warning(s) require review.</p>
    <details>
      <summary>Warnings</summary>
      <pre style="white-space:pre-wrap">${JSON.stringify(normalized.warnings, null, 2)}</pre>
    </details>
    <p data-migration-status aria-live="polite"></p>
    <div style="display:flex;gap:12px;justify-content:flex-end">
      <button type="button" data-cancel>Not now</button>
      <button type="button" data-migrate>Verify and migrate</button>
    </div>
  `;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  panel.querySelector('[data-cancel]').addEventListener('click', () => {
    overlay.remove();
    onCancel();
  });
  panel.querySelector('[data-migrate]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const status = panel.querySelector('[data-migration-status]');
    button.disabled = true;
    try {
      await onMigrate((progress) => {
        status.textContent =
          progress.phase === 'uploading'
            ? `Uploading ${progress.uploaded} of ${progress.total} records…`
            : 'Verifying checksums…';
      });
      status.textContent = 'Migration verified and activated.';
      overlay.remove();
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });
  return overlay;
}
