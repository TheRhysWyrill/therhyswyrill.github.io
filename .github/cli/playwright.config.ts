import { defineConfig } from '@playwright/test';

/**
 * Regression specs for the custom reviews / video-vault UI.
 *
 * Run with:
 *   npm run test:e2e
 *
 * By default the config starts (and later stops) its own Jekyll server on
 * port 4000, reusing one that is already running. Set E2E_BASE_URL to test a
 * different deployment, or E2E_NO_SERVER=1 to require an already-running
 * server and skip auto-start entirely.
 */
const PORT = 4000;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 900 },
  },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command:
          'powershell -NoProfile -Command "$env:Path=\'C:\\Ruby34-x64\\bin;\' + $env:Path; bundle exec jekyll serve --host 127.0.0.1 --port 4000 --force_polling"',
        url: `http://127.0.0.1:${PORT}/`,
        reuseExistingServer: true,
        timeout: 600_000,
      },
});
