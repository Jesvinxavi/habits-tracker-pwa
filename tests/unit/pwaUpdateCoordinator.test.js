import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listOutbox } = vi.hoisted(() => ({
  listOutbox: vi.fn(async () => []),
}));

vi.mock('../../src/core/offlineDb.js', () => ({ listOutbox }));

import {
  initializePwaUpdateCoordinator,
  resetPwaUpdateCoordinatorForTests,
} from '../../src/components/PwaUpdateCoordinator.js';
import { clearCloudRuntime, setCloudRuntime } from '../../src/core/cloudRuntime.js';

class ServiceWorkerContainerDouble extends EventTarget {}

class BroadcastChannelDouble {
  constructor() {
    this.onmessage = null;
  }

  postMessage() {}

  close() {}
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('PWA update coordinator', () => {
  let serviceWorker;

  beforeEach(() => {
    document.body.innerHTML = '';
    serviceWorker = new ServiceWorkerContainerDouble();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: serviceWorker,
    });
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    vi.stubGlobal('BroadcastChannel', BroadcastChannelDouble);
    listOutbox.mockResolvedValue([]);
  });

  afterEach(() => {
    resetPwaUpdateCoordinatorForTests();
    clearCloudRuntime();
    vi.unstubAllGlobals();
  });

  it('waits for explicit confirmation before activating a worker', async () => {
    const update = vi.fn(async () => {});
    let callbacks;
    await initializePwaUpdateCoordinator({
      register: (options) => {
        callbacks = options;
        return update;
      },
    });

    callbacks.onNeedRefresh();
    await settle();
    const button = document.querySelector('[data-apply-update]');
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(false);

    button.click();
    await settle();
    expect(update).toHaveBeenCalledWith(true);
  });

  it('blocks activation while an editor is open', async () => {
    const update = vi.fn(async () => {});
    let callbacks;
    await initializePwaUpdateCoordinator({
      register: (options) => {
        callbacks = options;
        return update;
      },
    });
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);

    callbacks.onNeedRefresh();
    await settle();
    const button = document.querySelector('[data-apply-update]');
    expect(button.disabled).toBe(true);
    expect(document.querySelector('[data-update-summary]').textContent).toContain(
      'open editor'
    );
    button.click();
    await settle();
    expect(update).not.toHaveBeenCalled();
  });

  it('blocks activation while durable operations are pending', async () => {
    setCloudRuntime({ ownerKey: 'owner', syncEngine: { close() {} } });
    listOutbox.mockResolvedValue([{ operationId: 'pending', status: 'pending' }]);
    let callbacks;
    await initializePwaUpdateCoordinator({
      register: (options) => {
        callbacks = options;
        return vi.fn(async () => {});
      },
    });

    callbacks.onNeedRefresh();
    await settle();
    expect(document.querySelector('[data-apply-update]').disabled).toBe(true);
    expect(document.querySelector('[data-update-summary]').textContent).toContain(
      'pending changes'
    );
  });

  it.each([['retry'], ['syncing']])(
    'blocks activation while a %s operation is durable',
    async (status) => {
      setCloudRuntime({ ownerKey: 'owner', syncEngine: { close() {} } });
      listOutbox.mockResolvedValue([{ operationId: 'op', status }]);
      const update = vi.fn(async () => {});
      let callbacks;
      await initializePwaUpdateCoordinator({
        register: (options) => {
          callbacks = options;
          return update;
        },
      });

      callbacks.onNeedRefresh();
      await settle();
      const button = document.querySelector('[data-apply-update]');
      expect(button.disabled).toBe(true);
      expect(document.querySelector('[data-update-summary]').textContent).toContain(
        'pending changes'
      );

      button.click();
      await settle();
      expect(update).not.toHaveBeenCalled();
    }
  );

  // Conflict is the one durable state the user cannot clear by waiting, so it
  // gets its own message rather than the "let it finish syncing" wording.
  it('blocks activation with distinct messaging while a conflict is unresolved', async () => {
    setCloudRuntime({ ownerKey: 'owner', syncEngine: { close() {} } });
    listOutbox.mockResolvedValue([
      { operationId: 'settled', status: 'syncing' },
      { operationId: 'clashing', status: 'conflict' },
    ]);
    const update = vi.fn(async () => {});
    let callbacks;
    await initializePwaUpdateCoordinator({
      register: (options) => {
        callbacks = options;
        return update;
      },
    });

    callbacks.onNeedRefresh();
    await settle();
    const button = document.querySelector('[data-apply-update]');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    const summary = document.querySelector('[data-update-summary]').textContent;
    expect(summary).toContain('conflicts');
    expect(summary).not.toContain('pending changes');

    button.click();
    await settle();
    expect(update).not.toHaveBeenCalled();
  });

  // A blocked banner must not stay blocked: nothing re-shows it once the work
  // clears, so its own poll is the only path back to an enabled button.
  it('re-enables activation once the blocking work clears', async () => {
    setCloudRuntime({ ownerKey: 'owner', syncEngine: { close() {} } });
    listOutbox.mockResolvedValue([{ operationId: 'clashing', status: 'conflict' }]);
    const update = vi.fn(async () => {});
    let callbacks;
    await initializePwaUpdateCoordinator({
      register: (options) => {
        callbacks = options;
        return update;
      },
    });

    // The poll interval has to be created under fake timers to be advanceable,
    // so switch before the banner exists rather than after.
    vi.useFakeTimers();
    try {
      callbacks.onNeedRefresh();
      await settle();
      expect(document.querySelector('[data-apply-update]').disabled).toBe(true);

      listOutbox.mockResolvedValue([]);
      await vi.advanceTimersByTimeAsync(2000);
      await settle();

      const button = document.querySelector('[data-apply-update]');
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-disabled')).toBe('false');
      expect(document.querySelector('[data-update-summary]').textContent).toContain(
        'new version is ready'
      );

      button.click();
      await settle();
    } finally {
      vi.useRealTimers();
    }
    expect(update).toHaveBeenCalledWith(true);
  });

  it('blocks activation while the client is offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    let callbacks;
    await initializePwaUpdateCoordinator({
      register: (options) => {
        callbacks = options;
        return vi.fn(async () => {});
      },
    });

    callbacks.onNeedRefresh();
    await settle();
    expect(document.querySelector('[data-apply-update]').disabled).toBe(true);
    expect(document.querySelector('[data-update-summary]').textContent).toContain(
      'Reconnect'
    );
  });
});
