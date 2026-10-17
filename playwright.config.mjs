import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 2,
  // These tests mock GitHub. Service-worker requests bypass Playwright's page routes.
  use: {baseURL: 'http://127.0.0.1:4173', serviceWorkers: 'block'},
  projects: [
    {name: 'chromium', use: {browserName: 'chromium'}},
    {name: 'mobile-webkit', use: {...devices['iPhone 13'], browserName: 'webkit'}},
  ],
  webServer: {command: 'node scripts/serve.mjs', port: 4173, reuseExistingServer: !process.env.CI},
});
