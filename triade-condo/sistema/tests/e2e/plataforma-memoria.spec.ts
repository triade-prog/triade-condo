// Documentos e memória (DC15, decisões A.1 a D.1 de 22/10/2026; MP-12, MP-14, CT-02, CT-03, CT-04)
// com a API falsa: o trilho das cinco partes e os endereços antigos, o prontuário com os atalhos,
// Enviar documento, Ligar um que já existe e a versão nova, a linha do tempo com Filtros e a
// anotação corrigida, o manual com Mais ações e o mural, o dossiê na própria tela e a exportação,
// e o cartão Vencimentos do Início dizendo qual é o item. Cada tela passa no axe (WCAG 2.2 AA) no
// celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { abrirArea } from "./inicio";
import { MURAL_FALSO } from "./api-falsa-comunicados";

const PLATAFORMA = "http://localhost:3000";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
/** A data daqui a n dias, no fuso de Brasília, como o campo de data pede (aaaa-mm-dd). */
const dia = (n: number) => new Date(Date.now() - 3 * 3600_000 + n * 86400_000).toISOString().slice(0, 10);
const curta = (iso: string) => iso.split("-").reverse().join("/");

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

async function abrir(page: Page, parte = "prontuario") {
  await page.goto(`${PLATAFORMA}/documentos/${parte}`);
  await expect(page.getByRole("heading", { name: "Documentos e memória", level: 1 })).toBeVisible();
}

/** A linha do item no prontuário (a lista de um grupo). */
const item = (page: Page, nome: string) => page.getByRole("listitem").filter({ has: page.getByRole("button", { name: nome, exact: true }) });

test.describe("Documentos e memória", () => {
  test("A.1: o trilho leva às cinco partes e os endereços antigos chegam na parte certa", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrir(page, "linha");
    const trilho = page.getByRole("navigation", { name: "Partes de Documentos e memória" });
    await expect(trilho.getByRole("link", { name: "Linha do tempo" })).toHaveAttribute("aria-current", "page");
    await expect(trilho.getByRole("link", { name: /Prontuário/ })).toContainText("2");
    await trilho.getByRole("link", { name: /Manual do prédio/ }).click();
    await expect(page).toHaveURL(/\/documentos\/manual$/);
    await conferir(page);

    await page.goto(`${PLATAFORMA}/memoria?aba=exportar`);
    await expect(page).toHaveURL(/\/documentos\/passagem$/);
    await page.goto(`${PLATAFORMA}/memoria`);
    await expect(page).toHaveURL(/\/documentos\/prontuario$/);
    await page.goto(`${PLATAFORMA}/comunicados/documentos?filtro=CONTRATOS`);
    await expect(page).toHaveURL(/\/documentos\?filtro=CONTRATOS$/);
    await expect(page.getByRole("heading", { name: "Dos prestadores · só para ler" })).toBeVisible();
  });

  test("MP-12: os atalhos filtram o prontuário e a linha inteira abre o item", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrir(page);
    const atalhos = page.getByRole("group", { name: "Atalhos do prontuário" });
    await expect(page.getByRole("heading", { name: "10 itens · 9 valem para o prédio" })).toBeVisible();
    await expect(item(page, "AVCB (Corpo de Bombeiros)").getByText(`Venceu em ${curta(dia(-16)).slice(0, 5)}`).filter({ visible: true })).toBeVisible();
    await expect(item(page, "Apólice do seguro obrigatório").getByText("Vence em 43 dias").filter({ visible: true })).toBeVisible();
    await expect(item(page, "Para-raios (SPDA)").getByText("Laudo SPDA 2026 está em Documentos e não está ligado").filter({ visible: true })).toBeVisible();
    await expect(item(page, "Limpeza da caixa d'água e potabilidade").getByText("Prédio sem poço; a água vem da Caesb").filter({ visible: true })).toBeVisible();
    await conferir(page);

    await atalhos.getByRole("button", { name: /Faltam/ }).click();
    await expect(atalhos.getByRole("button", { name: /Faltam/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/ver=FALTA/);
    await expect(page.getByRole("button", { name: "Convenção", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Plantas aprovadas", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Limpar" }).click();
    await expect(page.getByRole("button", { name: "Convenção", exact: true })).toBeVisible();

    // Não se aplica fica em Mais ações, dentro do item.
    await page.getByRole("button", { name: "Plantas aprovadas", exact: true }).click();
    const p = page.getByRole("dialog", { name: "Plantas aprovadas" });
    await expect(p.getByText("Na prefeitura ou com a construtora", { exact: false })).toBeVisible();
    await conferir(page);
    await p.getByRole("button", { name: "Mais ações" }).click();
    await p.getByRole("button", { name: "Não se aplica a este prédio" }).click();
    const n = page.getByRole("dialog", { name: "Plantas aprovadas: não se aplica" });
    await n.getByRole("button", { name: "Salvar" }).click();
    await expect(n.getByText("Explique o motivo (de 3 a 500 caracteres).")).toBeVisible();
    await n.getByLabel("Por que não se aplica").fill("Prédio antigo, plantas guardadas na prefeitura");
    await n.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Plantas aprovadas: não se aplica.")).toBeVisible();
    await expect(item(page, "Plantas aprovadas").getByText("Prédio antigo, plantas guardadas na prefeitura").filter({ visible: true })).toBeVisible();
  });

  test("B.1: Enviar documento guarda o arquivo em Documentos e já liga ao item", async ({ page }) => {
    test.slow();
    await instalarApiPlataformaFalsa(page);
    await abrir(page);
    // O botão principal abre o primeiro item que falta.
    await page.getByRole("button", { name: "Enviar o que falta" }).click();
    await expect(page.getByRole("dialog", { name: "Enviar documento" }).getByText("Vai ligar ao item Regimento interno")).toBeVisible();
    await page.getByRole("dialog", { name: "Enviar documento" }).getByRole("button", { name: "Cancelar" }).click();

    await item(page, "Inspeção dos elevadores").getByRole("button", { name: "Enviar documento: Inspeção dos elevadores" }).click();
    const j = page.getByRole("dialog", { name: "Enviar documento" });
    await expect(j.getByLabel("Título")).toHaveValue("Inspeção dos elevadores");
    await expect(j.getByLabel("Tipo")).toHaveValue("LAUDO");
    await expect(j.getByRole("button", { name: "Guardar e ligar ao item" })).toBeDisabled();
    await j.getByLabel("Arquivo").setInputFiles({ name: "elevadores-2026.pdf", mimeType: "application/pdf", buffer: PDF });
    await j.getByLabel("Vale até").fill(dia(200));
    await conferir(page);
    await j.getByRole("button", { name: "Guardar e ligar ao item" }).click();
    await expect(page.getByText("Inspeção dos elevadores: documento guardado em Documentos e ligado ao item.")).toBeVisible();
    await expect(item(page, "Inspeção dos elevadores").getByText("Em dia").filter({ visible: true })).toBeVisible();

    // O documento novo está em Documentos e a ficha diz a qual item ele vale.
    await page.goto(`${PLATAFORMA}/documentos`);
    await expect(page.getByText("No prontuário: Inspeção dos elevadores")).toBeVisible();
    await page.getByRole("link", { name: "Inspeção dos elevadores" }).click();
    const cartao = page.getByRole("region", { name: "No prontuário" });
    await expect(cartao.getByRole("link", { name: "Inspeção dos elevadores" })).toBeVisible();
    await conferir(page);
  });

  test("MP-12: ligar um que já existe, a sugestão do documento parecido e a versão nova do vencido", async ({ page }) => {
    test.slow();
    await instalarApiPlataformaFalsa(page);
    // O Regimento interno está em Documentos, solto: a lista sugere ligar ao item que falta.
    await page.goto(`${PLATAFORMA}/documentos`);
    await page.getByRole("link", { name: "Parece o do item Regimento interno. Ligar?" }).click();
    const l = page.getByRole("dialog", { name: "Ligar um documento que já existe" });
    await expect(l.getByText("Do mesmo tipo: regimento")).toBeVisible();
    await expect(l.getByRole("radio", { name: /Regimento interno/ })).toBeChecked();
    await conferir(page);
    await l.getByRole("button", { name: "Ligar ao item" }).click();
    await expect(page.getByText("Regimento interno: Regimento interno ligado ao item.")).toBeVisible();

    // No item que falta, o laudo do mesmo tipo aparece com Ligar este.
    await page.getByRole("button", { name: "Para-raios (SPDA)", exact: true }).click();
    const s = page.getByRole("dialog", { name: "Para-raios (SPDA)" });
    await s.getByRole("button", { name: "Ligar este" }).click();
    await expect(page.getByText("Para-raios (SPDA): Laudo SPDA 2026 ligado ao item.")).toBeVisible();
    await expect(item(page, "Para-raios (SPDA)").getByText(`Laudo SPDA 2026 · até ${curta(dia(290))}`)).toBeVisible();

    // O AVCB vencido passa para o AVCB guardado em Documentos e recebe a versão nova.
    await page.getByRole("button", { name: "AVCB (Corpo de Bombeiros)", exact: true }).click();
    const a = page.getByRole("dialog", { name: "AVCB (Corpo de Bombeiros)" });
    await a.getByRole("button", { name: "Mais ações" }).click();
    await a.getByRole("button", { name: "Trocar o documento" }).click();
    const t = page.getByRole("dialog", { name: "Ligar um documento que já existe" });
    await expect(t.getByText("Ligado a AVCB (Corpo de Bombeiros)")).toHaveCount(0);
    await t.getByRole("radio", { name: /^AVCB Laudo/ }).check();
    await t.getByRole("button", { name: "Ligar ao item" }).click();
    await expect(item(page, "AVCB (Corpo de Bombeiros)").getByText("Vence em 42 dias").filter({ visible: true })).toBeVisible();
    await item(page, "AVCB (Corpo de Bombeiros)").getByRole("button", { name: "Enviar a versão nova: AVCB (Corpo de Bombeiros)" }).click();
    const v = page.getByRole("dialog", { name: "Enviar a versão nova" });
    await v.getByLabel("Arquivo").setInputFiles({ name: "avcb-2026.pdf", mimeType: "application/pdf", buffer: PDF });
    await v.getByLabel("Vale até").fill(dia(365));
    await conferir(page);
    await v.getByRole("button", { name: "Guardar a versão nova" }).click();
    await expect(page.getByText(`AVCB (Corpo de Bombeiros): versão nova guardada, vale até ${curta(dia(365))}.`)).toBeVisible();
    await expect(item(page, "AVCB (Corpo de Bombeiros)").getByText("Em dia").filter({ visible: true })).toBeVisible();
  });

  test("CT-03: a linha do tempo filtra numa janela e a anotação corrigida guarda a versão anterior", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrir(page, "linha");
    await expect(page.getByRole("link", { name: "Manutenção concluída: troca da bomba de recalque" })).toBeVisible();
    await expect(page.getByText("Ana Souza assume a sindicatura")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Filtros" }).click();
    const f = page.getByRole("dialog", { name: "Filtros" });
    await f.getByRole("radio", { name: /Anotado/ }).check();
    await conferir(page);
    await f.getByRole("button", { name: "Mostrar" }).click();
    await expect(page.getByText("Mostrando: Anotado")).toBeVisible();
    await expect(page).toHaveURL(/filtro=ANOTADO/);
    await expect(page.getByText("Ana Souza assume a sindicatura")).toHaveCount(0);

    await page.getByRole("button", { name: "Anotar na memória" }).click();
    const j = page.getByRole("dialog", { name: "Anotar na memória" });
    await j.getByRole("button", { name: "Decisão" }).click();
    await j.getByLabel("Título").fill("Impermeabilização da garagem aprovada");
    await j.getByLabel("O que ficou registrado").fill("AGO aprovou a obra em duas etapas, começando pelo subsolo 2.");
    await conferir(page);
    await j.getByRole("button", { name: "Anotar" }).click();
    await expect(page.getByText("Anotado na memória do prédio.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Impermeabilização da garagem aprovada" })).toBeVisible();

    await page.getByRole("button", { name: "Vizinho do lote 12 divide o muro" }).click();
    const a = page.getByRole("dialog", { name: /Vizinho do lote 12/ });
    await a.getByRole("button", { name: "Corrigir" }).click();
    const c = page.getByRole("dialog", { name: "Corrigir anotação" });
    await c.getByLabel("O que ficou registrado").fill("Cada lado paga metade. Revisão do combinado em 2027.");
    await c.getByRole("button", { name: "Salvar correção" }).click();
    await expect(page.getByText("Anotação corrigida. A versão anterior ficou guardada.")).toBeVisible();
    await page.getByRole("button", { name: "Vizinho do lote 12 divide o muro" }).click();
    await expect(page.getByRole("heading", { name: "Versões anteriores" })).toBeVisible();
    await expect(page.getByText("Cada lado paga metade da pintura e dos reparos do muro divisório.")).toBeVisible();
    await conferir(page);
  });

  test("MP-14: o manual escreve seções, sobe e desce em Mais ações, e só as marcadas vão ao mural", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrir(page, "manual");
    await expect(page.getByRole("heading", { name: "2 seções" })).toBeVisible();
    await expect(page.getByText("1 no mural dos moradores")).toBeVisible();
    await conferir(page);
    const sugestoes = page.getByRole("button", { name: /sugestões para escrever/ });
    await expect(sugestoes).toHaveAttribute("aria-expanded", "false");
    await sugestoes.click();
    await page.getByRole("button", { name: "Lixo e coleta seletiva", exact: true }).click();
    const j = page.getByRole("dialog", { name: "Nova seção do manual" });
    await j.getByLabel("Texto").fill("Orgânico todos os dias até as 20h no contêiner verde. Reciclável às terças e sextas.");
    await j.getByLabel(/Mostrar no mural do prédio/).check();
    await conferir(page);
    await j.getByRole("button", { name: "Salvar seção" }).click();
    await expect(page.getByText("Seção escrita: Lixo e coleta seletiva.")).toBeVisible();
    await page.getByRole("button", { name: "Mais ações: Lixo e coleta seletiva" }).click();
    await expect(page.getByRole("button", { name: "Descer Lixo e coleta seletiva" })).toHaveCount(0);
    await page.getByRole("button", { name: "Subir Lixo e coleta seletiva" }).click();
    await page.getByRole("button", { name: "Mais ações: Água e gás" }).click();
    await page.getByRole("link", { name: /Ver no mural/ }).click();
    await expect(page).toHaveURL(/\/comunicados\/no-mural\?aba=manual$/);

    await page.goto(`${PLATAFORMA}/m/${MURAL_FALSO}`);
    await page.getByRole("button", { name: "Manual do prédio" }).click();
    await expect(page.getByRole("heading", { name: "Água e gás" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lixo e coleta seletiva" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Casa de máquinas" })).toHaveCount(0);
    await conferir(page);
  });

  test("CT-02: o dossiê mostra antes o que vai nele e, gerado, abre na própria tela com a data inteira", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrir(page, "passagem");
    const vai = page.getByRole("region", { name: "Dossiê de passagem de bastão" });
    await expect(vai.getByText("O que vai no dossiê hoje")).toBeVisible();
    await expect(vai.getByText("AVCB (Corpo de Bombeiros) venceu", { exact: false })).toBeVisible();
    await expect(vai.getByText("2 seções")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Gerar dossiê" }).click();
    await expect(page).toHaveURL(/\/documentos\/dossie\?id=.+&novo=1$/);
    await expect(page.getByText("Dossiê gerado", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dossiê de passagem de bastão" })).toBeVisible();
    await expect(page.getByText("2026-0034 · Barulho na casa de bombas", { exact: false })).toBeVisible();
    await expect(page.getByText("Senhas de serviços de fora", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Casa de máquinas (só a gestão)" })).toBeVisible();
    // A data de "Quem tem acesso hoje" sai inteira, com o ano.
    await expect(page.getByText(/desde \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimir ou salvar em PDF" })).toBeVisible();
    await conferir(page);
    await page.getByRole("link", { name: "Passagem e exportação" }).first().click();
    await expect(page.getByRole("link", { name: /Abrir o dossiê de/ })).toBeVisible();
  });

  test("CT-04: a exportação é pedida, montada em segundo plano e mostra os pacotes", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await abrir(page, "passagem");
    await expect(page.getByText("Tem dados pessoais dos moradores")).toBeVisible();
    await page.getByRole("button", { name: "Pedir exportação" }).click();
    await expect(page.getByText("Exportação pedida.", { exact: false })).toBeVisible();
    await expect(page.getByText("Montando", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Dados (2,4 MB)" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Arquivos 1 de 1/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pedir exportação" })).toBeDisabled();
    await conferir(page);
  });

  test("CF-03: quem só vê os documentos não vê Passagem e exportação nem mexe no prontuário", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await abrir(page);
    const trilho = page.getByRole("navigation", { name: "Partes de Documentos e memória" });
    await expect(trilho.getByRole("link", { name: /Prontuário/ })).toBeVisible();
    await expect(trilho.getByRole("link", { name: /Passagem/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enviar o que falta" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Enviar documento/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Convenção", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Convenção" }).getByText("o síndico precisa dar a você a permissão Cuidar dos documentos", { exact: false })).toBeVisible();
    await page.goto(`${PLATAFORMA}/documentos/passagem`);
    await expect(trilho.getByRole("link", { name: /Prontuário/ })).toHaveAttribute("aria-current", "page");
    await conferir(page);
  });

  test("MP-05: Vencimentos no Início diz qual é o item e não repete o documento ligado", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(PLATAFORMA);
    const v = await abrirArea(page, "Vencimentos");
    await expect(v.getByText(`AVCB (Corpo de Bombeiros) venceu em ${curta(dia(-16)).slice(0, 5)}`)).toBeVisible();
    await expect(v.getByText("Apólice do seguro obrigatório vence em 43 dias")).toBeVisible();
    await expect(v.getByText(/^Contrato da .+ vence em \d+ dias$/)).toBeVisible();
    await expect(v.getByRole("link", { name: "e mais 1 vencendo e 6 itens que faltam no prontuário" })).toBeVisible();
    await conferir(page);
    await v.getByRole("link", { name: "Abrir: AVCB (Corpo de Bombeiros)" }).click();
    await expect(page.getByRole("dialog", { name: "AVCB (Corpo de Bombeiros)" })).toBeVisible();
  });
});
