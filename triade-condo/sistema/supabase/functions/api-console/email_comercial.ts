// E-mails da agenda de demonstrações (0310, R17.6; CM-23): a confirmação, o lembrete e o
// cancelamento. O banco monta a fila (comercial_emails_pegar) e diz o que vai em cada e-mail;
// aqui o e-mail ganha forma e sai pelo Resend que já existe. Sem a chave, a fila registra
// "sem chave" e não falha. Nada sai pelo WhatsApp.

import type { EmailPronto } from "../_shared/email.ts";

/** O que o banco devolve para cada e-mail da fila do Comercial. */
export interface EmailComercialFila {
  id: string;
  tipo: "CONFIRMACAO" | "LEMBRETE" | "CANCELAMENTO";
  para: string;
  nome?: string;
  condominio?: string;
  inicio: string;
  fim: string;
  /** "terça, 27/10, 14:00" (horário de Brasília). */
  quando: string;
  duracaoMinutos: number;
  salaUrl?: string;
  remarcada?: boolean;
  motivo?: string;
}

/** Remetente padrão (o mesmo domínio dos e-mails da Plataforma). */
export const REMETENTE_COMERCIAL = "TRÍADE <nao-responda@t3condo.trihub.com.br>";

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pagina(corpo: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F7F4FC;font-family:Arial,Helvetica,sans-serif;color:#1E1531">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4FC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E4DCF1;border-radius:16px;overflow:hidden">
<tr><td style="height:6px;background:#FF8D01"></td></tr>
<tr><td style="padding:20px 28px 0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5E5475">TRÍADE</td></tr>
<tr><td style="padding:8px 28px 8px;font-size:15px;line-height:1.6">${corpo}</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #E4DCF1;font-size:12px;line-height:1.6;color:#5E5475">
<p style="margin:4px 0">Usamos o seu e-mail só para esta demonstração; ele é apagado da fila 90 dias depois.</p>
<p style="margin:4px 0">A TRÍADE nunca pede senha, código ou pagamento por e-mail.</p></td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Dá forma a um e-mail da agenda. Com `responderPara` (o e-mail do Comercial), a pessoa remarca
 * respondendo; sem ele, o e-mail diz para falar com a equipe.
 */
export function montarEmailComercial(m: EmailComercialFila, opcoes: { remetente?: string; responderPara?: string } = {}): EmailPronto {
  const mudar = opcoes.responderPara ? "Para mudar o horário, responda este e-mail." : "Para mudar o horário, fale com a equipe da TRÍADE.";
  const primeiro = m.nome?.trim().split(/\s+/)[0];
  const ola = primeiro ? `Olá, ${primeiro}!` : "Olá!";
  const predio = m.condominio ? ` do ${m.condominio}` : "";
  const sala = m.salaUrl ? `Entre pela sala: ${m.salaUrl}` : "O link da chamada vai por WhatsApp ou e-mail antes do horário.";
  let assunto: string;
  let linhas: string[];
  if (m.tipo === "CANCELAMENTO") {
    assunto = `Demonstração cancelada: ${m.quando}`;
    linhas = [ola, `A demonstração da TRÍADE${predio} de ${m.quando} foi cancelada.${m.motivo ? ` Motivo: ${m.motivo}.` : ""}`,
              opcoes.responderPara ? "Se quiser marcar outro horário, é só responder este e-mail." : "Se quiser marcar outro horário, fale com a equipe da TRÍADE."];
  } else if (m.tipo === "LEMBRETE") {
    assunto = `Lembrete: demonstração da TRÍADE ${m.quando}`;
    linhas = [ola, `Lembrete da demonstração da TRÍADE${predio}: ${m.quando} (horário de Brasília), ${m.duracaoMinutos} minutos.`, sala];
  } else {
    assunto = m.remarcada ? `Demonstração remarcada: ${m.quando}` : `Demonstração confirmada: ${m.quando}`;
    linhas = [ola, `${m.remarcada ? "Remarcamos" : "Confirmamos"} a demonstração da TRÍADE${predio}: ${m.quando} (horário de Brasília), ${m.duracaoMinutos} minutos.`,
              sala, mudar];
  }
  const html = pagina(linhas.map((l) => `<p style="margin:0 0 14px">${esc(l)}</p>`).join(""));
  return {
    de: opcoes.remetente ?? REMETENTE_COMERCIAL,
    para: m.para,
    ...(opcoes.responderPara ? { responderPara: opcoes.responderPara } : {}),
    assunto,
    html,
    texto: linhas.join("\n\n"),
    // As marcas não são de condomínio: o aviso do provedor (api-plataforma) ignora este envio.
    marcas: { condominio: "comercial", envio: m.id },
  };
}
