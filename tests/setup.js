import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
});

export function installDeterministicRuntime({
  now = '2025-01-15T12:00:00.000Z',
  uuid = '00000000-0000-4000-8000-000000000001',
} = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: () => uuid });
}
