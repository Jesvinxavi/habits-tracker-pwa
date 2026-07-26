import { ConvexClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { assertCloudConfiguration } from './dataBackend.js';

let client;

export function functionReference(name) {
  return makeFunctionReference(name);
}

export function getConvexClient() {
  if (client) return client;
  assertCloudConfiguration();
  client = new ConvexClient(import.meta.env.VITE_CONVEX_URL);
  return client;
}

export async function getClerkConvexToken(clerk, forceRefreshToken = false) {
  const session = clerk.session;
  if (!session || !navigator.onLine) return null;
  const claims = session.lastActiveToken?.jwt?.claims;
  if (claims?.aud === 'convex') {
    return await session.getToken({ skipCache: Boolean(forceRefreshToken) });
  }
  return await session.getToken({
    template: 'convex',
    skipCache: Boolean(forceRefreshToken),
  });
}

export function configureConvexAuth(clerk, onAuthChange = () => {}, onRefresh = () => {}) {
  const convex = getConvexClient();
  convex.setAuth(
    async ({ forceRefreshToken } = {}) => {
      try {
        return await getClerkConvexToken(clerk, forceRefreshToken);
      } catch (error) {
        console.warn('[auth] Clerk could not provide the configured Convex token');
        return null;
      }
    },
    onAuthChange,
    onRefresh
  );
  return convex;
}

export async function clearConvexAuth() {
  // The framework-agnostic ConvexClient does not expose clearAuth(). Closing
  // the account-scoped client drops its token, socket, and subscriptions; a
  // later sign-in creates a fresh client.
  await closeConvexClient();
}

export async function closeConvexClient() {
  if (client) await client.close();
  client = undefined;
}
