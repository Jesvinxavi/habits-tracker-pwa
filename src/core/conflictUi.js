import { getCloudRuntime } from './cloudRuntime.js';
import { listOutbox } from './offlineDb.js';

export async function openConflictResolution() {
  const runtime = getCloudRuntime();
  if (!runtime) return;
  const operations = await listOutbox(runtime.ownerKey, ['conflict']);
  if (!operations.length) return;
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10003;background:rgba(15,23,42,.72);display:grid;place-items:center;padding:20px';
  const panel = document.createElement('section');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.style.cssText =
    'width:min(720px,100%);max-height:90vh;overflow:auto;background:white;color:#111;border-radius:16px;padding:24px';
  panel.innerHTML = '<h2>Resolve sync conflicts</h2>';
  operations.forEach((operation) => {
    const conflict = operation.conflict || {};
    const row = document.createElement('article');
    row.style.cssText = 'border-top:1px solid #cbd5e1;padding:16px 0';
    row.innerHTML = `
      <h3>${operation.entityType}: ${operation.clientId}</h3>
      <p>Conflicting fields: ${(conflict.conflictingFields || []).join(', ') || 'record state'}</p>
      <details><summary>Server and device values</summary><pre style="white-space:pre-wrap">${JSON.stringify(
        {
          server: conflict.serverRecord,
          device: operation.attemptedRecord || conflict.attemptedRecord,
        },
        null,
        2
      )}</pre></details>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" data-server>Keep server</button>
        <button type="button" data-local>Apply this device</button>
      </div>
    `;
    row.querySelector('[data-server]').addEventListener('click', async () => {
      await runtime.syncEngine.resolveOperationConflict(
        operation.operationId,
        conflict.conflictType === 'update_delete' ? 'keep_deleted' : 'keep_server'
      );
      row.remove();
      if (!panel.querySelector('article')) overlay.remove();
    });
    row.querySelector('[data-local]').addEventListener('click', async () => {
      await runtime.syncEngine.resolveOperationConflict(
        operation.operationId,
        conflict.conflictType === 'update_delete' ? 'restore_local' : 'apply_local'
      );
      row.remove();
      if (!panel.querySelector('article')) overlay.remove();
    });
    panel.appendChild(row);
  });
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.addEventListener('click', () => overlay.remove());
  panel.appendChild(close);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}
