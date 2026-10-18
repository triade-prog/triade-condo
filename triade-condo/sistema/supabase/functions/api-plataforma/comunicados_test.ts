// Comunicados e documentos (peça R1) na Plataforma do síndico. As rotas validam a entrada, mandam
// ao banco a pessoa e o condomínio da sessão e deixam permissão, público e versões para o banco.
// As fotos dos comunicados e os documentos ficam cada um no seu armazenamento.
import { assert, assertEquals } from "@std/assert";
import { ASSUNTOS_COMUNICADO, PUBLICOS_COMUNICADO, SITUACOES_COMUNICADO, TIPOS_DOCUMENTO } from "@triade/domain";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const BLOCO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const PEDIDO = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const COMUNICADO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const DOCUMENTO = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const VERSAO = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const ARQUIVO = "9c0d1e2f-3a4b-4c5d-8e6f-a7b8c9d0e1f2";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const CAMINHO_FOTO = `${AURORA}/${COMUNICADO}/${ARQUIVO}`;
const CAMINHO_DOC = `${AURORA}/${DOCUMENTO}/${VERSAO}`;
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);

function montar() {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: AURORA, nome: "Residencial Aurora", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), AURORA);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    plataforma_comunicado_opcoes: () => ({ assuntos: ["AVISO"], blocos: [] }),
    plataforma_publico_comunicado: () => ({ contatos: 3, unidades: 2, semNinguem: [] }),
    plataforma_comunicados: () => ({ itens: [], total: 0, pagina: 1, atalhos: {} }),
    plataforma_comunicado: (a) => ({ comunicado: { id: a.p_id } }),
    plataforma_salvar_comunicado: () => ({ id: COMUNICADO, versao: 1 }),
    plataforma_corrigir_comunicado: () => ({ id: ARQUIVO, versao: 1 }),
    plataforma_arquivar_comunicado: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_uso_comunicado: () => ({ ok: true }),
    plataforma_comunicados_ligados: () => ({ podeVer: true, comunicados: [] }),
    plataforma_plano_comunicacao: () => ({ assuntos: ["AVISO"], versao: 3 }),
    plataforma_definir_plano_comunicacao: (a) => Number(a.p_versao) + 1,
    plataforma_iniciar_arquivo_comunicado: () => ({ arquivoId: ARQUIVO, caminho: CAMINHO_FOTO, tipo: "image/jpeg" }),
    plataforma_arquivo_comunicado_a_verificar: () => ({ caminho: CAMINHO_FOTO, tipo: "image/jpeg" }),
    plataforma_verificar_arquivo_comunicado: (a) => ({ situacao: a.p_liberado ? "LIBERADO" : "NAO_LIBERADO" }),
    plataforma_documentos: () => ({ itens: [], total: 0 }),
    plataforma_salvar_documento: () => ({ id: DOCUMENTO, versao: 1 }),
    plataforma_iniciar_versao_documento: () => ({ versaoId: VERSAO, caminho: CAMINHO_DOC, tipo: "application/pdf" }),
    plataforma_versao_documento_a_verificar: () => ({ caminho: CAMINHO_DOC, tipo: "application/pdf" }),
    plataforma_verificar_versao_documento: (a) => ({ situacao: a.p_liberado ? "LIBERADO" : "NAO_LIBERADO" }),
    plataforma_abrir_versao_documento: () => ({ caminho: CAMINHO_DOC, nome: "regimento.pdf", tipo: "application/pdf" }),
  });
  const pedidos = armazenamentoFalso();
  const comunicados = armazenamentoFalso();
  const documentos = armazenamentoFalso();
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: pedidos.armazenamento, armazenamentoComunicados: comunicados.armazenamento,
    armazenamentoDocumentos: documentos.armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), pedidos, comunicados, documentos, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}

const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.find((c) => c.funcao === funcao)?.args;
const BASE = { assunto: "OBRAS", titulo: "Falta de água na quinta", texto: "Das 9h às 13h.", publico: "BLOCOS", blocos: [BLOCO] };

Deno.test("CD-01: a lista só com sessão, com os filtros conferidos", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/comunicados"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/comunicados?filtro=RASCUNHO&atencao=RASCUNHOS_PARADOS", { cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_comunicados"), {
    p_pessoa: ANA, p_condominio: AURORA, p_filtro: "RASCUNHO", p_assunto: null, p_atencao: "RASCUNHOS_PARADOS", p_busca: null, p_pagina: 1,
  });
  assertEquals((await erro(await m.pedir("/v1/condominio/comunicados?filtro=QUALQUER", { cookie }))).detalhes?.campos, ["filtro"]);
  assertEquals((await m.pedir(`/v1/condominio/comunicados/${COMUNICADO}`, { cookie })).status, 200);
  assertEquals((await m.pedir("/v1/condominio/comunicados/x", { cookie })).status, 404);
  assertEquals((await (await m.pedir("/v1/condominio/comunicados/opcoes", { cookie })).json()).assuntos, ["AVISO"]);
});

Deno.test("CD-01, CD-02, CD-06: escrever leva o público, a ação e a versão ao mudar", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/comunicados", { corpo: { ...BASE, acao: "PUBLICAR", pedidoId: PEDIDO }, cookie });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_salvar_comunicado"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: null, p_versao: null, p_assunto: "OBRAS", p_titulo: "Falta de água na quinta",
    p_texto: "Das 9h às 13h.", p_publico: "BLOCOS", p_blocos: [BLOCO], p_unidades: [], p_contatos: [], p_pedido: PEDIDO,
    p_manutencao: null, p_acao: "PUBLICAR", p_programado_para: null,
  });
  m.chamadas.length = 0;
  const sem = await m.pedir("/v1/condominio/comunicados", { corpo: { ...BASE, blocos: [], acao: "RASCUNHO" }, cookie });
  assertEquals((await erro(sem)).detalhes?.campos, ["blocos"]);
  const prog = await m.pedir("/v1/condominio/comunicados", { corpo: { ...BASE, acao: "PROGRAMAR" }, cookie });
  assertEquals((await erro(prog)).detalhes?.campos, ["programadoPara"]);
  assertEquals(chamada(m, "plataforma_salvar_comunicado"), undefined);
  const mudar = await m.pedir(`/v1/condominio/comunicados/${COMUNICADO}`, { metodo: "PUT", corpo: { ...BASE, acao: "RASCUNHO" }, cookie });
  assertEquals((await erro(mudar)).detalhes?.campos, ["versao"]);
  await m.pedir(`/v1/condominio/comunicados/${COMUNICADO}`, { metodo: "PUT", corpo: { ...BASE, versao: 2, acao: "RASCUNHO" }, cookie });
  assertEquals(chamada(m, "plataforma_salvar_comunicado")?.p_versao, 2);
});

Deno.test("CD-02: quem recebe é calculado no banco antes de publicar", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/comunicados/publico", { corpo: { assunto: "ASSEMBLEIA", publico: "TODOS" }, cookie });
  assertEquals((await r.json()).contatos, 3);
  assertEquals(chamada(m, "plataforma_publico_comunicado")?.p_assunto, "ASSEMBLEIA");
});

Deno.test("CD-01: corrigir pede o que mudou; arquivar pede motivo; copiar fica registrado", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const base = `/v1/condominio/comunicados/${COMUNICADO}`;
  const sem = await m.pedir(`${base}/corrigir`, { corpo: { versao: 1, titulo: "Falta de água", texto: "Das 9h às 13h." }, cookie });
  assertEquals((await erro(sem)).detalhes?.campos, ["mudanca"]);
  const c = await m.pedir(`${base}/corrigir`, { corpo: { versao: 1, titulo: "Falta de água", texto: "Das 9h às 13h.", mudanca: "Horário" }, cookie });
  assertEquals(c.status, 201);
  assertEquals(chamada(m, "plataforma_corrigir_comunicado")?.p_mudanca, "Horário");
  assertEquals((await erro(await m.pedir(`${base}/arquivar`, { corpo: { versao: 2 }, cookie }))).detalhes?.campos, ["motivo"]);
  await m.pedir(`${base}/uso`, { corpo: { uso: "MURAL" }, cookie });
  assertEquals(chamada(m, "plataforma_uso_comunicado")?.p_uso, "MURAL");
  await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/comunicados`, { cookie });
  assertEquals(chamada(m, "plataforma_comunicados_ligados"), { p_pessoa: ANA, p_condominio: AURORA, p_pedido: PEDIDO, p_manutencao: null });
});

Deno.test("CD-11: o plano de comunicação leva a versão e o horário sem envio", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = { versao: 3, assuntos: ["AVISO", "OBRAS"], plano: "", assinatura: "Ana, síndica", silencioInicio: "21:00", silencioFim: "08:00" };
  assertEquals(await (await m.pedir("/v1/condominio/plano-comunicacao", { metodo: "PUT", corpo, cookie })).json(), { versao: 4 });
  const p = chamada(m, "plataforma_definir_plano_comunicacao");
  assertEquals([p?.p_plano, p?.p_silencio_inicio], [null, "21:00"]);
  const ruim = await m.pedir("/v1/condominio/plano-comunicacao", { metodo: "PUT", corpo: { ...corpo, assuntos: [] }, cookie });
  assertEquals((await erro(ruim)).detalhes?.campos, ["assuntos"]);
});

Deno.test("CD-09, PT-07: a foto do comunicado vai para o armazenamento dele e é conferida antes de liberar", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/comunicados/${COMUNICADO}/arquivos`, {
    corpo: { nome: "aviso.jpg", tipo: "image/jpeg", tamanho: JPG.length }, cookie,
  });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).envio.url, `https://armazenamento.exemplo/envio/${CAMINHO_FOTO}?token=t`);
  m.comunicados.objetos.set(CAMINHO_FOTO, JPG);
  const v = await m.pedir(`/v1/condominio/comunicados/${COMUNICADO}/arquivos/${ARQUIVO}/verificar`, { corpo: {}, cookie });
  assertEquals((await v.json()).situacao, "LIBERADO");
  assertEquals(m.pedidos.objetos.size, 0);
});

Deno.test("CD-04, CD-07: documento restrito não vai ao morador; a versão é conferida e o link vale 5 minutos", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const ruim = await m.pedir("/v1/condominio/documentos", { corpo: { tipo: "CONTRATO", titulo: "Contrato do elevador", restrito: true, aoMorador: true }, cookie });
  assertEquals((await erro(ruim)).detalhes?.campos, ["aoMorador"]);
  assertEquals((await m.pedir("/v1/condominio/documentos", { corpo: { tipo: "REGIMENTO", titulo: "Regimento interno", aoMorador: true }, cookie })).status, 201);
  assertEquals(chamada(m, "plataforma_salvar_documento")?.p_ao_morador, true);
  const sem = await m.pedir(`/v1/condominio/documentos/${DOCUMENTO}/versoes`, { corpo: { nome: "regimento.pdf", tipo: "application/pdf", tamanho: 10 }, cookie });
  assertEquals((await erro(sem)).detalhes?.campos, ["vigenteDesde"]);
  const r = await m.pedir(`/v1/condominio/documentos/${DOCUMENTO}/versoes`, {
    corpo: { nome: "regimento.pdf", tipo: "application/pdf", tamanho: 10, vigenteDesde: "2026-11-01", mudanca: "Carregadores" }, cookie,
  });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_iniciar_versao_documento")?.p_vigente_desde, "2026-11-01");
  m.documentos.objetos.set(CAMINHO_DOC, new TextEncoder().encode("não é pdf"));
  const v = await (await m.pedir(`/v1/condominio/documentos/${DOCUMENTO}/versoes/${VERSAO}/verificar`, { corpo: {}, cookie })).json();
  assertEquals(v.situacao, "NAO_LIBERADO");
  assertEquals(m.documentos.apagados, [CAMINHO_DOC]);
  const l = await (await m.pedir(`/v1/condominio/documentos/${DOCUMENTO}/versoes/${VERSAO}/link?baixar=1`, { cookie })).json();
  assertEquals(l.url, `https://armazenamento.exemplo/ler/${CAMINHO_DOC}?token=t&download=regimento.pdf`);
  assertEquals(chamada(m, "plataforma_abrir_versao_documento")?.p_baixar, true);
  assertEquals(m.documentos.links[0]?.segundos, 300);
});

Deno.test("as listas dos comunicados e documentos são as mesmas do banco", async () => {
  const migration = await Deno.readTextFile(new URL("../../migrations/0150_comunicados_documentos.sql", import.meta.url));
  const listas = [ASSUNTOS_COMUNICADO, SITUACOES_COMUNICADO, PUBLICOS_COMUNICADO, TIPOS_DOCUMENTO];
  for (const k of listas.flatMap((l) => Object.keys(l))) assert(migration.includes(`'${k}'`), k);
});
