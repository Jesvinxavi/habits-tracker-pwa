/**
 * installPrompt.js – Handles the PWA "Add to Home Screen" banner using the
 * `beforeinstallprompt` event available on Chromium browsers.
 *
 * The banner is built lazily (only when the event fires) and destroyed after
 * installation or dismissal to avoid persistent DOM clutter.
 */

let deferredPrompt = null;

/**
 * Injects a small bottom-sheet banner asking the user if they'd like to install
 * the app. Builds the element only once and attaches the required listeners.
 */
function showInstallBanner() {
  if (document.getElementById('install-banner')) return; // already visible

  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.className =
    'fixed inset-x-4 bottom-4 md:inset-x-auto md:right-4 md:bottom-4 z-50 ' +
    'flex items-center justify-between gap-4 px-4 py-3 rounded-xl shadow-lg ' +
    'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700';

  const text = document.createElement('span');
  text.className = 'text-sm font-medium text-gray-900 dark:text-gray-100';
  text.textContent = 'Add Healthy Habits Tracker to your Home Screen?';

  const actions = document.createElement('div');
  actions.className = 'flex items-center gap-2';

  const installBtn = document.createElement('button');
  installBtn.id = 'install-btn';
  installBtn.className =
    'px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-ios-blue ' +
    'hover:bg-ios-blue/90 focus:outline-none focus:ring-2 focus:ring-ios-blue/50';
  installBtn.textContent = 'Install';

  const dismissBtn = document.createElement('button');
  dismissBtn.id = 'dismiss-install-btn';
  dismissBtn.className =
    'px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 ' +
    'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 ' +
    'focus:outline-none focus:ring-2 focus:ring-gray-400/50';
  dismissBtn.textContent = 'Not now';

  actions.appendChild(installBtn);
  actions.appendChild(dismissBtn);
  banner.appendChild(text);
  banner.appendChild(actions);
  document.body.appendChild(banner);

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    banner.remove();
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
    }
  });

  dismissBtn.addEventListener('click', () => {
    banner.remove();
    deferredPrompt = null;
  });
}

/**
 * Hides the currently visible banner, if any.
 */
function hideInstallBanner() {
  const el = document.getElementById('install-banner');
  if (el) el.remove();
}

/**
 * Public bootstrap called from main.js.
 */
export function initializeInstallPrompt() {
  // Safari/iOS never fires beforeinstallprompt – bail early on unsupported
  if (!('beforeinstallprompt' in window)) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default mini-infobar and store the event for later
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    deferredPrompt = null;
  });
}
