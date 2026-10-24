// Tabela de preços no Console (0295): as rotas validam a entrada (valor vazio, nunca zero; motivo
// em toda escrita) e levam a pessoa da sessão; quem vê e quem edita, as vagas de fundador e a
// sugestão do plano são decididos no banco.
import { assertEquals } from "@std/assert";
import { criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const CONCORRENTE = "6c7d8e9f-0a1b-4c2d-8e3f-4a5b6c7d8e9f";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };

function montar() {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    console_tabela_precos: () => ({ faixas: [], parametros: { tabelaEmUso: "FUNDADOR" }, vagasFundador: { total: 5, ocupadas: 0, livres: 5 },
                                    concorrentes: [], podeEditar: true }),
    console_historico_precos: () => ({ eventos: [] }),
    console_salvar_faixa_preco: (a) => (a.p_codigo === "ACIMA_DE_400" ? erroBanco("TC422", { motivo: "FAIXA_SOB_CONSULTA" }) : { codigo: a.p_codigo, versao: 2 }),
    console_salvar_parametros_preco: (a) => (a.p_vagas_fundador === 0 ? erroBanco("TC422", { motivo: "VAGAS_OCUPADAS" }) : { versao: 2 }),
    console_salvar_concorrente: (a) => (a.p_id ? erroBanco("TC422", { motivo: "CONCORRENTE_ARQUIVADO" }) : { id: CONCORRENTE, versao: 1 }),
    console_arquivar_concorrente: () => ({ id: CONCORRENTE, arquivado: true }),
    console_sugestao_plano: () => ({ unidades: 32, plano: { tabela: "FUNDADOR", valor: 12900 }, avisos: [] }),
    console_salvar_plano_tabela: (a) => (a.p_tabela === "FUNDADOR" && a.p_condominio !== IPE
      ? erroBanco("TC422", { motivo: "SEM_VAGA_FUNDADOR" })
      : { nome: a.p_nome, tabelaOrigem: a.p_tabela ?? "MANUAL", versao: 1 }),
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
const plano = {
  nome: "Fundador, até 40 unidades", unidadesDe: 1, unidadesAte: 40, valor: 12900, ciclo: "MENSAL", diaVencimento: 10,
  implantacaoValor: null, implantacaoSemCobranca: true, inicioCompetencia: "2026-11-01",
};
const concorrente = { nome: "SindIA", modelo: "FAIXA", faixas: [{ ate: 50, valor: 19700 }, { ate: 150, valor: 39700 }], fonte: "Site oficial",
                      lidoEm: "2026-10-24", motivo: "Preço conferido no site" };

Deno.test("0295: a tabela de preços e a sugestão pedem a sessão completa", async () => {
  const m = montar();
  for (const rota of ["/v1/precos", "/v1/precos/historico", `/v1/clientes/${IPE}/plano/sugestao`]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
  assertEquals((await erro(await m.pedir("/v1/precos/parametros", { metodo: "PUT", corpo: {} }))).codigo, "UNAUTHORIZED");
});

Deno.test("0295: ler a tabela e o histórico leva só a pessoa da sessão", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/precos", { cookie });
  assertEquals(r.status, 200);
  assertEquals((await r.json()).podeEditar, true);
  assertEquals(chamada(m, "console_tabela_precos"), { p_pessoa: CAROLINA });
  await m.pedir("/v1/precos/historico?antes=40&limite=20", { cookie });
  assertEquals(chamada(m, "console_historico_precos"), { p_pessoa: CAROLINA, p_antes: 40, p_limite: 20 });
  await m.pedir("/v1/precos/historico", { cookie });
  assertEquals(chamada(m, "console_historico_precos"), { p_pessoa: CAROLINA, p_antes: null, p_limite: 50 });
});

Deno.test("0295: a faixa aceita valor vazio (a definir), nunca zero, e sempre com motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const faixa = { versao: 1, fundador: 15900, cheia: 21900, implantacao: null, motivo: "Reajuste de novembro" };
  assertEquals((await m.pedir("/v1/precos/faixas/ATE_40", { cookie, metodo: "PUT", corpo: faixa })).status, 200);
  assertEquals(chamada(m, "console_salvar_faixa_preco"), {
    p_pessoa: CAROLINA, p_codigo: "ATE_40", p_versao: 1, p_fundador: 15900, p_cheia: 21900, p_implantacao: null, p_motivo: "Reajuste de novembro",
  });
  for (const [ruim, campo] of [[{ fundador: 0 }, "fundador"], [{ cheia: 199.9 }, "cheia"], [{ motivo: "" }, "motivo"], [{ versao: 0 }, "versao"]] as const) {
    const e = await erro(await m.pedir("/v1/precos/faixas/ATE_40", { cookie, metodo: "PUT", corpo: { ...faixa, ...ruim } }));
    assertEquals([e.codigo, e.detalhes?.campos], ["VALIDATION_ERROR", [campo]], JSON.stringify(ruim));
  }
  assertEquals((await m.pedir("/v1/precos/faixas/ATE_50", { cookie, metodo: "PUT", corpo: faixa })).status, 404);
  const sob = await erro(await m.pedir("/v1/precos/faixas/ACIMA_DE_400", { cookie, metodo: "PUT", corpo: faixa }));
  assertEquals([sob.codigo, sob.detalhes?.motivo], ["VALIDATION_ERROR", "FAIXA_SOB_CONSULTA"]);
});

Deno.test("0295: os parâmetros da tabela, com motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const p = { versao: 1, mesesPagosAnual: 11, parcelasImplantacao: 3, vagasFundador: 5, tabelaEmUso: "CHEIA", motivo: "Fim da campanha" };
  assertEquals((await m.pedir("/v1/precos/parametros", { cookie, metodo: "PUT", corpo: p })).status, 200);
  assertEquals(chamada(m, "console_salvar_parametros_preco"), {
    p_pessoa: CAROLINA, p_versao: 1, p_meses_pagos_anual: 11, p_parcelas_implantacao: 3, p_vagas_fundador: 5, p_tabela_em_uso: "CHEIA",
    p_motivo: "Fim da campanha",
  });
  assertEquals((await erro(await m.pedir("/v1/precos/parametros", { cookie, metodo: "PUT", corpo: { ...p, mesesPagosAnual: 13 } }))).detalhes?.campos,
    ["mesesPagosAnual"]);
  assertEquals((await erro(await m.pedir("/v1/precos/parametros", { cookie, metodo: "PUT", corpo: { ...p, tabelaEmUso: "MANUAL" } }))).detalhes?.campos,
    ["tabelaEmUso"]);
  assertEquals((await erro(await m.pedir("/v1/precos/parametros", { cookie, metodo: "PUT", corpo: { ...p, vagasFundador: 0 } }))).detalhes?.motivo,
    "VAGAS_OCUPADAS");
});

Deno.test("0295: concorrentes entram, mudam com a versão e arquivam com motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/precos/concorrentes", { cookie, corpo: concorrente })).status, 201);
  assertEquals(chamada(m, "console_salvar_concorrente"), {
    p_pessoa: CAROLINA, p_id: null, p_versao: null, p_nome: "SindIA", p_plano: null, p_modelo: "FAIXA", p_valor: null, p_a_partir_de: false,
    p_faixas: concorrente.faixas, p_por_unidade: null, p_minimo: null, p_fonte: "Site oficial", p_conferido: true, p_lido_em: "2026-10-24", p_observacao: null,
    p_motivo: "Preço conferido no site",
  });
  const fora = await erro(await m.pedir("/v1/precos/concorrentes", { cookie, corpo: { ...concorrente, faixas: [...concorrente.faixas].reverse() } }));
  assertEquals(fora.detalhes?.campos, ["faixas"]);
  assertEquals((await erro(await m.pedir("/v1/precos/concorrentes", { cookie, corpo: { ...concorrente, modelo: "FIXO", faixas: null } }))).detalhes?.campos,
    ["valor"]);
  assertEquals((await erro(await m.pedir(`/v1/precos/concorrentes/${CONCORRENTE}`, { cookie, metodo: "PUT", corpo: concorrente }))).detalhes?.campos,
    ["versao"]);
  const arq = await erro(await m.pedir(`/v1/precos/concorrentes/${CONCORRENTE}`, { cookie, metodo: "PUT", corpo: { ...concorrente, versao: 2 } }));
  assertEquals(arq.detalhes?.motivo, "CONCORRENTE_ARQUIVADO");
  assertEquals(chamada(m, "console_salvar_concorrente")?.p_id, CONCORRENTE);
  assertEquals((await m.pedir(`/v1/precos/concorrentes/${CONCORRENTE}/arquivar`, { cookie, corpo: { versao: 1, motivo: "Saiu do mercado" } })).status, 200);
  assertEquals(chamada(m, "console_arquivar_concorrente"), { p_pessoa: CAROLINA, p_id: CONCORRENTE, p_versao: 1, p_motivo: "Saiu do mercado" });
  assertEquals((await erro(await m.pedir(`/v1/precos/concorrentes/${CONCORRENTE}/arquivar`, { cookie, corpo: { versao: 1 } }))).detalhes?.campos, ["motivo"]);
  assertEquals((await m.pedir("/v1/precos/concorrentes/nao-e-id/arquivar", { cookie, corpo: { versao: 1, motivo: "Saiu" } })).status, 404);
});

Deno.test("0295: a sugestão do plano leva o ciclo e a competência; não grava nada", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir(`/v1/clientes/${IPE}/plano/sugestao`, { cookie })).status, 200);
  assertEquals(chamada(m, "console_sugestao_plano"), { p_pessoa: CAROLINA, p_condominio: IPE, p_ciclo: "MENSAL", p_inicio: null });
  await m.pedir(`/v1/clientes/${IPE}/plano/sugestao?ciclo=ANUAL&inicio=2026-11`, { cookie });
  assertEquals(chamada(m, "console_sugestao_plano"), { p_pessoa: CAROLINA, p_condominio: IPE, p_ciclo: "ANUAL", p_inicio: "2026-11-01" });
  assertEquals((await erro(await m.pedir(`/v1/clientes/${IPE}/plano/sugestao?ciclo=SEMANAL`, { cookie }))).detalhes?.campos, ["ciclo"]);
  assertEquals(m.chamadas.filter((c) => c.funcao.startsWith("console_salvar")).length, 0);
});

Deno.test("0295: salvar o plano diz de qual tabela veio; fundador só no mensal", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/clientes/${IPE}/plano`, { cookie, metodo: "PUT", corpo: { ...plano, tabela: "FUNDADOR" } });
  assertEquals((await r.json()).tabelaOrigem, "FUNDADOR");
  assertEquals(chamada(m, "console_salvar_plano_tabela")?.p_tabela, "FUNDADOR");
  await m.pedir(`/v1/clientes/${IPE}/plano`, { cookie, metodo: "PUT", corpo: { ...plano, tabela: "MANUAL" } });
  assertEquals(chamada(m, "console_salvar_plano_tabela")?.p_tabela, "MANUAL");
  const anual = await erro(await m.pedir(`/v1/clientes/${IPE}/plano`, { cookie, metodo: "PUT", corpo: { ...plano, ciclo: "ANUAL", tabela: "FUNDADOR" } }));
  assertEquals([anual.codigo, anual.detalhes?.campos], ["VALIDATION_ERROR", ["tabela"]]);
  const outro = "3e0f6c31-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
  const semVaga = await erro(await m.pedir(`/v1/clientes/${outro}/plano`, { cookie, metodo: "PUT", corpo: { ...plano, tabela: "FUNDADOR" } }));
  assertEquals(semVaga.detalhes?.motivo, "SEM_VAGA_FUNDADOR");
});
