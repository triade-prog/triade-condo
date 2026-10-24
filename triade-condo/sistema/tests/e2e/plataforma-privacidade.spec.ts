// Privacidade e dados na Plataforma (F0.11; PT-11, PT-03, EM-08; quadros 350 a 359, aprovados em
// 24/10/2026) com a API falsa: Configurações › Gestão › Privacidade e dados com o modo da rotina, a
// última rodada, o que vence em 30 dias, o inventário por grupo e Tirar a marca; Dados de uma
// pessoa com a busca, onde a pessoa aparece, a planilha, o motivo que impede remover e a remoção;
// Guardar por obrigação legal na ficha do pedido, com o selo. Os estados vazio, sem permissão e
// erro. Cada tela passa no axe (WCAG 2.2 AA) e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";

const PLATAFORMA = "http://localhost:3000";

async function conferir(page: Page) {
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

const celular = () => test.info().project.name === "celular";

async function buscar(page: Page, texto: string) {
  await page.getByLabel("Telefone ou e-mail da pessoa").fill(texto);
  await page.getByRole("search", { name: "Buscar a pessoa" }).getByRole("button", { name: "Buscar" }).click();
}

test.describe("Plataforma · Privacidade e dados", () => {
  test("PT-11: o que se guarda, por quanto tempo, a última rodada só contando e Tirar a marca com motivo", async ({ page }) => {
    test.slow();
    const api = await instalarApiPlataformaFalsa(page, { comPrivacidade: true });
    await page.goto(`${PLATAFORMA}/configuracoes`);
    const gestao = page.getByRole("region", { name: "Gestão" });
    await expect(gestao).toContainText("Meu plano");
    await gestao.getByRole("link", { name: /Privacidade e dados/ }).click();
    await expect(page).toHaveURL(/\/configuracoes\/privacidade$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacidade e dados" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Configurações · Gestão" })).toBeVisible();

    await expect(page.getByRole("region", { name: "Última rodada" })).toContainText("Hoje, 03:10");
    await expect(page.getByRole("region", { name: "Última rodada" })).toContainText("Só contando: 46 itens contados, nada apagado");
    await expect(page.getByRole("region", { name: "Nos próximos 30 dias" })).toContainText("128 itens");
    await expect(page.getByRole("status").filter({ hasText: "Rotina em só contando" })).toContainText("Hoje, 46 itens já passaram do prazo");
    const guardados = page.getByRole("region", { name: "Guardados por obrigação legal" }).filter({ has: page.getByRole("heading") });
    await expect(guardados).toContainText("Encomenda de 14/08/2026");
    await expect(guardados).toContainText("Torre A · 101 · Pedido de autoridade (ofício da delegacia)");
    await expect(guardados).toContainText("Guardada por Ana Souza em 20/08/2026");

    if (celular()) {
      const pessoas = page.getByRole("button", { name: /^Pessoas/ });
      await expect(pessoas).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByText("Contato de morador").filter({ visible: true })).toBeVisible();
      const comunicacao = page.getByRole("button", { name: /^Comunicação/ });
      await expect(comunicacao).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByText("Mensagens de WhatsApp").filter({ visible: true })).toHaveCount(0);
      await comunicacao.click();
      await expect(comunicacao).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByText("Mensagens de WhatsApp").filter({ visible: true })).toBeVisible();
      for (const b of await page.getByRole("button", { name: /tipos? de dado/ }).all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    } else {
      const pessoas = page.getByRole("table", { name: /^Pessoas:/ });
      await expect(pessoas.getByRole("row", { name: /Contato de morador/ })).toContainText("180 dias depois de sair da última unidade");
      await expect(pessoas.getByRole("row", { name: /Contato de morador/ })).toContainText("Os dados são apagados; fica “contato removido”");
      await expect(pessoas.getByRole("row", { name: /Equipe do condomínio/ })).toContainText("Prazo definido, rotina a fazer");
      await expect(page.getByRole("table")).toHaveCount(5);
      await expect(page.getByRole("region", { name: "Quer outro prazo?" }).getByRole("link", { name: "Pedir mudança" })).toHaveAttribute("href", "/suporte");
      await page.getByRole("button", { name: "Como funciona" }).click();
      const como = page.getByRole("dialog", { name: "Como funciona" });
      await expect(como).toContainText("Toda madrugada, às 03:10");
      await expect(como).toContainText("Agora a rotina está em Só contando");
      await como.getByRole("button", { name: "Entendi" }).click();
    }
    await conferir(page);

    await guardados.getByRole("button", { name: "Tirar a marca de Encomenda de 14/08/2026" }).click();
    const tirar = page.getByRole("dialog", { name: "Tirar a marca de Encomenda de 14/08/2026" });
    await tirar.getByRole("button", { name: "Tirar a marca" }).click();
    await expect(tirar.getByText("Conte o motivo, com 3 letras ou mais.")).toBeVisible();
    await conferir(page);
    await tirar.getByLabel("Por que tirar").fill("A delegacia encerrou o inquérito");
    await tirar.getByRole("button", { name: "Tirar a marca" }).click();
    await expect(page.getByRole("status").filter({ hasText: "A marca de Encomenda de 14/08/2026 saiu. O prazo volta a valer." })).toBeVisible();
    await expect(guardados).toContainText("Nada guardado agora.");
    expect(api.privacidade.tiradas).toEqual([{ id: "7e3f4a5b-6c7d-4e8f-9a0b-2c3d4e5f6a71", motivo: "A delegacia encerrou o inquérito" }]);
  });

  test("Estados: sem permissão para quem não é síndico, e erro ao carregar com Tentar de novo", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comPrivacidade: true, quem: "SECRETARIA" });
    await page.goto(`${PLATAFORMA}/configuracoes`);
    await expect(page.getByRole("heading", { level: 1, name: "Configurações" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Privacidade e dados/ })).toHaveCount(0);
    await page.goto(`${PLATAFORMA}/configuracoes/privacidade`);
    await expect(page.getByText("Só o síndico vê o que o sistema guarda das pessoas e por quanto tempo.")).toBeVisible();
    await conferir(page);
    await page.goto(`${PLATAFORMA}/configuracoes/privacidade/pessoa`);
    await expect(page.getByText("Só o síndico busca e remove os dados de uma pessoa.")).toBeVisible();

    const outra = await page.context().newPage();
    await instalarApiPlataformaFalsa(outra, { comPrivacidade: true });
    await outra.route("**/api/v1/condominio/privacidade", (r) => r.fulfill({ status: 500, json: { erro: { codigo: "INTERNAL_ERROR" } } }));
    await outra.goto(`${PLATAFORMA}/configuracoes/privacidade`);
    await expect(outra.getByText("Não deu para carregar Privacidade e dados")).toBeVisible();
    await expect(outra.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await conferir(outra);
  });

  test("EM-08: buscar pelo telefone, ver onde aparece, baixar, o motivo que impede remover e remover com motivo", async ({ page }) => {
    test.slow();
    const api = await instalarApiPlataformaFalsa(page, { comPrivacidade: true });
    await page.goto(`${PLATAFORMA}/configuracoes/privacidade`);
    await page.getByRole("link", { name: "Dados de uma pessoa" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Dados de uma pessoa" })).toBeVisible();
    await expect(page.getByText("Só o síndico. A busca fica no histórico, com quem buscou.")).toBeVisible();

    await buscar(page, "ab");
    await expect(page.getByText("Escreva o telefone com DDD ou o e-mail.")).toBeVisible();
    await buscar(page, "(61) 91234-5678");
    await expect(page.getByText("Ninguém com esse telefone")).toBeVisible();
    await expect(page.getByText("Quem já teve os dados removidos não aparece mais.")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Buscar de novo" }).click();
    await expect(page.getByLabel("Telefone ou e-mail da pessoa")).toBeFocused();

    // Quem ainda mora: a tela diz por que não dá para remover, antes de qualquer pedido à API.
    await buscar(page, "61 99777-6655");
    const helena = page.getByRole("region", { name: "Helena Prado" });
    await expect(helena).toContainText("Mora no prédio");
    await expect(helena.getByRole("status").filter({ hasText: "Ainda mora na unidade" })).toContainText("encerre antes o vínculo na ficha da unidade");
    await helena.getByRole("button", { name: "Remover os dados agora" }).filter({ visible: true }).click();
    const bloqueada = page.getByRole("dialog", { name: "Remover os dados de Helena Prado" });
    await expect(bloqueada).toContainText("Ainda mora na unidade");
    await expect(bloqueada.getByRole("button", { name: "Remover os dados" })).toHaveCount(0);
    await conferir(page);
    await bloqueada.getByRole("button", { name: "Entendi" }).click();

    // Guardar a pessoa por obrigação legal.
    if (celular()) {
      await helena.getByRole("button", { name: "Mais ações de Helena Prado" }).click();
      await helena.getByRole("button", { name: "Guardar por obrigação legal" }).click();
    } else {
      await helena.getByRole("button", { name: "Guardar por obrigação legal" }).click();
    }
    const guardar = page.getByRole("dialog", { name: "Guardar os dados de Helena Prado" });
    await guardar.getByLabel("Processo na Justiça").check();
    await guardar.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Os dados de Helena Prado estão guardados por obrigação legal." })).toBeVisible();
    await expect(helena.getByText("Guardado", { exact: true })).toBeVisible();
    await expect(helena.getByRole("status").filter({ hasText: "Guardada por obrigação legal" })).toContainText("Processo na Justiça");

    // Pedido aberto, pelo e-mail.
    await buscar(page, "rita.campos@exemplo.com.br");
    const rita = page.getByRole("region", { name: "Rita Campos" });
    await expect(rita).toContainText("Pedido aberto");
    await expect(rita).toContainText("depois que o pedido 2026-0003 for encerrado");

    // Quem saiu: o prazo, onde aparece, a planilha e Remover os dados agora.
    await buscar(page, "(61) 9876-5432");
    const paulo = page.getByRole("region", { name: "Paulo Souza" });
    await expect(paulo).toContainText("+55 61 99876-5432 · paulo.souza@exemplo.com.br · aniversário 12/03");
    await expect(paulo).toContainText("Apagado sozinho em 11/02/2027");
    await expect(paulo.getByRole("status").filter({ hasText: "Saiu da última unidade em 15/08/2026" })).toContainText("em 11/02/2027");
    if (celular()) {
      const onde = paulo.getByRole("region", { name: "Onde aparece" });
      await expect(onde.getByRole("listitem").filter({ hasText: "Mensagens de WhatsApp" })).toContainText("27 mensagens, 12 não viraram pedido");
    } else {
      const onde = paulo.getByRole("table", { name: "Onde aparece" });
      await expect(onde.getByRole("row", { name: /Mensagens de WhatsApp/ })).toContainText("27 mensagens, 12 não viraram pedido");
      await expect(onde.getByRole("row", { name: /Unidades/ })).toContainText("Saiu da Torre A · 302 em 15/08/2026 (inquilino)");
      await expect(onde.getByRole("row", { name: /Veículos/ })).toContainText("placa JKL4B21, Hatch prata, retirado em 15/08/2026");
    }
    const baixar = paulo.getByRole("button", { name: /^Baixar/ }).filter({ visible: true });
    const download = page.waitForEvent("download");
    await baixar.click();
    expect((await download).suggestedFilename()).toBe("dados-paulo-souza.csv");
    await conferir(page);

    await paulo.getByRole("button", { name: "Remover os dados agora" }).filter({ visible: true }).click();
    const remover = page.getByRole("dialog", { name: "Remover os dados de Paulo Souza" });
    await expect(remover.getByRole("region", { name: "O que é apagado agora" })).toContainText("As 12 mensagens de WhatsApp que não viraram pedido, com áudios e fotos");
    await expect(remover.getByRole("region", { name: "O que fica, sem o nome" })).toContainText("Os 4 pedidos, como “contato removido”");
    await expect(remover).toContainText("Depois de remover, nem a TRÍADE consegue trazer os dados de volta.");
    await remover.getByRole("button", { name: "Remover os dados" }).click();
    await expect(remover.getByText("Escolha por que remover.")).toBeVisible();
    await conferir(page);
    await remover.getByLabel("A pessoa pediu (LGPD)").check();
    await remover.getByRole("button", { name: "Remover os dados" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Dados removidos" })).toContainText("Os dados de Paulo Souza foram removidos agora, por você.");
    expect(api.privacidade.removidos).toEqual([{ id: "5c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e51", motivo: "PEDIDO" }]);
    await conferir(page);
    await buscar(page, "61998765432");
    await expect(page.getByText("Ninguém com esse telefone")).toBeVisible();
  });

  test("Guardar por obrigação legal na ficha do pedido: motivo, detalhe, o selo e o item em Privacidade e dados", async ({ page }) => {
    const api = await instalarApiPlataformaFalsa(page, { comPrivacidade: true });
    const pedido = api.pedidos[0]!;
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${pedido.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(pedido.assunto);
    await expect(page.getByText("Guardado", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Mais ações" }).first().click();
    await page.getByRole("button", { name: "Guardar por obrigação legal" }).click();
    const j = page.getByRole("dialog", { name: `Guardar o pedido ${pedido.protocolo}` });
    await expect(j).toContainText("As fotos, os arquivos e os dados das pessoas deste pedido não são apagados pelo prazo.");
    await j.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(j.getByText("Escolha por que guardar.")).toBeVisible();
    await j.getByLabel("Outro motivo").check();
    await j.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(j.getByText("Conte o motivo, com 3 letras ou mais.")).toBeVisible();
    await conferir(page);
    await j.getByLabel("Sinistro com o seguro").check();
    await j.getByLabel("Detalhe").fill("Sinistro aberto na seguradora em 01/09/2026");
    await j.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(j).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Guardado por obrigação legal. O prazo não apaga nada daqui" })).toBeVisible();
    await expect(page.locator("header").getByText("Guardado", { exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Sinistro com o seguro (Sinistro aberto na seguradora em 01/09/2026)" })).toBeVisible();
    await page.getByRole("button", { name: "Mais ações" }).first().click();
    await expect(page.getByRole("button", { name: "Tirar a marca de guardado" })).toBeVisible();
    await page.keyboard.press("Escape");
    await conferir(page);

    await page.goto(`${PLATAFORMA}/configuracoes/privacidade`);
    const guardados = page.getByRole("region", { name: "Guardados por obrigação legal" }).filter({ has: page.getByRole("heading") });
    await expect(guardados.getByRole("link", { name: `Pedido ${pedido.protocolo}` })).toHaveAttribute("href", `/pedidos/pedido?id=${pedido.id}`);
    await expect(guardados).toContainText(`${pedido.assunto} · Sinistro com o seguro`);
  });
});
