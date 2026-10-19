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

// Exercise the same management menu users open at every viewport size.
export async function recordingAction(page, name, id) {
  const row = id ? page.locator('#tracks tr').filter({ has: page.locator(`[data-action="more"][data-id="${id}"]`) }) : page.locator('#tracks tr').first();
  const button = row.locator(`[data-action="${name}"]`);
  if (await button.isVisible()) await button.click();
  else {
    await row.locator('[data-action="more"]').click();
    await page.locator(`#recording-actions [data-action="${name}"]`).click();
  }
}
