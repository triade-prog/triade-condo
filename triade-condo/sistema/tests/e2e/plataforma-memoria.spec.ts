// Memória do prédio (peça R10; MP-12, MP-14, CT-02, CT-03, CT-04) com a API falsa: prontuário,
// linha do tempo com anotação, manual com a aba no mural, dossiê para imprimir e exportação.
// Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { abrirArea } from "./inicio";
import { MURAL_FALSO } from "./api-falsa-comunicados";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function abrir(page: Page, aba = "prontuario") {
  await page.goto(`${PLATAFORMA}/memoria?aba=${aba}`);
  await expect(page.getByRole("heading", { name: "Memória do prédio", level: 1 })).toBeVisible();
}

test.describe("Memória do prédio", () => {
  test("MP-12: o prontuário mostra a situação de cada item e liga documento ou marca que não se aplica", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    await expect((await abrirArea(page, "Vencimentos")).getByText("1 item do prontuário venceu")).toBeVisible();
    await abrir(page);
    await expect(page.getByText("Venceu", { exact: true })).toBeVisible();
    await expect(page.getByText("Vence em 43 dias")).toBeVisible();
    await expect(page.getByText("Não se aplica: Prédio sem poço; a água vem da Caesb")).toBeVisible();
    await expect(page.getByText("4 com contrato · Aqualimp até", { exact: false })).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Para-raios (SPDA)" }).click();
    const j = page.getByRole("dialog", { name: "Para-raios (SPDA)" });
    await j.getByRole("button", { name: "Ligar documento" }).click();
    await j.getByRole("button", { name: "Ligar" }).click();
    await expect(j.getByText("Escolha um documento guardado em Documentos.")).toBeVisible();
    await j.getByLabel("Documento").selectOption({ label: "Laudo SPDA 2026 · vale até " + new Date(Date.now() - 3 * 3600_000 + 290 * 86400_000).toISOString().slice(0, 10).split("-").reverse().join("/") });
    await conferir(page);
    await j.getByRole("button", { name: "Ligar" }).click();
    await expect(page.getByText("Para-raios (SPDA): documento ligado.")).toBeVisible();
    await expect(page.getByText("Laudo SPDA 2026 · versão 1", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Plantas aprovadas" }).click();
    const p = page.getByRole("dialog", { name: "Plantas aprovadas" });
    await p.getByRole("button", { name: "Não se aplica" }).click();
    await p.getByRole("button", { name: "Salvar" }).click();
    await expect(p.getByText("Explique o motivo (de 3 a 500 caracteres).")).toBeVisible();
    await p.getByLabel("Por que não se aplica").fill("Prédio antigo, plantas guardadas na prefeitura");
    await p.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Não se aplica: Prédio antigo", { exact: false })).toBeVisible();
  });

  test("CT-03: a linha do tempo junta o que aconteceu e a anotação corrigida guarda a versão anterior", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrir(page, "linha");
    await expect(page.getByRole("link", { name: "Manutenção concluída: troca da bomba de recalque" })).toBeVisible();
    await expect(page.getByText("Ana Souza assume como síndico")).toBeVisible();
    await page.getByRole("button", { name: "Anotado" }).click();
    await expect(page.getByText("Ana Souza assume como síndico")).toHaveCount(0);
    await conferir(page);

    await page.getByRole("button", { name: "Anotar na memória" }).click();
    const j = page.getByRole("dialog", { name: "Anotar na memória" });
    await j.getByRole("button", { name: "Decisão" }).click();
    await j.getByLabel("Título").fill("Impermeabilização da garagem aprovada");
    await j.getByLabel("O que ficou registrado").fill("AGO aprovou a obra em duas etapas, começando pelo subsolo 2.");
    await conferir(page);
    await j.getByRole("button", { name: "Anotar" }).click();
    await expect(page.getByText("Anotado na memória do prédio.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Decisão: Impermeabilização da garagem aprovada" })).toBeVisible();

    await page.getByRole("button", { name: "Combinado: Vizinho do lote 12 divide o muro" }).click();
    const a = page.getByRole("dialog", { name: /Vizinho do lote 12/ });
    await a.getByRole("button", { name: "Corrigir" }).click();
    const c = page.getByRole("dialog", { name: "Corrigir anotação" });
    await c.getByLabel("O que ficou registrado").fill("Cada lado paga metade. Revisão do combinado em 2027.");
    await c.getByRole("button", { name: "Salvar correção" }).click();
    await expect(page.getByText("Anotação corrigida. A versão anterior ficou guardada.")).toBeVisible();
    await page.getByRole("button", { name: "Combinado: Vizinho do lote 12 divide o muro" }).click();
    await expect(page.getByRole("heading", { name: "Versões anteriores" })).toBeVisible();
    await expect(page.getByText("Cada lado paga metade da pintura e dos reparos do muro divisório.")).toBeVisible();
    await conferir(page);
  });

  test("MP-14: o manual escreve seções e só as marcadas aparecem no mural, sem conta", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrir(page, "manual");
    await expect(page.getByText("No mural", { exact: true })).toBeVisible();
    await expect(page.getByText("Só a gestão", { exact: true })).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Lixo e coleta seletiva" }).click();
    const j = page.getByRole("dialog", { name: "Nova seção do manual" });
    await j.getByLabel("Texto").fill("Orgânico todos os dias até as 20h no contêiner verde. Reciclável às terças e sextas.");
    await j.getByLabel(/Mostrar no mural do prédio/).check();
    await conferir(page);
    await j.getByRole("button", { name: "Salvar seção" }).click();
    await expect(page.getByText("Seção escrita: Lixo e coleta seletiva.")).toBeVisible();
    await page.getByRole("button", { name: "Subir Lixo e coleta seletiva" }).click();

    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}`);
    await page.getByRole("button", { name: "Manual do prédio" }).click();
    await expect(page.getByRole("heading", { name: "Água e gás" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lixo e coleta seletiva" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Casa de máquinas" })).toHaveCount(0);
    await conferir(page);
  });

  test("CT-02: o síndico gera o dossiê de passagem, que abre pronto para imprimir", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrir(page, "passagem");
    // O dossiê abre em outra aba; a API falsa vale só nesta, então ele é aberto aqui pelo link da lista.
    const nova = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Gerar dossiê agora" }).click();
    await (await nova).close();
    await expect(page.getByText("Dossiê gerado.", { exact: false })).toBeVisible();
    await page.goto(`${PLATAFORMA}${await page.getByRole("link", { name: "Abrir" }).getAttribute("href")}`);
    await expect(page.getByRole("heading", { name: "Dossiê de passagem de bastão" })).toBeVisible();
    await expect(page.getByText("2026-0034 · Barulho na casa de bombas", { exact: false })).toBeVisible();
    await expect(page.getByText("Senhas de serviços de fora", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Casa de máquinas (só a gestão)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimir ou salvar em PDF" })).toBeVisible();
  });

  test("CT-04: a exportação é pedida, montada em segundo plano e mostra os pacotes", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrir(page, "exportar");
    await expect(page.getByText("Tem dados pessoais dos moradores")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Pedir exportação" }).click();
    await expect(page.getByText("Exportação pedida.", { exact: false })).toBeVisible();
    await expect(page.getByText("Montando", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Dados (2,4 MB)" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Arquivos 1 de 1/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pedir exportação" })).toBeDisabled();
    await conferir(page);
  });

  test("CF-03: quem não é síndico não vê passagem de bastão nem exportação", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await abrir(page);
    await expect(page.getByRole("tab", { name: "Prontuário" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Passagem de bastão" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Exportar" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Novo item" })).toHaveCount(0);
  });
});
