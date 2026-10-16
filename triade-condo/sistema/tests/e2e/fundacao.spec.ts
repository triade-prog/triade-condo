// F0.8 e F0.9: os dois apps no ar com os cabeçalhos de segurança, sem erro de acessibilidade
// e com o repasse /api fechado quando falta configuração.
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// A primeira página que abre sem sessão: o início da Plataforma e o login do Console.
const APPS = [
  { nome: "Plataforma do síndico", base: "http://localhost:3000", url: "http://localhost:3000", titulo: "Plataforma do síndico" },
  { nome: "Console TRÍADE", base: "http://localhost:3001", url: "http://localhost:3001/entrar", titulo: "Entrar no Console" },
];

for (const app of APPS) {
  test.describe(app.nome, () => {
    test("cabeçalhos de segurança e CSP com nonce", async ({ page }) => {
      // Script ou estilo barrado pela CSP aparece como erro no console.
      const erros: string[] = [];
      page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
      const resposta = await page.goto(app.url);
      await page.waitForLoadState("networkidle");
      expect(resposta?.status()).toBe(200);
      const h = resposta!.headers();
      expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
      expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["x-robots-tag"]).toBe("noindex, nofollow");
      expect(h["x-powered-by"]).toBeUndefined();
      await expect(page.getByRole("heading", { level: 1, name: app.titulo })).toBeVisible();
      expect(erros).toEqual([]);
    });

    test("o nonce muda a cada página", async ({ request }) => {
      const nonce = async () => (await request.get(app.url)).headers()["content-security-policy"]?.match(/'nonce-([^']+)'/)?.[1];
      expect(await nonce()).not.toBe(await nonce());
    });

    test("sem erro de acessibilidade (axe, WCAG 2.2 AA)", async ({ page }) => {
      await page.goto(app.url);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations).toEqual([]);
    });

    test("o repasse /api não chama nada sem a configuração do servidor", async ({ request }) => {
      const r = await request.get(`${app.base}/api/v1/saude`);
      expect(r.status()).toBe(503);
      expect(await r.json()).toEqual({ erro: { codigo: "UPSTREAM_UNAVAILABLE" } });
    });
  });
}
