import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/offline', timeout: 120_000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:8788', browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome', locale: 'zh-CN', colorScheme: 'light' },
  webServer: { command: 'wrangler dev --env local --local --ip 127.0.0.1 --port 8788 --assets /tmp/lingfern-test-fixtures-dist', url: 'http://127.0.0.1:8788', reuseExistingServer: true, timeout: 30_000 },
});
