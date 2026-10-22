import { defineConfig, devices } from "@playwright/test";

// Site institucional (EM-04): páginas, acessibilidade (axe), seletores e formulário, no celular e no
// computador. Sobe o servidor do Astro em 4321; o envio do formulário é simulado nos testes.
const chromiumLocal = process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {};

export default defineConfig({
  testDir: "tests/e2e-site",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:4321", trace: "retain-on-failure", ...chromiumLocal },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"], ...chromiumLocal } },
    { name: "computador", use: { ...devices["Desktop Chrome"], ...chromiumLocal } },
  ],
  webServer: {
    command: "pnpm --filter @triade/site dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    env: { ASTRO_TELEMETRY_DISABLED: "1", PUBLIC_WHATSAPP_COMERCIAL: "5561900000000" },
  },
});
