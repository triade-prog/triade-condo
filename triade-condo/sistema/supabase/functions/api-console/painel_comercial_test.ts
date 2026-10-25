// Painel comercial, janelas e o cartão do Início (0309, R17.5; CM-10, CM-18, CM-04): as rotas
// validam a entrada e levam a pessoa da sessão; quem vê, quem muda a meta e os números saem do banco.
import { assertEquals } from "@std/assert";
import { criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const BIANCA = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const AROEIRA = "4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b7c";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };

function montar() {
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2, site: 2 }),
    comercial_painel: (a) => ({ mes: a.p_mes ? String(a.p_mes).slice(0, 7) : "2026-10", novos: 0, podeMudarMeta: true }),
    comercial_salvar_meta: (a) => (a.p_mes === "2026-09-01"
      ? erroBanco("TC422", { motivo: "META_MES_PASSADO" })
      : { mes: String(a.p_mes).slice(0, 7), versao: a.p_versao ? Number(a.p_versao) + 1 : 1 }),
    comercial_inicio: () => ({ total: 0, contagens: { primeiroRetorno: 0, atrasados: 0, parados: 0, janelas: 0 }, itens: [], max: 8, podeEditar: true }),
    comercial_janelas_ficha: () => ({ id: AROEIRA, versao: 3, etapa: "PERDIDO", janelas: [], podeEditar: true }),
    comercial_tratar_janela: (a) => ({ id: AROEIRA, tipo: a.p_tipo, data: a.p_data, tratada: true }),
    comercial_sindico_novo: (a) => (a.p_versao === 1 ? erroBanco("TC409", {}) : { id: AROEIRA, versao: 4, lembrar: true }),
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

Deno.test("0309: painel, Início e janelas pedem a sessão completa", async () => {
  const m = montar();
  for (const rota of ["/v1/comercial/painel", "/v1/comercial/inicio", `/v1/comercial/interessados/${AROEIRA}/janelas`]) {
    assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
  }
  assertEquals((await erro(await m.pedir("/v1/comercial/painel/meta", { metodo: "PUT", corpo: {} }))).codigo, "UNAUTHORIZED");
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/sindico-novo`, { corpo: {} }))).codigo, "UNAUTHORIZED");
});

Deno.test("0309: o painel lê o mês pedido, com a pessoa da sessão", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/comercial/painel", { cookie })).status, 200);
  assertEquals(chamada(m, "comercial_painel"), { p_pessoa: CAROLINA, p_mes: null });
  const r = await m.pedir("/v1/comercial/painel?mes=2026-09", { cookie });
  assertEquals((await r.json()).mes, "2026-09");
  assertEquals(chamada(m, "comercial_painel"), { p_pessoa: CAROLINA, p_mes: "2026-09-01" });
  for (const ruim of ["2026-13", "setembro", "2026-9"]) {
    const e = await erro(await m.pedir(`/v1/comercial/painel?mes=${ruim}`, { cookie }));
    assertEquals([e.codigo, e.detalhes?.campos], ["VALIDATION_ERROR", ["mes"]], ruim);
  }
});

Deno.test("0309: a meta do mês valida o corpo e devolve a recusa do banco", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const meta = { mes: "2026-10", total: 500000, porPessoa: [{ pessoaId: BIANCA, centavos: 300000 }] };
  const r = await m.pedir("/v1/comercial/painel/meta", { cookie, metodo: "PUT", corpo: meta });
  assertEquals([r.status, await r.json()], [200, { mes: "2026-10", versao: 1 }]);
  assertEquals(chamada(m, "comercial_salvar_meta"), {
    p_pessoa: CAROLINA, p_mes: "2026-10-01", p_versao: null, p_total: 500000, p_por_pessoa: [{ pessoaId: BIANCA, centavos: 300000 }],
  });
  await m.pedir("/v1/comercial/painel/meta", { cookie, metodo: "PUT", corpo: { mes: "2026-11", versao: 2, total: 1 } });
  assertEquals(chamada(m, "comercial_salvar_meta")?.p_por_pessoa, []);
  for (const [ruim, campo] of [[{ ...meta, total: 0 }, "total"], [{ ...meta, mes: "2026-1" }, "mes"],
                               [{ ...meta, porPessoa: [{ pessoaId: BIANCA, centavos: 1 }, { pessoaId: BIANCA, centavos: 2 }] }, "porPessoa"],
                               [{ ...meta, porPessoa: [{ pessoaId: "x", centavos: 1 }] }, "porPessoa"]] as const) {
    const e = await erro(await m.pedir("/v1/comercial/painel/meta", { cookie, metodo: "PUT", corpo: ruim }));
    assertEquals([e.codigo, e.detalhes?.campos], ["VALIDATION_ERROR", [campo]], JSON.stringify(ruim));
  }
  const passado = await erro(await m.pedir("/v1/comercial/painel/meta", { cookie, metodo: "PUT", corpo: { ...meta, mes: "2026-09" } }));
  assertEquals(passado.detalhes?.motivo, "META_MES_PASSADO");
});

Deno.test("0309: o Início e as janelas da ficha levam só a pessoa da sessão", async () => {
  const m = montar();
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/comercial/inicio", { cookie })).status, 200);
  assertEquals(chamada(m, "comercial_inicio"), { p_pessoa: CAROLINA });
  assertEquals((await m.pedir(`/v1/comercial/interessados/${AROEIRA}/janelas`, { cookie })).status, 200);
  assertEquals(chamada(m, "comercial_janelas_ficha"), { p_pessoa: CAROLINA, p_id: AROEIRA });
  assertEquals((await m.pedir("/v1/comercial/interessados/nao-e-id/janelas", { cookie })).status, 404);
});

Deno.test("0309: tratar a janela e registrar o síndico novo", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const t = await m.pedir(`/v1/comercial/interessados/${AROEIRA}/janelas/tratar`, { cookie, corpo: { tipo: "ASSEMBLEIA", data: "2026-11-28" } });
  assertEquals(t.status, 200);
  assertEquals(chamada(m, "comercial_tratar_janela"), { p_pessoa: CAROLINA, p_id: AROEIRA, p_tipo: "ASSEMBLEIA", p_data: "2026-11-28" });
  const e = await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/janelas/tratar`, { cookie, corpo: { tipo: "OUTRA", data: "2026-11-28" } }));
  assertEquals([e.codigo, e.detalhes?.campos], ["VALIDATION_ERROR", ["tipo"]]);

  const s = await m.pedir(`/v1/comercial/interessados/${AROEIRA}/sindico-novo`, { cookie, corpo: { versao: 3, desde: "2026-10-10", mandatoAte: "2028-10-09" } });
  assertEquals([s.status, (await s.json()).lembrar], [200, true]);
  assertEquals(chamada(m, "comercial_sindico_novo"), { p_pessoa: CAROLINA, p_id: AROEIRA, p_versao: 3, p_desde: "2026-10-10", p_mandato_ate: "2028-10-09" });
  await m.pedir(`/v1/comercial/interessados/${AROEIRA}/sindico-novo`, { cookie, corpo: { versao: 3, desde: "", mandatoAte: null } });
  assertEquals(chamada(m, "comercial_sindico_novo"), { p_pessoa: CAROLINA, p_id: AROEIRA, p_versao: 3, p_desde: null, p_mandato_ate: null });
  const ruim = await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/sindico-novo`, { cookie, corpo: { versao: 3, desde: "2026-10-10", mandatoAte: "2026-10-01" } }));
  assertEquals([ruim.codigo, ruim.detalhes?.campos], ["VALIDATION_ERROR", ["mandatoAte"]]);
  assertEquals((await erro(await m.pedir(`/v1/comercial/interessados/${AROEIRA}/sindico-novo`, { cookie, corpo: { versao: 1 } }))).codigo, "VERSION_CONFLICT");
});
