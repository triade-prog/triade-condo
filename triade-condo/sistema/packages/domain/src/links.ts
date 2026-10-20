// Links e QR (peça R13; AT-30, MP-08, V-11): etiquetas por local que abrem o WhatsApp do
// condomínio e o link do prestador na manutenção. Os mesmos valores estão no banco
// (0170_links_qr.sql).

import { z } from "zod";
import { mostrarDataCurta } from "./agenda.ts";

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const motivo = z.string().trim().min(3).max(500);
const texto = (max: number) => z.string().max(max).nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null));

/** O código da etiqueta: 12 caracteres em três grupos, sem os que se confundem (como o do mural). */
export const CODIGO_ETIQUETA = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

/** O recado da etiqueta some em no máximo 30 dias; o padrão é 7. */
export const RECADO_DIAS = { padrao: 7, maximo: 30 } as const;
/** O link do prestador vale até a data escolhida: padrão 14 dias, no máximo 60. */
export const LINK_PRESTADOR_DIAS = { padrao: 14, maximo: 60 } as const;

export const etiquetaSchema = z
  .object({
    versao: versao.optional(),
    local: z.string().trim().min(2).max(120),
    onde: texto(120),
    recado: texto(300),
    recadoAte: data.nullable().optional().transform((v) => v ?? null),
  })
  .refine((v) => !v.recado || v.recadoAte, { path: ["recadoAte"], message: "O recado precisa da data em que some" });
export const motivoEtiquetaSchema = z.object({ versao, motivo });

/** O que impediu o prestador (V-11). */
export const IMPEDIMENTOS_PRESTADOR = {
  SEM_ACESSO: "Sem acesso",
  FALTA_PECA: "Falta peça",
  OUTRO_SERVICO: "Outro serviço antes",
  OUTRO: "Outro",
} as const;
export type ImpedimentoPrestador = keyof typeof IMPEDIMENTOS_PRESTADOR;

export const linkPrestadorSchema = z.object({
  versao,
  oQueFazer: z.string().trim().min(10).max(2000),
  quando: texto(120),
  comoEntrar: texto(500),
  valeAte: data,
  arquivos: z.array(id).max(10).default([]),
  /** Prazo para o prestador responder antes de passar à reserva (MP-09). Sem reserva, nulo. */
  responderHoras: z.union([z.literal(4), z.literal(8), z.literal(24), z.literal(48)]).nullable().optional().transform((v) => v ?? null),
});
/** Prazos para o prestador responder (MP-09): horas corridas desde o envio; o padrão é 24. */
export const PRAZOS_RESPOSTA_PRESTADOR = [4, 8, 24, 48] as const;
export const PRAZO_RESPOSTA_PADRAO = 24;
export const CANAIS_LINK = { COPIADO: "Copiado", WHATSAPP: "WhatsApp", EMAIL: "E-mail" } as const;
export const envioLinkSchema = z.object({ canal: z.enum(chaves(CANAIS_LINK)) });
export const cancelarLinkSchema = z.object({ motivo });

/** Sem conta: o que o prestador manda pelo link. Recusar pode dizer por quê. */
export const recusarPrestadorSchema = z.object({
  texto: texto(500).pipe(z.string().min(3).nullable()),
});
/** Sem conta: o que o prestador manda pelo link. */
export const chegadaSchema = z.object({ etiqueta: z.string().max(200).nullable().optional().transform((v) => v ?? null) });
export const fotoPrestadorSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().max(100),
  tamanho: z.number().int().min(1),
});
export const impedimentoSchema = z.object({
  impedimento: z.enum(chaves(IMPEDIMENTOS_PRESTADOR)),
  texto: z.string().trim().min(3).max(2000),
  fotos: z.array(id).max(10).default([]),
});
export const termineiSchema = z
  .object({
    texto: z.string().trim().min(3).max(2000),
    ficouPendente: z.boolean(),
    pendenteTexto: texto(500),
    quemFez: z.string().trim().min(2).max(120),
    fotos: z.array(id).max(10).default([]),
  })
  .refine((v) => !v.ficouPendente || (v.pendenteTexto && v.pendenteTexto.length >= 3), {
    path: ["pendenteTexto"],
    message: "Diga o que ficou para depois",
  });

/** "E04": o código curto que vai impresso na etiqueta. */
export function rotuloEtiqueta(numero: number): string {
  return `E${String(numero).padStart(2, "0")}`;
}

/** A mensagem que já vem escrita quando alguém aponta a câmera para a etiqueta (AT-30). */
export function mensagemEtiqueta(local: string, rotulo: string): string {
  return `Olá! Quero avisar um problema em: ${local} (etiqueta ${rotulo}). O que eu vi: `;
}

/** Abre o WhatsApp no número dado (só dígitos, com o país), com a mensagem começada. */
export function linkWhatsapp(numero: string, mensagem: string): string {
  return `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(mensagem)}`;
}

/** A mensagem que acompanha o link do prestador, no WhatsApp ou no e-mail de quem manda. */
export function mensagemPrestador(p: { condominio: string; titulo: string; quando?: string | null; link: string }): string {
  return [
    `Olá! O ${p.condominio} mandou um serviço para você: ${p.titulo}.`,
    p.quando ? `Quando: ${p.quando}.` : null,
    `Veja o que fazer, registre a chegada e conte o que fez por este link: ${p.link}`,
  ].filter(Boolean).join("\n");
}

/**
 * O código de etiqueta que a câmera leu. Aceita o endereço inteiro (".../l/ABCD-EFGH-JKMN") ou só
 * o código; qualquer outra coisa é "não é uma etiqueta".
 */
export function codigoDaEtiquetaLida(texto: string): string | null {
  const t = texto.trim();
  const m = /\/l\/([A-Za-z0-9-]{14})(?:[/?#]|$)/.exec(t);
  const c = (m ? m[1]! : t).toUpperCase();
  return CODIGO_ETIQUETA.test(c) ? c : null;
}

/** Histórico da etiqueta, em uma linha. */
export function descreverEventoEtiqueta(acao: string, d: Record<string, unknown>): string {
  switch (acao) {
    case "etiqueta.criada":
      return `Etiqueta criada: ${String(d.local)}`;
    case "etiqueta.alterada":
      return d.local ? `Local mudou de ${String(d.localAntes)} para ${String(d.local)}` : "Onde a etiqueta fica mudou";
    case "etiqueta.recado":
      return `Recado: ${String(d.recado)}${d.ate ? ` · some em ${mostrarDataCurta(String(d.ate))}` : ""}`;
    case "etiqueta.recado_tirado":
      return "Recado tirado";
    case "etiqueta.codigo_trocado":
      return `Código trocado. Motivo: ${String(d.motivo)}`;
    case "etiqueta.desativada":
      return `Desativada. Motivo: ${String(d.motivo)}`;
    default:
      return "Alteração";
  }
}

/** Histórico da manutenção: os eventos do link do prestador. Nulo quando o evento é de outra parte. */
export function descreverEventoLinkPrestador(acao: string, d: Record<string, unknown>): string | null {
  switch (acao) {
    case "manutencao.link_prestador":
      return `Link mandado para ${String(d.para)}, vale até ${mostrarDataCurta(String(d.ate))}`;
    case "manutencao.link_prestador_enviado":
      return d.canal === "COPIADO" ? "Link copiado" : `Link enviado por ${CANAIS_LINK[d.canal as keyof typeof CANAIS_LINK] ?? "mensagem"}`;
    case "manutencao.link_prestador_aberto":
      return "O prestador abriu o link";
    case "manutencao.link_prestador_cancelado":
      return `Link cancelado. Motivo: ${String(d.motivo)}`;
    case "manutencao.prestador_chegou":
      return d.confirmado ? `Chegou, confirmado pela etiqueta ${String(d.etiqueta)}` : "Chegou, informado pelo prestador";
    case "manutencao.prestador_impedimento":
      return `Não conseguiu fazer: ${String(d.texto)}`;
    case "manutencao.prestador_terminou":
      return `Terminou: ${String(d.texto)}`;
    case "manutencao.foto_prestador_tirada":
      return `Foto do prestador tirada: ${String(d.arquivoNome)}`;
    case "manutencao.prestador_confirmou":
      return "O prestador confirmou que vai fazer";
    case "manutencao.prestador_recusou":
      return "O prestador disse que não pode atender";
    case "manutencao.reserva_programada":
      return `Se não responder em ${String(d.horas)} h, passa para a reserva`;
    case "manutencao.reserva_desligada":
      return "Troca automática para a reserva desligada";
    case "manutencao.reserva_assumiu": {
      const porque = d.motivo === "RECUSOU" ? "o prestador não pode atender" : `sem resposta em ${String(d.horas)} h`;
      const link = d.canal === "WHATSAPP" ? "link mandado pelo WhatsApp" : "link a mandar";
      return `Passou para a reserva: ${porque}; ${link}`;
    }
    case "manutencao.reserva_nao_assumiu":
      return "Não passou para a reserva: a reserva está arquivada";
    case "manutencao.reserva_sem_resposta":
      return "A reserva também não respondeu no prazo";
    case "manutencao.link_no_registro":
      return `Link mandado no registro do pedido ${d.canal === "WHATSAPP" ? "pelo WhatsApp do condomínio" : "por e-mail"}; responder em ${String(d.horas)} h, contadas da saída da mensagem`;
    case "manutencao.prestador_sem_resposta":
      return "O prestador não respondeu no prazo e não há reserva para passar";
    default:
      return null;
  }
}
