// Área E da rodada com banco (0297; decisões E.1 a E.3 de 24/10/2026; V-09, CF-05, PI-20, MP-08,
// V-11) com a API falsa: revogar o acesso perguntando quem assume os pedidos e as manutenções, e só
// quando há algo em aberto; a imagem dentro da mensagem do chamado, ao abrir, responder e pedir
// mudança; e o Pronto do link do prestador com cada envio inteiro (o texto, quem fez, as fotos e a
// hora). Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa, V_ANA, V_BRUNA } from "./api-falsa-plataforma";
import { PRESTADOR_FALSO } from "./api-falsa-links";
import { maisAcoes } from "./registro";

const PLATAFORMA = "http://localhost:3000";
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const png = (name: string) => ({ name, mimeType: "image/png", buffer: PNG_1PX });
const antes = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

test.describe("Área E com banco", () => {
  test("E.1: revogar pergunta quem assume o pedido e a manutenção em aberto", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAtendimento: true });
    const pedido = estado.pedidos.find((p) => p.responsavelId === V_BRUNA)!;
    const bomba = estado.manutencao.manutencoes.find((m) => m.titulo === "Bomba de recalque com ruído")!;
    expect(bomba.responsavelId).toBe(V_BRUNA);
    await page.goto(`${PLATAFORMA}/pessoas/pessoa?id=${V_BRUNA}`);
    await expect(page.getByRole("heading", { level: 1, name: "Bruna" })).toBeVisible();
    await maisAcoes(page, "Revogar acesso");
    const j = page.getByRole("dialog", { name: "Revogar o acesso de Bruna" });
    await expect(j).toContainText("Secretária · desde 16/10/2026 · responsável por 1 pedido e 1 manutenção em aberto");

    // Os pedidos: só quem atende e está disponível, com o padrão da fila escolhido de saída.
    const pedidos = j.getByLabel("Quem assume o pedido de Bruna?");
    await expect(pedidos).toHaveValue(V_ANA);
    await expect(pedidos.getByRole("option")).toHaveText(["Ana Souza (responsável padrão)", "Deixar na fila sem responsável"]);
    await expect(j).toContainText("Só aparece quem atende os pedidos. Se preferir, escolha Deixar na fila sem responsável.");
    // As manutenções: só quem cuida da manutenção (a síndica).
    const manutencoes = j.getByLabel("Quem assume a manutenção de Bruna?");
    await expect(manutencoes).toHaveValue(V_ANA);
    // O padrão da fila é coisa dos pedidos: aqui, só o nome.
    await expect(manutencoes.getByRole("option")).toHaveText(["Ana Souza"]);
    await expect(j).toContainText("Só aparece quem cuida da manutenção.");
    await expect(j.getByText("Bruna para de entrar na hora")).toBeVisible();
    await conferir(page);

    await pedidos.selectOption({ label: "Deixar na fila sem responsável" });
    await j.getByRole("button", { name: "Revogar acesso" }).click();
    await expect(page).toHaveURL(/\/pessoas\?revogada=Bruna$/);
    await expect(page.getByRole("status").filter({ hasText: "Acesso de Bruna revogado" })).toBeVisible();
    expect(estado.revogacoes).toEqual([{ vinculoId: V_BRUNA, assumePedidosId: null, assumeManutencoesId: V_ANA }]);
    expect(pedido.responsavelId).toBeNull();
    expect(bomba.responsavelId).toBe(V_ANA);
  });

  test("E.1: sem nada em aberto, a janela é a de antes, sem as perguntas", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    estado.pessoas.push({ vinculoId: "9a0b1c2d-3e4f-4a5b-8c6d-00000000e001", pessoaId: "9a0b1c2d-3e4f-4a5b-8c6d-00000000e002", nome: "Caio", funcao: "AUTORIZADO",
      cargo: "Conselho", permissoes: ["ACOMPANHAR"], desde: "2026-10-18T13:00:00Z", versao: 1, responsavel: false, disponivel: false });
    await page.goto(`${PLATAFORMA}/pessoas/pessoa?id=9a0b1c2d-3e4f-4a5b-8c6d-00000000e001`);
    await maisAcoes(page, "Revogar acesso");
    const j = page.getByRole("dialog", { name: "Revogar o acesso de Caio" });
    await expect(j).toContainText("Conselho · desde 18/10/2026");
    await expect(j).not.toContainText("em aberto");
    await expect(j.getByRole("combobox")).toHaveCount(0);
    await expect(j.getByText("Caio para de entrar na hora")).toBeVisible();
    await conferir(page);
    await j.getByRole("button", { name: "Revogar acesso" }).click();
    await expect(page).toHaveURL(/\/pessoas\?revogada=Caio$/);
    expect(estado.revogacoes).toEqual([{ vinculoId: "9a0b1c2d-3e4f-4a5b-8c6d-00000000e001", assumePedidosId: undefined, assumeManutencoesId: undefined }]);
  });

  test("E.1: se a contagem ficou velha, a janela carrega de novo e passa a perguntar", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    const caio = "9a0b1c2d-3e4f-4a5b-8c6d-00000000e011";
    estado.pessoas.push({ vinculoId: caio, pessoaId: "9a0b1c2d-3e4f-4a5b-8c6d-00000000e012", nome: "Caio", funcao: "AUTORIZADO",
      cargo: "Zelador", permissoes: ["MANUTENCAO"], desde: "2026-10-18T13:00:00Z", versao: 1, responsavel: false, disponivel: false });
    await page.goto(`${PLATAFORMA}/pessoas/pessoa?id=${caio}`);
    await maisAcoes(page, "Revogar acesso");
    const j = page.getByRole("dialog", { name: "Revogar o acesso de Caio" });
    await expect(j.getByRole("combobox")).toHaveCount(0);
    // Enquanto a janela estava aberta, alguém passou uma manutenção para Caio.
    const bomba = estado.manutencao.manutencoes.find((m) => m.titulo === "Bomba de recalque com ruído")!;
    bomba.responsavelId = caio;
    await j.getByRole("button", { name: "Revogar acesso" }).click();
    await expect(j.getByText("Carregamos de novo o que está em aberto com Caio.", { exact: false })).toBeVisible();
    await expect(j).toContainText("responsável por 1 manutenção em aberto");
    await expect(j.getByLabel("Quem assume a manutenção de Caio?")).toHaveValue(V_ANA);
    await expect(j.getByRole("button", { name: "Carregar de novo" })).toBeVisible();
    expect(estado.revogacoes).toEqual([]);
    await conferir(page);
    await j.getByRole("button", { name: "Revogar acesso" }).click();
    await expect(page).toHaveURL(/\/pessoas\?revogada=Caio$/);
    expect(estado.revogacoes).toEqual([{ vinculoId: caio, assumePedidosId: undefined, assumeManutencoesId: V_ANA }]);
    expect(bomba.responsavelId).toBe(V_ANA);
  });

  test("E.2: a imagem vai dentro da mensagem, ao abrir o chamado e ao responder", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/suporte`);
    await page.getByRole("button", { name: "Abrir chamado" }).click();
    const janela = page.getByRole("dialog", { name: "Abrir chamado" });
    await janela.getByLabel("Título").fill("Fila some depois de filtrar por categoria");
    await janela.getByLabel("O que aconteceu").fill("Escolho a categoria Limpeza e a lista fica vazia.");
    await janela.getByLabel("Escolher imagens").setInputFiles(png("print-da-fila.png"));
    await janela.getByRole("button", { name: "Abrir chamado" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Fila some depois de filtrar por categoria" })).toBeVisible();

    // A imagem fica na primeira mensagem, com "Foto conferida · abrir"; não há mais a lista solta.
    const conversa = page.getByRole("list", { name: "Conversa" });
    const primeira = conversa.getByRole("listitem").filter({ hasText: "Escolho a categoria Limpeza" }).first();
    await expect(primeira.getByRole("button", { name: "print-da-fila.png Foto conferida · abrir" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Imagens do chamado" })).toHaveCount(0);
    const c = estado.suporte.chamados[0]!;
    expect(c.arquivos.map((a) => [a.mensagemId, a.situacao])).toEqual([[c.mensagens[0]!.id, "LIBERADO"]]);
    const aba = page.waitForEvent("popup");
    await primeira.getByRole("button", { name: "print-da-fila.png Foto conferida · abrir" }).click();
    await expect.poll(async () => (await aba).url()).toContain(`/api/v1/armazenamento/${c.arquivos[0]!.id}`);
    await conferir(page);

    // Responder: Anexar imagem junta a imagem à resposta; ela sai junto, ao Enviar resposta.
    c.mensagens.push({ id: "m-triade", lado: "TRIADE", autor: "Diego", texto: "Isso acontece também com outra categoria?", criadoEm: new Date().toISOString() });
    c.situacao = "ESPERANDO_CLIENTE";
    await page.reload();
    await page.getByLabel("Responder").fill("Acontece também com Elevadores. Mandei as duas telas.");
    await page.getByLabel("Anexar imagem").setInputFiles([png("elevadores-antes.png"), png("elevadores-depois.png"), png("manutencao-ok.png")]);
    const escolhidas = page.getByRole("list", { name: "Imagens desta mensagem" });
    await expect(escolhidas.getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("As imagens vão junto com esta resposta. Até 3 por resposta.")).toBeVisible();
    await conferir(page);
    await escolhidas.getByRole("button", { name: "Tirar manutencao-ok.png" }).click();
    await expect(escolhidas.getByRole("listitem")).toHaveCount(2);
    await page.getByRole("button", { name: "Enviar resposta" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Resposta enviada." })).toBeVisible();
    const resposta = conversa.getByRole("listitem").filter({ hasText: "Acontece também com Elevadores" }).first();
    await expect(resposta.getByRole("button", { name: /Foto conferida · abrir$/ })).toHaveCount(2);
    await expect(resposta.getByRole("button", { name: "elevadores-depois.png Foto conferida · abrir" })).toBeVisible();
    await expect(primeira.getByRole("button", { name: /Foto conferida · abrir$/ })).toHaveCount(1);
    const nova = c.mensagens.at(-1)!;
    expect(c.arquivos.filter((a) => a.mensagemId === nova.id).map((a) => a.nome)).toEqual(["elevadores-antes.png", "elevadores-depois.png"]);
    await expect(page.getByRole("list", { name: "Imagens desta mensagem" })).toHaveCount(0);
    await conferir(page);
  });

  test("E.2: no chamado com 10 imagens, Anexar imagem some", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    const c = estado.suporte.chamados[0]!;
    c.situacao = "ANDAMENTO";
    c.resolvidoEm = undefined;
    for (let i = 1; i <= 10; i++) {
      c.arquivos.push({ id: `9a0b1c2d-3e4f-4a5b-8c6d-0000000a00${String(i).padStart(2, "0")}`, nome: `tela-${i}.png`, tipo: "image/png", situacao: "LIBERADO",
        mensagemId: c.mensagens[0]!.id });
    }
    await page.goto(`${PLATAFORMA}/suporte?id=${c.id}`);
    await expect(page.getByRole("list", { name: "Conversa" }).getByRole("button", { name: /Foto conferida · abrir$/ })).toHaveCount(10);
    await expect(page.getByLabel("Responder")).toBeVisible();
    await expect(page.getByText("Anexar imagem")).toHaveCount(0);
    await conferir(page);
  });

  test("E.2: pedir mudança leva a imagem na mensagem do pedido", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    await page.goto(`${PLATAFORMA}/configuracoes/horarios`);
    const bloco = page.getByRole("region", { name: "Feito pela TRÍADE" });
    await bloco.getByRole("button", { name: "Pedir mudança" }).click();
    const janela = page.getByRole("dialog", { name: "Pedir mudança à TRÍADE" });
    await janela.getByLabel("O que precisa e por quê").fill("Mudar para o horário de Manaus: os prazos estão contando uma hora adiantados.");
    await janela.getByLabel("Anexar imagem").setInputFiles(png("prazos.png"));
    await expect(janela.getByText("A imagem vai junto com este pedido. Até 3 por pedido.")).toBeVisible();
    await conferir(page);
    await janela.getByRole("button", { name: "Pedir a mudança" }).click();
    await expect(janela).toHaveCount(0);
    const c = estado.suporte.chamados[0]!;
    expect(c.tipo).toBe("MUDANCA");
    expect(c.arquivos.map((a) => [a.nome, a.mensagemId, a.situacao])).toEqual([["prazos.png", c.mensagens[0]!.id, "LIBERADO"]]);
    await bloco.getByRole("link", { name: `Ver chamado ${c.numero}` }).click();
    await expect(page.getByRole("list", { name: "Conversa" }).getByRole("button", { name: "prazos.png Foto conferida · abrir" })).toBeVisible();
    await conferir(page);
  });

  test("E.3: o Pronto mostra cada envio com o texto, quem fez, as fotos e a hora", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page);
    const bomba = estado.manutencao.manutencoes.find((m) => m.titulo === "Bomba de recalque com ruído")!;
    const l = estado.links;
    const link = "5c6d7e8f-9a0b-4c1d-8e2f-00000000e301";
    l.links.push({ id: link, manutencaoId: bomba.id, para: "HidroPress Bombas", oQueFazer: "Bomba 2 com ruído forte. Trocar o rolamento.", quando: "Hoje, 14h às 17h",
      comoEntrar: null, expiraEm: new Date(Date.now() + 2 * 86400_000).toISOString(), abertoEm: null, criadoEm: antes(60), codigo: PRESTADOR_FALSO, revogado: null,
      respondidoEm: antes(10), resposta: "CONFIRMOU" });
    // A confirmação é um registro, com a hora, como no banco.
    l.registros.unshift({ id: "r-confirmou", linkId: link, manutencaoId: bomba.id, tipo: "CONFIRMOU", em: antes(10), fotos: [] });
    const foto = (id: string, nome: string, x: Partial<{ retirada: boolean }> = {}) => ({ id, nome, tipo: "image/png", linkId: link, situacao: "LIBERADO", ...x });
    l.fotos.push(foto("f-falta", "rolamento.png"), foto("f-antes", "bomba-antes.png"), foto("f-depois", "bomba-depois.png"), foto("f-tirada", "errada.png", { retirada: true }));
    const etiqueta = l.etiquetas.find((e) => e.local === "Casa de bombas · Bomba 2")!;
    l.registros.unshift(
      { id: "r-chegou", linkId: link, manutencaoId: bomba.id, tipo: "CHEGOU", confirmado: true, etiqueta: { rotulo: `E0${etiqueta.numero}`, local: etiqueta.local }, em: antes(8), fotos: [] },
      { id: "r-falta", linkId: link, manutencaoId: bomba.id, tipo: "IMPEDIMENTO", impedimento: "FALTA_PECA", texto: "Faltou o rolamento 6203. Fui buscar e volto logo.",
        quemFez: "Márcio", em: antes(6), fotos: ["f-falta"] },
      { id: "r-terminou", linkId: link, manutencaoId: bomba.id, tipo: "TERMINOU", texto: "Troquei o rolamento da bomba 2 e testei as duas bombas por 20 minutos.",
        ficouPendente: false, quemFez: "Márcio", em: antes(2), fotos: ["f-antes", "f-depois", "f-tirada"] },
    );
    await page.goto(`${PLATAFORMA}/p/${PRESTADOR_FALSO}`);
    await expect(page.getByText("Enviado. Obrigado!")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Passos do serviço" })).toHaveAttribute("aria-valuenow", "4");

    // Na ordem em que foi mandado, do mais antigo ao mais novo, com a hora de cada um.
    const envios = page.getByRole("list", { name: "O que você mandou" }).locator(":scope > li");
    await expect(envios).toHaveCount(4);
    await expect(envios.nth(0)).toContainText(/^Confirmou hoje, \d\d:\d\dpara hoje, 14h às 17h$/);
    await expect(envios.nth(1)).toContainText(/^Chegou hoje, \d\d:\d\dconfirmado pela etiqueta E03$/);
    await expect(envios.nth(2)).toContainText(/^Não consegui terminar · hoje, \d\d:\d\d · Márcio/);
    await expect(envios.nth(2)).toContainText("“Faltou o rolamento 6203. Fui buscar e volto logo.”");
    await expect(envios.nth(2).getByRole("button", { name: /^Abrir a foto/ })).toHaveCount(1);
    await expect(envios.nth(3)).toContainText(/^Terminei · hoje, \d\d:\d\d · Márcio/);
    await expect(envios.nth(3)).toContainText("“Troquei o rolamento da bomba 2 e testei as duas bombas por 20 minutos.”");
    await expect(envios.nth(3)).toContainText("Nada ficou para depois");
    // A foto que o condomínio tirou da manutenção some também daqui.
    await expect(envios.nth(3).getByRole("button", { name: /^Abrir a foto/ })).toHaveCount(2);
    await expect(page.getByRole("button", { name: /errada\.png/ })).toHaveCount(0);
    await conferir(page);

    const aba = page.waitForEvent("popup");
    await envios.nth(3).getByRole("button", { name: "Abrir a foto 2, bomba-depois.png" }).click();
    await expect.poll(async () => (await aba).url()).toContain("/api/v1/armazenamento/f-depois");
    await expect(page.getByRole("button", { name: "Mandar mais uma coisa" })).toBeVisible();
  });
});
