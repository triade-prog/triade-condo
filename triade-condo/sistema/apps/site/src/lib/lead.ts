// Pedido de demonstração: validação, texto do e-mail e envio pelo Resend.
// Desde a 0296 (CM-01), o pedido também entra como interessado no Comercial do Console, pela rota
// protegida da api-console. O e-mail continua como aviso; o pedido vale se um dos dois chegou.

import { opcoesUnidades } from "../dados/oferta";

export type Pedido = { nome: string; whatsapp: string; condominio: string; unidades: string };
export type Campo = keyof Pedido | "consentimento";
export type Validacao = { ok: true; pedido: Pedido } | { ok: false; erros: Partial<Record<Campo, string>> };

const limpar = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** Só dígitos, com o 55 do Brasil quando faltar. Aceita fixo e celular com DDD. */
export function normalizarWhatsapp(v: string): string | null {
  // Número com + de outro país: o atendimento é no Brasil.
  if (/^\s*\+/.test(v) && !/^\s*\+\s*55/.test(v)) return null;
  let d = v.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!(d.length === 12 || d.length === 13) || !d.startsWith("55")) return null;
  return d;
}

export function validarPedido(dados: Record<string, unknown>): Validacao {
  const erros: Partial<Record<Campo, string>> = {};
  const nome = limpar(dados.nome);
  const condominio = limpar(dados.condominio);
  const unidades = limpar(dados.unidades);
  const whatsapp = normalizarWhatsapp(limpar(dados.whatsapp));
  const consentimento = dados.consentimento === true || dados.consentimento === "on" || dados.consentimento === "sim";

  if (nome.length < 2) erros.nome = "Escreva o seu nome.";
  else if (nome.length > 80) erros.nome = "Use até 80 letras.";
  if (!whatsapp) erros.whatsapp = "Falta o WhatsApp, com DDD. Sem ele não conseguimos responder.";
  if (condominio.length < 2) erros.condominio = "Escreva o nome do condomínio e a cidade.";
  else if (condominio.length > 120) erros.condominio = "Use até 120 letras.";
  if (!opcoesUnidades.includes(unidades)) erros.unidades = "Escolha a faixa de unidades.";
  if (!consentimento) erros.consentimento = "Marque a autorização para podermos responder.";

  if (Object.keys(erros).length > 0 || !whatsapp) return { ok: false, erros };
  return { ok: true, pedido: { nome, whatsapp, condominio, unidades } };
}

/** WhatsApp mascarado para a confirmação: (61) 9 ••••-0412. */
export function mascararWhatsapp(d: string): string {
  const local = d.slice(2);
  const ddd = local.slice(0, 2);
  const fim = local.slice(-4);
  const nove = local.length === 11 ? `${local[2]} ` : "";
  return `(${ddd}) ${nove}••••-${fim}`;
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export function emailDoPedido(p: Pedido, recebidoEm: Date) {
  const quando = recebidoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const assunto = `Demonstração: ${p.condominio} (${p.unidades})`;
  const linhas: [string, string][] = [
    ["Nome", p.nome],
    ["WhatsApp", `+${p.whatsapp}`],
    ["Condomínio", p.condominio],
    ["Unidades", p.unidades],
    ["Recebido em", `${quando} (Brasília)`],
  ];
  const texto = linhas.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\nResponder pelo WhatsApp até o fim do próximo dia útil: https://wa.me/${p.whatsapp}`;
  const html = `<p>Novo pedido de demonstração pelo site.</p><table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">${linhas
    .map(([k, v]) => `<tr><td style="color:#5e5475">${escapar(k)}</td><td><b>${escapar(v)}</b></td></tr>`)
    .join("")}</table><p style="font-family:sans-serif;font-size:14px">Prometemos responder pelo WhatsApp até o fim do próximo dia útil. <a href="https://wa.me/${p.whatsapp}">Abrir a conversa</a>.</p>`;
  return { assunto, texto, html };
}

/** O texto que a pessoa viu ao marcar a autorização; vai junto para a base legal do interessado. */
export const TEXTO_CONSENTIMENTO = "Autorizo o uso destes dados só para responder a este pedido, como diz a política de privacidade. Nada de lista de e-mails.";

const CHAVES_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

/** Só os utm_* conhecidos, curtos. Vêm do formulário (campos escondidos) ou do JSON. */
export function lerUtm(dados: Record<string, unknown>): Partial<Record<(typeof CHAVES_UTM)[number], string>> | null {
  const fonte = typeof dados.utm === "object" && dados.utm ? (dados.utm as Record<string, unknown>) : dados;
  const utm: Partial<Record<(typeof CHAVES_UTM)[number], string>> = {};
  for (const k of CHAVES_UTM) {
    const v = limpar(fonte[k]).slice(0, 100);
    if (v) utm[k] = v;
  }
  return Object.keys(utm).length ? utm : null;
}

/** A faixa do Comercial a partir do rótulo curto do formulário. */
export function faixaDoPedido(unidades: string): string | null {
  const t = unidades.toLowerCase();
  if (t.startsWith("até 40")) return "ATE_40";
  if (t.startsWith("41 a 100")) return "DE_41_A_100";
  if (t.startsWith("101 a 200")) return "DE_101_A_200";
  if (t.startsWith("201 a 400")) return "DE_201_A_400";
  if (t.includes("400")) return "ACIMA_DE_400";
  return null;
}

export type EntradaComercial = { ok: true } | { ok: false; motivo: "sem-configuracao" | "falha-envio" };

/** Grava o pedido no Comercial do Console (rota /v1/site/interessados, com o segredo do site). */
export async function enviarAoComercial(
  p: Pedido,
  extra: { utm: ReturnType<typeof lerUtm>; pagina?: string | null },
  env: { SUPABASE_FUNCTIONS_URL?: string; SITE_SEGREDO?: string },
  buscar: typeof fetch = fetch,
): Promise<EntradaComercial> {
  if (!env.SUPABASE_FUNCTIONS_URL || !env.SITE_SEGREDO) return { ok: false, motivo: "sem-configuracao" };
  try {
    const r = await buscar(`${env.SUPABASE_FUNCTIONS_URL.replace(/\/$/, "")}/api-console/v1/site/interessados`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-site-segredo": env.SITE_SEGREDO },
      body: JSON.stringify({
        nome: p.nome, whatsapp: p.whatsapp, condominio: p.condominio, faixa: faixaDoPedido(p.unidades), unidadesTexto: p.unidades,
        consentimento: true, consentimentoTexto: TEXTO_CONSENTIMENTO, pagina: extra.pagina?.slice(0, 200) || null, utm: extra.utm,
      }),
    });
    return r.ok ? { ok: true } : { ok: false, motivo: "falha-envio" };
  } catch {
    return { ok: false, motivo: "falha-envio" };
  }
}

export type Envio = { ok: true } | { ok: false; motivo: "sem-configuracao" | "falha-envio" };

export async function enviarPedido(
  p: Pedido,
  env: { RESEND_API_KEY?: string; LEADS_EMAIL_DE?: string; LEADS_EMAIL_PARA?: string },
  agora = new Date(),
  buscar: typeof fetch = fetch,
): Promise<Envio> {
  if (!env.RESEND_API_KEY || !env.LEADS_EMAIL_PARA || !env.LEADS_EMAIL_DE) return { ok: false, motivo: "sem-configuracao" };
  const { assunto, texto, html } = emailDoPedido(p, agora);
  try {
    const r = await buscar("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.LEADS_EMAIL_DE,
        to: env.LEADS_EMAIL_PARA.split(",").map((s) => s.trim()).filter(Boolean),
        subject: assunto,
        text: texto,
        html,
      }),
    });
    return r.ok ? { ok: true } : { ok: false, motivo: "falha-envio" };
  } catch {
    return { ok: false, motivo: "falha-envio" };
  }
}
