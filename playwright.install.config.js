import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: '**/install.spec.js', workers: 1,
  use: { browserName: 'chromium', baseURL: 'http://localhost:5195', headless: true, locale: 'en-US' },
  webServer: { command: 'npm run preview -- --port 5195 --strictPort', url: 'http://localhost:5195', reuseExistingServer: false },
});
