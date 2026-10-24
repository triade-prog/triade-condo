// Planos e pagamentos no Console (0291; peças C3 e C4; PI-03, PI-07, PI-08, CF-11, NG-01): as
// rotas validam a entrada e levam a pessoa e o cliente da rota; quem pode, o que se libera e o
// que conta como pago são decididos no banco.
import { assertEquals } from "@std/assert";
import { criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const COBRANCA = "4f1a7d42-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const RECEBIMENTO = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };

function montar() {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    console_plano: () => ({ conjuntos: [], unidadesAtivas: 0, permissoes: [] }),
    console_salvar_plano_tabela: (a) => ({ nome: a.p_nome, versao: 1 }),
    console_contratar_conjunto: () => ({ codigo: "AGENDA", contratado: true }),
    console_liberar_conjunto: () => erroBanco("TC422", { motivo: "NAO_CONTRATADO" }),
    console_testar_conjunto: () => ({ codigo: "VIDA", estado: "TESTE" }),
    console_suspender_conjunto: () => ({ codigo: "VIDA", estado: "SUSPENSO" }),
    console_pagamentos: () => ({ cobrancas: [], aConferir: [], naoIdentificados: [], podeRegistrar: true }),
    console_abrir_competencia: () => ({ criadas: 3, jaAbertas: 0, semPlano: 1 }),
    console_registrar_recebimento: () => ({ id: RECEBIMENTO }),
    console_identificar_recebimento: () => ({ id: RECEBIMENTO }),
    console_conferir_recebimento: () => erroBanco("TC422", { motivo: "JA_CONFIRMADO" }),
    console_devolver_recebimento: () => ({ recebimento: { estado: "DEVOLVIDO" } }),
    console_cobranca: () => ({ id: COBRANCA, situacao: "ABERTA" }),
    console_ajustar_cobranca: () => ({ id: COBRANCA, situacao: "QUITADA" }),
    console_definir_valor_cobranca: () => ({ id: COBRANCA, devido: 12900 }),
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
  });
  return { pedir: pedido(app, "api-console"), ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;
const base = `/v1/clientes/${IPE}`;
const plano = {
  nome: "Fundador", unidadesDe: 1, unidadesAte: 40, valor: null, ciclo: "MENSAL", diaVencimento: 10,
  implantacaoValor: null, implantacaoSemCobranca: true, inicioCompetencia: "2026-11-01",
};

Deno.test("PI-07: plano e pagamentos pedem a sessão completa", async () => {
  const m = montar();
  for (const rota of [`${base}/plano`, "/v1/pagamentos", `${base}/cobrancas/${COBRANCA}`]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
});

Deno.test("NG-01: o plano aceita valor vazio (a definir) e faixa de unidades; nunca valor zero", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir(`${base}/plano`, { cookie })).status, 200);
  assertEquals(chamada(m, "console_plano"), { p_pessoa: CAROLINA, p_condominio: IPE });
  assertEquals((await m.pedir(`${base}/plano`, { cookie, metodo: "PUT", corpo: plano })).status, 200);
  assertEquals(chamada(m, "console_salvar_plano_tabela"), {
    p_pessoa: CAROLINA, p_condominio: IPE, p_versao: null, p_nome: "Fundador", p_unidades_de: 1, p_unidades_ate: 40, p_valor: null,
    p_ciclo: "MENSAL", p_dia_vencimento: 10, p_implantacao_valor: null, p_implantacao_sem_cobranca: true, p_implantacao_referencia: null,
    p_inicio_competencia: "2026-11-01", p_tabela: null,
  });
  for (const ruim of [{ valor: 0 }, { valor: 129.9 }, { unidadesDe: 50 }, { diaVencimento: 31 }, { ciclo: "SEMANAL" }]) {
    assertEquals((await erro(await m.pedir(`${base}/plano`, { cookie, metodo: "PUT", corpo: { ...plano, ...ruim } }))).codigo, "VALIDATION_ERROR",
      JSON.stringify(ruim));
  }
});

Deno.test("CF-11, PI-03: contratar e liberar são rotas separadas; a base não tem rota", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir(`${base}/conjuntos/AGENDA/contrato`, { cookie, metodo: "PUT", corpo: { versao: 1, contratado: true, referencia: "Aditivo 2" } });
  assertEquals(chamada(m, "console_contratar_conjunto"), {
    p_pessoa: CAROLINA, p_condominio: IPE, p_conjunto: "AGENDA", p_versao: 1, p_contratado: true, p_referencia: "Aditivo 2", p_motivo: null,
  });
  const semRef = await erro(await m.pedir(`${base}/conjuntos/AGENDA/contrato`, { cookie, metodo: "PUT", corpo: { versao: 1, contratado: true } }));
  assertEquals(semRef.detalhes?.campos, ["referencia"]);
  const nao = await erro(await m.pedir(`${base}/conjuntos/AGENDA/liberar`, { cookie, corpo: { versao: 2, referencia: "Aditivo 2", motivo: "Começo" } }));
  assertEquals([nao.codigo, nao.detalhes?.motivo], ["VALIDATION_ERROR", "NAO_CONTRATADO"]);
  assertEquals((await m.pedir(`${base}/conjuntos/ATENDIMENTO/liberar`, { cookie, corpo: { versao: 1, referencia: "X", motivo: "Começo" } })).status, 404);
  await m.pedir(`${base}/conjuntos/VIDA/teste`, { cookie, corpo: { versao: 1, ate: "2026-11-10", motivo: "Mostrar ao conselho" } });
  assertEquals(chamada(m, "console_testar_conjunto"), { p_pessoa: CAROLINA, p_condominio: IPE, p_conjunto: "VIDA", p_versao: 1, p_ate: "2026-11-10", p_motivo: "Mostrar ao conselho" });
  const sem = await erro(await m.pedir(`${base}/conjuntos/VIDA/suspender`, { cookie, corpo: { versao: 2, porque: "CALOTE", motivo: "Não pagou" } }));
  assertEquals(sem.detalhes?.campos, ["porque"]);
  assertEquals((await m.pedir(`${base}/conjuntos/VIDA/suspender`, { cookie, corpo: { versao: 2, porque: "PEDIDO_CLIENTE", motivo: "Pedido do síndico" } })).status, 200);
});

Deno.test("PI-07: competência, recebimento a conferir, conferência e ajuste com motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir("/v1/pagamentos/competencias", { cookie, corpo: { competencia: "2026-11" } });
  assertEquals(chamada(m, "console_abrir_competencia"), { p_pessoa: CAROLINA, p_competencia: "2026-11-01" });
  const receb = { condominioId: IPE, cobrancaId: COBRANCA, valor: 12900, recebidoEm: "2026-11-08", forma: "PIX", referencia: "E1234-ABC" };
  assertEquals((await m.pedir("/v1/pagamentos/recebimentos", { cookie, corpo: receb })).status, 201);
  assertEquals(chamada(m, "console_registrar_recebimento"), {
    p_pessoa: CAROLINA, p_condominio: IPE, p_cobranca: COBRANCA, p_valor: 12900, p_recebido_em: "2026-11-08", p_forma: "PIX", p_referencia: "E1234-ABC",
  });
  assertEquals((await erro(await m.pedir("/v1/pagamentos/recebimentos", { cookie, corpo: { ...receb, cobrancaId: null } }))).detalhes?.campos, ["cobrancaId"]);
  await m.pedir("/v1/pagamentos/recebimentos", { cookie, corpo: { ...receb, condominioId: null, cobrancaId: null } });
  assertEquals(chamada(m, "console_registrar_recebimento")?.p_condominio, null);
  await m.pedir(`/v1/pagamentos/nao-identificados/${RECEBIMENTO}/identificar`, { cookie, corpo: { condominioId: IPE, cobrancaId: COBRANCA } });
  assertEquals(chamada(m, "console_identificar_recebimento"), { p_pessoa: CAROLINA, p_avulso: RECEBIMENTO, p_condominio: IPE, p_cobranca: COBRANCA });
  const ja = await erro(await m.pedir(`${base}/recebimentos/${RECEBIMENTO}/conferir`, { cookie, corpo: { versao: 2 } }));
  assertEquals(ja.detalhes?.motivo, "JA_CONFIRMADO");
  assertEquals((await erro(await m.pedir(`${base}/recebimentos/${RECEBIMENTO}/devolver`, { cookie, corpo: { versao: 1, motivo: "" } }))).codigo,
    "VALIDATION_ERROR");
  assertEquals((await m.pedir(`${base}/cobrancas/${COBRANCA}/ajustes`, { cookie, corpo: { tipo: "DESCONTO", valor: 900, motivo: "Arredondamento" } })).status, 201);
  assertEquals((await erro(await m.pedir(`${base}/cobrancas/${COBRANCA}/ajustes`, { cookie, corpo: { tipo: "DESCONTO", valor: -900, motivo: "X" } }))).codigo,
    "VALIDATION_ERROR");
  await m.pedir(`${base}/cobrancas/${COBRANCA}/valor`, { cookie, metodo: "PUT", corpo: { valor: 12900, motivo: "Preço de fundador" } });
  assertEquals(chamada(m, "console_definir_valor_cobranca"), { p_pessoa: CAROLINA, p_condominio: IPE, p_id: COBRANCA, p_valor: 12900, p_motivo: "Preço de fundador" });
});
