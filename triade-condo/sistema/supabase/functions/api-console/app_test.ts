// F0.6 no Console TRÍADE: só a equipe ativa, sempre com o autenticador (PT-08).
import { assert, assertEquals, assertMatch } from "@std/assert";
import { criarApiConsole } from "./app.ts";
import { authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, limitesFalsos, pedido, TOKEN_RECUPERACAO, type UsuarioFalso } from "../_shared/teste_util.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const SINDICO = "1c8d4a1f-6e2b-4d3c-8f9a-2b3c4d5e6f7a";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };

function montar(opcoes: { equipe?: Set<string>; usuarios?: UsuarioFalso[] } = {}) {
  const equipe = opcoes.equipe ?? new Set([CAROLINA]);
  const usuarios = opcoes.usuarios ?? [
    { id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha },
    { id: SINDICO, email: "sindico@exemplo.invalid", senha: "senha-do-sindico" },
  ];
  const falso = authFalso(usuarios);
  const db = bancoFalso({
    acesso_console: (a) => equipe.has(String(a.p_pessoa)),
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3 }),
  });
  const app = criarApiConsole("segredo-de-repasse-de-teste", { banco: db.banco, auth: falso.auth, urlApp: "https://console.exemplo" });
  return { pedir: pedido(app, "api-console"), equipe, ...falso, ...db };
}

/** Senha, cadastro do autenticador e código: a sessão completa (aal2). */
async function entrarCompleto(m: ReturnType<typeof montar>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}

Deno.test("sem o segredo do repasse, nada responde", async () => {
  const r = await montar().pedir("/v1/saude", { segredo: null });
  assertEquals(r.status, 403);
  assertEquals(await erro(r), { codigo: "FORBIDDEN" });
});

Deno.test("senha certa da equipe: cookie __Host- seguro e pede o cadastro do autenticador", async () => {
  const m = montar();
  const r = await m.pedir("/v1/auth/entrar", { corpo: ENTRAR });
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { etapa: "CADASTRAR_AUTENTICADOR" });
  assertMatch(r.headers.get("set-cookie") ?? "", /^__Host-console=v1\.[A-Za-z0-9_-]+; Path=\/; Max-Age=43200; HttpOnly; Secure; SameSite=Strict$/);
  assertEquals(r.headers.get("cache-control"), "no-store");
});

Deno.test("PT-08: equipe sem o código do autenticador não passa de nenhuma rota", async () => {
  const m = montar();
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const r = await m.pedir("/v1/sessao", { cookie: aal1 });
  assertEquals(r.status, 403);
  assertEquals((await erro(r)).codigo, "MFA_REQUIRED");
});

Deno.test("com o autenticador cadastrado e o código certo, o Console abre", async () => {
  const m = montar();
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  const errado = await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: "000000", factorId }, cookie: aal1 });
  assertEquals((await erro(errado)).codigo, "MFA_INVALID");
  const certo = await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 });
  assertEquals(certo.status, 200);
  const r = await m.pedir("/v1/sessao", { cookie: cookieDe(certo) });
  assertEquals(await r.json(), { pessoaId: CAROLINA });
  assertEquals(m.acessos(), ["acesso.senha_conferida", "acesso.autenticador_cadastrado"]);

  // No login seguinte, já pede o código direto.
  assertEquals(await (await m.pedir("/v1/auth/entrar", { corpo: ENTRAR })).json(), { etapa: "CODIGO" });
});

Deno.test("senha errada: 401, conta a tentativa e não grava cookie", async () => {
  const m = montar();
  const r = await m.pedir("/v1/auth/entrar", { corpo: { ...ENTRAR, senha: "errada-errada" } });
  assertEquals(r.status, 401);
  assertEquals(await erro(r), { codigo: "INVALID_CREDENTIALS" });
  assertEquals(r.headers.get("set-cookie"), null);
  assert(m.chamadas.some((c) => c.funcao === "limite_contar" && c.args.p_tipo === "login"));
  assertEquals(m.acessos(), ["acesso.senha_errada"]);
});

Deno.test("quem não é da equipe responde igual a senha errada, e a sessão aberta é encerrada", async () => {
  const m = montar();
  const r = await m.pedir("/v1/auth/entrar", { corpo: { email: "sindico@exemplo.invalid", senha: "senha-do-sindico" } });
  assertEquals(await erro(r), { codigo: "INVALID_CREDENTIALS" });
  assertEquals(m.tokens.size, 0);
  assertEquals(m.acessos(), ["acesso.sem_acesso"]);
});

Deno.test("PT-08: limite de tentativas por e-mail + IP, sem nem conferir a senha", async () => {
  const m = montar();
  for (let i = 0; i < 5; i++) await m.pedir("/v1/auth/entrar", { corpo: { ...ENTRAR, senha: `errada-${i}` } });
  const r = await m.pedir("/v1/auth/entrar", { corpo: ENTRAR });
  assertEquals(r.status, 429);
  assertEquals((await erro(r)).codigo, "RATE_LIMITED");
  const chaves = m.chamadas.filter((c) => c.funcao === "limite_ok").map((c) => String(c.args.p_chave));
  assert(chaves.every((k) => /^[0-9a-f]{64}$/.test(k)), "a chave vai em hash, sem e-mail nem IP em claro");
});

Deno.test("PT-08: e-mail não verificado não entra", async () => {
  const m = montar({ usuarios: [{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha, emailVerificado: false }] });
  assertEquals((await erro(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }))).codigo, "EMAIL_NOT_VERIFIED");
});

Deno.test("equipe desativada perde o acesso na chamada seguinte", async () => {
  const m = montar();
  const cookie = await entrarCompleto(m);
  assertEquals((await m.pedir("/v1/sessao", { cookie })).status, 200);
  m.equipe.delete(CAROLINA);
  const r = await m.pedir("/v1/sessao", { cookie });
  assertEquals(r.status, 403);
  assertEquals((await erro(r)).codigo, "FORBIDDEN");
});

Deno.test("PT-08: sessões revogáveis — sair de todas encerra todos os aparelhos", async () => {
  const m = montar();
  const celular = await entrarCompleto(m);
  const computador = await entrarCompleto(m);
  const r = await m.pedir("/v1/auth/sair-de-todas", { corpo: {}, cookie: computador });
  assertEquals(r.status, 200);
  assertMatch(r.headers.get("set-cookie") ?? "", /^__Host-console=; Path=\/; Max-Age=0/);
  assertEquals((await erro(await m.pedir("/v1/sessao", { cookie: celular }))).codigo, "UNAUTHORIZED");
  assertEquals((await erro(await m.pedir("/v1/sessao", { cookie: computador }))).codigo, "UNAUTHORIZED");
});

Deno.test("PT-08: recuperação com resposta neutra, exista a conta ou não", async () => {
  const m = montar();
  const existe = await m.pedir("/v1/auth/recuperar", { corpo: { email: ENTRAR.email } });
  const naoExiste = await m.pedir("/v1/auth/recuperar", { corpo: { email: "ninguem@exemplo.invalid" } });
  assertEquals(existe.status, 200);
  assertEquals(naoExiste.status, 200);
  assertEquals(await existe.text(), await naoExiste.text());
});

Deno.test("PT-08: pedidos de recuperação acima do limite não disparam e-mail, e a resposta não muda", async () => {
  const m = montar();
  const respostas = new Set<string>();
  for (let i = 0; i < 5; i++) respostas.add(await (await m.pedir("/v1/auth/recuperar", { corpo: { email: ENTRAR.email } })).text());
  assertEquals(respostas.size, 1);
  assertEquals(m.recuperacoes.length, 3);
});

Deno.test("PT-08: redefinir com token de uso único derruba as sessões antigas", async () => {
  const m = montar();
  const antiga = await entrarCompleto(m);
  const r = await m.pedir("/v1/auth/redefinir", { corpo: { tokenHash: TOKEN_RECUPERACAO, novaSenha: "uma-senha-nova-forte" } });
  assertEquals(r.status, 200);
  assertEquals(m.senhasTrocadas, [CAROLINA]);
  assertEquals((await erro(await m.pedir("/v1/sessao", { cookie: antiga }))).codigo, "UNAUTHORIZED");
  assert(m.acessos().includes("acesso.senha_redefinida"));

  const deNovo = await m.pedir("/v1/auth/redefinir", { corpo: { tokenHash: TOKEN_RECUPERACAO, novaSenha: "outra-senha-nova-forte" } });
  assertEquals(deNovo.status, 410);
  assertEquals((await erro(deNovo)).codigo, "TOKEN_INVALID");
});

Deno.test("senha nova fraca ou curta é recusada", async () => {
  const m = montar();
  assertEquals((await erro(await m.pedir("/v1/auth/redefinir", { corpo: { tokenHash: TOKEN_RECUPERACAO, novaSenha: "curta" } }))).codigo, "VALIDATION_ERROR");
  assertEquals((await erro(await m.pedir("/v1/auth/redefinir", { corpo: { tokenHash: TOKEN_RECUPERACAO, novaSenha: "senha-vazada-conhecida" } }))).codigo, "PASSWORD_WEAK");
});
