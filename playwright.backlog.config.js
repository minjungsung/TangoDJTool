import { defineConfig } from '@playwright/test';
const port = Number(process.env.BACKLOG_PORT || 5187);
export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['**/library-backlog.spec.js', '**/history-backup.spec.js', '**/event-edit-backlog.spec.js', '**/audio-backlog.spec.js'],
  fullyParallel: false, workers: 2,
  use: { baseURL: `http://localhost:${port}`, headless: true, locale: 'en-US', launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } },
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'phone-chromium', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-webkit', use: { browserName: 'webkit', viewport: { width: 1024, height: 768 }, hasTouch: true } },
  ],
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: false },
  reporter: 'list',
});
