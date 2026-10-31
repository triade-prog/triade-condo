// Conferir na Meta e desligar o número na ficha do Console (0319, quadro 469; W-01, W-15, DC4).
// Conferir pergunta à Meta o cartão (health_status) e a qualidade do número com o token do
// condomínio; desligar tira o registro do número e só depois grava, com o motivo.
import { assert, assertEquals } from "@std/assert";
import { criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";
import { clienteMeta } from "../_shared/meta.ts";
import { chaveCredenciais, cifrarCredenciais } from "../_shared/whatsapp.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };
const CHAVE = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)));
const WABA = "5566778899";
const NUMERO = "1403308709535370";

const base64 = (hexBytea: string) => btoa(String.fromCharCode(...hexBytea.slice(2).match(/../g)!.map((h) => parseInt(h, 16))));

async function montar(o: { saude?: unknown; desregistrar?: { status: number; code: number } } = {}) {
  const chave = await chaveCredenciais(CHAVE);
  const credenciais = base64(await cifrarCredenciais(chave, { instancia: WABA, token: "token-do-condominio", pin: "123456" }));
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    console_meta_conferir_acesso: () => ({ wabaId: WABA, numeroId: NUMERO, credenciais }),
    console_meta_acesso: () => ({ wabaId: WABA, numeroId: NUMERO, credenciais }),
    console_meta_conferido: (a) => ({ conferidoEm: "2026-10-31T15:00:00Z", mudou: a.p_saude !== "OK", saude: a.p_saude }),
    console_meta_desligar: () => ({ desligadoEm: "2026-10-31T15:05:00Z" }),
  });
  const graph: { metodo: string; caminho: string; auth: string | null }[] = [];
  const buscar = (async (entrada: URL | string, init?: RequestInit) => {
    await Promise.resolve();
    const url = new URL(String(entrada));
    graph.push({ metodo: init?.method ?? "GET", caminho: url.pathname, auth: new Headers(init?.headers).get("authorization") });
    if (url.pathname === `/v26.0/${WABA}`) return Response.json({ health_status: o.saude ?? { can_send_message: "AVAILABLE" } });
    if (url.pathname === `/v26.0/${NUMERO}`) {
      return Response.json({ display_phone_number: "+55 61 3333-4444", verified_name: "Residencial Ipê", code_verification_status: "VERIFIED",
                             quality_rating: "YELLOW", messaging_limit_tier: "TIER_1K" });
    }
    if (url.pathname.endsWith("/deregister") && o.desregistrar) {
      return Response.json({ error: { code: o.desregistrar.code, message: "falhou" } }, { status: o.desregistrar.status });
    }
    return Response.json({ success: true });
  }) as typeof fetch;
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
    meta: { cliente: clienteMeta({ segredoApp: "segredo-do-app", tokenSistema: "token-do-sistema", buscar, base: "https://graph.exemplo" }), chave },
  });
  return { pedir: pedido(app, "api-console"), graph, ...db };
}

async function entrar(m: Awaited<ReturnType<typeof montar>>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}

Deno.test("conferir e desligar pedem a sessão completa", async () => {
  const m = await montar();
  for (const rota of ["conferir", "desligar"]) {
    assertEquals((await erro(await m.pedir(`/v1/clientes/${IPE}/whatsapp/meta/${rota}`, { corpo: {} }))).codigo, "UNAUTHORIZED", rota);
  }
});

Deno.test("W-15: conferir pergunta à Meta o cartão e o número, com o token do condomínio", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/clientes/${IPE}/whatsapp/meta/conferir`, { corpo: {}, cookie });
  assertEquals(r.status, 200);
  assertEquals((await r.json()).saude, "OK");
  assertEquals(m.graph.map((g) => `${g.metodo} ${g.caminho}`), [`GET /v26.0/${WABA}`, `GET /v26.0/${NUMERO}`]);
  assert(m.graph.every((g) => g.auth === "Bearer token-do-condominio"));
  const a = m.chamadas.find((c) => c.funcao === "console_meta_conferido")!.args;
  assertEquals([a.p_saude, a.p_qualidade, a.p_nome_exibicao, a.p_limite], ["OK", "AMARELO", "Residencial Ipê", 1000]);
});

Deno.test("W-15: conta sem cartão aparece como FALTA_CARTAO; bloqueada por outro motivo, como BLOQUEADA", async () => {
  const semCartao = await montar({ saude: { can_send_message: "BLOCKED", errors: [{ error_code: 141006, error_description: "No valid payment method" }] } });
  await semCartao.pedir(`/v1/clientes/${IPE}/whatsapp/meta/conferir`, { corpo: {}, cookie: await entrar(semCartao) });
  assertEquals(semCartao.chamadas.find((c) => c.funcao === "console_meta_conferido")!.args.p_saude, "FALTA_CARTAO");
  const bloqueada = await montar({ saude: { can_send_message: "AVAILABLE", entities: [{ can_send_message: "BLOCKED", errors: [{ error_code: 141010 }] }] } });
  await bloqueada.pedir(`/v1/clientes/${IPE}/whatsapp/meta/conferir`, { corpo: {}, cookie: await entrar(bloqueada) });
  assertEquals(bloqueada.chamadas.find((c) => c.funcao === "console_meta_conferido")!.args.p_saude, "BLOQUEADA");
});

Deno.test("W-01: desligar exige motivo, tira o registro na Meta e só então grava", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`/v1/clientes/${IPE}/whatsapp/meta/desligar`, { corpo: { motivo: "x" }, cookie }))).codigo, "VALIDATION_ERROR");
  assertEquals(m.graph.length, 0);
  const r = await m.pedir(`/v1/clientes/${IPE}/whatsapp/meta/desligar`, { corpo: { motivo: "Pedido da síndica" }, cookie });
  assertEquals(await r.json(), { desligadoEm: "2026-10-31T15:05:00Z" });
  assertEquals(m.graph.map((g) => `${g.metodo} ${g.caminho}`), [`POST /v26.0/${NUMERO}/deregister`]);
  assertEquals(m.chamadas.find((c) => c.funcao === "console_meta_desligar")!.args.p_motivo, "Pedido da síndica");
});

Deno.test("W-01: número que a Meta já não tinha desliga igual; a Meta fora do ar não grava nada", async () => {
  const jaSem = await montar({ desregistrar: { status: 400, code: 133010 } });
  assertEquals((await jaSem.pedir(`/v1/clientes/${IPE}/whatsapp/meta/desligar`, { corpo: { motivo: "Trocou de número" }, cookie: await entrar(jaSem) })).status, 200);
  const fora = await montar({ desregistrar: { status: 500, code: 1 } });
  const e = await erro(await fora.pedir(`/v1/clientes/${IPE}/whatsapp/meta/desligar`, { corpo: { motivo: "Trocou de número" }, cookie: await entrar(fora) }));
  assertEquals(e.codigo, "UPSTREAM_UNAVAILABLE");
  assertEquals(fora.chamadas.some((c) => c.funcao === "console_meta_desligar"), false);
});
