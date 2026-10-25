// Parceiros, agenda, calculadora e taxa (0310, R17.6 e R17.3c): as rotas validam a entrada e levam
// a pessoa da sessão; a comissão, a grade livre e o preço saem do banco. O link de agendamento abre
// sem sessão (pelo repasse do Console), com limite por aparelho; a calculadora fica fora do repasse,
// com o segredo do site; a fila de e-mails da agenda sai pelo Resend e, sem a chave, não falha.
import { assert, assertEquals } from "@std/assert";
import { SITUACOES_DEMONSTRACAO, TIPOS_PARCEIRO } from "@triade/domain";
import { CABECALHO_SITE, criarApiConsole } from "./app.ts";
import type { Correio, EmailPronto } from "../_shared/email.ts";
import { montarEmailComercial } from "./email_comercial.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const MARTA = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
const AROEIRA = "4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b7c";
const DEMO = "6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e";
const COMISSAO = "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
const EMAIL1 = "8d9e0f1a-2b3c-4d4e-9f5a-6b7c8d9e0f1a";
const EMAIL2 = "9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b";
const CODIGO = "abc23def45gh";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };
const SITE = "segredo-do-site-de-teste";

function montar(opcoes: { correio?: Correio } = {}) {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const fila = [
    { id: EMAIL1, tipo: "CONFIRMACAO", para: "rita@exemplo.com.br", nome: "Rita Dias", condominio: "Edifício Sucupira", inicio: "2026-10-27T17:00:00Z",
      fim: "2026-10-27T17:30:00Z", quando: "terça, 27/10, 14:00", duracaoMinutos: 30, salaUrl: "https://meet.exemplo.com/abc" },
    { id: EMAIL2, tipo: "LEMBRETE", para: "joao@exemplo.com.br", inicio: "2026-10-28T12:00:00Z", fim: "2026-10-28T12:30:00Z",
      quando: "quarta, 28/10, 09:00", duracaoMinutos: 30 },
  ];
  let pegou = false;
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, site: 3, calculadora: 1, agenda: 3, agendar: 1 }),
    comercial_parceiros: () => ({ mes: "2026-10", regra: { percentual: 10, versao: 1 }, parceiros: [], podeEditar: true, podeComissao: true }),
    comercial_salvar_parceiro: (a) => (a.p_id ? { id: a.p_id, versao: (a.p_versao as number) + 1 } : { id: MARTA, versao: 1 }),
    comercial_indicar: () => ({ id: AROEIRA, juntado: false, parceiroId: MARTA }),
    comercial_criar: () => ({ id: AROEIRA, juntado: false }),
    comercial_extrato_parceiro: () => ({ mes: "2026-10", linhas: [], total: 0 }),
    comercial_registrar_pagamento: (a) => (a.p_valor === 9999
      ? erroBanco("TC422", { motivo: "PAGAMENTO_REGISTRADO" })
      : { id: "g1", calculado: 2863, valor: a.p_valor, diferenca: 2863 - (a.p_valor as number) }),
    comercial_apagar_parceiro: () => ({ id: MARTA, anonimizado: true }),
    comercial_salvar_regra_comissao: (a) => ({ percentual: a.p_percentual, prazoMeses: a.p_prazo_meses, versao: 2 }),
    comercial_encerrar_comissao: () => ({ id: COMISSAO, versao: 2 }),
    comercial_agenda: () => ({ proximas: [], aRegistrar: [], recentes: [], disponibilidades: [], bloqueios: [], links: [], equipe: [], podeEditar: true }),
    comercial_salvar_disponibilidade: () => ({ id: "d1", versao: 1 }),
    comercial_bloquear_agenda: () => ({ id: "b1" }),
    comercial_desbloquear_agenda: () => ({ id: "b1" }),
    comercial_link_agenda: (a) => ({ codigo: CODIGO, pessoaId: a.p_de }),
    comercial_marcar_demonstracao: () => ({ id: DEMO, versao: 1, situacao: "MARCADA" }),
    comercial_remarcar_demonstracao: () => ({ id: DEMO, versao: 2, situacao: "MARCADA" }),
    comercial_demonstracao_feita: () => ({ id: DEMO, versao: 3, situacao: "FEITA", interessadoVersao: 7 }),
    comercial_encerrar_demonstracao: (a) => ({ id: DEMO, versao: 3, situacao: a.p_situacao }),
    publico_agenda: (a) => (a.p_codigo === CODIGO ? { duracaoMinutos: 30, fuso: "America/Sao_Paulo", dias: [], faixas: [] } : erroBanco("TC404")),
    publico_agendar: (a) => ((a.p_dados as { inicio: string }).inicio.startsWith("2026-10-27T14:00")
      ? { id: DEMO, quando: "terça, 27/10, 14:00", duracaoMinutos: 30 }
      : erroBanco("TC422", { motivo: "HORARIO_OCUPADO" })),
    comercial_calculadora_site: (a) => ({ unidades: a.p_unidades, faixa: { codigo: "DE_41_A_100", nome: "41 a 100 unidades", sobConsulta: false },
                                          tabela: "FUNDADOR", mensal: 22900, porApartamento: 358 }),
    comercial_entrada_site: () => ({ id: AROEIRA, juntado: false }),
    comercial_salvar_taxa: (a) => ({ id: AROEIRA, versao: (a.p_versao as number) + 1, taxaCondominio: a.p_taxa }),
    comercial_salvar: () => ({ id: AROEIRA, versao: 4 }),
    comercial_criar_proposta: () => ({ id: "p1", versaoId: "v1", numero: 1, situacao: "RASCUNHO", versao: 1 }),
    comercial_nova_versao: () => ({ id: "p1", versaoId: "v2", numero: 2, situacao: "RASCUNHO", versao: 2 }),
    comercial_emails_pegar: () => (pegou ? [] : ((pegou = true), fila)),
    comercial_email_resultado: () => null,
    comercial_emails_sem_chave: () => 2,
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
    segredoSite: SITE, correio: opcoes.correio, responderComercial: "comercial@triade.exemplo",
  });
  const site = (rota: string, corpo: unknown, segredo: string | null = SITE) =>
    app.request(`/api-console/v1/site/${rota}`, {
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

Deno.test("0310: parceiros, agenda e taxa pedem a sessão completa", async () => {
  const m = montar();
  for (const rota of ["/v1/comercial/parceiros", `/v1/comercial/parceiros/${MARTA}/extrato`, "/v1/comercial/agenda"]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/taxa`, { metodo: "PUT", corpo: { versao: 1, taxaCondominio: 650 } }))).codigo,
    "UNAUTHORIZED");
  assert(Object.keys(TIPOS_PARCEIRO).includes("ADMINISTRADORA"));
});

Deno.test("0310: o cadastro do parceiro, a indicação e o extrato do mês", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const novo = { tipo: "ADMINISTRADORA", nome: "Marta Lins", whatsapp: "(61) 98888-7777", email: "Marta@Exemplo.com.br" };
  assertEquals((await m.pedir("/v1/comercial/parceiros", { cookie, corpo: novo })).status, 201);
  const s = chamada(m, "comercial_salvar_parceiro")!;
  assertEquals([s.p_id, s.p_versao, (s.p_dados as Record<string, unknown>).whatsapp, (s.p_dados as Record<string, unknown>).email],
    [null, null, "5561988887777", "marta@exemplo.com.br"]);
  assertEquals((await erro(await m.pedir(`/v1/comercial/parceiros/${MARTA}`, { cookie, metodo: "PUT", corpo: novo }))).detalhes?.campos, ["versao"]);
  assertEquals((await m.pedir(`/v1/comercial/parceiros/${MARTA}`, { cookie, metodo: "PUT", corpo: { ...novo, versao: 2, ativo: false } })).status, 200);
  assertEquals((await erro(await m.pedir("/v1/comercial/parceiros", { cookie, corpo: { ...novo, tipo: "AMIGO" } }))).detalhes?.campos, ["tipo"]);

  const indicacao = { condominio: "Edifício Ipê", pessoa: "Paulo Dias", whatsapp: "61999990501", contatoAceito: true };
  assertEquals((await m.pedir(`/v1/comercial/parceiros/${MARTA}/indicar`, { cookie, corpo: { ...indicacao, origem: "SITE" } })).status, 201);
  const i = chamada(m, "comercial_indicar")!;
  assertEquals([i.p_parceiro, (i.p_dados as Record<string, unknown>).whatsapp, "origem" in (i.p_dados as object)], [MARTA, "5561999990501", false]);
  // O novo interessado com a origem Parceiro e o parceiro escolhido também é indicação.
  await m.pedir("/v1/comercial/interessados", { cookie, corpo: { ...indicacao, origem: "PARCEIRO", parceiroId: MARTA } });
  assertEquals([chamada(m, "comercial_indicar")!.p_parceiro, "origem" in (chamada(m, "comercial_indicar")!.p_dados as object)], [MARTA, false]);
  assertEquals((await erro(await m.pedir("/v1/comercial/interessados", { cookie, corpo: { ...indicacao, origem: "INDICACAO", parceiroId: MARTA } })))
    .detalhes?.campos, ["parceiroId"]);

  await m.pedir("/v1/comercial/parceiros?mes=2026-10", { cookie });
  assertEquals(chamada(m, "comercial_parceiros"), { p_pessoa: CAROLINA, p_mes: "2026-10-01" });
  await m.pedir("/v1/comercial/parceiros", { cookie });
  assertEquals(chamada(m, "comercial_parceiros")!.p_mes, null);
  assertEquals((await erro(await m.pedir("/v1/comercial/parceiros?mes=2026-13", { cookie }))).detalhes?.campos, ["mes"]);
  await m.pedir(`/v1/comercial/parceiros/${MARTA}/extrato?mes=2026-11`, { cookie });
  assertEquals(chamada(m, "comercial_extrato_parceiro"), { p_pessoa: CAROLINA, p_parceiro: MARTA, p_mes: "2026-11-01" });
});

Deno.test("0310: a regra, o pagamento registrado, o encerramento e apagar o parceiro", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/comercial/comissao/regra", { cookie, metodo: "PUT", corpo: { versao: 1, percentual: 12.5, prazoMeses: 24 } })).status, 200);
  assertEquals(chamada(m, "comercial_salvar_regra_comissao"), { p_pessoa: CAROLINA, p_versao: 1, p_percentual: 12.5, p_prazo_meses: 24 });
  assertEquals((await erro(await m.pedir("/v1/comercial/comissao/regra", { cookie, metodo: "PUT", corpo: { versao: 1, percentual: 0 } }))).codigo,
    "VALIDATION_ERROR");

  const pago = await m.pedir(`/v1/comercial/parceiros/${MARTA}/pagamentos`, { cookie, corpo: { mes: "2026-10", valor: 2800, pagoEm: "2026-10-30", observacao: "Pix" } });
  assertEquals([pago.status, (await pago.json()).diferenca], [201, 63]);
  assertEquals(chamada(m, "comercial_registrar_pagamento"), {
    p_pessoa: CAROLINA, p_parceiro: MARTA, p_mes: "2026-10-01", p_valor: 2800, p_pago_em: "2026-10-30", p_observacao: "Pix",
  });
  assertEquals((await erro(await m.pedir(`/v1/comercial/parceiros/${MARTA}/pagamentos`, { cookie, corpo: { mes: "2026-10", valor: 9999, pagoEm: "2026-10-30" } })))
    .detalhes?.motivo, "PAGAMENTO_REGISTRADO");
  assertEquals((await erro(await m.pedir(`/v1/comercial/parceiros/${MARTA}/pagamentos`, { cookie, corpo: { mes: "2026-10", valor: 1.5, pagoEm: "2026-10-30" } })))
    .detalhes?.campos, ["valor"]);

  await m.pedir(`/v1/comercial/comissoes/${COMISSAO}/encerrar`, { cookie, corpo: { versao: 1, desde: "2027-03", motivo: "Trocou de sistema" } });
  assertEquals(chamada(m, "comercial_encerrar_comissao"), { p_pessoa: CAROLINA, p_id: COMISSAO, p_versao: 1, p_desde: "2027-03-01", p_motivo: "Trocou de sistema" });
  assertEquals((await m.pedir(`/v1/comercial/parceiros/${MARTA}/apagar`, { cookie, corpo: {} })).status, 200);
  assertEquals(chamada(m, "comercial_apagar_parceiro"), { p_pessoa: CAROLINA, p_id: MARTA });
});

Deno.test("0310: a agenda da equipe: horários, bloqueios, link e demonstrações", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/comercial/agenda", { cookie })).status, 200);
  const disp = { faixas: [{ dia: 2, de: "09:00", ate: "12:00" }], salaUrl: "https://meet.exemplo.com/abc" };
  await m.pedir(`/v1/comercial/agenda/disponibilidade/${CAROLINA}`, { cookie, metodo: "PUT", corpo: disp });
  const d = chamada(m, "comercial_salvar_disponibilidade")!;
  assertEquals([d.p_de, d.p_versao, (d.p_dados as Record<string, unknown>).duracaoMinutos, "versao" in (d.p_dados as object)], [CAROLINA, null, 30, false]);
  assertEquals((await erro(await m.pedir(`/v1/comercial/agenda/disponibilidade/${CAROLINA}`, { cookie, metodo: "PUT",
    corpo: { faixas: [{ dia: 9, de: "09:00", ate: "12:00" }] } }))).codigo, "VALIDATION_ERROR");

  await m.pedir("/v1/comercial/agenda/bloqueios", { cookie, corpo: { pessoaId: CAROLINA, de: "2026-10-27T09:00:00-03:00", ate: "2026-10-27T12:00:00-03:00", motivo: "Folga" } });
  assertEquals(chamada(m, "comercial_bloquear_agenda"), {
    p_pessoa: CAROLINA, p_de: CAROLINA, p_inicio: "2026-10-27T09:00:00-03:00", p_fim: "2026-10-27T12:00:00-03:00", p_motivo: "Folga",
  });
  await m.pedir("/v1/comercial/agenda/bloqueios/" + DEMO + "/cancelar", { cookie, corpo: {} });
  assertEquals(chamada(m, "comercial_desbloquear_agenda"), { p_pessoa: CAROLINA, p_id: DEMO });
  await m.pedir("/v1/comercial/agenda/links", { cookie, corpo: { pessoaId: "", trocar: true } });
  assertEquals(chamada(m, "comercial_link_agenda"), { p_pessoa: CAROLINA, p_de: null, p_trocar: true });

  assertEquals((await m.pedir(`/v1/comercial/interessados/${AROEIRA}/demonstracoes`, { cookie, corpo: { inicio: "2026-10-28T10:00:00-03:00" } })).status, 201);
  assertEquals((chamada(m, "comercial_marcar_demonstracao")!.p_dados as Record<string, unknown>).avisar, true);
  await m.pedir(`/v1/comercial/demonstracoes/${DEMO}/remarcar`, { cookie, corpo: { versao: 1, inicio: "2026-10-29T10:00:00-03:00", avisar: false } });
  assertEquals(chamada(m, "comercial_remarcar_demonstracao")!.p_versao, 1);
  assertEquals((await erro(await m.pedir(`/v1/comercial/demonstracoes/${DEMO}/feita`, { cookie, corpo: { versao: 2, resumo: "Gostaram" } }))).codigo,
    "VALIDATION_ERROR");
  const feita = await m.pedir(`/v1/comercial/demonstracoes/${DEMO}/feita`, { cookie,
    corpo: { versao: 2, resumo: "Gostaram do link sem app", proximoPasso: "Mandar a proposta", proximoPassoData: "2026-10-30" } });
  assertEquals((await feita.json()).interessadoVersao, 7);
  assertEquals((await erro(await m.pedir(`/v1/comercial/demonstracoes/${DEMO}/encerrar`, { cookie, corpo: { versao: 3, situacao: "CANCELADA" } }))).detalhes?.campos,
    ["motivo"]);
  await m.pedir(`/v1/comercial/demonstracoes/${DEMO}/encerrar`, { cookie, corpo: { versao: 3, situacao: "CANCELADA", motivo: "O síndico viajou", avisar: true } });
  assertEquals(chamada(m, "comercial_encerrar_demonstracao"), {
    p_pessoa: CAROLINA, p_id: DEMO, p_versao: 3, p_situacao: "CANCELADA", p_motivo: "O síndico viajou", p_avisar: true,
  });
  assert(Object.keys(SITUACOES_DEMONSTRACAO).includes("NAO_COMPARECEU"));
});

Deno.test("0310: o link de agendamento abre sem sessão, com limite por aparelho", async () => {
  const m = montar();
  const r = await m.pedir(`/v1/publico/agenda/${CODIGO}`);
  assertEquals([r.status, (await r.json()).duracaoMinutos], [200, 30]);
  assertEquals((await m.pedir("/v1/publico/agenda/CURTO")).status, 404);
  assertEquals((await m.pedir("/v1/publico/agenda/abc23def45g1")).status, 404);
  assertEquals((await m.pedir(`/v1/publico/agenda/${CODIGO}`, { segredo: null })).status, 403);
  const pedidoAgenda = { inicio: "2026-10-27T14:00:00-03:00", nome: "Rita Dias", whatsapp: "61 99999-0701", email: "Rita@Exemplo.com.br",
                         condominio: "Edifício Sucupira", faixa: "DE_41_A_100", consentimento: true };
  const ag = await m.pedir(`/v1/publico/agenda/${CODIGO}`, { corpo: pedidoAgenda });
  assertEquals([ag.status, (await ag.json()).quando], [201, "terça, 27/10, 14:00"]);
  const a = chamada(m, "publico_agendar")!;
  assertEquals([a.p_codigo, (a.p_dados as Record<string, unknown>).whatsapp, (a.p_dados as Record<string, unknown>).email], [CODIGO, "5561999990701", "rita@exemplo.com.br"]);
  // O limite de agendamentos por aparelho (1 no teste) vem antes de olhar a entrada.
  assertEquals((await erro(await m.pedir(`/v1/publico/agenda/${CODIGO}`, { corpo: { ...pedidoAgenda, inicio: "2026-10-27T14:45:00-03:00" } }))).codigo, "RATE_LIMITED");
});

Deno.test("0310: dois agendamentos no mesmo horário: o segundo recebe HORARIO_OCUPADO", async () => {
  const m = montar();
  const pedidoAgenda = { inicio: "2026-10-27T14:45:00-03:00", nome: "Rita Dias", whatsapp: "61999990701", email: "rita@exemplo.com.br",
                         condominio: "Edifício Sucupira", consentimento: true };
  const e = await erro(await m.pedir(`/v1/publico/agenda/${CODIGO}`, { corpo: pedidoAgenda }));
  assertEquals([e.codigo, e.detalhes?.motivo], ["VALIDATION_ERROR", "HORARIO_OCUPADO"]);
});

Deno.test("0310: a calculadora do site fica fora do repasse, com o segredo do site e limite", async () => {
  const m = montar();
  assertEquals((await m.site("calculadora", { unidades: 64 }, null)).status, 403);
  assertEquals((await m.site("calculadora", { unidades: 64 }, "errado")).status, 403);
  const r = await m.site("calculadora", { unidades: "64" });
  assertEquals([r.status, (await r.json()).porApartamento], [200, 358]);
  assertEquals(chamada(m, "comercial_calculadora_site"), { p_unidades: 64 });
  assertEquals((await erro(await m.site("calculadora", { unidades: 0 }))).codigo, "VALIDATION_ERROR");
  assertEquals((await erro(await m.site("calculadora", { unidades: 30 }))).codigo, "RATE_LIMITED");
});

Deno.test("0310: o pedido de proposta da calculadora leva as unidades e a taxa, quando informada", async () => {
  const m = montar();
  const pedido = { nome: "Paulo Dias", whatsapp: "5561999990401", condominio: "Edifício Aroeira", consentimento: true, pedido: "PROPOSTA", unidades: 64 };
  assertEquals((await m.site("interessados", { ...pedido, taxaCondominio: 650 })).status, 201);
  assertEquals(chamada(m, "comercial_entrada_site")!.p_dados, { ...pedido, email: null, faixa: null, unidadesTexto: null, consentimentoTexto: null, pagina: null,
                                                                 utm: null, taxaCondominio: 650 });
  await m.site("interessados", { ...pedido, whatsapp: "5561999990402" });
  assert(!("taxaCondominio" in (chamada(m, "comercial_entrada_site")!.p_dados as object)));
  assertEquals((await erro(await m.site("interessados", { ...pedido, whatsapp: "5561999990403", taxaCondominio: 20001 }))).detalhes?.campos, ["taxaCondominio"]);
});

Deno.test("0310: a taxa na ficha, na versão e no kit (R17.3c)", async () => {
  const m = montar();
  const cookie = await entrar(m);
  await m.pedir(`/v1/comercial/interessados/${AROEIRA}`, { cookie, metodo: "PUT", corpo: { versao: 3, condominio: "Edifício Aroeira", whatsapp: "61999990401" } });
  assert(!("taxaCondominioMedia" in (chamada(m, "comercial_salvar")!.p_dados as object)), "sem o campo, a taxa não muda");
  await m.pedir(`/v1/comercial/interessados/${AROEIRA}`, { cookie, metodo: "PUT",
    corpo: { versao: 3, condominio: "Edifício Aroeira", whatsapp: "61999990401", taxaCondominioMedia: 650.5 } });
  assertEquals((chamada(m, "comercial_salvar")!.p_dados as Record<string, unknown>).taxaCondominioMedia, 650.5);

  await m.pedir("/v1/comercial/propostas", { cookie, corpo: { interessadoId: AROEIRA } });
  assert(!("taxaCondominio" in (chamada(m, "comercial_criar_proposta")!.p_dados as object)), "sem o campo, a versão usa a taxa da ficha");
  await m.pedir("/v1/comercial/propostas/" + AROEIRA + "/versoes", { cookie, corpo: { versao: 1, taxaCondominio: 700 } });
  assertEquals((chamada(m, "comercial_nova_versao")!.p_dados as Record<string, unknown>).taxaCondominio, 700);
  await m.pedir("/v1/comercial/propostas/" + AROEIRA + "/versoes", { cookie, corpo: { versao: 1, taxaCondominio: null } });
  assertEquals((chamada(m, "comercial_nova_versao")!.p_dados as Record<string, unknown>).taxaCondominio, null);
  assertEquals((await erro(await m.pedir("/v1/comercial/propostas", { cookie, corpo: { interessadoId: AROEIRA, taxaCondominio: 0 } }))).detalhes?.campos,
    ["taxaCondominio"]);

  const t = await m.pedir(`/v1/comercial/interessados/${AROEIRA}/taxa`, { cookie, metodo: "PUT", corpo: { versao: 5, taxaCondominio: 650 } });
  assertEquals([t.status, (await t.json()).versao], [200, 6]);
  assertEquals(chamada(m, "comercial_salvar_taxa"), { p_pessoa: CAROLINA, p_id: AROEIRA, p_versao: 5, p_taxa: 650 });
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/taxa`, { cookie, metodo: "PUT", corpo: { versao: 5, taxaCondominio: 650.123 } })))
    .detalhes?.campos, ["taxaCondominio"]);
});

Deno.test("0310: a fila da agenda sai pelo Resend; sem a chave, registra e não falha", async () => {
  const enviados: EmailPronto[] = [];
  const correio: Correio = {
    enviarLote(emails) {
      enviados.push(...emails);
      return Promise.resolve(emails.map((_, i) => (i === 0 ? { ok: true as const, id: "re_1" } : { ok: false as const, erro: "Resend respondeu 500", tentarDeNovo: true })));
    },
  };
  const m = montar({ correio });
  assertEquals((await m.pedir("/v1/interno/fila-comercial", { corpo: {}, segredo: null })).status, 403);
  const r = await m.pedir("/v1/interno/fila-comercial", { corpo: {} });
  assertEquals((await r.json()).enviados, 1);
  assertEquals(enviados.map((e) => [e.para, e.assunto]), [
    ["rita@exemplo.com.br", "Demonstração confirmada: terça, 27/10, 14:00"],
    ["joao@exemplo.com.br", "Lembrete: demonstração da TRÍADE quarta, 28/10, 09:00"],
  ]);
  assert(enviados[0]!.texto.includes("https://meet.exemplo.com/abc"));
  assertEquals(enviados[0]!.responderPara, "comercial@triade.exemplo");
  const resultados = m.chamadas.filter((c) => c.funcao === "comercial_email_resultado").map((c) => c.args);
  assertEquals(resultados, [
    { p_id: EMAIL1, p_provedor_id: "re_1", p_erro: null, p_tentar_de_novo: false },
    { p_id: EMAIL2, p_provedor_id: null, p_erro: "Resend respondeu 500", p_tentar_de_novo: true },
  ]);

  const semChave = montar();
  assertEquals(await (await semChave.pedir("/v1/interno/fila-comercial", { corpo: {} })).json(), { enviados: 0, semChave: 2 });
  assert(!semChave.chamadas.some((c) => c.funcao === "comercial_emails_pegar"));
});

Deno.test("0310: o e-mail da agenda: cancelamento com o motivo e sem quem responder", () => {
  const e = montarEmailComercial({ id: EMAIL1, tipo: "CANCELAMENTO", para: "rita@exemplo.com.br", nome: "Rita Dias", condominio: "Edifício <Sucupira>",
                                   inicio: "x", fim: "y", quando: "terça, 27/10, 14:00", duracaoMinutos: 30, motivo: "O síndico viajou" });
  assertEquals(e.assunto, "Demonstração cancelada: terça, 27/10, 14:00");
  assert(e.texto.includes("Motivo: O síndico viajou."));
  assert(e.texto.includes("fale com a equipe da TRÍADE"));
  assert(e.html.includes("Edifício &lt;Sucupira&gt;"));
  assertEquals(e.responderPara, undefined);
  assertEquals(e.marcas.condominio, "comercial");
});
