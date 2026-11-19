import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3210);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure", locale: "es-ES", timezoneId: "Europe/Madrid" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
  // E2E_START=1 builds nothing: it expects `pnpm build` to have run and starts the production server
  webServer: process.env.E2E_START ? { command: `pnpm start -p ${port}`, url: baseURL, reuseExistingServer: true, timeout: 120_000 } : undefined,
});
