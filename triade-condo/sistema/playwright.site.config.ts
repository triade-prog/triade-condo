import { defineConfig, devices } from "@playwright/test";

// Site institucional (EM-04): páginas, acessibilidade (axe), seletores e formulário, no celular e no
// computador. Sobe o servidor do Astro em 4321 e um Console de mentira em 4399 (a Tabela de preços
// da calculadora, com uma faixa fora do ar; tests/e2e-site/console-falso.mjs); o envio do formulário
// é simulado nos testes. O link de agendamento da página de demonstração vem do ambiente (R17.6b).
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
  webServer: [
    {
      command: "node tests/e2e-site/console-falso.mjs",
      url: "http://127.0.0.1:4399/",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm --filter @triade/site dev",
      url: "http://localhost:4321",
      reuseExistingServer: !process.env.CI,
      env: {
        ASTRO_TELEMETRY_DISABLED: "1",
        PUBLIC_WHATSAPP_COMERCIAL: "5561900000000",
        PUBLIC_LINK_AGENDA: "https://console.exemplo.com.br/a/abcdefgh2345",
        SUPABASE_FUNCTIONS_URL: "http://127.0.0.1:4399",
        SITE_SEGREDO: "segredo-do-site-e2e",
        CALCULADORA_LIMITE_IP: "100000",
      },
    },
  ],
});
