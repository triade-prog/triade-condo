// Tabela de preços no Console (0295; quadros 268 a 274, aprovados em 24/10/2026) com a API falsa: a
// tabela com fundador e cheia, a janela de mudar com motivo, o simulador com os concorrentes, as
// faixas com o texto para a proposta e o histórico. Quem só vê não muda; a Implantação não entra.
// Cada tela passa no axe e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa } from "./api-falsa";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

const status = (page: Page, texto: string) => page.getByRole("status").filter({ hasText: texto });
const celular = () => test.info().project.name === "celular";
const parte = (page: Page, nome: RegExp) => page.getByRole("tab", { name: nome });

test.describe("Console · tabela de preços", () => {
  test("Tabela: fundador em uso, cheia, implantação, por unidade e sob consulta acima de 400", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/precos`);
    await expect(page.getByRole("heading", { name: "Tabela de preços", level: 1 })).toBeVisible();
    if (celular()) {
      const faixas = page.getByRole("region", { name: "Preços por faixa" });
      await expect(faixas).toContainText("Fundador, por mês");
      await expect(faixas.getByRole("listitem").filter({ hasText: "41 a 100" })).toContainText("R$ 229,00cheia R$ 349,00 · impl. R$ 900,00");
      await expect(faixas).toContainText("Acima de 400 unidades: sob consulta.");
      await expect(page.getByText("Anual: 12 por 11 e implantação isenta. Vagas de fundador: 2 de 5 usadas.")).toBeVisible();
      for (const aba of await page.getByRole("tab").all()) expect((await aba.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(page.getByRole("tab", { name: "Quanto custaria", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Mudar a tabela" })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Tabela de preços" })).toHaveAttribute("aria-current", "page");
      const tabela = page.getByRole("table", { name: "Preços por faixa de unidades ativas" });
      await expect(tabela.getByRole("columnheader", { name: /Fundador · por mês/ })).toContainText("Em uso");
      const linha = tabela.getByRole("row", { name: /41 a 100/ });
      await expect(linha).toContainText("R$ 229,00");
      await expect(linha).toContainText("implantação sem custo");
      await expect(linha).toContainText("R$ 349,00");
      await expect(linha).toContainText("R$ 900,00");
      await expect(linha).toContainText("até 3 vezes; isenta no anual");
      await expect(linha).toContainText("R$ 3,49 no teto (100 un.)");
      await expect(tabela.getByRole("row", { name: /Acima de 400/ })).toContainText("Sob consulta, também para administradoras");
    }
    await expect(page.getByRole("region", { name: "O que vale para um plano novo" })).toContainText("Vagas de fundador: 2 de 5 usadas.");
    await expect(page.getByText("Fundador: travado por 12 meses, só no mensal e só para os 5 primeiros condomínios.")).toBeVisible();
    await expect(page.getByText("Última mudança: 24/10/2026 às 00:12, por Carolina. Motivo: Conferência web de 24/10.")).toBeVisible();
    await conferir(page);
  });

  test("Mudar a tabela pede motivo, deixa vazio como Valor a definir e entra no histórico", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/precos`);
    await page.getByRole("button", { name: "Mudar a tabela" }).click();
    const j = page.getByRole("dialog", { name: "Mudar a tabela de preços" });
    await expect(j.getByRole("radio", { name: "Fundador" })).toBeChecked();
    await expect(j).toContainText("Sob consulta: o plano fica com Valor a definir.");
    await conferir(page);
    await j.getByRole("button", { name: "Salvar a tabela" }).click();
    await expect(j.getByText("Diga o motivo, com pelo menos 3 letras.")).toBeVisible();
    await j.getByLabel("Motivo da mudança").fill("Ajuste da faixa 41 a 100");
    await j.getByRole("button", { name: "Salvar a tabela" }).click();
    await expect(j.getByText("Nada mudou na tabela.")).toBeVisible();

    await j.getByRole("group", { name: "41 a 100" }).getByLabel("Fundador/mês").fill("239,00");
    await j.getByRole("group", { name: "201 a 400" }).getByLabel("Cheia/mês").fill("");
    await j.getByLabel("Vagas de fundador").fill("1");
    await j.getByRole("button", { name: "Salvar a tabela" }).click();
    await expect(j.getByText("Pelo menos 2, as vagas já usadas.")).toBeVisible();
    await j.getByLabel("Vagas de fundador").fill("6");
    await j.getByRole("button", { name: "Salvar a tabela" }).click();
    await expect(status(page, "Tabela salva. Quem já tem plano continua com o valor dele.")).toBeVisible();
    expect(estado.precos.faixas.find((f) => f.codigo === "DE_41_A_100")!.fundador).toBe(23900);
    expect(estado.precos.faixas.find((f) => f.codigo === "DE_201_A_400")!.cheia).toBeUndefined();
    expect(estado.precos.parametros.vagasFundador).toBe(6);
    await expect(page.getByRole("region", { name: "O que vale para um plano novo" })).toContainText("Vagas de fundador: 2 de 6 usadas.");
    if (!celular()) {
      const tabela = page.getByRole("table", { name: "Preços por faixa de unidades ativas" });
      await expect(tabela.getByRole("row", { name: /41 a 100/ })).toContainText("R$ 239,00");
      await expect(tabela.getByRole("row", { name: /201 a 400/ })).toContainText("Valor a definir");
    }

    await parte(page, /Histórico/).click();
    const lista = page.getByRole("list", { name: "Mudanças na tabela" });
    await expect(lista.getByRole("listitem").first()).toContainText("Parâmetros: 5 vagas de fundador para 6 vagas de fundador.");
    await expect(lista.getByRole("listitem").filter({ hasText: "41 a 100: fundador de R$ 229,00 para R$ 239,00." })).toContainText("Carolina · Motivo: Ajuste da faixa 41 a 100");
    await expect(page.getByText("Nada se apaga.")).toBeVisible();
    await conferir(page);
  });

  test("Quanto custaria: campo e controle deslizante, contas da tabela, concorrentes e acima de 400 sob consulta", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/precos`);
    await parte(page, /Quanto custaria/).click();
    const resumo = (nome: string) => page.getByRole("region", { name: nome });
    await expect(page.getByText("100 unidades", { exact: true })).toBeVisible();
    await expect(resumo("1º ano no fundador")).toContainText("R$ 2.748,00");
    await expect(resumo("Fundador por mês")).toContainText("R$ 229,00");
    await expect(resumo("Tabela cheia por mês")).toContainText("implantação R$ 900,00");
    await expect(resumo("1º ano na cheia, mensal")).toContainText("R$ 5.088,00");
    await expect(resumo("1º ano na cheia, anual")).toContainText("R$ 3.839,00");
    await conferir(page);

    await page.getByLabel("Unidades ativas do prédio").fill("32");
    await expect(page.getByText("Faixa: Até 40 unidades")).toBeVisible();
    await expect(page.getByRole("slider", { name: "Unidades ativas, controle deslizante" })).toHaveAttribute("aria-valuetext", "32 unidades, faixa Até 40 unidades");
    await expect(resumo("1º ano no fundador")).toContainText("R$ 1.548,00");
    const barras = page.getByRole("list", { name: "Comparação por mês" });
    const barra = (nome: string) => barras.getByRole("listitem").filter({ hasText: nome });
    await expect(barra("TRÍADE fundador (em uso)")).toContainText("R$ 129,00");
    await expect(barra("TRÍADE tabela cheia")).toContainText("R$ 199,00");
    await expect(barra("SindIA")).toContainText("R$ 197,00");
    await expect(barra("HabitaOne Essencial")).toContainText("R$ 156,80");
    await expect(barra("MeuVizy")).toContainText("a partir de R$ 149,00");
    await expect(barra("Meu Condomínio Pro")).toContainText("≈ R$ 349,00, sem conferência");
    await expect(page.getByText("Preços públicos dos concorrentes conferidos nos sites em 24/10/2026.")).toBeVisible();

    await page.getByRole("button", { name: "Mais 1 unidade" }).click();
    await expect(page.getByLabel("Unidades ativas do prédio")).toHaveValue("33");
    await page.getByRole("slider", { name: "Unidades ativas, controle deslizante" }).fill("450");
    await expect(page.getByText("450 unidades", { exact: true })).toBeVisible();
    await expect(page.getByText("Faixa: acima de 400, sob consulta")).toBeVisible();
    await expect(resumo("Fundador por mês")).toContainText("Valor a definir");
    await expect(barra("TRÍADE fundador (em uso)")).toContainText("sob consulta");
    await expect(barra("SindIA")).toContainText("sob consulta");
    await expect(barra("HabitaOne Profissional")).toContainText("R$ 3.555,00");
    await conferir(page);

    await page.getByRole("button", { name: "Copiar a simulação" }).click();
    await expect(status(page, "Simulação copiada.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Simulação TRÍADE Condo para 450 unidades ativas: acima de 400 unidades, sob consulta.");
  });

  test("Concorrente: cadastrar à mão com fonte e data e arquivar com motivo", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/precos`);
    await parte(page, /Quanto custaria/).click();
    await page.getByRole("button", { name: "Cadastrar preço de concorrente (à mão, com fonte e data)" }).click();
    const j = page.getByRole("dialog", { name: "Cadastrar preço de concorrente" });
    await j.getByRole("button", { name: "Cadastrar preço" }).click();
    await expect(j.getByText("Diga o nome do concorrente.")).toBeVisible();
    await expect(j.getByText("Diga o valor.")).toBeVisible();
    await expect(j.getByText("Diga o motivo, com pelo menos 3 letras.")).toBeVisible();
    await j.getByLabel("Nome").fill("CondoX");
    await j.getByLabel("Preço por mês").fill("199,90");
    await j.getByLabel("Fonte", { exact: true }).fill("condox.com.br/precos");
    await j.getByText("Conferi o preço na fonte oficial").click();
    await j.getByRole("textbox", { name: "Motivo" }).fill("Visto numa proposta do síndico");
    await conferir(page);
    await j.getByRole("button", { name: "Cadastrar preço" }).click();
    await expect(status(page, "Preço de CondoX cadastrado.")).toBeVisible();
    const barras = page.getByRole("list", { name: "Comparação por mês" });
    await expect(barras.getByRole("listitem").filter({ hasText: "CondoX" })).toContainText("≈ R$ 199,90, sem conferência");
    expect(estado.precos.concorrentes.at(-1)).toMatchObject({ nome: "CondoX", modelo: "FIXO", valor: 19990, conferido: false, fonte: "condox.com.br/precos" });

    await page.getByRole("button", { name: "Arquivar: iSindi" }).click();
    const a = page.getByRole("dialog", { name: "Arquivar iSindi?" });
    await a.getByRole("button", { name: "Arquivar" }).click();
    await expect(a.getByText("Diga o motivo, com pelo menos 3 letras.")).toBeVisible();
    await a.getByRole("textbox", { name: "Motivo" }).fill("O site tirou o preço do ar");
    await conferir(page);
    await a.getByRole("button", { name: "Arquivar" }).click();
    await expect(status(page, "iSindi arquivado.")).toBeVisible();
    await expect(barras.getByRole("listitem").filter({ hasText: "iSindi" })).toHaveCount(0);
    await parte(page, /Histórico/).click();
    await expect(page.getByRole("list", { name: "Mudanças na tabela" }).getByRole("listitem").first()).toContainText("Concorrente arquivado: iSindi.");
  });

  test("Faixas e implantação: cartões com os valores da tabela e o texto para a proposta", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/precos`);
    await parte(page, /Faixas/).click();
    await expect(page.getByRole("heading", { name: "Agora: condomínio fundador" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Depois: tabela cheia" })).toBeVisible();
    await expect(page.getByText("Cerca de 35% abaixo da tabela cheia, travado por 12 meses e só para os 5 primeiros condomínios.")).toBeVisible();
    await expect(page.getByText("No teto de cada faixa, o valor por unidade vai de R$ 4,98 (40 un.) a R$ 2,12 (400 un.).")).toBeVisible();
    await expect(page.getByRole("heading", { name: "O que a implantação inclui" })).toBeVisible();
    await expect(page.getByText("Etiquetas e plaquinhas QR, que são serviço à parte.")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Copiar o texto para a proposta" }).click();
    await expect(status(page, "Texto para a proposta copiado.")).toBeVisible();
    const texto = await page.evaluate(() => navigator.clipboard.readText());
    expect(texto).toContain("- 41 a 100: R$ 229,00 por mês, implantação sem custo");
    expect(texto).toContain("- 201 a 400: R$ 849,00 por mês, implantação R$ 2.000,00");
    expect(texto).toContain("Acima de 400 unidades ou para administradoras, sob consulta.");
    expect(texto).toContain("- Apoio documental, que é serviço à parte.");
  });

  test("Quem só vê: sem Mudar a tabela nem cadastro de concorrente; o histórico mostra quem, quando e o motivo", async ({ page }) => {
    await instalarApiFalsa(page, { precos: "ver" });
    await page.goto(`${CONSOLE}/precos`);
    await expect(page.getByText("Só Administração e Financeiro mudam a tabela.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mudar a tabela" })).toHaveCount(0);
    await parte(page, /Quanto custaria/).click();
    await expect(page.getByRole("list", { name: "Comparação por mês" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cadastrar preço de concorrente/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Arquivar/ })).toHaveCount(0);
    await parte(page, /Histórico/).click();
    const itens = page.getByRole("list", { name: "Mudanças na tabela" }).getByRole("listitem");
    await expect(itens).toHaveCount(2);
    await expect(itens.last()).toContainText("24/10/2026 00:10");
    await expect(itens.last()).toContainText("Parâmetros: tabela em uso Fundador; 11 meses pagos no anual; implantação em 3 vezes; 5 vagas de fundador.");
    await expect(itens.last()).toContainText("Carolina · Motivo: Decisão de preço D2");
    await conferir(page);
  });

  test("Implantação não vê a Tabela de preços", async ({ page }) => {
    await instalarApiFalsa(page, { funcao: "IMPLANTACAO" });
    await page.goto(`${CONSOLE}/precos`);
    await expect(page.getByRole("heading", { name: "Tabela de preços", level: 1 })).toBeVisible();
    await expect(page.getByText("Só Administração e Financeiro veem a tabela de preços.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Tabela de preços" })).toHaveCount(0);
    await conferir(page);
  });
});
