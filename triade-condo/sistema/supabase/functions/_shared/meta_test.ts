// Conector da Meta (0315; W-13 a W-15, W-17, W-20): a assinatura do aviso é conferida antes de
// tudo, o aviso vira mensagens, situações, contas e modelos, e a resposta da Meta vira o resultado
// da fila (passageira, permanente ou tempo esgotado) sem o token no texto.
import { assert, assertEquals } from "@std/assert";
import { assinaturaMetaConfere, clienteMeta, lerAvisoMeta, limiteDoNivel, novoPin, provaDoSegredo } from "./meta.ts";

const SEGREDO = "segredo-do-app-de-teste";

async function assinar(corpo: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(SEGREDO), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(corpo)));
  return "sha256=" + Array.from(s, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** fetch de mentira: guarda cada chamada e responde pela função do teste. */
function graphFalsa(responder: (url: URL, corpo: unknown) => { status?: number; json?: unknown; bytes?: Uint8Array<ArrayBuffer> }) {
  const chamadas: { url: URL; metodo: string; corpo: unknown; auth: string | null }[] = [];
  const buscar = (async (entrada: URL | string, init?: RequestInit) => {
    await Promise.resolve();
    const url = new URL(String(entrada));
    const corpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    chamadas.push({ url, metodo: init?.method ?? "GET", corpo, auth: new Headers(init?.headers).get("authorization") });
    const r = responder(url, corpo);
    if (r.bytes) return new Response(r.bytes, { status: r.status ?? 200 });
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { buscar, chamadas };
}

Deno.test("W-15: o aviso só vale com a assinatura certa do corpo cru", async () => {
  const corpo = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  assert(await assinaturaMetaConfere(corpo, await assinar(corpo), SEGREDO));
  assert(!(await assinaturaMetaConfere(corpo + " ", await assinar(corpo), SEGREDO)));
  assert(!(await assinaturaMetaConfere(corpo, null, SEGREDO)));
  assert(!(await assinaturaMetaConfere(corpo, (await assinar(corpo)).replace("sha256=", "sha1="), SEGREDO)));
});

Deno.test("W-05/W-13: mensagens e situações saem do aviso com o número que recebeu", () => {
  const avisos = lerAvisoMeta({
    object: "whatsapp_business_account",
    entry: [{ id: "1029384756", changes: [{ field: "messages", value: {
      metadata: { phone_number_id: "1403308709535370" },
      messages: [
        { id: "wamid.A1", from: "5561999990001", timestamp: "1761900000", type: "text", text: { body: "A luz da garagem" } },
        { id: "wamid.A2", from: "5561999990001", timestamp: "1761900001", type: "image", image: { id: "998877", mime_type: "image/jpeg", caption: "vaga 31" } },
        { id: "wamid.A3", from: "5561999990001", type: "sticker", sticker: { id: "1" } },
      ],
      statuses: [
        { id: "wamid.E1", status: "delivered" },
        { id: "wamid.E2", status: "failed", errors: [{ code: 131042, title: "Business eligibility payment issue" }] },
        { id: "wamid.E3", status: "sent" },
      ],
    } }] }],
  });
  assertEquals(avisos.length, 5);
  assertEquals(avisos[0], { tipo: "RECEBIDA", numeroId: "1403308709535370",
    mensagem: { id: "wamid.A1", telefone: "+5561999990001", enviadaEm: new Date(1761900000 * 1000).toISOString(), tipo: "TEXTO", texto: "A luz da garagem" } });
  assert(avisos[1]!.tipo === "RECEBIDA" && avisos[1]!.mensagem.midia?.url === "meta:998877" && avisos[1]!.mensagem.texto === "vaga 31");
  assert(avisos[2]!.tipo === "RECEBIDA" && avisos[2]!.mensagem.tipo === "OUTRO");
  assertEquals(avisos[3], { tipo: "SITUACAO", numeroId: "1403308709535370", situacao: "ENTREGUE", id: "wamid.E1", codigo: null, erro: null });
  assertEquals(avisos[4], { tipo: "SITUACAO", numeroId: "1403308709535370", situacao: "FALHOU", id: "wamid.E2", codigo: 131042,
                            erro: "Business eligibility payment issue" });
  assertEquals(lerAvisoMeta({ object: "page", entry: [] }), []);
});

Deno.test("W-01/W-20: conta nova, qualidade, suspensão e modelos saem do aviso pela conta", () => {
  const avisos = lerAvisoMeta({
    object: "whatsapp_business_account",
    entry: [{ id: "1029384756", changes: [
      { field: "account_update", value: { event: "PARTNER_ADDED", waba_info: { waba_id: "5566778899", owner_business_id: "4433221100" } } },
      { field: "account_update", value: { event: "DISABLED_UPDATE", ban_info: { waba_ban_state: "DISABLE" } } },
      { field: "phone_number_quality_update", value: { event: "FLAGGED", current_limit: "TIER_250" } },
      { field: "message_template_status_update", value: { event: "APPROVED", message_template_name: "noticia_pedido_1", message_template_id: 123456, reason: "NONE" } },
    ] }],
  });
  assertEquals(avisos[0], { tipo: "CONTA_RECEBIDA", wabaId: "5566778899", empresaId: "4433221100", dados: { evento: "PARTNER_ADDED", recebidaDe: "1029384756" } });
  assertEquals(avisos[1], { tipo: "CONTA", wabaId: "1029384756", evento: "SUSPENSO", qualidade: null, limite: null, motivo: "DISABLED_UPDATE" });
  assertEquals(avisos[2], { tipo: "CONTA", wabaId: "1029384756", evento: "QUALIDADE", qualidade: "VERMELHO", limite: 250, motivo: null });
  assertEquals(avisos[3], { tipo: "MODELO", wabaId: "1029384756", nome: "noticia_pedido_1", metaId: "123456", situacao: "APPROVED", motivo: null });
  assertEquals(limiteDoNivel("TIER_1K"), 1000);
  assertEquals(limiteDoNivel("UNLIMITED"), null);
});

Deno.test("W-14: o envio leva o appsecret_proof e traduz a resposta da Meta para a fila", async () => {
  const g = graphFalsa((_u, corpo) => {
    const para = (corpo as { to: string }).to;
    if (para === "5561900000001") return { status: 400, json: { error: { code: 131042, message: "payment" } } };
    if (para === "5561900000002") return { status: 400, json: { error: { code: 130429, message: "rate" } } };
    if (para === "5561900000003") return { status: 401, json: { error: { code: 190, message: "token token-do-condominio inválido" } } };
    return { json: { messages: [{ id: "wamid.OK" }] } };
  });
  const cli = clienteMeta({ segredoApp: SEGREDO, tokenSistema: "sistema", buscar: g.buscar, base: "https://graph.exemplo" });
  assertEquals(await cli.enviarTexto("token-do-condominio", "140330", "+55 61 99999-0001", "Oi"), { ok: true, id: "wamid.OK" });
  const c0 = g.chamadas[0]!;
  assertEquals(c0.url.pathname, "/v26.0/140330/messages");
  assertEquals(c0.url.searchParams.get("appsecret_proof"), await provaDoSegredo("token-do-condominio", SEGREDO));
  assertEquals(c0.auth, "Bearer token-do-condominio");
  assertEquals(c0.corpo, { messaging_product: "whatsapp", recipient_type: "individual", to: "5561999990001", type: "text", text: { body: "Oi", preview_url: false } });

  await cli.enviarModelo("t", "140330", "+5561999990001", "noticia_pedido_1", "pt_BR", ["P-1", ""]);
  assertEquals((g.chamadas[1]!.corpo as { template: unknown }).template, {
    name: "noticia_pedido_1", language: { code: "pt_BR" },
    components: [{ type: "body", parameters: [{ type: "text", text: "P-1" }, { type: "text", text: "-" }] }],
  });

  assertEquals(await cli.enviarTexto("t", "140330", "+5561900000001", "x"), { ok: false, erro: "A conta do condomínio na Meta está sem cartão", falha: "PERMANENTE" });
  const passageira = await cli.enviarTexto("t", "140330", "+5561900000002", "x");
  assert(!passageira.ok && passageira.falha === "PASSAGEIRA");
  const r = await cli.enviarTexto("t", "140330", "+5561900000003", "x");
  assert(!r.ok && r.falha === "PERMANENTE" && !r.erro.includes("token-do-condominio"));
});

Deno.test("W-05: a mídia da Meta é baixada pelo id, com o token, até o limite", async () => {
  const g = graphFalsa((u) => u.hostname === "graph.exemplo" ? { json: { url: "https://midia.exemplo/f", file_size: 4 } } : { bytes: new Uint8Array([1, 2, 3, 4]) });
  const cli = clienteMeta({ segredoApp: SEGREDO, tokenSistema: "sistema", buscar: g.buscar, base: "https://graph.exemplo" });
  assertEquals(await cli.baixar("t", "998877", 10), new Uint8Array([1, 2, 3, 4]));
  assertEquals(g.chamadas[1]!.auth, "Bearer t");
  assertEquals(await cli.baixar("t", "998877", 3), null);
});

Deno.test("W-20: os modelos vão como UTILITY com exemplos; a falha de um não para os outros", async () => {
  const g = graphFalsa((_u, corpo) => (corpo as { name: string }).name === "ruim_1"
    ? { status: 400, json: { error: { code: 100, message: "Invalid parameter" } } }
    : { json: { id: "778899", status: "PENDING" } });
  const cli = clienteMeta({ segredoApp: SEGREDO, tokenSistema: "sistema", buscar: g.buscar, base: "https://graph.exemplo" });
  const r = await cli.criarModelos("t", "1029384756", [
    { modeloId: "m1", nome: "noticia_pedido_1", idioma: "pt_BR", corpo: "Pedido {{1}} no {{2}}", rodape: "Responda PARAR.", variaveis: ["protocolo", "condomínio"] },
    { modeloId: "m2", nome: "ruim_1", idioma: "pt_BR", corpo: "x {{1}}", variaveis: ["link"] },
  ]);
  assertEquals(r, [{ modeloId: "m1", metaId: "778899", situacao: "PENDING" }, { modeloId: "m2", situacao: "FALHOU", motivo: "Invalid parameter" }]);
  assertEquals(g.chamadas[0]!.corpo, {
    name: "noticia_pedido_1", language: "pt_BR", category: "UTILITY",
    components: [{ type: "BODY", text: "Pedido {{1}} no {{2}}", example: { body_text: [["P-2026-0042", "Residencial Ipê"]] } },
                 { type: "FOOTER", text: "Responda PARAR." }],
  });
  assert(/^[0-9]{6}$/.test(novoPin()));
});
