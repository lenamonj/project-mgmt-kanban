import { defineConfig, devices } from "@playwright/test";

// E2e runs against the integrated app (FastAPI serving the built frontend) so
// auth and API routes are exercised end to end.
export default defineConfig({
  testDir: "./tests",
  // Serial: all tests share the single backend user's board, so concurrent
  // board writes would race (last-writer-wins on one row).
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:8000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node e2e-server.mjs",
    url: "http://127.0.0.1:8000/api/health",
    // Build and serve our own app locally; only reuse a running server in CI.
    // Avoids silently testing against an unrelated process already on 8000.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
