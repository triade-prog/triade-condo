// Piloto, virar cliente, troca de sistema e vários condomínios no Console (0308, R17.4; quadros 331,
// 338 e 345) com a API falsa: começar e encerrar o piloto na ficha, o piloto no kit do conselho sem
// com quem foi combinado, o Virar cliente que só liga com as duas assinaturas conferidas, a troca de
// sistema com a carta, o que falta e a planilha-modelo, e a oportunidade nova do mesmo contato.
// O contrato pelo gov.br (quadros 440 a 444) tem o seu próprio teste (console-comercial-contrato).
// Cada tela passa no axe, não usa emoji e não vaza para o lado.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiFalsa } from "./api-falsa";
import { CERRADO, CODIGO_IPE, INDICADO, INES, PROPOSTA_IPE } from "./api-falsa-console-comercial";
import { contratoAssinado } from "./api-falsa-console-contrato";

const CONSOLE = "http://localhost:3001";

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe("Console · Comercial · cliente (R17.4)", () => {
  test("Piloto: começa na ficha, aparece em andamento, vai para o kit e termina como perdido com motivo", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${INDICADO}`);
    const cartao = page.getByRole("region", { name: "Piloto" });
    await expect(cartao.getByText("Prazo curto e meta combinada antes")).toBeVisible();
    await cartao.getByRole("button", { name: "Começar o piloto" }).click();
    const janela = page.getByRole("dialog", { name: "Piloto para Edifício Ipê Amarelo" });
    await expect(janela.getByRole("radio", { name: "45 dias" })).toBeChecked();
    await expect(janela.getByLabel("Termina em")).not.toHaveValue("");
    await expect(janela.getByText("80% dos retornos no prazo. Medida pela própria Plataforma, em Indicadores.")).toBeVisible();
    await conferir(page);
    await janela.getByRole("button", { name: "Começar o piloto" }).click();
    await expect(janela.getByText("Diga com quem a meta foi combinada.")).toBeVisible();
    await janela.getByLabel("Combinado com").fill("João Reis, síndico, e o conselho");
    await janela.getByLabel("Quem cuida da implantação").selectOption(INES);
    await janela.getByRole("button", { name: "Começar o piloto" }).click();
    await expect(janela).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Piloto combinado" })).toBeVisible();
    expect(api.comercial.pedidos.find((x) => x.caminho.endsWith(`/interessados/${INDICADO}/piloto`))?.corpo)
      .toMatchObject({ versao: 1, prazoDias: 45, meta: "RETORNOS_NO_PRAZO", metaPercentual: 80, responsavelImplantacaoId: INES });
    await expect(cartao.getByText("Em andamento")).toBeVisible();
    await expect(cartao.getByText(/10 de 12 retornos no prazo/)).toBeVisible();
    await expect(cartao.getByText("João Reis, síndico, e o conselho")).toBeVisible();
    await conferir(page);

    // O kit mostra o piloto na apresentação curta; o link público leva o piloto sem com quem foi combinado.
    await page.goto(`${CONSOLE}/comercial/propostas/${PROPOSTA_IPE}/kit`);
    await expect(page.getByText(/Com o piloto: 45 dias, de .* meta de 80% dos retornos no prazo\./)).toBeVisible();
    const baixa = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar o kit em PDF" }).click();
    expect((await baixa).suggestedFilename()).toMatch(/\.pdf$/);
    await page.goto(`${CONSOLE}/o/${CODIGO_IPE}`);
    const kit = page.waitForResponse((r) => r.url().includes(`/v1/publico/propostas/${CODIGO_IPE}/kit`));
    const baixaKit = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar o kit do conselho" }).click();
    const corpoKit = await (await kit).json();
    await baixaKit;
    expect(corpoKit.piloto).toMatchObject({ prazoDias: 45, meta: "RETORNOS_NO_PRAZO", metaPercentual: 80, situacao: "EM_ANDAMENTO" });
    expect(JSON.stringify(corpoKit)).not.toContain("João Reis, síndico, e o conselho");

    await page.goto(`${CONSOLE}/comercial/${INDICADO}`);
    await page.getByRole("region", { name: "Piloto" }).getByRole("button", { name: "Encerrar o piloto" }).click();
    const fim = page.getByRole("dialog", { name: "Encerrar o piloto" });
    await fim.getByRole("radio", { name: "Perdido" }).check({ force: true });
    await expect(fim.getByText("Piloto encerrado", { exact: false })).toBeVisible();
    await conferir(page);
    await fim.getByRole("button", { name: "Encerrar o piloto" }).click();
    await expect(fim.getByText("Escolha o motivo.")).toBeVisible();
    await fim.getByRole("radio", { name: "Preço" }).check({ force: true });
    await fim.getByRole("button", { name: "Encerrar o piloto" }).click();
    await expect(fim).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Piloto encerrado como perdido" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Piloto" }).getByText("Perdido", { exact: true })).toBeVisible();
    expect(api.comercial.pedidos.at(-1)?.corpo).toMatchObject({ resultado: "PERDIDO", motivoPerda: "PRECO" });
  });

  test("Virar cliente: desligado sem as duas assinaturas; com o contrato assinado, diz o que cria e pede quem cuida da implantação", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${INDICADO}`);
    const sem = page.getByRole("region", { name: "Contrato" });
    await expect(sem.getByRole("button", { name: "Virar cliente" })).toBeDisabled();
    await expect(sem.getByText("Libera quando as duas assinaturas estiverem conferidas.")).toBeVisible();
    await conferir(page);

    contratoAssinado(api.comercial, CERRADO);
    await page.goto(`${CONSOLE}/comercial/${CERRADO}`);
    await expect(page.getByRole("region", { name: "Contrato" }).getByText("Assinado pelos dois", { exact: true })).toBeVisible();
    await page.getByRole("region", { name: "Contrato" }).getByRole("button", { name: "Virar cliente" }).click();
    const janela = page.getByRole("dialog", { name: "Virar cliente" });
    if (test.info().project.name !== "celular") await expect(janela.getByText("Residencial Cerrado · proposta v1 aceita · contrato assinado pelos dois.")).toBeVisible();
    const lista = janela.getByRole("list", { name: "O que vai ser criado" });
    await expect(lista).toContainText("Residencial Cerrado · Brasília, DF · Em implantação");
    await expect(lista).toContainText("Pela tabela da proposta aceita: mensal, fundador, R$ 229,00 por mês");
    await expect(lista).toContainText("Vai para Ganho, com o histórico guardado");
    await expect(janela.getByText("O Comercial deixa de ver os dados do condomínio (CM-11).")).toBeVisible();
    await conferir(page);
    await janela.getByRole("button", { name: "Criar o cliente e abrir a implantação" }).click();
    await expect(janela.getByText("Escolha quem cuida da implantação.")).toBeVisible();
    await janela.getByLabel("Quem cuida da implantação").selectOption(INES);
    await janela.getByRole("button", { name: "Criar o cliente e abrir a implantação" }).click();
    await expect(janela).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Cliente criado na carteira" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir a implantação" })).toHaveAttribute("href", /\/clientes\/.+aba=implantacao/);
    expect(api.comercial.pedidos.at(-1)).toMatchObject({ caminho: `/v1/comercial/interessados/${CERRADO}/virar-cliente`, corpo: { versao: 1, responsavelImplantacaoId: INES } });
    await conferir(page);
  });

  test("O Comercial vê o Virar cliente desligado e não começa o piloto", async ({ page }) => {
    const api = await instalarApiFalsa(page, { funcao: "COMERCIAL" });
    contratoAssinado(api.comercial, CERRADO);
    await page.goto(`${CONSOLE}/comercial/${CERRADO}`);
    const cartao = page.getByRole("region", { name: "Contrato" });
    await expect(cartao.getByRole("button", { name: "Virar cliente" })).toBeDisabled();
    await expect(cartao.getByText("Só a Administração cria o cliente.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Piloto" }).getByText("Só a Administração começa o piloto.")).toBeVisible();
    await conferir(page);
  });

  test("Troca de sistema: linha do tempo, carta à empresa anterior, o que falta e a planilha-modelo", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${CERRADO}`);
    await page.getByRole("link", { name: "Preparar a troca de sistema" }).click();
    await expect(page.getByRole("heading", { name: "Troca de sistema", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Residencial Cerrado" })).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Começar a troca de sistema" }).click();
    const janela = page.getByRole("dialog", { name: "Começar a troca de sistema" });
    await expect(janela.getByLabel("Sistema ou empresa de antes")).toHaveValue("Contábil Norte");
    await expect(janela.getByText("Lista de unidades e moradores")).toBeVisible();
    await janela.getByLabel("Dia da troca").fill("2026-12-04");
    await conferir(page);
    await janela.getByRole("button", { name: "Começar a troca" }).click();
    await expect(janela).toHaveCount(0);

    const linha = page.getByRole("list", { name: "Linha do tempo da troca" });
    await expect(linha.getByRole("listitem")).toHaveCount(5);
    await expect(linha.getByRole("listitem").filter({ hasText: "15 dias antes" })).toContainText("Faltam 4 itens");
    await expect(linha.getByRole("listitem").filter({ hasText: "Dia da troca" })).toContainText("04/12/2026");
    const carta = page.getByRole("region", { name: "Carta à empresa anterior" });
    await expect(carta).toContainText("À Contábil Norte,");
    await expect(carta).toContainText("- Lista de unidades e moradores");
    const falta = page.getByRole("region", { name: "O que falta receber" });
    await expect(falta.getByText("0 de 4 recebidos")).toBeVisible();
    await conferir(page);

    // Marcar o que chegou tira o item da lista da carta.
    await falta.getByRole("checkbox", { name: /Lista de unidades e moradores/ }).click();
    await expect(falta.getByText("1 de 4 recebidos")).toBeVisible();
    await expect(carta).not.toContainText("- Lista de unidades e moradores");
    await expect(linha.getByRole("listitem").filter({ hasText: "15 dias antes" })).toContainText("Faltam 3 itens");
    const salvo = api.comercial.pedidos.filter((x) => x.caminho.endsWith(`/interessados/${CERRADO}/troca`)).at(-1);
    expect(salvo?.corpo).toMatchObject({ versao: 1, empresaAnterior: "Contábil Norte", dataTroca: "2026-12-04" });
    expect(String(salvo?.corpo.carta)).toContain("itens abaixo:\n- Contratos e prestadores");

    await page.getByRole("button", { name: "Mandar a carta para a síndica" }).click();
    const mandar = page.getByRole("dialog", { name: "Mandar a carta para a síndica" });
    await expect(mandar.getByText("A TRÍADE não fala pelo condomínio.", { exact: false })).toBeVisible();
    await expect(mandar.getByRole("link", { name: "Abrir no WhatsApp" })).toHaveAttribute("href", /5561977776666/);
    await conferir(page);
    await mandar.getByRole("button", { name: "Registrar que a carta foi mandada" }).click();
    await expect(mandar).toHaveCount(0);
    await expect(linha.getByRole("listitem").filter({ hasText: "30 dias antes" })).toContainText(/Enviada \d\d\/\d\d/);

    const baixa = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar a planilha-modelo" }).click();
    expect((await baixa).suggestedFilename()).toBe("planilha-modelo-troca-de-sistema.csv");
  });

  test("Vários condomínios do mesmo contato: nova oportunidade e a lista na ficha", async ({ page }) => {
    const api = await instalarApiFalsa(page);
    await page.goto(`${CONSOLE}/comercial/${CERRADO}`);
    const outros = page.getByRole("region", { name: "Outros condomínios desta pessoa" });
    await expect(outros.getByText("Nenhum. Síndico profissional ou administradora")).toBeVisible();
    await outros.getByRole("button", { name: "Nova oportunidade" }).click();
    const janela = page.getByRole("dialog", { name: "Nova oportunidade para outro condomínio" });
    await expect(janela.getByText("Com o mesmo contato (Lúcia Prado)", { exact: false })).toBeVisible();
    await janela.getByLabel("Condomínio").fill("Residencial Cerrado");
    await conferir(page);
    await janela.getByRole("button", { name: "Abrir a oportunidade" }).click();
    await expect(janela.getByText("Este contato já tem uma oportunidade para este condomínio.")).toBeVisible();
    await janela.getByLabel("Condomínio").fill("Edifício Buriti");
    await janela.getByLabel("Cidade").fill("Brasília");
    await janela.getByLabel("UF").fill("DF");
    await janela.getByRole("button", { name: "Abrir a oportunidade" }).click();
    await expect(page.getByRole("heading", { name: "Edifício Buriti", level: 1 })).toBeVisible();
    expect(api.comercial.pedidos.at(-1)).toMatchObject({ caminho: `/v1/comercial/interessados/${CERRADO}/oportunidades`, corpo: { condominio: "Edifício Buriti", uf: "DF" } });
    const daqui = page.getByRole("region", { name: "Outros condomínios desta pessoa" });
    await expect(daqui.getByRole("link", { name: "Residencial Cerrado" })).toBeVisible();
    await conferir(page);
    await daqui.getByRole("link", { name: "Residencial Cerrado" }).click();
    await expect(page.getByRole("heading", { name: "Residencial Cerrado", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Outros condomínios desta pessoa" }).getByRole("link", { name: "Edifício Buriti" })).toBeVisible();
  });
});
