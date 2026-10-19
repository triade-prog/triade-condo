// Vida em condomínio (peça R12): áreas comuns e reservas na Plataforma do síndico. As rotas
// validam a entrada, mandam ao banco a pessoa e o condomínio da sessão e deixam as regras para o banco.
import { assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido, armazenamentoFalso } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const AREA = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const UNIDADE = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const RESERVA = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
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
    plataforma_areas_comuns: () => ({ areas: [], documentos: [], pode: { editar: true } }),
    plataforma_salvar_area: (a) => ({ id: a.p_id ?? AREA, versao: a.p_versao ? Number(a.p_versao) + 1 : 1 }),
    plataforma_reservas: () => ({ reservas: [], aAprovar: 0, areas: [], hoje: "2026-10-19", pode: { editar: true } }),
    plataforma_reserva_opcoes: () => ({ areas: [], unidades: [], hoje: "2026-10-19" }),
    plataforma_conferir_reserva: () => ({ conferencia: { inicio: "10:00:00", fim: "23:00:00", tolerancia: false } }),
    plataforma_semana_area: () => ({ dias: [] }),
    plataforma_reserva: (a) => ({ reserva: { id: a.p_id } }),
    plataforma_registrar_reserva: () => ({ id: RESERVA, protocolo: "2026-R014", estado: "A_APROVAR" }),
    plataforma_aprovar_reserva: (a) => ({ versao: Number(a.p_versao) + 1, recusadas: 1 }),
    plataforma_recusar_reserva: (a) => ({ versao: Number(a.p_versao) + 1 }),
    plataforma_cancelar_reserva: (a) => ({ versao: Number(a.p_versao) + 1 }),
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

const SALAO = { nome: " Salão de festas ", reserva: "SINDICO", antecedenciaMin: 2, antecedenciaMax: 60, horaInicio: "10:00", horaFim: "23:00", ativa: true };

Deno.test("AC-07: criar e ajustar área comum; o banco recebe os campos já limpos", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/areas-comuns"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/areas-comuns", { corpo: SALAO, cookie })).status, 201);
  const a = chamada(m, "plataforma_salvar_area");
  assertEquals([a?.p_id, a?.p_versao], [null, null]);
  const d = a?.p_dados as Record<string, unknown>;
  assertEquals([d.nome, d.modo, d.cancelarSemAvisoDias, d.podeInquilino, d.blocoMinutos, "versao" in d], ["Salão de festas", "PERIODO", 3, true, null, false]);
  m.chamadas.length = 0;
  assertEquals((await erro(await m.pedir(`/v1/condominio/areas-comuns/${AREA}`, { metodo: "PUT", corpo: SALAO, cookie }))).detalhes?.campos, ["versao"]);
  assertEquals(await (await m.pedir(`/v1/condominio/areas-comuns/${AREA}`, { metodo: "PUT", corpo: { ...SALAO, versao: 2 }, cookie })).json(),
    { id: AREA, versao: 3 });
  const ruim = await m.pedir("/v1/condominio/areas-comuns", { corpo: { ...SALAO, horaFim: "09:00", modo: "BLOCOS" }, cookie });
  assertEquals((await erro(ruim)).detalhes?.campos, ["horaFim", "blocoMinutos"]);
});

Deno.test("AC-01: a lista de reservas pelo filtro e a semana da área", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/reservas", { cookie })).status, 200);
  assertEquals(chamada(m, "plataforma_reservas"), { p_pessoa: ANA, p_condominio: AURORA, p_filtro: "A_APROVAR", p_area: null });
  m.chamadas.length = 0;
  await m.pedir(`/v1/condominio/reservas?filtro=TODAS&areaId=${AREA}`, { cookie });
  assertEquals(chamada(m, "plataforma_reservas")?.p_area, AREA);
  assertEquals((await erro(await m.pedir("/v1/condominio/reservas?filtro=VELHAS", { cookie }))).detalhes?.campos, ["filtro"]);
  await m.pedir(`/v1/condominio/areas-comuns/${AREA}/semana?de=2026-10-19`, { cookie });
  assertEquals(chamada(m, "plataforma_semana_area"), { p_pessoa: ANA, p_condominio: AURORA, p_area: AREA, p_de: "2026-10-19" });
  assertEquals((await m.pedir(`/v1/condominio/areas-comuns/${AREA}/semana`, { cookie })).status, 400);
  await m.pedir(`/v1/condominio/reservas/conferir?areaId=${AREA}&unidadeId=${UNIDADE}&data=2026-10-25`, { cookie });
  assertEquals(chamada(m, "plataforma_conferir_reserva"), { p_pessoa: ANA, p_condominio: AURORA, p_area: AREA, p_unidade: UNIDADE, p_data: "2026-10-25" });
  assertEquals(await (await m.pedir(`/v1/condominio/reservas/${RESERVA}`, { cookie })).json(), { reserva: { id: RESERVA } });
  assertEquals((await m.pedir("/v1/condominio/reservas/x", { cookie })).status, 404);
});

Deno.test("AC-01: registrar pelo painel, aprovar com recado, recusar e cancelar com motivo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/reservas", { corpo: { areaId: AREA, unidadeId: UNIDADE, data: "2026-10-25", observacao: " " }, cookie });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_registrar_reserva"), {
    p_pessoa: ANA, p_condominio: AURORA, p_area: AREA, p_unidade: UNIDADE, p_contato: null, p_data: "2026-10-25", p_inicio: null, p_observacao: null,
  });
  const base = `/v1/condominio/reservas/${RESERVA}`;
  assertEquals(await (await m.pedir(`${base}/aprovar`, { corpo: { versao: 1, recado: "A chave fica na portaria." }, cookie })).json(), { versao: 2, recusadas: 1 });
  assertEquals(chamada(m, "plataforma_aprovar_reserva")?.p_recado, "A chave fica na portaria.");
  assertEquals((await erro(await m.pedir(`${base}/recusar`, { corpo: { versao: 1, motivo: " " }, cookie }))).detalhes?.campos, ["motivo"]);
  await m.pedir(`${base}/cancelar`, { corpo: { versao: 2, motivo: "Obra no salão" }, cookie });
  assertEquals(chamada(m, "plataforma_cancelar_reserva"), { p_pessoa: ANA, p_condominio: AURORA, p_id: RESERVA, p_versao: 2, p_motivo: "Obra no salão" });
});
