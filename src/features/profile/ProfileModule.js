import { Actions, dispatch, getState, subscribe } from '../../core/state.js';
import {
  getAccountDisplayProfile,
  openAccountProfile,
  requestAccountSignOut,
} from '../../core/auth.js';
import {
  getSyncMetadata,
  listOutbox,
  readOfflineLease,
} from '../../core/offlineDb.js';
import { getActiveAccount } from '../../core/auth.js';
import { getCloudRuntime } from '../../core/cloudRuntime.js';
import {
  getSyncStatusPresentation,
  updateSyncStatusUi,
} from '../../core/syncStatusUi.js';
import { toggleTheme } from '../../core/theme.js';
import { shallowArrayEqual } from '../../shared/equality.js';

let unsubscribeState;
let initialized = false;
let profileContainer = null;

function profileTemplate() {
  return `
    <div class="profile-shell">
      <header class="profile-header">
        <p class="profile-eyebrow">ACCOUNT</p>
        <h1>Profile</h1>
        <p>Manage your account, cloud sync, and app preferences.</p>
      </header>

      <section class="profile-card profile-identity-card" aria-labelledby="profile-account-heading">
        <div class="profile-avatar" data-profile-avatar aria-hidden="true"></div>
        <div class="profile-identity-copy">
          <h2 id="profile-account-heading" data-profile-name></h2>
          <p data-profile-email></p>
        </div>
        <button class="profile-secondary-button" type="button" data-manage-account>
          Manage account
        </button>
      </section>

      <section class="profile-card" aria-labelledby="profile-sync-heading">
        <div class="profile-card-heading">
          <div class="profile-icon profile-icon--sync" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M20 7h-5V2M4 17h5v5M5.6 9A7 7 0 0 1 18.2 6L20 7M4 17l1.8 1A7 7 0 0 0 18.4 15"/>
            </svg>
          </div>
          <div>
            <h2 id="profile-sync-heading">Cloud sync</h2>
            <p data-sync-summary></p>
          </div>
          <span class="profile-status" data-sync-status></span>
        </div>
        <div class="profile-detail-grid">
          <div>
            <span>Pending changes</span>
            <strong data-pending-count>0</strong>
          </div>
          <div>
            <span>Offline access</span>
            <strong data-offline-access>Checking…</strong>
          </div>
          <div>
            <span>Last cloud sync</span>
            <strong data-last-sync>Checking…</strong>
          </div>
        </div>
        <button class="profile-secondary-button profile-full-button" type="button" data-sync-now>
          Sync now
        </button>
      </section>

      <section class="profile-card" aria-labelledby="profile-preferences-heading">
        <div class="profile-section-title">
          <h2 id="profile-preferences-heading">Preferences</h2>
          <p>These settings follow you across signed-in devices.</p>
        </div>
        <div class="profile-setting-list">
          <div class="profile-setting-row">
            <div>
              <strong>Dark mode</strong>
              <span>Use the darker app appearance.</span>
            </div>
            <button class="profile-switch" type="button" role="switch" data-setting="darkMode">
              <span></span>
            </button>
          </div>
          <div class="profile-setting-row">
            <div>
              <strong>Hide completed habits</strong>
              <span>Keep completed items out of the Habits list.</span>
            </div>
            <button class="profile-switch" type="button" role="switch" data-setting="hideCompleted">
              <span></span>
            </button>
          </div>
          <div class="profile-setting-row">
            <div>
              <strong>Hide skipped habits</strong>
              <span>Keep skipped items out of the Habits list.</span>
            </div>
            <button class="profile-switch" type="button" role="switch" data-setting="hideSkipped">
              <span></span>
            </button>
          </div>
        </div>
      </section>

      <section class="profile-card profile-privacy-card" aria-labelledby="profile-privacy-heading">
        <div class="profile-icon profile-icon--privacy" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 3 5 6v5c0 4.6 2.9 8.7 7 10 4.1-1.3 7-5.4 7-10V6l-7-3Z"/>
            <path d="m9.2 12 1.8 1.8 3.8-4"/>
          </svg>
        </div>
        <div>
          <h2 id="profile-privacy-heading">Your data stays available offline</h2>
          <p>
            Confirmed account data and pending changes are stored on this device.
            Signing out removes this account’s readable cache after pending changes are handled.
          </p>
        </div>
      </section>

      <button class="profile-sign-out-button" type="button" data-sign-out>
        Sign out
      </button>
      <p class="profile-sign-out-note">
        You’ll be asked to sync or discard any pending offline changes first.
      </p>
    </div>
  `;
}

function formatTimestamp(timestamp, fallback) {
  if (!timestamp) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function renderIdentity(container) {
  const profile = getAccountDisplayProfile();
  container.querySelector('[data-profile-name]').textContent = profile.name;
  container.querySelector('[data-profile-email]').textContent =
    profile.email || 'Signed in with Clerk';
  const avatar = container.querySelector('[data-profile-avatar]');
  avatar.textContent = '';
  if (profile.imageUrl) {
    const image = document.createElement('img');
    image.src = profile.imageUrl;
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    avatar.appendChild(image);
  } else {
    avatar.textContent = profile.initials || 'HH';
  }
}

function renderPreferences(container) {
  const settings = getState().settings;
  container.querySelectorAll('[data-setting]').forEach((button) => {
    const enabled = Boolean(settings[button.dataset.setting]);
    button.setAttribute('aria-checked', String(enabled));
    button.dataset.checked = String(enabled);
    const label = button
      .closest('.profile-setting-row')
      ?.querySelector('strong')
      ?.textContent?.trim();
    if (label) button.setAttribute('aria-label', label);
  });
}

async function renderDeviceStatus(container) {
  const account = getActiveAccount();
  if (!account) return;
  const [outbox, leaseResult, metadata] = await Promise.all([
    listOutbox(account.ownerKey),
    readOfflineLease(),
    getSyncMetadata(account.ownerKey),
  ]);
  if (!container.isConnected) return;
  container.querySelector('[data-pending-count]').textContent = String(outbox.length);
  container.querySelector('[data-offline-access]').textContent = leaseResult.valid
    ? `Until ${formatTimestamp(leaseResult.lease.expiresAt, 'enabled')}`
    : 'Needs online sign-in';
  container.querySelector('[data-last-sync]').textContent = formatTimestamp(
    metadata?.lastCompletedSyncTimestamp,
    'Not yet recorded'
  );
}

async function handleSyncNow(button) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Checking…';
  const status = getState().syncStatus;
  if (status === 'conflict') {
    const { openConflictResolution } = await import('../../core/conflictUi.js');
    openConflictResolution();
  } else {
    getCloudRuntime()?.syncEngine?.requestReplay();
  }
  button.textContent = originalText;
  button.disabled = false;
}

function bindEvents(container) {
  container.querySelector('[data-manage-account]').addEventListener('click', openAccountProfile);
  container.querySelector('[data-sign-out]').addEventListener('click', requestAccountSignOut);
  container.querySelector('[data-sync-now]').addEventListener('click', (event) => {
    handleSyncNow(event.currentTarget);
  });
  container.querySelectorAll('[data-setting]').forEach((button) => {
    button.addEventListener('click', async () => {
      switch (button.dataset.setting) {
        case 'darkMode':
          await toggleTheme();
          break;
        case 'hideCompleted':
          await dispatch(Actions.toggleCompleted());
          break;
        case 'hideSkipped':
          await dispatch(Actions.toggleSkipped());
          break;
      }
    });
  });
}

function render(container) {
  renderPreferences(container);
  updateSyncStatusUi();
  const presentation = getSyncStatusPresentation();
  const syncButton = container.querySelector('[data-sync-now]');
  syncButton.textContent = getState().syncStatus === 'conflict' ? 'Review conflicts' : 'Sync now';
  syncButton.dataset.tone = presentation.tone;
  renderDeviceStatus(container).catch((error) => {
    console.warn('Profile device status could not be loaded:', error);
  });
}

export const ProfileModule = {
  async init() {
    if (initialized) return;
    const container = document.getElementById('profile-view');
    if (!container) return;
    profileContainer = container;
    container.innerHTML = profileTemplate();
    renderIdentity(container);
    bindEvents(container);
    render(container);
    initialized = true;
  },

  activate() {
    if (!initialized || !profileContainer || unsubscribeState) return;
    unsubscribeState = subscribe(
      (state) => [state.settings, state.syncStatus],
      () => render(profileContainer),
      { equalityFn: shallowArrayEqual }
    );
    render(profileContainer);
  },

  deactivate() {
    unsubscribeState?.();
    unsubscribeState = null;
  },
};

export async function init() {
  await ProfileModule.init();
}
