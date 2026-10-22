// Site institucional e de vendas (EM-04): cada página passa no axe (WCAG 2.2 AA) e cabe na tela
// do celular sem rolagem lateral; o seletor de etapas, o Mensal/Anual e o formulário funcionam.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function semErroDeAcessibilidade(page: Page) {
  const r = await new AxeBuilder({ page }).exclude("astro-dev-toolbar").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  const texto = await page.locator("main").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function semRolagemLateral(page: Page) {
  const largura = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(largura).toBeLessThanOrEqual(0);
}

const paginas = [
  { caminho: "/", titulo: "Nenhum pedido do seu prédio fica sem resposta" },
  { caminho: "/como-funciona", titulo: "Um pedido, do início ao fim" },
  { caminho: "/precos", titulo: "Um plano. O preço muda só com o tamanho do prédio." },
  { caminho: "/demonstracao", titulo: "Veja o sistema com um pedido do seu prédio" },
  { caminho: "/guia", titulo: "O que aprendemos organizando prédios" },
  { caminho: "/privacidade", titulo: "Política de privacidade deste site" },
];

test.describe("Site · páginas", () => {
  for (const p of paginas) {
    test(`${p.caminho} abre, passa no axe e cabe na tela`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(p.caminho);
      await expect(page.getByRole("heading", { level: 1, name: p.titulo })).toBeVisible();
      await semRolagemLateral(page);
      await semErroDeAcessibilidade(page);
    });
  }

  test("endereço que não existe mostra a página 404", async ({ page }) => {
    const r = await page.goto("/nao-existe");
    expect(r?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Esta página não existe" })).toBeVisible();
  });

  test("EM-07: as telas de exemplo dizem que os dados são ilustrativos", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("DADOS ILUSTRATIVOS")).toBeVisible();
    await page.goto("/como-funciona");
    await expect(page.getByText("DADOS ILUSTRATIVOS")).toBeVisible();
  });
});

test.describe("Site · como funciona", () => {
  test("no computador, a etapa escolhida troca a conversa e o painel juntos", async ({ page, isMobile }) => {
    test.skip(isMobile, "No celular as quatro etapas aparecem em sequência.");
    await page.goto("/como-funciona");
    const conclusao = page.getByRole("tab", { name: /Conclusão/ });
    await expect(page.getByRole("tab", { name: /Registro/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Sem responsável.")).toBeVisible();
    await conclusao.click();
    await expect(conclusao).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("5. Ficou ótimo, obrigada!")).toBeVisible();
    await expect(page.getByText("Concluído em 5 dias, ter 16:05.")).toBeVisible();
    await expect(page.getByText("Sem responsável.")).toBeHidden();
    // Setas do teclado, como manda o padrão de abas.
    await conclusao.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /Registro/ })).toBeFocused();
    await expect(page.getByText("Sem responsável.")).toBeVisible();
  });

  test("no celular, as quatro etapas aparecem uma embaixo da outra", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Só no celular.");
    await page.goto("/como-funciona");
    await expect(page.getByRole("tablist")).toBeHidden();
    for (const nome of ["Registro", "Responsável e retorno", "Andamento", "Conclusão"]) {
      await expect(page.getByRole("heading", { level: 2, name: nome, exact: true })).toBeVisible();
    }
  });
});

test.describe("Site · preços", () => {
  test("Mensal e Anual trocam o valor e a implantação", async ({ page }) => {
    await page.goto("/precos");
    const faixa = page.locator(".faixa-preco").first();
    await expect(faixa).toContainText("R$ 199");
    await expect(faixa).toContainText("Implantação R$ 600");
    await page.getByRole("button", { name: "Anual" }).click();
    await expect(page.getByRole("button", { name: "Anual" })).toHaveAttribute("aria-pressed", "true");
    await expect(faixa).toContainText("R$ 182");
    await expect(faixa).toContainText("Implantação grátis no anual");
    await expect(page.locator("#explica-forma")).toContainText("12 meses pelo preço de 11");
  });
});

test.describe("Site · demonstração", () => {
  test("sem os campos, mostra o que falta e põe o foco no primeiro", async ({ page }) => {
    await page.goto("/demonstracao");
    await page.getByRole("button", { name: "Pedir demonstração" }).click();
    await expect(page.getByRole("alert")).toContainText("Faltam alguns campos.");
    await expect(page.getByLabel(/Seu nome/)).toBeFocused();
    await expect(page.getByLabel(/Seu nome/)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Falta o WhatsApp, com DDD.")).toBeVisible();
    await semErroDeAcessibilidade(page);
  });

  test("com os quatro campos, guarda, confirma com a mesma promessa e oferece o WhatsApp", async ({ page }) => {
    let enviado: Record<string, unknown> = {};
    await page.route("**/api/demonstracao", async (rota) => {
      enviado = rota.request().postDataJSON();
      await rota.fulfill({ json: { ok: true, horario: "09:12", whatsapp: "(61) 9 ••••-0412" } });
    });
    await page.goto("/demonstracao");
    await page.getByLabel(/Seu nome/).fill("Carlos Lima");
    await page.getByLabel(/WhatsApp/).fill("(61) 99999-0412");
    await page.getByLabel(/Condomínio/).fill("Residencial Ipê, Brasília");
    await page.getByLabel(/Quantas unidades/).selectOption("41 a 100");
    await page.getByLabel(/Autorizo o uso destes dados/).check();
    await page.getByRole("button", { name: "Pedir demonstração" }).click();
    const conf = page.getByRole("status");
    await expect(conf).toContainText("Pedido recebido, Carlos.");
    await expect(conf).toContainText("Residencial Ipê, Brasília (41 a 100 unidades) às 09:12 de hoje");
    await expect(conf).toContainText("até o fim do próximo dia útil");
    const zap = page.getByRole("link", { name: "Falar agora pelo WhatsApp" });
    await expect(zap).toHaveAttribute("href", /wa\.me\/5561900000000\?text=.*Residencial/);
    expect(enviado).toMatchObject({ nome: "Carlos Lima", unidades: "41 a 100", consentimento: true });
    await semErroDeAcessibilidade(page);
  });

  test("se o envio falhar, avisa e deixa tentar de novo", async ({ page }) => {
    await page.route("**/api/demonstracao", (rota) => rota.fulfill({ status: 503, json: { ok: false, erro: "envio" } }));
    await page.goto("/demonstracao");
    await page.getByLabel(/Seu nome/).fill("Carlos");
    await page.getByLabel(/WhatsApp/).fill("61999990412");
    await page.getByLabel(/Condomínio/).fill("Ipê");
    await page.getByLabel(/Quantas unidades/).selectOption("Até 40");
    await page.getByLabel(/Autorizo o uso destes dados/).check();
    await page.getByRole("button", { name: "Pedir demonstração" }).click();
    await expect(page.getByRole("alert")).toContainText("Não conseguimos guardar o seu pedido agora.");
    await expect(page.getByRole("button", { name: "Pedir demonstração" })).toBeEnabled();
  });

  test("a API recusa pedido incompleto", async ({ request }) => {
    const r = await request.post("/api/demonstracao", { data: { nome: "C" } });
    expect(r.status()).toBe(422);
    expect((await r.json()).erros.whatsapp).toBeTruthy();
  });
});
