// WhatsApp oficial pela Meta na Plataforma (0315; W-05, W-13 a W-15, W-20): um endereço só para
// todos os condomínios, conferido pelo token de verificação (GET) e pela assinatura (POST); o
// banco acha o condomínio pelo número. Na fila, o lote META sai pela Graph API com o token do
// condomínio, e fora da janela vai o modelo aprovado com o link no lugar de [link].
import { assert, assertEquals } from "@std/assert";
import { criarApiPlataforma } from "./app.ts";
import { adminFalso, armazenamentoFalso, authFalso, bancoFalso, pedido } from "../_shared/teste_util.ts";
import { clienteMeta } from "../_shared/meta.ts";
import { chaveCredenciais, cifrarCredenciais } from "../_shared/whatsapp.ts";

const IPE = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const MSG = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const ENVIO = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";
const NUMERO = "1403308709535370";
const SEGREDO_APP = "segredo-do-app-de-teste";
const VERIFICACAO = "verificacao-do-endereco";
const CHAVE = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));

async function assinar(corpo: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SEGREDO_APP), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(corpo)));
  return "sha256=" + Array.from(s, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function montar(lote: unknown[] = []) {
  const chave = await chaveCredenciais(CHAVE);
  const bytea = await cifrarCredenciais(chave, { instancia: "1029384756", token: "token-do-condominio", pin: "123456" });
  const credenciais = btoa(String.fromCharCode(...bytea.slice(2).match(/../g)!.map((h) => parseInt(h, 16))));
  let lotes = lote.map((l) => ({ credenciais, ...(l as object) }));
  const db = bancoFalso({
    whatsapp_receber_meta: (a) => {
      const m = a.p_msg as { midia?: { url: string; tipo: string } };
      return { repetida: false, midias: m.midia ? [{ condominio: IPE, mensagem: MSG, url: m.midia.url, tipo: m.midia.tipo, caminho: `whatsapp/${IPE}/${MSG}` }] : [] };
    },
    whatsapp_evento_meta: () => true,
    whatsapp_conta_meta_recebida: () => true,
    whatsapp_conta_meta_evento: () => true,
    whatsapp_modelo_meta: () => { throw new Error("falha do banco"); },
    whatsapp_credenciais_meta: () => ({ credenciais }),
    whatsapp_midia_resultado: () => null,
    whatsapp_midias_pendentes: () => [],
    whatsapp_pegar_lote: () => {
      const l = lotes;
      lotes = [];
      return l;
    },
    whatsapp_resultado: () => null,
  });
  const graph: { caminho: string; corpo: unknown; auth: string | null }[] = [];
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  const buscar = (async (entrada: URL | string, init?: RequestInit) => {
    await Promise.resolve();
    const url = new URL(String(entrada));
    graph.push({ caminho: url.pathname, corpo: init?.body ? JSON.parse(String(init.body)) : undefined, auth: new Headers(init?.headers).get("authorization") });
    if (url.hostname === "midia.exemplo") return new Response(png);
    if (url.pathname.endsWith("/messages")) return Response.json({ messages: [{ id: "wamid.SAIU" }] });
    return Response.json({ url: "https://midia.exemplo/f", file_size: png.length });
  }) as typeof fetch;
  const pedidos = armazenamentoFalso();
  const fundo: Promise<unknown>[] = [];
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: authFalso([]).auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo",
    armazenamento: pedidos.armazenamento, aoFundo: (p) => fundo.push(p),
    meta: { cliente: clienteMeta({ segredoApp: SEGREDO_APP, tokenSistema: "sistema", buscar, base: "https://graph.exemplo" }),
            segredoApp: SEGREDO_APP, verificacao: VERIFICACAO, chave },
  });
  const avisar = async (corpo: unknown, assinatura?: string) => {
    const texto = JSON.stringify(corpo);
    return await app.request("/api-plataforma/v1/whatsapp/meta", {
      method: "POST", body: texto,
      headers: { "content-type": "application/json", "x-hub-signature-256": assinatura ?? await assinar(texto) },
    });
  };
  return { app, avisar, pedir: pedido(app, "api-plataforma"), graph, pedidos, fundo, ...db };
}

const mensagem = (msg: unknown) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "1029384756", changes: [{ field: "messages", value: { metadata: { phone_number_id: NUMERO }, messages: [msg] } }] }],
});

Deno.test("W-15: a Meta confere o endereço com o token de verificação, sem o segredo de repasse", async () => {
  const m = await montar();
  const ok = await m.app.request(`/api-plataforma/v1/whatsapp/meta?hub.mode=subscribe&hub.verify_token=${VERIFICACAO}&hub.challenge=4242`);
  assertEquals(ok.status, 200);
  assertEquals(await ok.text(), "4242");
  assertEquals((await m.app.request("/api-plataforma/v1/whatsapp/meta?hub.mode=subscribe&hub.verify_token=outro&hub.challenge=1")).status, 403);
});

Deno.test("W-15: aviso sem a assinatura certa não chega ao banco", async () => {
  const m = await montar();
  assertEquals((await m.avisar(mensagem({ id: "wamid.A1", from: "5561999990001", type: "text", text: { body: "Oi" } }), "sha256=00")).status, 403);
  assertEquals(m.chamadas.length, 0);
});

Deno.test("W-05: a mensagem entra pelo número; a foto é baixada pelo id com o token do condomínio", async () => {
  const m = await montar();
  const r = await m.avisar(mensagem({ id: "wamid.A2", from: "5561999990001", timestamp: "1761900000", type: "image", image: { id: "998877", mime_type: "image/png" } }));
  assertEquals(r.status, 200);
  await Promise.all(m.fundo);
  const rec = m.chamadas.find((c) => c.funcao === "whatsapp_receber_meta")!.args;
  assertEquals(rec.p_numero_id, NUMERO);
  assertEquals((rec.p_msg as { midia: { url: string } }).midia.url, "meta:998877");
  assertEquals(m.graph[0]!.caminho, "/v26.0/998877");
  assertEquals(m.graph[1]!.auth, "Bearer token-do-condominio");
  assert(m.pedidos.objetos.has(`whatsapp/${IPE}/${MSG}`));
});

Deno.test("W-01/W-13/W-20: situações, conta e modelos vão ao banco; um que falha não derruba o aviso", async () => {
  const m = await montar();
  const r = await m.avisar({
    object: "whatsapp_business_account",
    entry: [{ id: "1029384756", changes: [
      { field: "messages", value: { metadata: { phone_number_id: NUMERO }, statuses: [{ id: "wamid.E2", status: "failed", errors: [{ code: 131042, title: "pagamento" }] }] } },
      { field: "account_update", value: { event: "PARTNER_ADDED", waba_info: { waba_id: "5566778899", owner_business_id: "4433221100" } } },
      { field: "message_template_status_update", value: { event: "APPROVED", message_template_name: "noticia_pedido_1", message_template_id: 1 } },
      { field: "phone_number_quality_update", value: { event: "UNFLAGGED", current_limit: "TIER_1K" } },
    ] }],
  });
  assertEquals(r.status, 200);
  const args = (f: string) => m.chamadas.find((c) => c.funcao === f)?.args;
  assertEquals(args("whatsapp_evento_meta"), { p_numero_id: NUMERO, p_tipo: "FALHOU", p_provedor_id: "wamid.E2", p_codigo: 131042, p_erro: "pagamento" });
  assertEquals(args("whatsapp_conta_meta_recebida")!.p_waba, "5566778899");
  assertEquals(args("whatsapp_modelo_meta")!.p_nome, "noticia_pedido_1");
  assertEquals(args("whatsapp_conta_meta_evento"), { p_waba: "1029384756", p_tipo: "QUALIDADE", p_qualidade: "VERDE", p_limite: 1000, p_motivo: null });
});

Deno.test("W-14: o lote META sai pela Graph API; fora da janela vai o modelo com o link pessoal", async () => {
  const m = await montar([{ condominio: IPE, provedor: "META", instancia: "", numeroId: NUMERO, envios: [
    { envio: ENVIO, para: "+5561999990001", texto: "Pedido registrado." },
    { envio: MSG, para: "+5561999990002", texto: "Vote: [link]", link: "K7QM-3XPA-9TRE",
      modelo: { chave: "convite_enquete", parametros: ["Residencial Ipê", "[link]"], nome: "convite_enquete_1", idioma: "pt_BR" } },
  ] }]);
  const r = await m.pedir("/v1/interno/fila-whatsapp", { corpo: {} });
  assertEquals((await r.json()).enviados, 2);
  assertEquals(m.graph[0]!.caminho, `/v26.0/${NUMERO}/messages`);
  assertEquals((m.graph[0]!.corpo as { text: { body: string } }).text.body, "Pedido registrado.");
  assertEquals((m.graph[1]!.corpo as { template: unknown }).template, {
    name: "convite_enquete_1", language: { code: "pt_BR" },
    components: [{ type: "body", parameters: [{ type: "text", text: "Residencial Ipê" }, { type: "text", text: "https://plataforma.exemplo/v/K7QM-3XPA-9TRE" }] }],
  });
  assertEquals(m.chamadas.filter((c) => c.funcao === "whatsapp_resultado").map((c) => c.args.p_provedor_id), ["wamid.SAIU", "wamid.SAIU"]);
});

Deno.test("W-14: sem o provedor do lote na função, o envio volta para a fila como falha passageira", async () => {
  const m = await montar([{ condominio: IPE, provedor: "WAFLY", instancia: "ipe-inst", envios: [{ envio: ENVIO, para: "+5561999990001", texto: "Oi" }] }]);
  await m.pedir("/v1/interno/fila-whatsapp", { corpo: {} });
  assertEquals(m.chamadas.find((c) => c.funcao === "whatsapp_resultado")!.args.p_falha, "PASSAGEIRA");
  assertEquals(m.graph.length, 0);
});
