import { test as base, expect } from '@playwright/test';

// Existing feature regressions start with a deliberately saved empty workspace.
// First-time onboarding is covered separately using Playwright's fresh contexts.
export const test = base.extend({
  page: async ({ page }, use) => {
    await prepareSavedWorkspace(page);
    await use(page);
  },
});
export { expect };

export async function prepareSavedWorkspace(page) {
    const path = '/test-workspace-bootstrap';
    await page.route(`**${path}`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Workspace fixture</title>' }));
    await page.goto(path);
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('tango-dj-studio', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('files'); request.result.createObjectStore('state'); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('state', 'readwrite');
        tx.objectStore('state').put({ tracks: [], groups: [], revision: 1 }, 'current');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    }));
    await page.unroute(`**${path}`);
}
