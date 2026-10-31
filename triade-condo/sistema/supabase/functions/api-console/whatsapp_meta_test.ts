// WhatsApp oficial pela Meta no Console (0315; W-01, W-20, DC4): a equipe liga ao cliente a conta
// que chegou do cadastro da Meta. A API pega o token da conta, assina os avisos, registra o número
// com um PIN novo, guarda tudo cifrado e manda os modelos que faltam; o token nunca volta.
import { assert, assertEquals } from "@std/assert";
import { criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";
import { clienteMeta } from "../_shared/meta.ts";
import { chaveCredenciais, decifrarCredenciais } from "../_shared/whatsapp.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };
const CHAVE = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)));
const WABA = "5566778899";

async function montar(numeros: unknown[] = [{ id: "1403308709535370", display_phone_number: "+55 61 3333-4444", verified_name: "Residencial Ipê",
                                              quality_rating: "GREEN", messaging_limit_tier: "TIER_250" }]) {
  const chave = await chaveCredenciais(CHAVE);
  let guardado: string | null = null;
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    console_contas_meta: () => ({ esperando: [{ wabaId: WABA }], ligadas: [], terminaram: [], pode: { ligar: true } }),
    console_whatsapp_meta: () => ({ ligada: false }),
    console_meta_preparar: (a) => ({ wabaId: a.p_waba, empresaId: "4433221100" }),
    console_ligar_conta_meta: (a) => {
      guardado = String(a.p_credenciais);
      return { provedor: "META", situacao: "CONECTADO" };
    },
    console_meta_acesso: () => ({ wabaId: WABA, numeroId: "1403308709535370",
                                  credenciais: btoa(String.fromCharCode(...guardado!.slice(2).match(/../g)!.map((h) => parseInt(h, 16)))) }),
    console_modelos_meta_faltando: () => [{ modeloId: "m1", chave: "noticia_pedido", nome: "noticia_pedido_1", idioma: "pt_BR",
                                            corpo: "Pedido {{1}}", variaveis: ["protocolo"] }],
    console_modelos_meta_enviados: (a) => ({ enviados: (a.p_resultados as unknown[]).length }),
  });
  const graph: { metodo: string; caminho: string; corpo: unknown }[] = [];
  const buscar = (async (entrada: URL | string, init?: RequestInit) => {
    await Promise.resolve();
    const url = new URL(String(entrada));
    const corpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    graph.push({ metodo: init?.method ?? "GET", caminho: url.pathname, corpo });
    if (url.pathname.endsWith("/system_user_access_tokens")) return Response.json({ access_token: "token-da-conta-do-ipe" });
    if (url.pathname.endsWith("/phone_numbers")) return Response.json({ data: numeros });
    if (url.pathname.endsWith("/message_templates")) return Response.json({ id: "778899", status: "PENDING" });
    if (url.pathname === `/v26.0/${WABA}`) return Response.json({ name: "Condomínio Residencial Ipê" });
    return Response.json({ success: true });
  }) as typeof fetch;
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
    meta: { cliente: clienteMeta({ segredoApp: "segredo-do-app", tokenSistema: "token-do-sistema", buscar, base: "https://graph.exemplo" }), chave },
  });
  return { pedir: pedido(app, "api-console"), chave, graph, guardado: () => guardado, ...db };
}

async function entrar(m: Awaited<ReturnType<typeof montar>>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}

Deno.test("as rotas da Meta no Console pedem a sessão completa", async () => {
  const m = await montar();
  for (const rota of ["/v1/whatsapp/meta/contas", `/v1/clientes/${IPE}/whatsapp/meta`]) assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
});

Deno.test("W-01: ligar a conta pega o token, assina os avisos, registra o número e guarda tudo cifrado", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/whatsapp/meta/contas", { cookie })).json()).esperando, [{ wabaId: WABA }]);
  const r = await m.pedir(`/v1/clientes/${IPE}/whatsapp/meta/ligar`, { corpo: { wabaId: WABA }, cookie });
  assertEquals(r.status, 200);
  const corpo = await r.json();
  assertEquals(corpo.modelosEnviados, 1);
  assert(!JSON.stringify(corpo).includes("token-da-conta"));
  assertEquals(m.graph.map((g) => `${g.metodo} ${g.caminho}`), [
    "POST /v26.0/4433221100/system_user_access_tokens", `POST /v26.0/${WABA}/subscribed_apps`, `GET /v26.0/${WABA}/phone_numbers`,
    "POST /v26.0/1403308709535370/register", `GET /v26.0/${WABA}`, `POST /v26.0/${WABA}/message_templates`,
  ]);
  const pin = (m.graph[3]!.corpo as { pin: string }).pin;
  assert(/^[0-9]{6}$/.test(pin));
  const ligar = m.chamadas.find((c) => c.funcao === "console_ligar_conta_meta")!.args;
  assertEquals([ligar.p_numero_id, ligar.p_numero, ligar.p_nome_exibicao, ligar.p_qualidade, ligar.p_limite, ligar.p_nome_empresa],
               ["1403308709535370", "+556133334444", "Residencial Ipê", "VERDE", 250, "Condomínio Residencial Ipê"]);
  assert(!m.guardado()!.includes("token"));
  const hex = m.guardado()!.slice(2);
  const cred = await decifrarCredenciais(m.chave, btoa(String.fromCharCode(...hex.match(/../g)!.map((h) => parseInt(h, 16)))));
  assertEquals(cred, { instancia: WABA, token: "token-da-conta-do-ipe", pin });
  assertEquals(m.chamadas.find((c) => c.funcao === "console_modelos_meta_enviados")!.args.p_resultados,
               [{ modeloId: "m1", metaId: "778899", situacao: "PENDING" }]);
});

Deno.test("W-01: conta com mais de um número pede para escolher; número que não é da conta é recusado", async () => {
  const dois = [{ id: "11111", display_phone_number: "+55 61 3333-0001" }, { id: "22222", display_phone_number: "+55 61 3333-0002" }];
  const m = await montar(dois);
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir(`/v1/clientes/${IPE}/whatsapp/meta/ligar`, { corpo: { wabaId: WABA }, cookie }))).codigo, "VALIDATION_ERROR");
  assertEquals((await erro(await m.pedir(`/v1/clientes/${IPE}/whatsapp/meta/ligar`, { corpo: { wabaId: WABA, numeroId: "33333" }, cookie }))).codigo, "VALIDATION_ERROR");
  assertEquals(m.chamadas.some((c) => c.funcao === "console_ligar_conta_meta"), false);
  assertEquals((await m.pedir(`/v1/clientes/${IPE}/whatsapp/meta/ligar`, { corpo: { wabaId: WABA, numeroId: "22222" }, cookie })).status, 200);
  assertEquals((await erro(await m.pedir(`/v1/clientes/${IPE}/whatsapp/meta/ligar`, { corpo: { wabaId: "abc" }, cookie }))).codigo, "VALIDATION_ERROR");
});

Deno.test("W-20: a ficha manda de novo os modelos que faltam, com o token guardado", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  await m.pedir(`/v1/clientes/${IPE}/whatsapp/meta/ligar`, { corpo: { wabaId: WABA }, cookie });
  const r = await m.pedir(`/v1/clientes/${IPE}/whatsapp/meta/modelos`, { corpo: {}, cookie });
  assertEquals((await r.json()).modelosEnviados, 1);
  assertEquals(m.graph.filter((g) => g.caminho.endsWith("/message_templates")).length, 2);
});
