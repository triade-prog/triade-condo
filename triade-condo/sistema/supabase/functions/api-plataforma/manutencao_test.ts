// Manutenção e prestadores (peça R6) na Plataforma do síndico. As rotas validam a entrada, mandam
// ao banco a pessoa e o condomínio da sessão e deixam a permissão, as situações e as preventivas
// para o banco. As fotos da manutenção ficam no armazenamento próprio dela.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const VINCULO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const PEDIDO = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const MANUTENCAO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const PRESTADOR = "7a8b9c0d-1e2f-4a3b-8c4d-e5f6a7b8c9d0";
const PRIORIDADE = "8b9c0d1e-2f3a-4b4c-9d5e-f6a7b8c9d0e1";
const ARQUIVO = "9c0d1e2f-3a4b-4c5d-8e6f-a7b8c9d0e1f2";
const ITEM = "0d1e2f3a-4b5c-4d6e-9f7a-b8c9d0e1f2a3";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const CAMINHO = `${AURORA}/${MANUTENCAO}/${ARQUIVO}`;
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
    plataforma_manutencao_opcoes: () => ({ pessoas: [], prestadores: [], hoje: "2026-10-17" }),
    plataforma_manutencoes: () => ({ itens: [], total: 0, pagina: 1, atalhos: {} }),
    plataforma_manutencao: (a) => ({ manutencao: { id: a.p_id } }),
    plataforma_registrar_manutencao: () => ({ id: MANUTENCAO }),
    plataforma_alterar_manutencao: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_situacao_manutencao: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_concluir_manutencao: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_incluir_providencia: (a) => ({ id: ITEM, versao: Number(a.p_versao) + 1 }),
    plataforma_responder_item: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_prestadores: () => ({ itens: [] }),
    plataforma_salvar_prestador: () => ({ id: PRESTADOR, versao: 1 }),
    plataforma_salvar_preventiva: () => ({ id: PRESTADOR, versao: 1, abertas: 0 }),
    plataforma_marcar_visita_manutencao: () => ({ id: ITEM, datas: 1, conflitos: [] }),
    plataforma_iniciar_arquivo_manutencao: () => ({ arquivoId: ARQUIVO, caminho: CAMINHO, tipo: "image/jpeg" }),
    plataforma_arquivo_manutencao_a_verificar: () => ({ caminho: CAMINHO, tipo: "image/jpeg" }),
    plataforma_verificar_arquivo_manutencao: (a) => ({ situacao: a.p_liberado ? "LIBERADO" : "NAO_LIBERADO" }),
  });
  const pedidos = armazenamentoFalso();
  const manutencao = armazenamentoFalso();
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: pedidos.armazenamento, armazenamentoManutencao: manutencao.armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), pedidos, manutencao, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}

const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.find((c) => c.funcao === funcao)?.args;

Deno.test("MP-01: a lista só com sessão, com os filtros conferidos", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/manutencao"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/manutencao?situacao=PENDENTE&atencao=RETORNO_VENCIDO", { cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_manutencoes"), {
    p_pessoa: ANA, p_condominio: AURORA, p_situacao: "PENDENTE", p_tipo: null, p_prestador: null, p_atencao: "RETORNO_VENCIDO",
    p_busca: null, p_pagina: 1,
  });
  const r = await m.pedir("/v1/condominio/manutencao?situacao=QUALQUER", { cookie });
  assertEquals((await erro(r)).detalhes?.campos, ["situacao"]);
  assertEquals((await m.pedir(`/v1/condominio/manutencao/${MANUTENCAO}`, { cookie })).status, 200);
  assertEquals((await m.pedir("/v1/condominio/manutencao/x", { cookie })).status, 404);
  assertEquals((await (await m.pedir("/v1/condominio/manutencao/opcoes", { cookie })).json()).hoje, "2026-10-17");
});

Deno.test("MP-01, MP-07: registrar, com quem executa e a lista da vistoria", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = {
    tipo: "VISTORIA", titulo: "Vistoria da fachada", local: " Fachada e calhas ", prioridadeId: PRIORIDADE, responsavelId: VINCULO,
    executorTexto: "Carlos", detalhes: "", pedidoId: PEDIDO, itens: ["Calhas", "Trincas"],
  };
  const r = await m.pedir("/v1/condominio/manutencao", { corpo, cookie });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_registrar_manutencao"), {
    p_pessoa: ANA, p_condominio: AURORA, p_tipo: "VISTORIA", p_titulo: "Vistoria da fachada", p_local: "Fachada e calhas",
    p_detalhes: null, p_prioridade: PRIORIDADE, p_responsavel: VINCULO, p_prestador: null, p_executor_vinculo: null,
    p_executor_texto: "Carlos", p_proximo_retorno: null, p_previsao: null, p_pedido: PEDIDO, p_itens: ["Calhas", "Trincas"],
  });
  m.chamadas.length = 0;
  const ruim = await m.pedir("/v1/condominio/manutencao", { corpo: { ...corpo, prestadorId: PRESTADOR }, cookie });
  assertEquals((await erro(ruim)).detalhes?.campos, ["executor"]);
  assertEquals(chamada(m, "plataforma_registrar_manutencao"), undefined);
});

Deno.test("MP-02: situação, concluir e providências levam a versão lida", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const base = `/v1/condominio/manutencao/${MANUTENCAO}`;
  const sit = await m.pedir(`${base}/situacao`, { corpo: { versao: 2, estado: "PENDENTE", pendenciaTipo: "PECA", pendenciaMotivo: "Rolamento" }, cookie });
  assertEquals(await sit.json(), { versao: 3 });
  assertEquals(chamada(m, "plataforma_situacao_manutencao"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: MANUTENCAO, p_versao: 2, p_estado: "PENDENTE", p_etapa: null,
    p_pendencia_tipo: "PECA", p_pendencia_motivo: "Rolamento",
  });
  assertEquals((await erro(await m.pedir(`${base}/situacao`, { corpo: { versao: 2, estado: "PENDENTE" }, cookie }))).detalhes?.campos,
    ["pendenciaTipo", "pendenciaMotivo"]);
  await m.pedir(`${base}/concluir`, { corpo: { versao: 3, conclusao: "Rolamento trocado e testado", realizadaEm: "2026-10-17", fecharProvidencias: true }, cookie });
  assertEquals(chamada(m, "plataforma_concluir_manutencao")?.p_fechar_providencias, true);
  await m.pedir(`${base}/providencias`, { corpo: { versao: 4, texto: "Trocar o rolamento", prestadorId: PRESTADOR }, cookie });
  assertEquals(chamada(m, "plataforma_incluir_providencia")?.p_prestador, PRESTADOR);
  await m.pedir(`${base}/itens/${ITEM}/responder`, { corpo: { versao: 5, resultado: "PROBLEMA", observacao: "Trinca de 40 cm" }, cookie });
  assertEquals(chamada(m, "plataforma_responder_item")?.p_item, ITEM);
});

Deno.test("MP-05, MP-03: prestador com telefone +55 e preventiva com a versão ao mudar", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = { nome: "HidroPress", servico: "Bombas", telefone: "(13) 99812-4455", acordo: "CHAMADO", reservaId: PRESTADOR };
  assertEquals((await m.pedir("/v1/condominio/manutencao/prestadores", { corpo, cookie })).status, 201);
  const p = chamada(m, "plataforma_salvar_prestador");
  assertEquals([p?.p_id, p?.p_telefone, p?.p_reserva, p?.p_contrato_ate], [null, "+5513998124455", PRESTADOR, null]);
  const sem = await m.pedir(`/v1/condominio/manutencao/prestadores/${PRESTADOR}`, { metodo: "PUT", corpo, cookie });
  assertEquals((await erro(sem)).detalhes?.campos, ["versao"]);
  const prev = { atividade: "Recarga dos extintores", local: "Todos os andares", unidadeTempo: "ANO", intervalo: 1, proximaData: "2027-10-02",
    responsavelId: VINCULO };
  assertEquals((await m.pedir("/v1/condominio/manutencao/preventivas", { corpo: prev, cookie })).status, 201);
  assertEquals(chamada(m, "plataforma_salvar_preventiva")?.p_antecedencia, 15);
  const longe = await m.pedir("/v1/condominio/manutencao/preventivas", { corpo: { ...prev, unidadeTempo: "SEMANA", intervalo: 60 }, cookie });
  assertEquals((await erro(longe)).detalhes?.campos, ["intervalo"]);
});

Deno.test("MP-04: a visita nasce ligada à manutenção, sem repetição", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = { tipo: "VISITA", titulo: "Visita: HidroPress", data: "2026-10-20", horaInicio: "14:00", onde: "OUTRO", local: "Casa de bombas", deFora: "HidroPress" };
  assertEquals((await m.pedir(`/v1/condominio/manutencao/${MANUTENCAO}/visita`, { corpo, cookie })).status, 201);
  const v = chamada(m, "plataforma_marcar_visita_manutencao");
  assertEquals([v?.p_manutencao, v?.p_de_fora, v?.p_local], [MANUTENCAO, "HidroPress", "Casa de bombas"]);
  const r = await m.pedir(`/v1/condominio/manutencao/${MANUTENCAO}/visita`, { corpo: { ...corpo, repetir: "SEMANAL", vezes: 3 }, cookie });
  assertEquals((await erro(r)).detalhes?.campos, ["repetir"]);
});

Deno.test("MP-07, PT-07: a foto da manutenção vai para o armazenamento dela e é conferida antes de liberar", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/manutencao/${MANUTENCAO}/arquivos`, {
    corpo: { itemId: ITEM, nome: "calha.jpg", tipo: "image/jpeg", tamanho: JPG.length }, cookie,
  });
  assertEquals(r.status, 201);
  assertEquals((await r.json()).envio.url, `https://armazenamento.exemplo/envio/${CAMINHO}?token=t`);
  assertEquals(chamada(m, "plataforma_iniciar_arquivo_manutencao")?.p_item, ITEM);
  m.manutencao.objetos.set(CAMINHO, JPG);
  const v = await m.pedir(`/v1/condominio/manutencao/${MANUTENCAO}/arquivos/${ARQUIVO}/verificar`, { corpo: {}, cookie });
  assertEquals((await v.json()).situacao, "LIBERADO");
  assertEquals(m.pedidos.objetos.size, 0);
});
