import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  document.documentElement.className = '';
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('application loader handoff', () => {
  it('keeps the loader in front until the ready app has painted', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback) =>
      setTimeout(() => callback(performance.now()), 0)
    );
    document.body.innerHTML = `
      <div id="app-loading-screen" class="loading-screen"></div>
      <div class="app-container"></div>
    `;

    const { removeLoadingState } = await import('../../src/shared/loader.js');
    const reveal = removeLoadingState();

    expect(document.documentElement.classList.contains('js-loading')).toBe(true);
    expect(document.getElementById('app-loading-screen')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(document.documentElement.classList.contains('js-loading')).toBe(false);
    expect(document.documentElement.classList.contains('app-ready')).toBe(true);
    expect(document.getElementById('app-loading-screen')).not.toBeNull();
    expect(
      document.getElementById('app-loading-screen').classList.contains('is-leaving')
    ).toBe(true);

    await vi.advanceTimersByTimeAsync(140);
    await reveal;

    expect(document.getElementById('app-loading-screen')).toBeNull();
  });
});
