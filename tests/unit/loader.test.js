import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  document.documentElement.className = '';
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  setHidden(false);
  // The reveal promise is cached per module instance.
  vi.resetModules();
});

/**
 * Overrides document.hidden, which jsdom always reports as false.
 * @param {boolean} hidden Whether the page should report itself as hidden.
 * @returns {void}
 */
function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
}

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

  it('reveals a hidden page without waiting for a paint', async () => {
    // A page loaded in a background tab: requestAnimationFrame is never called
    // back. Waiting on it left the loading screen up for as long as the tab
    // stayed hidden, and held back everything main.js does afterwards.
    vi.stubGlobal('requestAnimationFrame', () => 0);
    setHidden(true);
    document.body.innerHTML = '<div id="app-loading-screen" class="loading-screen"></div>';

    const { removeLoadingState } = await import('../../src/shared/loader.js');
    await removeLoadingState();

    expect(document.getElementById('app-loading-screen')).toBeNull();
    expect(document.documentElement.classList.contains('app-ready')).toBe(true);
    expect(document.documentElement.classList.contains('js-loading')).toBe(false);
  });

  it('gives up on a paint that never arrives on a visible page', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('requestAnimationFrame', () => 0);
      setHidden(false);
      document.body.innerHTML = '<div id="app-loading-screen" class="loading-screen"></div>';

      const { removeLoadingState } = await import('../../src/shared/loader.js');
      const reveal = removeLoadingState();
      await vi.advanceTimersByTimeAsync(1000);
      await reveal;

      expect(document.getElementById('app-loading-screen')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('hands the same promise to every caller', async () => {
    setHidden(true);
    const { removeLoadingState } = await import('../../src/shared/loader.js');
    expect(removeLoadingState()).toBe(removeLoadingState());
    await removeLoadingState();
  });
});
