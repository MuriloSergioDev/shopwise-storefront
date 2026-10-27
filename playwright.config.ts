import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against the whole Tilt cluster (`tilt up` in shopwise-platform, storefront on :3000). Local only:
// CI has no cluster. Run with `pnpm e2e`.
export default defineConfig({
  testDir: 'e2e',
  // The tests share the cluster's stock and Kafka; one at a time keeps the stock assertions exact.
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
