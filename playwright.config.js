import { defineConfig } from '@playwright/test';
const port = Number(process.env.E2E_PORT || 5173);
export default defineConfig({
  testDir: './tests/browser', testIgnore: ['**/feature-review.spec.js', '**/install.spec.js', '**/onboarding.spec.js'], fullyParallel: false,
  use: { baseURL: `http://localhost:${port}`, headless: true, launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } },
  webServer: { command: `npm run dev -- --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: false },
});
