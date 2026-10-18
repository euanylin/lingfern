import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: process.env.CI ? 1 : undefined,
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome', locale: 'zh-CN', colorScheme: 'light', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'npm run preview', url: 'http://127.0.0.1:8787/sw.js', reuseExistingServer: !process.env.CI },
    { command: 'node scripts/fixture-resources.mjs && npm run dev -- --mode test-fixtures --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  ],
});
