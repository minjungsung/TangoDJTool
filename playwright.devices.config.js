import { defineConfig } from '@playwright/test';
import config from './playwright.config.js';
export default defineConfig({ ...config, testMatch: '**/devices.spec.js', projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }] });
