import { getCloudRuntime } from '../core/cloudRuntime.js';
import { listOutbox } from '../core/offlineDb.js';

const BLOCKING_OUTBOX_STATUSES = ['pending', 'retry', 'syncing', 'conflict'];
const CHANNEL_NAME = 'habits-app-update';

let pendingUpdate = null;
let readinessTimer = null;
let reloadOnControllerChange = false;
let updateChannel = null;
let initialized = false;

function visibleCriticalSurface() {
  return Boolean(
    document.querySelector(
      '.modal-overlay:not(.hidden), dialog[open], [data-block-app-update="true"]'
    )
  );
}

async function updateBlocker() {
  if (visibleCriticalSurface()) {
    return 'Finish or close the open editor before updating.';
  }
  if (navigator.onLine === false) {
    return 'Reconnect before updating so the new version can open safely.';
  }
  const runtime = getCloudRuntime();
  if (!runtime?.ownerKey) return '';
  const operations = await listOutbox(runtime.ownerKey, BLOCKING_OUTBOX_STATUSES);
  if (!operations.length) return '';
  if (operations.some((operation) => operation.status === 'conflict')) {
    return 'Resolve sync conflicts before updating.';
  }
  return 'Let pending changes finish syncing before updating.';
}

function removeUpdateBanner() {
  document.getElementById('update-banner')?.remove();
  if (readinessTimer) {
    clearInterval(readinessTimer);
    readinessTimer = null;
  }
}

async function refreshBannerState() {
  const banner = document.getElementById('update-banner');
  if (!banner || !pendingUpdate) return;
  const blocker = await updateBlocker();
  const summary = banner.querySelector('[data-update-summary]');
  const button = banner.querySelector('[data-apply-update]');
  if (summary) {
    summary.textContent = blocker || 'A new version is ready.';
  }
  if (button) {
    button.disabled = Boolean(blocker);
    button.setAttribute('aria-disabled', blocker ? 'true' : 'false');
    button.classList.toggle('opacity-50', Boolean(blocker));
    button.classList.toggle('cursor-not-allowed', Boolean(blocker));
  }
}

function showUpdateBanner() {
  if (!pendingUpdate || document.getElementById('update-banner')) return;

  const banner = document.createElement('section');
  banner.id = 'update-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.className =
    'fixed inset-x-4 bottom-4 md:inset-x-auto md:right-4 z-[1100] ' +
    'max-w-md rounded-2xl border border-gray-300 dark:border-gray-600 ' +
    'bg-white dark:bg-gray-800 p-4 shadow-2xl';
  banner.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="material-icons text-ios-blue" aria-hidden="true">system_update</span>
      <div class="min-w-0 flex-1">
        <h2 class="font-semibold text-gray-900 dark:text-white">Update available</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-300" data-update-summary>
          Checking whether it is safe to update…
        </p>
        <div class="mt-3 flex justify-end gap-2">
          <button type="button" class="rounded-lg px-3 py-2 text-sm font-medium
            text-gray-700 dark:text-gray-200" data-dismiss-update>Later</button>
          <button type="button" class="rounded-lg bg-ios-blue px-3 py-2 text-sm
            font-semibold text-white" data-apply-update disabled>Update now</button>
        </div>
      </div>
    </div>
  `;

  banner.querySelector('[data-dismiss-update]')?.addEventListener('click', () => {
    removeUpdateBanner();
  });
  banner.querySelector('[data-apply-update]')?.addEventListener('click', async () => {
    if (await updateBlocker()) {
      await refreshBannerState();
      return;
    }
    const applyUpdate = pendingUpdate;
    pendingUpdate = null;
    reloadOnControllerChange = true;
    updateChannel?.postMessage({ type: 'activate-update' });
    removeUpdateBanner();
    await applyUpdate(true);
  });

  document.body.appendChild(banner);
  void refreshBannerState();
  readinessTimer = setInterval(() => {
    void refreshBannerState();
  }, 2000);
}

/**
 * Registers the Pages service worker in prompt mode. A waiting worker is never
 * activated while durable operations or a critical editor are active.
 *
 * `register` is injectable so lifecycle behavior can be tested without a real
 * service worker.
 */
export async function initializePwaUpdateCoordinator({ register } = {}) {
  if (initialized || !('serviceWorker' in navigator)) return;
  initialized = true;

  const registerSW =
    register || (await import('virtual:pwa-register')).registerSW;
  let updateSW = async () => {};
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      pendingUpdate = (...args) => updateSW(...args);
      showUpdateBanner();
    },
    // Reload is coordinated for every open tab through controllerchange and
    // BroadcastChannel, rather than letting this one Workbox instance reload
    // independently.
    onNeedReload() {},
    onRegisterError(error) {
      console.warn('Service worker registration failed:', error);
    },
  });

  updateChannel =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(CHANNEL_NAME)
      : null;
  if (updateChannel) {
    updateChannel.onmessage = (event) => {
      if (event.data?.type === 'activate-update') {
        reloadOnControllerChange = true;
      }
    };
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadOnControllerChange) window.location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && pendingUpdate) {
      showUpdateBanner();
    }
  });
}

export function resetPwaUpdateCoordinatorForTests() {
  removeUpdateBanner();
  updateChannel?.close();
  updateChannel = null;
  pendingUpdate = null;
  reloadOnControllerChange = false;
  initialized = false;
}
