import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pwa',
  outputDir: 'test-results/pwa',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4190/habits-tracker-pwa/',
    timezoneId: 'Europe/London',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'VITE_DATA_BACKEND=legacy npm run build:pages && node scripts/preview-pages.mjs',
    url: 'http://127.0.0.1:4190/habits-tracker-pwa/',
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [{ name: 'chromium-pwa', use: { ...devices['Desktop Chrome'] } }],
});
