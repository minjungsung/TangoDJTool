import { test, expect } from '@playwright/test';

async function cacheApp(page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (worker.state !== 'activated') await new Promise(resolve => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') resolve();
      });
    });
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

test('installed app caches its shell and restores local workspace after an offline restart', async ({ page, context }) => {
  await cacheApp(page);
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe('standalone');
  await page.locator('.sidebar a[href="#set"]').click();
  await page.locator('#add-tanda').click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#library')).toBeVisible();
  await page.locator('.sidebar a[href="#set"]').click();
  await expect(page.locator('.group')).toHaveCount(13);
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
});

test('privacy page and icon resources remain available offline after caching', async ({ page, context }) => {
  await cacheApp(page);
  await context.setOffline(true);
  await page.goto('/privacy.html');
  await expect(page.locator('h1')).toHaveText('Tango DJ Studio privacy policy');
  for (const path of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png']) {
    const response = await page.evaluate(async path => {
      const response = await fetch(path);
      return { ok: response.ok, type: response.headers.get('content-type'), size: (await response.blob()).size };
    }, path);
    expect(response.ok).toBeTruthy();
    expect(response.type).toContain('image/png');
    expect(response.size).toBeGreaterThan(0);
  }
});
