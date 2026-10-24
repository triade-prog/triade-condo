// Ajuda da IA nos pedidos (IA-17, IA-15, IA-11, W-06) sobre o motor com freio (IA-20): o banco diz
// se pode e o que vai; a API tira nome e telefone, chama o conector e devolve o resultado ao banco.
import { assert, assertEquals } from "@std/assert";
import Anthropic from "@anthropic-ai/sdk";
import { criarApiPlataforma } from "./app.ts";
import { conectorAnthropic, conectorIaTeste, conectorTranscricaoTeste, type ConectorIa, type ConectorTranscricao } from "../_shared/ia.ts";
import { adminFalso, authFalso, bancoFalso, cookieDe, erro, erroBanco, limitesFalsos, pedido, armazenamentoFalso } from "../_shared/teste_util.ts";

const ANA = "2d9e5b2a-7f3c-4e4d-9a0b-3c4d5e6f7a8b";
const AURORA = "3e0f6c3b-8a4d-4f5e-8b1c-4d5e6f7a8b9c";
const PEDIDO = "4f1a7d4c-9b5e-4a6f-9c2d-5e6f7a8b9c0d";
const SUG = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const CAT = "6e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const CAT2 = "7e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const PRI = "8e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const MSG = "9e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const TR = "ae6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const ENTRAR = { email: "ana@exemplo.invalid", senha: "senha-da-sindica" };

const ENTRADA = {
  texto: "Relato: Aqui é a Ana Souza, (61) 99999-1234. Vazamento forte no banheiro social.",
  nomes: ["Ana Souza"],
  categorias: [{ id: CAT, nome: "Manutenção" }, { id: CAT2, nome: "Limpeza" }],
  prioridades: [{ id: PRI, nome: "Urgente", significado: "Dano acontecendo agora", nivel: 4 }],
  provedor: "TESTE", modelo: "teste-1",
};

function montar(opcoes: { handlers?: Record<string, (a: Record<string, unknown>) => unknown>; sugerir?: Record<string, ConectorIa>; transcrever?: Record<string, ConectorTranscricao> } = {}) {
  const sessoes = new Map<string, string>();
  const falso = authFalso([{ id: ANA, email: ENTRAR.email, senha: ENTRAR.senha }]);
  const arq = armazenamentoFalso();
  const db = bancoFalso({
    acesso_plataforma: () => true,
    registrar_acesso: () => 1,
    meus_condominios: () => [{ condominio_id: AURORA, nome: "Residencial Aurora", funcoes: ["SINDICO"] }],
    escolher_condominio: (a) => {
      sessoes.set(String(a.p_sessao), String(a.p_condominio));
      return null;
    },
    condominio_da_sessao: (a) => sessoes.get(String(a.p_sessao)) ?? null,
    ...limitesFalsos({ login: 5, autenticador: 10, recuperacao: 3 }),
    plataforma_pedir_sugestao_pedido: () => ({ sugestao: { id: SUG, estado: "PREPARANDO" }, entrada: ENTRADA }),
    plataforma_resultado_sugestao: (a) => ({ sugestao: { id: a.p_sugestao, estado: (a.p_resultado as { ok: boolean }).ok ? "PRONTA" : "FALHA" } }),
    ...opcoes.handlers,
  });
  const ia = { sugerir: opcoes.sugerir ?? { TESTE: conectorIaTeste() }, transcrever: opcoes.transcrever ?? {} };
  const fundo: Promise<unknown>[] = [];
  const app = criarApiPlataforma("segredo-de-repasse-de-teste", {
    banco: db.banco, auth: falso.auth, admin: adminFalso().admin, urlApp: "https://plataforma.exemplo", armazenamento: arq.armazenamento, ia,
    aoFundo: (p) => fundo.push(p),
  });
  return { pedir: pedido(app, "api-plataforma"), ...db, arq, fundo };
}

async function entrar(m: ReturnType<typeof montar>): Promise<string> {
  const cookie = cookieDe(await m.pedir("/v1/auth/entrar", { corpo: ENTRAR }));
  await m.pedir("/v1/sessao/condominio", { metodo: "PUT", corpo: { condominioId: AURORA }, cookie });
  return cookie;
}
const chamada = (m: ReturnType<typeof montar>, funcao: string) => m.chamadas.find((c) => c.funcao === funcao)?.args;

Deno.test("IA-17: pedir a sugestão manda ao banco os provedores que a função tem e devolve o resultado", async () => {
  const m = montar();
  const cookie = await entrar(m);
  const r = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/sugestao`, { metodo: "POST", cookie });
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { sugestao: { id: SUG, estado: "PRONTA" } });
  assertEquals(chamada(m, "plataforma_pedir_sugestao_pedido"), { p_pessoa: ANA, p_condominio: AURORA, p_id: PEDIDO, p_provedores: ["TESTE"] });
  const res = chamada(m, "plataforma_resultado_sugestao")!.p_resultado as Record<string, unknown>;
  assertEquals([res.ok, res.categoriaId, res.prioridadeId, res.local, res.confianca], [true, CAT, PRI, "Banheiro social", "ALTA"]);
});

Deno.test("IA-20: o texto vai para a IA sem nome e sem telefone; o registro não leva o texto", async () => {
  let recebido = "";
  const espiao: ConectorIa = { provedor: "TESTE", sugerir: (modelo, e) => { recebido = e.texto; return conectorIaTeste().sugerir(modelo, e); } };
  const logs: string[] = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a: unknown[]) => void logs.push(a.join(" "));
  try {
    const m = montar({ sugerir: { TESTE: espiao } });
    await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/sugestao`, { metodo: "POST", cookie: await entrar(m) });
  } finally {
    Object.assign(console, original);
  }
  assertEquals(recebido, "Relato: Aqui é a [nome], [telefone]. Vazamento forte no banheiro social.");
  assert(!logs.join("\n").includes("Vazamento"), "o relato não vai para o log");
});

Deno.test("IA-20: sem a chave (nenhum provedor), a sugestão fica indisponível e nada é chamado", async () => {
  const m = montar({ sugerir: {}, handlers: { plataforma_pedir_sugestao_pedido: () => ({ sugestao: null, indisponivel: true }) } });
  const r = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/sugestao`, { metodo: "POST", cookie: await entrar(m) });
  assertEquals(await r.json(), { sugestao: null, indisponivel: true });
  assertEquals(chamada(m, "plataforma_pedir_sugestao_pedido")!.p_provedores, []);
  assertEquals(chamada(m, "plataforma_resultado_sugestao"), undefined);
});

Deno.test("IA-20: o provedor que falha vira falha registrada, sem derrubar a rota", async () => {
  const quebrado: ConectorIa = { provedor: "TESTE", sugerir: () => Promise.reject(new Error("caiu")) };
  const m = montar({ sugerir: { TESTE: quebrado } });
  const r = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/sugestao`, { metodo: "POST", cookie: await entrar(m) });
  assertEquals(await r.json(), { sugestao: { id: SUG, estado: "FALHA" } });
  assertEquals((chamada(m, "plataforma_resultado_sugestao")!.p_resultado as { ok: boolean }).ok, false);
});

Deno.test("IA-15: usar e recusar vão ao banco com a versão do pedido; nada muda sem esse toque", async () => {
  const m = montar({ handlers: { plataforma_decidir_sugestao: (a) => ({ versao: Number(a.p_versao) + 1 }), plataforma_ia_do_pedido: () => ({}) } });
  const cookie = await entrar(m);
  const u = await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/sugestao/usar`, { metodo: "POST", corpo: { versao: 3 }, cookie });
  assertEquals(await u.json(), { versao: 4 });
  assertEquals(chamada(m, "plataforma_decidir_sugestao"), {
    p_pessoa: ANA, p_condominio: AURORA, p_id: PEDIDO, p_versao: 3, p_usar: true, p_categoria: null, p_prioridade: null, p_local: null,
  });
  await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/sugestao/recusar`, { metodo: "POST", corpo: { versao: 4, categoriaId: CAT2 }, cookie });
  const recusa = m.chamadas.filter((c) => c.funcao === "plataforma_decidir_sugestao")[1]!.args;
  assertEquals([recusa.p_usar, recusa.p_categoria], [false, CAT2]);
  assertEquals((await erro(await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/sugestao/usar`, { metodo: "POST", corpo: {}, cookie }))).codigo, "VALIDATION_ERROR");
  // Abrir a ficha não pede nem usa nada: só lê.
  const n = m.chamadas.length;
  await m.pedir(`/v1/condominio/pedidos/${PEDIDO}/ia`, { cookie });
  assertEquals(m.chamadas.slice(n).map((c) => c.funcao).filter((f) => f.startsWith("plataforma_")), ["plataforma_ia_do_pedido"]);
});

Deno.test("IA-17: no registro, a sugestão espera o relato e fica no histórico do pedido registrado", async () => {
  const m = montar({ handlers: {
    plataforma_pedir_sugestao_registro: () => ({ sugestao: { id: SUG, estado: "PREPARANDO" }, entrada: ENTRADA }),
    plataforma_registrar_pedido: () => ({ id: PEDIDO, protocolo: "2026-0001" }),
    plataforma_sugestao_no_registro: () => ({ estado: "USADA" }),
  } });
  const cookie = await entrar(m);
  assertEquals((await erro(await m.pedir("/v1/condominio/pedidos/sugestao", { metodo: "POST", corpo: { relato: "curto" }, cookie }))).codigo, "VALIDATION_ERROR");
  const r = await m.pedir("/v1/condominio/pedidos/sugestao", { metodo: "POST", corpo: { assunto: "Vazamento", relato: "Vazamento forte no banheiro social." }, cookie });
  assertEquals((await r.json()).sugestao.estado, "PRONTA");
  const reg = await m.pedir("/v1/condominio/pedidos", { metodo: "POST", cookie, corpo: {
    local: "Banheiro social", categoriaId: CAT, prioridadeId: PRI, assunto: "Vazamento", descricao: "Vazamento forte.", canal: "TELEFONE", sugestaoId: SUG,
  } });
  assertEquals(reg.status, 201);
  assertEquals(chamada(m, "plataforma_sugestao_no_registro"), { p_pessoa: ANA, p_condominio: AURORA, p_sugestao: SUG, p_pedido: PEDIDO });
});

Deno.test("W-06: o áudio que falha tenta de novo uma vez sozinho e volta ao banco com o que deu", async () => {
  let tentativas = 0;
  const instavel: ConectorTranscricao = {
    provedor: "TESTE",
    transcrever: (a, t, s) => (++tentativas === 1 ? Promise.reject(new Error("caiu")) : conectorTranscricaoTeste().transcrever(a, t, s)),
  };
  const m = montar({ transcrever: { TESTE: instavel }, handlers: {
    plataforma_tentar_transcricao: () => ({ transcricao: { estado: "TRANSCREVENDO" }, id: TR, caminho: `whatsapp/${AURORA}/${MSG}`, tipo: "audio/ogg", provedor: "TESTE" }),
    whatsapp_resultado_transcricao: () => ({ transcricao: { estado: "PRONTA" } }),
  } });
  await m.arq.armazenamento.gravar(`whatsapp/${AURORA}/${MSG}`, new Uint8Array(8000), "audio/ogg");
  const r = await m.pedir(`/v1/condominio/whatsapp/mensagens/${MSG}/transcrever`, { metodo: "POST", cookie: await entrar(m) });
  assertEquals(await r.json(), { transcricao: { estado: "TRANSCREVENDO" } });
  await Promise.all(m.fundo);
  assertEquals(tentativas, 2);
  const res = chamada(m, "whatsapp_resultado_transcricao")!;
  assertEquals([res.p_condominio, res.p_transcricao, (res.p_resultado as { ok: boolean }).ok], [AURORA, TR, true]);
  assertEquals(chamada(m, "plataforma_tentar_transcricao")!.p_provedores, ["TESTE"]);
});

Deno.test("IA-19: Ajuda da IA lê e muda pelas rotas das Configurações", async () => {
  const m = montar({ handlers: {
    plataforma_ajuda_ia: () => ({ ligadaTriade: true, versao: 2 }),
    plataforma_definir_ajuda_ia: (a) => Number(a.p_versao) + 1,
  } });
  const cookie = await entrar(m);
  assertEquals(await (await m.pedir("/v1/condominio/ia", { cookie })).json(), { ligadaTriade: true, versao: 2 });
  const r = await m.pedir("/v1/condominio/ia", { metodo: "PUT", corpo: { versao: 2, sugerir: false, transcrever: true }, cookie });
  assertEquals(await r.json(), { versao: 3 });
  assertEquals(chamada(m, "plataforma_definir_ajuda_ia"), { p_pessoa: ANA, p_condominio: AURORA, p_versao: 2, p_sugerir: false, p_transcrever: true });
  const recusa = montar({ handlers: { plataforma_definir_ajuda_ia: () => erroBanco("TC422", { motivo: "IA_DESLIGADA_TRIADE" }) } });
  const e = await erro(await recusa.pedir("/v1/condominio/ia", { metodo: "PUT", corpo: { versao: 2, sugerir: true, transcrever: true }, cookie: await entrar(recusa) }));
  assertEquals(e.detalhes?.motivo, "IA_DESLIGADA_TRIADE");
});

// O conector Anthropic com um cliente falso: o formato pedido, o custo e as falhas.
function clienteFalso(responder: (p: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>) {
  const pedidos: Anthropic.MessageCreateParamsNonStreaming[] = [];
  return { pedidos, cliente: { messages: { create: (p: Anthropic.MessageCreateParamsNonStreaming) => { pedidos.push(p); return responder(p); } } } };
}
const mensagem = (texto: string, stop: Anthropic.Message["stop_reason"] = "end_turn") => ({
  id: "msg", type: "message", role: "assistant", model: "claude-haiku-5-5", stop_reason: stop, stop_sequence: null,
  content: [{ type: "text", text: texto, citations: null }],
  usage: { input_tokens: 900, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
}) as unknown as Anthropic.Message;
const ENTRADA_LIMPA = { texto: "Vazamento forte no banheiro social.", categorias: ENTRADA.categorias, prioridades: ENTRADA.prioridades };

Deno.test("IA-20: conector Anthropic pede JSON com formato fixo e calcula o custo da chamada", async () => {
  const f = clienteFalso(() => Promise.resolve(mensagem(JSON.stringify({ categoria: "Manutenção", prioridade: "Urgente", local: "Banheiro social", porque: "Vazamento.", confianca: "ALTA" }))));
  const r = await conectorAnthropic("chave-falsa", f.cliente).sugerir("claude-haiku-5-5", ENTRADA_LIMPA);
  assertEquals([r.ok, r.sugestao?.categoriaId, r.tokensEntrada, r.tokensSaida, r.custoMicros, r.moeda], [true, CAT, 900, 80, 130, "USD"]);
  const p = f.pedidos[0]!;
  assertEquals(p.model, "claude-haiku-5-5");
  assertEquals((p.output_config as { format: { type: string } }).format.type, "json_schema");
  assert(String(p.messages[0]!.content).includes("<relato>"));
});

Deno.test("IA-20: conector Anthropic: recusa, resposta fora do catálogo e erro do provedor não viram sugestão", async () => {
  const recusa = await conectorAnthropic("x", clienteFalso(() => Promise.resolve(mensagem("", "refusal"))).cliente).sugerir("claude-haiku-5-5", ENTRADA_LIMPA);
  assertEquals([recusa.ok, recusa.sugestao, recusa.falha], [false, null, "FORMATO"]);
  const fora = await conectorAnthropic("x", clienteFalso(() => Promise.resolve(mensagem('{"categoria":"Jardim"}'))).cliente).sugerir("claude-haiku-5-5", ENTRADA_LIMPA);
  assertEquals([fora.ok, fora.sugestao, fora.custoMicros], [true, null, 130]);
  const rede = await conectorAnthropic("x", clienteFalso(() => Promise.reject(new Anthropic.APIConnectionError({ message: "sem rede" }))).cliente)
    .sugerir("claude-haiku-5-5", ENTRADA_LIMPA);
  assertEquals([rede.ok, rede.falha], [false, "REDE"]);
});
