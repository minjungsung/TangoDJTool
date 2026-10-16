import { test, expect } from '@playwright/test';

test('installed app caches its shell and restores local workspace after an offline restart', async ({ page, context }) => {
  await page.goto('/');
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe('standalone');
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active);
  await page.goto('about:blank');
  await page.goto('/');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.locator('#add-tanda').click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#library')).toBeVisible();
  await expect(page.locator('.group')).toHaveCount(13);
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
});

test('privacy page and icon resources remain available offline after caching', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active);
  await page.goto('about:blank');
  await page.goto('/');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto('/privacy.html');
  await expect(page.locator('h1')).toHaveText('Tango DJ Studio privacy policy');
});
