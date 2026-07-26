// Initialize loading state
document.documentElement.classList.add('js-loading');

let revealPromise;

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

// A slow connection should keep showing the branded loader instead of
// exposing the unhydrated HTML shell.
setTimeout(() => {
  if (document.documentElement.classList.contains('js-loading')) {
    console.warn('App initialization is taking longer than expected');
    const loadingText = document.querySelector('#app-loading-screen p');
    if (loadingText) loadingText.textContent = 'Still loading your habits...';
  }
}, 10000);

// Reveal the fully rendered app underneath the loader, allow that state to
// paint, and only then fade the loader away.
export function removeLoadingState() {
  if (!revealPromise) {
    revealPromise = (async () => {
      await nextPaint();
      await nextPaint();

      const loadingScreen = document.getElementById('app-loading-screen');

      // The loader is still opaque when the hydrated application becomes
      // visible, so the static template can never flash between the two.
      document.documentElement.classList.add('app-ready');
      document.documentElement.classList.remove('js-loading');
      await nextPaint();

      if (loadingScreen) {
        loadingScreen.classList.add('is-leaving');
        await new Promise((resolve) => setTimeout(resolve, 140));
        loadingScreen.remove();
      }
    })();
  }

  return revealPromise;
}
