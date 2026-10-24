// Comercial no Console (0296): as rotas validam a entrada e levam a pessoa da sessão; quem vê,
// o que cada etapa pede e o que junta são decididos no banco. A entrada do site fica fora do
// repasse e só abre com o segredo do site.
import { assert, assertEquals } from "@std/assert";
import { ETAPAS_COMERCIAL, MOTIVOS_PERDA, ORIGENS_COMERCIAL, PAPEIS_CONTATO } from "@triade/domain";
import { CABECALHO_SITE, criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const AROEIRA = "4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b7c";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };
const SITE = "segredo-do-site-de-teste";

function montar(segredoSite: string | null = SITE) {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, site: 2 }),
    comercial_lista: () => ({ interessados: [], contagens: { atencao: 0, abertos: 0, porEtapa: {} }, etapas: [], equipe: [], podeEditar: true }),
    comercial_meu_dia: () => ({ atrasados: [], hoje: [], semPasso: [] }),
    comercial_criar: (a) => ((a.p_dados as { whatsapp?: string }).whatsapp === "5561911112222"
      ? erroBanco("TC422", { motivo: "NAO_CONTATAR" })
      : { id: AROEIRA, juntado: false }),
    comercial_ficha: () => ({ id: AROEIRA, versao: 3, etapa: "NOVO", conversas: [] }),
    comercial_salvar: () => ({ id: AROEIRA, versao: 4 }),
    comercial_mudar_etapa: (a) => (a.p_etapa === "APROVACAO"
      ? erroBanco("TC422", { motivo: "FALTA_PARA_ETAPA", campos: ["decisor", "decisaoEm"] })
      : { id: AROEIRA, versao: 4, etapa: a.p_etapa }),
    comercial_registrar_conversa: () => ({ id: "c1", versao: 4 }),
    comercial_proximo_passo: () => ({ id: AROEIRA, versao: 4 }),
    comercial_cadencia: () => ({ id: AROEIRA, versao: 5 }),
    comercial_excluir: () => ({ id: AROEIRA, anonimizado: true }),
    comercial_nao_contatar: () => ({ id: "n1" }),
    comercial_importar: (a) => (a.p_confirmar ? { loteId: "l1", criados: 1, juntados: 0, bloqueados: [] } : { linhas: 1, novas: 1, parecidas: [], bloqueados: [] }),
    comercial_exportar: () => ({ linhas: [] }),
    comercial_modelos: () => ({ mensagens: [], cadencias: [], objecoes: [], etapas: [], podeEditar: true }),
    comercial_salvar_mensagem: () => ({ id: "m1", versao: 1 }),
    comercial_salvar_cadencia: () => ({ id: "k1", versao: 1 }),
    comercial_salvar_etapa: () => ({ etapa: "NOVO", versao: 2 }),
    comercial_entrada_site: () => ({ id: AROEIRA, juntado: false }),
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
    segredoSite: segredoSite ?? undefined,
  });
  const site = (corpo: unknown, segredo: string | null = SITE) =>
    app.request("/api-console/v1/site/interessados", {
      method: "POST",
      headers: { "content-type": "application/json", ...(segredo ? { [CABECALHO_SITE]: segredo } : {}) },
      body: JSON.stringify(corpo),
    });
  return { pedir: pedido(app, "api-console"), site, ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;
const pedidoSite = { nome: "Renata Moura", whatsapp: "5561998760412", condominio: "Edifício Jatobá", faixa: "DE_41_A_100", unidadesTexto: "41 a 100",
                     consentimento: true, pagina: "/demonstracao", utm: { utm_source: "instagram" } };

Deno.test("0296: o Comercial pede a sessão completa", async () => {
  const m = montar();
  for (const rota of ["/v1/comercial/interessados", "/v1/comercial/meu-dia", `/v1/comercial/interessados/${AROEIRA}`, "/v1/comercial/modelos",
                      "/v1/comercial/exportar"]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
  assertEquals((await erro(await m.pedir("/v1/comercial/interessados", { corpo: {} }))).codigo, "UNAUTHORIZED");
});

Deno.test("0296: lista, busca, Meu dia e ficha levam só a pessoa da sessão", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/comercial/interessados", { cookie })).status, 200);
  assertEquals(chamada(m, "comercial_lista"), { p_pessoa: CAROLINA, p_busca: null });
  await m.pedir("/v1/comercial/interessados?q=%20Jatob%C3%A1%20", { cookie });
  assertEquals(chamada(m, "comercial_lista"), { p_pessoa: CAROLINA, p_busca: "Jatobá" });
  assertEquals((await m.pedir("/v1/comercial/meu-dia", { cookie })).status, 200);
  assertEquals(chamada(m, "comercial_meu_dia"), { p_pessoa: CAROLINA });
  assertEquals((await (await m.pedir(`/v1/comercial/interessados/${AROEIRA}`, { cookie })).json()).versao, 3);
  assertEquals(chamada(m, "comercial_ficha"), { p_pessoa: CAROLINA, p_id: AROEIRA });
  assertEquals((await m.pedir("/v1/comercial/interessados/nao-e-id", { cookie })).status, 404);
});

Deno.test("0296: novo interessado à mão: normaliza o WhatsApp, pede o aceite do contato e não aceita Site", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const novo = { pessoa: "Lúcia Prado", whatsapp: "(61) 99999-0087", condominio: "Residencial Cerrado", origem: "INSTAGRAM", contatoAceito: true,
                 faixa: "DE_41_A_100", email: "Lucia@Exemplo.com" };
  assertEquals((await m.pedir("/v1/comercial/interessados", { cookie, corpo: novo })).status, 201);
  const d = chamada(m, "comercial_criar")?.p_dados as Record<string, unknown>;
  assertEquals([d.whatsapp, d.email, d.origem], ["5561999990087", "lucia@exemplo.com", "INSTAGRAM"]);
  for (const [ruim, campo] of [[{ contatoAceito: false }, "contatoAceito"], [{ origem: "SITE" }, "origem"], [{ whatsapp: "123" }, "whatsapp"],
                               [{ whatsapp: null, email: null }, "whatsapp"], [{ faixa: "ATE_50" }, "faixa"]] as const) {
    const e = await erro(await m.pedir("/v1/comercial/interessados", { cookie, corpo: { ...novo, ...ruim } }));
    assertEquals([e.codigo, e.detalhes?.campos], ["VALIDATION_ERROR", [campo]], JSON.stringify(ruim));
  }
  const bloq = await erro(await m.pedir("/v1/comercial/interessados", { cookie, corpo: { ...novo, whatsapp: "61 91111-2222" } }));
  assertEquals(bloq.detalhes?.motivo, "NAO_CONTATAR");
});

Deno.test("0296: ficha, etapa, conversa, próximo passo e cadência", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const ficha = { versao: 3, condominio: "Edifício Aroeira", whatsapp: "61987650412", objecoes: ["AUMENTA_TAXA"],
                  concorrentes: [{ nome: "Sistema X", preco: 39000 }], assembleiaOrdinaria: "2027-03-18" };
  assertEquals((await m.pedir(`/v1/comercial/interessados/${AROEIRA}`, { cookie, metodo: "PUT", corpo: ficha })).status, 200);
  const s = chamada(m, "comercial_salvar")!;
  assertEquals([s.p_versao, (s.p_dados as Record<string, unknown>).whatsapp, "versao" in (s.p_dados as object)], [3, "5561987650412", false]);
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}`, { cookie, metodo: "PUT",
    corpo: { ...ficha, concorrentes: [{ nome: "X", outro: 1 }] } }))).codigo, "VALIDATION_ERROR");

  assertEquals((await m.pedir(`/v1/comercial/interessados/${AROEIRA}/etapa`, { cookie, corpo: { versao: 3, etapa: "EM_CONTATO" } })).status, 200);
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/etapa`, { cookie, corpo: { versao: 3, etapa: "PERDIDO" } }))).detalhes?.campos,
    ["motivoPerda"]);
  await m.pedir(`/v1/comercial/interessados/${AROEIRA}/etapa`, { cookie, corpo: { versao: 3, etapa: "PERDIDO", motivoPerda: "PRECO", retomarEm: "2027-03-01" } });
  assertEquals(chamada(m, "comercial_mudar_etapa"), {
    p_pessoa: CAROLINA, p_id: AROEIRA, p_versao: 3, p_etapa: "PERDIDO", p_motivo_perda: "PRECO", p_detalhe: null, p_vencedor: null, p_retomar_em: "2027-03-01",
  });
  const falta = await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/etapa`, { cookie, corpo: { versao: 3, etapa: "APROVACAO" } }));
  assertEquals([falta.detalhes?.motivo, falta.detalhes?.campos], ["FALTA_PARA_ETAPA", ["decisor", "decisaoEm"]]);

  assertEquals((await m.pedir(`/v1/comercial/interessados/${AROEIRA}/conversas`, { cookie, corpo: { canal: "LIGACAO", resumo: "Não atendeu" } })).status, 201);
  assertEquals(chamada(m, "comercial_registrar_conversa"), {
    p_pessoa: CAROLINA, p_id: AROEIRA, p_canal: "LIGACAO", p_resumo: "Não atendeu", p_respondeu: false, p_mensagem: null,
  });
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/conversas`, { cookie, corpo: { canal: "ENTRADA", resumo: "x" } }))).detalhes
    ?.campos, ["canal", "resumo"]);

  await m.pedir(`/v1/comercial/interessados/${AROEIRA}/proximo-passo`, { cookie, metodo: "PUT", corpo: { versao: 4, texto: "Ligar", data: "2026-10-27", hora: "14:00" } });
  assertEquals(chamada(m, "comercial_proximo_passo"), {
    p_pessoa: CAROLINA, p_id: AROEIRA, p_versao: 4, p_texto: "Ligar", p_data: "2026-10-27", p_hora: "14:00", p_responsavel: null,
  });
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/proximo-passo`, { cookie, metodo: "PUT", corpo: { versao: 4, texto: "Ligar" } })))
    .detalhes?.campos, ["data"]);
  await m.pedir(`/v1/comercial/interessados/${AROEIRA}/cadencia`, { cookie, corpo: { acao: "FEITO" } });
  assertEquals(chamada(m, "comercial_cadencia"), { p_pessoa: CAROLINA, p_id: AROEIRA, p_acao: "FEITO", p_resumo: null });
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/cadencia`, { cookie, corpo: { acao: "ENVIAR" } }))).detalhes?.campos, ["acao"]);
});

Deno.test("0296: planilha confere antes de gravar; não contatar, excluir e exportar", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const lote = { arquivo: "predios.xlsx", origemTexto: "Lista do Guará", baseLegalTexto: "Teste de legítimo interesse do lote",
                 linhas: [{ linha: 2, condominio: "Residencial Pequi", cnpj: "11.222.333/0001-44", whatsapp: "" }] };
  assertEquals((await (await m.pedir("/v1/comercial/importar", { cookie, corpo: lote })).json()).novas, 1);
  const a = chamada(m, "comercial_importar")!;
  assertEquals([a.p_confirmar, (a.p_dados as { linhas: { cnpj: string; whatsapp: null }[] }).linhas[0]], [false,
    { linha: 2, condominio: "Residencial Pequi", cnpj: "11222333000144", endereco: null, cidade: null, uf: null, unidades: null, faixa: null, pessoa: null,
      whatsapp: null, email: null }]);
  await m.pedir("/v1/comercial/importar", { cookie, corpo: { ...lote, confirmar: true } });
  assertEquals(chamada(m, "comercial_importar")?.p_confirmar, true);
  assertEquals((await erro(await m.pedir("/v1/comercial/importar", { cookie, corpo: { ...lote, baseLegalTexto: "curto" } }))).detalhes?.campos, ["baseLegalTexto"]);

  assertEquals((await m.pedir("/v1/comercial/nao-contatar", { cookie, corpo: { whatsapp: "61 91111-2222" } })).status, 201);
  assertEquals(chamada(m, "comercial_nao_contatar"), { p_pessoa: CAROLINA, p_whatsapp: "5561911112222", p_email: null, p_cnpj: null, p_observacao: null });
  assertEquals((await erro(await m.pedir("/v1/comercial/nao-contatar", { cookie, corpo: {} }))).codigo, "VALIDATION_ERROR");
  assertEquals((await m.pedir(`/v1/comercial/interessados/${AROEIRA}/excluir`, { cookie, corpo: {} })).status, 200);
  assertEquals((await m.pedir("/v1/comercial/exportar", { cookie })).status, 200);
  assertEquals(chamada(m, "comercial_exportar"), { p_pessoa: CAROLINA });
});

Deno.test("0296: modelos, cadências e etapas", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/comercial/mensagens", { cookie, corpo: { etapa: "NOVO", titulo: "Oi", texto: "Texto da mensagem" } }))).detalhes
    ?.campos, ["titulo"]);
  assertEquals((await m.pedir("/v1/comercial/mensagens", { cookie, corpo: { etapa: "NOVO", titulo: "Primeiro retorno", texto: "Oi, [nome]! Tudo bem?" } })).status,
    201);
  const passos = [{ dia: 0, canal: "WHATSAPP", texto: "Oi, tudo bem?" }, { dia: 0, canal: "LIGACAO", texto: "Ligar" }];
  assertEquals((await erro(await m.pedir("/v1/comercial/cadencias", { cookie, corpo: { nome: "Nova", gatilho: "NOVO", passos } }))).detalhes?.campos, ["passos"]);
  await m.pedir("/v1/comercial/cadencias", { cookie, corpo: { nome: "Nova", gatilho: "NOVO", passos: [passos[0], { ...passos[1], dia: 2 }] } });
  assertEquals(chamada(m, "comercial_salvar_cadencia")?.p_termina_sem_resposta, false);
  assertEquals((await m.pedir("/v1/comercial/etapas/NOVO", { cookie, metodo: "PUT", corpo: { versao: 1, probabilidade: 8, limiteDias: 3 } })).status, 200);
  assertEquals(chamada(m, "comercial_salvar_etapa"), { p_pessoa: CAROLINA, p_etapa: "NOVO", p_versao: 1, p_probabilidade: 8, p_limite_dias: 3 });
  assertEquals((await m.pedir("/v1/comercial/etapas/FUNIL", { cookie, metodo: "PUT", corpo: { versao: 1, probabilidade: 8 } })).status, 404);
});

Deno.test("0296: o pedido do site só entra com o segredo do site, sem sessão e sem repasse", async () => {
  const m = montar();
  assertEquals((await m.site(pedidoSite, null)).status, 403);
  assertEquals((await m.site(pedidoSite, "outro-segredo")).status, 403);
  const r = await m.site(pedidoSite);
  assertEquals(r.status, 201);
  assertEquals((await r.json()).id, AROEIRA);
  assertEquals((chamada(m, "comercial_entrada_site")?.p_dados as Record<string, unknown>).utm, { utm_source: "instagram" });
  assertEquals((await erro(await m.site({ ...pedidoSite, consentimento: false }))).detalhes?.campos, ["consentimento"]);
  assertEquals((await m.site(pedidoSite)).status, 201);
  assertEquals((await erro(await m.site(pedidoSite))).codigo, "RATE_LIMITED");
  // Sem SITE_SEGREDO configurado, a entrada fica fechada.
  assertEquals((await montar(null).site(pedidoSite)).status, 403);
  // As outras rotas continuam pedindo o repasse.
  assertEquals((await m.pedir("/v1/comercial/interessados", { segredo: null })).status, 403);
});

Deno.test("0296: as listas do domínio são as mesmas do banco", async () => {
  const sql = await Deno.readTextFile(new URL("../../migrations/0296_comercial.sql", import.meta.url));
  for (const listas of [ETAPAS_COMERCIAL, ORIGENS_COMERCIAL, MOTIVOS_PERDA, PAPEIS_CONTATO]) {
    for (const k of Object.keys(listas)) assert(sql.includes(`'${k}'`), k);
  }
  assert(sql.includes("('COMERCIAL', 'Comercial', 'CONSOLE')"));
});
