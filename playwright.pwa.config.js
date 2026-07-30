import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pwa',
  workers: 1,
  outputDir: 'test-results/pwa',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4190/habits-tracker-pwa/',
    timezoneId: 'Europe/London',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'PWA_TEST_BUILD=1 VITE_PWA_TEST=1 VITE_TEST_HARNESS=1 npm run build:pages && node scripts/preview-pages.mjs',
    url: 'http://127.0.0.1:4190/habits-tracker-pwa/',
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [{ name: 'chromium-pwa', use: { ...devices['Desktop Chrome'] } }],
});
