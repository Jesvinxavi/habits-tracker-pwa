import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertTestHarnessConfiguration,
  isTestHarnessEnabled,
} from '../../src/core/testHarness.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('test harness runtime flag', () => {
  it('is disabled unless VITE_TEST_HARNESS is explicitly enabled', () => {
    vi.stubEnv('VITE_TEST_HARNESS', '');
    expect(isTestHarnessEnabled()).toBe(false);
  });

  it('rejects a production build that tries to enable the harness', () => {
    vi.stubEnv('VITE_TEST_HARNESS', '1');
    vi.stubEnv('DEV', false);
    expect(assertTestHarnessConfiguration).toThrow(
      'VITE_TEST_HARNESS=1 is only permitted by the development server or explicit PWA test build.'
    );
  });

  it('is accepted by the development server without a backend switch', () => {
    vi.stubEnv('VITE_TEST_HARNESS', '1');
    vi.stubEnv('DEV', true);
    expect(assertTestHarnessConfiguration()).toBeUndefined();
    expect(isTestHarnessEnabled()).toBe(true);
  });

  it('is accepted by the explicit production-like PWA test build', () => {
    vi.stubEnv('VITE_TEST_HARNESS', '1');
    vi.stubEnv('VITE_PWA_TEST', '1');
    vi.stubEnv('DEV', false);
    expect(assertTestHarnessConfiguration()).toBeUndefined();
    expect(isTestHarnessEnabled()).toBe(true);
  });
});
