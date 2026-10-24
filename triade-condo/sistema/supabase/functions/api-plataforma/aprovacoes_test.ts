// Decisões e aprovações (peça R5): o conselho (V-14) e a despesa para aprovar (FC-10). As rotas
// validam a entrada e mandam ao banco a pessoa e o condomínio da sessão; o quórum, quem vota e
// quando fecha são decididos no banco. O link do conselheiro não tem conta e conta o uso por aparelho.
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { CANAIS_CONSELHO, ESTADOS_DESPESA, PAPEIS_CONSELHO, QUORUNS_CONSELHO } from "@triade/domain";
import { criarApiPlataforma } from "./app.ts";
import { montarEmail, type Correio, type EmailPronto, type MensagemFila } from "../_shared/email.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const PEDIDO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const DECISAO = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const MEMBRO = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const DESPESA = "9c0d1e2f-3a4b-4c5d-8e6f-a7b8c9d0e1f2";
const ARQUIVO = "0d1e2f3a-4b5c-4d6e-9f7a-b8c9d0e1f2a3";
const AUSENCIA = "1e2f3a4b-5c6d-4e7f-8a8b-c9d0e1f2a3b4";
const CODIGO = "codigo-do-conselheiro-123";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };

const MSG: MensagemFila = {
  envio: "5a2b8e5d-0c6f-4b7a-8d3e-6f7a8b9c0d1e", condominio: AURORA, tipo: "CONSELHO", para: "lucia@exemplo.invalid",
  condominioNome: "Residencial Aurora", nome: "Lúcia", codigos: { abrir: CODIGO },
  conselho: { finalidade: "VOTO", item: "DECISAO", titulo: "Qual conserto fazer na laje da G2", prazo: "30/10/2026", papel: "Conselheiro", pedidaPor: "Bruna" },
};
const END = { urlApp: "https://plataforma.exemplo", urlFuncao: "https://funcao.exemplo", remetente: "nao-responda@exemplo.invalid" };

function montar(opcoes: { correio?: Correio; fila?: MensagemFila[] } = {}) {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const fila = [...(opcoes.fila ?? [])];
  const links = [{ membroId: MEMBRO, nome: "Lúcia Prado", canal: "EMAIL", envio: "EMAIL" }, { membroId: MEMBRO, nome: "Marcos", canal: "WHATSAPP", envio: "COPIAR", codigo: CODIGO }];
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: AURORA, nome: "Residencial Aurora", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), AURORA);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, link: 3 }),
    plataforma_pedir_decisao: (a) => ({ versao: Number(a.p_versao) + 1, id: DECISAO, ...(a.p_modo ? { titulares: 3, necessarios: 2, links } : {}) }),
    plataforma_conselho: () => ({ membros: [], regras: { quorum: "MAIORIA", titularesEmDia: 0, necessarios: 1, podePedir: false } }),
    plataforma_conselho_candidatos: (a) => ({ candidatos: [], busca: a.p_busca }),
    plataforma_incluir_membro: () => ({ id: MEMBRO, versao: 1 }),
    plataforma_alterar_membro: (a) => Number(a.p_versao) + 1,
    plataforma_retirar_membro: (a) => Number(a.p_versao) + 1,
    plataforma_regras_decisoes: () => ({ quorum: "MAIORIA", versao: 4 }),
    plataforma_definir_regras_decisoes: (a) => Number(a.p_versao) + 1,
    plataforma_marcar_ausencia: () => ({ id: AUSENCIA, versao: 1 }),
    plataforma_encerrar_ausencia: (a) => Number(a.p_versao) + 1,
    plataforma_votar_decisao: (a) => ({ escolha: a.p_escolha, trocou: false, estado: "AGUARDANDO" }),
    plataforma_votar_despesa: (a) => ({ escolha: a.p_escolha, trocou: false, estado: "APROVADA" }),
    plataforma_reenviar_link_conselho: (a) => (a.p_membro === MEMBRO ? { membroId: MEMBRO, canal: "EMAIL", envio: "EMAIL" } : erroBanco("TC404")),
    plataforma_despesas: (a) => ({ despesas: [], filtro: a.p_filtro }),
    plataforma_despesa_opcoes: () => ({ decisores: [], prestadores: [] }),
    plataforma_despesa: (a) => ({ id: a.p_id, estado: "AGUARDANDO" }),
    plataforma_criar_despesa: (a) => ({ id: DESPESA, versao: 1, passaAlcada: true, links: a.p_modo === "CONSELHO" ? links : [] }),
    plataforma_alterar_despesa: (a) => Number(a.p_versao) + 1,
    plataforma_responder_despesa: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_retirar_despesa: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_pagar_despesa: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_desfazer_pagamento: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_iniciar_anexo_aprovacao: (a) => ({ arquivoId: ARQUIVO, caminho: `${AURORA}/aprovacoes/${a.p_despesa ?? a.p_decisao}/${ARQUIVO}`, tipo: a.p_tipo }),
    plataforma_anexo_aprovacao_a_verificar: () => ({ caminho: `${AURORA}/aprovacoes/${DESPESA}/${ARQUIVO}`, tipo: "application/pdf" }),
    plataforma_verificar_anexo_aprovacao: (a) => ({ situacao: a.p_liberado ? "LIBERADO" : "NAO_LIBERADO" }),
    plataforma_abrir_anexo_aprovacao: () => ({ caminho: `${AURORA}/aprovacoes/${DESPESA}/${ARQUIVO}`, nome: "Orçamento.pdf", tipo: "application/pdf" }),
    plataforma_tirar_anexo_aprovacao: () => ({ ok: true }),
    publico_conselho: () => ({ condominio: "Residencial Aurora", estado: "VOTAR" }),
    publico_votar_conselho: (a) => (a.p_escolha === "9" ? erroBanco("TC422", { campos: ["escolha"] }) : { estado: "VOTADO" }),
    publico_responder_conselho: () => ({ estado: "FECHADA" }),
    publico_conselho_anexo: () => ({ caminho: `${AURORA}/aprovacoes/${DECISAO}/${ARQUIVO}`, nome: "Laudo.pdf", tipo: "application/pdf" }),
    email_pegar_lote: () => fila.splice(0, 100),
    email_resultado: () => null,
  });
  const fundo: Promise<unknown>[] = [];
  const guarda = armazenamentoFalso();
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo", armazenamento: guarda.armazenamento,
    correio: opcoes.correio, urlFuncao: "https://funcao.exemplo/functions/v1/api-plataforma", aoFundo: (p) => fundo.push(p),
  });
  return { pedir: pedido(app, "api-plataforma"), fundo, guarda, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;
const quantas = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.filter((c) => c.funcao === funcao).length;
const QUEM = { p_pessoa: ANA, p_condominio: AURORA };

function correioFalso() {
  const enviados: EmailPronto[] = [];
  const correio: Correio = {
    enviarLote(emails) {
      enviados.push(...emails);
      return Promise.resolve(emails.map((_, i) => ({ ok: true as const, id: `re_${i}` })));
    },
  };
  return { correio, enviados };
}

Deno.test("V-14: o conselho só com sessão; incluir manda o mandato e o canal", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/conselho"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/conselho", { cookie })).status, 200);
  const corpo = { nome: " Lúcia Prado ", papel: "CONSELHEIRO", mandatoInicio: "2026-01-01", mandatoFim: "2027-12-31", canal: "EMAIL", email: "lucia@exemplo.invalid" };
  const r = await m.pedir("/v1/condominio/conselho", { corpo, cookie });
  assertEquals(r.status, 201);
  assertEquals(await r.json(), { id: MEMBRO, versao: 1 });
  assertEquals(chamada(m, "plataforma_incluir_membro"), {
    ...QUEM, p_membro_pessoa: null, p_contato: null, p_nome: "Lúcia Prado", p_celular: null, p_email: "lucia@exemplo.invalid",
    p_papel: "CONSELHEIRO", p_inicio: "2026-01-01", p_fim: "2027-12-31", p_canal: "EMAIL",
  });
  const sem = await m.pedir("/v1/condominio/conselho", { corpo: { ...corpo, nome: null }, cookie });
  assertEquals((await erro(sem)).detalhes?.campos, ["nome"]);
  assertEquals(quantas(m, "plataforma_incluir_membro"), 1);
  await m.pedir("/v1/condominio/conselho/candidatos?busca=304", { cookie });
  assertEquals(chamada(m, "plataforma_conselho_candidatos")?.p_busca, "304");
});

Deno.test("V-14: alterar e retirar levam a versão; retirar pede motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = { versao: 2, papel: "SUBSINDICO", mandatoInicio: "2026-01-01", mandatoFim: "2027-12-31", canal: "WHATSAPP", celular: "+5561999990001" };
  assertEquals(await (await m.pedir(`/v1/condominio/conselho/${MEMBRO}`, { metodo: "PUT", corpo, cookie })).json(), { versao: 3 });
  assertEquals(chamada(m, "plataforma_alterar_membro")?.p_celular, "+5561999990001");
  assertEquals((await m.pedir(`/v1/condominio/conselho/${MEMBRO}/retirar`, { corpo: { versao: 3, motivo: "x" }, cookie })).status, 400);
  assertEquals(await (await m.pedir(`/v1/condominio/conselho/${MEMBRO}/retirar`, { corpo: { versao: 3, motivo: "Mudou-se" }, cookie })).json(), { versao: 4 });
  assertEquals((await m.pedir(`/v1/condominio/conselho/nao-e-id/retirar`, { corpo: { versao: 3, motivo: "Mudou-se" }, cookie })).status, 404);
});

Deno.test("V-14: as regras, a alçada em centavos e a ausência do síndico", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const regras = { versao: 4, quorum: "MINIMO", minimo: 2, empate: "SINDICO", vencidaAvisa: "CONSELHO", alcada: 500000 };
  assertEquals(await (await m.pedir("/v1/condominio/regras-decisoes", { metodo: "PUT", corpo: regras, cookie })).json(), { versao: 5 });
  assertEquals(chamada(m, "plataforma_definir_regras_decisoes"), {
    ...QUEM, p_versao: 4, p_quorum: "MINIMO", p_minimo: 2, p_empate: "SINDICO", p_vencida: "CONSELHO", p_alcada: 500000,
  });
  assertEquals((await erro(await m.pedir("/v1/condominio/regras-decisoes", { metodo: "PUT", corpo: { ...regras, minimo: null }, cookie }))).detalhes?.campos, ["minimo"]);
  const r = await m.pedir("/v1/condominio/ausencia", { corpo: { de: "2026-12-01", ate: "2026-12-10", motivo: "Viagem" }, cookie });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_marcar_ausencia"), { ...QUEM, p_de: "2026-12-01", p_ate: "2026-12-10", p_motivo: "Viagem" });
  assertEquals(await (await m.pedir(`/v1/condominio/ausencia/${AUSENCIA}/encerrar`, { corpo: { versao: 1 }, cookie })).json(), { versao: 2 });
});

Deno.test("V-14: pedir ao conselho manda o modo; o pedido a uma pessoa segue como antes", async () => {
  const c = correioFalso();
  const m = montar({ correio: c.correio, fila: [MSG] });
  const cookie = await entrar(m);
  const base = { versao: 3, pergunta: "Qual conserto fazer na laje da G2", prazo: "2026-10-30", alternativas: [{ descricao: "Remendo" }] };
  await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/decisoes`, { corpo: { ...base, decisorId: MEMBRO }, cookie });
  assertEquals("p_modo" in chamada(m, "plataforma_pedir_decisao")!, false, "sem o modo, a função antiga (0280) responde igual");
  assertEquals(quantas(m, "email_pegar_lote"), 0);
  assertEquals((await erro(await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/decisoes`, { corpo: { ...base, modo: "CONSELHO", decisorId: MEMBRO }, cookie }))).detalhes?.campos,
    ["decisorId"]);
  const r = await (await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/decisoes`, { corpo: { ...base, modo: "CONSELHO" }, cookie })).json();
  assertEquals(chamada(m, "plataforma_pedir_decisao")?.p_modo, "CONSELHO");
  assertEquals(chamada(m, "plataforma_pedir_decisao")?.p_decisor, null);
  assertEquals(r.links[1].codigo, CODIGO, "pelo WhatsApp, a tela mostra o link para copiar");
  await Promise.all(m.fundo);
  assertEquals(c.enviados.length, 1, "o link pelo e-mail sai na hora");
  assertStringIncludes(c.enviados[0]!.html, `https://plataforma.exemplo/conselho/${CODIGO}`);
});

Deno.test("V-14: votar pelo painel e reenviar o link", async () => {
  const c = correioFalso();
  const m = montar({ correio: c.correio, fila: [MSG] });
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`/v1/condominio/decisoes/${DECISAO}/voto`, { corpo: { escolha: "DEVOLVER" }, cookie }))).detalhes?.campos, ["justificativa"]);
  await m.pedir(`/v1/condominio/decisoes/${DECISAO}/voto`, { corpo: { escolha: "2" }, cookie });
  assertEquals(chamada(m, "plataforma_votar_decisao"), { ...QUEM, p_decisao: DECISAO, p_escolha: "2", p_justificativa: null });
  assertEquals((await m.pedir(`/v1/condominio/decisoes/${DECISAO}/reenviar-link`, { corpo: { membroId: MEMBRO }, cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_reenviar_link_conselho"), { ...QUEM, p_decisao: DECISAO, p_despesa: null, p_membro: MEMBRO });
  await Promise.all(m.fundo);
  assertEquals(c.enviados.length, 1);
  await m.pedir(`/v1/condominio/despesas/${DESPESA}/reenviar-link`, { corpo: { membroId: MEMBRO }, cookie });
  assertEquals(chamada(m, "plataforma_reenviar_link_conselho")?.p_despesa, DESPESA);
});

Deno.test("FC-10: a despesa: criar, filtros, responder, retirar e pagar fora do sistema", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = { descricao: "Bomba nova do poço", valor: 800000, fornecedor: "HidroPress", modo: "CONSELHO", prazo: "2026-11-10", pedidoId: PEDIDO };
  assertEquals((await erro(await m.pedir("/v1/condominio/despesas", { corpo: { ...corpo, valor: 8000.5 }, cookie }))).detalhes?.campos, ["valor"]);
  const r = await m.pedir("/v1/condominio/despesas", { corpo, cookie });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).passaAlcada, true);
  assertEquals(chamada(m, "plataforma_criar_despesa"), {
    ...QUEM, p_descricao: "Bomba nova do poço", p_valor: 800000, p_prestador: null, p_fornecedor: "HidroPress", p_vencimento: null,
    p_pedido: PEDIDO, p_manutencao: null, p_decisao: null, p_modo: "CONSELHO", p_decisor: null, p_prazo: "2026-11-10",
  });
  await m.pedir("/v1/condominio/despesas?filtro=APROVADAS", { cookie });
  assertEquals(chamada(m, "plataforma_despesas")?.p_filtro, "APROVADAS");
  assertEquals((await m.pedir("/v1/condominio/despesas?filtro=PAGAS", { cookie })).status, 400);
  assertEquals((await m.pedir("/v1/condominio/despesas/opcoes", { cookie })).status, 200);
  assertEquals((await (await m.pedir(`/v1/condominio/despesas/${DESPESA}`, { cookie })).json()).id, DESPESA);
  assertEquals(await (await m.pedir(`/v1/condominio/despesas/${DESPESA}`, { metodo: "PUT", corpo: { ...corpo, versao: 1 }, cookie })).json(), { versao: 2 });
  assertEquals((await m.pedir(`/v1/condominio/despesas/${DESPESA}/responder`, { corpo: { versao: 2, aprovar: false }, cookie })).status, 400);
  await m.pedir(`/v1/condominio/despesas/${DESPESA}/responder`, { corpo: { versao: 2, aprovar: false, justificativa: "Ainda tem garantia." }, cookie });
  assertEquals(chamada(m, "plataforma_responder_despesa"), { ...QUEM, p_id: DESPESA, p_versao: 2, p_aprovar: false, p_justificativa: "Ainda tem garantia." });
  await m.pedir(`/v1/condominio/despesas/${DESPESA}/voto`, { corpo: { escolha: "aprovar" }, cookie });
  assertEquals(chamada(m, "plataforma_votar_despesa")?.p_escolha, "APROVAR");
  await m.pedir(`/v1/condominio/despesas/${DESPESA}/retirar`, { corpo: { versao: 3, motivo: "A prefeitura vai fazer" }, cookie });
  assertEquals(chamada(m, "plataforma_retirar_despesa")?.p_motivo, "A prefeitura vai fazer");
  await m.pedir(`/v1/condominio/despesas/${DESPESA}/pagar`, { corpo: { versao: 3, pagaEm: "2026-11-03", comprovanteId: ARQUIVO }, cookie });
  assertEquals(chamada(m, "plataforma_pagar_despesa"), { ...QUEM, p_id: DESPESA, p_versao: 3, p_paga_em: "2026-11-03", p_comprovante: ARQUIVO });
  await m.pedir(`/v1/condominio/despesas/${DESPESA}/desfazer-pagamento`, { corpo: { versao: 4 }, cookie });
  assertEquals(chamada(m, "plataforma_desfazer_pagamento"), { ...QUEM, p_id: DESPESA, p_versao: 4 });
});

Deno.test("FC-10: os anexos vão ao armazenamento dos pedidos e só se liberam depois de conferidos", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/despesas/${DESPESA}/anexos`, { corpo: { nome: "Orçamento.pdf", tipo: "application/pdf", tamanho: 3000 }, cookie });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).envio.url, `https://armazenamento.exemplo/envio/${AURORA}/aprovacoes/${DESPESA}/${ARQUIVO}?token=t`);
  assertEquals(chamada(m, "plataforma_iniciar_anexo_aprovacao"), {
    ...QUEM, p_decisao: null, p_despesa: DESPESA, p_parte: "DOCUMENTO", p_nome: "Orçamento.pdf", p_tipo: "application/pdf", p_tamanho: 3000,
  });
  await m.pedir(`/v1/condominio/decisoes/${DECISAO}/anexos`, { corpo: { nome: "Laudo.pdf", tipo: "application/pdf", tamanho: 3000 }, cookie });
  assertEquals(chamada(m, "plataforma_iniciar_anexo_aprovacao")?.p_decisao, DECISAO);
  // Não chegou nada: não libera.
  const v = await (await m.pedir(`/v1/condominio/aprovacoes/anexos/${ARQUIVO}/verificar`, { metodo: "POST", cookie })).json();
  assertEquals(v.situacao, "NAO_LIBERADO");
  assertEquals(chamada(m, "plataforma_verificar_anexo_aprovacao")?.p_liberado, false);
  const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
  m.guarda.objetos.set(`${AURORA}/aprovacoes/${DESPESA}/${ARQUIVO}`, pdf);
  const ok = await (await m.pedir(`/v1/condominio/aprovacoes/anexos/${ARQUIVO}/verificar`, { metodo: "POST", cookie })).json();
  assertEquals(ok.situacao, "LIBERADO");
  const l = await (await m.pedir(`/v1/condominio/aprovacoes/anexos/${ARQUIVO}/link?baixar=1`, { cookie })).json();
  assertStringIncludes(l.url, "download=Orçamento.pdf");
  assertEquals((await m.pedir(`/v1/condominio/aprovacoes/anexos/${ARQUIVO}/tirar`, { corpo: { motivo: "Errei o arquivo" }, cookie })).status, 200);
});

Deno.test("V-14: o link do conselheiro, sem conta, com limite por aparelho", async () => {
  const m = montar();
  assertEquals(await (await m.pedir(`/v1/publico/conselho/${CODIGO}`)).json(), { condominio: "Residencial Aurora", estado: "VOTAR" });
  assertEquals(chamada(m, "limite_contar")?.p_tipo, "link");
  assert(!String(chamada(m, "limite_contar")?.p_chave).includes("200.1.2.3"), "a chave do limite não leva o IP em claro");
  assertEquals((await m.pedir("/v1/publico/conselho/curto")).status, 404);
  assertEquals((await erro(await m.pedir(`/v1/publico/conselho/${CODIGO}/voto`, { corpo: { escolha: "RECUSAR" } }))).detalhes?.campos, ["justificativa"]);
  assertEquals(await (await m.pedir(`/v1/publico/conselho/${CODIGO}/voto`, { corpo: { escolha: "1" } })).json(), { estado: "VOTADO" });
  assertEquals(chamada(m, "publico_votar_conselho"), { p_codigo: CODIGO, p_escolha: "1", p_justificativa: null });
  assertEquals((await m.pedir(`/v1/publico/conselho/${CODIGO}/resposta`, { corpo: { aprovar: true, alternativa: 1, justificativa: "Pode trocar." } })).status, 429,
    "o limite do aparelho vale para tudo do link");
});

Deno.test("V-14: a resposta do substituto e o anexo pelo link", async () => {
  const m = montar();
  await m.pedir(`/v1/publico/conselho/${CODIGO}/resposta`, { corpo: { aprovar: true, alternativa: 1, justificativa: "Pode trocar." } });
  assertEquals(chamada(m, "publico_responder_conselho"), { p_codigo: CODIGO, p_aprovar: true, p_alternativa: 1, p_justificativa: "Pode trocar." });
  const a = await (await m.pedir(`/v1/publico/conselho/${CODIGO}/arquivos/${ARQUIVO}`)).json();
  assertEquals(a.url, `https://armazenamento.exemplo/ler/${AURORA}/aprovacoes/${DECISAO}/${ARQUIVO}?token=t`);
  assertEquals(a.nome, "Laudo.pdf");
});

Deno.test("V-14: o e-mail do link: votar, responder no lugar do síndico e só ver a vencida", () => {
  const e = montarEmail(MSG, END);
  assertEquals(e.assunto, "[Residencial Aurora] Seu voto: Qual conserto fazer na laje da G2");
  assertStringIncludes(e.texto, "Olá, Lúcia.\n\nO conselho do Residencial Aurora vota a decisão: Qual conserto fazer na laje da G2. Bruna pediu. Vote até 30/10/2026.");
  assertStringIncludes(e.texto, "Abrir e votar: https://plataforma.exemplo/conselho/codigo-do-conselheiro-123");
  assertStringIncludes(e.texto, "Dá para trocar o voto até o prazo.");
  assert(!e.html.includes("Parar de receber"), "o link do conselho não é lista de comunicados");
  const s = montarEmail({ ...MSG, conselho: { ...MSG.conselho!, finalidade: "SUBSTITUTO", item: "DESPESA", titulo: "Bomba nova", valor: "R$ 8.000,00", papel: "Subsíndico" } }, END);
  assertEquals(s.assunto, "[Residencial Aurora] Responder no lugar do síndico: Bomba nova");
  assertStringIncludes(s.texto, "como subsíndico, responde no lugar dele a despesa Bomba nova, de R$ 8.000,00.");
  const v = montarEmail({ ...MSG, conselho: { ...MSG.conselho!, finalidade: "AVISO" } }, END);
  assertStringIncludes(v.texto, "Venceu em 30/10/2026 sem resposta a decisão: Qual conserto fazer na laje da G2.");
  assertStringIncludes(v.texto, "Ver: https://plataforma.exemplo/conselho/");
});

Deno.test("as listas da R5 são as mesmas do banco", async () => {
  const sql = await Deno.readTextFile(new URL("../../migrations/0303_decisoes_aprovacoes.sql", import.meta.url));
  const lista = (o: Record<string, string>) => Object.keys(o).map((k) => `'${k}'`).join(", ");
  assertStringIncludes(sql, `papel in (${lista(PAPEIS_CONSELHO)})`);
  assertStringIncludes(sql, `canal in (${lista(CANAIS_CONSELHO)})`);
  assertStringIncludes(sql, `conselho_quorum in (${lista(QUORUNS_CONSELHO)})`);
  assertStringIncludes(sql, `estado in (${lista(ESTADOS_DESPESA)})`);
});
