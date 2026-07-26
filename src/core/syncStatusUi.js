import { getState, subscribe } from './state.js';

const PRESENTATIONS = {
  synced: {
    label: 'Synced',
    summary: 'Your changes are safely stored in the cloud.',
    tone: 'success',
  },
  syncing: {
    label: 'Syncing',
    summary: 'Sending your latest changes to the cloud.',
    tone: 'progress',
  },
  offline: {
    label: 'Offline',
    summary: 'Changes will stay on this device until you reconnect.',
    tone: 'warning',
  },
  pending: {
    label: 'Pending changes',
    summary: 'Some changes are waiting to be synced.',
    tone: 'warning',
  },
  conflict: {
    label: 'Needs attention',
    summary: 'One or more changes need your review.',
    tone: 'danger',
  },
  failed: {
    label: 'Sync failed',
    summary: 'Your changes remain on this device. Try syncing again.',
    tone: 'danger',
  },
  migration_required: {
    label: 'Migration required',
    summary: 'Review your existing device data before cloud sync begins.',
    tone: 'warning',
  },
};

let storageErrorMessage = '';
let unsubscribeState;

export function getSyncStatusPresentation(status = getState().syncStatus) {
  return (
    PRESENTATIONS[status] || {
      label: 'Preparing sync',
      summary: 'Setting up secure cloud sync for this device.',
      tone: 'progress',
    }
  );
}

export function updateSyncStatusUi() {
  const presentation = getSyncStatusPresentation();
  document.querySelectorAll('[data-sync-status]').forEach((element) => {
    element.textContent = presentation.label;
    element.dataset.tone = presentation.tone;
  });
  document.querySelectorAll('[data-sync-summary]').forEach((element) => {
    element.textContent = storageErrorMessage || presentation.summary;
  });
}

export function initializeSyncStatusUi() {
  unsubscribeState?.();
  updateSyncStatusUi();
  unsubscribeState = subscribe(updateSyncStatusUi);
  window.addEventListener('persistence-storage-error', (event) => {
    storageErrorMessage = `Local storage failed: ${event.detail.message}`;
    updateSyncStatusUi();
  });
  return unsubscribeState;
}
