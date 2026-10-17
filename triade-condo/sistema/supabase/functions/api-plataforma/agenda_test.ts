// Agenda do condomínio (peça R7) na Plataforma do síndico. As rotas validam a entrada, mandam
// ao banco a pessoa e o condomínio da sessão e deixam a permissão e os conflitos para o banco.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido, armazenamentoFalso } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const VINCULO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const PEDIDO = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const COMPROMISSO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };

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
    plataforma_agenda_opcoes: () => ({ pessoas: [], unidades: [], pedidos: [], pode: { editar: true }, hoje: "2026-10-17" }),
    plataforma_agenda: () => ({ compromissos: [], datas: [], hoje: "2026-10-17", pode: { editar: true } }),
    plataforma_compromisso: (a) => ({ id: a.p_id }),
    plataforma_marcar_compromisso: () => ({ id: COMPROMISSO, datas: ["2026-10-20"], conflitos: [] }),
    plataforma_alterar_compromisso: (a) => ({ versao: Number(a.p_versao) + 1, alterados: 1, conflitos: [] }),
    plataforma_reagendar_compromisso: (a) => ({ versao: Number(a.p_versao) + 1, alterados: 1, conflitos: [] }),
    plataforma_situacao_compromisso: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_cancelar_compromisso: () => ({ cancelados: 1 }),
    plataforma_agenda_do_pedido: () => ({ podeVer: true, podeMarcar: true, compromissos: [], divergencia: null }),
  });
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo", armazenamento: armazenamentoFalso().armazenamento,
  });
  return { pedir: pedido(app, "api-plataforma"), ...db };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}

const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.find((c) => c.funcao === funcao)?.args;

Deno.test("AG-03: a agenda só com sessão, por um período de até 93 dias", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/agenda?de=2026-10-01&ate=2026-10-31"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/agenda?de=2026-10-01&ate=2026-10-31", { cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_agenda"), { p_pessoa: ANA, p_condominio: AURORA, p_de: "2026-10-01", p_ate: "2026-10-31" });
  m.chamadas.length = 0;
  const r = await m.pedir("/v1/condominio/agenda?de=2026-10-01&ate=2027-03-01", { cookie });
  assertEquals(r.status, 400);
  assertEquals((await erro(r)).detalhes?.campos, ["ate"]);
  assertEquals((await m.pedir("/v1/condominio/agenda", { cookie })).status, 400);
  assertEquals(chamada(m, "plataforma_agenda"), undefined);
});

Deno.test("AG-01: as opções e o compromisso pelo id da rota", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/condominio/agenda/opcoes", { cookie })).json()).hoje, "2026-10-17");
  assertEquals(await (await m.pedir(`/v1/condominio/agenda/${COMPROMISSO}`, { cookie })).json(), { id: COMPROMISSO });
  assertEquals((await m.pedir("/v1/condominio/agenda/x", { cookie })).status, 404);
});

Deno.test("AG-01, AG-05: marcar com repetição, os vazios viram nulo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = {
    tipo: "VISITA", titulo: "Encanador no apto 101", data: "2026-10-20", horaInicio: "14:00", horaFim: "15:00",
    onde: "AREA_COMUM", local: " Casa de bombas ", participantes: [VINCULO], pedidoId: PEDIDO, observacao: "",
    repetir: "SEMANAL", vezes: 4,
  };
  const r = await m.pedir("/v1/condominio/agenda", { corpo, cookie });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_marcar_compromisso"), {
    p_pessoa: ANA, p_condominio: AURORA, p_tipo: "VISITA", p_titulo: "Encanador no apto 101", p_data: "2026-10-20",
    p_inicio: "14:00", p_fim: "15:00", p_onde: "AREA_COMUM", p_unidade: null, p_local: "Casa de bombas",
    p_participantes: [VINCULO], p_de_fora: null, p_pedido: PEDIDO, p_observacao: null, p_estado: "PLANEJADO",
    p_repetir: "SEMANAL", p_intervalo: null, p_ate: null, p_vezes: 4, p_aceitar_conflito: false,
  });
  m.chamadas.length = 0;
  const ruim = await m.pedir("/v1/condominio/agenda", { corpo: { ...corpo, horaFim: "13:00", titulo: "x" }, cookie });
  assertEquals(ruim.status, 400);
  assertEquals((await erro(ruim)).detalhes?.campos, ["titulo", "horaFim"]);
  assertEquals(chamada(m, "plataforma_marcar_compromisso"), undefined);
});

Deno.test("AG-05: alterar, só esta ou esta e as próximas, com a versão lida", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const corpo = { versao: 2, tipo: "REUNIAO", titulo: "Reunião do conselho", escopo: "PROXIMAS" };
  assertEquals(await (await m.pedir(`/v1/condominio/agenda/${COMPROMISSO}`, { metodo: "PUT", corpo, cookie })).json(), { versao: 3, alterados: 1, conflitos: [] });
  const a = chamada(m, "plataforma_alterar_compromisso");
  assertEquals([a?.p_id, a?.p_versao, a?.p_escopo, a?.p_onde, a?.p_participantes], [COMPROMISSO, 2, "PROXIMAS", "NENHUM", []]);
  const r = await m.pedir(`/v1/condominio/agenda/${COMPROMISSO}`, { metodo: "PUT", corpo: { ...corpo, escopo: "TODAS" }, cookie });
  assertEquals((await erro(r)).detalhes?.campos, ["escopo"]);
});

Deno.test("AG-02: reagendar e cancelar pedem o motivo; a situação vai com a versão", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const base = `/v1/condominio/agenda/${COMPROMISSO}`;
  await m.pedir(`${base}/reagendar`, { corpo: { versao: 1, data: "2026-10-27", horaInicio: "09:00", motivo: "Chuva forte" }, cookie });
  assertEquals(chamada(m, "plataforma_reagendar_compromisso"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: COMPROMISSO, p_versao: 1, p_data: "2026-10-27", p_inicio: "09:00", p_fim: null,
    p_motivo: "Chuva forte", p_escopo: "ESTA", p_aceitar_conflito: false,
  });
  assertEquals((await erro(await m.pedir(`${base}/reagendar`, { corpo: { versao: 1, data: "2026-10-27" }, cookie }))).detalhes?.campos, ["motivo"]);
  assertEquals(await (await m.pedir(`${base}/situacao`, { corpo: { versao: 3, estado: "CONFIRMADO" }, cookie })).json(), { versao: 4 });
  assertEquals((await m.pedir(`${base}/situacao`, { corpo: { versao: 3, estado: "CANCELADO" }, cookie })).status, 400);
  await m.pedir(`${base}/cancelar`, { corpo: { versao: 4, motivo: "Não precisa mais", escopo: "PROXIMAS" }, cookie });
  assertEquals(chamada(m, "plataforma_cancelar_compromisso"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: COMPROMISSO, p_versao: 4, p_motivo: "Não precisa mais", p_escopo: "PROXIMAS",
  });
});

Deno.test("AG-09, MP-04: a agenda do pedido pelo id da rota", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/agenda`, { cookie })).json()).podeMarcar, true);
  assertEquals(chamada(m, "plataforma_agenda_do_pedido")?.p_id, PEDIDO);
});
