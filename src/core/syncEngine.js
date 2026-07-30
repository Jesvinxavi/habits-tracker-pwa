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
const ACTIVE_REPLAY_STATUSES = ['pending', 'retry', 'syncing', 'conflict'];

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
    this.closed = false;
    this.lockRequestPending = false;
    this.replayRequested = false;
    this.replayRequestedWhileRunning = false;
    this.retryTimers = new Set();
    this.lockAbortController =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    this.authenticated = true;
    this.channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(`habits-sync:${ownerKey}`)
        : null;
    if (this.channel) {
      this.channel.onmessage = (event) => {
        if (event.data?.type === 'replay-requested') this.requestReplay(false);
      };
    }
    this.handleOnline = () => {
      if (this.closed) return;
      if (this.authenticated) this.requestReplay();
      else window.location.reload();
    };
    window.addEventListener('online', this.handleOnline);
  }

  setAuthenticated(authenticated) {
    if (this.closed) return;
    this.authenticated = authenticated;
    if (authenticated) this.requestReplay();
  }

  canReplay() {
    return !this.closed && this.authenticated && navigator.onLine;
  }

  scheduleReplay(delay) {
    if (this.closed) return;
    const timer = setTimeout(() => {
      this.retryTimers.delete(timer);
      this.requestReplay();
    }, Math.max(0, Math.min(MAX_RETRY_DELAY, delay)));
    this.retryTimers.add(timer);
  }

  requestReplay(broadcast = true) {
    if (this.closed) return;
    this.replayRequested = true;
    if (broadcast) this.channel?.postMessage({ type: 'replay-requested' });
    if (this.running) {
      this.replayRequestedWhileRunning = true;
      return;
    }
    if (!this.canReplay() || this.lockRequestPending) return;
    void this.acquireReplayLock();
  }

  async acquireReplayLock() {
    if (this.lockRequestPending || !this.canReplay()) return;
    this.lockRequestPending = true;
    const replayIfCurrent = async () => {
      // Authentication, connectivity, or runtime ownership can change while a
      // queued cross-tab lock is waiting. Re-check only after acquisition.
      if (!this.canReplay()) return;
      this.replayRequested = false;
      await this.replay();
    };
    let lockCallbackRan = false;
    let replayFailed = false;
    const lockedReplay = async () => {
      lockCallbackRan = true;
      await replayIfCurrent();
    };
    try {
      if (navigator.locks?.request) {
        // This request intentionally queues. An ifAvailable request can silently
        // lose a write committed while another tab owns the replay lock.
        await navigator.locks.request(
          `habits-sync:${this.ownerKey}`,
          this.lockAbortController
            ? { signal: this.lockAbortController.signal }
            : {},
          lockedReplay
        );
      } else {
        // Operation IDs are server-idempotent, so concurrent legacy-browser tabs
        // can safely attempt the same durable operation.
        await replayIfCurrent();
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      // A broken Web Locks implementation must not strand the durable outbox.
      // Falling back can duplicate a request, but the operation ID makes that
      // duplicate harmless at the server boundary.
      if (navigator.locks?.request && !lockCallbackRan && this.canReplay()) {
        try {
          await replayIfCurrent();
        } catch (_) {
          replayFailed = true;
          this.replayRequested = true;
        }
      } else if (this.canReplay()) {
        replayFailed = true;
        this.replayRequested = true;
      }
    } finally {
      this.lockRequestPending = false;
      if (this.replayRequested && this.canReplay()) {
        this.scheduleReplay(replayFailed ? 1000 : 0);
      }
    }
  }

  async replay() {
    if (this.running || !this.canReplay()) return;
    this.running = true;
    this.replayRequestedWhileRunning = false;
    dispatch(Actions.setSyncStatus('syncing'));
    try {
      while (this.canReplay()) {
        this.replayRequested = false;
        this.replayRequestedWhileRunning = false;
        const operations = await listOutbox(this.ownerKey, ACTIVE_REPLAY_STATUSES);
        const activeById = new Set(operations.map((operation) => operation.operationId));
        const now = Date.now();
        let earliestRetryAt = Number.POSITIVE_INFINITY;
        const operation = operations.find((candidate) => {
          // A `syncing` row means the previous tab/process stopped before it
          // could durably confirm or retry. Replaying its operation ID is safe.
          if (!['pending', 'retry', 'syncing'].includes(candidate.status)) return false;
          if (
            candidate.status === 'retry' &&
            candidate.retryAt &&
            candidate.retryAt > now
          ) {
            earliestRetryAt = Math.min(earliestRetryAt, candidate.retryAt);
            return false;
          }
          return (
            !candidate.dependsOnOperationId ||
            !activeById.has(candidate.dependsOnOperationId)
          );
        });

        if (!operation) {
          // A request can arrive after listOutbox has taken its snapshot. Re-read
          // before declaring the durable queue drained.
          if (this.replayRequestedWhileRunning) continue;
          if (Number.isFinite(earliestRetryAt)) {
            this.scheduleReplay(earliestRetryAt - now);
          }
          break;
        }
        await this.replayOne(operation);
      }
      const remaining = await listOutbox(this.ownerKey, ACTIVE_REPLAY_STATUSES);
      if (!this.closed) {
        dispatch(
          Actions.setSyncStatus(
            remaining.some((operation) => operation.status === 'conflict')
              ? 'conflict'
              : remaining.length
                ? 'pending'
                : 'synced'
          )
        );
      }
    } finally {
      this.running = false;
    }
  }

  async replayOne(operation) {
    await patchOutboxOperation(operation.operationId, {
      status: 'syncing',
      syncingAt: Date.now(),
    });
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
        const confirmation = await confirmOperation(
          operation.operationId,
          result.canonicalRecord
        );
        const runtime = this.closed ? null : getCloudRuntime();
        const isCurrentRuntime = runtime?.ownerKey === this.ownerKey;
        if (
          isCurrentRuntime &&
          operation.entityType === 'userPreferences' &&
          result.canonicalRecord
        ) {
          runtime.preferences = result.canonicalRecord;
        }
        if (isCurrentRuntime && operation.entityType.endsWith('.order')) {
          const collection = operation.payload.collection;
          runtime.collectionRevisions = {
            ...(runtime.collectionRevisions || {}),
            [collection]: result.revision,
          };
          await putSyncMetadata(this.ownerKey, {
            collectionRevisions: runtime.collectionRevisions,
          });
        }
        // A newer optimistic write for this entity is already what the user sees.
        // Do not repaint it with this older confirmation while its successor waits.
        if (!this.closed && !confirmation?.hasPendingSuccessor) {
          dispatch(
            Actions.confirmOperation({
              operationId: operation.operationId,
              entityType: operation.entityType,
              canonicalRecord: result.canonicalRecord,
            })
          );
        }
        return;
      }
      if (result.status === 'conflict') {
        await this.autoMergeConflict(operation, result.conflict);
        return;
      }
      throw new Error(`Unsupported sync result: ${result.status || 'missing status'}`);
    } catch (error) {
      const retryCount = (operation.retryCount || 0) + 1;
      const delay = retryDelay(retryCount);
      await patchOutboxOperation(operation.operationId, {
        status: 'retry',
        retryCount,
        retryAt: Date.now() + delay,
        lastError: String(error?.message || error),
      });
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
    if (this.closed) return;
    this.closed = true;
    this.authenticated = false;
    this.replayRequested = false;
    this.replayRequestedWhileRunning = false;
    this.retryTimers.forEach((timer) => clearTimeout(timer));
    this.retryTimers.clear();
    this.lockAbortController?.abort();
    if (this.channel) this.channel.onmessage = null;
    this.channel?.close();
    window.removeEventListener('online', this.handleOnline);
  }
}
