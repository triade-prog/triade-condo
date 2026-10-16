import { defineConfig, devices } from "@playwright/test";

// Ponta a ponta (F0.9): cabeçalhos de segurança e acessibilidade (axe) nos dois apps, no
// celular e no computador. Local: os apps já rodando em 3000/3001 (next start). CI: o
// webServer sobe os dois.
const chromiumLocal = process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { trace: "retain-on-failure", ...chromiumLocal },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"], ...chromiumLocal } },
    { name: "computador", use: { ...devices["Desktop Chrome"], ...chromiumLocal } },
  ],
  webServer: [
    { command: "pnpm --filter @triade/plataforma start", url: "http://localhost:3000", reuseExistingServer: !process.env.CI },
    { command: "pnpm --filter @triade/console start", url: "http://localhost:3001", reuseExistingServer: !process.env.CI },
  ],
});
