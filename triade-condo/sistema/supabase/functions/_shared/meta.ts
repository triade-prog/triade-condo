// WhatsApp oficial pela Meta (Cloud API, Graph v26.0), no modelo de parceiro (0315; W-01, W-13
// a W-15, W-17, W-20, DC4). Cada condomínio tem a própria conta (WABA) e o próprio token; a
// TRÍADE tem o app (META_APP_SECRET) e o usuário do sistema (META_TOKEN), que entra na conta do
// condomínio depois do cadastro hospedado e fala com ela pelo próprio token.
//
// Toda chamada com token vai com o appsecret_proof (HMAC-SHA256 do token com a chave secreta
// do app), porque o app exige. Os avisos da Meta chegam num endereço só e são conferidos pela
// assinatura X-Hub-Signature-256 antes de qualquer leitura.
//
// O envio segue os tipos do conector do Wafly (ResultadoEnvioWhatsapp, MensagemRecebida): o
// resto do sistema não precisa saber de qual provedor veio.

import { NUMERO_FORA_DO_WHATSAPP, textoNumeroForaDoWhatsapp, type MensagemRecebida, type ResultadoEnvioWhatsapp } from "./whatsapp.ts";

export const VERSAO_GRAPH = "v26.0";

/** Credenciais do condomínio no META, cifradas no banco como as do Wafly. */
export interface CredenciaisMeta {
  token: string;
  pin: string;
}

// ---------------------------------------------------------------------------------------
// Assinaturas.

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(chave: string, dado: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(dado)));
}

/** appsecret_proof da chamada feita com este token. */
export async function provaDoSegredo(token: string, segredoApp: string): Promise<string> {
  return await hmac(segredoApp, token);
}

/** Confere o X-Hub-Signature-256 ("sha256=<hex>") do corpo cru, em tempo constante. */
export async function assinaturaMetaConfere(corpo: string, cabecalho: string | null, segredoApp: string): Promise<boolean> {
  if (!cabecalho || !cabecalho.startsWith("sha256=")) return false;
  const esperado = await hmac(segredoApp, corpo);
  const recebido = cabecalho.slice(7).toLowerCase();
  if (recebido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return dif === 0;
}

// ---------------------------------------------------------------------------------------
// Avisos da Meta (webhook do app, objeto whatsapp_business_account).

export type AvisoMeta =
  | { tipo: "RECEBIDA"; numeroId: string; mensagem: MensagemRecebida }
  | { tipo: "SITUACAO"; numeroId: string; situacao: "ENTREGUE" | "LIDA" | "FALHOU"; id: string; codigo: number | null; erro: string | null }
  | { tipo: "CONTA_RECEBIDA"; wabaId: string; empresaId: string | null; dados: Record<string, unknown> }
  | { tipo: "CONTA"; wabaId: string; evento: "QUALIDADE" | "SUSPENSO" | "LIBERADO"; qualidade: string | null; limite: number | null; motivo: string | null }
  | { tipo: "MODELO"; wabaId: string; nome: string; metaId: string | null; situacao: string; motivo: string | null };

/** Prefixo da mídia da Meta: o banco guarda "meta:<id>" no lugar do endereço. */
export const PREFIXO_MIDIA_META = "meta:";

const TIPOS_MIDIA = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "audio/ogg", "audio/mpeg", "audio/mp4", "video/mp4"]);

function obj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}
function lista(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function texto(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}
function idNumerico(v: unknown): string | undefined {
  const t = typeof v === "number" ? String(v) : texto(v);
  return t && /^[0-9]{1,40}$/.test(t) ? t : undefined;
}
function tipoMidia(v: unknown, padrao: string): string {
  const t = (texto(v) ?? padrao).split(";")[0]!.trim().toLowerCase();
  return t === "image/jpg" ? "image/jpeg" : t;
}

/** Limite de conversas por dia a partir do nível da Meta ("TIER_1K" → 1000). */
export function limiteDoNivel(nivel: unknown): number | null {
  const m = /^TIER_(\d+)(K?)$/.exec(texto(nivel) ?? "");
  return m ? Number(m[1]) * (m[2] ? 1000 : 1) : null;
}

/** Mensagem recebida no formato da Cloud API. */
export function lerMensagemMeta(m: unknown): MensagemRecebida | null {
  const c = obj(m);
  const id = texto(c?.id);
  const de = texto(c?.from)?.replace(/\D/g, "");
  if (!c || !id || !de) return null;
  const n = Number(texto(c.timestamp) ?? NaN);
  const base = { id, telefone: `+${de}`, enviadaEm: Number.isFinite(n) ? new Date(n * 1000).toISOString() : new Date().toISOString() };
  const tipo = texto(c.type) ?? "";
  if (tipo === "text") {
    const t = texto(obj(c.text)?.body);
    return t ? { ...base, tipo: "TEXTO", texto: t } : { ...base, tipo: "OUTRO" };
  }
  if (tipo === "button") {
    const t = texto(obj(c.button)?.text);
    return t ? { ...base, tipo: "TEXTO", texto: t } : { ...base, tipo: "OUTRO" };
  }
  if (tipo === "interactive") {
    const i = obj(c.interactive);
    const t = texto(obj(i?.button_reply)?.title) ?? texto(obj(i?.list_reply)?.title);
    return t ? { ...base, tipo: "TEXTO", texto: t } : { ...base, tipo: "OUTRO" };
  }
  const midias: Record<string, [MensagemRecebida["tipo"], string]> = {
    image: ["IMAGEM", "image/jpeg"], audio: ["AUDIO", "audio/ogg"], video: ["VIDEO", "video/mp4"], document: ["DOCUMENTO", "application/pdf"],
  };
  const qual = midias[tipo];
  if (qual) {
    const md = obj(c[tipo]);
    const mid = idNumerico(md?.id);
    const mime = tipoMidia(md?.mime_type, qual[1]);
    const legenda = texto(md?.caption);
    return {
      ...base,
      tipo: qual[0],
      ...(legenda ? { texto: legenda } : {}),
      ...(mid && TIPOS_MIDIA.has(mime) ? { midia: { url: `${PREFIXO_MIDIA_META}${mid}`, tipo: mime, ...(texto(md?.filename) ? { nome: texto(md?.filename) } : {}) } } : {}),
    };
  }
  return { ...base, tipo: "OUTRO" };
}

/** Lê o aviso inteiro: uma entrada por conta, várias mudanças por entrada. O que não interessa some. */
export function lerAvisoMeta(corpo: unknown): AvisoMeta[] {
  const c = obj(corpo);
  if (!c || c.object !== "whatsapp_business_account") return [];
  const saida: AvisoMeta[] = [];
  for (const e of lista(c.entry)) {
    const entrada = obj(e);
    const wabaId = idNumerico(entrada?.id);
    for (const m of lista(entrada?.changes)) {
      const mudanca = obj(m);
      const campo = texto(mudanca?.field);
      const v = obj(mudanca?.value);
      if (!v) continue;
      if (campo === "messages") {
        const numeroId = idNumerico(obj(v.metadata)?.phone_number_id);
        if (!numeroId) continue;
        for (const x of lista(v.messages)) {
          const mensagem = lerMensagemMeta(x);
          if (mensagem) saida.push({ tipo: "RECEBIDA", numeroId, mensagem });
        }
        for (const s of lista(v.statuses)) {
          const st = obj(s);
          const id = texto(st?.id);
          const situacao = ({ delivered: "ENTREGUE", read: "LIDA", failed: "FALHOU" } as const)[texto(st?.status) as "delivered"];
          if (!id || !situacao) continue;
          const erro = obj(lista(st?.errors)[0]);
          const codigo = typeof erro?.code === "number" ? erro.code : null;
          saida.push({ tipo: "SITUACAO", numeroId, situacao, id, codigo,
                       erro: texto(obj(erro?.error_data)?.details) ?? texto(erro?.message) ?? texto(erro?.title) ?? null });
        }
      } else if (campo === "account_update" && wabaId) {
        const evento = texto(v.event);
        const info = obj(v.waba_info);
        const ban = texto(obj(v.ban_info)?.waba_ban_state);
        if (evento === "PARTNER_ADDED") {
          const conta = idNumerico(info?.waba_id) ?? wabaId;
          saida.push({ tipo: "CONTA_RECEBIDA", wabaId: conta, empresaId: idNumerico(info?.owner_business_id) ?? null,
                       dados: { evento, recebidaDe: wabaId } });
        } else if (ban === "DISABLE" || ban === "SCHEDULE_FOR_DISABLE") {
          saida.push({ tipo: "CONTA", wabaId, evento: "SUSPENSO", qualidade: null, limite: null, motivo: texto(evento) ?? null });
        } else if (ban === "REINSTATE") {
          saida.push({ tipo: "CONTA", wabaId, evento: "LIBERADO", qualidade: null, limite: null, motivo: null });
        }
      } else if (campo === "phone_number_quality_update" && wabaId) {
        const evento = texto(v.event);
        const qualidade = evento === "FLAGGED" ? "VERMELHO" : evento === "UNFLAGGED" ? "VERDE" : null;
        saida.push({ tipo: "CONTA", wabaId, evento: "QUALIDADE", qualidade, limite: limiteDoNivel(v.current_limit), motivo: null });
      } else if (campo === "message_template_status_update" && wabaId) {
        const nome = texto(v.message_template_name);
        const situacao = texto(v.event);
        if (!nome || !situacao) continue;
        const motivo = texto(v.reason);
        saida.push({ tipo: "MODELO", wabaId, nome, metaId: idNumerico(v.message_template_id) ?? null, situacao,
                     motivo: motivo && motivo !== "NONE" ? motivo : null });
      }
    }
  }
  return saida;
}

// ---------------------------------------------------------------------------------------
// Chamadas à Graph API.

export interface ModeloParaMeta {
  modeloId: string;
  nome: string;
  idioma: string;
  corpo: string;
  rodape?: string;
  variaveis: string[];
}

/** O que a Meta respondeu a um modelo mandado. */
export interface ResultadoModeloMeta {
  modeloId: string;
  metaId?: string;
  situacao: string;
  motivo?: string;
}

export interface NumeroMeta {
  id: string;
  numero: string;
  nome: string | null;
  qualidade: "VERDE" | "AMARELO" | "VERMELHO" | "DESCONHECIDA";
  limite: number | null;
}

/** Exemplo de cada variável para a Meta aprovar o modelo (pede exemplos realistas). */
const EXEMPLOS: Record<string, string> = {
  protocolo: "P-2026-0042",
  "condomínio": "Residencial Ipê",
  "quem escreveu": "Ana",
  "texto do retorno": "O eletricista vem amanhã às 9h.",
  link: "https://condominio.trihub.com.br/v/AbC123",
};
export function exemploDaVariavel(nome: string): string {
  return EXEMPLOS[nome] ?? EXEMPLOS[nome.toLowerCase()] ?? (nome.trim() ? nome.trim()[0]!.toUpperCase() + nome.trim().slice(1) : "Exemplo");
}

export class ErroMeta extends Error {
  constructor(readonly status: number, readonly codigo: number | null, mensagem: string) {
    super(mensagem);
  }
}

export interface OpcoesClienteMeta {
  segredoApp: string;
  /** Token do usuário do sistema da TRÍADE (META_TOKEN). */
  tokenSistema: string;
  buscar?: typeof fetch;
  base?: string;
}

export function clienteMeta(o: OpcoesClienteMeta) {
  const buscar = o.buscar ?? fetch;
  const base = `${o.base ?? "https://graph.facebook.com"}/${VERSAO_GRAPH}`;
  let usuarioSistema: string | null = null;

  async function chamar(token: string, metodo: string, caminho: string, corpo?: unknown, tempoMs = 20_000): Promise<Record<string, unknown>> {
    const url = new URL(`${base}/${caminho}`);
    url.searchParams.set("appsecret_proof", await provaDoSegredo(token, o.segredoApp));
    const r = await buscar(url, {
      method: metodo,
      headers: { authorization: `Bearer ${token}`, ...(corpo === undefined ? {} : { "content-type": "application/json" }) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(tempoMs),
    });
    const j = obj(await r.json().catch(() => null)) ?? {};
    if (!r.ok) {
      const e = obj(j.error);
      // O token nunca vai para a mensagem: só o status, o código e o texto da Meta.
      throw new ErroMeta(r.status, typeof e?.code === "number" ? e.code : null, texto(e?.error_user_msg) ?? texto(e?.message) ?? `HTTP ${r.status}`);
    }
    return j;
  }

  /** Envia e traduz a resposta para o resultado da fila (W-14). */
  async function enviar(token: string, numeroId: string, corpo: Record<string, unknown>): Promise<ResultadoEnvioWhatsapp> {
    try {
      const j = await chamar(token, "POST", `${numeroId}/messages`, { messaging_product: "whatsapp", recipient_type: "individual", ...corpo });
      const id = texto(obj(lista(j.messages)[0])?.id);
      return id ? { ok: true, id } : { ok: false, erro: "A Meta não devolveu o id da mensagem", falha: "TEMPO" };
    } catch (e) {
      if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
        return { ok: false, erro: "Tempo esgotado: pode ter saído", falha: "TEMPO" };
      }
      if (!(e instanceof ErroMeta)) return { ok: false, erro: "Sem conexão com a Meta", falha: "PASSAGEIRA" };
      if (e.status >= 500 || e.status === 429 || e.codigo === 130429 || e.codigo === 131016 || e.codigo === 80007) {
        return { ok: false, erro: `A Meta falhou (${e.codigo ?? e.status})`, falha: "PASSAGEIRA" };
      }
      if (e.codigo === 131042) return { ok: false, erro: "A conta do condomínio na Meta está sem cartão", falha: "PERMANENTE" };
      if (e.codigo === 190) return { ok: false, erro: "A Meta recusou o token do condomínio", falha: "PERMANENTE" };
      if (e.codigo === 131026 || NUMERO_FORA_DO_WHATSAPP.test(e.message)) return { ok: false, erro: textoNumeroForaDoWhatsapp(e.message), falha: "PERMANENTE" };
      if (e.codigo === 131047) return { ok: false, erro: "A conversa no WhatsApp passou de 24 horas", falha: "PERMANENTE" };
      return { ok: false, erro: `A Meta recusou: ${e.message}`.slice(0, 300), falha: "PERMANENTE" };
    }
  }

  const para = (t: string) => t.replace(/\D/g, "");

  return {
    enviarTexto(token: string, numeroId: string, destino: string, mensagem: string) {
      return enviar(token, numeroId, { to: para(destino), type: "text", text: { body: mensagem, preview_url: false } });
    },
    enviarModelo(token: string, numeroId: string, destino: string, nome: string, idioma: string, parametros: string[]) {
      return enviar(token, numeroId, {
        to: para(destino), type: "template",
        template: {
          name: nome, language: { code: idioma },
          ...(parametros.length ? { components: [{ type: "body", parameters: parametros.map((t) => ({ type: "text", text: t || "-" })) }] } : {}),
        },
      });
    },

    /** Baixa a mídia recebida (o id vira um endereço que também pede o token), até o limite. */
    async baixar(token: string, mediaId: string, limite: number): Promise<Uint8Array | null> {
      try {
        const info = await chamar(token, "GET", encodeURIComponent(mediaId));
        const url = texto(info.url);
        if (!url || !/^https:\/\//.test(url) || Number(info.file_size ?? 0) > limite) return null;
        const r = await buscar(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
        if (!r.ok || !r.body) return null;
        const partes: Uint8Array[] = [];
        let total = 0;
        for await (const p of r.body) {
          total += p.length;
          if (total > limite) return null;
          partes.push(p);
        }
        const tudo = new Uint8Array(total);
        let i = 0;
        for (const p of partes) { tudo.set(p, i); i += p.length; }
        return tudo;
      } catch {
        return null;
      }
    },

    /** O token de uma conta: o guardado, se houver; senão, o do usuário do sistema da TRÍADE. */
    tokenDe(guardado: string | null | undefined): string {
      return guardado || o.tokenSistema;
    },

    /**
     * Põe o usuário do sistema da TRÍADE na conta que o condomínio compartilhou pelo cadastro
     * hospedado (POST /{waba}/assigned_users, como na especificação da Meta): daí em diante o
     * próprio META_TOKEN alcança a conta. Repetir não muda nada.
     */
    async entrarNaConta(wabaId: string): Promise<void> {
      if (!usuarioSistema) {
        const id = idNumerico((await chamar(o.tokenSistema, "GET", "me?fields=id")).id);
        if (!id) throw new ErroMeta(500, null, "A Meta não devolveu o usuário do sistema");
        usuarioSistema = id;
      }
      await chamar(o.tokenSistema, "POST", `${wabaId}/assigned_users`, { user: usuarioSistema, tasks: ["MANAGE"] });
    },

    async assinarAvisos(token: string, wabaId: string): Promise<void> {
      await chamar(token, "POST", `${wabaId}/subscribed_apps`);
    },

    async nomeDaEmpresa(token: string, wabaId: string): Promise<string | null> {
      try {
        return texto((await chamar(token, "GET", `${wabaId}?fields=name`)).name) ?? null;
      } catch {
        return null;
      }
    },

    async numeros(token: string, wabaId: string): Promise<NumeroMeta[]> {
      const j = await chamar(token, "GET", `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier`);
      return lista(j.data).flatMap((x) => {
        const n = obj(x);
        const id = idNumerico(n?.id);
        const numero = texto(n?.display_phone_number)?.replace(/\D/g, "");
        if (!id || !numero) return [];
        const q = texto(n?.quality_rating);
        return [{ id, numero: `+${numero}`, nome: texto(n?.verified_name) ?? null, limite: limiteDoNivel(n?.messaging_limit_tier),
                  qualidade: q === "GREEN" ? "VERDE" : q === "YELLOW" ? "AMARELO" : q === "RED" ? "VERMELHO" : "DESCONHECIDA" } as NumeroMeta];
      });
    },

    async registrar(token: string, numeroId: string, pin: string): Promise<void> {
      await chamar(token, "POST", `${numeroId}/register`, { messaging_product: "whatsapp", pin });
    },

    /** Manda os modelos para a conta do condomínio; um que falha não para os outros. */
    async criarModelos(token: string, wabaId: string, modelos: ModeloParaMeta[]): Promise<ResultadoModeloMeta[]> {
      const saida: ResultadoModeloMeta[] = [];
      for (const m of modelos) {
        const corpo = {
          name: m.nome, language: m.idioma, category: "UTILITY",
          components: [
            { type: "BODY", text: m.corpo, ...(m.variaveis.length ? { example: { body_text: [m.variaveis.map(exemploDaVariavel)] } } : {}) },
            ...(m.rodape ? [{ type: "FOOTER", text: m.rodape }] : []),
          ],
        };
        try {
          const j = await chamar(token, "POST", `${wabaId}/message_templates`, corpo);
          saida.push({ modeloId: m.modeloId, metaId: idNumerico(j.id), situacao: texto(j.status) ?? "PENDING" });
        } catch (e) {
          saida.push({ modeloId: m.modeloId, situacao: "FALHOU", motivo: (e instanceof Error ? e.message : "falha").slice(0, 300) });
        }
      }
      return saida;
    },
  };
}

export type ClienteMeta = ReturnType<typeof clienteMeta>;

/** PIN de 6 dígitos do registro do número (gerado aqui, guardado cifrado, nunca mostrado). */
export function novoPin(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(6, "0");
}
