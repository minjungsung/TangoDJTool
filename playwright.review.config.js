import { defineConfig } from '@playwright/test';
const port = Number(process.env.REVIEW_PORT || 5186);
export default defineConfig({
  testDir: './tests/browser', testMatch: '**/feature-review.spec.js', fullyParallel: false, workers: 1,
  use: { baseURL: `http://localhost:${port}`, headless: true, locale: 'en-US' },
  projects: [{ name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } }, { name: 'phone-chromium', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }, { name: 'tablet-webkit', use: { browserName: 'webkit', viewport: { width: 1024, height: 768 }, hasTouch: true } }],
  webServer: { command: `npm run preview -- --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: false },
  reporter: [['list'], ['./scripts/portable-review-reporter.cjs']],
});
