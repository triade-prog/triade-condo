// E-mail dos comunicados, documentos e convites de enquete e de assembleia (CD-13, CD-14, AC-02, AC-03). O banco monta a fila e diz o que vai em
// cada e-mail; aqui o e-mail ganha forma (HTML e texto), sai pelo Resend e os avisos do provedor
// (entregue, devolvido, spam) são conferidos pela assinatura antes de voltar ao banco.

import { ASSUNTOS_COMUNICADO, type AssuntoComunicado } from "@triade/domain";

/** O que o banco devolve para cada envio (email_pegar_lote). */
export interface MensagemFila {
  envio: string;
  condominio: string;
  tipo: "COMUNICADO" | "CONFIRMACAO" | "DOCUMENTO" | "ENQUETE" | "ASSEMBLEIA";
  para: string;
  condominioNome: string;
  responderPara?: string;
  nome?: string;
  unidades?: string;
  codigos: { ver?: string; parar?: string; confirmar?: string; abrir?: string; responder?: string; votar?: string };
  comunicado?: {
    assunto: string;
    titulo: string;
    texto: string;
    assinatura?: string;
    correcao?: string;
    imagens?: string[];
  };
  documento?: { titulo: string; numero: number; vigenteDesde: string; recado?: string };
  /** Convite (ou lembrete) de enquete: o link é só da unidade ou da pessoa (peça R12). */
  enquete?: { pergunta: string; prazo: string; dono: string; lembrete: boolean; secreta: boolean };
  /** Convocação (ou lembrete) de assembleia, com o link pessoal da unidade (peça R12). */
  assembleia?: { titulo: string; nome: string; chamada: string; dono: string; lembrete: boolean };
}

export interface EmailPronto {
  de: string;
  para: string;
  assunto: string;
  html: string;
  texto: string;
  responderPara?: string;
  cabecalhos?: Record<string, string>;
  marcas: { condominio: string; envio: string };
}

export type ResultadoEnvio = { ok: true; id: string } | { ok: false; erro: string; tentarDeNovo: boolean };

/** Quem manda os e-mails. Os testes passam um falso. */
export interface Correio {
  enviarLote(emails: EmailPronto[]): Promise<ResultadoEnvio[]>;
}

export interface EnderecosEmail {
  /** Endereço da Plataforma (links que o morador abre). */
  urlApp: string;
  /** Endereço da função, para o "parar de receber" em um clique do próprio programa de e-mail. */
  urlFuncao: string;
  remetente: string;
}

const AVISO_GOLPE = "O condomínio e a TRÍADE nunca pedem senha, código ou pagamento por e-mail.";

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function dataBr(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function botao(rotulo: string, url: string): string {
  return `<p style="margin:24px 0"><a href="${esc(url)}" style="display:inline-block;background:#5808CC;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">${esc(rotulo)}</a></p>`;
}

function pagina(condominio: string, corpo: string, rodape: string[]): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F7F4FC;font-family:Arial,Helvetica,sans-serif;color:#1E1531">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4FC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E4DCF1;border-radius:16px;overflow:hidden">
<tr><td style="height:6px;background:#FF8D01"></td></tr>
<tr><td style="padding:20px 28px 0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5E5475">${esc(condominio)}</td></tr>
<tr><td style="padding:8px 28px 8px;font-size:15px;line-height:1.6">${corpo}</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #E4DCF1;font-size:12px;line-height:1.6;color:#5E5475">${rodape.map((r) => `<p style="margin:4px 0">${r}</p>`).join("")}</td></tr>
</table></td></tr></table></body></html>`;
}

function paragrafos(t: string): string {
  return t.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/** Dá forma ao e-mail de um envio da fila. */
export function montarEmail(m: MensagemFila, e: EnderecosEmail): EmailPronto {
  const nomeRemetente = `${m.condominioNome} (pela TRÍADE Condo)`.replace(/["<>\r\n]/g, "");
  const base = {
    de: `"${nomeRemetente}" <${e.remetente}>`,
    para: m.para,
    responderPara: m.responderPara,
    marcas: { condominio: m.condominio, envio: m.envio },
  };
  const app = e.urlApp.replace(/\/$/, "");

  if (m.tipo === "CONFIRMACAO") {
    const url = `${app}/e/confirmar?c=${encodeURIComponent(m.codigos.confirmar ?? "")}`;
    const ola = m.nome ? `Olá, ${m.nome}.` : "Olá.";
    return {
      ...base,
      assunto: `[${m.condominioNome}] Confirme seu e-mail para receber os comunicados`,
      html: pagina(m.condominioNome,
        `<p style="margin:0 0 14px">${esc(ola)}</p><p style="margin:0 0 14px">A gestão do ${esc(m.condominioNome)} cadastrou este e-mail para você receber os comunicados do prédio. Para começar, confirme que ele é seu.</p>${botao("Confirmar meu e-mail", url)}<p style="margin:0 0 14px">O link vale 7 dias. Se você não conhece este condomínio, ignore este e-mail: nada mais será enviado.</p>`,
        [esc(AVISO_GOLPE)]),
      texto: `${ola}\n\nA gestão do ${m.condominioNome} cadastrou este e-mail para você receber os comunicados do prédio. Para começar, confirme que ele é seu:\n${url}\n\nO link vale 7 dias. Se você não conhece este condomínio, ignore este e-mail.\n\n${AVISO_GOLPE}`,
    };
  }

  if (m.tipo === "DOCUMENTO" && m.documento) {
    const d = m.documento;
    const url = `${app}/d/${encodeURIComponent(m.codigos.abrir ?? "")}`;
    const linha = `Segue o documento ${d.titulo}, versão ${d.numero}, em vigor desde ${dataBr(d.vigenteDesde)}.`;
    return {
      ...base,
      assunto: `[${m.condominioNome}] ${d.titulo}`,
      html: pagina(m.condominioNome,
        `<h1 style="font-size:22px;font-weight:600;margin:4px 0 14px">${esc(d.titulo)}</h1><p style="margin:0 0 14px">${esc(linha)}</p>${d.recado ? `<p style="margin:0 0 14px;padding:12px 14px;background:#F8F3FF;border-radius:10px">${esc(d.recado)}</p>` : ""}${botao("Abrir o documento", url)}<p style="margin:0 0 14px">O link vale 7 dias e pode ser cancelado pelo condomínio. Depois de baixado, guarde o arquivo com cuidado.</p>`,
        [esc(AVISO_GOLPE)]),
      texto: `${d.titulo}\n\n${linha}\n${d.recado ? `\n${d.recado}\n` : ""}\nAbrir o documento: ${url}\n\nO link vale 7 dias e pode ser cancelado pelo condomínio.\n\n${AVISO_GOLPE}`,
    };
  }

  if (m.tipo === "ENQUETE" && m.enquete) {
    const q = m.enquete;
    const url = `${app}/v/${encodeURIComponent(m.codigos.responder ?? "")}`;
    const parar = `${app}/e/parar?c=${encodeURIComponent(m.codigos.parar ?? "")}`;
    const linha = q.lembrete
      ? `A enquete fecha em ${q.prazo} e ainda falta a resposta ${q.dono}.`
      : `O condomínio quer saber a opinião ${q.dono}. Responda até ${q.prazo}.`;
    const sigilo = q.secreta ? "A resposta é secreta: o condomínio vê só quem respondeu, não o que respondeu." : "A resposta não é secreta: o condomínio vê o que cada um respondeu.";
    const nota = `O link é só ${q.dono}: não repasse. Dá para trocar a resposta até o prazo.`;
    return {
      ...base,
      assunto: `[${m.condominioNome}] ${q.lembrete ? "Lembrete: " : ""}Enquete: ${q.pergunta}`,
      html: pagina(m.condominioNome,
        `<p style="margin:0 0 8px"><span style="display:inline-block;background:#F1EFF5;border-radius:6px;padding:2px 8px;font-size:12px;color:#4A4258">Enquete</span></p><h1 style="font-size:22px;font-weight:600;margin:4px 0 14px">${esc(q.pergunta)}</h1><p style="margin:0 0 14px">${esc(linha)}</p>${botao("Responder a enquete", url)}<p style="margin:0 0 14px">${esc(nota)} ${esc(sigilo)}</p>`,
        [`<a href="${esc(parar)}" style="color:#5808CC">Parar de receber por e-mail</a> · ${esc(AVISO_GOLPE)}`]),
      texto: `Enquete: ${q.pergunta}\n\n${linha}\n\nResponder: ${url}\n\n${nota} ${sigilo}\n\nParar de receber por e-mail: ${parar}\n${AVISO_GOLPE}`,
      cabecalhos: {
        "List-Unsubscribe": `<${e.urlFuncao.replace(/\/$/, "")}/v1/email/parar/${m.codigos.parar ?? ""}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  }

  if (m.tipo === "ASSEMBLEIA" && m.assembleia) {
    const a = m.assembleia;
    const url = `${app}/a/${encodeURIComponent(m.codigos.votar ?? "")}`;
    const parar = `${app}/e/parar?c=${encodeURIComponent(m.codigos.parar ?? "")}`;
    const linha = a.lembrete
      ? `Lembrete: a ${a.nome} é em ${a.chamada}.`
      : `O ${m.condominioNome} convoca a ${a.nome}, com 1ª chamada em ${a.chamada}. O edital está no mural.`;
    const nota = `Pelo link, que é só ${a.dono}, dá para indicar procurador, registrar presença e votar online. Não repasse.`;
    return {
      ...base,
      assunto: `[${m.condominioNome}] ${a.lembrete ? "Lembrete: " : ""}${a.titulo}`,
      html: pagina(m.condominioNome,
        `<p style="margin:0 0 8px"><span style="display:inline-block;background:#F1EFF5;border-radius:6px;padding:2px 8px;font-size:12px;color:#4A4258">Assembleia</span></p><h1 style="font-size:22px;font-weight:600;margin:4px 0 14px">${esc(a.titulo)}</h1><p style="margin:0 0 14px">${esc(linha)}</p>${botao("Abrir o link da assembleia", url)}<p style="margin:0 0 14px">${esc(nota)}</p>`,
        [`<a href="${esc(parar)}" style="color:#5808CC">Parar de receber por e-mail</a> · ${esc(AVISO_GOLPE)}`]),
      texto: `${a.titulo}\n\n${linha}\n\nAbrir o link da assembleia: ${url}\n\n${nota}\n\nParar de receber por e-mail: ${parar}\n${AVISO_GOLPE}`,
      cabecalhos: {
        "List-Unsubscribe": `<${e.urlFuncao.replace(/\/$/, "")}/v1/email/parar/${m.codigos.parar ?? ""}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  }

  const c = m.comunicado!;
  const ver = `${app}/c/${encodeURIComponent(m.codigos.ver ?? "")}`;
  const parar = `${app}/e/parar?c=${encodeURIComponent(m.codigos.parar ?? "")}`;
  const assunto = ASSUNTOS_COMUNICADO[c.assunto as AssuntoComunicado] ?? "Comunicado";
  const imagens = (c.imagens ?? [])
    .map((id) => `<p style="margin:0 0 14px"><img src="${esc(`${ver}/foto/${id}`)}" alt="Foto do comunicado" style="max-width:100%;border-radius:12px"></p>`)
    .join("");
  const motivo = m.unidades ? `Você recebe porque é contato de ${m.unidades} no ${m.condominioNome}.` : `Você recebe porque é contato do ${m.condominioNome}.`;
  return {
    ...base,
    assunto: `[${m.condominioNome}] ${c.correcao ? "Corrigido: " : ""}${c.titulo}`,
    html: pagina(m.condominioNome,
      `<p style="margin:0 0 8px"><span style="display:inline-block;background:#F1EFF5;border-radius:6px;padding:2px 8px;font-size:12px;color:#4A4258">${esc(assunto)}</span></p><h1 style="font-size:22px;font-weight:600;margin:4px 0 14px">${esc(c.titulo)}</h1>${c.correcao ? `<p style="margin:0 0 14px;padding:12px 14px;background:#FFF6E6;border-radius:10px"><b>O que mudou:</b> ${esc(c.correcao)}</p>` : ""}${paragrafos(c.texto)}${c.assinatura ? `<p style="margin:0 0 14px">${esc(c.assinatura)}</p>` : ""}${imagens}${botao("Ver no mural, com os arquivos", ver)}`,
      [esc(motivo), `<a href="${esc(parar)}" style="color:#5808CC">Parar de receber por e-mail</a> · ${esc(AVISO_GOLPE)}`]),
    texto: `${assunto}\n\n${c.titulo}\n\n${c.correcao ? `O que mudou: ${c.correcao}\n\n` : ""}${c.texto}\n\n${c.assinatura ?? ""}\n\nVer no mural, com os arquivos: ${ver}\n\n${motivo}\nParar de receber por e-mail: ${parar}\n${AVISO_GOLPE}`,
    cabecalhos: {
      "List-Unsubscribe": `<${e.urlFuncao.replace(/\/$/, "")}/v1/email/parar/${m.codigos.parar ?? ""}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** Resend, pelo envio em lote (até 100 por chamada). */
export function correioResend(chave: string, buscar: typeof fetch = fetch): Correio {
  return {
    async enviarLote(emails) {
      if (emails.length === 0) return [];
      const corpo = emails.map((e) => ({
        from: e.de,
        to: [e.para],
        subject: e.assunto,
        html: e.html,
        text: e.texto,
        reply_to: e.responderPara ? [e.responderPara] : undefined,
        headers: e.cabecalhos,
        tags: [{ name: "condominio", value: e.marcas.condominio }, { name: "envio", value: e.marcas.envio }],
      }));
      let r: Response;
      try {
        r = await buscar("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
          body: JSON.stringify(corpo),
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        return emails.map(() => ({ ok: false as const, erro: "Sem resposta do provedor", tentarDeNovo: true }));
      }
      const dados = (await r.json().catch(() => null)) as { data?: { id?: string }[]; message?: string } | null;
      if (!r.ok) {
        const passageiro = r.status === 429 || r.status >= 500;
        const erro = `Resend respondeu ${r.status}${dados?.message ? `: ${dados.message}` : ""}`.slice(0, 300);
        return emails.map(() => ({ ok: false as const, erro, tentarDeNovo: passageiro }));
      }
      return emails.map((_, i) => {
        const id = dados?.data?.[i]?.id;
        return id ? { ok: true as const, id } : { ok: false as const, erro: "O provedor não devolveu o envio", tentarDeNovo: true };
      });
    },
  };
}

// ---------------------------------------------------------------------------------------
// Avisos do provedor (webhook do Resend, assinado pelo Svix).

function iguais(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Confere a assinatura do aviso: HMAC-SHA256 de "id.timestamp.corpo", com até 5 minutos de diferença. */
export async function avisoAssinado(segredo: string, headers: Headers, corpo: string, agora = Date.now()): Promise<boolean> {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const assinaturas = headers.get("svix-signature");
  if (!segredo || !id || !ts || !assinaturas || !/^\d+$/.test(ts)) return false;
  if (Math.abs(agora / 1000 - Number(ts)) > 300) return false;
  let chave: Uint8Array<ArrayBuffer>;
  try {
    chave = Uint8Array.from(atob(segredo.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  const k = await crypto.subtle.importKey("raw", chave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const esperado = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${id}.${ts}.${corpo}`)));
  return assinaturas.split(" ").some((a) => {
    const [versao, valor] = a.split(",");
    if (versao !== "v1" || !valor) return false;
    try {
      return iguais(Uint8Array.from(atob(valor), (c) => c.charCodeAt(0)), esperado);
    } catch {
      return false;
    }
  });
}

export interface EventoEmail {
  condominio: string;
  envio: string;
  provedorId: string | null;
  tipo: "ENTREGUE" | "DEVOLVIDO" | "ADIADO" | "SPAM";
  detalhe: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Traduz o aviso do Resend. Aviso sem as marcas do envio, ou de tipo que não importa, vira nulo. */
export function lerEventoResend(corpo: unknown): EventoEmail | null {
  const ev = corpo as { type?: string; data?: { email_id?: string; tags?: unknown; bounce?: { type?: string; message?: string } } } | null;
  const data = ev?.data;
  if (!ev?.type || !data) return null;
  let marcas: Record<string, string> = {};
  if (Array.isArray(data.tags)) {
    for (const t of data.tags as { name?: string; value?: string }[]) if (t?.name && t.value) marcas[t.name] = t.value;
  } else if (data.tags && typeof data.tags === "object") {
    marcas = data.tags as Record<string, string>;
  }
  if (!UUID.test(marcas.condominio ?? "") || !UUID.test(marcas.envio ?? "")) return null;
  const base = { condominio: marcas.condominio!, envio: marcas.envio!, provedorId: data.email_id ?? null };
  switch (ev.type) {
    case "email.delivered":
      return { ...base, tipo: "ENTREGUE", detalhe: null };
    case "email.complained":
      return { ...base, tipo: "SPAM", detalhe: null };
    case "email.bounced": {
      const passageiro = /transient|temporar/i.test(data.bounce?.type ?? "");
      return { ...base, tipo: passageiro ? "ADIADO" : "DEVOLVIDO", detalhe: (data.bounce?.message ?? "Endereço não existe").slice(0, 300) };
    }
    default:
      return null;
  }
}
