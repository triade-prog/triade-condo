// F0.6 e F0.3 na Plataforma do síndico: quem tem vínculo entra; o condomínio vem da sessão.
import { assertEquals, assertMatch } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const BELA_VISTA = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };

function montar(opcoes: { comAutenticador?: boolean } = {}) {
  const vinculos = new Set([AURORA]);
  const sessoes = new Map<string, string>();
  const falso = authFalso([
    { id: ANA, email: ENTRAR.email, senha: ENTRAR.senha, fatores: opcoes.comAutenticador ? [{ id: crypto.randomUUID(), verificado: true }] : [] },
  ]);
  const db = bancoFalso({
    acesso_plataforma: (a) => a.p_pessoa === ANA && vinculos.size > 0,
    registrar_acesso: () => 1,
    meus_condominios: () => [...vinculos].map((id) => ({ condominio_id: id, nome: id === AURORA ? "Residencial Aurora" : "Edifício Bela Vista", funcoes: ["SINDICO"] })),
    escolher_condominio: (a) => {
      if (!vinculos.has(String(a.p_condominio))) erroBanco("TC401");
      sessoes.set(String(a.p_sessao), String(a.p_condominio));
      return null;
    },
    condominio_da_sessao: (a) => {
      const c = sessoes.get(String(a.p_sessao));
      return c && vinculos.has(c) ? c : null;
    },
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3 }),
  });
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", { banco: db.banco, auth: falso.auth, urlApp: "https://plataforma.exemplo" });
  return { pedir: pedido(app, "api-plataforma"), vinculos, ...falso, ...db };
}

Deno.test("síndico sem autenticador entra só com a senha (o autenticador é obrigatório só para a equipe)", async () => {
  const m = montar();
  const r = await m.pedir("/v1/auth/entrar", { corpo: ENTRAR });
  assertEquals(await r.json(), { etapa: "PRONTO" });
  assertMatch(r.headers.get("set-cookie") ?? "", /^__Host-plataforma=v1\./);
  const s = await m.pedir("/v1/sessao", { cookie: cookieDe(r) });
  assertEquals(await s.json(), {
    pessoaId: ANA,
    condominioAtual: null,
    condominios: [{ id: AURORA, nome: "Residencial Aurora", funcoes: ["SINDICO"] }],
  });
});

Deno.test("quem cadastrou autenticador precisa do código em toda sessão", async () => {
  const m = montar({ comAutenticador: true });
  const r = await m.pedir("/v1/auth/entrar", { corpo: ENTRAR });
  assertEquals(await r.json(), { etapa: "CODIGO" });
  const aal1 = cookieDe(r);
  assertEquals((await erro(await m.pedir("/v1/sessao", { cookie: aal1 }))).codigo, "MFA_REQUIRED");
  const v = await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO }, cookie: aal1 });
  assertEquals((await m.pedir("/v1/sessao", { cookie: cookieDe(v) })).status, 200);
});

Deno.test("PT-01: sem condomínio escolhido na sessão, rota de dado do condomínio não abre", async () => {
  const m = montar();
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const r = await m.pedir("/v1/condominio", { cookie });
  assertEquals(r.status, 403);
  assertEquals((await erro(r)).codigo, "CONDOMINIO_REQUIRED");
});

Deno.test("PT-01: o condomínio fica na sessão do servidor; o navegador não o manda de novo", async () => {
  const m = montar();
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const e = await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  assertEquals(await e.json(), { condominioAtual: AURORA });
  const escolha = m.chamadas.find((c) => c.funcao === "escolher_condominio")!;
  assertEquals(escolha.args.p_pessoa, ANA);
  assertEquals(typeof escolha.args.p_sessao, "string");

  const r = await m.pedir("/v1/condominio", { cookie });
  assertEquals(await r.json(), { id: AURORA, nome: "Residencial Aurora", funcoes: ["SINDICO"] });
});

Deno.test("PT-01: escolher condomínio sem vínculo é recusado", async () => {
  const m = montar();
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const r = await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: BELA_VISTA }, cookie });
  assertEquals(r.status, 403);
  assertEquals((await erro(r)).codigo, "FORBIDDEN");
});

Deno.test("CF-04: vínculo revogado para na chamada seguinte", async () => {
  const m = montar();
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  m.vinculos.clear();
  assertEquals((await erro(await m.pedir("/v1/condominio", { cookie }))).codigo, "FORBIDDEN");
});

Deno.test("o cookie do Console não abre a Plataforma", async () => {
  const m = montar();
  const deLa = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR })).replace("__Host-plataforma", "__Host-console");
  assertEquals((await erro(await m.pedir("/v1/sessao", { cookie: deLa }))).codigo, "UNAUTHORIZED");
});
