import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 2,
  use: {baseURL: 'http://127.0.0.1:4173'},
  projects: [
    {name: 'chromium', use: {browserName: 'chromium'}},
    {name: 'mobile-webkit', use: {...devices['iPhone 13'], browserName: 'webkit'}},
  ],
  webServer: {command: 'node scripts/serve.mjs', port: 4173, reuseExistingServer: !process.env.CI},
});
