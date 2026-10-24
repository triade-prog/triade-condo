// R5 · Decisões e aprovações (V-14, FC-10; quadros 410 a 423): o conselho em Pessoas, a ausência
// do síndico, pedir ao conselho, a votação em Decisões com o quórum e o Reenviar o link, o voto
// pelo painel, o link do conselheiro sem conta, as despesas de ponta a ponta e as regras. Cada
// tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { maisAcoes } from "./registro";

const PLATAFORMA = "http://localhost:3000";
const PDF = { name: "Orçamento HidroPress.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF") };

async function conferir(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

const recado = (page: Page, texto: string) => page.getByRole("status").filter({ hasText: texto });
const ultimo = (estado: { aprovacoes: { enviados: { caminho: string; corpo: Record<string, unknown> }[] } }, caminho: RegExp) =>
  [...estado.aprovacoes.enviados].reverse().find((e) => caminho.test(e.caminho))?.corpo;
const VOTACAO = "Trocar o portão da garagem ou consertar o motor";

test.describe("Plataforma · decisões e aprovações (R5)", () => {
  test("V-14: Pessoas › Conselho mostra o conselho, inclui membro, renova o mandato e marca e encerra a ausência", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAprovacoes: true });
    await page.goto(`${PLATAFORMA}/pessoas?aba=conselho`);
    await expect(page.getByRole("tablist", { name: "Partes de Pessoas" }).getByRole("tab", { name: /Conselho/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("region", { name: "Como o conselho decide" })).toContainText("Maioria dos titulares: 3 de 4 votos aprovam.");
    const membros = page.getByRole("region", { name: "Membros do conselho" });
    await expect(membros.getByRole("listitem").filter({ hasText: "Lúcia Andrade" })).toContainText("Mandato vence em 29 dias");
    await expect(membros.getByRole("listitem").filter({ hasText: "Paulo Dias" })).toContainText("Mandato vencido");
    await expect(membros.getByRole("listitem").filter({ hasText: "Rafael Gomes" })).toContainText("Suplente");
    await expect(page.getByRole("region", { name: "Ausência do síndico" })).toContainText("as decisões pedidas ao síndico vão para Bruna, o subsíndico");
    await conferir(page);

    // Incluir membro (quadro 411): só o nome e o contato.
    await page.getByRole("button", { name: "Incluir membro" }).first().click();
    const incluir = page.getByRole("dialog", { name: "Incluir membro do conselho" });
    await incluir.getByRole("radio", { name: /Só o nome e o contato/ }).check();
    await incluir.getByRole("button", { name: "Incluir" }).click();
    await expect(incluir.getByText("Escreva o nome (2 a 120 caracteres).")).toBeVisible();
    await incluir.getByRole("textbox", { name: "Nome", exact: true }).fill("Rita Souza");
    await incluir.getByLabel("Papel").selectOption("SUPLENTE");
    await incluir.getByLabel("Celular").fill("(61) 99999-0009");
    await conferir(page);
    await incluir.getByRole("button", { name: "Incluir" }).click();
    await expect(recado(page, "Rita Souza entrou no conselho como suplente.")).toBeVisible();
    expect(ultimo(estado, /POST \/v1\/condominio\/conselho$/)).toMatchObject({ nome: "Rita Souza", papel: "SUPLENTE", canal: "WHATSAPP", celular: "(61) 99999-0009" });
    await expect(membros).toContainText("Rita Souza");

    // A ficha e o Renovar mandato (quadro 422, Mandato vencido).
    await membros.getByRole("button", { name: "Lúcia Andrade" }).click();
    const ficha = page.getByRole("dialog", { name: "Lúcia Andrade" });
    await expect(ficha).toContainText("O mandato vai até 14/11.");
    await ficha.getByRole("button", { name: "Renovar mandato" }).click();
    const renovar = page.getByRole("dialog", { name: "Renovar mandato" });
    await expect(renovar.getByLabel("Fim do mandato")).toHaveValue("2028-11-14");
    await renovar.getByRole("button", { name: "Renovar" }).click();
    await expect(recado(page, "Mandato de Lúcia Andrade renovado até 14/11/2028.")).toBeVisible();

    // Ausência do síndico (quadro 412): o motivo é opcional.
    await page.getByRole("region", { name: "Ausência do síndico" }).getByRole("button", { name: "Marcar ausência" }).click();
    const ausencia = page.getByRole("dialog", { name: "Ausência do síndico" });
    await expect(ausencia).toContainText("Vai para Bruna");
    await expect(ausencia).toContainText("Fica com você");
    await ausencia.getByLabel("Até").fill("2026-10-30");
    await conferir(page);
    await ausencia.getByRole("button", { name: "Marcar ausência" }).click();
    await expect(recado(page, "Ausência marcada de 16/10 a 30/10. Bruna responde no lugar do síndico e foi avisado.")).toBeVisible();
    expect(ultimo(estado, /POST \/v1\/condominio\/ausencia$/)).toEqual({ de: "2026-10-16", ate: "2026-10-30", motivo: null });
    await expect(page.getByRole("region", { name: "Ausência do síndico" })).toContainText("Ana Souza está ausente de 16/10 a 30/10");

    // Com a ausência, Decisões avisa no alto (quadro 422, Síndica ausente).
    await page.goto(`${PLATAFORMA}/decisoes?filtro=TODAS`);
    await expect(page.getByText("Ana Souza está ausente de 16/10 a 30/10")).toBeVisible();
    await expect(page.getByText("Decisões e despesas pedidas ao síndico estão indo para Bruna, o subsíndico.")).toBeVisible();
    await page.getByRole("link", { name: "Encerrar a ausência" }).click();
    await page.getByRole("region", { name: "Ausência do síndico" }).getByRole("button", { name: "Encerrar a ausência" }).click();
    await page.getByRole("dialog", { name: "Encerrar a ausência" }).getByRole("button", { name: "Encerrar" }).click();
    await expect(recado(page, "Ausência encerrada.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Ausência do síndico" })).toContainText("Nenhuma marcada.");
  });

  test("V-14: sem conselho, a aba mostra o estado vazio e Quem decide não oferece O conselho", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAprovacoes: true });
    estado.aprovacoes.membros.length = 0;
    await page.goto(`${PLATAFORMA}/pessoas?aba=conselho`);
    await expect(page.getByText("Conselho vazio")).toBeVisible();
    await expect(page.getByText("\"O conselho\" não aparece em Quem decide até haver pelo menos um titular com mandato em dia.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Ausência do síndico" })).toContainText("Sem subsíndico no conselho, a ausência não pode ser marcada.");
    await conferir(page);
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${estado.pedidos[1]!.id}`);
    await maisAcoes(page, "Pedir decisão");
    const pedir = page.getByRole("dialog", { name: "Pedir decisão · 2026-0002" });
    await expect(pedir.getByRole("group", { name: "Quem decide" })).toContainText("Ana Souza (síndico)");
    await expect(pedir.getByRole("group", { name: "Quem decide" })).not.toContainText("O conselho");
  });

  test("V-14: pedir decisão ao conselho; os links do WhatsApp aparecem para copiar", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const estado = await instalarApiPlataformaFalsa(page, { comAprovacoes: true });
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${estado.pedidos[1]!.id}`);
    await maisAcoes(page, "Pedir decisão");
    const pedir = page.getByRole("dialog", { name: "Pedir decisão · 2026-0002" });
    const quem = pedir.getByRole("group", { name: "Quem decide" });
    await expect(quem).toContainText("4 titulares votam; maioria: 3 votos aprovam.");
    await quem.getByRole("radio", { name: /O conselho/ }).check();
    await expect(pedir.getByRole("textbox", { name: "Votar até" })).toHaveValue("2026-10-19");
    await expect(pedir).toContainText("Cada conselheiro recebe um link pessoal pelo contato do conselho.");
    await pedir.getByLabel("O que precisa ser decidido").fill("Qual empresa faz a impermeabilização da laje");
    await pedir.getByLabel("Alternativa 1").fill("Remendo no trecho rachado");
    await pedir.getByLabel("Custo estimado").fill("2.400");
    await pedir.getByRole("button", { name: "+ Alternativa" }).click();
    await pedir.getByRole("textbox", { name: "Alternativa 2" }).fill("Refazer a impermeabilização");
    await pedir.getByLabel("Custo estimado").nth(1).fill("18.900");
    await expect(pedir).toContainText("2 alternativas · de R$ 2.400 a R$ 18.900");
    await conferir(page);
    await pedir.getByRole("button", { name: "Pedir ao conselho" }).click();

    const links = page.getByRole("dialog", { name: "Mande o link pelo WhatsApp" });
    await expect(links).toContainText("Marta Reis");
    await expect(links).toContainText("Lúcia Andrade");
    await expect(links).toContainText("Pelo e-mail: João Pedro Alves. Esses já foram.");
    await expect(links.getByLabel("Link de Marta Reis", { exact: true })).toContainText("/conselho/link-");
    await conferir(page);
    await links.getByRole("button", { name: "Copiar o link de Marta Reis" }).click();
    await expect(links.getByRole("button", { name: "Copiado: link de Marta Reis" })).toHaveText("Copiado");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^http:\/\/localhost:3000\/conselho\/link-/);
    await links.getByRole("button", { name: "Pronto" }).click();
    await expect(recado(page, "Decisão pedida ao conselho, para votar até 19/10. Link mandado pelo e-mail para João Pedro Alves.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Em votação no conselho (0 de 4 votaram) até 19/10" })).toBeVisible();
  });

  test("V-14: Decisões mostra a votação com o quórum e os votos; reenviar o link; a frase do advogado leva à convenção", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAprovacoes: true });
    await page.goto(`${PLATAFORMA}/decisoes?filtro=TODAS`);
    const abas = page.getByRole("tablist", { name: "Partes de Decisões" });
    await expect(abas.getByRole("tab", { name: /Dos pedidos/ })).toHaveAttribute("aria-selected", "true");
    await expect(abas.getByRole("tab", { name: /Despesas/ })).toBeVisible();
    const cartao = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: VOTACAO }) });
    await expect(cartao).toContainText("Em votação");
    await expect(cartao).toContainText("Votar até 23/10");
    await expect(cartao).toContainText("1 de 3 votos para aprovar a alternativa 2");
    await expect(cartao).toContainText("2 de 4 titulares votaram. Faltam Bruna e Lúcia. Se ninguém chegar a 3 votos até 23/10, a decisão volta para Ana Souza decidir.");
    const votos = cartao.getByRole("region", { name: "Votos" }).or(cartao.locator("section").filter({ has: page.getByRole("heading", { name: "Votos" }) }));
    await expect(votos.getByRole("listitem").filter({ hasText: "João Pedro Alves" })).toContainText("Devolver");
    await expect(votos.getByRole("listitem").filter({ hasText: "João Pedro Alves" })).toContainText("Quero ver um terceiro orçamento antes.");
    await expect(votos.getByRole("listitem").filter({ hasText: "Lúcia Andrade" })).toContainText("Ainda não votou");
    await expect(votos.getByRole("listitem").filter({ hasText: "Lúcia Andrade" })).toContainText("Link aberto em");
    const fechada = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Pintura do hall: qual cor" }) });
    await expect(fechada).toContainText("Aprovada a alternativa 1");
    await expect(page.getByText("Em dúvida sobre a lei ou a convenção, consulte um advogado.")).toBeVisible();
    await conferir(page);

    await cartao.getByRole("button", { name: "Reenviar o link para Lúcia" }).click();
    const links = page.getByRole("dialog", { name: "Mande o link pelo WhatsApp" });
    await expect(links).toContainText("Lúcia Andrade");
    await links.getByRole("button", { name: "Pronto" }).click();
    await expect(recado(page, "Link novo para Lúcia Andrade. O anterior parou de valer. Copie e mande pelo WhatsApp.")).toBeVisible();
    await cartao.getByRole("button", { name: "Reenviar o link para João" }).count().then((n) => expect(n).toBe(0));

    await page.getByRole("link", { name: "Abrir a convenção" }).click();
    await expect(page).toHaveURL(/\/documentos\/prontuario\?item=CONVENCAO/);
    await expect(page.getByRole("dialog", { name: "Convenção" })).toBeVisible();
  });

  test("V-14: a subsíndica vê no Início, vota pelo painel e a votação fecha no quórum; e vota na despesa", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAprovacoes: true, quem: "SECRETARIA" });
    const lucia = estado.aprovacoes.membros.find((m) => m.nome === "Lúcia Andrade")!;
    const decisao = estado.decisoes.decisoes.find((d) => d.pergunta === VOTACAO)!;
    estado.aprovacoes.votacoes[decisao.id]!.votos[lucia.id] = { escolha: "2", em: "2026-10-16T15:00:00.000Z", canal: "LINK" };

    await page.goto(`${PLATAFORMA}/`);
    await expect(page.getByText("2 decisões aguardando você")).toBeVisible();
    await expect(page.getByText(/1 votação do conselho; 1 despesa para aprovar/)).toBeVisible();

    await page.goto(`${PLATAFORMA}/decisoes`);
    const cartao = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: VOTACAO }) });
    await expect(cartao).toContainText("3 votos iguais decidem");
    await expect(cartao).toContainText("3 de 4 titulares votaram. Os outros votos aparecem quando a decisão fechar.");
    await expect(cartao).not.toContainText("João Pedro Alves");
    await expect(cartao.getByRole("button", { name: /Reenviar o link/ })).toHaveCount(0);
    await conferir(page);
    await cartao.getByRole("button", { name: `Votar: ${VOTACAO}` }).click();
    const votar = page.getByRole("dialog", { name: "Votar" });
    await votar.getByRole("radio", { name: /Devolver sem escolher/ }).check();
    await votar.getByRole("button", { name: "Enviar meu voto" }).click();
    await expect(votar.getByText("Escreva o porquê (3 a 1000 caracteres).")).toBeVisible();
    await votar.getByRole("radio", { name: /2 · Trocar só o motor/ }).check();
    await conferir(page);
    await votar.getByRole("button", { name: "Enviar meu voto" }).click();
    await expect(recado(page, "Voto registrado. Com ele, a votação fechou: o resultado já está na lista.")).toBeVisible();
    expect(decisao.estado).toBe("APROVADA");
    expect(decisao.alternativaAprovada).toBe(2);

    await page.getByRole("group", { name: "Quais decisões" }).getByRole("button", { name: "Todas" }).click();
    await expect(page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: VOTACAO }) })).toContainText("Aprovada a alternativa 2");

    // A despesa em votação, pela aba Despesas (quem vota vê a aba sem a permissão de despesas).
    await page.getByRole("tablist", { name: "Partes de Decisões" }).getByRole("tab", { name: /Despesas/ }).click();
    await page.getByRole("link", { name: "Conta de reparo do elevador" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Conta de reparo do elevador" })).toBeVisible();
    await page.getByRole("button", { name: "Votar", exact: true }).click();
    const votoDespesa = page.getByRole("dialog", { name: "Votar" });
    await votoDespesa.getByRole("radio", { name: /Aprovar a despesa/ }).check();
    await votoDespesa.getByRole("button", { name: "Enviar meu voto" }).click();
    await expect(recado(page, "Voto registrado. Dá para trocar até o prazo.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Trocar meu voto" })).toBeVisible();
    await conferir(page);
    // Sem nada mais esperando, quem só vota segue vendo a votação para trocar o voto até fechar.
    await page.reload();
    await expect(page.getByRole("button", { name: "Trocar meu voto" })).toBeVisible();
    await expect(page.getByText("Você não tem a permissão", { exact: false })).toHaveCount(0);
  });

  test("V-14: quem só vota, depois do voto, segue em Aguardando e troca o voto até fechar", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAprovacoes: true, quem: "SECRETARIA" });
    const bruna = estado.aprovacoes.membros.find((m) => m.nome === "Bruna")!;
    const elevador = estado.aprovacoes.despesas.find((d) => d.descricao === "Conta de reparo do elevador")!;
    estado.aprovacoes.votacoes[elevador.id]!.votos[bruna.id] = { escolha: "APROVAR", em: "2026-10-16T15:00:00.000Z", canal: "PAINEL" };
    await page.goto(`${PLATAFORMA}/decisoes`);
    const cartao = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: VOTACAO }) });
    await cartao.getByRole("button", { name: `Votar: ${VOTACAO}` }).click();
    const votar = page.getByRole("dialog", { name: "Votar" });
    await votar.getByRole("radio", { name: /2 · Trocar só o motor/ }).check();
    await votar.getByRole("button", { name: "Enviar meu voto" }).click();
    await expect(recado(page, "Voto registrado.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Você não tem a permissão", { exact: false })).toHaveCount(0);
    await expect(cartao.getByRole("button", { name: `Trocar meu voto: ${VOTACAO}` })).toBeVisible();
    await conferir(page);
    await cartao.getByRole("button", { name: `Trocar meu voto: ${VOTACAO}` }).click();
    await votar.getByRole("radio", { name: /1 · Trocar o portão inteiro/ }).check();
    await votar.getByRole("button", { name: "Trocar meu voto" }).click();
    await expect(recado(page, "Voto trocado.")).toBeVisible();
    expect(estado.aprovacoes.votacoes[estado.decisoes.decisoes.find((d) => d.pergunta === VOTACAO)!.id]!.votos[bruna.id]!.escolha).toBe("1");
  });

  test("V-14: suplente não vota: quem tem voto a dar não passa a suplente; o link de quem passou para de valer", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comAprovacoes: true });
    await page.goto(`${PLATAFORMA}/pessoas?aba=conselho`);
    const membros = page.getByRole("region", { name: "Membros do conselho" });
    await membros.getByRole("button", { name: "Lúcia Andrade" }).click();
    await page.getByRole("dialog", { name: "Lúcia Andrade" }).getByRole("button", { name: "Alterar" }).click();
    const alterar = page.getByRole("dialog", { name: "Alterar membro do conselho" });
    await alterar.getByLabel("Papel").selectOption("SUPLENTE");
    await alterar.getByRole("button", { name: "Salvar" }).click();
    await expect(alterar.getByText("Ainda tem voto a dar numa votação aberta. Espere a votação fechar para passar a suplente.")).toBeVisible();
    await conferir(page);
    await alterar.getByRole("button", { name: "Cancelar" }).click();

    await membros.getByRole("button", { name: "Marta Reis" }).click();
    await page.getByRole("dialog", { name: "Marta Reis" }).getByRole("button", { name: "Alterar" }).click();
    await alterar.getByLabel("Papel").selectOption("SUPLENTE");
    await alterar.getByRole("button", { name: "Salvar" }).click();
    await expect(recado(page, "Marta Reis: dados do conselho salvos.")).toBeVisible();
    await expect(membros.getByRole("listitem").filter({ hasText: "Marta Reis" })).toContainText("Suplente");

    await page.goto(`${PLATAFORMA}/conselho/link-marta-voto`);
    await expect(page.getByRole("heading", { name: "Este link não vale mais" })).toBeVisible();
    await expect(page.getByText("Você passou a suplente: suplente não vota. Se acha que é engano, fale com o síndico.")).toBeVisible();
    await expect(page.getByText(VOTACAO)).toHaveCount(0);
    await conferir(page);
  });

  test("V-14: quem só atualiza pede ao conselho e o link do WhatsApp fica com o síndico", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAprovacoes: true, quem: "SECRETARIA", secretariaRegistra: true });
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${estado.pedidos[1]!.id}`);
    await maisAcoes(page, "Pedir decisão");
    const pedir = page.getByRole("dialog", { name: "Pedir decisão · 2026-0002" });
    await pedir.getByRole("group", { name: "Quem decide" }).getByRole("radio", { name: /O conselho/ }).check();
    await pedir.getByLabel("O que precisa ser decidido").fill("Qual empresa faz a impermeabilização da laje");
    await pedir.getByLabel("Alternativa 1").fill("Remendo no trecho rachado");
    await pedir.getByRole("button", { name: "Pedir ao conselho" }).click();
    const links = page.getByRole("dialog", { name: "Mande o link pelo WhatsApp" });
    await expect(links).toContainText("o link para copiar só aparece para o síndico e para quem cuida do conselho");
    await expect(links.getByRole("listitem").filter({ hasText: "Marta Reis" })).toContainText("Peça o link ao síndico. Se Marta já tinha um link, ele continua valendo.");
    await expect(links.getByRole("button", { name: /Copiar o link/ })).toHaveCount(0);
    await expect(links.getByText(/\/conselho\//)).toHaveCount(0);
    await conferir(page);
    await links.getByRole("button", { name: "Pronto" }).click();
    await expect(recado(page, "Peça o link ao síndico de Marta Reis, Lúcia Andrade pelo WhatsApp.")).toBeVisible();
    const nova = estado.decisoes.decisoes.at(-1)!;
    const peloZap = estado.aprovacoes.membros.filter((m) => m.canal === "WHATSAPP").map((m) => m.id);
    expect(estado.aprovacoes.links.filter((l) => l.itemId === nova.id && peloZap.includes(l.membroId) && l.codigo)).toHaveLength(0);
  });

  test("V-14: com a síndica ausente e o subsíndico sem painel, sai o link do substituto para copiar", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const estado = await instalarApiPlataformaFalsa(page, { comAprovacoes: true });
    const bruna = estado.aprovacoes.membros.find((m) => m.nome === "Bruna")!;
    Object.assign(bruna, { vinculo: undefined, canal: "WHATSAPP", celular: "+5561999990101" });
    await page.goto(`${PLATAFORMA}/pessoas?aba=conselho`);
    await page.getByRole("region", { name: "Ausência do síndico" }).getByRole("button", { name: "Marcar ausência" }).click();
    const ausencia = page.getByRole("dialog", { name: "Ausência do síndico" });
    await ausencia.getByLabel("Até").fill("2026-10-30");
    await ausencia.getByRole("button", { name: "Marcar ausência" }).click();
    const links = page.getByRole("dialog", { name: "Mande o link pelo WhatsApp" });
    await expect(links.getByText("Bruna · link do substituto").first()).toBeVisible();
    await conferir(page);
    await links.getByRole("button", { name: "Pronto" }).click();
    await expect(recado(page, "Ausência marcada de 16/10 a 30/10. Bruna responde no lugar do síndico e foi avisado.")).toBeVisible();

    // Pedida à síndica durante a ausência: o link do substituto sai na hora.
    await page.goto(`${PLATAFORMA}/pedidos/pedido?id=${estado.pedidos[1]!.id}`);
    await maisAcoes(page, "Pedir decisão");
    const pedir = page.getByRole("dialog", { name: "Pedir decisão · 2026-0002" });
    await pedir.getByRole("group", { name: "Quem decide" }).getByRole("radio", { name: /Ana Souza \(síndico\)/ }).check();
    await pedir.getByLabel("O que precisa ser decidido").fill("Trocar a fechadura do portão social");
    await pedir.getByLabel("Alternativa 1").fill("Fechadura eletrônica");
    await pedir.getByRole("button", { name: "Pedir decisão" }).click();
    await expect(page.getByRole("dialog", { name: "Mande o link pelo WhatsApp" }).getByText("Bruna · link do substituto")).toBeVisible();
    await page.getByRole("dialog", { name: "Mande o link pelo WhatsApp" }).getByRole("button", { name: "Pronto" }).click();

    // Na Decisões e na ficha da despesa, o Copiar o link do substituto gera um código novo.
    await page.goto(`${PLATAFORMA}/decisoes?filtro=TODAS`);
    const cartao = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Trocar a fechadura do portão social" }) });
    await expect(cartao).toContainText("Bruna · link do substituto");
    await conferir(page);
    await cartao.getByRole("button", { name: "Copiar o link do substituto" }).click();
    await expect(page.getByRole("dialog", { name: "Mande o link pelo WhatsApp" }).getByLabel("Link de Bruna", { exact: true })).toContainText("/conselho/link-");
    await page.getByRole("dialog", { name: "Mande o link pelo WhatsApp" }).getByRole("button", { name: "Pronto" }).click();
    await expect(recado(page, "Link do substituto novo para Bruna. O anterior parou de valer. Copie e mande pelo WhatsApp.")).toBeVisible();
    expect([...estado.aprovacoes.enviados].reverse().find((e) => /reenviar-link$/.test(e.caminho))?.corpo).toMatchObject({ membroId: bruna.id, finalidade: "SUBSTITUTO" });

    await page.goto(`${PLATAFORMA}/decisoes?aba=despesas`);
    await page.getByRole("link", { name: "Compra de lâmpadas LED das garagens" }).click();
    await expect(page.getByRole("heading", { name: "Links pelo conselho" })).toBeVisible();
    await expect(page.getByText("Bruna · link do substituto")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Copiar o link do substituto" }).click();
    const dialogo = page.getByRole("dialog", { name: "Mande o link pelo WhatsApp" });
    await dialogo.getByRole("button", { name: "Copiar o link de Bruna" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^http:\/\/localhost:3000\/conselho\/link-/);
  });

  test("V-14: o link do conselheiro sem conta: votar, trocar, fechado, prazo acabou, vencido, trocado e inválido", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAprovacoes: true, logado: false });
    await page.goto(`${PLATAFORMA}/conselho/link-lucia-voto`);
    await expect(page.getByRole("heading", { level: 1, name: "Conselho do Residencial Ipê" })).toBeVisible();
    await expect(page.getByText("Lúcia Andrade · Conselheiro fiscal")).toBeVisible();
    await expect(page.getByText("Votar até 23/10, 23:59")).toBeVisible();
    await expect(page.getByText("3 votos aprovam")).toBeVisible();
    await expect(page.getByRole("heading", { name: VOTACAO })).toBeVisible();
    await expect(page.getByText("Não precisa de conta nem senha. O link é só seu: não repasse.")).toBeVisible();
    await conferir(page);
    await page.getByRole("radio", { name: /2 · Trocar só o motor/ }).check();
    await page.getByRole("button", { name: "Enviar meu voto" }).click();
    await expect(recado(page, "Voto registrado.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seu voto foi registrado" })).toBeVisible();
    await expect(page.getByText(/Alternativa 2: Trocar só o motor/)).toBeVisible();
    await conferir(page);

    await page.getByRole("button", { name: "Trocar meu voto" }).click();
    await expect(page.getByRole("radio", { name: /2 · Trocar só o motor/ })).toBeChecked();
    await page.getByRole("radio", { name: /Devolver sem escolher/ }).check();
    await page.getByRole("button", { name: "Trocar meu voto" }).click();
    await expect(page.getByText("Escreva o porquê (3 a 1000 caracteres).")).toBeVisible();
    await page.getByLabel("Por quê").fill("Quero o laudo do motor antes.");
    await page.getByRole("button", { name: "Trocar meu voto" }).click();
    await expect(recado(page, "Voto trocado.")).toBeVisible();
    await expect(page.getByText(/Devolveu sem decidir/)).toBeVisible();

    await page.goto(`${PLATAFORMA}/conselho/link-joao-fechada`);
    await expect(page.getByRole("heading", { name: "Decisão fechada" })).toBeVisible();
    await expect(page.getByText("Aprovada a alternativa 1 · Cinza claro. Aprovada por 3 de 4 titulares.")).toBeVisible();
    await expect(page.getByText("Pedir desconto antes.", { exact: false })).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/conselho/link-paulo-vencido`);
    await expect(page.getByRole("heading", { name: "Este link não vale mais" })).toBeVisible();
    await expect(page.getByText("O mandato não está em dia. Se você é do conselho, peça um novo ao síndico.")).toBeVisible();
    await conferir(page);

    await page.goto(`${PLATAFORMA}/conselho/link-marta-trocado`);
    await expect(page.getByText("Um link novo foi mandado e este parou.", { exact: false })).toBeVisible();
    await expect(page.getByText(VOTACAO)).toHaveCount(0);

    // Fechada há mais de 7 dias: o link venceu e não mostra nada do item.
    estado.decisoes.decisoes.find((d) => d.pergunta === "Pintura do hall: qual cor")!.prazo = "2026-10-01";
    await page.goto(`${PLATAFORMA}/conselho/link-joao-fechada`);
    await expect(page.getByRole("heading", { name: "Este link venceu" })).toBeVisible();
    await expect(page.getByText("Pintura do hall")).toHaveCount(0);
    await conferir(page);

    // Quem saiu do conselho: o link diz que não é mais do conselho.
    estado.aprovacoes.membros.find((m) => m.nome === "João Pedro Alves")!.retiradoEm = "2026-10-16T12:00:00.000Z";
    await page.goto(`${PLATAFORMA}/conselho/link-joao-voto`);
    await expect(page.getByText("Você não é mais do conselho. Se acha que é engano, fale com o síndico.")).toBeVisible();
    await expect(page.getByText(VOTACAO)).toHaveCount(0);
    estado.aprovacoes.membros.find((m) => m.nome === "João Pedro Alves")!.retiradoEm = undefined;

    await page.goto(`${PLATAFORMA}/conselho/nao-existe`);
    await expect(page.getByText("Este link não existe. Confira o endereço ou peça um novo ao síndico.")).toBeVisible();

    estado.decisoes.decisoes.find((d) => d.pergunta === VOTACAO)!.prazo = "2026-10-15";
    await page.goto(`${PLATAFORMA}/conselho/link-joao-voto`);
    await expect(page.getByRole("heading", { name: "O prazo acabou" })).toBeVisible();
    await expect(page.getByText("A votação fechou em 15/10 sem 3 votos iguais.", { exact: false })).toBeVisible();
  });

  test("FC-10: despesa de ponta a ponta: nova com a fatura, aprovar, paga fora do sistema, desfazer e publicar", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAprovacoes: true });
    await page.goto(`${PLATAFORMA}/decisoes?aba=despesas`);
    await expect(page.getByRole("tablist", { name: "Partes de Decisões" }).getByRole("tab", { name: /Despesas/ })).toHaveAttribute("aria-selected", "true");
    const lista = page.getByRole("region", { name: "Despesas" });
    await expect(lista.getByRole("listitem").filter({ hasText: "Conta de reparo do elevador" })).toContainText("Em votação · 1 de 3");
    await expect(lista.getByRole("listitem").filter({ hasText: "Conta de reparo do elevador" })).toContainText("Passa da alçada");
    await expect(lista.getByRole("listitem").filter({ hasText: "Compra de lâmpadas LED das garagens" })).toContainText("Aguardando você");
    await expect(page.getByText("Alçada do conselho: a partir de R$ 3.000, escrita em Configurações › Regras.", { exact: false })).toBeVisible();
    await page.getByRole("group", { name: "Quais despesas" }).getByRole("button", { name: /Aprovadas/ }).click();
    await expect(page.getByRole("region", { name: "Despesas" }).getByRole("listitem").filter({ hasText: "Limpeza da caixa d’água" })).toContainText("Paga fora");
    await conferir(page);

    await page.getByRole("button", { name: "Nova despesa para aprovar" }).click();
    const nova = page.getByRole("dialog", { name: "Nova despesa para aprovar" });
    await nova.getByLabel("O que é").fill("Troca da bomba do poço");
    await nova.getByLabel("Valor").fill("4.800,00");
    await nova.getByLabel("Fornecedor").selectOption({ label: "Outro: escrever só o nome" });
    await nova.getByLabel("Nome do fornecedor").fill("HidroPress");
    await nova.locator('input[type="file"]').first().setInputFiles(PDF);
    await expect(nova.getByRole("group", { name: "Quem aprova" })).toContainText("4 titulares votam; maioria: 3 votos aprovam.");
    await nova.getByRole("radio", { name: /Ana Souza \(você\)/ }).check();
    await expect(nova.getByText("Chega à alçada do conselho (a partir de R$ 3.000), escrita nas Regras. É só um aviso: dá para pedir assim mesmo.")).toBeVisible();
    await expect(nova.getByRole("textbox", { name: "Responder até" })).toHaveValue("2026-10-23");
    await conferir(page);
    await nova.getByRole("button", { name: "Pedir aprovação" }).click();
    await expect(recado(page, "Despesa registrada para você aprovar. 1 anexo liberado.")).toBeVisible();
    expect(ultimo(estado, /POST \/v1\/condominio\/despesas$/)).toMatchObject({ descricao: "Troca da bomba do poço", valor: 480000, fornecedor: "HidroPress",
      prestadorId: null, modo: "PESSOA", prazo: "2026-10-23" });

    await page.getByRole("group", { name: "Quais despesas" }).getByRole("button", { name: /Aguardando/ }).click();
    await page.getByRole("link", { name: "Troca da bomba do poço" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Troca da bomba do poço" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir Orçamento HidroPress.pdf" })).toBeVisible();
    await page.getByRole("button", { name: "Aprovar ou recusar" }).click();
    const responder = page.getByRole("dialog", { name: "Aprovar a despesa" });
    await responder.getByLabel("Justificativa").fill("A bomba atual queimou.");
    await responder.getByRole("button", { name: "Aprovar", exact: true }).click();
    await expect(recado(page, "Despesa aprovada.")).toBeVisible();

    // Paga fora do sistema, com o comprovante (quadro 420).
    await expect(page.getByRole("heading", { name: "Depois de aprovada" })).toBeVisible();
    // Aprovada: documento novo não entra mais; o comprovante, sim, e só ele vale para o Paga fora.
    await expect(page.getByRole("button", { name: /^Anexar( outro)?$/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Anexar o comprovante" }).click();
    const anexar = page.getByRole("dialog", { name: "Anexar o comprovante" });
    await anexar.locator('input[type="file"]').first().setInputFiles({ ...PDF, name: "Comprovante do Pix.pdf" });
    await anexar.getByRole("button", { name: "Enviar 1 arquivo" }).click();
    await expect(recado(page, "1 anexo liberado.")).toBeVisible();
    await page.getByLabel("Pago em").fill("2026-10-15");
    const comprovante = page.getByRole("combobox", { name: /Comprovante/ });
    await expect(comprovante.locator("option")).toHaveText(["Sem comprovante", "Comprovante do Pix.pdf"]);
    await comprovante.selectOption({ label: "Comprovante do Pix.pdf" });
    await conferir(page);
    await page.getByRole("button", { name: "Marcar Paga fora do sistema" }).click();
    await expect(recado(page, "Marcada como paga fora do sistema em 15/10.")).toBeVisible();
    expect(ultimo(estado, /\/pagar$/)).toMatchObject({ pagaEm: "2026-10-15", comprovanteId: expect.any(String) });
    await expect(page.getByText("Paga fora do sistema em 15/10, marcada por Ana Souza.")).toBeVisible();
    await expect(page.getByText("Comprovante: Comprovante do Pix.pdf")).toBeVisible();
    await expect(page.getByText("Ana Souza: Paga fora do sistema em 15/10/2026")).toBeVisible();

    await page.getByRole("button", { name: "Desfazer Paga fora" }).click();
    await expect(recado(page, "Registro do pagamento desfeito. A despesa continua aprovada.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar Paga fora do sistema" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Publicar como comunicado" })).toHaveAttribute("href", /\/comunicados\/escrever\?titulo=Despesa%20aprovada%3A%20Troca%20da%20bomba/);
  });

  test("Regras: Configurações › Decisões e conselho salva o quórum, o empate, a vencida e a alçada", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comAprovacoes: true });
    await page.goto(`${PLATAFORMA}/configuracoes`);
    await expect(page.getByRole("link", { name: /Decisões e conselho/ })).toBeVisible();
    await page.goto(`${PLATAFORMA}/configuracoes/decisoes`);
    await expect(page.getByRole("heading", { level: 1, name: "Decisões e conselho" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Maioria dos titulares/ })).toBeChecked();
    await expect(page.getByText("Com 4 titulares, 3 votos aprovam")).toBeVisible();
    await expect(page.getByLabel("A partir de")).toHaveValue("3.000,00");
    await conferir(page);

    await page.getByRole("radio", { name: /Um número mínimo/ }).check();
    await page.getByLabel("Quantos votos aprovam").fill("2");
    await expect(page.getByText("Com 4 titulares, 2 votos aprovam")).toBeVisible();
    await page.getByRole("radio", { name: /Fica como devolvida/ }).check();
    await page.getByRole("radio", { name: /Avisar também o subsíndico/ }).check();
    await page.getByLabel("A partir de").fill("5.000,00");
    await conferir(page);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Regras das decisões salvas.", { exact: false })).toBeVisible();
    expect(ultimo(estado, /PUT \/v1\/condominio\/regras-decisoes$/)).toEqual({ versao: 1, quorum: "MINIMO", minimo: 2, empate: "DEVOLVIDA", vencidaAvisa: "SUBSINDICO", alcada: 500000 });

    await page.reload();
    await expect(page.getByRole("radio", { name: /Um número mínimo/ })).toBeChecked();
    await page.getByRole("checkbox", { name: "Sem alçada: não avisar" }).check();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Regras das decisões salvas.", { exact: false })).toBeVisible();
    expect(ultimo(estado, /PUT \/v1\/condominio\/regras-decisoes$/)).toMatchObject({ versao: 2, alcada: null });
  });
});
