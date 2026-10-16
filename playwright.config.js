import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testIgnore: '**/feature-review.spec.js', fullyParallel: false,
  use: { baseURL: 'http://localhost:5173', headless: true, launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
});
