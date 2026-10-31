// A janela da Meta na Plataforma (0319, quadros 466 a 468; W-01, W-15, W-17, DC4): o síndico faz o
// cadastro dentro do app; a API troca o código pelo token do condomínio, assina os avisos e, com o
// número já confirmado, registra com PIN e liga ao condomínio da sessão. Sem a confirmação, o
// cadastro fica pendente até o código por SMS ou ligação; as recusas da Meta viram motivos.
import { assert, assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";
import { clienteMeta } from "../_shared/meta.ts";
import { chaveCredenciais, decifrarCredenciais } from "../_shared/whatsapp.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const CHAVE = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
const WABA = "1029384756";
const NUMERO = "1403308709535370";
const CADASTRO = { code: "AQB-codigo-da-janela-123", wabaId: WABA, numeroId: NUMERO, empresaId: "8877665544" };

type Falha = { status: number; code: number; message?: string };
interface Opcoes { confirmado?: boolean; troca?: Falha; registro?: Falha; verificar?: Falha; pedir?: Falha; saude?: unknown }

async function montar(o: Opcoes = {}) {
  const sessoes = new Map<string, string>();
  const chave = await chaveCredenciais(CHAVE);
  let pendente: Record<string, unknown> | null = null;
  let confirmado = o.confirmado ?? true;
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
    plataforma_meta_preparar: (a) => ({ wabaId: a.p_waba }),
    plataforma_meta_guardar_pendente: (a) => {
      const bytea = String(a.p_credenciais);
      pendente = { wabaId: a.p_waba, empresaId: a.p_empresa, numeroId: a.p_numero_id, numero: a.p_numero,
                   credenciais: btoa(String.fromCharCode(...bytea.slice(2).match(/../g)!.map((h) => parseInt(h, 16)))) };
      return { numero: a.p_numero };
    },
    plataforma_meta_pendente: () => pendente ?? (() => { throw new Error("sem pendente"); })(),
    plataforma_ligar_conta_meta: () => ({ provedor: "META", situacao: "CONECTADO" }),
    plataforma_modelos_meta_faltando: () => [{ modeloId: "m1", nome: "noticia_pedido_1", idioma: "pt_BR", corpo: "Pedido {{1}}", variaveis: ["protocolo"] }],
    plataforma_modelos_meta_enviados: (a) => ({ enviados: (a.p_resultados as unknown[]).length }),
  });
  const graph: { metodo: string; caminho: string; corpo: unknown; busca: URLSearchParams; auth: string | null }[] = [];
  const falhar = (f: Falha) => Response.json({ error: { code: f.code, message: f.message ?? "recusado" } }, { status: f.status });
  const buscar = (async (entrada: URL | string, init?: RequestInit) => {
    await Promise.resolve();
    const url = new URL(String(entrada));
    graph.push({ metodo: init?.method ?? "GET", caminho: url.pathname, corpo: init?.body ? JSON.parse(String(init.body)) : undefined,
                 busca: url.searchParams, auth: new Headers(init?.headers).get("authorization") });
    if (url.pathname.endsWith("/oauth/access_token")) return o.troca ? falhar(o.troca) : Response.json({ access_token: "token-do-condominio" });
    if (url.pathname === `/v26.0/${NUMERO}`) {
      return Response.json({ display_phone_number: "+55 61 3333-0101", verified_name: "Residencial Aurora",
                             code_verification_status: confirmado ? "VERIFIED" : "NOT_VERIFIED", quality_rating: "GREEN", messaging_limit_tier: "TIER_250" });
    }
    if (url.pathname.endsWith("/register") && o.registro) return falhar(o.registro);
    if (url.pathname.endsWith("/request_code") && o.pedir) return falhar(o.pedir);
    if (url.pathname.endsWith("/verify_code")) {
      if (o.verificar) return falhar(o.verificar);
      confirmado = true;
    }
    if (url.pathname === `/v26.0/${WABA}` && url.searchParams.get("fields") === "health_status") {
      return Response.json({ health_status: o.saude ?? { can_send_message: "AVAILABLE" } });
    }
    if (url.pathname === `/v26.0/${WABA}`) return Response.json({ name: "Condomínio Residencial Aurora" });
    if (url.pathname.endsWith("/message_templates")) return Response.json({ id: "778899", status: "PENDING" });
    return Response.json({ success: true });
  }) as typeof fetch;
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]).auth, admin: adminFalso().admin,
    urlApp: "https://plataforma.exemplo", armazenamento: armazenamentoFalso().armazenamento,
    meta: { cliente: clienteMeta({ segredoApp: "segredo-do-app", tokenSistema: "sistema", appId: "28914484134911319", buscar, base: "https://graph.exemplo" }),
            segredoApp: "segredo-do-app", verificacao: "v", chave },
  });
  return { pedir: pedido(app, "api-plataforma"), graph, chave, pendente: () => pendente, ...db };
}

async function entrar(m: Awaited<ReturnType<typeof montar>>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}
const caminhos = (m: Awaited<ReturnType<typeof montar>>) => m.graph.map((g) => `${g.metodo} ${g.caminho}`);
const motivo = async (r: Response) => ((await erro(r)).detalhes as { motivo?: string } | undefined)?.motivo;

Deno.test("a janela pede sessão e condomínio; corpo inválido não chega à Meta", async () => {
  const m = await montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/whatsapp/meta/cadastro", { corpo: CADASTRO }))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/condominio/whatsapp/meta/cadastro", { corpo: { ...CADASTRO, wabaId: "abc" }, cookie }))).codigo, "VALIDATION_ERROR");
  assertEquals((await erro(await m.pedir("/v1/condominio/whatsapp/meta/codigo", { corpo: { acao: "CONFIRMAR", codigo: "12a456" }, cookie }))).codigo, "VALIDATION_ERROR");
  assertEquals(m.graph.length, 0);
});

Deno.test("W-01: número confirmado liga na hora: troca o código, assina, registra com PIN, guarda o token cifrado e manda os modelos", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  const r = await m.pedir("/v1/condominio/whatsapp/meta/cadastro", { corpo: CADASTRO, cookie });
  assertEquals(r.status, 200);
  const corpo = await r.json();
  assertEquals([corpo.etapa, corpo.modelosEnviados, corpo.faltaCartao], ["LIGADO", 1, false]);
  assert(!JSON.stringify(corpo).includes("token-do-condominio"));
  assertEquals(caminhos(m), [
    "GET /v26.0/oauth/access_token", `POST /v26.0/${WABA}/subscribed_apps`, `GET /v26.0/${NUMERO}`, `POST /v26.0/${NUMERO}/register`,
    `GET /v26.0/${WABA}`, `GET /v26.0/${WABA}`, `POST /v26.0/${WABA}/message_templates`,
  ]);
  const troca = m.graph[0]!;
  assertEquals([troca.busca.get("client_id"), troca.busca.get("code"), troca.auth], ["28914484134911319", CADASTRO.code, null]);
  assert(m.graph.slice(1).every((g) => g.auth === "Bearer token-do-condominio"));
  const pin = (m.graph[3]!.corpo as { pin: string }).pin;
  const ligar = m.chamadas.find((c) => c.funcao === "plataforma_ligar_conta_meta")!.args;
  assertEquals([ligar.p_pessoa, ligar.p_condominio, ligar.p_numero, ligar.p_qualidade, ligar.p_falta_cartao], [ANA, AURORA, "+556133330101", "VERDE", false]);
  const hex = String(ligar.p_credenciais).slice(2);
  const cred = await decifrarCredenciais(m.chave, btoa(String.fromCharCode(...hex.match(/../g)!.map((h) => parseInt(h, 16)))));
  assertEquals(cred, { instancia: WABA, token: "token-do-condominio", pin });
  // O banco confere quem pode antes de gastar o código da janela.
  assert(m.chamadas.findIndex((c) => c.funcao === "plataforma_meta_preparar") < m.chamadas.findIndex((c) => c.funcao === "plataforma_ligar_conta_meta"));
});

Deno.test("W-15: conta sem cartão liga, mas avisa antes do primeiro aviso", async () => {
  const m = await montar({ saude: { can_send_message: "LIMITED", errors: [{ error_code: 141006, error_description: "No payment method" }] } });
  const corpo = await (await m.pedir("/v1/condominio/whatsapp/meta/cadastro", { corpo: CADASTRO, cookie: await entrar(m) })).json();
  assertEquals([corpo.etapa, corpo.faltaCartao], ["LIGADO", true]);
  assertEquals(m.chamadas.find((c) => c.funcao === "plataforma_ligar_conta_meta")!.args.p_falta_cartao, true);
});

Deno.test("código da janela vencido vira CODIGO_VENCIDO e nada é gravado", async () => {
  const m = await montar({ troca: { status: 400, code: 100, message: "This authorization code has expired." } });
  assertEquals(await motivo(await m.pedir("/v1/condominio/whatsapp/meta/cadastro", { corpo: CADASTRO, cookie: await entrar(m) })), "CODIGO_VENCIDO");
  assertEquals(m.chamadas.some((c) => c.funcao.startsWith("plataforma_ligar") || c.funcao === "plataforma_meta_guardar_pendente"), false);
});

Deno.test("W-01: número sem confirmação fica pendente; o código por SMS confere e liga", async () => {
  const m = await montar({ confirmado: false });
  const cookie = await entrar(m);
  const r = await (await m.pedir("/v1/condominio/whatsapp/meta/cadastro", { corpo: CADASTRO, cookie })).json();
  assertEquals(r, { etapa: "CODIGO", numero: "+556133330101", metodos: ["SMS", "VOICE"] });
  assertEquals(caminhos(m).includes(`POST /v26.0/${NUMERO}/register`), false);
  const pedido1 = await (await m.pedir("/v1/condominio/whatsapp/meta/codigo", { corpo: { acao: "PEDIR", metodo: "SMS" }, cookie })).json();
  assertEquals(pedido1.reenviarEmSegundos, 60);
  assertEquals(m.graph.find((g) => g.caminho.endsWith("/request_code"))!.corpo, { code_method: "SMS", language: "pt_BR" });
  const ligou = await (await m.pedir("/v1/condominio/whatsapp/meta/codigo", { corpo: { acao: "CONFIRMAR", codigo: "123456" }, cookie })).json();
  assertEquals(ligou.etapa, "LIGADO");
  assertEquals(m.graph.find((g) => g.caminho.endsWith("/verify_code"))!.corpo, { code: "123456" });
  // O PIN do registro é o que ficou guardado no pendente.
  const pinGuardado = (await decifrarCredenciais(m.chave, String(m.pendente()!.credenciais))).pin;
  assertEquals((m.graph.find((g) => g.caminho.endsWith("/register"))!.corpo as { pin: string }).pin, pinGuardado);
});

Deno.test("o registro que pede confirmação (133006) também vai para o código", async () => {
  const m = await montar({ registro: { status: 400, code: 133006 } });
  const r = await (await m.pedir("/v1/condominio/whatsapp/meta/cadastro", { corpo: CADASTRO, cookie: await entrar(m) })).json();
  assertEquals(r.etapa, "CODIGO");
});

Deno.test("as recusas do código viram motivos: errado, vencido e tentativas demais", async () => {
  for (const [falha, esperado] of [
    [{ status: 400, code: 136025, message: "Verification code mismatch" }, "CODIGO_ERRADO"],
    [{ status: 400, code: 136025, message: "Verification code has expired" }, "CODIGO_VENCIDO"],
    [{ status: 400, code: 133008, message: "Too many attempts" }, "TENTATIVAS_DEMAIS"],
  ] as const) {
    const m = await montar({ confirmado: false, verificar: falha });
    const cookie = await entrar(m);
    await m.pedir("/v1/condominio/whatsapp/meta/cadastro", { corpo: CADASTRO, cookie });
    assertEquals(await motivo(await m.pedir("/v1/condominio/whatsapp/meta/codigo", { corpo: { acao: "CONFIRMAR", codigo: "000000" }, cookie })), esperado);
    assertEquals(m.chamadas.some((c) => c.funcao === "plataforma_ligar_conta_meta"), false);
  }
  const limite = await montar({ confirmado: false, pedir: { status: 400, code: 136024, message: "Rate limit" } });
  const cookie = await entrar(limite);
  await limite.pedir("/v1/condominio/whatsapp/meta/cadastro", { corpo: CADASTRO, cookie });
  assertEquals(await motivo(await limite.pedir("/v1/condominio/whatsapp/meta/codigo", { corpo: { acao: "PEDIR", metodo: "VOICE" }, cookie })), "TENTATIVAS_DEMAIS");
});

Deno.test("a Meta fora do ar vem como provedor indisponível", async () => {
  const m = await montar({ troca: { status: 503, code: 2 } });
  const e = await erro(await m.pedir("/v1/condominio/whatsapp/meta/cadastro", { corpo: CADASTRO, cookie: await entrar(m) }));
  assertEquals([e.codigo, (e.detalhes as { motivo: string }).motivo], ["UPSTREAM_UNAVAILABLE", "PROVEDOR"]);
});
