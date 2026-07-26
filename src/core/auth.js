import { Clerk } from '@clerk/clerk-js';
import {
  functionReference,
  configureConvexAuth,
  clearConvexAuth,
  getClerkConvexToken,
} from './convexClient.js';
import {
  getDeviceId,
  purgeAccountCache,
  readOfflineLease,
  renewOfflineLease,
  revokeOfflineLease,
} from './offlineDb.js';
import { assertCloudConfiguration } from './dataBackend.js';
import { getCloudRuntime, clearCloudRuntime } from './cloudRuntime.js';
import { markStartup } from './startupMetrics.js';

let clerk;
let activeAccount;
let clerkHasUi = false;
let clerkUiPromise;

function loadClerkUi() {
  if (window.__internal_ClerkUICtor) {
    return Promise.resolve({ ClerkUI: window.__internal_ClerkUICtor });
  }
  if (clerkUiPromise) return clerkUiPromise;

  clerkUiPromise = new Promise((resolve, reject) => {
    const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    const encodedFrontendApi = publishableKey?.split('_')[2];
    if (!encodedFrontendApi) {
      reject(new Error('The Clerk publishable key is invalid'));
      return;
    }
    const frontendApi = atob(encodedFrontendApi).slice(0, -1);
    const script = document.createElement('script');
    script.src = `https://${frontendApi}/npm/@clerk/ui@1/dist/ui.browser.js`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.clerkUi = 'true';
    script.addEventListener('load', () => {
      if (!window.__internal_ClerkUICtor) {
        reject(new Error('Clerk UI loaded without its component constructor'));
        return;
      }
      resolve({ ClerkUI: window.__internal_ClerkUICtor });
    });
    script.addEventListener('error', () => {
      script.remove();
      clerkUiPromise = undefined;
      reject(new Error('Clerk account components could not be loaded'));
    });
    document.head.appendChild(script);
  });
  return clerkUiPromise;
}

async function loadClerk({ withUi = false } = {}) {
  const nextClerk = new Clerk(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
  if (withUi) {
    const ui = await loadClerkUi();
    await nextClerk.load({ ui });
  } else {
    await nextClerk.load();
  }
  clerk = nextClerk;
  clerkHasUi = withUi;
  return clerk;
}

async function ensureClerkUi() {
  if (clerkHasUi) return clerk;
  return loadClerk({ withUi: true });
}

function renderAuthMessage(message, kind = 'status') {
  let gate = document.getElementById('account-auth-gate');
  if (!gate) {
    gate = document.createElement('div');
    gate.id = 'account-auth-gate';
    gate.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100dvh;z-index:10000;background:var(--background,#fff);display:grid;place-items:center;padding:16px;overflow:auto';
    const content = document.createElement('div');
    content.id = 'account-auth-content';
    gate.appendChild(content);
    document.body.appendChild(gate);
    const app = document.querySelector('.app-container');
    app?.setAttribute('inert', '');
    app?.setAttribute('aria-hidden', 'true');
  }
  const content = gate.querySelector('#account-auth-content');
  content.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  content.textContent = message;
  return content;
}

function clearAuthGate() {
  const gate = document.getElementById('account-auth-gate');
  const content = gate?.querySelector('#account-auth-content');
  if (content && clerk && clerkHasUi) {
    try {
      clerk.unmountSignIn(content);
    } catch (_) {
      // It may contain a status message instead of a mounted Clerk component.
    }
  }
  gate?.remove();
  const app = document.querySelector('.app-container');
  app?.removeAttribute('inert');
  app?.removeAttribute('aria-hidden');
}

export async function initializeAccountAuth({ onAuthenticatedSession } = {}) {
  markStartup('authStart');
  assertCloudConfiguration();
  const deviceIdPromise = getDeviceId();
  const offlineLeasePromise = readOfflineLease();
  try {
    await loadClerk();
    markStartup('clerkReady');
  } catch (error) {
    if (!navigator.onLine) {
      const { lease, valid } = await offlineLeasePromise;
      if (valid) {
        activeAccount = {
          ownerKey: lease.ownerKey,
          clerkUserId: lease.clerkUserId,
          access: 'offline',
        };
        return activeAccount;
      }
      renderAuthMessage('Connect to the internet to sign in again.', 'error');
      return { access: 'blocked', reason: 'offline_lease_expired' };
    }
    throw error;
  }

  if (!clerk.isSignedIn || !clerk.session) {
    const gate = renderAuthMessage('');
    await ensureClerkUi();
    clerk.mountSignIn(gate, {
      forceRedirectUrl: window.location.href,
      signUpForceRedirectUrl: window.location.href,
    });
    return { access: 'blocked', reason: 'signed_out' };
  }

  const [deviceId, oldLease] = await Promise.all([
    deviceIdPromise,
    offlineLeasePromise,
  ]);
  markStartup(oldLease.valid ? 'offlineLeaseReady' : 'offlineLeaseUnavailable');
  if (
    oldLease.valid &&
    oldLease.lease?.clerkUserId === clerk.user?.id &&
    typeof onAuthenticatedSession === 'function'
  ) {
    markStartup('trustedCacheIdentity');
    activeAccount = {
      ownerKey: oldLease.lease.ownerKey,
      clerkUserId: oldLease.lease.clerkUserId,
      access: 'online_connecting',
      deviceId,
    };
    void Promise.resolve(
      onAuthenticatedSession(activeAccount)
    ).catch((error) => {
      console.warn('Confirmed account cache could not be opened early:', error);
    });
  }

  try {
    const token = await getClerkConvexToken(clerk);
    if (!token) throw new Error('EMPTY_CONVEX_TOKEN');
  } catch (error) {
    renderAuthMessage(
      'Clerk sign-in succeeded, but its Convex integration is not active. Open the Clerk Dashboard, activate Integrations → Convex, then reload this page.',
      'error'
    );
    return { access: 'blocked', reason: 'clerk_convex_integration_missing' };
  }

  let resolveAuthentication;
  const authenticated = new Promise((resolve) => {
    resolveAuthentication = resolve;
  });
  const convex = configureConvexAuth(clerk, (isAuthenticated) => {
    window.dispatchEvent(new CustomEvent('convex-auth-change'));
    if (isAuthenticated) resolveAuthentication();
  }, (refreshing) => {
    window.dispatchEvent(
      new CustomEvent('convex-auth-refresh', { detail: { refreshing } })
    );
  });
  await Promise.race([
    authenticated,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Convex authentication timed out')), 15000)
    ),
  ]);
  markStartup('convexAuthenticated');
  const provisioned = await convex.mutation(functionReference('profiles:provision'), {
    deviceId,
    appFirstOpenDate: new Date().toISOString().slice(0, 10),
  });
  if (oldLease.lease && oldLease.lease.ownerKey !== provisioned.cacheOwnerKey) {
    await purgeAccountCache(oldLease.lease.ownerKey);
  }
  await renewOfflineLease({
    ownerKey: provisioned.cacheOwnerKey,
    clerkUserId: provisioned.clerkUserId,
  });
  markStartup('accountReady');
  activeAccount = {
    ownerKey: provisioned.cacheOwnerKey,
    clerkUserId: provisioned.clerkUserId,
    generation: provisioned.profile.activeGeneration,
    access: 'online',
    deviceId,
  };
  clearAuthGate();
  return activeAccount;
}

export function getActiveAccount() {
  return activeAccount;
}

export function getAccountDisplayProfile() {
  const user = clerk?.user;
  const email =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    '';
  const name =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    email.split('@')[0] ||
    'Healthy Habits member';
  return {
    name,
    email,
    imageUrl: user?.imageUrl || '',
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  };
}

export async function openAccountProfile() {
  if (!clerk?.user) return;
  await ensureClerkUi();
  clerk.openUserProfile();
}

export async function signOutAccount({ discardPending = false } = {}) {
  if (!activeAccount) return;
  const { listOutbox } = await import('./offlineDb.js');
  const pending = await listOutbox(activeAccount.ownerKey);
  if (pending.length && !discardPending) {
    return { requiresDecision: true, pendingCount: pending.length };
  }
  await revokeOfflineLease();
  await clearConvexAuth();
  if (clerk) await clerk.signOut();
  await purgeAccountCache(activeAccount.ownerKey);
  clearCloudRuntime();
  activeAccount = undefined;
  return { signedOut: true, discardedCount: discardPending ? pending.length : 0 };
}

async function syncBeforeSignOut() {
  const runtime = getCloudRuntime();
  runtime?.syncEngine?.requestReplay();
  const deadline = Date.now() + 30000;
  const { listOutbox } = await import('./offlineDb.js');
  while (Date.now() < deadline) {
    if (!(await listOutbox(activeAccount.ownerKey)).length) {
      return signOutAccount();
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Pending changes could not be synced. You can cancel or discard them.');
}

export async function requestAccountSignOut() {
  const result = await signOutAccount();
  if (!result?.requiresDecision) {
    window.location.reload();
    return;
  }
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:10002;background:rgba(15,23,42,.72);display:grid;place-items:center;padding:20px';
  overlay.innerHTML = `
    <section role="dialog" aria-modal="true" style="width:min(480px,100%);background:white;color:#111;border-radius:16px;padding:24px">
      <h2>Pending offline changes</h2>
      <p>${result.pendingCount} change(s) have not reached the cloud.</p>
      <p data-error role="alert"></p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end">
        <button type="button" data-cancel>Cancel</button>
        <button type="button" data-discard>Discard pending changes and sign out</button>
        <button type="button" data-sync>Sync before signing out</button>
      </div>
    </section>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-cancel]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-discard]').addEventListener('click', async () => {
    await signOutAccount({ discardPending: true });
    window.location.reload();
  });
  overlay.querySelector('[data-sync]').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await syncBeforeSignOut();
      window.location.reload();
    } catch (error) {
      overlay.querySelector('[data-error]').textContent = error.message;
      event.currentTarget.disabled = false;
    }
  });
}

export function initializeAccountControls() {
  // Account controls now live in the Profile tab. Remove the temporary
  // cutover control if a hot reload left one behind.
  document.querySelector('[data-legacy-account-control]')?.remove();
}
