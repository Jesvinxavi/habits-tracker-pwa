import { functionReference, getConvexClient } from './convexClient.js';
import { threeWayMerge } from './conflicts.js';
import {
  commitOptimisticOperation,
  confirmOperation,
  listOutbox,
  patchOutboxOperation,
  putSyncMetadata,
} from './offlineDb.js';
import { Actions, dispatch } from './state.js';
import { getCloudRuntime } from './cloudRuntime.js';
import {
  sanitizeMutationPayload,
  sanitizeOperationRecord,
} from './operationPayload.js';
import { generateUuid } from '../shared/common.js';

const MAX_RETRY_DELAY = 60000;

function retryDelay(retryCount) {
  const base = Math.min(MAX_RETRY_DELAY, 1000 * 2 ** retryCount);
  return Math.floor(base * (0.75 + Math.random() * 0.5));
}

export class SyncEngine {
  constructor({ ownerKey, generation, deviceId, client = getConvexClient() }) {
    this.ownerKey = ownerKey;
    this.generation = generation;
    this.deviceId = deviceId;
    this.client = client;
    this.running = false;
    this.replayRequestedWhileRunning = false;
    this.authenticated = true;
    this.channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(`habits-sync:${ownerKey}`)
        : null;
    this.handleOnline = () => {
      if (this.authenticated) this.requestReplay();
      else window.location.reload();
    };
    window.addEventListener('online', this.handleOnline);
  }

  setAuthenticated(authenticated) {
    this.authenticated = authenticated;
    if (authenticated) this.requestReplay();
  }

  requestReplay() {
    // An operation committed between the running pass's last outbox read and its
    // `running = false` would otherwise be orphaned in `pending` with no retry
    // scheduled, clearing only on the next unrelated dispatch. Remember the
    // request so replay() can pick it up before finishing.
    if (this.running) {
      this.replayRequestedWhileRunning = true;
      return;
    }
    if (!this.authenticated || !navigator.onLine) return;
    const replay = () => this.replay();
    if (navigator.locks?.request) {
      navigator.locks.request(`habits-sync:${this.ownerKey}`, { ifAvailable: true }, (lock) =>
        lock ? replay() : undefined
      );
    } else {
      replay();
    }
  }

  async replay() {
    if (this.running) return;
    this.running = true;
    this.replayRequestedWhileRunning = false;
    dispatch(Actions.setSyncStatus('syncing'));
    try {
      let operations = await listOutbox(this.ownerKey, ['pending', 'retry']);
      for (const operation of operations) {
        if (!this.authenticated || !navigator.onLine) break;
        if (operation.retryAt && operation.retryAt > Date.now()) {
          setTimeout(
            () => this.requestReplay(),
            Math.min(MAX_RETRY_DELAY, operation.retryAt - Date.now())
          );
          continue;
        }
        if (
          operation.dependsOnOperationId &&
          operations.some(
            (candidate) =>
              candidate.operationId === operation.dependsOnOperationId &&
              candidate.status !== 'superseded'
          )
        ) {
          continue;
        }
        await this.replayOne(operation);
        operations = await listOutbox(this.ownerKey, ['pending', 'retry']);
      }
      const remaining = await listOutbox(this.ownerKey);
      dispatch(
        Actions.setSyncStatus(
          remaining.some((operation) => operation.status === 'conflict')
            ? 'conflict'
            : remaining.length
              ? 'pending'
              : 'synced'
        )
      );
      this.channel?.postMessage({ type: 'replay-complete' });
    } finally {
      this.running = false;
    }

    // Pick up anything committed while this pass was in flight. Deferred to a
    // macrotask because replay() runs as the navigator.locks callback and the
    // lock is only released once its promise settles — requesting again inline
    // would fail the ifAvailable check and silently drop the work.
    if (this.replayRequestedWhileRunning) {
      this.replayRequestedWhileRunning = false;
      setTimeout(() => this.requestReplay(), 0);
    }
  }

  async replayOne(operation) {
    await patchOutboxOperation(operation.operationId, { status: 'syncing' });
    try {
      const payload = sanitizeMutationPayload(operation.mutationName, operation.payload);
      const attemptedRecord = sanitizeOperationRecord(
        operation.entityType,
        operation.attemptedRecord
      );
      await patchOutboxOperation(operation.operationId, { payload, attemptedRecord });
      operation = { ...operation, payload, attemptedRecord };
      const result = await this.client.mutation(functionReference(operation.mutationName), {
        operationId: operation.operationId,
        deviceId: this.deviceId,
        baseRevision: operation.baseRecord?.revision,
        baseRecord: operation.baseRecord,
        payload,
      });
      if (result.status === 'applied' || result.status === 'duplicate') {
        await confirmOperation(operation.operationId, result.canonicalRecord);
        const runtime = getCloudRuntime();
        if (runtime && operation.entityType === 'userPreferences' && result.canonicalRecord) {
          runtime.preferences = result.canonicalRecord;
        }
        if (runtime && operation.entityType.endsWith('.order')) {
          const collection = operation.payload.collection;
          runtime.collectionRevisions = {
            ...(runtime.collectionRevisions || {}),
            [collection]: result.revision,
          };
          await putSyncMetadata(this.ownerKey, {
            collectionRevisions: runtime.collectionRevisions,
          });
        }
        dispatch(
          Actions.confirmOperation({
            operationId: operation.operationId,
            entityType: operation.entityType,
            canonicalRecord: result.canonicalRecord,
          })
        );
        return;
      }
      if (result.status === 'conflict') {
        await this.autoMergeConflict(operation, result.conflict);
      }
    } catch (error) {
      const retryCount = (operation.retryCount || 0) + 1;
      await patchOutboxOperation(operation.operationId, {
        status: 'retry',
        retryCount,
        retryAt: Date.now() + retryDelay(retryCount),
        lastError: String(error?.message || error),
      });
      setTimeout(() => this.requestReplay(), retryDelay(retryCount));
    }
  }

  async autoMergeConflict(operation, conflict) {
    const merge = threeWayMerge(
      operation.baseRecord,
      conflict.serverRecord,
      operation.attemptedRecord
    );
    if (merge.conflictingFields.length) {
      await patchOutboxOperation(operation.operationId, {
        status: 'conflict',
        conflict: { ...conflict, conflictingFields: merge.conflictingFields },
      });
      return;
    }
    const replacementId = generateUuid();
    await patchOutboxOperation(operation.operationId, {
      status: 'superseded',
      supersededBy: replacementId,
    });
    await commitOptimisticOperation({
      operation: {
        ...operation,
        operationId: replacementId,
        status: undefined,
        createdAt: Date.now(),
      },
      confirmedBase: conflict.serverRecord,
      optimisticEntity: merge.mergedRecord,
    });
  }

  async resolveOperationConflict(operationId, resolution) {
    const operation = (await listOutbox(this.ownerKey, ['conflict'])).find(
      (item) => item.operationId === operationId
    );
    if (!operation) throw new Error('Conflict operation no longer exists');
    if (resolution === 'keep_server' || resolution === 'keep_deleted') {
      await confirmOperation(operationId, operation.conflict?.serverRecord || null);
      dispatch(
        Actions.confirmOperation({
          operationId,
          entityType: operation.entityType,
          canonicalRecord: operation.conflict?.serverRecord || null,
        })
      );
      this.requestReplay();
      return;
    }
    if (resolution === 'apply_local' || resolution === 'restore_local') {
      const replacementId = generateUuid();
      await patchOutboxOperation(operationId, {
        status: 'superseded',
        supersededBy: replacementId,
      });
      await commitOptimisticOperation({
        operation: {
          ...operation,
          operationId: replacementId,
          status: undefined,
          conflict: undefined,
          createdAt: Date.now(),
        },
        confirmedBase: operation.conflict?.serverRecord || null,
        optimisticEntity:
          operation.attemptedRecord || operation.conflict?.attemptedRecord || null,
      });
      this.requestReplay();
      return;
    }
    throw new Error(`Unsupported conflict resolution: ${resolution}`);
  }

  close() {
    this.channel?.close();
    window.removeEventListener('online', this.handleOnline);
  }
}
