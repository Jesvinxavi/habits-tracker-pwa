export async function seedLegacyStorage({
  localSnapshot,
  indexedSnapshot,
  sideKeys = {},
} = {}) {
  if (localSnapshot !== undefined) {
    localStorage.setItem('healthyHabitsData', JSON.stringify(localSnapshot));
  }
  Object.entries(sideKeys).forEach(([key, value]) => {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  });
  if (indexedSnapshot === undefined) return;

  await new Promise((resolve, reject) => {
    const request = indexedDB.open('healthyHabitsDB', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const transaction = request.result.transaction('state', 'readwrite');
      transaction.objectStore('state').put(indexedSnapshot, 'appData');
      transaction.oncomplete = () => {
        request.result.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

/**
 * Seeds an already-booted Playwright page through the explicit in-memory test
 * harness. UI tests must use this instead of browser storage so they cannot
 * accidentally exercise the retired legacy persistence path.
 */
export async function seedTestHarness(page, snapshot = {}) {
  await page.waitForFunction(() => Boolean(window.__APP_TEST__?.seed));
  await page.evaluate((data) => window.__APP_TEST__.seed(data), snapshot);
}
