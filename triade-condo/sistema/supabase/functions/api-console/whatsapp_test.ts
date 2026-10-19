// Conexão do WhatsApp no Console (passo 5; W-01, DC14): o token vai cifrado para o banco e
// nunca volta; o segredo do aviso só vai para o provedor; aparelho que não é o da ficha é
// desconectado na hora.
import { assert, assertEquals } from "@std/assert";
import { criarApiConsole } from "./app.ts";
import { adminFalso, authFalso, bancoFalso, CODIGO_CERTO, cookieDe, erro, limitesFalsos, pedido } from "../_shared/teste_util.ts";
import { chaveCredenciais, cifrarCredenciais, decifrarCredenciais, type ConectorWhatsapp, type CredenciaisWhatsapp } from "../_shared/whatsapp.ts";

const CAROLINA = "0b7c3f0e-5d1a-4c2b-9e8f-1a2b3c4d5e6f";
const IPE = "2d9e5b20-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const ENTRAR = { email: "carolina@triade.exemplo", senha: "senha-forte-da-equipe" };
const CHAVE = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)));
const SEGREDO_GANCHO = "Q2hhdmUtZG8tZ2FuY2hvLWRvLWNvbmRvbWluaW8tSXBl";

async function montar(aparelho = "+5561998124400") {
  const chave = await chaveCredenciais(CHAVE);
  let guardado: string | null = null;
  const desconectados: CredenciaisWhatsapp[] = [];
  const avisos: string[] = [];
  const conector: ConectorWhatsapp = {
    provedor: "TESTE",
    enviarTexto: () => Promise.resolve({ ok: true, id: "x" }),
    qrCode: () => Promise.resolve({ conectado: false, imagem: "data:image/png;base64,QR" }),
    codigoPareamento: (_c, t) => Promise.resolve(t === "+5561998124400" ? "ABCD-1234" : "ERRADO"),
    situacao: () => Promise.resolve({ conectado: true, aparelho }),
    desconectar: (c) => {
      desconectados.push(c);
      return Promise.resolve();
    },
    ligarAvisos: (_c, base) => {
      avisos.push(base);
      return Promise.resolve();
    },
    baixar: () => Promise.resolve(null),
    lerAviso: () => null,
  };
  const db = bancoFalso({
    acesso_console: () => true,
    registrar_acesso: () => 1,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    console_whatsapp: () => ({ conexao: { situacao: "DESCONECTADO" } }),
    console_whatsapp_lista: () => [],
    console_modelos_whatsapp: () => ({ modelos: [{ chave: "noticia_pedido", numero: 1, situacao: "APROVADO_PILOTO" }], pode: { editar: true } }),
    console_modelo_whatsapp: (a) => ({ versoes: [{ chave: a.p_chave, numero: 1 }], eventos: [] }),
    console_salvar_modelo_whatsapp: (a) => ({ numero: a.p_numero ?? 2, versao: 1 }),
    console_decidir_modelo_whatsapp: (a) => ({ situacao: a.p_situacao, versao: 2 }),
    console_whatsapp_credenciais: (a) => {
      guardado = String(a.p_credenciais);
      return { segredo: SEGREDO_GANCHO, versao: 2 };
    },
    console_whatsapp_acesso: () => ({
      instancia: "ipe-inst", numero: "+5561998124400", situacao: "DESCONECTADO",
      credenciais: btoa(String.fromCharCode(...guardado!.slice(2).match(/../g)!.map((h) => parseInt(h, 16)))),
    }),
    console_whatsapp_situacao: (a) =>
      a.p_situacao === "CONECTADO" && a.p_aparelho !== "+5561998124400"
        ? { situacao: "DESCONECTADO", aparelhoDiferente: true }
        : { situacao: a.p_situacao },
  });
  const falso = authFalso([{ id: CAROLINA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const app = criarApiConsole("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://console.exemplo", urlPlataforma: "https://plataforma.exemplo",
    whatsapp: { conector, chave, urlAvisos: "https://f.exemplo/functions/v1/api-plataforma" },
  });
  return { pedir: pedido(app, "api-console"), chave, desconectados, avisos, guardado: () => guardado, ...db };
}

async function entrar(m: Awaited<ReturnType<typeof montar>>): Promise<string> {
  const aal1 = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  const { factorId } = await (await m.pedir("/v1/auth/autenticador/cadastrar", { corpo: {}, cookie: aal1 })).json();
  return cookieDe(await m.pedir("/v1/auth/autenticador/verificar", { corpo: { codigo: CODIGO_CERTO, factorId }, cookie: aal1 }));
}

Deno.test("as rotas do WhatsApp no Console pedem a sessão completa", async () => {
  const m = await montar();
  for (const rota of ["/v1/whatsapp", "/v1/whatsapp/modelos", `/v1/clientes/${IPE}/whatsapp`]) assertEquals((await erro(await m.pedir(rota))).codigo, "UNAUTHORIZED", rota);
});

Deno.test("PT-08: o token vai cifrado ao banco, nunca volta, e o segredo do aviso só vai ao provedor", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/clientes/${IPE}/whatsapp/credenciais`, { metodo: "PUT", corpo: { instancia: "ipe-inst", token: "token-secreto-123" }, cookie });
  const corpo = await r.text();
  assertEquals(JSON.parse(corpo), { versao: 2, avisos: true });
  assert(!corpo.includes(SEGREDO_GANCHO) && !corpo.includes("token-secreto"));
  assert(!m.guardado()!.includes(Array.from(new TextEncoder().encode("token-secreto"), (b) => b.toString(16).padStart(2, "0")).join("")));
  const base64 = btoa(String.fromCharCode(...m.guardado()!.slice(2).match(/../g)!.map((h) => parseInt(h, 16))));
  assertEquals((await decifrarCredenciais(m.chave, base64)).token, "token-secreto-123");
  assertEquals(m.avisos, [`https://f.exemplo/functions/v1/api-plataforma/v1/whatsapp/${SEGREDO_GANCHO}`]);
  const curto = await m.pedir(`/v1/clientes/${IPE}/whatsapp/credenciais`, { metodo: "PUT", corpo: { instancia: "ipe inst", token: "x" }, cookie });
  assertEquals((await erro(curto)).codigo, "VALIDATION_ERROR");
});

Deno.test("W-01: conectar mostra o QR ou o código do número da ficha", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  await m.pedir(`/v1/clientes/${IPE}/whatsapp/credenciais`, { metodo: "PUT", corpo: { instancia: "ipe-inst", token: "token-secreto-123" }, cookie });
  assertEquals(await (await m.pedir(`/v1/clientes/${IPE}/whatsapp/conectar`, { corpo: {}, cookie })).json(), { qr: "data:image/png;base64,QR" });
  assertEquals(await (await m.pedir(`/v1/clientes/${IPE}/whatsapp/conectar`, { corpo: { modo: "CODIGO" }, cookie })).json(), { codigo: "ABCD-1234" });
  assertEquals(m.chamadas.findLast((c) => c.funcao === "console_whatsapp_acesso")!.args.p_para, "CONECTAR");
});

Deno.test("W-01: aparelho que não é o da ficha é desconectado na hora", async () => {
  const m = await montar("+5561911112222");
  const cookie = await entrar(m);
  await m.pedir(`/v1/clientes/${IPE}/whatsapp/credenciais`, { metodo: "PUT", corpo: { instancia: "ipe-inst", token: "token-secreto-123" }, cookie });
  const r = await (await m.pedir(`/v1/clientes/${IPE}/whatsapp/verificar`, { corpo: {}, cookie })).json();
  assertEquals(r.aparelhoDiferente, true);
  assertEquals(m.desconectados.length, 1);
});

Deno.test("W-01: desconectar na mão pede motivo", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  await m.pedir(`/v1/clientes/${IPE}/whatsapp/credenciais`, { metodo: "PUT", corpo: { instancia: "ipe-inst", token: "token-secreto-123" }, cookie });
  assertEquals((await erro(await m.pedir(`/v1/clientes/${IPE}/whatsapp/desconectar`, { corpo: { motivo: "" }, cookie }))).codigo, "VALIDATION_ERROR");
  const r = await m.pedir(`/v1/clientes/${IPE}/whatsapp/desconectar`, { corpo: { motivo: "Fim do piloto" }, cookie });
  assertEquals((await r.json()).situacao, "DESCONECTADO");
  assertEquals(m.chamadas.findLast((c) => c.funcao === "console_whatsapp_situacao")!.args.p_motivo, "Fim do piloto");
  assertEquals(m.desconectados.length, 1);
});

Deno.test("W-20: modelos de mensagem: lista, versão nova, edição do rascunho e decisão", async () => {
  const m = await montar();
  const cookie = await entrar(m);
  assertEquals((await (await m.pedir("/v1/whatsapp/modelos", { cookie })).json()).modelos.length, 1);
  assertEquals((await erro(await m.pedir("/v1/whatsapp/modelos/nao_existe", { cookie }))).codigo, "NOT_FOUND");
  assertEquals((await erro(await m.pedir("/v1/whatsapp/modelos/noticia_pedido/versoes", { corpo: { corpo: "curto" }, cookie }))).codigo,
    "VALIDATION_ERROR");
  const nova = await m.pedir("/v1/whatsapp/modelos/noticia_pedido/versoes", { corpo: { corpo: "Notícia do seu pedido {{1}} no {{2}}: {{3}} · {{4}}." }, cookie });
  assertEquals(nova.status, 201);
  assertEquals(m.chamadas.findLast((c) => c.funcao === "console_salvar_modelo_whatsapp")!.args.p_numero, null);
  await m.pedir("/v1/whatsapp/modelos/noticia_pedido/versoes/2", {
    metodo: "PUT", corpo: { versao: 1, corpo: "Notícia do seu pedido {{1}} no {{2}}: {{3}} · {{4}} aqui." }, cookie,
  });
  assertEquals(m.chamadas.findLast((c) => c.funcao === "console_salvar_modelo_whatsapp")!.args.p_numero, 2);
  assertEquals((await erro(await m.pedir("/v1/whatsapp/modelos/noticia_pedido/versoes/2/situacao", { corpo: { versao: 1, situacao: "RECUSADO" }, cookie })))
    .codigo, "VALIDATION_ERROR");
  const ok = await m.pedir("/v1/whatsapp/modelos/noticia_pedido/versoes/2/situacao", { corpo: { versao: 1, situacao: "APROVADO_PILOTO" }, cookie });
  assertEquals((await ok.json()).situacao, "APROVADO_PILOTO");
});

// Garante que cifrar e o teste usam o mesmo formato do banco (bytea em hex).
Deno.test("o bytea das credenciais começa com \\x", async () => {
  assert((await cifrarCredenciais(await chaveCredenciais(CHAVE), { instancia: "a", token: "b" })).startsWith("\\x"));
});
