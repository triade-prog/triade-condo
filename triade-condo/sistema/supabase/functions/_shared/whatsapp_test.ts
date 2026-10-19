// Conector do WhatsApp (passo 5; W-04, W-05, W-13 a W-15): o aviso do Wafly vira a mensagem do
// banco, o envio separa falha passageira, permanente e tempo esgotado, as credenciais ficam
// cifradas e a mídia do morador é conferida pelo conteúdo.
import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { chaveCredenciais, cifrarCredenciais, conectorWafly, decifrarCredenciais, lerRecebidaWafly } from "./whatsapp.ts";
import { tirarLocalizacaoMp4, verificarMidia } from "./arquivos.ts";

const CHAVE = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const CRED = { instancia: "ipe-inst", token: "token-secreto-da-instancia" };

Deno.test("PT-08: as credenciais vão cifradas e voltam iguais com a mesma chave", async () => {
  const chave = await chaveCredenciais(CHAVE);
  const bytea = await cifrarCredenciais(chave, CRED);
  assert(bytea.startsWith("\\x"));
  assert(!bytea.includes(Array.from(new TextEncoder().encode("token-secreto"), (b) => b.toString(16).padStart(2, "0")).join("")));
  const hex = bytea.slice(2);
  const base64 = btoa(String.fromCharCode(...hex.match(/../g)!.map((h) => parseInt(h, 16))));
  assertEquals(await decifrarCredenciais(chave, base64), CRED);
  assertNotEquals(await cifrarCredenciais(chave, CRED), bytea);
});

Deno.test("W-05: o aviso do Wafly vira a mensagem do banco; grupo e a própria mensagem ficam de fora", () => {
  assertEquals(lerRecebidaWafly({ messageId: "A1", phone: "5561999990001", momment: 1760000000000, text: { message: "Oi" } }), {
    id: "A1", telefone: "5561999990001", enviadaEm: new Date(1760000000000).toISOString(), tipo: "TEXTO", texto: "Oi",
  });
  assertEquals(lerRecebidaWafly({ messageId: "A2", phone: "5561999990001", fromMe: true, text: { message: "Oi" } }), null);
  assertEquals(lerRecebidaWafly({ messageId: "A3", phone: "1203630-group", isGroup: true, text: { message: "Oi" } }), null);
  const foto = lerRecebidaWafly({ messageId: "A4", phone: "5561999990001", image: { imageUrl: "https://x.invalid/f", caption: "vaga 31",
                                                                                      mimeType: "image/jpeg" } });
  assertEquals(foto?.tipo, "IMAGEM");
  assertEquals(foto?.texto, "vaga 31");
  assertEquals(foto?.midia, { url: "https://x.invalid/f", tipo: "image/jpeg" });
  const audio = lerRecebidaWafly({ messageId: "A5", phone: "5561999990001", audio: { audioUrl: "https://x.invalid/a", mimeType: "audio/ogg; codecs=opus" } });
  assertEquals(audio?.midia?.tipo, "audio/ogg");
  const figurinha = lerRecebidaWafly({ messageId: "A6", phone: "5561999990001", sticker: { stickerUrl: "https://x.invalid/s" } });
  assertEquals(figurinha?.tipo, "OUTRO");
});

Deno.test("W-13: entrega e leitura; conexão com o aparelho", () => {
  const c = conectorWafly("client-token");
  assertEquals(c.lerAviso("entrega", { instanceId: "ipe-inst", ids: ["X1", "X2"], status: "READ" }), { tipo: "LIDA", instancia: "ipe-inst", ids: ["X1", "X2"] });
  assertEquals(c.lerAviso("entrega", { messageId: "X3" }), { tipo: "ENTREGUE", instancia: null, ids: ["X3"] });
  assertEquals(c.lerAviso("conectado", { instanceId: "ipe-inst", phone: "5561998124400" }),
    { tipo: "CONECTADO", instancia: "ipe-inst", aparelho: "5561998124400" });
});

Deno.test("W-14: o envio separa falha passageira, permanente e tempo esgotado", async () => {
  const pedidos: { url: string; init?: RequestInit }[] = [];
  let resposta: () => Response | Promise<Response> = () => Response.json({ value: true, messageId: "3EB0" });
  const buscar = ((url: string, init?: RequestInit) => {
    pedidos.push({ url, init });
    return Promise.resolve(resposta());
  }) as typeof fetch;
  const c = conectorWafly("client-token", buscar, "https://wafly.invalid/api-bridge-whats");
  assertEquals(await c.enviarTexto(CRED, "+5561999990001", "Oi"), { ok: true, id: "3EB0" });
  assertEquals(pedidos[0]!.url, "https://wafly.invalid/api-bridge-whats/instances/ipe-inst/token/token-secreto-da-instancia/send-text");
  assertEquals(new Headers(pedidos[0]!.init!.headers).get("Client-Token"), "client-token");
  assertEquals(JSON.parse(String(pedidos[0]!.init!.body)), { phone: "5561999990001", message: "Oi" });
  resposta = () => new Response("", { status: 503 });
  assertEquals((await c.enviarTexto(CRED, "+5561999990001", "Oi")) as unknown, { ok: false, erro: "O provedor falhou (HTTP 503)", falha: "PASSAGEIRA" });
  resposta = () => new Response("", { status: 402 });
  assertEquals(((await c.enviarTexto(CRED, "+5561999990001", "Oi")) as { falha: string }).falha, "PERMANENTE");
  resposta = () => Promise.reject(new DOMException("tempo", "TimeoutError"));
  assertEquals(((await c.enviarTexto(CRED, "+5561999990001", "Oi")) as { falha: string }).falha, "TEMPO");
  resposta = () => Promise.reject(new TypeError("rede"));
  assertEquals(((await c.enviarTexto(CRED, "+5561999990001", "Oi")) as { falha: string }).falha, "PASSAGEIRA");
});

Deno.test("W-01: os avisos do provedor vão para o endereço com o segredo, um por tipo", async () => {
  const pedidos: { url: string; body: string }[] = [];
  const buscar = ((url: string, init?: RequestInit) => {
    pedidos.push({ url, body: String(init?.body) });
    return Promise.resolve(new Response(null, { status: 204 }));
  }) as typeof fetch;
  await conectorWafly("client-token", buscar, "https://wafly.invalid/api-bridge-whats").ligarAvisos(CRED, "https://f.invalid/v1/whatsapp/SEGREDO");
  assertEquals(pedidos.map((p) => p.url.split("/").at(-1)), ["update-webhook-received", "update-webhook-delivery",
    "update-webhook-connected", "update-webhook-disconnected"]);
  assertEquals(JSON.parse(pedidos[0]!.body), { value: "https://f.invalid/v1/whatsapp/SEGREDO/recebida" });
});

Deno.test("W-01: a situação traz o aparelho conectado", async () => {
  const buscar = ((url: string) =>
    Promise.resolve(Response.json(url.endsWith("/status") ? { value: "CONNECTED" } : { phone: "5561998124400" }))) as typeof fetch;
  assertEquals(await conectorWafly("t", buscar).situacao(CRED), { conectado: true, aparelho: "+5561998124400" });
});

Deno.test("W-05: áudio e vídeo pelo conteúdo; o vídeo sai sem localização", () => {
  const ogg = new TextEncoder().encode("OggS\0resto-do-audio");
  assert(verificarMidia(ogg, "audio/ogg").ok);
  assert(!verificarMidia(new TextEncoder().encode("<script>"), "audio/ogg").ok);
  assert(!verificarMidia(new TextEncoder().encode("nada de mp4"), "video/mp4").ok);
  // ftyp + um bloco ©xyz com coordenadas.
  const enc = new TextEncoder();
  const ftyp = new Uint8Array([0, 0, 0, 16, ...enc.encode("ftypisom"), 0, 0, 2, 0]);
  const coord = enc.encode("+12.3456-045.6789/");
  const xyz = new Uint8Array(8 + 4 + coord.length);
  new DataView(xyz.buffer).setUint32(0, xyz.length);
  xyz.set([0xa9, ...enc.encode("xyz")], 4);
  xyz.set(coord, 12);
  const mp4 = new Uint8Array([...ftyp, ...xyz]);
  const limpo = tirarLocalizacaoMp4(mp4);
  assertEquals(limpo.length, mp4.length);
  assert(!new TextDecoder().decode(limpo).includes("+12.3456"));
  assert(new TextDecoder().decode(limpo).includes("free"));
  const r = verificarMidia(mp4, "video/mp4");
  assert(r.ok && !new TextDecoder().decode(r.bytes).includes("045.6789"));
  assert(!verificarMidia(new Uint8Array(16 * 1024 * 1024 + 1), "audio/ogg").ok);
});
