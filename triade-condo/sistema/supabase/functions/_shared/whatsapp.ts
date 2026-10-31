// WhatsApp do condomínio (passo 5; W-01, W-04, W-13 a W-15). O resto do sistema fala só com o
// ConectorWhatsapp: trocar o piloto pelo provedor oficial é escrever outro conector (DC14). O
// primeiro é o Wafly, que liga o número pelo WhatsApp Web (não é a API oficial).
//
// As credenciais da instância chegam ao banco cifradas aqui (AES-GCM, com a chave da função);
// o banco nunca vê o token. Os avisos do provedor chegam em endereços com o segredo do
// condomínio e o tipo no caminho (recebida, entrega, conectado, desconectado).

export interface CredenciaisWhatsapp {
  instancia: string;
  token: string;
  /** Só no oficial pela Meta: o PIN do registro do número (0315). */
  pin?: string;
}

/** Falha de envio (W-14): passageira repete; tempo esgotado pode ter saído e não repete. */
export type FalhaEnvio = "PASSAGEIRA" | "PERMANENTE" | "TEMPO";
export type ResultadoEnvioWhatsapp = { ok: true; id: string } | { ok: false; erro: string; falha: FalhaEnvio };

/** A mensagem recebida no formato do banco (whatsapp_receber). */
export interface MensagemRecebida {
  id: string;
  telefone: string;
  enviadaEm: string;
  tipo: "TEXTO" | "IMAGEM" | "AUDIO" | "VIDEO" | "DOCUMENTO" | "OUTRO";
  texto?: string;
  midia?: { url: string; tipo: string; nome?: string };
}

export type EventoWhatsapp =
  | { tipo: "RECEBIDA"; instancia: string | null; mensagem: MensagemRecebida }
  | { tipo: "ENTREGUE" | "LIDA"; instancia: string | null; ids: string[] }
  | { tipo: "CONECTADO" | "DESCONECTADO"; instancia: string | null; aparelho: string | null };

export const TIPOS_AVISO_WHATSAPP = ["recebida", "entrega", "conectado", "desconectado"] as const;
export type TipoAvisoWhatsapp = (typeof TIPOS_AVISO_WHATSAPP)[number];

export interface ConectorWhatsapp {
  readonly provedor: string;
  enviarTexto(c: CredenciaisWhatsapp, para: string, texto: string): Promise<ResultadoEnvioWhatsapp>;
  /** QR para conectar (imagem em data URL), ou já conectado. */
  qrCode(c: CredenciaisWhatsapp): Promise<{ conectado: true } | { conectado: false; imagem: string }>;
  codigoPareamento(c: CredenciaisWhatsapp, telefone: string): Promise<string>;
  situacao(c: CredenciaisWhatsapp): Promise<{ conectado: boolean; aparelho: string | null }>;
  desconectar(c: CredenciaisWhatsapp): Promise<void>;
  /** Liga os quatro avisos no provedor: `${base}/recebida`, `${base}/entrega`... */
  ligarAvisos(c: CredenciaisWhatsapp, base: string): Promise<void>;
  /** Baixa a mídia do provedor, até o limite (null se não deu). */
  baixar(url: string, limite: number): Promise<Uint8Array | null>;
  /** Lê o aviso do provedor; null quando não interessa (grupo, a própria mensagem, canal). */
  lerAviso(tipo: TipoAvisoWhatsapp, corpo: unknown): EventoWhatsapp | null;
}

// ---------------------------------------------------------------------------------------
// Número que não está no WhatsApp (Portaria 1, PA-01): o banco separa "Sem aviso" de "Aviso
// falhou" pelo começo do motivo (numero_fora_do_whatsapp, 0299). As frases do provedor ainda
// estão a confirmar com o Wafly; estas cobrem as formas conhecidas em inglês e português.

export const NUMERO_FORA_DO_WHATSAPP =
  /not (on|in) whats ?app|n[aã]o (est[aá]|existe|tem|possui)[^.]*whats ?app|(number|phone|n[uú]mero)[^.]*(does not|doesn'?t|not|n[aã]o) (exist|registered|existe)|invalid (phone|number|wid)|"exists"\s*:\s*false/i;

export function textoNumeroForaDoWhatsapp(erro: string): string {
  return `O número não está no WhatsApp (${erro.slice(0, 200)})`;
}

// ---------------------------------------------------------------------------------------
// Cifra das credenciais.

function deBase64(v: string): Uint8Array<ArrayBuffer> {
  const s = atob(v);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

/** Chave AES-256 da variável da função (32 bytes em base64). */
export async function chaveCredenciais(base64: string): Promise<CryptoKey> {
  const bruta = deBase64(base64);
  if (bruta.length !== 32) throw new Error("A chave das credenciais do WhatsApp precisa de 32 bytes");
  return await crypto.subtle.importKey("raw", bruta, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Cifra para guardar no banco: o valor vai como bytea ("\x" e hex). */
export async function cifrarCredenciais(chave: CryptoKey, c: CredenciaisWhatsapp): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, new TextEncoder().encode(JSON.stringify(c))));
  const tudo = new Uint8Array(iv.length + dados.length);
  tudo.set(iv);
  tudo.set(dados, iv.length);
  return "\\x" + Array.from(tudo, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Decifra o que o banco devolve (base64). */
export async function decifrarCredenciais(chave: CryptoKey, base64: string): Promise<CredenciaisWhatsapp> {
  const tudo = deBase64(base64.replace(/\s/g, ""));
  const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: tudo.slice(0, 12) }, chave, tudo.slice(12));
  return JSON.parse(new TextDecoder().decode(claro)) as CredenciaisWhatsapp;
}

// ---------------------------------------------------------------------------------------
// Wafly (piloto, não oficial).

const TIPOS_MIDIA = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "audio/ogg", "audio/mpeg", "audio/mp4", "video/mp4"]);

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}
function obj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}
/** "audio/ogg; codecs=opus" → "audio/ogg". */
function tipoMidia(v: unknown, padrao: string): string {
  const t = (texto(v) ?? padrao).split(";")[0]!.trim().toLowerCase();
  return t === "image/jpg" ? "image/jpeg" : t;
}
function quando(v: unknown): string {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
  if (Number.isFinite(n)) return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  return new Date().toISOString();
}

/** Lê a mensagem recebida no formato do Wafly (parecido com o da Z-API). */
export function lerRecebidaWafly(corpo: unknown): MensagemRecebida | null {
  const c = obj(corpo);
  if (!c) return null;
  const telefone = texto(c.phone);
  const id = texto(c.messageId) ?? texto(c.id);
  if (!telefone || !id || c.fromMe === true || c.isGroup === true || c.isNewsletter === true || c.broadcast === true) return null;
  if (/@(g\.us|newsletter|broadcast)$|-group$/.test(telefone)) return null;
  const base = { id, telefone, enviadaEm: quando(c.momment ?? c.moment ?? c.timestamp) };
  const txt = texto(obj(c.text)?.message) ?? texto(obj(c.buttonsResponseMessage)?.message) ?? texto(obj(c.listResponseMessage)?.title);
  const midias: [string, string, string, string][] = [
    ["image", "imageUrl", "IMAGEM", "image/jpeg"],
    ["audio", "audioUrl", "AUDIO", "audio/ogg"],
    ["video", "videoUrl", "VIDEO", "video/mp4"],
    ["document", "documentUrl", "DOCUMENTO", "application/pdf"],
  ];
  for (const [campo, url, tipo, padrao] of midias) {
    const m = obj(c[campo]);
    if (!m) continue;
    const endereco = texto(m[url]);
    const mime = tipoMidia(m.mimeType ?? m.mimetype, padrao);
    const legenda = texto(m.caption) ?? txt;
    return {
      ...base,
      tipo: tipo as MensagemRecebida["tipo"],
      ...(legenda ? { texto: legenda } : {}),
      ...(endereco && TIPOS_MIDIA.has(mime) ? { midia: { url: endereco, tipo: mime, ...(texto(m.fileName) ? { nome: texto(m.fileName) } : {}) } } : {}),
    };
  }
  if (txt) return { ...base, tipo: "TEXTO", texto: txt };
  return { ...base, tipo: "OUTRO" };
}

export function conectorWafly(clientToken: string, buscar: typeof fetch = fetch, base = "https://wafly.com.br/api-bridge-whats"): ConectorWhatsapp {
  const url = (c: CredenciaisWhatsapp, caminho: string) =>
    `${base}/instances/${encodeURIComponent(c.instancia)}/token/${encodeURIComponent(c.token)}/${caminho}`;
  async function chamar(c: CredenciaisWhatsapp, metodo: string, caminho: string, corpo?: unknown, tempoMs = 15_000): Promise<Response> {
    return await buscar(url(c, caminho), {
      method: metodo,
      headers: { "Client-Token": clientToken, ...(corpo === undefined ? {} : { "content-type": "application/json" }) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(tempoMs),
    });
  }
  // O endereço tem o token da instância: nunca vai para o registro; o erro diz só o status.
  function exigirOk(r: Response, oQue: string): Response {
    if (!r.ok) throw new Error(`Wafly recusou ${oQue} (HTTP ${r.status})`);
    return r;
  }
  const digitos = (t: string) => t.replace(/\D/g, "");

  return {
    provedor: "WAFLY",
    async enviarTexto(c, para, mensagem) {
      let r: Response;
      try {
        r = await chamar(c, "POST", "send-text", { phone: digitos(para), message: mensagem }, 20_000);
      } catch (e) {
        const tempo = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
        return { ok: false, erro: tempo ? "Tempo esgotado: pode ter saído" : "Sem conexão com o provedor", falha: tempo ? "TEMPO" : "PASSAGEIRA" };
      }
      if (r.status >= 500 || r.status === 429) return { ok: false, erro: `O provedor falhou (HTTP ${r.status})`, falha: "PASSAGEIRA" };
      if (r.status === 401) return { ok: false, erro: "Credenciais da instância recusadas", falha: "PERMANENTE" };
      if (r.status === 402) return { ok: false, erro: "Assinatura do provedor vencida", falha: "PERMANENTE" };
      const j = obj(await r.json().catch(() => null));
      const id = texto(j?.messageId) ?? texto(j?.id);
      if (r.ok && id) return { ok: true, id };
      const erro = texto(j?.error) ?? texto(j?.message) ?? `O provedor recusou (HTTP ${r.status})`;
      return { ok: false, erro: NUMERO_FORA_DO_WHATSAPP.test(erro) ? textoNumeroForaDoWhatsapp(erro) : erro, falha: "PERMANENTE" };
    },
    async qrCode(c) {
      await chamar(c, "POST", "connect", {}).catch(() => null);
      const j = obj(await (exigirOk(await chamar(c, "GET", "qr-code/image"), "o QR")).json());
      const v = texto(j?.value);
      if (!v || v === "connected") return { conectado: true };
      return { conectado: false, imagem: v.startsWith("data:image/") ? v : `data:image/png;base64,${v}` };
    },
    async codigoPareamento(c, telefone) {
      await chamar(c, "POST", "connect", {}).catch(() => null);
      const j = obj(await (exigirOk(await chamar(c, "POST", `pairing-code?phone=${digitos(telefone)}`, { phone: digitos(telefone) }), "o código")).json());
      const codigo = texto(j?.code) ?? texto(j?.value);
      if (!codigo) throw new Error("Wafly não devolveu o código");
      return codigo;
    },
    async situacao(c) {
      const j = obj(await (exigirOk(await chamar(c, "GET", "status"), "a situação")).json());
      if (texto(j?.value) !== "CONNECTED") return { conectado: false, aparelho: null };
      const d = obj(await (await chamar(c, "GET", "device")).json().catch(() => null));
      const fonte = texto(d?.phone) ?? texto(d?.wid) ?? texto(d?.jid) ?? texto(obj(d?.me)?.id) ?? texto(obj(d?.value)?.phone) ?? "";
      const n = digitos(fonte.split(/[@:]/)[0] ?? "");
      return { conectado: true, aparelho: n.length >= 10 ? `+${n}` : null };
    },
    async desconectar(c) {
      exigirOk(await chamar(c, "GET", "disconnect"), "a desconexão");
    },
    async ligarAvisos(c, base) {
      const pares: [string, TipoAvisoWhatsapp][] = [
        ["update-webhook-received", "recebida"], ["update-webhook-delivery", "entrega"],
        ["update-webhook-connected", "conectado"], ["update-webhook-disconnected", "desconectado"],
      ];
      for (const [rota, tipo] of pares) exigirOk(await chamar(c, "PUT", rota, { value: `${base}/${tipo}` }), "o aviso");
    },
    async baixar(endereco, limite) {
      if (!/^https:\/\//.test(endereco)) return null;
      try {
        const r = await buscar(endereco, { signal: AbortSignal.timeout(30_000) });
        if (!r.ok || !r.body) return null;
        const declarado = Number(r.headers.get("content-length") ?? "0");
        if (declarado > limite) return null;
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
    lerAviso(tipo, corpo) {
      const c = obj(corpo);
      if (!c) return null;
      const instancia = texto(c.instanceId) ?? null;
      if (tipo === "recebida") {
        const mensagem = lerRecebidaWafly(c);
        return mensagem ? { tipo: "RECEBIDA", instancia, mensagem } : null;
      }
      if (tipo === "entrega") {
        const ids = Array.isArray(c.ids) ? c.ids.filter((x): x is string => typeof x === "string") : [texto(c.messageId)].filter((x): x is string => !!x);
        if (!ids.length) return null;
        const status = (texto(c.status) ?? "").toUpperCase();
        return { tipo: status === "READ" || status === "PLAYED" || status === "READ_BY_ME" ? "LIDA" : "ENTREGUE", instancia, ids };
      }
      const aparelho = texto(c.phone) ?? null;
      return { tipo: tipo === "conectado" ? "CONECTADO" : "DESCONECTADO", instancia, aparelho };
    },
  };
}

/**
 * O link do painel no aviso à equipe: no modelo, entra no lugar de {{painel}}; no texto livre,
 * vai numa linha no fim (W-11).
 */
export function textoComLinkDoPainel(texto: string, link: string | null): string {
  if (!link) return texto.replaceAll("{{painel}}", "").trimEnd();
  return texto.includes("{{painel}}") ? texto.replaceAll("{{painel}}", link) : `${texto}\nAbrir no painel: ${link}`;
}

/**
 * Por que o arquivo não entrou, dito ao morador com o que ele pode fazer (W-05, D3). O banco
 * acrescenta "Não consegui usar o arquivo: ".
 */
export function motivoMidiaParaMorador(motivo: string): string {
  if (/vazio/i.test(motivo)) return "o arquivo chegou vazio. Mande de novo.";
  const mb = /passa de (\d+) MB/i.exec(motivo);
  if (mb) return `o arquivo passa de ${mb[1]} MB. Mande um menor ou tire outra foto.`;
  if (/PDF/.test(motivo) && /ativo|script|embutido/i.test(motivo)) return "o PDF tem conteúdo que não abrimos por segurança. Mande uma foto do documento.";
  if (/não aceito|Só fotos/i.test(motivo)) return "este tipo de arquivo não é aceito. Mande foto, PDF, áudio ou vídeo.";
  return "não consegui abrir o arquivo. Mande de novo ou tire outra foto.";
}
