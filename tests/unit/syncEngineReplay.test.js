import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine } from '../../src/core/syncEngine.js';

const outbox = [];
const confirmed = [];
const dispatched = [];
// Lets a test inject an operation at a chosen point inside a running replay pass.
const hooks = { onPendingRead: null };
const engines = [];
let pendingReads = 0;

vi.mock('../../src/core/convexClient.js', () => ({
  functionReference: (name) => name,
  getConvexClient: () => ({ mutation: async () => ({ status: 'applied', revision: 1 }) }),
}));

vi.mock('../../src/core/offlineDb.js', () => ({
  commitOptimisticOperation: vi.fn(),
  confirmOperation: vi.fn(async (operationId) => {
    confirmed.push(operationId);
    const index = outbox.findIndex((item) => item.operationId === operationId);
    if (index === -1) return { confirmed: false, hasPendingSuccessor: false };
    const operation = outbox[index];
    const hasPendingSuccessor = outbox.some(
      (item) =>
        item.operationId !== operationId &&
        item.entityType === operation.entityType &&
        item.clientId === operation.clientId &&
        ['pending', 'retry', 'syncing', 'conflict'].includes(item.status)
    );
    outbox.splice(index, 1);
    return { confirmed: true, hasPendingSuccessor };
  }),
  listOutbox: vi.fn(async (ownerKey, statuses) => {
    if (!statuses) return [...outbox];
    const result = outbox.filter((item) => statuses.includes(item.status));
    pendingReads += 1;
    // Fire after computing the result, so the injected operation is invisible to
    // this read but present for the tail of the pass — the exact race window.
    hooks.onPendingRead?.(pendingReads);
    return result;
  }),
  patchOutboxOperation: vi.fn(async (operationId, patch) => {
    const entry = outbox.find((item) => item.operationId === operationId);
    if (entry) Object.assign(entry, patch);
  }),
  putSyncMetadata: vi.fn(),
}));

vi.mock('../../src/core/cloudRuntime.js', () => ({ getCloudRuntime: () => null }));
vi.mock('../../src/core/state.js', () => ({
  dispatch: vi.fn((action) => dispatched.push(action)),
  Actions: {
    setSyncStatus: (status) => ({ type: 'SET_SYNC_STATUS', payload: status }),
    confirmOperation: (payload) => ({ type: 'CONFIRM_OPERATION', payload }),
  },
}));

/**
 * Mimics the browser Web Locks API: requests queue and each lock is held until
 * its callback's promise settles.
 * @returns {{request: Function, held: () => boolean}} Lock double.
 */
function createLockManager() {
  let held = false;
  let tail = Promise.resolve();
  return {
    held: () => held,
    request: (name, optionsOrCallback, maybeCallback) => {
      const callback =
        typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
      const run = async () => {
        held = true;
        try {
          return await callback({ name });
        } finally {
          held = false;
        }
      };
      const result = tail.then(run);
      tail = result.catch(() => {});
      return result;
    },
  };
}

function queue(operationId, overrides = {}) {
  outbox.push({
    operationId,
    ownerKey: 'owner',
    generation: 1,
    entityType: 'activityRecords',
    clientId: operationId,
    mutationName: 'activityRecords:create',
    payload: { clientId: operationId },
    status: 'pending',
    retryCount: 0,
    ...overrides,
  });
}

function createEngine(client = { mutation: async () => ({ status: 'applied', revision: 1 }) }) {
  const engine = new SyncEngine({
    ownerKey: 'owner',
    generation: 1,
    deviceId: 'device',
    client,
  });
  engines.push(engine);
  return engine;
}

async function settle(ticks = 12) {
  for (let i = 0; i < ticks; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('SyncEngine replay coalescing', () => {
  beforeEach(() => {
    outbox.length = 0;
    confirmed.length = 0;
    dispatched.length = 0;
    pendingReads = 0;
    hooks.onPendingRead = null;
  });

  afterEach(() => {
    engines.splice(0).forEach((engine) => engine.close());
    vi.unstubAllGlobals();
  });

  it('drains an operation that lands after the final outbox read', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const engine = createEngine();
    queue('first');

    // The loop's second pending read returns empty; the operation arrives right
    // after it, so only a post-pass follow-up can pick it up.
    hooks.onPendingRead = (call) => {
      if (call !== 2) return;
      queue('second');
      engine.requestReplay();
    };

    engine.requestReplay();
    await settle();

    expect(confirmed).toEqual(['first', 'second']);
    expect(outbox).toHaveLength(0);
  });

  it('drains it even when Web Locks serialise replay', async () => {
    // The real browser path: replay() runs as the navigator.locks callback.
    const locks = createLockManager();
    vi.stubGlobal('navigator', { onLine: true, locks });
    const engine = createEngine();
    queue('first');

    hooks.onPendingRead = (call) => {
      if (call !== 2) return;
      queue('second');
      engine.requestReplay();
    };

    engine.requestReplay();
    await settle();

    expect(confirmed).toEqual(['first', 'second']);
    expect(outbox).toHaveLength(0);
    expect(locks.held()).toBe(false);
  });

  it('waits behind another tab instead of dropping the replay request', async () => {
    const locks = createLockManager();
    vi.stubGlobal('navigator', { onLine: true, locks });
    let releaseOtherTab;
    const otherTab = locks.request('habits-sync:owner', async () => {
      await new Promise((resolve) => {
        releaseOtherTab = resolve;
      });
    });
    const engine = createEngine();
    queue('waiting-write');

    engine.requestReplay();
    await settle(2);
    expect(confirmed).toEqual([]);

    releaseOtherTab();
    await otherTab;
    await settle();
    expect(confirmed).toEqual(['waiting-write']);
    expect(outbox).toHaveLength(0);
  });

  it('re-checks authentication after acquiring a queued lock', async () => {
    const locks = createLockManager();
    vi.stubGlobal('navigator', { onLine: true, locks });
    let releaseOtherTab;
    const otherTab = locks.request('habits-sync:owner', async () => {
      await new Promise((resolve) => {
        releaseOtherTab = resolve;
      });
    });
    await settle(1);
    const mutation = vi.fn(async () => ({ status: 'applied', revision: 1 }));
    const engine = createEngine({ mutation });
    queue('signed-out-write');

    engine.requestReplay();
    engine.setAuthenticated(false);
    releaseOtherTab();
    await otherTab;
    await settle();

    expect(mutation).not.toHaveBeenCalled();
    expect(outbox).toHaveLength(1);
    engine.close();
  });

  it('aborts a queued lock on close without using the no-lock fallback', async () => {
    let queuedSignal;
    const locks = {
      request: vi.fn((name, options) => {
        queuedSignal = options.signal;
        return new Promise((resolve, reject) => {
          queuedSignal.addEventListener(
            'abort',
            () => {
              const error = new Error('Lock request aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true }
          );
        });
      }),
    };
    vi.stubGlobal('navigator', { onLine: true, locks });
    const mutation = vi.fn(async () => ({ status: 'applied', revision: 1 }));
    const engine = createEngine({ mutation });
    queue('queued-on-close');

    engine.requestReplay();
    await settle(1);
    engine.close();
    await settle(2);

    expect(queuedSignal.aborted).toBe(true);
    expect(mutation).not.toHaveBeenCalled();
    expect(outbox).toHaveLength(1);
    expect(engine.retryTimers.size).toBe(0);
  });

  it('lets a peer tab service a broadcast replay request without rebroadcasting', async () => {
    const peers = [];
    const posts = [];
    class TestBroadcastChannel {
      constructor(name) {
        this.name = name;
        this.onmessage = null;
        peers.push(this);
      }

      postMessage(data) {
        posts.push(data);
        peers
          .filter((peer) => peer !== this && peer.name === this.name)
          .forEach((peer) => queueMicrotask(() => peer.onmessage?.({ data })));
      }

      close() {
        const index = peers.indexOf(this);
        if (index >= 0) peers.splice(index, 1);
      }
    }
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
    vi.stubGlobal('navigator', { onLine: true, locks: createLockManager() });
    const originMutation = vi.fn(async () => ({ status: 'applied', revision: 1 }));
    const peerMutation = vi.fn(async () => ({ status: 'applied', revision: 1 }));
    const origin = createEngine({ mutation: originMutation });
    createEngine({ mutation: peerMutation });
    origin.setAuthenticated(false);
    queue('peer-write');

    origin.requestReplay();
    await settle();

    expect(originMutation).not.toHaveBeenCalled();
    expect(peerMutation).toHaveBeenCalledTimes(1);
    expect(confirmed).toEqual(['peer-write']);
    expect(posts).toEqual([{ type: 'replay-requested' }]);
  });

  it('falls back safely when the Web Locks implementation rejects', async () => {
    vi.stubGlobal('navigator', {
      onLine: true,
      locks: {
        request: vi.fn(async () => {
          throw new Error('Locks unavailable');
        }),
      },
    });
    const engine = createEngine();
    queue('fallback-write');

    engine.requestReplay();
    await settle();

    expect(confirmed).toEqual(['fallback-write']);
    expect(outbox).toHaveLength(0);
  });

  it('recovers an operation left syncing by a terminated tab', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const engine = createEngine();
    queue('abandoned-write', { status: 'syncing' });

    await engine.replay();

    expect(confirmed).toEqual(['abandoned-write']);
    expect(outbox).toHaveLength(0);
  });

  it('does not schedule a redundant pass when nothing arrived', async () => {
    vi.stubGlobal('navigator', { onLine: true, locks: createLockManager() });
    const engine = createEngine();
    queue('only');

    engine.requestReplay();
    await settle();

    expect(confirmed).toEqual(['only']);
    expect(engine.replayRequestedWhileRunning).toBe(false);
  });

  it('does not repaint a newer optimistic habit entry with a stale confirmation', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    queue('skip', {
      entityType: 'habitEntries',
      clientId: 'habit-entry:walk:2026-07-30',
      mutationName: 'habitEntries:setDesiredState',
      payload: { skipped: true },
    });
    queue('restore', {
      entityType: 'habitEntries',
      clientId: 'habit-entry:walk:2026-07-30',
      mutationName: 'habitEntries:setDesiredState',
      payload: { skipped: false },
      dependsOnOperationId: 'skip',
    });
    const mutation = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'applied',
        canonicalRecord: { clientId: 'habit-entry:walk:2026-07-30', skipped: true },
      })
      .mockResolvedValueOnce({
        status: 'applied',
        canonicalRecord: { clientId: 'habit-entry:walk:2026-07-30', skipped: false },
      });
    const engine = createEngine({ mutation });

    await engine.replay();

    const confirmations = dispatched.filter((action) => action.type === 'CONFIRM_OPERATION');
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0].payload.canonicalRecord.skipped).toBe(false);
  });

  it('clears retry timers and cannot restart after close', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-07-30T12:00:00.000Z'));
      vi.stubGlobal('navigator', { onLine: true });
      const mutation = vi.fn(async () => ({ status: 'applied', revision: 1 }));
      const engine = createEngine({ mutation });
      queue('future-retry', {
        status: 'retry',
        retryAt: Date.now() + 5000,
      });

      await engine.replay();
      expect(engine.retryTimers.size).toBe(1);
      engine.close();
      expect(engine.retryTimers.size).toBe(0);

      await vi.advanceTimersByTimeAsync(60000);
      expect(mutation).not.toHaveBeenCalled();
      expect(outbox).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
