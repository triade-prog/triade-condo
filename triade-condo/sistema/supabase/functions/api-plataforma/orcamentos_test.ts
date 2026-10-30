// Orçamentos e compras (peça R8): as rotas validam a entrada e mandam ao banco a pessoa e o
// condomínio da sessão; estados, regras e quem pode o quê são decididos no banco (0317). O convite
// pelo WhatsApp volta com a mensagem pronta e o link /o/<código>; o do e-mail esvazia a fila. O link
// do fornecedor não tem conta e conta o uso por aparelho.
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { algumConvitePorEmail, completarLink, type LinkConvite } from "./orcamentos.ts";
import { montarEmail, type Correio, type EmailPronto, type MensagemFila } from "../_shared/email.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const ORC = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const CONVITE = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const PRESTADOR = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const PROPOSTA = "9c0d1e2f-3a4b-4c5d-8e6f-a7b8c9d0e1f2";
const ARQUIVO = "0d1e2f3a-4b5c-4d6e-9f7a-b8c9d0e1f2a3";
const CODIGO = "codigo-do-fornecedor-12345";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const QUEM = { p_pessoa: ANA, p_condominio: AURORA };
const MENSAGEM = { quem: "Bruna", cargo: "Zeladora", condominio: "Residencial Aurora", titulo: "Troca da bomba do poço", prazo: "02/11, 18h" };
const LINKS: LinkConvite[] = [
  { conviteId: CONVITE, nome: "HidroPress", canal: "WHATSAPP", letra: "A", envio: "COPIAR", codigo: CODIGO, mensagem: MENSAGEM },
  { conviteId: CONVITE, nome: "Bombas Silva", canal: "EMAIL", letra: "B", envio: "EMAIL", mensagem: MENSAGEM },
];
const MSG: MensagemFila = {
  envio: "5a2b8e5d-0c6f-4b7a-8d3e-6f7a8b9c0d1e", condominio: AURORA, tipo: "ORCAMENTO", para: "silva@exemplo.invalid",
  condominioNome: "Residencial Aurora", nome: "Bombas Silva", codigos: { abrir: CODIGO },
  orcamento: { finalidade: "CONVITE", titulo: "Troca da bomba do poço", local: "Casa de bombas", prazo: "02/11, 18h", quem: "Bruna", cargo: "Zeladora" },
};
const END = { urlApp: "https://plataforma.exemplo", urlFuncao: "https://funcao.exemplo", remetente: "nao-responda@exemplo.invalid" };
const CAMINHO = `${AURORA}/orcamentos/${ORC}/${ARQUIVO}`;
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

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

function montar(opcoes: { correio?: Correio; fila?: MensagemFila[]; link?: number } = {}) {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const fila = [...(opcoes.fila ?? [])];
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: AURORA, nome: "Residencial Aurora", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), AURORA);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, link: opcoes.link ?? 20 }),
    plataforma_orcamentos: (a) => ({ filtro: a.p_filtro, orcamentos: [] }),
    plataforma_orcamento_opcoes: () => ({ prestadores: [], regras: { ligada: false } }),
    plataforma_orcamento: (a) => ({ orcamento: { id: a.p_id, estado: "PEDINDO" } }),
    plataforma_comparacao: (a) => ({ orcamento: { id: a.p_id }, propostas: [] }),
    plataforma_criar_orcamento: (a) => ({ id: ORC, versao: 1, estado: a.p_mandar ? "PEDINDO" : "RASCUNHO", links: a.p_mandar ? LINKS : [] }),
    plataforma_alterar_orcamento: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_convidar: () => ({ versao: 3, links: [LINKS[0]] }),
    plataforma_mandar_orcamento: (a) => ({ versao: Number(a.p_versao) + 1, estado: "PEDINDO", links: LINKS }),
    plataforma_reenviar_convite: (a) => (a.p_convite === CONVITE ? { link: LINKS[1] } : erroBanco("TC404")),
    plataforma_revogar_convite: () => ({ ok: true }),
    plataforma_pedir_confirmacao_preco: () => ({ link: LINKS[0] }),
    plataforma_estender_prazo: (a) => ({ versao: Number(a.p_versao) + 1, estado: "PEDINDO" }),
    plataforma_fechar_propostas: (a) => ({ versao: Number(a.p_versao) + 1, estado: "COMPARANDO" }),
    plataforma_escolher_proposta: (a) => ({
      versao: Number(a.p_versao) + 1, estado: "ESCOLHIDA", passaAlcada: true,
      ...(a.p_quem_aprova === "CONSELHO" ? { despesaId: PROPOSTA, links: [{ envio: "EMAIL" }] } : {}),
    }),
    plataforma_desfazer_escolha: (a) => ({ versao: Number(a.p_versao) + 1, estado: "COMPARANDO" }),
    plataforma_aceite_fora_do_link: (a) => ({ versao: Number(a.p_versao) + 1, estado: "COMPRANDO", prestadorId: PRESTADOR }),
    plataforma_registrar_compra: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_registrar_entrega: (a) => ({ versao: Number(a.p_versao) + 1, estado: a.p_parcial ? "COMPRANDO" : "ENTREGUE" }),
    plataforma_cancelar_orcamento: (a) => ({ versao: Number(a.p_versao) + 1, estado: "CANCELADO" }),
    plataforma_regras_orcamento: () => ({ ligada: false, faixas: [], versao: 4 }),
    plataforma_salvar_regras_orcamento: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_iniciar_anexo_orcamento: (a) => ({ arquivoId: ARQUIVO, caminho: CAMINHO, tipo: a.p_tipo }),
    plataforma_anexo_orcamento_a_verificar: () => ({ caminho: CAMINHO, tipo: "application/pdf" }),
    plataforma_verificar_anexo_orcamento: (a) => ({ situacao: a.p_liberado ? "LIBERADO" : "NAO_LIBERADO" }),
    plataforma_abrir_anexo_orcamento: () => ({ caminho: CAMINHO, nome: "NF 1234.pdf", tipo: "application/pdf" }),
    plataforma_tirar_anexo_orcamento: () => ({ ok: true }),
    publico_orcamento: () => ({ condominio: "Residencial Aurora", estado: "VER" }),
    publico_recusar_orcamento: () => ({ estado: "RECUSOU" }),
    publico_enviar_proposta: () => ({ estado: "ENVIADA", numero: 1 }),
    publico_confirmar_preco: () => ({ estado: "ENVIADA" }),
    publico_aceitar_orcamento: () => ({ estado: "ACEITA" }),
    publico_iniciar_pdf_orcamento: (a) => ({ arquivoId: ARQUIVO, caminho: CAMINHO, tipo: a.p_tipo }),
    publico_pdf_orcamento_a_verificar: () => ({ caminho: CAMINHO, tipo: "application/pdf" }),
    publico_verificar_pdf_orcamento: (a) => ({ situacao: a.p_liberado ? "LIBERADO" : "NAO_LIBERADO" }),
    publico_arquivo_orcamento: () => ({ caminho: CAMINHO, nome: "Proposta.pdf", tipo: "application/pdf" }),
    email_pegar_lote: () => fila.splice(0, 100),
    email_resultado: () => null,
  });
  const fundo: Promise<unknown>[] = [];
  const guarda = armazenamentoFalso();
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso({}).admin, urlApp: "https://plataforma.exemplo", armazenamento: guarda.armazenamento,
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

Deno.test("OC-03: o link para copiar ganha o endereço e a mensagem pronta; o do e-mail fica como veio", () => {
  const l = completarLink(LINKS[0]!, "https://plataforma.exemplo/");
  assertEquals(l.link, `https://plataforma.exemplo/o/${CODIGO}`);
  assertEquals(l.texto, "Olá, aqui é Bruna, Zeladora do Residencial Aurora. Queremos um orçamento para troca da bomba do poço. " +
    `Veja o que precisa e mande sua proposta até 02/11, 18h, por este link: https://plataforma.exemplo/o/${CODIGO}. Se não puder participar, é só dizer no link.`);
  assertEquals(completarLink(LINKS[1]!, "https://plataforma.exemplo"), LINKS[1]);
  assertEquals(algumConvitePorEmail(LINKS), true);
  assertEquals(algumConvitePorEmail([LINKS[0]]), false);
});

Deno.test("OC-01: a lista e a ficha só com sessão; o filtro é conferido", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/orcamentos"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/condominio/orcamentos", { cookie })).json()).filtro, "EM_ANDAMENTO");
  assertEquals(chamada(m, "plataforma_orcamentos"), { ...QUEM, p_filtro: "EM_ANDAMENTO" });
  await m.pedir("/v1/condominio/orcamentos?filtro=CANCELADOS", { cookie });
  assertEquals(chamada(m, "plataforma_orcamentos")?.p_filtro, "CANCELADOS");
  assertEquals((await erro(await m.pedir("/v1/condominio/orcamentos?filtro=OUTRO", { cookie }))).detalhes?.campos, ["filtro"]);
  assertEquals((await m.pedir("/v1/condominio/orcamentos/opcoes", { cookie })).status, 200);
  assertEquals((await m.pedir(`/v1/condominio/orcamentos/${ORC}`, { cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_orcamento"), { ...QUEM, p_id: ORC });
  assertEquals((await m.pedir(`/v1/condominio/orcamentos/${ORC}/comparacao`, { cookie })).status, 200);
  assertEquals((await m.pedir("/v1/condominio/orcamentos/nao-e-id", { cookie })).status, 404);
});

Deno.test("OC-03: pedir manda os convites; o do WhatsApp volta pronto para copiar, o do e-mail sai na hora", async () => {
  const c = correioFalso();
  const m = montar({ correio: c.correio, fila: [MSG] });
  const cookie = await entrar(m);
  const corpo = {
    titulo: " Troca da bomba do poço ", descricao: "Bomba de 2 cv com instalação", local: "Casa de bombas", valorEstimado: 800000,
    prazoPropostas: "2026-11-02T18:00:00-03:00", validadeMinimaDias: 15,
    convites: [{ prestadorId: PRESTADOR, canal: "WHATSAPP" }, { nome: "Bombas Silva", canal: "EMAIL", email: "silva@exemplo.invalid" }],
  };
  const r = await m.pedir("/v1/condominio/orcamentos", { corpo, cookie });
  assertEquals(r.status, 201);
  const j = await r.json();
  assertEquals(chamada(m, "plataforma_criar_orcamento"), {
    ...QUEM, p_titulo: "Troca da bomba do poço", p_descricao: "Bomba de 2 cv com instalação", p_local: "Casa de bombas", p_tipo: "SERVICO",
    p_manutencao: null, p_pedido: null, p_valor_estimado: 800000, p_prazo: "2026-11-02T18:00:00-03:00", p_validade: 15,
    p_convites: [
      { prestadorId: PRESTADOR, nome: null, canal: "WHATSAPP", celular: null, email: null },
      { prestadorId: null, nome: "Bombas Silva", canal: "EMAIL", celular: null, email: "silva@exemplo.invalid" },
    ],
    p_mandar: true,
  });
  assertEquals(j.links[0].link, `https://plataforma.exemplo/o/${CODIGO}`);
  assertStringIncludes(j.links[0].texto, "Queremos um orçamento para troca da bomba do poço");
  assertEquals("link" in j.links[1], false, "pelo e-mail, o código não volta para a tela");
  await Promise.all(m.fundo);
  assertEquals(c.enviados.length, 1, "o convite pelo e-mail sai na hora");
  assertStringIncludes(c.enviados[0]!.html, `https://plataforma.exemplo/o/${CODIGO}`);

  // Guardar sem mandar: sem links, sem fila.
  await m.pedir("/v1/condominio/orcamentos", { corpo: { ...corpo, convites: [], mandar: false }, cookie });
  assertEquals(chamada(m, "plataforma_criar_orcamento")?.p_mandar, false);
  assertEquals((await erro(await m.pedir("/v1/condominio/orcamentos", { corpo: { ...corpo, convites: [] }, cookie }))).detalhes?.campos, ["convites"]);
  assertEquals((await erro(await m.pedir("/v1/condominio/orcamentos", { corpo: { ...corpo, convites: [{ nome: "Hidro Norte", canal: "WHATSAPP" }] }, cookie })))
    .detalhes?.campos, ["convites"]);
  assertEquals((await erro(await m.pedir("/v1/condominio/orcamentos", { corpo: { ...corpo, prazoPropostas: "amanhã" }, cookie }))).detalhes?.campos, ["prazoPropostas"]);
  assertEquals(quantas(m, "plataforma_criar_orcamento"), 2, "o que não passa no esquema não chega ao banco");
});

Deno.test("OC-03: mudar, convidar, mandar o rascunho, reenviar, revogar e pedir a confirmação do preço", async () => {
  const m = montar({ correio: correioFalso().correio });
  const cookie = await entrar(m);
  const alt = { versao: 2, titulo: "Troca da bomba", descricao: "Bomba de 2 cv e teste", local: null, valorEstimado: null };
  assertEquals(await (await m.pedir(`/v1/condominio/orcamentos/${ORC}`, { metodo: "PUT", corpo: alt, cookie })).json(), { versao: 3 });
  assertEquals(chamada(m, "plataforma_alterar_orcamento"), {
    ...QUEM, p_id: ORC, p_versao: 2, p_titulo: "Troca da bomba", p_descricao: "Bomba de 2 cv e teste", p_local: null, p_valor_estimado: null,
  });
  const cv = await (await m.pedir(`/v1/condominio/orcamentos/${ORC}/convites`, { corpo: { convites: [{ nome: "Poço Fácil", canal: "WHATSAPP", celular: "61999990004" }] }, cookie }))
    .json();
  assertEquals(cv.links[0].link, `https://plataforma.exemplo/o/${CODIGO}`);
  assertEquals((await m.pedir(`/v1/condominio/orcamentos/${ORC}/convites`, { corpo: { convites: [] }, cookie })).status, 400);
  const md = await (await m.pedir(`/v1/condominio/orcamentos/${ORC}/mandar`, { corpo: { versao: 1 }, cookie })).json();
  assertEquals(md.estado, "PEDINDO");
  assertEquals(chamada(m, "plataforma_mandar_orcamento"), { ...QUEM, p_id: ORC, p_versao: 1 });
  await Promise.all(m.fundo);
  assertEquals(quantas(m, "email_pegar_lote"), 1, "mandar o rascunho esvazia a fila do e-mail");

  const re = await m.pedir(`/v1/condominio/orcamentos/${ORC}/convites/${CONVITE}/reenviar`, { metodo: "POST", cookie });
  assertEquals((await re.json()).link.envio, "EMAIL");
  assertEquals(chamada(m, "plataforma_reenviar_convite"), { ...QUEM, p_id: ORC, p_convite: CONVITE });
  assertEquals((await m.pedir(`/v1/condominio/orcamentos/${ORC}/convites/${PRESTADOR}/reenviar`, { metodo: "POST", cookie })).status, 404);
  assertEquals((await erro(await m.pedir(`/v1/condominio/orcamentos/${ORC}/convites/${CONVITE}/revogar`, { corpo: { motivo: "x" }, cookie }))).detalhes?.campos, ["motivo"]);
  await m.pedir(`/v1/condominio/orcamentos/${ORC}/convites/${CONVITE}/revogar`, { corpo: { motivo: "Número errado" }, cookie });
  assertEquals(chamada(m, "plataforma_revogar_convite"), { ...QUEM, p_id: ORC, p_convite: CONVITE, p_motivo: "Número errado" });
  const pc = await (await m.pedir(`/v1/condominio/orcamentos/${ORC}/convites/${CONVITE}/pedir-confirmacao`, { metodo: "POST", cookie })).json();
  assertEquals(pc.link.link, `https://plataforma.exemplo/o/${CODIGO}`, "o pedido de confirmação pelo WhatsApp volta pronto para copiar");
});

Deno.test("OC-06: o prazo, a escolha com quem aprova, o aceite fora do link, a compra, a entrega e o cancelamento", async () => {
  const m = montar({ correio: correioFalso().correio });
  const cookie = await entrar(m);
  const p = (rota: string, corpo: unknown) => m.pedir(`/v1/condominio/orcamentos/${ORC}/${rota}`, { corpo, cookie });
  await p("estender", { versao: 2, prazoPropostas: "2026-11-04T18:00:00-03:00" });
  assertEquals(chamada(m, "plataforma_estender_prazo"), { ...QUEM, p_id: ORC, p_versao: 2, p_prazo: "2026-11-04T18:00:00-03:00" });
  assertEquals((await p("fechar", {})).status, 400, "fechar leva a versão");
  assertEquals((await (await p("fechar", { versao: 3 })).json()).estado, "COMPARANDO");

  assertEquals((await erro(await p("escolher", { versao: 4, propostaId: PROPOSTA }))).detalhes?.campos, ["quemAprova"]);
  const e1 = await (await p("escolher", { versao: 4, propostaId: PROPOSTA, quemAprova: "PESSOA" })).json();
  assertEquals(e1, { versao: 5, estado: "ESCOLHIDA", passaAlcada: true });
  assertEquals(chamada(m, "plataforma_escolher_proposta"), { ...QUEM, p_id: ORC, p_versao: 4, p_proposta: PROPOSTA, p_motivo: null, p_quem_aprova: "PESSOA" });
  await Promise.all(m.fundo);
  assertEquals(quantas(m, "email_pegar_lote"), 0);
  const e2 = await (await p("escolher", { versao: 4, propostaId: PROPOSTA, quemAprova: "CONSELHO", motivo: "Melhor garantia" })).json();
  assertEquals(e2.despesaId, PROPOSTA);
  await Promise.all(m.fundo);
  assertEquals(quantas(m, "email_pegar_lote"), 1, "ao conselho, os links dos membros pelo e-mail saem na hora");
  await p("desfazer-escolha", { versao: 5 });
  assertEquals(chamada(m, "plataforma_desfazer_escolha"), { ...QUEM, p_id: ORC, p_versao: 5 });

  assertEquals((await erro(await p("aceite-fora", { versao: 6, data: "27/11/2026" }))).detalhes?.campos, ["data"]);
  assertEquals((await (await p("aceite-fora", { versao: 6, data: "2026-11-27" })).json()).prestadorId, PRESTADOR);
  assertEquals(chamada(m, "plataforma_aceite_fora_do_link"), { ...QUEM, p_id: ORC, p_versao: 6, p_data: "2026-11-27" });
  assertEquals((await erro(await p("compra", { versao: 7, data: "2026-11-27", valorFechado: 7500.5 }))).detalhes?.campos, ["valorFechado"]);
  await p("compra", { versao: 7, data: "2026-11-27", valorFechado: 750000 });
  assertEquals(chamada(m, "plataforma_registrar_compra"), { ...QUEM, p_id: ORC, p_versao: 7, p_data: "2026-11-27", p_valor: 750000 });
  assertEquals((await (await p("entrega", { versao: 8, data: "2026-11-28", parcial: true, observacao: "Falta instalar" })).json()).estado, "COMPRANDO");
  assertEquals((await (await p("entrega", { versao: 9, data: "2026-11-29" })).json()).estado, "ENTREGUE");
  assertEquals(chamada(m, "plataforma_registrar_entrega"), { ...QUEM, p_id: ORC, p_versao: 9, p_data: "2026-11-29", p_parcial: false, p_obs: null });
  assertEquals((await erro(await p("cancelar", { versao: 10, motivo: "" }))).detalhes?.campos, ["motivo"]);
  assertEquals((await (await p("cancelar", { versao: 10, motivo: "A seguradora cobre" })).json()).estado, "CANCELADO");
});

Deno.test("OC-05: as regras por faixa, em centavos, com só a última sem teto", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/condominio/regras-orcamento", { cookie })).json()).versao, 4);
  const regras = {
    versao: 4, ligada: true, abaixoMinimo: "MOTIVO", prazoDias: 7, validadeDias: 15, linkDias: 30, alcadaConselho: 500000,
    faixas: [{ ate: 500000, minimo: 1, quemAprova: "SINDICO" }, { ate: null, minimo: 3, quemAprova: "CONSELHO" }],
  };
  assertEquals(await (await m.pedir("/v1/condominio/regras-orcamento", { metodo: "PUT", corpo: regras, cookie })).json(), { versao: 5 });
  assertEquals(chamada(m, "plataforma_salvar_regras_orcamento"), {
    ...QUEM, p_versao: 4, p_ligada: true, p_faixas: regras.faixas, p_abaixo_minimo: "MOTIVO", p_prazo_dias: 7, p_validade_dias: 15, p_link_dias: 30,
    p_alcada: 500000,
  });
  const ruim = { ...regras, faixas: [{ ate: null, minimo: 1, quemAprova: "SINDICO" }, { ate: 900000, minimo: 3, quemAprova: "CONSELHO" }] };
  assertEquals((await erro(await m.pedir("/v1/condominio/regras-orcamento", { metodo: "PUT", corpo: ruim, cookie }))).detalhes?.campos, ["faixas"]);
  assertEquals(quantas(m, "plataforma_salvar_regras_orcamento"), 1);
});

Deno.test("OC-01: os anexos do pedido e a nota fiscal passam pela verificação", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/orcamentos/${ORC}/anexos`, { corpo: { parte: "NOTA_FISCAL", nome: "NF 1234.pdf", tipo: "application/pdf", tamanho: 5000 }, cookie });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).envio.url, `https://armazenamento.exemplo/envio/${CAMINHO}?token=t`);
  assertEquals(chamada(m, "plataforma_iniciar_anexo_orcamento"), {
    ...QUEM, p_id: ORC, p_parte: "NOTA_FISCAL", p_nome: "NF 1234.pdf", p_tipo: "application/pdf", p_tamanho: 5000,
  });
  await m.pedir(`/v1/condominio/orcamentos/${ORC}/anexos`, { corpo: { nome: "Foto.png", tipo: "image/png", tamanho: 5000 }, cookie });
  assertEquals(chamada(m, "plataforma_iniciar_anexo_orcamento")?.p_parte, "PEDIDO", "sem a parte, é arquivo do pedido");
  assertEquals((await m.pedir(`/v1/condominio/orcamentos/${ORC}/anexos`, { corpo: { parte: "PROPOSTA", nome: "x.pdf", tipo: "application/pdf", tamanho: 1 }, cookie })).status, 400,
    "o PDF da proposta só pelo link do fornecedor");
  const v = await (await m.pedir(`/v1/condominio/orcamentos/anexos/${ARQUIVO}/verificar`, { metodo: "POST", cookie })).json();
  assertEquals(v.situacao, "NAO_LIBERADO");
  m.guarda.objetos.set(CAMINHO, PDF);
  assertEquals((await (await m.pedir(`/v1/condominio/orcamentos/anexos/${ARQUIVO}/verificar`, { metodo: "POST", cookie })).json()).situacao, "LIBERADO");
  assertEquals(chamada(m, "plataforma_verificar_anexo_orcamento"), { ...QUEM, p_arquivo: ARQUIVO, p_liberado: true, p_tamanho: PDF.length, p_motivo: null });
  const l = await (await m.pedir(`/v1/condominio/orcamentos/anexos/${ARQUIVO}/link?baixar=1`, { cookie })).json();
  assertStringIncludes(l.url, "download=NF 1234.pdf");
  assertEquals((await m.pedir(`/v1/condominio/orcamentos/anexos/${ARQUIVO}/tirar`, { corpo: { motivo: "Nota errada" }, cookie })).status, 200);
});

Deno.test("OC-03: o link do fornecedor, sem conta: abrir, recusar, mandar a proposta, confirmar e aceitar", async () => {
  const m = montar();
  const base = `/v1/publico/orcamento/${CODIGO}`;
  assertEquals(await (await m.pedir(base)).json(), { condominio: "Residencial Aurora", estado: "VER" });
  assertEquals(chamada(m, "publico_orcamento"), { p_codigo: CODIGO });
  assertEquals(chamada(m, "limite_contar")?.p_tipo, "link");
  assertEquals((await m.pedir("/v1/publico/orcamento/curto")).status, 404);
  await m.pedir(`${base}/recusar`, { corpo: {} });
  assertEquals(chamada(m, "publico_recusar_orcamento"), { p_codigo: CODIGO, p_motivo: null });
  const proposta = {
    valor: 800000, freteIncluso: false, frete: 20000, prazoExecucao: "7 dias", validaAte: "2026-11-30", inclui: "Bomba e instalação", garantia: "6 meses",
  };
  assertEquals((await erro(await m.pedir(`${base}/proposta`, { corpo: { ...proposta, inclui: "" } }))).detalhes?.campos, ["inclui"]);
  assertEquals(await (await m.pedir(`${base}/proposta`, { corpo: proposta })).json(), { estado: "ENVIADA", numero: 1 });
  assertEquals(chamada(m, "publico_enviar_proposta"), {
    p_codigo: CODIGO, p_valor: 800000, p_frete_incluso: false, p_frete: 20000, p_marca_modelo: null, p_prazo_execucao: "7 dias", p_garantia: "6 meses",
    p_valida_ate: "2026-11-30", p_pagamento: null, p_inclui: "Bomba e instalação", p_nao_inclui: null, p_pdf: null,
  });
  await m.pedir(`${base}/proposta`, { corpo: { ...proposta, freteIncluso: true } });
  assertEquals(chamada(m, "publico_enviar_proposta")?.p_frete, 0, "frete incluso conta zero");
  await m.pedir(`${base}/confirmar-preco`, { corpo: { validaAte: "2026-12-15" } });
  assertEquals(chamada(m, "publico_confirmar_preco"), { p_codigo: CODIGO, p_valida_ate: "2026-12-15" });
  assertEquals((await erro(await m.pedir(`${base}/aceitar`, { corpo: { nome: "M" } }))).detalhes?.campos, ["nome"]);
  assertEquals(await (await m.pedir(`${base}/aceitar`, { corpo: { nome: "Marcos, da HidroPress" } })).json(), { estado: "ACEITA" });
});

Deno.test("OC-04: o PDF da proposta pelo link, verificado antes de valer, e o limite por aparelho", async () => {
  const m = montar({ link: 6 });
  const base = `/v1/publico/orcamento/${CODIGO}`;
  const r = await m.pedir(`${base}/pdf`, { corpo: { nome: "Proposta.pdf", tipo: "application/pdf", tamanho: 3000 } });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "publico_iniciar_pdf_orcamento"), { p_codigo: CODIGO, p_nome: "Proposta.pdf", p_tipo: "application/pdf", p_tamanho: 3000 });
  m.guarda.objetos.set(CAMINHO, PDF);
  assertEquals((await (await m.pedir(`${base}/pdf/${ARQUIVO}/verificar`, { metodo: "POST" })).json()).situacao, "LIBERADO");
  assertEquals(chamada(m, "publico_verificar_pdf_orcamento"), { p_codigo: CODIGO, p_arquivo: ARQUIVO, p_liberado: true, p_tamanho: PDF.length, p_motivo: null });
  const a = await (await m.pedir(`${base}/arquivos/${ARQUIVO}`)).json();
  assertEquals(a.url, `https://armazenamento.exemplo/ler/${CAMINHO}?token=t`);
  await m.pedir(base);
  await m.pedir(base);
  await m.pedir(base);
  assertEquals((await m.pedir(base)).status, 429, "o limite do aparelho vale para tudo do link");
});

Deno.test("OC-03: o e-mail do convite, da confirmação do preço e da escolhida", () => {
  const e = montarEmail(MSG, END);
  assertEquals(e.assunto, "[Residencial Aurora] Pedido de orçamento: Troca da bomba do poço");
  assertStringIncludes(e.texto, "Bruna, Zeladora do Residencial Aurora, pede um orçamento para: Troca da bomba do poço (Casa de bombas)");
  assertStringIncludes(e.texto, `https://plataforma.exemplo/o/${CODIGO}`);
  assertStringIncludes(e.html, "Ver o pedido e mandar a proposta");
  const conf = montarEmail({ ...MSG, orcamento: { ...MSG.orcamento!, finalidade: "CONFIRMAR_PRECO", validaAte: "05/11/2026" } }, END);
  assertEquals(conf.assunto, "[Residencial Aurora] Confirme o preço: Troca da bomba do poço");
  assertStringIncludes(conf.texto, "valia até 05/11/2026");
  const esc = montarEmail({ ...MSG, orcamento: { ...MSG.orcamento!, finalidade: "ESCOLHIDA", total: "R$ 7.600,00" } }, END);
  assertStringIncludes(esc.texto, "de R$ 7.600,00, foi a escolhida");
  assert(!esc.texto.includes("Bombas Silva concorre"), "o e-mail nunca cita os outros convidados");
});
