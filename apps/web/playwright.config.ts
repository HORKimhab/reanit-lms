import { defineConfig, devices } from "@playwright/test";

/** Where the web app listens; the API's APP_URL, for its links and its origin check. */
const BASE_URL = "http://localhost:3000";
/** Where the API listens, as the web app reaches it. */
const API_URL = "http://localhost:4000";
/** A cold `next start` and API boot can take a while on CI runners. */
const SERVER_START_MS = 120_000;
const isCi = Boolean(process.env.CI);

/**
 * End-to-end tests against the built apps (`pnpm build` first) and the services from
 * infra/docker-compose.yml, migrated and with the storage bucket set up. Both servers are started
 * here, never reused: the API must run with fake card payments.
 */
export default defineConfig({
  testDir: "./e2e",
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter api start",
      url: `${API_URL}/health`,
      env: { APP_URL: BASE_URL, FAKE_PAYMENTS: "true", LOG_LEVEL: "warn" },
      reuseExistingServer: false,
      timeout: SERVER_START_MS,
    },
    {
      command: "pnpm start",
      url: BASE_URL,
      // Schools are served under /s/<subdomain>, so one session cookie covers the whole flow.
      env: { API_URL, ROOT_DOMAIN: "" },
      reuseExistingServer: false,
      timeout: SERVER_START_MS,
    },
  ],
});
