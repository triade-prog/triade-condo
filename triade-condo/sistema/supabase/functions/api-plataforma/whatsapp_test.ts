// WhatsApp do condomínio na Plataforma (passo 5; W-05, W-13 a W-15): o aviso do provedor entra
// sem o segredo de repasse, só pelo segredo do condomínio; a mídia é conferida antes de ir para o
// pedido; a fila manda com as credenciais decifradas e devolve cada resultado ao banco.
import { assert, assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido } from "../_shared/teste_util.ts";
import { chaveCredenciais, cifrarCredenciais, type ConectorWhatsapp, type CredenciaisWhatsapp } from "../_shared/whatsapp.ts";
import { conectorWafly } from "../_shared/whatsapp.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const IPE = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const MSG = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const ENVIO = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
const PEDIDO = "6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0";
const SEGREDO_GANCHO = "Q2hhdmUtZG8tZ2FuY2hvLWRvLWNvbmRvbWluaW8tSXBl";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };
const CHAVE = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));

/** Conector de mentira: guarda o que mandou e responde como o teste pedir. */
function conectorFalso(midia: Uint8Array | null) {
  const enviados: { cred: CredenciaisWhatsapp; para: string; texto: string }[] = [];
  const real = conectorWafly("t");
  const conector: ConectorWhatsapp = {
    provedor: "TESTE",
    enviarTexto(cred, para, texto) {
      enviados.push({ cred, para, texto });
      return Promise.resolve(texto.includes("falha") ? { ok: false, erro: "Número sem WhatsApp", falha: "PERMANENTE" } : { ok: true, id: "P1" });
    },
    qrCode: () => Promise.resolve({ conectado: true }),
    codigoPareamento: () => Promise.resolve("ABCD-1234"),
    situacao: () => Promise.resolve({ conectado: true, aparelho: "+5561998124400" }),
    desconectar: () => Promise.resolve(),
    ligarAvisos: () => Promise.resolve(),
    baixar: () => Promise.resolve(midia),
    lerAviso: (tipo, corpo) => real.lerAviso(tipo, corpo),
  };
  return { conector, enviados };
}

async function montar(opcoes: { midia?: Uint8Array | null; lote?: unknown[] } = {}) {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const chave = await chaveCredenciais(CHAVE);
  const bytea = await cifrarCredenciais(chave, { instancia: "ipe-inst", token: "token-da-instancia" });
  const credenciais = btoa(String.fromCharCode(...bytea.slice(2).match(/../g)!.map((h) => parseInt(h, 16))));
  let lotes = opcoes.lote ?? [{ condominio: IPE, instancia: "ipe-inst", credenciais, envios: [
    { envio: ENVIO, para: "+5561999990001", texto: "Pedido 2026-0001 registrado." },
    { envio: MSG, para: "+5561991002233", texto: "Residencial Ipê · pedido novo", pedido: PEDIDO },
  ] }];
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: IPE, nome: "Residencial Ipê", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), IPE);
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3, convite: 2 }),
    whatsapp_receber: (a) => {
      if (a.p_segredo !== SEGREDO_GANCHO) erroBanco("TC403");
      const m = a.p_msg as { midia?: { url: string; tipo: string } };
      return { repetida: false, midias: m.midia ? [{ condominio: IPE, mensagem: MSG, url: m.midia.url, tipo: m.midia.tipo, caminho: `whatsapp/${IPE}/${MSG}` }] : [] };
    },
    whatsapp_evento: () => true,
    whatsapp_midia_resultado: () => null,
    whatsapp_midias_pendentes: () => [],
    whatsapp_pegar_lote: () => {
      const l = lotes;
      lotes = [];
      return l;
    },
    whatsapp_resultado: () => null,
    plataforma_whatsapp: () => ({ conexao: { situacao: "CONECTADO" }, aIdentificar: [], falhas: [] }),
    plataforma_triar_whatsapp: () => ({ tratadas: 1 }),
    plataforma_responder_whatsapp: () => ({ versao: 3, envio: ENVIO }),
    plataforma_meus_avisos_whatsapp: () => 1,
    plataforma_definir_whatsapp: () => 2,
  });
  const pedidos = armazenamentoFalso();
  const zap = conectorFalso(opcoes.midia === undefined ? null : opcoes.midia);
  const fundo: Promise<unknown>[] = [];
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: pedidos.armazenamento, aoFundo: (p) => fundo.push(p),
    whatsapp: { conector: zap.conector, chave },
  });
  return { pedir: pedido(app, "api-plataforma"), pedidos, zap, fundo, ...db };
}

async function entrar(m: Awaited<ReturnType<typeof montar>>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: IPE }, cookie });
  return cookie;
}
const chamada = (m: Awaited<ReturnType<typeof montar>>, funcao: string) => m.chamadas.findLast((c) => c.funcao === funcao)?.args;

Deno.test("W-15: o aviso do provedor entra sem o segredo de repasse, só pelo segredo do condomínio", async () => {
  const m = await montar();
  const r = await m.pedir(`/v1/whatsapp/${SEGREDO_GANCHO}/recebida`, {
    segredo: null, corpo: { instanceId: "ipe-inst", messageId: "W1", phone: "5561999990001", text: { message: "A luz da garagem" } },
  });
  assertEquals(r.status, 200);
  assertEquals(chamada(m, "whatsapp_receber"), {
    p_segredo: SEGREDO_GANCHO, p_instancia: "ipe-inst",
    p_msg: { id: "W1", telefone: "5561999990001", enviadaEm: (chamada(m, "whatsapp_receber")!.p_msg as { enviadaEm: string }).enviadaEm,
             tipo: "TEXTO", texto: "A luz da garagem" },
  });
  assertEquals((await m.pedir(`/v1/whatsapp/segredo-curto/recebida`, { segredo: null, corpo: {} })).status, 403);
  assertEquals((await m.pedir(`/v1/whatsapp/${SEGREDO_GANCHO}/outra-coisa`, { segredo: null, corpo: {} })).status, 403);
  assertEquals((await m.pedir(`/v1/whatsapp/${"X".repeat(40)}/recebida`, {
    segredo: null, corpo: { messageId: "W2", phone: "5561999990001", text: { message: "Oi" } } })).status, 403);
});

Deno.test("W-05: a própria mensagem e a de grupo não chegam ao banco", async () => {
  const m = await montar();
  await m.pedir(`/v1/whatsapp/${SEGREDO_GANCHO}/recebida`, { segredo: null, corpo: { messageId: "W3", phone: "5561999990001", fromMe: true, text: { message: "x" } } });
  await m.pedir(`/v1/whatsapp/${SEGREDO_GANCHO}/recebida`, { segredo: null, corpo: { messageId: "W4", phone: "120363-group", isGroup: true, text: { message: "x" } } });
  assertEquals(chamada(m, "whatsapp_receber"), undefined);
});

Deno.test("W-05: a foto é baixada, conferida e guardada no armazenamento dos pedidos", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  const m = await montar({ midia: png });
  await m.pedir(`/v1/whatsapp/${SEGREDO_GANCHO}/recebida`, {
    segredo: null, corpo: { messageId: "W5", phone: "5561999990001", image: { imageUrl: "https://x.invalid/f.png", mimeType: "image/png" } },
  });
  await Promise.all(m.fundo);
  assert(m.pedidos.objetos.has(`whatsapp/${IPE}/${MSG}`));
  assertEquals(chamada(m, "whatsapp_midia_resultado"), { p_condominio: IPE, p_mensagem: MSG, p_tamanho: png.length, p_motivo: null });
});

Deno.test("W-05: mídia que não é o que diz não é guardada e o motivo volta ao banco", async () => {
  const m = await montar({ midia: new TextEncoder().encode("<html>nada</html>") });
  await m.pedir(`/v1/whatsapp/${SEGREDO_GANCHO}/recebida`, {
    segredo: null, corpo: { messageId: "W6", phone: "5561999990001", audio: { audioUrl: "https://x.invalid/a", mimeType: "audio/ogg" } },
  });
  await Promise.all(m.fundo);
  assertEquals(m.pedidos.objetos.size, 0);
  assertEquals(chamada(m, "whatsapp_midia_resultado")!.p_motivo, "O conteúdo não é um áudio OGG de verdade.");
});

Deno.test("W-13: entrega e leitura voltam ao banco, uma por id", async () => {
  const m = await montar();
  await m.pedir(`/v1/whatsapp/${SEGREDO_GANCHO}/entrega`, { segredo: null, corpo: { ids: ["P1", "P2"], status: "READ" } });
  assertEquals(m.chamadas.filter((c) => c.funcao === "whatsapp_evento").map((c) => [c.args.p_tipo, c.args.p_provedor_id]), [["LIDA", "P1"], ["LIDA", "P2"]]);
});

Deno.test("W-14: a fila manda com as credenciais decifradas e devolve cada resultado; o aviso leva o link do painel", async () => {
  const m = await montar();
  const r = await m.pedir("/v1/interno/fila-whatsapp", { corpo: {} });
  assertEquals((await r.json()).enviados, 2);
  assertEquals(m.zap.enviados[0]!.cred, { instancia: "ipe-inst", token: "token-da-instancia" });
  assertEquals(m.zap.enviados[1]!.texto, `Residencial Ipê · pedido novo\nAbrir no painel: https://plataforma.exemplo/pedidos/pedido?id=${PEDIDO}`);
  assertEquals(m.chamadas.filter((c) => c.funcao === "whatsapp_resultado").map((c) => c.args.p_provedor_id), ["P1", "P1"]);
  assertEquals((await m.pedir("/v1/interno/fila-whatsapp", { corpo: {}, segredo: null })).status, 403);
});

Deno.test("W-14: falha permanente volta com o tipo da falha", async () => {
  const m = await montar({ lote: [] });
  const chave = await chaveCredenciais(CHAVE);
  const bytea = await cifrarCredenciais(chave, { instancia: "ipe-inst", token: "t-123456789" });
  const credenciais = btoa(String.fromCharCode(...bytea.slice(2).match(/../g)!.map((h) => parseInt(h, 16))));
  const m2 = await montar({ lote: [{ condominio: IPE, instancia: "ipe-inst", credenciais, envios: [{ envio: ENVIO, para: "+5561900000000", texto: "vai dar falha" }] }] });
  await m2.pedir("/v1/interno/fila-whatsapp", { corpo: {} });
  assertEquals(chamada(m2, "whatsapp_resultado"), { p_condominio: IPE, p_envio: ENVIO, p_provedor_id: null, p_erro: "Número sem WhatsApp", p_falha: "PERMANENTE" });
  assertEquals(m.zap.enviados.length, 0);
});

Deno.test("as telas do WhatsApp pedem a sessão e validam a entrada", async () => {
  const m = await montar();
  assertEquals((await erro(await m.pedir("/v1/condominio/whatsapp"))).codigo, "UNAUTHORIZED");
  const cookie = await entrar(m);
  assertEquals((await m.pedir("/v1/condominio/whatsapp", { cookie })).status, 200);
  const sem = await m.pedir(`/v1/condominio/whatsapp/mensagens/${MSG}/triar`, { corpo: { acao: "ARQUIVAR", motivo: "" }, cookie });
  assertEquals((await erro(sem)).codigo, "VALIDATION_ERROR");
  await m.pedir(`/v1/condominio/whatsapp/mensagens/${MSG}/triar`, { corpo: { acao: "PEDIDO", pedidoId: PEDIDO }, cookie });
  assertEquals(chamada(m, "plataforma_triar_whatsapp")!.p_pedido, PEDIDO);
  const r = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/whatsapp`, { corpo: { versao: 2, texto: "O eletricista vem segunda." }, cookie });
  assertEquals(r.status, 201);
  assertEquals(chamada(m, "plataforma_responder_whatsapp")!.p_texto, "O eletricista vem segunda.");
  const avisos = await m.pedir("/v1/condominio/whatsapp/meus-avisos", { metodo: "PUT", corpo: { telefone: "61 9999", tipos: [], ligado: true }, cookie });
  assertEquals((await erro(avisos)).codigo, "VALIDATION_ERROR");
});
