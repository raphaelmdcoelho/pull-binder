import { defineConfig, devices } from '@playwright/test';

// Smoke test against the production build (`npm run build` first), served locally.
// Set PW_CHROMIUM_PATH to use a browser you already have instead of Playwright's download.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4300',
    // The service worker has its own checks; here it would only hide what the page requests.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Pixel 7'],
        launchOptions: process.env['PW_CHROMIUM_PATH']
          ? { executablePath: process.env['PW_CHROMIUM_PATH'] }
          : {},
      },
    },
  ],
  webServer: {
    command: 'node scripts/serve-dist.mjs 4300',
    url: 'http://localhost:4300',
    reuseExistingServer: !process.env['CI'],
  },
});
