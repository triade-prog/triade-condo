// Propostas do Comercial (0304): as rotas validam a entrada e levam a pessoa da sessão; o preço,
// quem aprova desconto e o que trava o envio são decididos no banco. O link da proposta abre sem
// sessão (pelo repasse do Console), com limite por aparelho, e o aceite leva o IP do repasse.
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import {
  ABAS_PROPOSTAS,
  ESCOPOS_REFERENCIA,
  OFERTA_INCLUIDO,
  OFERTA_PLANEJADO,
  SITUACOES_DESCONTO,
  SITUACOES_PROPOSTA,
  TEMAS_RESPOSTA,
} from "@triade/domain";
import { criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const CERRADO = "4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b7c";
const PROPOSTA = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const VERSAO = "9c0d1e2f-3a4b-4c5d-9e6f-7a8b9c0d1e2f";
const LGPD = "1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b";
const PAULO = "2f3a4b5c-6d7e-4f8a-9b0c-1d2e3f4a5b6c";
const CODIGO = "Qm9hLXByb3Bvc3RhLWRvLUNlcnJhZG8tY29tLTMyLWJ5dGVz";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };

function montar() {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, proposta: 3, aceite: 2 }),
    comercial_propostas: () => ({ propostas: [], contagens: {}, podeEditar: true, podeAprovarDesconto: true }),
    comercial_sugestao_proposta: () => ({ faixa: { codigo: "DE_41_A_100" }, tabela: "FUNDADOR", mensal: 22900, porApartamento: 318 }),
    comercial_criar_proposta: (a) => (a.p_interessado === CERRADO
      ? { id: PROPOSTA, versaoId: VERSAO, numero: 1, situacao: "RASCUNHO", versao: 1 }
      : erroBanco("TC422", { motivo: "PROPOSTA_EXISTE", propostaId: PROPOSTA })),
    comercial_proposta: () => ({ id: PROPOSTA, versao: 1, versoes: [] }),
    comercial_kit: () => ({ proposta: {}, comparativo: {} }),
    comercial_nova_versao: () => ({ id: PROPOSTA, versao: 2, versaoId: VERSAO, numero: 2, situacao: "RASCUNHO" }),
    comercial_salvar_versao: () => ({ id: VERSAO, versao: 3, situacao: "RASCUNHO" }),
    comercial_pedir_desconto: () => ({ id: VERSAO, versao: 4, situacao: "AGUARDA_DESCONTO" }),
    comercial_responder_desconto: (a) => (a.p_aprovar ? { id: VERSAO, versao: 5, situacao: "PRONTA" } : { id: VERSAO, versao: 5, situacao: "RASCUNHO" }),
    comercial_enviar_proposta: (a) => (a.p_versao === 4
      ? erroBanco("TC422", { motivo: "DESCONTO_SEM_APROVACAO" })
      : { id: VERSAO, versao: 6, situacao: "ENVIADA", validoAte: "2026-11-08", hash: "a".repeat(64), link: { codigo: CODIGO, expiraEm: "x" } }),
    comercial_novo_link: () => ({ id: VERSAO, link: { codigo: CODIGO, expiraEm: "x" } }),
    comercial_revogar_link: () => ({ id: VERSAO, revogados: 1 }),
    comercial_recusar_proposta: () => ({ id: VERSAO, versao: 7, situacao: "RECUSADA" }),
    comercial_respostas: () => ({ respostas: [], podeEditar: true }),
    comercial_salvar_resposta: () => ({ id: LGPD, versao: 2 }),
    comercial_referencias: () => ({ referencias: [], podeEditar: true }),
    comercial_salvar_referencia: () => ({ id: PAULO, versao: 1 }),
    comercial_retirar_referencia: () => ({ id: PAULO, versao: 2 }),
    publico_proposta: (a) => (a.p_codigo === CODIGO ? { mensal: 20610, situacao: "ENVIADA", podeAceitar: true } : erroBanco("TC404")),
    publico_kit_proposta: () => ({ proposta: {}, comparativo: {} }),
    publico_aceitar_proposta: () => ({ situacao: "ACEITA", numero: 1, nome: "Lúcia Prado" }),
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
const versaoUrl = `/v1/comercial/propostas/${PROPOSTA}/versoes/${VERSAO}`;
const dadosVazios = { unidades: null, ciclo: "MENSAL", tabela: null, valorManual: null, valorManualMotivo: null, implantacaoManual: null, desconto: null,
                      descontoMotivo: null, respostas: [], referencias: [], notaInterna: null, validadeDias: null };

Deno.test("0304: as rotas das propostas pedem a sessão completa", async () => {
  const m = montar();
  for (const rota of ["/v1/comercial/propostas", `/v1/comercial/propostas/${PROPOSTA}`, `/v1/comercial/propostas/${PROPOSTA}/kit`, "/v1/comercial/respostas",
                      "/v1/comercial/referencias"]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
  for (const rota of ["/v1/comercial/propostas", "/v1/comercial/propostas/sugestao", `${versaoUrl}/enviar`, `${versaoUrl}/desconto/aprovar`]) {
    assertEquals((await erro(await m.pedir(rota, { corpo: {} }))).codigo, "UNAUTHORIZED", rota);
  }
});

Deno.test("0304: lista com abas e filtro do interessado; sugestão sem gravar", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/comercial/propostas", { cookie })).status, 200);
  assertEquals(chamada(m, "comercial_propostas"), { p_pessoa: CAROLINA, p_aba: null, p_interessado: null });
  await m.pedir(`/v1/comercial/propostas?aba=AGUARDANDO_APROVACAO&interessado=${CERRADO}`, { cookie });
  assertEquals(chamada(m, "comercial_propostas"), { p_pessoa: CAROLINA, p_aba: "AGUARDANDO_APROVACAO", p_interessado: CERRADO });
  assertEquals((await erro(await m.pedir("/v1/comercial/propostas?aba=TODAS", { cookie }))).detalhes?.campos, ["aba"]);
  assertEquals((await erro(await m.pedir("/v1/comercial/propostas?interessado=x", { cookie }))).detalhes?.campos, ["interessado"]);

  const r = await m.pedir("/v1/comercial/propostas/sugestao", { cookie, corpo: { interessadoId: CERRADO, ciclo: "ANUAL", desconto: 10 } });
  assertEquals((await r.json()).mensal, 22900);
  assertEquals(chamada(m, "comercial_sugestao_proposta"), {
    p_pessoa: CAROLINA, p_interessado: CERRADO, p_unidades: null, p_ciclo: "ANUAL", p_tabela: null, p_valor_manual: null, p_implantacao_manual: null,
    p_desconto: 10,
  });
  assertEquals((await erro(await m.pedir("/v1/comercial/propostas/sugestao", { cookie, corpo: { interessadoId: CERRADO, desconto: 100 } }))).detalhes?.campos,
    ["desconto"]);
  assertEquals(m.chamadas.filter((c) => c.funcao.startsWith("comercial_") && c.funcao !== "comercial_sugestao_proposta" && c.funcao !== "comercial_propostas")
    .length, 0, "a sugestão não chama nada que grave");
});

Deno.test("0304: nova proposta, versão nova e rascunho: o preço nunca vem da tela", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const nova = { interessadoId: CERRADO, desconto: 10, descontoMotivo: "Conselho compara com o atual", respostas: [LGPD], referencias: [PAULO],
                 notaInterna: "Só fecha com desconto", mensal: 100, valor: 1 };
  const r = await m.pedir("/v1/comercial/propostas", { cookie, corpo: nova });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "comercial_criar_proposta"), {
    p_pessoa: CAROLINA, p_interessado: CERRADO,
    p_dados: { ...dadosVazios, desconto: 10, descontoMotivo: "Conselho compara com o atual", respostas: [LGPD], referencias: [PAULO],
               notaInterna: "Só fecha com desconto" },
  });
  for (const [ruim, campo] of [[{ desconto: 10 }, "descontoMotivo"], [{ desconto: 10.005, descontoMotivo: "x y z" }, "desconto"],
                               [{ valorManual: 150000 }, "valorManualMotivo"], [{ ciclo: "SEMESTRAL" }, "ciclo"], [{ tabela: "MANUAL" }, "tabela"],
                               [{ respostas: ["nao-e-id"] }, "respostas"], [{ unidades: 0 }, "unidades"], [{ validadeDias: 90 }, "validadeDias"]] as const) {
    const e = await erro(await m.pedir("/v1/comercial/propostas", { cookie, corpo: { interessadoId: CERRADO, ...ruim } }));
    assertEquals([e.codigo, e.detalhes?.campos], ["VALIDATION_ERROR", [campo]], JSON.stringify(ruim));
  }
  const existe = await erro(await m.pedir("/v1/comercial/propostas", { cookie, corpo: { interessadoId: PAULO } }));
  assertEquals([existe.detalhes?.motivo, existe.detalhes?.propostaId], ["PROPOSTA_EXISTE", PROPOSTA]);

  assertEquals((await m.pedir(`/v1/comercial/propostas/${PROPOSTA}/versoes`, { cookie, corpo: { versao: 1, tabela: "CHEIA" } })).status, 201);
  assertEquals(chamada(m, "comercial_nova_versao"), { p_pessoa: CAROLINA, p_proposta: PROPOSTA, p_versao: 1, p_dados: { ...dadosVazios, tabela: "CHEIA" } });
  assertEquals((await m.pedir(versaoUrl, { cookie, metodo: "PUT", corpo: { versao: 2, unidades: 72, ciclo: "ANUAL" } })).status, 200);
  assertEquals(chamada(m, "comercial_salvar_versao"), {
    p_pessoa: CAROLINA, p_proposta: PROPOSTA, p_id: VERSAO, p_versao: 2, p_dados: { ...dadosVazios, unidades: 72, ciclo: "ANUAL" },
  });
  assertEquals((await erro(await m.pedir(versaoUrl, { cookie, metodo: "PUT", corpo: { unidades: 72 } }))).detalhes?.campos, ["versao"]);
  assertEquals((await m.pedir(`/v1/comercial/propostas/${PROPOSTA}/versoes/nao-e-id`, { cookie, metodo: "PUT", corpo: { versao: 2 } })).status, 404);
  assertEquals((await m.pedir(`/v1/comercial/propostas/${PROPOSTA}`, { cookie })).status, 200);
  assertEquals(chamada(m, "comercial_proposta"), { p_pessoa: CAROLINA, p_id: PROPOSTA });
  assertEquals((await m.pedir(`/v1/comercial/propostas/${PROPOSTA}/kit`, { cookie })).status, 200);
  assertEquals(chamada(m, "comercial_kit"), { p_pessoa: CAROLINA, p_id: PROPOSTA });
});

Deno.test("0304: desconto pedido, aprovado ou recusado; envio, link, revogação e recusa", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir(`${versaoUrl}/desconto/pedir`, { cookie, corpo: { versao: 3 } });
  assertEquals(chamada(m, "comercial_pedir_desconto"), { p_pessoa: CAROLINA, p_proposta: PROPOSTA, p_id: VERSAO, p_versao: 3 });
  const bloqueado = await erro(await m.pedir(`${versaoUrl}/enviar`, { cookie, corpo: { versao: 4 } }));
  assertEquals(bloqueado.detalhes?.motivo, "DESCONTO_SEM_APROVACAO");
  assertEquals((await erro(await m.pedir(`${versaoUrl}/desconto/recusar`, { cookie, corpo: { versao: 4 } }))).detalhes?.campos, ["resposta"]);
  await m.pedir(`${versaoUrl}/desconto/recusar`, { cookie, corpo: { versao: 4, resposta: "Só no anual" } });
  assertEquals(chamada(m, "comercial_responder_desconto"), {
    p_pessoa: CAROLINA, p_proposta: PROPOSTA, p_id: VERSAO, p_versao: 4, p_aprovar: false, p_resposta: "Só no anual",
  });
  await m.pedir(`${versaoUrl}/desconto/aprovar`, { cookie, corpo: { versao: 4 } });
  assertEquals(chamada(m, "comercial_responder_desconto"), {
    p_pessoa: CAROLINA, p_proposta: PROPOSTA, p_id: VERSAO, p_versao: 4, p_aprovar: true, p_resposta: null,
  });
  const env = await (await m.pedir(`${versaoUrl}/enviar`, { cookie, corpo: { versao: 5 } })).json();
  assertEquals([env.situacao, env.link.codigo], ["ENVIADA", CODIGO]);
  assertEquals((await m.pedir(`${versaoUrl}/link`, { cookie, corpo: {} })).status, 201);
  assertEquals(chamada(m, "comercial_novo_link"), { p_pessoa: CAROLINA, p_proposta: PROPOSTA, p_id: VERSAO });
  assertEquals((await erro(await m.pedir(`${versaoUrl}/revogar`, { cookie, corpo: { motivo: "" } }))).detalhes?.campos, ["motivo"]);
  await m.pedir(`${versaoUrl}/revogar`, { cookie, corpo: { motivo: "Mandado para o número errado" } });
  assertEquals(chamada(m, "comercial_revogar_link"), { p_pessoa: CAROLINA, p_proposta: PROPOSTA, p_id: VERSAO, p_motivo: "Mandado para o número errado" });
  await m.pedir(`${versaoUrl}/recusada`, { cookie, corpo: { versao: 6, motivo: "Ficou com o sistema atual" } });
  assertEquals(chamada(m, "comercial_recusar_proposta"), {
    p_pessoa: CAROLINA, p_proposta: PROPOSTA, p_id: VERSAO, p_versao: 6, p_motivo: "Ficou com o sistema atual",
  });
});

Deno.test("0304: respostas prontas e referências", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/comercial/respostas", { cookie })).status, 200);
  assertEquals((await m.pedir(`/v1/comercial/respostas/${LGPD}`, { cookie, metodo: "PUT",
    corpo: { versao: 1, tema: "LGPD", titulo: "LGPD", texto: "Cada condomínio só vê os próprios dados.", revisada: true } })).status, 200);
  assertEquals(chamada(m, "comercial_salvar_resposta"), {
    p_pessoa: CAROLINA, p_id: LGPD, p_versao: 1, p_tema: "LGPD", p_titulo: "LGPD", p_texto: "Cada condomínio só vê os próprios dados.", p_revisada: true,
    p_ativa: true,
  });
  assertEquals((await erro(await m.pedir("/v1/comercial/respostas", { cookie, corpo: { tema: "PRECO", titulo: "Preço", texto: "Texto da resposta" } })))
    .detalhes?.campos, ["tema"]);

  const ref = { sindico: "Paulo Dias", condominio: "Edifício Ipê", escopo: "CONTATO", whatsapp: "(61) 98888-7777", autorizadoEm: "2026-10-20",
                autorizacaoTexto: "Autorizou por WhatsApp em 20/10" };
  assertEquals((await m.pedir("/v1/comercial/referencias", { cookie, corpo: ref })).status, 201);
  const a = chamada(m, "comercial_salvar_referencia")!;
  assertEquals([a.p_id, a.p_versao, (a.p_dados as Record<string, unknown>).whatsapp, "versao" in (a.p_dados as object)], [null, null, "5561988887777", false]);
  assertEquals((await erro(await m.pedir("/v1/comercial/referencias", { cookie, corpo: { ...ref, whatsapp: null } }))).detalhes?.campos, ["whatsapp"]);
  assertEquals((await erro(await m.pedir("/v1/comercial/referencias", { cookie, corpo: { ...ref, autorizacaoTexto: "" } }))).detalhes?.campos,
    ["autorizacaoTexto"]);
  assertEquals((await erro(await m.pedir("/v1/comercial/referencias", { cookie, corpo: { ...ref, casoTexto: "Pedidos resolvidos em metade do tempo" } })))
    .detalhes?.campos, ["casoMedidoEm"]);
  await m.pedir(`/v1/comercial/referencias/${PAULO}/retirar`, { cookie, corpo: { versao: 1, motivo: "Pediu para sair" } });
  assertEquals(chamada(m, "comercial_retirar_referencia"), { p_pessoa: CAROLINA, p_id: PAULO, p_versao: 1, p_motivo: "Pediu para sair" });
});

Deno.test("0304: o link abre sem sessão, com o resumo do aparelho e limite de uso", async () => {
  const m = montar();
  const r = await m.pedir(`/v1/publico/propostas/${CODIGO}`);
  assertEquals(r.status, 200);
  assertEquals((await r.json()).mensal, 20610);
  const a = chamada(m, "publico_proposta")!;
  assertEquals(a.p_codigo, CODIGO);
  assert(/^[0-9a-f]{64}$/.test(String(a.p_aparelho)), "o aparelho vai como resumo");
  assertNotEquals(a.p_aparelho, "200.1.2.3");
  assertEquals((await m.pedir("/v1/publico/propostas/curto")).status, 404);
  assertEquals((await m.pedir(`/v1/publico/propostas/${"x".repeat(30)}`)).status, 404);
  assertEquals((await m.pedir(`/v1/publico/propostas/${CODIGO}/kit`)).status, 200);
  assertEquals((await erro(await m.pedir(`/v1/publico/propostas/${CODIGO}`))).codigo, "RATE_LIMITED");
  // Continua pedindo o repasse do Console.
  assertEquals((await m.pedir(`/v1/publico/propostas/${CODIGO}`, { segredo: null })).status, 403);
});

Deno.test("0304: o aceite valida o CPF e leva o IP do repasse", async () => {
  const m = montar();
  const aceite = { nome: "Lúcia Prado", cpf: "529.982.247-25", cargo: "Síndica", concordo: true };
  assertEquals((await erro(await m.pedir(`/v1/publico/propostas/${CODIGO}/aceite`, { corpo: { ...aceite, cpf: "529.982.247-24", concordo: false } })))
    .detalhes?.campos, ["cpf", "concordo"]);
  const r = await m.pedir(`/v1/publico/propostas/${CODIGO}/aceite`, { corpo: aceite });
  assertEquals(r.status, 201);
  const a = chamada(m, "publico_aceitar_proposta")!;
  assertEquals([a.p_codigo, a.p_dados, a.p_ip], [CODIGO, { nome: "Lúcia Prado", cpf: "52998224725", cargo: "Síndica", concordo: true }, "200.1.2.3"]);
  assert(/^[0-9a-f]{64}$/.test(String(a.p_aparelho)));
  assertEquals((await erro(await m.pedir(`/v1/publico/propostas/${CODIGO}/aceite`, { corpo: aceite }))).codigo, "RATE_LIMITED");
});

Deno.test("0304: as listas e os textos do domínio são os mesmos do banco", async () => {
  const sql = await Deno.readTextFile(new URL("../../migrations/0304_comercial_propostas.sql", import.meta.url));
  for (const lista of [SITUACOES_PROPOSTA, SITUACOES_DESCONTO, ABAS_PROPOSTAS, TEMAS_RESPOSTA, ESCOPOS_REFERENCIA]) {
    for (const k of Object.keys(lista)) assert(sql.includes(`'${k}'`), k);
  }
  assert(sql.includes(`'${JSON.stringify(OFERTA_INCLUIDO).replaceAll('","', '", "')}'::jsonb`), "o incluído é o mesmo");
  assert(sql.includes(`'${JSON.stringify(OFERTA_PLANEJADO).replaceAll('","', '", "')}'::jsonb`), "o planejado é o mesmo");
  assert(sql.includes("('ADMINISTRACAO', 'console.comercial.desconto')"));
});
