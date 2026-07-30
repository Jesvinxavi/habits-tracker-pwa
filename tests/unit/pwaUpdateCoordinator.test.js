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
