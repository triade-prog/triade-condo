// Comunicados e documentos (peça R1; CD-01, CD-02, CD-04 a CD-07, CD-09, CD-11, MP-12) com a API
// falsa. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Plataforma do síndico · comunicados e documentos", () => {
  test("CD-01, CD-06: a lista em uso com os atalhos; o início mostra o cartão", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/`);
    const cartao = page.getByRole("region", { name: /^Comunicados e documentos/ });
    await expect(cartao).toContainText("1 rascunho parado há mais de 3 dias");
    await expect(cartao).toContainText("AVCB vence em 42 dias");

    const menu = page.getByRole("button", { name: "Mais", exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("navigation", { name: "Plataforma" }).getByRole("link", { name: "Comunicados", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Comunicados" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Falta de água na quinta" })).toBeVisible();
    await expect(page.getByText("Pedido 2026-0001")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: /Rascunhos parados há mais de 3 dias · 1/ }).click();
    await expect(page).toHaveURL(/atencao=RASCUNHOS_PARADOS/);
    await expect(page.getByRole("link", { name: "Falta de água na quinta" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Assembleia geral ordinária: convocação" })).toBeVisible();
  });

  test("CD-02, CD-01: escrever mostra quem recebe e publica com a assinatura", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados`);
    await page.getByRole("link", { name: "+ Escrever comunicado" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Escrever comunicado" })).toBeVisible();
    await expect(page.getByText("3 contatos de 2 unidades")).toBeVisible();
    await expect(page.getByText(/unidades sem ninguém que recebe/)).toBeVisible();
    await page.getByRole("group", { name: "Para quem" }).getByRole("button", { name: "Blocos" }).click();
    await page.getByRole("checkbox", { name: "Torre B" }).check();
    await expect(page.getByText("Ninguém recebe")).toBeVisible();
    await page.getByRole("checkbox", { name: "Torre A" }).check();
    await expect(page.getByText("3 contatos de 2 unidades")).toBeVisible();
    await page.getByRole("button", { name: "Ver quem" }).click();
    await expect(page.getByText("Marina Souza")).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByText("De 3 a 120 caracteres.")).toBeVisible();
    await page.getByLabel("Título").fill("Dedetização das áreas comuns");
    await page.getByRole("textbox", { name: "Texto", exact: true }).fill("Na segunda, das 8h às 12h. Mantenham os animais dentro de casa.");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dedetização das áreas comuns" })).toBeVisible();
    await expect(page.getByText("Comunicado publicado.")).toBeVisible();
    await expect(page.getByText("Ana, síndica do Residencial Ipê")).toBeVisible();
    await expect(page.getByText("Torre A, Torre B · 3 contatos na publicação")).toBeVisible();
    await conferir(page);
  });

  test("CD-06: programar pede dia e hora e avisa o horário sem envio", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados/escrever`);
    await page.getByLabel("Título").fill("Lavagem da garagem");
    await page.getByRole("textbox", { name: "Texto", exact: true }).fill("No sábado, das 7h às 11h. Tirem os carros.");
    await page.getByRole("group", { name: "Quando" }).getByRole("button", { name: "Programar" }).click();
    const amanha = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
    await page.getByLabel("Dia e hora").fill(`${amanha}T22:00`);
    await expect(page.getByText(/cai no horário sem envio \(21:00 às 08:00\)/)).toBeVisible();
    await page.getByLabel("Dia e hora").fill(`${amanha}T09:00`);
    await conferir(page);
    await page.getByRole("button", { name: "Programar", exact: true }).last().click();
    await expect(page.getByText("Comunicado programado. Ele é publicado sozinho na hora marcada.")).toBeVisible();
    await expect(page.getByText(/^Programado para/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toBeVisible();
  });

  test("CD-01: publicado não se edita; corrigir vira a versão 2 e guarda a 1; copiar fica no histórico", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados`);
    await page.getByRole("link", { name: "Falta de água na quinta" }).click();
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
    await page.getByRole("button", { name: "Copiar texto" }).click();
    await expect(page.getByText("Texto copiado, com o título e a assinatura.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Histórico" })).toContainText("Texto copiado");
    await conferir(page);

    await page.getByRole("button", { name: "Corrigir" }).click();
    const j = page.getByRole("dialog", { name: "Corrigir comunicado" });
    await j.getByLabel("Título").fill("Falta de água na quinta, das 9h às 13h");
    await j.getByRole("button", { name: "Publicar versão 2" }).click();
    await expect(j.getByText("Diga o que mudou, de 3 a 500 caracteres.")).toBeVisible();
    await j.getByRole("textbox", { name: "O que mudou" }).fill("Horário corrigido: termina às 13h");
    await conferir(page);
    await j.getByRole("button", { name: "Publicar versão 2" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Falta de água na quinta, das 9h às 13h" })).toBeVisible();
    await expect(page.getByText("Versão 2", { exact: true }).first()).toBeVisible();
    const versoes = page.getByRole("region", { name: "Versões" });
    await expect(versoes).toContainText("Horário corrigido: termina às 13h");
    await versoes.getByRole("link", { name: "Versão 1" }).click();
    await expect(page.getByText("Esta versão foi trocada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Copiar texto" })).toHaveCount(0);
  });

  test("CD-01: arquivar pede motivo e tira da lista em uso", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados`);
    await page.getByRole("link", { name: "Assembleia geral ordinária: convocação" }).click();
    await page.getByRole("button", { name: "Arquivar" }).click();
    const j = page.getByRole("dialog", { name: "Arquivar comunicado" });
    await j.getByRole("button", { name: "Arquivar" }).click();
    await expect(j.getByText("Diga o motivo, de 3 a 500 caracteres.")).toBeVisible();
    await j.getByLabel("Por que arquivar").fill("Assembleia remarcada");
    await j.getByRole("button", { name: "Arquivar" }).click();
    await expect(page.getByText("Comunicado arquivado.")).toBeVisible();
    await page.goto(`${PLATAFORMA}/comunicados`);
    await expect(page.getByRole("link", { name: "Assembleia geral ordinária: convocação" })).toHaveCount(0);
  });

  test("CD-05: o pedido mostra o comunicado ligado e abre um rascunho já ligado", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/pedidos`);
    await page.getByRole("link", { name: /2026-0001/ }).first().click();
    const ligados = page.getByRole("region", { name: "Comunicados" });
    await expect(ligados).toContainText("Falta de água na quinta");
    await expect(ligados).toContainText("Comunicar o prédio não conta como retorno ao morador do pedido.");
    await ligados.getByRole("link", { name: "+ Escrever comunicado" }).click();
    await expect(page.getByRole("combobox", { name: "Pedido" })).toHaveValue(/.+/);
    await conferir(page);
  });

  test("CD-07, CD-04, MP-12: documentos com versão em vigor, validade e nova versão", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/comunicados/documentos`);
    await expect(page.getByRole("heading", { level: 1, name: "Documentos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Regimento interno" })).toBeVisible();
    await expect(page.getByText("vence em 42 dias")).toBeVisible();
    await expect(page.getByText("Só quem cuida")).toBeVisible();
    await conferir(page);

    await page.getByRole("link", { name: "Regimento interno" }).click();
    await expect(page.getByText("Versão 1 em vigor")).toBeVisible();
    await page.getByRole("button", { name: "Nova versão" }).click();
    const j = page.getByRole("dialog", { name: /Nova versão de Regimento interno/ });
    await j.getByLabel("Arquivo").setInputFiles({ name: "regimento-v2.pdf", mimeType: "application/pdf", buffer: PDF });
    const depois = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
    await j.getByLabel("Em vigor desde").fill(depois);
    await expect(j.getByText(/A versão 1 continua valendo até/)).toBeVisible();
    await j.getByRole("button", { name: "Guardar versão" }).click();
    await expect(j.getByText("Diga o que mudou, de 3 a 500 caracteres.")).toBeVisible();
    await j.getByLabel(/O que mudou/).fill("Regras para carregadores de carro elétrico");
    await conferir(page);
    await j.getByRole("button", { name: "Guardar versão" }).click();
    await expect(page.getByText(/Versão guardada. Passa a valer em/)).toBeVisible();
    await expect(page.getByText(/A versão 2 passa a valer em/)).toBeVisible();
    await expect(page.getByText("Versão 1 em vigor")).toBeVisible();
    await conferir(page);
  });

  test("CD-04: quem só vê não guarda documento nem vê o restrito, e não escreve comunicado", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { quem: "SO_VE" });
    await page.goto(`${PLATAFORMA}/comunicados/documentos`);
    await expect(page.getByRole("link", { name: "Regimento interno" })).toBeVisible();
    await expect(page.getByRole("link", { name: "AVCB" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ Novo documento" })).toHaveCount(0);
    await page.goto(`${PLATAFORMA}/comunicados`);
    await expect(page.getByRole("link", { name: "Falta de água na quinta" })).toBeVisible();
    await expect(page.getByRole("link", { name: "+ Escrever comunicado" })).toHaveCount(0);
    await conferir(page);
  });

  test("CD-11: o plano de comunicação nas Configurações", async ({ page }) => {
    await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes?aba=comunicados`);
    const assuntos = page.getByRole("group", { name: "Assuntos em uso" });
    await expect(assuntos.getByRole("checkbox", { name: "Assembleia e convocação" })).toBeChecked();
    for (const a of ["Aviso geral", "Obras e manutenção", "Segurança", "Assembleia e convocação", "Lembrete"]) {
      await assuntos.getByRole("checkbox", { name: a }).uncheck();
    }
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Deixe pelo menos um assunto em uso.")).toBeVisible();
    await assuntos.getByRole("checkbox", { name: "Obras e manutenção" }).check();
    await page.getByLabel("O que o morador recebe e quando").fill("Avisos de obra com 2 dias de antecedência.");
    await conferir(page);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Plano de comunicação salvo.")).toBeVisible();
    await page.goto(`${PLATAFORMA}/comunicados/escrever`);
    await expect(page.getByText("Avisos de obra com 2 dias de antecedência.")).toBeVisible();
    await expect(page.getByRole("group", { name: "Assunto" }).getByRole("button")).toHaveCount(1);
  });
});
