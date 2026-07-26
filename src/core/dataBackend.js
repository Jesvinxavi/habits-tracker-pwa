export const DATA_BACKENDS = Object.freeze({
  LEGACY: 'legacy',
  CLOUD: 'cloud',
});

export function getConfiguredDataBackend() {
  const configured = import.meta.env.VITE_DATA_BACKEND || DATA_BACKENDS.LEGACY;
  if (!Object.values(DATA_BACKENDS).includes(configured)) {
    throw new Error(`Unsupported VITE_DATA_BACKEND value: ${configured}`);
  }
  return configured;
}

export function isCloudBackend() {
  return getConfiguredDataBackend() === DATA_BACKENDS.CLOUD;
}

export function assertCloudConfiguration() {
  const missing = [];
  if (!import.meta.env.VITE_CONVEX_URL) missing.push('VITE_CONVEX_URL');
  if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
    missing.push('VITE_CLERK_PUBLISHABLE_KEY');
  }
  if (missing.length) {
    throw new Error(`Cloud persistence is missing configuration: ${missing.join(', ')}`);
  }
}
