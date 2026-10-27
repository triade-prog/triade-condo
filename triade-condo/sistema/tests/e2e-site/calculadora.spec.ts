// Calculadora de custo por apartamento (CM-33, DC17; quadros 448 e 449): com e sem a taxa média
// de condomínio, o "menos de R$ 5" só quando é verdade, sem JavaScript, o pedido de proposta e o
// axe (WCAG 2.2 AA) no celular e no computador. O preço vem do Console de mentira
// (console-falso.mjs), com o preço de fundador da Tabela; a faixa de 101 a 200 unidades fica fora do
// ar, e a página mostra a tabela cheia do site, nunca o fundador sem a vaga confirmada (r9).
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).exclude("astro-dev-toolbar").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  const texto = await page.locator("main").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  expect(texto).not.toMatch(/\bROI\b|economiza/i);
  const largura = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(largura).toBeLessThanOrEqual(0);
}

const conta = (page: Page) => page.locator("#conta");

test.describe("Site · calculadora (CM-33)", () => {
  test("quadro 448: 64 unidades e taxa de R$ 650 mostram R$ 3,58, o destaque e cerca de 0,6%", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/calculadora");
    await expect(page.getByRole("heading", { level: 1, name: "Quanto custa por apartamento?" })).toBeVisible();
    await expect(page.getByText("Digite quantas unidades o prédio tem. O valor vem da tabela de hoje.")).toBeVisible();
    await expect(page.getByText("Digite as unidades para ver o valor por apartamento.")).toBeVisible();
    await page.getByLabel("Unidades do prédio").fill("64");
    await expect(page.getByText("Faixa: 41 a 100 unidades")).toBeVisible();
    const taxa = page.getByLabel("Taxa média de condomínio (opcional)");
    await expect(taxa).toHaveAccessibleDescription(/Quanto cada apartamento paga por mês, em média\. Serve só para mostrar o peso na taxa\./);
    await taxa.fill("650");
    await expect(page.getByText("R$ 3,58 por apartamento, cerca de 0,6% da taxa de R$ 650,00.")).toBeVisible();
    await expect(page.getByText("Menos de R$ 5 por apartamento por mês", { exact: true })).toBeVisible();
    await expect(conta(page).getByText("Por apartamento, por mês")).toBeVisible();
    await expect(page.locator("#por-ap")).toHaveText("R$ 3,58");
    await expect(conta(page).getByText("R$ 229,00 · preço de fundador")).toBeVisible();
    await expect(conta(page).getByText("cerca de 0,6% de R$ 650,00")).toBeVisible();
    await expect(conta(page).getByText("à parte, na proposta")).toBeVisible();
    await expect(conta(page).getByText("30 dias de aviso, sem multa")).toBeVisible();
    await expect(conta(page).getByText("Estimativa: mensalidade dividida pelas unidades. Não inclui taxa da administradora nem promete economia.")).toBeVisible();
    await expect(page).toHaveURL(/\/calculadora\?unidades=64&taxa=650$/);
    await expect(page.getByRole("heading", { level: 2, name: "Quer a proposta do seu prédio?" })).toBeVisible();
    await expect(page.getByText("Ao pedir, você vira um interessado com a faixa e a taxa informada já preenchidas e recebe o primeiro retorno no próximo dia útil.")).toBeVisible();
    await conferir(page);
  });

  test("quadro 449: 20 unidades sem a taxa mostram R$ 6,45, sem o destaque e sem a linha do peso", async ({ page }) => {
    await page.goto("/calculadora");
    await page.getByLabel("Unidades do prédio").fill("20");
    await expect(page.getByText("Faixa: até 40 unidades")).toBeVisible();
    await expect(page.locator("#por-ap")).toHaveText("R$ 6,45");
    await expect(conta(page).getByText("R$ 129,00 · preço de fundador")).toBeVisible();
    await expect(page.getByText("Menos de R$ 5 por apartamento por mês")).toBeHidden();
    await expect(page.getByText("Na taxa de condomínio")).toBeHidden();
    await conferir(page);

    // Com a taxa e o valor acima de R$ 5: aparece o peso, nunca o "menos de R$ 5".
    await page.getByLabel("Taxa média de condomínio (opcional)").fill("480");
    await expect(conta(page).getByText("cerca de 1,3% de R$ 480,00")).toBeVisible();
    await expect(page.getByText("Menos de R$ 5 por apartamento por mês")).toBeHidden();
  });

  test("a taxa fora do limite e as unidades erradas dizem o que corrigir; acima de 400, sob consulta", async ({ page }) => {
    await page.goto("/calculadora");
    await page.getByLabel("Unidades do prédio").fill("64");
    await page.getByLabel("Taxa média de condomínio (opcional)").fill("25000");
    await expect(page.getByText("A taxa vai de R$ 0,01 a R$ 20.000")).toBeVisible();
    await expect(page.getByLabel("Taxa média de condomínio (opcional)")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Na taxa de condomínio")).toBeHidden();
    await page.getByLabel("Unidades do prédio").fill("0");
    await expect(page.getByText("Digite as unidades do prédio, de 1 a 20.000.")).toBeVisible();
    await page.getByLabel("Taxa média de condomínio (opcional)").fill("");
    await page.getByLabel("Unidades do prédio").fill("450");
    await expect(page.getByText("Faixa: acima de 400 unidades")).toBeVisible();
    await expect(page.locator("#por-ap")).toHaveText("Sob consulta");
    await expect(conta(page).getByText("preço na proposta")).toBeVisible();
    await conferir(page);
  });

  test("o pedido de proposta leva as unidades e a taxa e confirma na página", async ({ page }) => {
    let corpo: Record<string, unknown> = {};
    await page.route("**/api/proposta", async (rota) => {
      corpo = rota.request().postDataJSON();
      await rota.fulfill({ status: 200, json: { ok: true } });
    });
    await page.goto("/calculadora?utm_source=google");
    await page.getByLabel("Unidades do prédio").fill("64");
    await page.getByLabel("Taxa média de condomínio (opcional)").fill("650,00");
    await expect(page.locator("#por-ap")).toHaveText("R$ 3,58");
    await page.getByRole("button", { name: "Quero a proposta" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Faltam alguns campos." })).toBeVisible();
    await expect(page.getByLabel("Seu nome")).toBeFocused();
    await page.getByLabel("Seu nome").fill("Renata Moura");
    await page.getByLabel("WhatsApp").fill("(61) 99876-1230");
    await page.getByLabel("Autorizo a TRÍADE a usar estes dados para mandar a proposta e falar comigo sobre ela.").check();
    await page.getByRole("button", { name: "Quero a proposta" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pedido recebido." })).toBeVisible();
    expect(corpo).toMatchObject({ nome: "Renata Moura", whatsapp: "(61) 99876-1230", consentimento: true, unidades: "64", taxa: "650,00", pagina: "/calculadora", utm: { utm_source: "google" } });
    await conferir(page);
  });

  test("sem as unidades, o pedido avisa e leva o foco para a calculadora", async ({ page }) => {
    await page.goto("/calculadora");
    await page.getByLabel("Seu nome").fill("Renata Moura");
    await page.getByLabel("WhatsApp").fill("(61) 99876-1230");
    await page.getByLabel("Autorizo a TRÍADE a usar estes dados para mandar a proposta e falar comigo sobre ela.").check();
    await page.getByRole("button", { name: "Quero a proposta" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Falta o número de unidades." })).toBeVisible();
    await expect(page.getByLabel("Unidades do prédio")).toBeFocused();
  });

  test("r9: com a Tabela fora do ar, a tabela cheia com o 'a partir de' do /precos, nunca o fundador", async ({ page, request }) => {
    await page.goto("/calculadora");
    await page.getByLabel("Unidades do prédio").fill("150");
    await expect(page.getByText("Faixa: 101 a 200 unidades")).toBeVisible();
    await expect(page.locator("#por-ap")).toHaveText("R$ 3,66");
    await expect(conta(page).getByText("R$ 549,00", { exact: true })).toBeVisible();
    await expect(conta(page).getByText("preço de fundador")).toBeHidden();
    await expect(page.locator("#aviso-tabela")).toHaveText(
      "Valor da tabela cheia. Condomínios fundadores: a partir de R$ 129,00/mês, só no mensal, vagas limitadas; a proposta confirma.");
    await conferir(page);
    // Com a Tabela de volta (outra faixa), o aviso some.
    await page.getByLabel("Unidades do prédio").fill("64");
    await expect(page.locator("#por-ap")).toHaveText("R$ 3,58");
    await expect(page.locator("#aviso-tabela")).toBeHidden();
    // O site repassa o IP de quem usa, para o limite por pessoa no Console.
    expect((await (await request.get("http://127.0.0.1:4399/ultimo-cliente")).json()).cliente).toEqual(expect.any(String));
  });

  test("a página de preços leva à calculadora", async ({ page }) => {
    await page.goto("/precos");
    await page.getByRole("link", { name: "Faça a conta do seu prédio" }).click();
    await expect(page).toHaveURL(/\/calculadora$/);
    await expect(page.getByRole("heading", { level: 1, name: "Quanto custa por apartamento?" })).toBeVisible();
  });

  test("a rota da conta devolve os textos prontos; a do pedido recusa o incompleto", async ({ request }) => {
    const r = await request.get("/api/calculadora?unidades=64&taxa=650");
    expect(r.status()).toBe(200);
    expect((await r.json()).resultado).toMatchObject({ porApartamento: "R$ 3,58", naTaxa: "cerca de 0,6% de R$ 650,00", destaque: { titulo: "Menos de R$ 5 por apartamento por mês" } });
    const sem = await request.get("/api/calculadora?unidades=20");
    expect((await sem.json()).resultado).toMatchObject({ porApartamento: "R$ 6,45", destaque: null, naTaxa: null });
    const p = await request.post("/api/proposta", { data: { nome: "R", unidades: "64" } });
    expect(p.status()).toBe(422);
    expect(Object.keys((await p.json()).erros).sort()).toEqual(["consentimento", "nome", "whatsapp"]);
  });
});

test.describe("Site · calculadora sem JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("o botão Calcular manda pelo endereço e a conta volta desenhada pelo servidor", async ({ page }) => {
    await page.goto("/calculadora");
    await page.getByLabel("Unidades do prédio").fill("64");
    await page.getByLabel("Taxa média de condomínio (opcional)").fill("650");
    await page.getByRole("button", { name: "Calcular" }).click();
    await expect(page).toHaveURL(/unidades=64&taxa=650/);
    await expect(page.locator("#por-ap")).toHaveText("R$ 3,58");
    await expect(page.getByText("R$ 3,58 por apartamento, cerca de 0,6% da taxa de R$ 650,00.")).toBeVisible();
    await expect(page.getByText("Faixa: 41 a 100 unidades")).toBeVisible();
    // O axe precisa de JavaScript na página; a mesma conta, desenhada igual, passa nele nos testes acima.
    await page.goto("/calculadora?unidades=20");
    await expect(page.locator("#por-ap")).toHaveText("R$ 6,45");
    await expect(page.getByText("Menos de R$ 5 por apartamento por mês")).toBeHidden();
    await expect(page.getByText("Na taxa de condomínio")).toBeHidden();
    await page.goto("/calculadora?unidades=150");
    await expect(page.locator("#por-ap")).toHaveText("R$ 3,66");
    await expect(page.locator("#aviso-tabela")).toContainText("Valor da tabela cheia.");
  });
});
