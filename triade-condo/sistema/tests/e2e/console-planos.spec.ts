// Planos e pagamentos no Console (PI-03, CF-11, PI-07, PI-08, PI-16, PI-19, NG-06; quadros 241 a
// 252, aprovados em 23/10/2026; "Usar a tabela" de preços, 0295, quadro 272) com a API falsa: contratado e liberado separados, liberar com a
// prévia do que o síndico passa a ter, teste com data, suspender sem perder o histórico, a
// cobrança por competência com recebimento a conferir e o atraso que só avisa. Cada tela passa no
// axe e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa, IPE } from "./api-falsa";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

const status = (page: Page, texto: string) => page.getByRole("status").filter({ hasText: texto });

test.describe("Console · planos e pagamentos", () => {
  test("PI-03 e CF-11: contratado e liberado separados; liberar mostra o que o síndico passa a ter", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    estado.clientes[0]!.sindicos.push({ vinculoId: "6b7c8d9e-0f1a-4b2c-8d3e-4f5a6b7c8d9e", pessoaId: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f", nome: "Ana Souza", desde: "2026-10-16T16:00:00Z" });
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Plano e pagamentos" }).click();
    const lista = page.getByRole("list", { name: "Conjuntos do cliente" });
    await expect(lista.getByRole("listitem").filter({ hasText: "Atendimento" })).toContainText("Base · sempre incluída");
    const manut = lista.getByRole("listitem").filter({ hasText: "Manutenção" });
    await expect(manut).toContainText("Contratado");
    await expect(manut).toContainText("Falta liberar");
    await expect(lista.getByRole("listitem").filter({ hasText: "Vida em condomínio" })).toContainText("Fora do plano");
    await expect(page.getByText("Valor por mês")).toBeVisible();
    await expect(page.getByText("Setembro/2026 em atraso há 44 dias")).toBeVisible();
    await expect(page.getByText("O atraso não bloqueia o condomínio.")).toBeVisible();
    await conferir(page);

    await manut.getByRole("button", { name: "Liberar: Manutenção" }).click();
    const j = page.getByRole("dialog", { name: "Liberar Manutenção" });
    await expect(j).toContainText("O que Ana Souza passa a ter");
    await expect(j).toContainText("Preventivas");
    await conferir(page);
    await j.getByRole("button", { name: "Liberar Manutenção" }).click();
    await expect(j.getByText("Diga o motivo, com pelo menos 3 letras.")).toBeVisible();
    await j.getByRole("textbox", { name: "Motivo" }).fill("Aditivo assinado pela síndica.");
    await j.getByRole("button", { name: "Liberar Manutenção" }).click();
    await expect(status(page, "Manutenção liberado.")).toBeVisible();
    await expect(manut).toContainText("Liberado");
    await expect(manut.getByRole("button", { name: "Suspender: Manutenção" })).toBeVisible();
  });

  test("NG-06 e PI-16: teste com data para acabar; suspender pede por quê e mantém a consulta", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Plano e pagamentos" }).click();
    const lista = page.getByRole("list", { name: "Conjuntos do cliente" });
    const vida = lista.getByRole("listitem").filter({ hasText: "Vida em condomínio" });
    await vida.getByRole("button", { name: "Liberar para teste: Vida em condomínio" }).click();
    const t = page.getByRole("dialog", { name: "Liberar para teste" });
    await expect(t.getByLabel("Termina em")).toHaveAttribute("max", /\d{4}-\d{2}-\d{2}/);
    await t.getByRole("textbox", { name: "Motivo" }).fill("A síndica quer testar as reservas.");
    await conferir(page);
    await t.getByRole("button", { name: "Liberar para teste" }).click();
    await expect(status(page, "Vida em condomínio em teste até")).toBeVisible();
    await expect(vida).toContainText("Em teste até");

    const agenda = lista.getByRole("listitem").filter({ hasText: "Agenda" });
    await agenda.getByRole("button", { name: "Suspender: Agenda" }).click();
    const s = page.getByRole("dialog", { name: "Suspender Agenda" });
    await expect(s).toContainText("Nada se perde");
    await s.getByRole("textbox", { name: "Motivo" }).fill("Pedido da síndica por e-mail.");
    await s.getByRole("button", { name: "Suspender Agenda" }).click();
    await expect(s.getByText("Escolha por quê.")).toBeVisible();
    await s.getByText("Pedido do cliente").click();
    await conferir(page);
    await s.getByRole("button", { name: "Suspender Agenda" }).click();
    await expect(status(page, "Agenda suspenso.")).toBeVisible();
    await expect(agenda).toContainText("Consulta e exportação continuam.");
  });

  test("PI-07 e PI-08: registrar recebimento parcial, conferir e ver a cobrança com o histórico; o atraso só avisa", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/pagamentos`);
    await expect(page.getByRole("heading", { name: "Pagamentos", level: 1 })).toBeVisible();
    await expect(page.getByText("Em atraso é só um aviso: nada bloqueia o condomínio.")).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Registrar recebimento" }).click();
    const r = page.getByRole("dialog", { name: "Registrar recebimento" });
    await r.getByLabel("Valor recebido").fill("200,00");
    await r.getByLabel("Referência do comprovante").fill("E2E-PIX-0001");
    await conferir(page);
    await r.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(status(page, "Recebimento registrado. Ele entra A conferir.")).toBeVisible();

    await page.getByRole("region", { name: "Pagamentos" }).getByRole("button", { name: "Residencial Ipê" }).click();
    const c = page.getByRole("dialog", { name: "Conferir recebimento" });
    await expect(c).toContainText("E2E-PIX-0001");
    await c.getByText("Conferi no extrato da TRÍADE").click();
    await c.getByRole("button", { name: /Confirmar/ }).click();
    await expect(status(page, "Recebimento confirmado.")).toBeVisible();

    await page.goto(`${CONSOLE}/pagamentos/${IPE}/8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d`);
    await expect(page.getByRole("heading", { name: "Residencial Ipê · Setembro/2026" })).toBeVisible();
    await expect(page.getByText("Pago em parte")).toBeVisible();
    await expect(page.getByText("O atraso não bloqueia o condomínio")).toBeVisible();
    await expect(page.getByText("Recebimento confirmado")).toBeVisible();
    await conferir(page);
  });

  test("Usar a tabela preenche o plano sem gravar; trocar o ciclo busca de novo; o PUT leva a tabela", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Plano e pagamentos" }).click();
    await page.getByRole("button", { name: "Editar o plano" }).click();
    const j = page.getByRole("dialog", { name: "Plano do cliente" });
    const caixa = j.getByRole("region", { name: "Pela tabela" });
    await expect(caixa).toContainText("Pela tabela: 42 unidades ativas, faixa 41 a 100");
    await expect(caixa).toContainText("Fundador R$ 229,00 por mês, implantação sem custo. Fundador até Agosto/2027. Este seria o 3º fundador de 5.");
    await expect(j.getByText("Não há tabela de preço fixa.")).toHaveCount(0);
    await expect(j).toContainText("Mudar o plano vale para as competências que ainda não foram abertas; as já abertas se corrigem por ajuste, com motivo.");
    await expect(j).toContainText("Fundador é só mensal.");
    await conferir(page);

    await caixa.getByRole("button", { name: "Usar a tabela" }).click();
    await expect(j.getByLabel("Nome do plano")).toHaveValue("Fundador");
    await expect(j.getByLabel("Faixa de unidades, de")).toHaveValue("41");
    await expect(j.locator("#pl-ate")).toHaveValue("100");
    await expect(j.getByLabel("Valor por mês")).toHaveValue("229,00");
    await expect(j.getByLabel("Implantação sem cobrança")).toBeChecked();
    await expect(j.getByLabel("Preço de fundador até")).toHaveValue("Agosto/2027");
    expect(estado.planos.plano!.nome).toBe("Essencial");
    expect(estado.planos.ultimoPlano).toBeUndefined();
    await conferir(page);

    await j.getByText("Anual", { exact: true }).click();
    await expect(j.getByLabel("Valor por ano")).toHaveValue("3839,00");
    await expect(j.getByLabel("Nome do plano")).toHaveValue("Tabela cheia");
    await expect(j).toContainText("a tabela sugere 11 vezes o mês (41 a 100: R$ 3.839,00 por ano)");
    await expect(j.getByLabel("Preço de fundador até")).toHaveCount(0);
    expect(estado.precos.sugestoes).toContain("ANUAL 2026-09-01");
    await expect(j.getByText("O preço de fundador é só no mensal. No anual vale a tabela cheia, com a implantação isenta.")).toBeVisible();
    await j.getByText("Mensal", { exact: true }).click();
    await expect(j.getByLabel("Valor por mês")).toHaveValue("229,00");
    await expect(j.getByLabel("Nome do plano")).toHaveValue("Fundador");

    await j.getByRole("button", { name: "Salvar o plano" }).click();
    await expect(status(page, "Plano salvo.")).toBeVisible();
    expect(estado.planos.ultimoPlano).toMatchObject({ tabela: "FUNDADOR", nome: "Fundador", valor: 22900, ciclo: "MENSAL", unidadesDe: 41, unidadesAte: 100, implantacaoSemCobranca: true });
  });

  test("Sem vaga de fundador a tabela sugere a cheia e avisa; valor mexido à mão vai como MANUAL", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    estado.precos.vagasUsadas = 5;
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Plano e pagamentos" }).click();
    await page.getByRole("button", { name: "Editar o plano" }).click();
    const j = page.getByRole("dialog", { name: "Plano do cliente" });
    await expect(j.getByText("As vagas de fundador acabaram. Vale a tabela cheia.")).toBeVisible();
    await expect(j.getByRole("region", { name: "Pela tabela" })).toContainText("Tabela cheia R$ 349,00 por mês, implantação R$ 900,00.");
    await j.getByRole("button", { name: "Usar a tabela" }).click();
    await expect(j.getByLabel("Valor por mês")).toHaveValue("349,00");
    await expect(j.getByLabel("Implantação sem cobrança")).not.toBeChecked();
    await expect(j.getByLabel("Implantação, valor")).toHaveValue("900,00");
    await j.getByLabel("Valor por mês").fill("320,00");
    await conferir(page);
    await j.getByRole("button", { name: "Salvar o plano" }).click();
    await expect(status(page, "Plano salvo.")).toBeVisible();
    expect(estado.planos.ultimoPlano).toMatchObject({ tabela: "MANUAL", valor: 32000, implantacaoValor: 90000, implantacaoSemCobranca: false });
  });

  test("Acima de 400 unidades a tabela fica sob consulta e preenche Valor a definir", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    estado.precos.unidadesAtivas = 450;
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Plano e pagamentos" }).click();
    await page.getByRole("button", { name: "Editar o plano" }).click();
    const j = page.getByRole("dialog", { name: "Plano do cliente" });
    const caixa = j.getByRole("region", { name: "Pela tabela" });
    await expect(caixa).toContainText("Pela tabela: 450 unidades ativas, faixa acima de 400");
    await expect(caixa).toContainText("Acima de 400 unidades, sob consulta: preenche Valor a definir.");
    await expect(j.getByText("Acima de 400 unidades o preço é sob consulta. Escreva o plano à mão.")).toBeVisible();
    await caixa.getByRole("button", { name: "Usar a tabela" }).click();
    await expect(j.getByLabel("Valor por mês")).toHaveValue("");
    await expect(j.locator("#pl-ate")).toHaveValue("");
    await conferir(page);
    await j.getByRole("button", { name: "Salvar o plano" }).click();
    await expect(status(page, "Plano salvo.")).toBeVisible();
    expect(estado.planos.ultimoPlano).toMatchObject({ tabela: "MANUAL", valor: null, unidadesDe: 401, unidadesAte: null });
  });

  test("Sem unidades ativas a tabela não sugere faixa", async ({ page }) => {
    const estado = await instalarApiFalsa(page);
    estado.precos.unidadesAtivas = 0;
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Plano e pagamentos" }).click();
    await page.getByRole("button", { name: "Editar o plano" }).click();
    const j = page.getByRole("dialog", { name: "Plano do cliente" });
    await expect(j.getByRole("region", { name: "Pela tabela" })).toContainText("Pela tabela: 0 unidades ativas");
    await expect(j.getByText("O condomínio ainda não tem unidades ativas.")).toBeVisible();
    await expect(j.getByRole("button", { name: "Usar a tabela" })).toBeDisabled();
    await conferir(page);
  });

  test("Implantação não vê Pagamentos no menu nem os valores na ficha", async ({ page }) => {
    await instalarApiFalsa(page, { funcao: "IMPLANTACAO" });
    await page.goto(`${CONSOLE}/clientes/${IPE}`);
    await page.getByRole("tab", { name: "Plano e pagamentos" }).click();
    await expect(page.getByRole("list", { name: "Conjuntos do cliente" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pagamentos" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ver todos" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Tabela de preços" })).toHaveCount(0);
  });
});
