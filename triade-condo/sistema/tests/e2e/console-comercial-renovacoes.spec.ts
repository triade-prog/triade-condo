// Renovações (0311, R17.7; quadros 346, 347 e 335; CM-30, CM-31 e CM-32) com a API falsa: a aba
// Reajuste e renovação com o índice ainda "[a definir com o advogado]", a regra que só a Administração
// muda, o aviso ao síndico que gera o aditivo e o PDF do aditivo; os sinais de risco com o "Já vi" e o
// marcar à mão; a sugestão de mudar de faixa posta no funil e a expansão de mais um prédio; o pedido de
// cancelamento com o motivo obrigatório, uma tentativa de retenção e a confirmação da Administração;
// o Comercial sem o botão de confirmar; e o cartão Comercial do Início com as renovações. Cada tela
// passa no axe, não usa emoji e não rola para o lado no celular.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa } from "./api-falsa";
import { AGUAS, BURITI, IPIRANGA, PEDIDO_BURITI, PEQUI } from "./api-falsa-console-renovacoes";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

const celular = () => test.info().project.name === "celular";
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const br = (d: string) => d.split("-").reverse().join("/");

/** A lista da aba Reajuste: tabela no computador, cartões no celular. */
const listaReajuste = (page: Page) =>
  celular() ? page.getByRole("list", { name: "Aniversários de contrato" }) : page.getByRole("table", { name: /Aniversários de contrato/ });
const linha = (page: Page, nome: string) =>
  celular() ? listaReajuste(page).getByRole("listitem").filter({ hasText: nome }) : listaReajuste(page).getByRole("row", { name: new RegExp(nome) });

test.describe("Console · Renovações (CM-30, CM-31, CM-32)", () => {
  test("reajuste: o índice a definir, a regra da Administração, o aviso com o aditivo e o PDF", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/renovacoes`);
    await expect(page.getByRole("heading", { name: "Renovações", level: 1 })).toBeVisible();
    if (!celular()) {
      await expect(page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Renovações" })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Interessados" })).not.toHaveAttribute("aria-current", "page");
    }
    const abas = page.getByRole("navigation", { name: "Partes das renovações" });
    await expect(abas.getByRole("button", { name: /Reajuste e renovação/ })).toContainText("4");
    await expect(abas.getByRole("button", { name: /Risco/ })).toContainText("2");
    await expect(abas.getByRole("button", { name: /Cancelamentos/ })).toContainText("1");

    const pequi = linha(page, "Residencial Pequi");
    await expect(pequi).toContainText("R$ 229,00");
    await expect(pequi).toContainText("[a definir com o advogado]");
    await expect(pequi).toContainText(`Avisar até ${diaMes(somarDias(hoje(), 10))}`);
    await expect(page.getByRole("button", { name: "Registrar o aviso do Residencial Pequi" })).toHaveCount(0);
    const ipiranga = linha(page, "Edifício Ipiranga");
    await expect(ipiranga).toContainText("R$ 129,00 · fundador");
    await expect(ipiranga).toContainText("R$ 199,00 · fim do fundador");
    await expect(linha(page, "Residencial Buriti")).toContainText(`Aviso atrasado: era até ${diaMes(somarDias(hoje(), -2))}`);
    const aguas = linha(page, "Condomínio Águas Claras");
    await expect(aguas).toContainText("Aviso enviado");
    await expect(aguas).toContainText("aditivo nº 1");
    await expect(page.getByText("Nada muda no valor sem o aviso enviado; o aviso gera o aditivo (CM-13, CM-30). O índice fica [a definir com o advogado].")).toBeVisible();
    const regra = page.getByRole("region", { name: "Regra do reajuste" });
    await expect(regra).toContainText("Índice [a definir com o advogado] · aviso 30 dias antes do aniversário");
    await expect(regra).toContainText("Aditivo do modelo v1 (Aditivo de reajuste).");
    await expect(page.getByRole("region", { name: "Risco" })).toContainText("2 clientes");
    await conferir(page);

    const baixa = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar o aditivo nº 1 do Condomínio Águas Claras" }).click();
    expect((await baixa).suggestedFilename()).toBe("aditivo-1-c3.pdf");

    // A regra é da Administração: com o índice, o Pequi ganha o valor e o botão do aviso.
    await regra.getByRole("button", { name: "Mudar" }).click();
    const janela = page.getByRole("dialog", { name: "Regra do reajuste" });
    await janela.getByLabel("Percentual do período (%)").fill("4,8");
    await janela.getByRole("button", { name: "Salvar a regra" }).click();
    await expect(janela.getByText("Diga o índice (por exemplo, IPCA), junto com o percentual.")).toBeVisible();
    await janela.getByLabel("Índice").fill("IPCA");
    await janela.getByLabel("Referência").fill("12 meses até setembro de 2026");
    await conferir(page);
    await janela.getByRole("button", { name: "Salvar a regra" }).click();
    await expect(page.getByRole("status")).toContainText("Regra do reajuste salva");
    expect(api.comercial.pedidos.find((x) => x.caminho === "/v1/comercial/renovacoes/regra")?.corpo).toEqual({
      versao: 1, indice: "IPCA", percentual: 4.8, referencia: "12 meses até setembro de 2026", prazoAvisoDias: 30,
    });
    await expect(regra).toContainText("IPCA 4,8% (12 meses até setembro de 2026) · aviso 30 dias antes do aniversário");
    await expect(pequi).toContainText("R$ 239,99 · IPCA 4,8%");

    // O aviso ao síndico: o texto sugerido, quem recebeu e por onde; o aditivo nº 2 fica pronto.
    await page.getByRole("button", { name: "Registrar o aviso do Residencial Pequi" }).click();
    const aviso = page.getByRole("dialog", { name: "Registrar o aviso ao síndico" });
    await expect(aviso).toContainText("R$ 239,99 · IPCA 4,8%");
    await expect(aviso.getByLabel("Texto do aviso")).toHaveValue(/R\$\s239,99/);
    await expect(aviso).toContainText("As duas partes podem assinar pelo gov.br depois; o valor novo vale pelo aviso, com ou sem as assinaturas.");
    await aviso.getByLabel("Quem recebeu").fill("Ana, síndica");
    await aviso.getByRole("radio", { name: "WhatsApp" }).check({ force: true });
    await conferir(page);
    await aviso.getByRole("button", { name: "Registrar o aviso" }).click();
    await expect(aviso).toBeHidden();
    await expect(page.getByRole("status")).toContainText("Aviso registrado para o Residencial Pequi. Aditivo nº 2 pronto para baixar.");
    const enviado = api.comercial.pedidos.find((x) => x.caminho === "/v1/comercial/renovacoes/aviso")?.corpo;
    expect(enviado).toMatchObject({ interessadoId: PEQUI, aniversario: somarDias(hoje(), 40), valorNovo: 23999, canal: "WHATSAPP", para: "Ana, síndica", avisoEm: hoje() });
    await expect(pequi).toContainText("Aviso enviado");
    await expect(page.getByRole("button", { name: "Baixar o aditivo nº 2 do Residencial Pequi" })).toBeVisible();

    // Renovar sem reajuste, com o motivo.
    await page.getByRole("button", { name: "Renovar o Edifício Ipiranga sem reajuste" }).click();
    const sem = page.getByRole("dialog", { name: "Renovar sem reajuste" });
    await sem.getByLabel("Por quê").fill("Combinado na assembleia de junho");
    await sem.getByRole("button", { name: "Renovar sem reajuste" }).click();
    await expect(page.getByRole("status")).toContainText("Edifício Ipiranga renovado sem reajuste.");
    await expect(ipiranga).toContainText("Renovado sem reajuste");
    expect(api.comercial.pedidos.find((x) => x.caminho === "/v1/comercial/renovacoes/dispensar")?.corpo)
      .toEqual({ interessadoId: IPIRANGA, aniversario: somarDias(hoje(), 70), motivo: "Combinado na assembleia de junho" });
  });

  test("risco e expansão: o Já vi, o sinal à mão, a sugestão no funil e mais um prédio", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/renovacoes?aba=risco`);
    const riscos = page.getByRole("list", { name: "Clientes com sinal de risco" });
    await expect(riscos.getByRole("listitem").filter({ hasText: "Edifício Ipiranga" }).first()).toContainText(`Síndico novo desde ${diaMes(somarDias(hoje(), -10))}`);
    await expect(riscos).toContainText("Pedidos caíram 60% em 30 dias");
    await conferir(page);

    await page.getByRole("button", { name: `Já vi: Síndico novo desde ${diaMes(somarDias(hoje(), -10))} (Edifício Ipiranga)` }).click();
    const tratar = page.getByRole("dialog", { name: "Tratar o sinal" });
    await tratar.getByLabel("O que foi feito").fill("Liguei para o síndico novo e marquei uma apresentação");
    await tratar.getByRole("button", { name: "Já vi" }).click();
    await expect(page.getByRole("status")).toContainText("Sinal tratado. Ele saiu da lista.");
    await expect(riscos).not.toContainText("Edifício Ipiranga");

    await page.getByRole("button", { name: "Marcar sinal" }).click();
    const marcar = page.getByRole("dialog", { name: "Marcar sinal de risco" });
    await marcar.getByLabel("Cliente").selectOption(PEQUI);
    await marcar.getByRole("radio", { name: "Troca de sistema na pauta" }).check({ force: true });
    await marcar.getByLabel("Data da assembleia").fill(somarDias(hoje(), 20));
    await conferir(page);
    await marcar.getByRole("button", { name: "Marcar o sinal" }).click();
    await expect(page.getByRole("status")).toContainText("Sinal de risco registrado.");
    await expect(riscos.getByRole("listitem").filter({ hasText: "Residencial Pequi" }).first()).toContainText(`Troca de sistema na pauta de ${diaMes(somarDias(hoje(), 20))}`);
    expect(api.comercial.pedidos.find((x) => x.caminho === "/v1/comercial/riscos")?.corpo)
      .toEqual({ interessadoId: PEQUI, tipo: "TROCA_NA_PAUTA", data: somarDias(hoje(), 20), detalhe: null });

    // Expansão: a sugestão vira expansão; mais um prédio abre a oportunidade.
    await page.getByRole("navigation", { name: "Partes das renovações" }).getByRole("button", { name: /Expansão/ }).click();
    await expect(page).toHaveURL(/aba=expansao/);
    const expansao = page.getByRole("list", { name: "Expansão" });
    await expect(expansao).toContainText("Passou de 40 unidades ativas");
    await expect(expansao).toContainText("Condomínio Águas Claras II");
    await expect(expansao.getByRole("link", { name: "Oportunidade: Condomínio Águas Claras II" })).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Pôr no funil: Mudar de faixa do Residencial Pequi" }).click();
    const nova = page.getByRole("dialog", { name: "Abrir expansão" });
    await expect(nova.getByLabel("Motivo")).toHaveValue("Passou de 40 unidades ativas");
    await nova.getByLabel("Próximo passo").fill("Mostrar a faixa de 41 a 100");
    await nova.getByRole("button", { name: "Abrir a expansão" }).click();
    await expect(page.getByRole("status")).toContainText("Expansão aberta.");
    await expect(expansao).not.toContainText("Sugestão: ainda fora do funil");

    await page.getByRole("button", { name: "Abrir expansão" }).click();
    const predio = page.getByRole("dialog", { name: "Abrir expansão" });
    await predio.getByRole("radio", { name: "Mais um prédio" }).check({ force: true });
    await predio.getByLabel("Cliente").selectOption(AGUAS);
    await predio.getByLabel("Condomínio").fill("Residencial Aroeira");
    await predio.getByLabel("Motivo").fill("A síndica assumiu mais um prédio");
    await predio.getByLabel("Próximo passo").fill("Ligar para a síndica");
    await conferir(page);
    await predio.getByRole("button", { name: "Abrir a expansão" }).click();
    await expect(page.getByRole("status")).toContainText("O prédio novo entrou no funil como oportunidade do mesmo contato.");
    await expect(expansao.getByRole("link", { name: "Oportunidade: Residencial Aroeira" })).toBeVisible();
  });

  test("cancelamento (quadro 347): motivo obrigatório, uma tentativa e a confirmação da Administração", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/renovacoes?aba=cancelamentos`);
    const pedidos = page.getByRole("list", { name: "Pedidos de cancelamento" });
    const ultimo = somarDias(somarDias(hoje(), -2), 30);
    await expect(pedidos).toContainText(`Pedido em ${br(somarDias(hoje(), -2))} · último dia ${br(ultimo)}`);
    await conferir(page);

    await page.getByRole("button", { name: "Abrir o pedido de cancelamento do Residencial Buriti" }).click();
    const janela = page.getByRole("dialog", { name: "Pedido de cancelamento" });
    await expect(janela).toContainText("Residencial Buriti · desde 12/2025 · R$ 129,00 por mês");
    await expect(janela).toContainText(`Ana Ribeiro, síndica · ${diaMes(somarDias(hoje(), -2))} 11:20`);
    await expect(janela).toContainText(`30 dias: último dia ${br(ultimo)}, sem multa (N.1)`);
    await expect(janela).toContainText(`o acesso continua até ${diaMes(ultimo)}`);
    await expect(janela.getByText("Uma tentativa registrada; ela decide.")).toBeVisible();
    await conferir(page);
    await janela.getByRole("button", { name: "Registrar tentativa e esperar" }).click();
    await expect(janela.getByText("Escolha o motivo do cancelamento.")).toBeVisible();
    await expect(janela.getByText(/Diga o que foi oferecido/)).toBeVisible();
    await janela.getByRole("radio", { name: "Síndico novo" }).check({ force: true });
    await janela.getByLabel("Tentativa de retenção").fill("Apresentar à síndica nova; oferecer 2 meses de acompanhamento");
    // A tentativa digitada não se perde: confirmar espera ela ser registrada.
    await expect(janela.getByRole("button", { name: "Confirmar o cancelamento" })).toBeDisabled();
    await expect(janela).toContainText("Para confirmar, registre a tentativa primeiro ou apague o texto dela.");
    await janela.getByRole("button", { name: "Registrar tentativa e esperar" }).click();
    await expect(page.getByRole("status")).toContainText("Tentativa de retenção registrada. Agora a decisão é do síndico.");
    expect(api.comercial.pedidos.find((x) => x.caminho === `/v1/comercial/cancelamentos/${PEDIDO_BURITI}/retencao`)?.corpo).toEqual({
      versao: 1, motivo: "SINDICO_NOVO", motivoTexto: null, retencao: "Apresentar à síndica nova; oferecer 2 meses de acompanhamento",
    });
    await expect(pedidos).toContainText("Tentativa registrada");

    await page.getByRole("button", { name: "Abrir o pedido de cancelamento do Residencial Buriti" }).click();
    const decidir = page.getByRole("dialog", { name: "Pedido de cancelamento" });
    await expect(decidir).toContainText("Apresentar à síndica nova; oferecer 2 meses de acompanhamento");
    await expect(decidir.getByRole("radio", { name: "Síndico novo" })).toBeChecked();
    await expect(decidir.getByRole("button", { name: "Registrar tentativa e esperar" })).toHaveCount(0);
    await decidir.getByLabel("Lembrar de reconquistar em").fill(somarDias(ultimo, 180));
    await conferir(page);
    await decidir.getByRole("button", { name: "Confirmar o cancelamento" }).click();
    await expect(page.getByRole("status")).toContainText(`Cancelamento confirmado. O acesso continua até ${diaMes(ultimo)} e a exportação está sendo montada.`);
    expect(api.comercial.pedidos.find((x) => x.caminho === `/v1/comercial/cancelamentos/${PEDIDO_BURITI}/confirmar`)?.corpo)
      .toEqual({ versao: 2, motivo: "SINDICO_NOVO", motivoTexto: null, lembrarEm: somarDias(ultimo, 180) });
    await expect(pedidos.getByRole("listitem").filter({ hasText: "Residencial Buriti" })).toContainText("Confirmado");

    // Um pedido novo: o último dia sai da data do pedido mais 30 dias.
    await page.getByRole("button", { name: "Registrar pedido" }).click();
    const registrar = page.getByRole("dialog", { name: "Registrar pedido de cancelamento" });
    await expect(registrar.getByLabel("Cliente").locator("option")).toHaveText(["Escolha o cliente", "Residencial Pequi", "Edifício Ipiranga", "Condomínio Águas Claras"]);
    await registrar.getByLabel("Cliente").selectOption(IPIRANGA);
    await registrar.getByLabel("Quem pediu").fill("Rui, síndico");
    await expect(registrar).toContainText(`Último dia se confirmar: 30 dias: último dia ${br(somarDias(hoje(), 30))}, sem multa (N.1).`);
    await conferir(page);
    await registrar.getByRole("button", { name: "Registrar o pedido" }).click();
    await expect(page.getByRole("status")).toContainText(`Pedido registrado. Se confirmar, o último dia é ${br(somarDias(hoje(), 30))}.`);
    await expect(pedidos.getByRole("listitem").filter({ hasText: "Edifício Ipiranga" })).toContainText("Pedido");
  });

  test("o Comercial registra a tentativa, mas não confirma o cancelamento nem muda a regra", async ({ page }) => {
    const api = await instalarApiFalsa(page, { funcao: "COMERCIAL" });
    await page.goto(`${CONSOLE}/comercial/renovacoes`);
    const regra = page.getByRole("region", { name: "Regra do reajuste" });
    await expect(regra).toContainText("A regra é da Administração, em Modelos.");
    await expect(regra.getByRole("button", { name: "Mudar" })).toHaveCount(0);
    await page.getByRole("navigation", { name: "Partes das renovações" }).getByRole("button", { name: /Cancelamentos/ }).click();
    await page.getByRole("button", { name: "Abrir o pedido de cancelamento do Residencial Buriti" }).click();
    const janela = page.getByRole("dialog", { name: "Pedido de cancelamento" });
    await expect(janela.getByRole("button", { name: "Confirmar o cancelamento" })).toBeDisabled();
    await expect(janela.getByLabel("Lembrar de reconquistar em")).toHaveCount(0);
    await expect(janela).toContainText("Confirmar o cancelamento é da Administração");
    await conferir(page);
    await janela.getByRole("button", { name: "Decidiu ficar" }).click();
    await expect(page.getByRole("status")).toContainText("Residencial Buriti decidiu ficar. O pedido foi fechado.");
    expect(api.comercial.pedidos.find((x) => x.caminho === `/v1/comercial/cancelamentos/${PEDIDO_BURITI}/ficou`)?.corpo).toEqual({ versao: 1, nota: null });
    expect(api.comercial.renovacoes.clientes.find((c) => c.id === BURITI)?.situacao).toBe("ATIVO");
  });

  test("o cartão Comercial do Início (quadro 335) com a renovação e o risco", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    api.comercial.renovacoes.noInicio = true;
    await page.goto(`${CONSOLE}/`);
    const cartao = page.getByRole("region", { name: "Comercial" });
    await expect(cartao).toContainText("6 pedem atenção");
    const pequi = cartao.getByRole("listitem").filter({ hasText: "Residencial Pequi" });
    await expect(pequi).toContainText("Avisar o síndico");
    await expect(pequi).toContainText("Cliente · reajuste em 40 dias");
    await expect(cartao.getByRole("listitem").filter({ hasText: "Residencial Buriti" })).toContainText("Aviso atrasado");
    await expect(cartao.getByRole("listitem").filter({ hasText: "Edifício Ipiranga" })).toContainText("Síndico novo");
    await conferir(page);
    await cartao.getByRole("link", { name: "Residencial Pequi" }).click();
    await expect(page).toHaveURL(/\/comercial\/renovacoes$/);
    await expect(page.getByRole("heading", { name: "Renovações", level: 1 })).toBeVisible();
  });

  test("Modelos › Aditivo: a versão em uso, os campos e a regra", async ({ page }) => {
    await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/modelos?aba=aditivo`);
    await expect(page.getByRole("region", { name: "Versões do aditivo" })).toContainText("Em uso");
    await expect(page.getByRole("region", { name: "Texto da v1" })).toContainText("«valor_novo»");
    await expect(page.getByRole("region", { name: "Regra do reajuste" })).toContainText("[a definir com o advogado]");
    await conferir(page);
  });
});
