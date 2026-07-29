import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncEngine } from '../../src/core/syncEngine.js';

const outbox = [];
const confirmed = [];
const dispatched = [];
// Lets a test inject an operation at a chosen point inside a running replay pass.
const hooks = { onPendingRead: null };
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
 * Mimics the browser Web Locks API: the lock is held until the callback's
 * promise settles, and an ifAvailable request made while it is held is refused.
 * @returns {{request: Function, held: () => boolean, refusals: () => number}} Lock double.
 */
function createLockManager() {
  let held = false;
  let refusals = 0;
  return {
    held: () => held,
    refusals: () => refusals,
    request: async (name, options, callback) => {
      if (held && options?.ifAvailable) {
        refusals += 1;
        return callback(null);
      }
      held = true;
      try {
        return await callback({ name });
      } finally {
        held = false;
      }
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
  return new SyncEngine({
    ownerKey: 'owner',
    generation: 1,
    deviceId: 'device',
    client,
  });
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
    // The real browser path: replay() runs as the navigator.locks callback, so a
    // follow-up requested before the lock is released is refused outright.
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
});
