import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearCloudRuntime,
  getCloudRuntime,
  setCloudRuntime,
} from '../../src/core/cloudRuntime.js';

afterEach(() => {
  clearCloudRuntime();
});

describe('cloud runtime lifecycle', () => {
  it('closes queued work, subscriptions, and sync before clearing an account', () => {
    const events = [];
    const runtime = {
      remoteQueue: { close: vi.fn(() => events.push('queue')) },
      subscriptionUnsubscribers: [
        vi.fn(() => events.push('subscription-a')),
        vi.fn(() => events.push('subscription-b')),
      ],
      syncEngine: { close: vi.fn(() => events.push('sync')) },
    };
    setCloudRuntime(runtime);

    clearCloudRuntime();

    expect(events).toEqual([
      'queue',
      'subscription-a',
      'subscription-b',
      'sync',
    ]);
    expect(getCloudRuntime()).toBeUndefined();
  });

  it('disposes the previous runtime before replacing it', () => {
    const close = vi.fn();
    setCloudRuntime({ syncEngine: { close } });

    const replacement = { ownerKey: 'replacement' };
    setCloudRuntime(replacement);

    expect(close).toHaveBeenCalledOnce();
    expect(getCloudRuntime()).toBe(replacement);
  });
});
