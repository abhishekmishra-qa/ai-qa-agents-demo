// @ts-check
const { defineConfig } = require('@playwright/test');

// Tests always start their own fresh app on this port, apart from `npm start` (3000).
// Fresh app = fresh in-memory data, and BUGGY=1 from your shell is passed on to it.
const PORT = 3100;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true, // every test makes and cleans up its own data, so order doesn't matter
  forbidOnly: !!process.env.CI, // a forgotten test.only must not quietly skip the rest in CI
  retries: 0, // no timing waits in these tests, so a flaky one is a bug to look at, not to retry away
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
  },
  webServer: {
    command: 'node app/server.js',
    url: `http://127.0.0.1:${PORT}/health`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
