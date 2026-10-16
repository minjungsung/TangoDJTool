import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: '**/onboarding.spec.js', workers: 1,
  use: { baseURL: 'http://localhost:5196', headless: true, locale: 'en-US' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'npm run preview -- --port 5196 --strictPort', url: 'http://localhost:5196', reuseExistingServer: false },
});
