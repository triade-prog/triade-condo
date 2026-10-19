// WhatsApp do condomínio (passo 5; W-01, W-05, W-08 a W-16, W-21, AT-28, F6.3). Começa como
// piloto pelo Wafly (DC14), atrás de um conector trocável. Os mesmos valores estão no banco
// (0200_whatsapp.sql).

import { z } from "zod";

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();

export const PROVEDORES_WHATSAPP = {
  WAFLY: { nome: "Wafly", oficial: false },
} as const;

export const SITUACOES_CONEXAO = {
  SEM_CREDENCIAIS: "Sem credenciais",
  DESCONECTADO: "Desconectado",
  CONECTANDO: "Conectando",
  CONECTADO: "Conectado",
} as const;
export type SituacaoConexao = keyof typeof SITUACOES_CONEXAO;

/** Estados de cada mensagem enviada, separados do estado do pedido (W-13). */
export const ESTADOS_ENVIO_WHATSAPP = {
  NA_FILA: "Na fila",
  ENVIANDO: "Enviando",
  ENVIADA: "Enviada",
  ENTREGUE: "Entregue",
  LIDA: "Lida",
  FALHOU: "Falhou",
  DESCONHECIDO: "Resultado desconhecido",
  CANCELADA: "Cancelada",
} as const;
export type EstadoEnvioWhatsapp = keyof typeof ESTADOS_ENVIO_WHATSAPP;

export const FINALIDADES_ENVIO = {
  RESPOSTA: "Resposta automática",
  RETORNO: "Retorno",
  AVISO: "Aviso a quem atende",
} as const;

/** Avisos que cada pessoa liga no próprio WhatsApp (W-11, F6.3). */
export const AVISOS_NO_WHATSAPP = {
  PEDIDO_NOVO: "Pedido novo",
  RETORNO_VENCIDO: "Retorno vencido",
  REVISAO: "Pedido de revisão do morador",
} as const;
export type AvisoNoWhatsapp = keyof typeof AVISOS_NO_WHATSAPP;

export const MINUTOS_ANEXAR = [15, 30, 60] as const;

/** Tipos de mídia que o morador manda e o sistema guarda (W-05). */
export const MIDIAS_WHATSAPP = {
  "image/jpeg": "Foto",
  "image/png": "Foto",
  "image/webp": "Foto",
  "application/pdf": "PDF",
  "audio/ogg": "Áudio",
  "audio/mpeg": "Áudio",
  "audio/mp4": "Áudio",
  "video/mp4": "Vídeo",
} as const;
export type MidiaWhatsapp = keyof typeof MIDIAS_WHATSAPP;
export const TAMANHO_MAXIMO_MIDIA = 16 * 1024 * 1024;

/** Telefone no formato do cadastro: +, DDI e número. */
export const telefone = z.string().trim().regex(/^\+[1-9][0-9]{9,14}$/, "Celular com DDI e DDD (ex.: +5561999998888)");

export const credenciaisWhatsappSchema = z.object({
  versao: versao.nullable().optional().transform((v) => v ?? null),
  instancia: z.string().trim().regex(/^[A-Za-z0-9_-]{1,100}$/),
  token: z.string().trim().min(8).max(500),
});

export const desconectarWhatsappSchema = z.object({ motivo: z.string().trim().min(3).max(300) });

export const triarWhatsappSchema = z
  .object({
    acao: z.enum(["ARQUIVAR", "PEDIDO", "CONTATO"]),
    motivo: z.string().max(300).nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
    pedidoId: id.nullable().optional().transform((v) => v ?? null),
    contatoId: id.nullable().optional().transform((v) => v ?? null),
  })
  .refine((t) => t.acao !== "ARQUIVAR" || (t.motivo && t.motivo.length >= 3), { message: "Diga o motivo", path: ["motivo"] })
  .refine((t) => t.acao !== "PEDIDO" || t.pedidoId, { message: "Escolha o pedido", path: ["pedidoId"] })
  .refine((t) => t.acao !== "CONTATO" || t.contatoId, { message: "Escolha o contato", path: ["contatoId"] });

export const motivoFalhaSchema = z.object({ motivo: z.string().trim().min(3).max(300) });

export const responderWhatsappSchema = z.object({ versao, texto: z.string().trim().min(3).max(2000) });

export const manterRevisaoSchema = z.object({ resposta: z.string().trim().min(3).max(2000) });

export const configWhatsappSchema = z.object({
  versao,
  foraHorario: z.string().trim().min(20).max(600),
  categoriaId: id,
  prioridadeId: id,
  anexarMinutos: z.union([z.literal(15), z.literal(30), z.literal(60)]),
});

export const meusAvisosWhatsappSchema = z.object({
  versao: versao.nullable().optional().transform((v) => v ?? null),
  telefone,
  tipos: z.array(z.enum(chaves(AVISOS_NO_WHATSAPP))).max(3).transform((t) => [...new Set(t)]),
  ligado: z.boolean(),
});

/** A mensagem de fora do horário não promete prazo nem atendimento imediato (W-12). */
export function prometePrazo(texto: string): boolean {
  return /(imediat|em at[ée] [0-9]|garant|agora mesmo|j[áa] estamos)/i.test(texto);
}
