// R8 · Orçamentos e compras (OC-01 a OC-07 e OC-10; quadros 470 a 486): a lista, o Novo orçamento
// com os convites e a janela Mandar convite, a ficha com os links de cada fornecedor, comparar e
// escolher com o motivo, o acompanhamento (aceite, compra, ordem de serviço, entrega e o resumo
// para os moradores), a planilha para imprimir, as regras em Configurações e o link do fornecedor
// em cada estado. Cada tela passa no axe (WCAG 2.2 AA) no celular e no computador e não usa emoji.
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { instalarApiPlataformaFalsa } from "./api-falsa-plataforma";
import { maisAcoes } from "./registro";

const PLATAFORMA = "http://localhost:3000";
const PDF = { name: "Proposta Pinturas Lima.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF") };
const FOTO = { name: "Parede do hall.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 0x43, 0, 1, 1, 1, 0xff, 0xd9]) };
const celular = () => test.info().project.name === "celular";

async function conferir(page: Page) {
  // Depois de uma navegação no cliente, o Next troca o título um instante depois: espera ele chegar.
  await expect(page).toHaveTitle(/\S/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations).toEqual([]);
  const texto = await page.locator("body").innerText();
  expect(texto.match(/\p{Extended_Pictographic}/gu) ?? []).toEqual([]);
}

const recado = (page: Page, texto: string) => page.getByRole("status").filter({ hasText: texto });
type Estado = Awaited<ReturnType<typeof instalarApiPlataformaFalsa>>;
const ultimo = (estado: Estado, caminho: RegExp) => [...estado.orcamentos.enviados].reverse().find((e) => caminho.test(e.caminho))?.corpo;
const bomba = (estado: Estado) => estado.orcamentos.orcamentos.find((o) => o.titulo === "Troca da bomba de recalque 2")!;
const extintores = (estado: Estado) => estado.orcamentos.orcamentos.find((o) => o.titulo === "Recarga dos extintores")!;
const pintura = (estado: Estado) => estado.orcamentos.orcamentos.find((o) => o.titulo === "Pintura do hall da Torre A")!;

test.describe("Plataforma · orçamentos e compras (R8)", () => {
  test("OC-01: a lista mostra as abas e as contagens, cada orçamento com a origem, as propostas e a situação; o menu e o Início pedem atenção", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comOrcamentos: true, comAprovacoes: true });
    await page.goto(`${PLATAFORMA}/orcamentos`);
    await expect(page.getByRole("heading", { level: 1, name: "Orçamentos" })).toBeVisible();
    await expect(page.getByText("A TRÍADE não escolhe nem compra pelo condomínio.")).toBeVisible();
    const resumo = page.getByRole("list", { name: "Resumo dos orçamentos" });
    await expect(resumo).toContainText("Pedindo propostas · 1");
    await expect(resumo).toContainText("Para comparar · 1");
    await expect(resumo).toContainText("Para decidir · 0");
    await expect(resumo).toContainText("Comprando ou em execução · 1");
    const lista = page.getByRole("region", { name: "Orçamentos" });
    const linha = lista.getByRole("link", { name: /Troca da bomba de recalque 2/ });
    await expect(linha).toContainText("Serviço · 4 convidados");
    await expect(linha).toContainText("Manutenção · Bomba de recalque com ruído");
    await expect(linha).toContainText("3 de 4 chegaram · 1 recusou");
    await expect(linha).toContainText("Pronto para comparar");
    await expect(linha).toContainText("1 proposta vencida");
    await expect(linha).toContainText("Prazo era 14/10");
    const hall = lista.getByRole("link", { name: /Pintura do hall da Torre A/ });
    await expect(hall).toContainText("0 de 4 chegaram · 1 recusou");
    await expect(hall).toContainText("Escrito à mão");
    await expect(hall).toContainText("Até 06/11");
    await expect(page.getByText("O orçamento funciona sem o financeiro e sem pagamento", { exact: false })).toBeVisible();
    await conferir(page);

    await page.getByRole("tab", { name: "Decididos" }).click();
    const ext = page.getByRole("region", { name: "Orçamentos" }).getByRole("link", { name: /Recarga dos extintores/ });
    await expect(ext).toContainText("Escolhida: Fogo Zero · R$ 980");
    await expect(ext).toContainText("Preventiva · Extintores");
    await expect(ext).toContainText("Decidido em 10/10");
    await expect(ext).toContainText("Esperando o aceite do fornecedor");
    await expect(ext).toContainText("Sem aceite");
    await page.getByRole("tab", { name: "Encerrados" }).click();
    const caixa = page.getByRole("region", { name: "Orçamentos" }).getByRole("link", { name: /Limpeza da caixa d’água/ });
    await expect(caixa).toContainText("Escolhida: Hidro Serviços · R$ 1.800");
    await expect(caixa).toContainText("Entregue");
    await expect(caixa).toContainText("Concluído em 12/10");
    await page.getByRole("tab", { name: "Cancelados" }).click();
    await expect(page.getByText("Nenhum orçamento aqui")).toBeVisible();
    await conferir(page);

    // O Início e o menu: 2 pedem atenção (o prazo que fechou com uma proposta vencida e o aceite atrasado).
    await page.goto(`${PLATAFORMA}/`);
    await expect(page.getByText("2 orçamentos pedem atenção")).toBeVisible();
    if (!celular()) await expect(page.getByRole("navigation").getByRole("link", { name: /Orçamentos.*2 pedindo atenção/ })).toBeVisible();
  });

  test("OC-01: a lista vazia convida a pedir o primeiro orçamento ou partir de uma manutenção", async ({ page }) => {
    await instalarApiPlataformaFalsa(page, { comOrcamentos: true });
    await page.route("**/api/v1/condominio/orcamentos?filtro=EM_ANDAMENTO", (route) => route.fulfill({ json: { hoje: "2026-10-16", pode: { criar: true }, contagens: { pedindo: 0, comparar: 0, decidir: 0, comprando: 0 }, orcamentos: [] } }));
    await page.goto(`${PLATAFORMA}/orcamentos`);
    await expect(page.getByText("Nenhum orçamento ainda")).toBeVisible();
    await expect(page.getByText("Peça propostas a mais de um fornecedor e compare o que cada uma inclui. O motivo da escolha fica guardado e pode ir para os moradores.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Pedir a partir de uma manutenção" })).toHaveAttribute("href", "/manutencao");
    await expect(page.getByRole("link", { name: "Novo orçamento" }).first()).toBeVisible();
    await conferir(page);
  });

  test("OC-02: Novo orçamento nasce da manutenção, convida do cadastro e de fora, sobe a foto, e a janela Mandar convite abre o WhatsApp com a mensagem ou copia o link", async ({ page }) => {
    test.slow();
    const estado = await instalarApiPlataformaFalsa(page, { comOrcamentos: true });
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
    const manutencao = estado.manutencao.manutencoes[0]!;
    await page.goto(`${PLATAFORMA}/orcamentos/novo?manutencao=${manutencao.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Novo orçamento" })).toBeVisible();
    await expect(page.getByText("Três partes: o que precisa, como o fornecedor responde e quem convidar.")).toBeVisible();
    await expect(page.getByLabel("O que é")).toHaveValue("Bomba de recalque com ruído");
    await expect(page.getByLabel("Nasceu de")).toHaveValue(`M:${manutencao.id}`);
    await expect(page.getByLabel("Local")).toHaveValue("Casa de bombas · Bomba 2");
    await expect(page.getByText("Só o que estiver aqui vai para o link. As fotos da manutenção não vão sozinhas.")).toBeVisible();
    if (celular()) {
      await expect(page.getByRole("progressbar", { name: "Passos do orçamento" })).toHaveAttribute("aria-valuenow", "1");
      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(page.getByText("Diga o que precisa estar na proposta (3 a 2.000 caracteres).")).toBeVisible();
    }
    await page.getByLabel("O que é").fill("Troca da bomba de recalque 2");
    await page.getByLabel("O que precisa estar na proposta").fill("Bomba centrífuga equivalente à atual (3 cv, trifásica), instalação, retirada da bomba velha e teste com a caixa cheia. Informar marca e modelo.");
    await page.getByLabel("Valor estimado").fill("6.500,00");
    await page.locator('input[type="file"]').first().setInputFiles(FOTO);
    await conferir(page);
    if (celular()) {
      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(page.getByRole("progressbar", { name: "Passos do orçamento" })).toHaveAttribute("aria-valuenow", "2");
    }
    await expect(page.getByRole("radio", { name: /^Serviço/ })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Lista de itens/ })).toBeDisabled();
    if (celular()) {
      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(page.getByText("Passo 3 de 3")).toBeVisible();
      await expect(page.getByText("Quem convidar", { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("checkbox", { name: /HidroPress Bombas/ })).toBeVisible();
    await expect(page.getByText("Prestador · Bombas e hidráulica · fez 4 serviços aqui · WhatsApp")).toBeVisible();
    await page.getByRole("checkbox", { name: /HidroPress Bombas/ }).check();
    await page.getByRole("checkbox", { name: /Bombas Brasília/ }).check();
    await page.getByRole("button", { name: "Convidar quem não está no cadastro" }).click();
    await expect(page.getByText("Nome e WhatsApp ou e-mail. Vira prestador só se você escolher a proposta dele.")).toBeVisible();
    await page.getByLabel("Nome", { exact: true }).fill("Águia Hidráulica");
    await page.getByLabel("WhatsApp", { exact: true }).fill("(61) 9 8123-4567");
    await expect(page.getByText("A regra do condomínio pede pelo menos 3 propostas acima de R$ 3.000. Com 3 convidados, está dentro.")).toBeVisible();
    await expect(page.getByText("Depois disso o link fecha sozinho. Você pode estender.")).toBeVisible();
    await expect(page.getByText("Cada convidado recebe um link só dele; ninguém vê o preço do outro.")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: celular() ? "Mandar convites" : "Criar e mandar os convites" }).click();

    const janela = page.getByRole("dialog", { name: "Mandar convite" });
    await expect(janela).toBeVisible();
    const corpo = ultimo(estado, /POST \/v1\/condominio\/orcamentos$/)!;
    expect(corpo).toMatchObject({ titulo: "Troca da bomba de recalque 2", manutencaoId: manutencao.id, local: "Casa de bombas · Bomba 2", valorEstimado: 650000, tipo: "SERVICO", validadeMinimaDias: 15, mandar: true });
    expect(corpo.convites).toEqual([{ prestadorId: estado.orcamentos.prestadores[0]!.id, canal: "WHATSAPP" }, { prestadorId: estado.orcamentos.prestadores[1]!.id, canal: "EMAIL" }, { nome: "Águia Hidráulica", canal: "WHATSAPP", celular: "61981234567", email: null }]);
    const novo = estado.orcamentos.orcamentos[0]!;
    expect(novo.arquivos.map((a) => [a.nome, a.situacao])).toEqual([["Parede do hall.jpg", "LIBERADO"]]);
    await expect(janela).toContainText("Um link só para este fornecedor, sem conta");
    await expect(janela).toContainText("Convite 1 de 2");
    await expect(janela.getByRole("definition").filter({ hasText: "HidroPress Bombas" })).toBeVisible();
    const mensagem = janela.getByLabel("Mensagem pronta");
    await expect(mensagem).toHaveValue(/Olá, aqui é Ana Souza, Síndica do Residencial Ipê\. Queremos um orçamento para troca da bomba de recalque 2\./);
    expect(novo.convites[0]!.codigo).toHaveLength(43);
    await expect(mensagem).toHaveValue(new RegExp(`${PLATAFORMA}/o/${novo.convites[0]!.codigo}`));
    await expect(janela.getByText("Sai do seu WhatsApp, com o seu número. Você pode mudar o texto.")).toBeVisible();
    await expect(janela.getByText("O mesmo prazo das propostas")).toBeVisible();
    await expect(janela.getByText("A versão anterior fica guardada")).toBeVisible();
    await expect(janela.getByText("Nunca vê quem mais foi convidado nem os preços dos outros.", { exact: false })).toBeVisible();
    const abrir = janela.getByRole("link", { name: "Abrir o WhatsApp com a mensagem" });
    await expect(abrir).toHaveAttribute("target", "_blank");
    expect(await abrir.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=Ol%C3%A1%2C%20aqui%20%C3%A9%20Ana%20Souza/);
    await conferir(page);
    await janela.getByRole("group", { name: "Mandar por" }).getByRole("button", { name: "Copiar o link" }).click();
    await expect(janela.getByLabel("Link de HidroPress Bombas")).toHaveText(`${PLATAFORMA}/o/${novo.convites[0]!.codigo}`);
    await janela.getByRole("button", { name: "Copiar o link" }).last().click();
    await expect(janela.getByRole("button", { name: /Copiado/ })).toBeVisible();
    await janela.getByRole("button", { name: "Próximo convidado" }).click();
    await expect(janela).toContainText("Convite 2 de 2");
    await expect(janela.getByRole("definition").filter({ hasText: "Águia Hidráulica" })).toBeVisible();
    expect(await janela.getByRole("link", { name: "Abrir o WhatsApp com a mensagem" }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=Ol%C3%A1/);
    await expect(janela.getByText("Pelo e-mail: Bombas Brasília. Esses já foram.")).toBeVisible();
    await janela.getByRole("button", { name: "Pronto" }).click();

    await expect(page).toHaveURL(new RegExp(`/orcamentos/${novo.id}`));
    await expect(recado(page, "Orçamento criado e 3 convites mandados. 1 anexo liberado.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Troca da bomba de recalque 2" })).toBeVisible();
    await expect(page.getByText("3 convidados · cada um com um link só dele")).toBeVisible();
    await expect(page.getByRole("list", { name: "Convidados" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByRole("list", { name: "Arquivos para o fornecedor" })).toContainText("Parede do hall.jpg");
    await conferir(page);
  });

  test("OC-02: Guardar sem mandar cria o rascunho; os convidados ficam guardados e Mandar os convites leva a Pedindo propostas", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comOrcamentos: true });
    await page.goto(`${PLATAFORMA}/orcamentos/novo`);
    await page.getByLabel("O que é").fill("Pintura da fachada");
    await page.getByLabel("O que precisa estar na proposta").fill("Pintura completa da fachada com tinta acrílica.");
    if (celular()) {
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.getByRole("button", { name: "Continuar" }).click();
    }
    await page.getByRole("button", { name: "Guardar sem mandar" }).click();
    await expect(recado(page, "Orçamento guardado sem mandar os convites.")).toBeVisible();
    expect(ultimo(estado, /POST \/v1\/condominio\/orcamentos$/)).toMatchObject({ titulo: "Pintura da fachada", mandar: false, convites: [] });
    await expect(page.getByText("Rascunho").first()).toBeVisible();
    await expect(page.getByText("Ninguém convidado ainda. O orçamento só começa quando os convites saem.")).toBeVisible();
    await conferir(page);

    // No rascunho, Convidar mais só guarda; Mandar os convites (POST /mandar) leva a Pedindo propostas.
    const novo = estado.orcamentos.orcamentos[0]!;
    await page.getByRole("button", { name: "Convidar mais" }).first().click();
    const mais = page.getByRole("dialog", { name: "Convidar mais" });
    await mais.getByRole("checkbox", { name: /HidroPress Bombas/ }).check();
    await mais.getByRole("button", { name: "Mandar os convites" }).click();
    await expect(recado(page, "1 convidado guardado. O convite sai quando você mandar.")).toBeVisible();
    expect(novo.convites[0]!.mandadoEm).toBeNull();
    await expect(page.getByText("Guardado sem mandar. Os convites saem quando você mandar; cada convidado recebe um link só dele.")).toBeVisible();
    await conferir(page);
    await page.getByRole("button", { name: "Mandar os convites" }).click();
    const janela = page.getByRole("dialog", { name: "Mandar convite" });
    await expect(janela.getByRole("definition").filter({ hasText: "HidroPress Bombas" })).toBeVisible();
    expect(ultimo(estado, /\/mandar$/)).toEqual({ versao: 2 });
    await expect(janela.getByLabel("Mensagem pronta")).toHaveValue(new RegExp(`${PLATAFORMA}/o/${novo.convites[0]!.codigo}`));
    await janela.getByRole("button", { name: "Pronto" }).click();
    await expect(recado(page, "1 convite mandado.")).toBeVisible();
    await expect(page.getByText("Pedindo propostas").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Mandar os convites" })).toHaveCount(0);
  });

  test("OC-02/OC-04: a ficha mostra os convites e os links, o que chegou, a regra e os dados; Ver proposta, Pedir confirmação do preço e Estender o prazo", async ({ page }) => {
    test.slow();
    const estado = await instalarApiPlataformaFalsa(page, { comOrcamentos: true, comAprovacoes: true });
    const o = bomba(estado);
    await page.goto(`${PLATAFORMA}/orcamentos/${o.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Troca da bomba de recalque 2" })).toBeVisible();
    await expect(page.getByText("Serviço · Casa de bombas · Bomba 2 · criado por Ana em 08/10")).toBeVisible();
    await expect(page.getByText("4 convidados · cada um com um link só dele")).toBeVisible();
    const convidados = page.getByRole("list", { name: "Convidados" });
    const hidro = convidados.getByRole("listitem").filter({ hasText: "HidroPress Bombas" });
    await expect(hidro).toContainText("Prestador · WhatsApp · (61) ••••-0001 · abriu 3 vezes");
    await expect(hidro).toContainText("Mandou a proposta · versão 1");
    await expect(hidro).toContainText("R$ 6.480,00 · frete incluso · vale até 10/11");
    const brasilia = convidados.getByRole("listitem").filter({ hasText: "Bombas Brasília" });
    await expect(brasilia).toContainText("Mandou a proposta · versão 2");
    await expect(brasilia).toContainText("Validade venceu em 15/10");
    await expect(brasilia).toContainText("Para escolher esta, o fornecedor precisa confirmar o preço pelo link. Se ele mandar outro valor, entra como versão 3.");
    const aguia = convidados.getByRole("listitem").filter({ hasText: "Águia Hidráulica" });
    await expect(aguia).toContainText("Só pelo link · WhatsApp · (61) ••••-4567 · abriu 2 vezes");
    const central = convidados.getByRole("listitem").filter({ hasText: "Central das Bombas" });
    await expect(central).toContainText("Recusou: Não atendemos Águas Claras");
    await expect(central).toContainText("Ele não recebe lembretes. A recusa conta como resposta, mas não como proposta para o mínimo.");
    await expect(central.getByRole("button", { name: /Reenviar link/ })).toHaveCount(0);
    const resumo = page.getByRole("region", { name: "Propostas recebidas" });
    await expect(resumo).toContainText("3 propostas para comparar");
    await expect(resumo).toContainText("Mínimo da regra: 3 · todas chegaram antes de 14/10, 15h");
    await expect(resumo.getByRole("link", { name: "Comparar propostas" })).toHaveAttribute("href", `/orcamentos/${o.id}/comparar`);
    const dados = page.getByRole("region", { name: "Dados" });
    await expect(dados).toContainText("Ana Souza");
    await expect(dados).toContainText("Manutenção · Bomba de recalque com ruído");
    await expect(dados).toContainText("14/10/2026, 15h · fechado");
    await expect(dados).toContainText("Acima de R$ 3.000: 3 propostas e o conselho aprova");
    await expect(page.getByRole("region", { name: "O que foi pedido" })).toContainText("Bomba centrífuga equivalente à atual (3 cv, trifásica)");
    await expect(page.getByRole("list", { name: "Arquivos para o fornecedor" })).toContainText("Placa da bomba.jpg");
    const andamento = page.getByRole("region", { name: "Andamento" });
    await expect(andamento).toContainText("Prazo fechou com 3 propostas");
    await expect(andamento).toContainText("Bombas Brasília mandou a versão 2 (de R$ 6.420,00 para R$ 6.130,00). A versão 1 fica guardada.");
    await conferir(page);

    // Ver proposta: o que o fornecedor mandou, como ele escreveu.
    await hidro.getByRole("button", { name: "Ver proposta de HidroPress Bombas" }).click();
    const proposta = page.getByRole("dialog", { name: "Proposta de HidroPress Bombas" });
    await expect(proposta).toContainText("KSB Hydrobloc C 3 cv");
    await expect(proposta).toContainText("2 vezes (entrada e entrega)");
    await expect(proposta).toContainText("Retirada da velha");
    await expect(proposta).toContainText("Quadro elétrico");
    await conferir(page);
    await proposta.getByRole("button", { name: "Fechar" }).click();

    // Pedir confirmação do preço (quadro 485: vencida).
    await brasilia.getByRole("button", { name: "Pedir confirmação do preço a Bombas Brasília" }).click();
    await expect(recado(page, "Pedido de confirmação do preço mandado a Bombas Brasília, pelo link. Se ele mandar outro valor, entra como versão 3.")).toBeVisible();
    expect(ultimo(estado, /pedir-confirmacao$/)).toEqual({});
    await expect(brasilia).toContainText("Pedido em 16/10 · esperando");
    await expect(brasilia.getByRole("button", { name: /Pedir confirmação/ })).toHaveCount(0);

    // Estender o prazo (Mais ações): os links voltam a aceitar propostas.
    await maisAcoes(page, "Estender o prazo");
    const estender = page.getByRole("dialog", { name: "Estender o prazo" });
    await expect(estender).toContainText("Hoje o prazo é 14/10/2026, 15h.");
    await estender.getByLabel("Propostas até").fill("2026-12-20T18:00");
    await conferir(page);
    await estender.getByRole("button", { name: "Estender" }).click();
    await expect(recado(page, "Prazo estendido até 20/12/2026, 18h.")).toBeVisible();
    expect(ultimo(estado, /\/estender$/)).toEqual({ versao: 1, prazoPropostas: "2026-12-20T18:00:00-03:00" });
    await expect(page.getByRole("region", { name: "Dados" })).toContainText("20/12/2026, 18h");
    await expect(page.getByRole("region", { name: "Propostas recebidas" })).toContainText("o prazo vai até 20/12, 18h; dá para comparar o que já chegou");
  });

  test("OC-02: Reenviar troca o link e o antigo para; Revogar para na hora e quem foi revogado volta por Convidar mais; Cancelar guarda tudo em Cancelados", async ({ page }) => {
    test.slow();
    const estado = await instalarApiPlataformaFalsa(page, { comOrcamentos: true });
    const o = pintura(estado);
    const lima = o.convites[0]!;
    const codigoAntigo = lima.codigo;
    await page.goto(`${PLATAFORMA}/orcamentos/${o.id}`);
    const linha = page.getByRole("list", { name: "Convidados" }).getByRole("listitem").filter({ hasText: "Pinturas Lima" });
    await linha.getByRole("button", { name: "Reenviar link para Pinturas Lima" }).click();
    await expect(recado(page, "Link novo de Pinturas Lima pronto. O anterior parou na hora.")).toBeVisible();
    const janela = page.getByRole("dialog", { name: "Mandar convite" });
    await expect(janela.getByRole("definition").filter({ hasText: "Pinturas Lima" })).toBeVisible();
    expect(lima.codigo).not.toBe(codigoAntigo);
    expect(lima.codigo).toHaveLength(43);
    await expect(janela.getByLabel("Mensagem pronta")).toHaveValue(new RegExp(`/o/${lima.codigo}`));
    await janela.getByRole("button", { name: "Pronto" }).click();
    await page.goto(`${PLATAFORMA}/o/${codigoAntigo}`);
    await expect(page.getByRole("heading", { name: "Este link não vale mais" })).toBeVisible();
    await expect(page.getByText("Um link novo foi mandado e este parou. Ele não abre mais. Se recebeu um link novo, use o novo.")).toBeVisible();
    await conferir(page);
    await page.goto(`${PLATAFORMA}/orcamentos/${o.id}`);

    // Revogar um link (quadro 485): para na hora; para chamar de novo, um convite novo.
    await linha.getByRole("button", { name: "Revogar link de Pinturas Lima" }).click();
    const revogar = page.getByRole("dialog", { name: "Revogar um link" });
    await revogar.getByRole("button", { name: "Revogar o link" }).click();
    await expect(revogar.getByText("Escreva o motivo (3 a 500 caracteres).")).toBeVisible();
    await revogar.getByLabel("Por que revogar").fill("Mandou o link para outra pessoa");
    await conferir(page);
    await revogar.getByRole("button", { name: "Revogar o link" }).click();
    await expect(recado(page, "Link de Pinturas Lima revogado. Ele parou na hora.")).toBeVisible();
    expect(ultimo(estado, /\/revogar$/)).toEqual({ motivo: "Mandou o link para outra pessoa" });
    await expect(linha).toContainText("Link revogado");
    await expect(linha).toContainText("Nenhuma proposta tinha chegado. Para chamar de novo, use Convidar mais: sai um convite novo.");
    await expect(linha.getByRole("button", { name: /Reenviar link/ })).toHaveCount(0);
    await expect(page.getByText("3 convidados · cada um com um link só dele")).toBeVisible();
    await conferir(page);

    // Pelo link: o revogado diz que foi cancelado pelo condomínio (o antigo também, pois o convite foi revogado).
    await page.goto(`${PLATAFORMA}/o/${lima.codigo}`);
    await expect(page.getByRole("heading", { name: "Este link foi cancelado pelo condomínio" })).toBeVisible();
    await expect(page.getByText("O condomínio cancelou este link. Ele não abre mais. Se recebeu um link novo, use o novo.")).toBeVisible();
    await conferir(page);

    // Convidar mais chama quem ainda não foi.
    await page.goto(`${PLATAFORMA}/orcamentos/${o.id}`);
    await page.getByRole("button", { name: "Convidar mais" }).click();
    const mais = page.getByRole("dialog", { name: "Convidar mais" });
    await mais.getByRole("button", { name: "Mandar os convites" }).click();
    await expect(mais.getByText("Marque pelo menos um convidado.")).toBeVisible();
    await mais.getByRole("checkbox", { name: /Elétrica Central/ }).check();
    await conferir(page);
    await mais.getByRole("button", { name: "Mandar os convites" }).click();
    await expect(recado(page, "1 convite mandado.")).toBeVisible();
    expect(ultimo(estado, /\/convites$/)).toEqual({ convites: [{ prestadorId: estado.orcamentos.prestadores[2]!.id, canal: "WHATSAPP" }] });
    await page.getByRole("dialog", { name: "Mandar convite" }).getByRole("button", { name: "Pronto" }).click();
    await expect(page.getByText("4 convidados · cada um com um link só dele")).toBeVisible();

    // Cancelar o orçamento: nada é apagado.
    await maisAcoes(page, "Cancelar o orçamento");
    const cancelar = page.getByRole("dialog", { name: "Cancelar o orçamento" });
    await cancelar.getByLabel("Por que cancelar").fill("A pintura ficou para o ano que vem");
    await cancelar.getByRole("button", { name: "Cancelar o orçamento" }).click();
    await expect(recado(page, "Orçamento cancelado. Os fornecedores são avisados no link.")).toBeVisible();
    expect(ultimo(estado, /\/cancelar$/)).toEqual({ versao: o.versao - 1, motivo: "A pintura ficou para o ano que vem" });
    await expect(page.getByText("Cancelado em 16/10/2026")).toBeVisible();
    await expect(page.getByText("Nada é apagado: as propostas, as versões e o histórico ficam em Cancelados, e os fornecedores são avisados no link.")).toBeVisible();
    // Cancelado e sem proposta, não sobra ação: nem estender, nem cancelar de novo.
    await expect(page.getByRole("button", { name: "Mais ações" })).toHaveCount(0);
    await conferir(page);
    await page.goto(`${PLATAFORMA}/orcamentos?filtro=CANCELADOS`);
    await expect(page.getByRole("region", { name: "Orçamentos" }).getByRole("link", { name: /Pintura do hall da Torre A/ })).toContainText("Cancelado em 16/10");
    await page.goto(`${PLATAFORMA}/o/${o.convites[1]!.codigo}`);
    await expect(page.getByRole("heading", { name: "O condomínio cancelou este pedido de orçamento" })).toBeVisible();
    await expect(page.getByText("Obrigado por participar. O condomínio não vai seguir com este pedido; se precisar de novo, manda outro convite.")).toBeVisible();
    await conferir(page);
  });

  test("OC-04: Comparar põe as propostas lado a lado com as diferenças marcadas, as versões e a nota do menor total; Escolher pede o motivo e manda ao conselho", async ({ page }) => {
    test.slow();
    const estado = await instalarApiPlataformaFalsa(page, { comOrcamentos: true, comAprovacoes: true });
    const o = bomba(estado);
    await page.goto(`${PLATAFORMA}/orcamentos/${o.id}/comparar`);
    await expect(page.getByRole("heading", { level: 1, name: "Comparar propostas" })).toBeVisible();
    await expect(page.getByText("O que cada uma inclui, não só o preço. Diferenças em relação ao que foi pedido aparecem marcadas.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Baixar planilha em PDF" })).toHaveAttribute("href", `/orcamentos/${o.id}/planilha`);
    const nota = page.getByRole("status").filter({ hasText: "Bombas Brasília tem o menor total" });
    await expect(nota).toContainText("Bombas Brasília tem o menor total, mas não inclui retirada da velha, que foi pedido. HidroPress Bombas custa R$ 350,00 a mais e inclui tudo. O sistema não escolhe por você: só mostra a diferença.");
    if (celular()) {
      const cartoes = page.getByRole("list", { name: "Propostas" }).getByRole("listitem");
      await expect(cartoes).toHaveCount(3);
      const b = cartoes.filter({ hasText: "Bombas Brasília" });
      await expect(b).toContainText("Prestador · versão 2 de 2");
      await expect(b).toContainText("Menor total");
      await expect(b).toContainText("Validade venceu");
      await expect(b).toContainText("Falta algo pedido");
      await expect(b).toContainText("6 meses");
      await page.getByRole("group", { name: "Como comparar" }).getByRole("button", { name: "Só as diferenças" }).click();
      await expect(page.getByRole("group", { name: "Como comparar" }).getByRole("button", { name: "Só as diferenças" })).toHaveAttribute("aria-pressed", "true");
      await conferir(page);
      await b.getByRole("button", { name: "Ver tudo" }).click();
      await expect(b).toContainText("Retirada da velha: R$ 250,00 à parte");
      await expect(b.getByRole("button", { name: "Confirme o preço antes: Bombas Brasília" })).toBeDisabled();
      await b.getByRole("button", { name: "Ver versão 1" }).click();
      await expect(b).toContainText("Versão 1 · R$ 6.420,00 · vale até 05/11 · guardada");
      const c = cartoes.filter({ hasText: "Águia Hidráulica" });
      await c.getByRole("button", { name: "Ver tudo e escolher" }).click();
      await c.getByRole("button", { name: "Escolher esta: Águia Hidráulica" }).click();
    } else {
      const tabela = page.getByRole("table", { name: "Propostas lado a lado" });
      const colunas = tabela.getByRole("columnheader");
      await expect(colunas.nth(1)).toContainText("A · HidroPress Bombas");
      await expect(colunas.nth(1)).toContainText("Prestador · versão 1");
      await expect(colunas.nth(2)).toContainText("Prestador · versão 2 de 2");
      await expect(colunas.nth(2)).toContainText("Menor total");
      await expect(colunas.nth(2)).toContainText("Validade venceu");
      await expect(colunas.nth(2)).toContainText("Falta algo pedido");
      await expect(colunas.nth(3)).toContainText("Só pelo link · versão 1");
      const linha = (nome: string) => tabela.getByRole("row").filter({ has: page.getByRole("rowheader", { name: nome, exact: true }) });
      await expect(linha("Total")).toContainText("R$ 6.130,00");
      await expect(linha("Total")).toContainText("R$ 5.950,00 + frete R$ 180,00");
      await expect(linha("Garantia")).toContainText("24 meses");
      await expect(linha("Não inclui")).toContainText("Retirada da velha: R$ 250,00 à parte");
      await expect(linha("Preço vale até")).toContainText("15/10 · venceu");
      await expect(linha("Arquivos")).toContainText("Proposta 0412 Águia Hidráulica.pdf");
      await linha("Versões").getByRole("button", { name: "Ver versão 1" }).click();
      await expect(linha("Versões")).toContainText("Versão 1 · R$ 6.420,00 · vale até 05/11 · guardada");
      await expect(linha("Decidir").getByRole("button", { name: "Confirme o preço antes: Bombas Brasília" })).toBeDisabled();
      await page.getByRole("button", { name: "Mostrar só o que é diferente" }).click();
      await expect(page.getByRole("button", { name: "Mostrar só o que é diferente" })).toHaveAttribute("aria-pressed", "true");
      await conferir(page);
      await linha("Decidir").getByRole("button", { name: "Escolher esta: Águia Hidráulica" }).click();
    }

    // Escolher a proposta (quadro 481): não é a mais barata, então o motivo é obrigatório; passa da alçada, então o conselho.
    const escolher = page.getByRole("dialog", { name: "Escolher a proposta" });
    await expect(escolher).toContainText("Troca da bomba de recalque 2 · 3 propostas comparadas");
    await expect(escolher).toContainText("C · Águia Hidráulica");
    await expect(escolher).toContainText("R$ 7.200,00");
    await expect(escolher.getByRole("status")).toContainText("Não é a de menor total: Bombas Brasília custa R$ 1.070 a menos (R$ 6.130). Por isso o motivo é obrigatório e vai junto para quem aprova e para o resumo dos moradores.");
    await expect(escolher.getByText("Obrigatório quando não é a mais barata (mínimo 20 letras)")).toBeVisible();
    await expect(escolher.getByRole("radio", { name: /O conselho/ })).toBeChecked();
    await expect(escolher.getByText("Passa da alçada de R$ 3.000. Vira uma despesa para aprovar em Decisões, com as 3 propostas e a planilha")).toBeVisible();
    // A faixa acima de R$ 3.000 pede o conselho: decidir sozinha fica desligado (a alçada sozinha só avisaria).
    await expect(escolher.getByRole("radio", { name: /Ana Souza, síndica/ })).toBeDisabled();
    await expect(escolher.getByText("A regra do condomínio pede o conselho acima de R$ 3.000")).toBeVisible();
    await expect(escolher.getByText("Aprovar não é contratar nem pagar. Depois do sim, o fornecedor confirma pelo link e você registra a compra e a entrega.")).toBeVisible();
    await escolher.getByRole("button", { name: "Mandar para o conselho" }).click();
    await expect(escolher.getByText("Escreva o motivo da escolha, com pelo menos 20 letras.")).toBeVisible();
    await escolher.getByLabel("Por que esta proposta").fill("Inclui a revisão do quadro elétrico e dá 24 meses de garantia.");
    await conferir(page);
    await escolher.getByRole("button", { name: "Mandar para o conselho" }).click();
    await expect(page).toHaveURL(new RegExp(`/orcamentos/${o.id}$`));
    expect(ultimo(estado, /\/escolher$/)).toEqual({ versao: 1, propostaId: o.convites[2]!.propostas[0]!.id, motivo: "Inclui a revisão do quadro elétrico e dá 24 meses de garantia.", quemAprova: "CONSELHO" });
    await expect(recado(page, "Proposta de Águia Hidráulica mandada ao conselho como despesa para aprovar.")).toBeVisible();
    await expect(page.getByText("Esperando o conselho").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Acompanhamento" })).toHaveAttribute("aria-selected", "true");
    const etapas = page.getByRole("region", { name: "Etapas depois da decisão" });
    await expect(etapas).toContainText("Águia Hidráulica · R$ 7.200,00 · escolhida por Ana em 16/10");
    await expect(etapas.getByRole("link", { name: "ver a despesa em Decisões" })).toHaveAttribute("href", /\/decisoes\/despesa\?id=despesa-do-orcamento-/);
    await expect(etapas).toContainText("Por quê: Inclui a revisão do quadro elétrico e dá 24 meses de garantia.");
    expect(estado.aprovacoes.despesas[0]).toMatchObject({ descricao: "Troca da bomba de recalque 2", valor: 720000, modo: "CONSELHO", fornecedor: { nome: "Águia Hidráulica" } });
    await conferir(page);
  });

  test("OC-04: abaixo do mínimo a regra avisa e deixa comparar assim mesmo; com o prazo fechado, convidar mais pede estender; a escolha sem o conselho vale com o motivo", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comOrcamentos: true, comAprovacoes: true });
    const o = bomba(estado);
    o.convites[1]!.estado = "REVOGADO";
    // Nesta faixa quem aprova é o síndico: a alçada só avisa e a escolha pode ser sem o conselho.
    estado.orcamentos.regras.faixas[2]!.quemAprova = "SINDICO";
    await page.goto(`${PLATAFORMA}/orcamentos/${o.id}`);
    const resumo = page.getByRole("region", { name: "Propostas recebidas" });
    await expect(resumo).toContainText("Chegaram 2 propostas; a regra pede 3 acima de R$ 3.000.");
    await expect(resumo.getByRole("button", { name: "Estender o prazo" })).toBeVisible();
    await resumo.getByRole("button", { name: "Convidar mais" }).click();
    const mais = page.getByRole("dialog", { name: "Convidar mais" });
    await expect(mais.getByText("O prazo das propostas fechou. Para convidar mais fornecedores, estenda o prazo antes: o convite novo vale até o prazo novo.")).toBeVisible();
    await conferir(page);
    await mais.getByRole("button", { name: "Estender o prazo" }).click();
    await expect(page.getByRole("dialog", { name: "Estender o prazo" })).toBeVisible();
    await page.getByRole("dialog", { name: "Estender o prazo" }).getByRole("button", { name: "Cancelar" }).click();
    await conferir(page);
    await resumo.getByRole("link", { name: "Comparar assim mesmo" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Comparar propostas" })).toBeVisible();
    const aviso = page.getByRole("status").filter({ hasText: "Ainda não chegou o mínimo da regra" });
    await expect(aviso).toContainText("Chegaram 2 propostas; a regra pede 3 acima de R$ 3.000.");
    await aviso.getByRole("button", { name: "Comparar assim mesmo" }).click();
    await expect(aviso).toHaveCount(0);
    if (celular()) {
      const c = page.getByRole("list", { name: "Propostas" }).getByRole("listitem").filter({ hasText: "HidroPress Bombas" });
      await c.getByRole("button", { name: "Ver tudo e escolher" }).click();
      await c.getByRole("button", { name: "Escolher esta: HidroPress Bombas" }).click();
    } else await page.getByRole("button", { name: "Escolher esta: HidroPress Bombas" }).click();
    const escolher = page.getByRole("dialog", { name: "Escolher a proposta" });
    await expect(escolher.getByRole("status").filter({ hasText: "Chegaram 2 propostas" })).toContainText("Pode decidir assim mesmo, escrevendo o motivo.");
    await escolher.getByLabel("Por que esta proposta").fill("Só dois fornecedores atendem bomba desta marca; a HidroPress inclui tudo o que foi pedido.");
    await escolher.getByRole("radio", { name: /Ana Souza, síndica/ }).check();
    await conferir(page);
    await escolher.getByRole("button", { name: "Escolher esta proposta" }).click();
    await expect(recado(page, "Proposta de HidroPress Bombas escolhida. O fornecedor confirma pelo link; depois você registra a compra.")).toBeVisible();
    expect(ultimo(estado, /\/escolher$/)).toMatchObject({ versao: 1, propostaId: o.convites[0]!.propostas[0]!.id, quemAprova: "PESSOA" });
    await expect(page.getByText("Esperando o aceite do fornecedor").first()).toBeVisible();
  });

  test("OC-06/OC-07: Acompanhamento registra o aceite fora do link, a compra com a ordem de serviço já preenchida e a entrega; o resumo para os moradores vai para o comunicado", async ({ page }) => {
    test.slow();
    const estado = await instalarApiPlataformaFalsa(page, { comOrcamentos: true, comAprovacoes: true });
    const o = extintores(estado);
    await page.goto(`${PLATAFORMA}/orcamentos/${o.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Recarga dos extintores" })).toBeVisible();
    await expect(page.getByText("Decidido · o que falta depois da decisão", { exact: false })).toBeVisible();
    const semAceite = page.getByRole("status").filter({ hasText: "Sem aceite do fornecedor" });
    await expect(semAceite).toContainText("Faz 6 dias que o fornecedor não confirma no link.");
    expect(await semAceite.getByRole("link", { name: "Lembrar pelo WhatsApp" }).getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=Ol%C3%A1%2C%20Fogo%20Zero/);
    await expect(semAceite.getByRole("button", { name: "Escolher outra proposta" })).toBeVisible();
    const etapas = page.getByRole("region", { name: "Etapas depois da decisão" });
    await expect(etapas.getByRole("heading", { name: "Escolhida e aprovada" })).toBeVisible();
    await expect(etapas.getByRole("listitem").filter({ hasText: "Escolhida e aprovada" })).toContainText("Feito");
    await expect(etapas.getByRole("listitem").filter({ hasText: "O fornecedor aceitou" })).toContainText("Agora");
    await expect(etapas.getByRole("listitem").filter({ hasText: "Registrar a compra" })).toContainText("Depois");
    await expect(etapas.getByRole("listitem").filter({ hasText: "Contrato com o prestador (se houver)" })).toContainText("Opcional");
    const moradores = page.getByRole("region", { name: "Resumo para os moradores" });
    await expect(moradores).toContainText("Sai só quando você autoriza, pelo mural e pelo WhatsApp do condomínio.");
    await expect(moradores).toContainText("Comparamos 2 orçamentos e escolhemos o da Fogo Zero (R$ 980).");
    await expect(moradores).toContainText("Não mostra o nome nem o preço de quem não foi escolhido.");
    await expect(moradores).toContainText("Também entra no “Por que fizemos” do relatório do mês.");
    await expect(moradores.getByRole("link", { name: "Revisar e autorizar" })).toHaveAttribute("href", /^\/comunicados\/escrever\?titulo=Recarga%20dos%20extintores&texto=Comparamos%202%20or/);
    await expect(page.getByRole("region", { name: "Decisão" }).getByRole("link", { name: "Abrir a planilha comparativa" })).toHaveAttribute("href", `/orcamentos/${o.id}/planilha`);
    await conferir(page);

    // Aceite fora do link.
    await etapas.getByRole("button", { name: "Registrar aceite fora do link" }).click();
    const aceite = page.getByRole("dialog", { name: "Registrar aceite fora do link" });
    await aceite.getByLabel("Quando aceitou").fill("2026-10-15");
    await aceite.getByRole("button", { name: "Registrar o aceite" }).click();
    await expect(recado(page, "Aceite de Fogo Zero registrado fora do link, em 15/10/2026.")).toBeVisible();
    expect(ultimo(estado, /\/aceite-fora$/)).toEqual({ versao: 1, data: "2026-10-15" });
    await expect(etapas.getByRole("listitem").filter({ hasText: "O fornecedor aceitou" })).toContainText("Fogo Zero aceitou fora do link (registrado por você) em 15/10.");
    await expect(page.getByRole("status").filter({ hasText: "Sem aceite do fornecedor" })).toHaveCount(0);

    // Registrar a compra, com a ordem de serviço na Manutenção já preenchida (quadro 482).
    const compra = etapas.getByRole("form", { name: "Registrar a compra" });
    await expect(compra.getByLabel("Valor fechado")).toHaveValue("980,00");
    await expect(compra.getByText("Igual à proposta")).toBeVisible();
    await compra.getByLabel("Data da compra").fill("2026-10-16");
    await compra.getByRole("checkbox", { name: "Criar a ordem de serviço na Manutenção para Fogo Zero, com o link do prestador" }).check();
    await conferir(page);
    await compra.getByRole("button", { name: "Registrar a compra" }).click();
    await expect(page).toHaveURL(/\/manutencao\?nova=1&titulo=Recarga%20dos%20extintores&local=Todos%20os%20andares&prestador=/);
    expect(ultimo(estado, /\/compra$/)).toEqual({ versao: 2, data: "2026-10-16", valorFechado: 98000 });
    const nova = page.getByRole("dialog", { name: "Nova manutenção" });
    await expect(nova.getByLabel("O que precisa ser feito")).toHaveValue("Recarga dos extintores");
    await expect(nova.getByLabel("Local ou equipamento")).toHaveValue("Todos os andares");
    if (celular()) await nova.getByRole("button", { name: "Continuar" }).click();
    await expect(nova.locator("#mn-executor")).toHaveValue(`P:${estado.orcamentos.prestadores[3]!.id}`);
    await conferir(page);

    // A entrega: em parte, depois inteira; o orçamento encerra.
    await page.goto(`${PLATAFORMA}/orcamentos/${o.id}`);
    await expect(etapas.getByRole("listitem").filter({ hasText: "Registrar a compra" })).toContainText("Comprada em 16/10/2026 · R$ 980,00 · igual à proposta");
    await expect(etapas.getByRole("listitem").filter({ hasText: "Registrar a compra" }).getByRole("link", { name: "Criar ordem de serviço" })).toBeVisible();
    // A nota fiscal entra no orçamento como anexo de parte NOTA_FISCAL.
    await expect(etapas.getByText("Nota fiscal: anexar quando chegar")).toBeVisible();
    await etapas.getByLabel("Anexar a nota fiscal").setInputFiles({ name: "NF 1234.pdf", mimeType: "application/pdf", buffer: PDF.buffer });
    await expect(recado(page, "Nota fiscal anexada.")).toBeVisible();
    expect(ultimo(estado, /\/anexos$/)).toEqual({ parte: "NOTA_FISCAL", nome: "NF 1234.pdf", tipo: "application/pdf", tamanho: PDF.buffer.length });
    await expect(etapas.getByText("Nota fiscal: NF 1234.pdf")).toBeVisible();
    await expect(etapas.getByLabel("Anexar a nota fiscal")).toHaveCount(0);
    const entrega = etapas.getByRole("form", { name: "Registrar a entrega" });
    await entrega.getByLabel("Data da entrega").fill("2026-10-16");
    await entrega.getByRole("checkbox", { name: "Recebido em parte" }).check();
    await entrega.getByLabel("Observação").fill("Faltam 2 extintores do subsolo");
    await entrega.getByRole("button", { name: "Registrar a entrega" }).click();
    await expect(recado(page, "Entrega parcial registrada em 16/10/2026.")).toBeVisible();
    expect(ultimo(estado, /\/entrega$/)).toEqual({ versao: 4, data: "2026-10-16", parcial: true, observacao: "Faltam 2 extintores do subsolo" });
    await expect(etapas.getByRole("listitem").filter({ hasText: "Entrega e execução" })).toContainText("Recebido em parte em 16/10/2026 · Faltam 2 extintores do subsolo");
    await entrega.getByLabel("Data da entrega").fill("2026-10-16");
    await entrega.getByRole("button", { name: "Registrar a entrega" }).click();
    await expect(recado(page, "Entrega registrada em 16/10/2026. O orçamento está encerrado.")).toBeVisible();
    await expect(page.getByText("Entregue").first()).toBeVisible();
    await expect(etapas.getByRole("listitem").filter({ hasText: "Entrega e execução" })).toContainText("Feito");
    await conferir(page);
    await page.getByRole("tab", { name: "Histórico" }).click();
    await expect(page.getByRole("list", { name: "Histórico completo" })).toContainText("Entrega registrada");
    await page.getByRole("tab", { name: "Propostas" }).click();
    await expect(page.getByRole("list", { name: "Convidados" }).getByRole("listitem").filter({ hasText: "Fogo Zero" })).toContainText("Escolhida");

    // O resumo para os moradores chega ao Escrever comunicado já escrito.
    await page.getByRole("tab", { name: "Acompanhamento" }).click();
    await page.getByRole("link", { name: "Revisar e autorizar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Escrever comunicado" })).toBeVisible();
    await expect(page.getByLabel("Título")).toHaveValue("Recarga dos extintores");
    await expect(page.getByLabel("Texto")).toHaveValue(/Comparamos 2 orçamentos e escolhemos o da Fogo Zero \(R\$ 980\)\./);
  });

  test("OC-05: a planilha comparativa sai numa folha A4 com o pedido, as propostas, a decisão e os anexos; Baixar em PDF imprime", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comOrcamentos: true, comAprovacoes: true });
    const o = bomba(estado);
    await page.addInitScript(() => { (window as unknown as { impresso: number }).impresso = 0; window.print = () => { (window as unknown as { impresso: number }).impresso += 1; }; });
    await page.goto(`${PLATAFORMA}/orcamentos/${o.id}/planilha`);
    await expect(page.getByRole("heading", { level: 1, name: "Planilha comparativa" })).toBeVisible();
    const folha = page.getByRole("region", { name: "Planilha comparativa" }).or(page.getByLabel("Planilha comparativa").first());
    await expect(folha).toContainText("Residencial Ipê · planilha comparativa");
    await expect(folha).toContainText("Pedido em 08/10/2026 · 4 convidados · 3 propostas · 1 recusa");
    await expect(folha).toContainText("Bomba centrífuga equivalente à atual (3 cv, trifásica)");
    await expect(folha).toContainText("B · Bombas Brasília");
    await expect(folha).toContainText("Menor total");
    await expect(folha).toContainText("Retirada da velha: R$ 250,00 à parte");
    await expect(folha).toContainText("15/10 (venceu)");
    await expect(folha).toContainText("2 · em uso a 2");
    await expect(folha).toContainText("Recusaram: Central das Bombas (Não atendemos Águas Claras).");
    await expect(folha).toContainText("Ainda sem decisão. A regra pede 3 propostas; chegaram 3. Alçada do conselho: R$ 3.000.");
    await expect(folha).toContainText("Proposta 0412 Águia Hidráulica.pdf (Águia Hidráulica)");
    await expect(folha).toContainText("A TRÍADE não escolheu nem comprou: a decisão é do condomínio.");
    await expect(page.getByRole("link", { name: "Voltar" })).toHaveAttribute("href", `/orcamentos/${o.id}`);
    await conferir(page);
    await page.getByRole("button", { name: "Baixar em PDF" }).click();
    expect(await page.evaluate(() => (window as unknown as { impresso: number }).impresso)).toBe(1);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Baixar em PDF" })).toBeHidden();
    await expect(folha).toBeVisible();

    // Com a decisão: a coluna da escolhida e o motivo.
    await page.emulateMedia({ media: "screen" });
    o.estado = "ESCOLHIDA";
    o.escolha = { propostaId: o.convites[0]!.propostas[0]!.id, conviteId: o.convites[0]!.id, motivo: "Inclui a retirada da bomba velha e 12 meses de garantia", em: "2026-10-16T17:00:00.000Z", por: "Ana Souza", quemAprova: "PESSOA", despesaId: null, despesaEstado: null, aprovadaEm: "2026-10-16T17:00:00.000Z" };
    o.convites[0]!.escolhido = true;
    await page.reload();
    await expect(folha).toContainText("Escolhida");
    await expect(folha).toContainText("Escolhida a proposta de HidroPress Bombas, R$ 6.480,00, por Ana Souza em 16/10/2026. Motivo: Inclui a retirada da bomba velha e 12 meses de garantia");
  });

  test("OC-10: Configurações › Decisões e conselho traz as Regras dos orçamentos: as faixas, o que fazer abaixo do mínimo e os prazos; Guardar grava", async ({ page }) => {
    const estado = await instalarApiPlataformaFalsa(page, { comOrcamentos: true, comAprovacoes: true });
    await page.goto(`${PLATAFORMA}/configuracoes/decisoes`);
    await expect(page.getByRole("heading", { level: 2, name: "Regras dos orçamentos" })).toBeVisible();
    await expect(page.getByText("Quantas propostas pedir e quem aprova, por faixa de valor. Grava quando você clica em Guardar.")).toBeVisible();
    const minimo = page.getByRole("region", { name: "Mínimo de propostas por valor" });
    await expect(minimo).toContainText("Do condomínio, não uma regra da TRÍADE. Começa desligado.");
    await expect(minimo).toContainText("Ligado");
    await expect(minimo.getByRole("switch", { name: "Pedir um mínimo de propostas por faixa de valor" })).toBeChecked();
    const faixas = minimo.getByRole("group", { name: "Faixas de valor" }).getByRole("group");
    await expect(faixas).toHaveCount(3);
    await expect(faixas.nth(0)).toContainText("Até R$ 1.000");
    await expect(faixas.nth(1)).toContainText("De R$ 1.000 a R$ 3.000");
    await expect(faixas.nth(2)).toContainText("Acima de R$ 3.000");
    await expect(faixas.nth(2).getByLabel("Mínimo")).toHaveValue("3");
    await expect(faixas.nth(2).getByLabel("Quem aprova")).toHaveValue("CONSELHO");
    await expect(faixas.nth(2).getByLabel("Quem aprova")).toContainText("Conselho (a alçada de Decisões)");
    await expect(minimo).toContainText("A alçada do conselho é a mesma de Decisões (R$ 3.000). Mudar aqui muda lá: é um número só.");
    const abaixo = page.getByRole("region", { name: "Quando não chega o mínimo" });
    await expect(abaixo).toContainText("O sistema avisa; quem decide é o síndico");
    await expect(abaixo.getByRole("radio", { name: /Pode decidir com menos, escrevendo o motivo/ })).toBeChecked();
    await expect(abaixo).toContainText("Ex.: “só dois fornecedores atendem elevador desta marca”. O motivo vai para a planilha e para quem aprova.");
    const prazos = page.getByRole("region", { name: "Prazos e validade" });
    await expect(prazos).toContainText("Valores que já vêm escritos em todo orçamento novo");
    await expect(prazos.getByLabel("Prazo para propostas")).toHaveValue("7");
    await expect(prazos).toContainText("Até 30 dias");
    await expect(prazos.getByLabel("Validade mínima pedida")).toHaveValue("15");
    await expect(prazos.getByLabel("Link vale no máximo")).toHaveValue("30");
    await expect(prazos.getByRole("checkbox", { name: "Escolha que não é a de menor total pede o motivo por escrito (sempre ligado)" })).toBeChecked();
    await expect(prazos.getByRole("checkbox", { name: "Proposta vencida só pode ser escolhida depois que o fornecedor confirmar o preço" })).toBeChecked();
    await conferir(page);

    await faixas.nth(2).getByLabel("Mínimo").fill("4");
    await minimo.getByRole("button", { name: "Incluir faixa" }).click();
    await expect(minimo.getByRole("group", { name: "Faixas de valor" }).getByRole("group")).toHaveCount(4);
    await minimo.getByRole("group", { name: "Faixas de valor" }).getByRole("group").nth(2).getByLabel("até").fill("10.000,00");
    await expect(minimo.getByRole("group", { name: "Faixas de valor" }).getByRole("group").nth(3)).toContainText("Acima de R$ 10.000");
    await abaixo.getByRole("radio", { name: /Não deixa decidir com menos/ }).check();
    await prazos.getByLabel("Prazo para propostas").fill("10");
    await conferir(page);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Regras dos orçamentos salvas.", { exact: false })).toBeVisible();
    expect(ultimo(estado, /PUT \/v1\/condominio\/regras-orcamento$/)).toEqual({
      versao: 1, ligada: true, abaixoMinimo: "BLOQUEIA", prazoDias: 10, validadeDias: 15, linkDias: 30, alcadaConselho: 300000,
      faixas: [{ ate: 100000, minimo: 1, quemAprova: "SINDICO" }, { ate: 300000, minimo: 2, quemAprova: "SINDICO" }, { ate: 1000000, minimo: 4, quemAprova: "CONSELHO" }, { ate: null, minimo: 3, quemAprova: "CONSELHO" }],
    });
    await page.reload();
    await expect(page.getByRole("region", { name: "Quando não chega o mínimo" }).getByRole("radio", { name: /Não deixa decidir com menos/ })).toBeChecked();
    await page.getByRole("region", { name: "Mínimo de propostas por valor" }).getByRole("switch").uncheck();
    await expect(page.getByRole("region", { name: "Mínimo de propostas por valor" })).toContainText("Desligado");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Regras dos orçamentos salvas.", { exact: false })).toBeVisible();
    expect(ultimo(estado, /PUT \/v1\/condominio\/regras-orcamento$/)).toMatchObject({ versao: 2, ligada: false });
  });

  test("OC-03: pelo link o fornecedor vê o pedido, manda a proposta com o PDF, manda uma versão nova e diz que não vai participar", async ({ page }) => {
    test.slow();
    const estado = await instalarApiPlataformaFalsa(page, { comOrcamentos: true });
    const o = pintura(estado);
    await page.goto(`${PLATAFORMA}/o/${o.convites[0]!.codigo}`);
    await expect(page.getByRole("heading", { level: 1, name: "Residencial Ipê" })).toBeVisible();
    await expect(page.getByText("Pedido de orçamento para Pinturas Lima")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Passos da proposta" })).toHaveAttribute("aria-valuetext", "Passo 1 de 3: Ver o pedido");
    await expect(page.getByRole("heading", { name: "Pintura do hall da Torre A" })).toBeVisible();
    await expect(page.getByText("Pintura das paredes e do teto do hall, com massa corrida onde precisar. Tinta lavável.")).toBeVisible();
    await expect(page.getByText("06/11, 15h")).toBeVisible();
    await expect(page.getByText("pelo menos 15 dias")).toBeVisible();
    await expect(page.getByText("Você vê só a sua proposta. Ninguém mais vê o seu preço, e você não vê o dos outros.")).toBeVisible();
    await expect(page.getByText("Não precisa de conta nem senha. O link é só seu: não repasse.", { exact: false })).toBeVisible();
    expect(o.convites[0]!.aberturas).toBe(2);
    await conferir(page);

    await page.getByRole("button", { name: "Fazer minha proposta" }).click();
    await expect(page.getByRole("progressbar", { name: "Passos da proposta" })).toHaveAttribute("aria-valuenow", "2");
    await page.getByRole("button", { name: "Mandar proposta" }).click();
    await expect(page.getByText("Escreva o valor em reais, como 6.480,00.")).toBeVisible();
    await expect(page.getByText("Diga o prazo, como 5 dias úteis.")).toBeVisible();
    await expect(page.getByText("Diga o que a proposta inclui.")).toBeVisible();
    await page.getByLabel("Valor do serviço").fill("4.800,00");
    await expect(page.getByLabel("Frete", { exact: true })).toBeDisabled();
    await page.getByRole("checkbox", { name: "Incluso" }).uncheck();
    await page.getByLabel("Frete", { exact: true }).fill("120,00");
    await page.getByLabel("Marca e modelo").fill("Suvinil Toque de Seda");
    await page.getByLabel("Prazo para fazer").fill("6 dias úteis");
    await page.getByLabel("Garantia").fill("12 meses");
    await expect(page.getByLabel("Preço vale até")).toHaveValue("2026-10-31");
    await page.getByLabel("Pagamento").fill("50% na entrada e 50% no fim");
    await page.getByLabel("Inclui", { exact: true }).fill("Massa corrida onde precisar\nDuas demãos de tinta lavável\nProteção do piso");
    await page.getByLabel("Não inclui").fill("Pintura do teto do elevador");
    await page.getByLabel("Sua proposta em PDF (opcional)").setInputFiles(PDF);
    await conferir(page);
    await page.getByRole("button", { name: "Mandar proposta" }).click();
    await expect(page.getByRole("heading", { name: "Proposta enviada · versão 1" })).toBeVisible();
    await expect(page.getByText("O síndico do Residencial Ipê recebeu sua proposta de R$ 4.920,00. Você recebe a resposta por aqui e pelo WhatsApp.")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Passos da proposta" })).toHaveAttribute("aria-valuetext", "Passo 3 de 3: Pronto");
    const enviada = ultimo(estado, /\/proposta$/)!;
    expect(enviada).toMatchObject({ valor: 480000, frete: 12000, freteIncluso: false, marcaModelo: "Suvinil Toque de Seda", prazoExecucao: "6 dias úteis", garantia: "12 meses", validaAte: "2026-10-31",
      pagamento: "50% na entrada e 50% no fim", inclui: "Massa corrida onde precisar\nDuas demãos de tinta lavável\nProteção do piso", naoInclui: "Pintura do teto do elevador" });
    expect(typeof enviada.pdfArquivoId).toBe("string");
    expect(o.arquivos.map((a) => [a.nome, a.situacao, a.conviteId === o.convites[0]!.id])).toEqual([["Proposta Pinturas Lima.pdf", "LIBERADO", true]]);
    await expect(page.getByText("R$ 4.920,00 (R$ 4.800,00 + frete R$ 120,00)")).toBeVisible();
    await expect(page.getByText("Proposta Pinturas Lima.pdf")).toBeVisible();
    await conferir(page);

    // Uma versão nova, até o prazo: a anterior fica guardada.
    await expect(page.getByText("Até 06/11, 15h. A versão 1 continua guardada; o síndico vê as duas.")).toBeVisible();
    await page.getByRole("button", { name: "Mandar uma versão nova" }).click();
    await expect(page.getByLabel("Valor do serviço")).toHaveValue("4.800,00");
    await page.getByLabel("Valor do serviço").fill("4.600,00");
    await page.getByRole("button", { name: "Mandar proposta" }).click();
    await expect(page.getByRole("heading", { name: "Proposta enviada · versão 2" })).toBeVisible();
    await expect(page.getByText("recebeu sua proposta de R$ 4.720,00", { exact: false })).toBeVisible();
    expect(o.convites[0]!.propostas.map((p) => [p.numero, p.emUso])).toEqual([[1, false], [2, true]]);

    // Na ficha, o síndico vê a versão 2 de 2; na comparação, a versão 1 guardada.
    await page.goto(`${PLATAFORMA}/orcamentos/${o.id}`);
    await expect(page.getByRole("list", { name: "Convidados" }).getByRole("listitem").filter({ hasText: "Pinturas Lima" })).toContainText("Mandou a proposta · versão 2");

    // Não vou participar: o motivo é opcional; conta como resposta, não como proposta.
    await page.goto(`${PLATAFORMA}/o/${o.convites[1]!.codigo}`);
    await page.getByRole("button", { name: "Não vou participar" }).click();
    await expect(page.getByText("Se não for participar, diga o motivo (opcional). O síndico fica sabendo e não manda lembrete.")).toBeVisible();
    await page.getByLabel("Motivo").fill("Agenda cheia até dezembro");
    await conferir(page);
    await page.getByRole("button", { name: "Confirmar que não vou participar" }).click();
    await expect(page.getByRole("heading", { name: "Você disse que não vai participar" })).toBeVisible();
    await expect(page.getByText("Obrigado por avisar. O condomínio fica sabendo e não manda lembrete.")).toBeVisible();
    expect(ultimo(estado, /\/recusar$/)).toEqual({ motivo: "Agenda cheia até dezembro" });
    await conferir(page);

    await page.goto(`${PLATAFORMA}/o/nao-existe`);
    await expect(page.getByText("Este link não existe. Confira o endereço ou peça um novo ao condomínio.")).toBeVisible();
    await page.goto(`${PLATAFORMA}/o/${"x".repeat(43)}`);
    await expect(page.getByText("Este link não existe. Confira o endereço ou peça um novo ao condomínio.")).toBeVisible();
  });

  test("OC-03: o link em cada estado: enviada com o prazo fechado, confirmar o preço, escolhida e o aceite, não escolhida, aceita, prazo acabou e link vencido", async ({ page }) => {
    test.slow();
    const estado = await instalarApiPlataformaFalsa(page, { comOrcamentos: true });
    const o = bomba(estado);

    // Enviada, com o prazo fechado: sem versão nova.
    await page.goto(`${PLATAFORMA}/o/${o.convites[0]!.codigo}`);
    await expect(page.getByRole("heading", { name: "Proposta enviada · versão 1" })).toBeVisible();
    await expect(page.getByText("recebeu sua proposta de R$ 6.480,00", { exact: false })).toBeVisible();
    await expect(page.getByText("O prazo para propostas acabou: a sua já está com o condomínio.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mandar uma versão nova" })).toHaveCount(0);
    await expect(page.getByText("KSB Hydrobloc C 3 cv")).toBeVisible();
    await conferir(page);

    // Confirmar o preço (quadro 478): a validade venceu e o condomínio pediu.
    o.convites[1]!.propostas[1]!.confirmacaoPedidaEm = "2026-10-16T18:00:00.000Z";
    await page.goto(`${PLATAFORMA}/o/${o.convites[1]!.codigo}`);
    await expect(page.getByRole("heading", { name: "O condomínio pede para confirmar o preço" })).toBeVisible();
    await expect(page.getByText("Sua proposta venceu em 15/10. Confirme se R$ 6.130,00 continua valendo, ou mande um preço novo.")).toBeVisible();
    // O prazo já fechou: só confirmar; preço novo só enquanto o pedido aceita propostas.
    await expect(page.getByRole("button", { name: "Mandar um preço novo" })).toHaveCount(0);
    await page.getByLabel("O preço vale até").fill("2026-11-20");
    await conferir(page);
    await page.getByRole("button", { name: "Confirmar R$ 6.130,00" }).click();
    await expect(page.getByText("Preço confirmado até 20/11. O condomínio já sabe.")).toBeVisible();
    expect(ultimo(estado, /\/confirmar-preco$/)).toEqual({ validaAte: "2026-11-20" });
    await expect(page.getByRole("heading", { name: "Proposta enviada · versão 2" })).toBeVisible();
    await expect(page.getByText("20/11 · confirmado")).toBeVisible();

    // Escolhida: aceitar pelo link vira prestador do cadastro; a outra vê que não foi a escolhida.
    const ext = extintores(estado);
    await page.goto(`${PLATAFORMA}/o/${ext.convites[0]!.codigo}`);
    await expect(page.getByRole("heading", { name: "Sua proposta foi escolhida" })).toBeVisible();
    await expect(page.getByText("Confirme se aceita fazer o serviço nas condições da sua proposta. Aceitar aqui não é contrato nem pagamento.")).toBeVisible();
    await page.getByRole("button", { name: "Aceito fazer o serviço" }).click();
    await expect(page.getByText("Escreva o seu nome (2 a 120 caracteres).")).toBeVisible();
    await page.getByLabel("Quem aceita").fill("Marcos, da Fogo Zero");
    await conferir(page);
    await page.getByRole("button", { name: "Aceito fazer o serviço" }).click();
    await expect(page.getByRole("heading", { name: "Você aceitou fazer o serviço" })).toBeVisible();
    await expect(page.getByText("Marcos, da Fogo Zero aceitou em 16/10. O condomínio registra a compra e combina o resto com você.")).toBeVisible();
    expect(ultimo(estado, /\/aceitar$/)).toEqual({ nome: "Marcos, da Fogo Zero" });
    expect(ext.estado).toBe("COMPRANDO");
    await conferir(page);
    await page.goto(`${PLATAFORMA}/o/${ext.convites[1]!.codigo}`);
    await expect(page.getByRole("heading", { name: "O condomínio escolheu outra proposta" })).toBeVisible();
    await expect(page.getByText("Obrigado por participar. Você não vê qual foi a escolhida nem o preço dela.")).toBeVisible();
    await conferir(page);
    await page.goto(`${PLATAFORMA}/o/${estado.orcamentos.orcamentos.find((x) => x.titulo === "Limpeza da caixa d’água")!.convites[0]!.codigo}`);
    await expect(page.getByRole("heading", { name: "Você aceitou fazer o serviço" })).toBeVisible();
    await expect(page.getByText("Carlos Hidro aceitou em 01/10.")).toBeVisible();

    // O prazo acabou sem proposta; o link vencido.
    const pint = pintura(estado);
    pint.prazoPropostas = "2026-10-16T17:00:00.000Z";
    await page.goto(`${PLATAFORMA}/o/${pint.convites[2]!.codigo}`);
    await expect(page.getByRole("heading", { name: "O prazo para propostas acabou" })).toBeVisible();
    await expect(page.getByText("Este pedido fechou em 16/10, 14h. Fale com o condomínio se ainda quiser participar.")).toBeVisible();
    await conferir(page);
    pint.convites[2]!.expiraEm = "2026-08-01T12:00:00.000Z";
    await page.goto(`${PLATAFORMA}/o/${pint.convites[2]!.codigo}`);
    await expect(page.getByRole("heading", { name: "Este link não vale mais" })).toBeVisible();
    await expect(page.getByText("Este link venceu. Ele não abre mais. Se recebeu um link novo, use o novo.")).toBeVisible();
    await conferir(page);
  });
});
