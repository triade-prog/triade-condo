// WhatsApp do condomínio (passo 5; W-01, W-05, W-08 a W-16, W-21, AT-28, F6.3). Começa como
// piloto pelo Wafly (DC14), atrás de um conector trocável. Os mesmos valores estão no banco
// (0200_whatsapp.sql e 0210_textos_janela.sql).

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
  CONCLUSAO: "Conclusão",
  RESERVA: "Reserva",
  ENQUETE: "Enquete",
  ASSEMBLEIA: "Assembleia",
  CLASSIFICADO: "Classificado",
  PRESTADOR: "Link do prestador",
  PROTOCOLO: "Protocolo do pedido",
  AVISO_PRESTADOR: "Pedido para o prestador",
  COMUNICADO: "Comunicado",
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
});

/** Ligar ou desligar os comunicados pelo WhatsApp do condomínio (F6.6, CD-02). */
export const comunicadosWhatsappSchema = z.object({ versao, ligado: z.boolean() });

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

// ---------------------------------------------------------------------------------------
// Janela de 24h e modelos de mensagem (F5.4, W-20). Fora da conversa aberta, só modelo
// aprovado; os modelos são da TRÍADE, iguais para todos os condomínios.

/** Com a conversa fechada, o texto do retorno vai dentro do modelo: até 800 caracteres. */
export const LIMITE_FORA_DA_JANELA = 800;

export const CHAVES_MODELO = [
  "noticia_pedido", "pedido_concluido", "revisao_respondida", "aviso_pedido_novo", "aviso_retorno_vencido", "aviso_revisao",
  "reserva_decidida", "enquete_convite", "enquete_lembrete", "assembleia_convocacao", "assembleia_lembrete",
  "anuncio_decidido", "link_prestador",
] as const;
export type ChaveModelo = (typeof CHAVES_MODELO)[number];

export const SITUACOES_MODELO = {
  RASCUNHO: "Rascunho",
  APROVADO_PILOTO: "Aprovado no piloto",
  ENVIADO: "Enviado à Meta",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  PAUSADO: "Pausado",
  DESATIVADO: "Desativado",
} as const;
export type SituacaoModelo = keyof typeof SITUACOES_MODELO;

/** Para onde cada situação pode ir (o banco confere igual). */
export const PROXIMAS_SITUACOES_MODELO: Record<SituacaoModelo, SituacaoModelo[]> = {
  RASCUNHO: ["APROVADO_PILOTO", "ENVIADO"],
  APROVADO_PILOTO: ["ENVIADO", "DESATIVADO"],
  ENVIADO: ["APROVADO", "RECUSADO"],
  APROVADO: ["PAUSADO", "DESATIVADO"],
  PAUSADO: ["APROVADO", "DESATIVADO"],
  RECUSADO: [],
  DESATIVADO: [],
};

/**
 * O texto do modelo usa as variáveis {{1}} a {{n}}, todas, sem outras chaves, e não começa nem
 * termina com uma variável (regra da Meta).
 */
export function modeloCorpoValido(corpo: string, n: number): boolean {
  if (/^\s*\{\{/.test(corpo) || /\}\}\s*$/.test(corpo)) return false;
  if (/[{}]/.test(corpo.replace(/\{\{[1-9][0-9]*\}\}/g, ""))) return false;
  const usadas = new Set([...corpo.matchAll(/\{\{([1-9][0-9]*)\}\}/g)].map((m) => Number(m[1])));
  return usadas.size === n && [...usadas].every((v) => v >= 1 && v <= n);
}

/** O modelo preenchido, como chega: cada variável em parágrafo único, o rodapé no fim. */
export function renderizarModelo(corpo: string, rodape: string | null | undefined, parametros: string[]): string {
  let v = corpo;
  for (let i = parametros.length; i >= 1; i--) v = v.replaceAll(`{{${i}}}`, (parametros[i - 1] ?? "").trim().replace(/\s+/g, " "));
  return rodape ? `${v}\n\n${rodape}` : v;
}

export const corpoModeloSchema = z.object({ corpo: z.string().trim().min(20).max(1024) });
export const editarModeloSchema = corpoModeloSchema.extend({ versao });
export const decidirModeloSchema = z
  .object({
    versao,
    situacao: z.enum(chaves(SITUACOES_MODELO)),
    motivo: z.string().max(300).nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
  })
  .refine((d) => !["RECUSADO", "PAUSADO"].includes(d.situacao) || (d.motivo && d.motivo.length >= 3), {
    message: "Diga o motivo", path: ["motivo"],
  });

// ---------------------------------------------------------------------------------------
// Queda do WhatsApp (F5.10; W-17). Os mesmos valores estão no banco (0270_garagens_reserva_quedas.sql).

export const ESTADOS_QUEDA = {
  FORA_DO_AR: "Número fora do ar",
  CONFERINDO: "Conferindo o que ficou parado",
  ENCERRADA: "Encerrada",
} as const;
export type EstadoQueda = keyof typeof ESTADOS_QUEDA;

export const ORIGENS_QUEDA = { PROVEDOR: "O número desconectou", MANUAL: "Aberta por quem cuida" } as const;

/** O que fazer com cada mensagem que ficou parada na queda. */
export const DECISOES_QUEDA = {
  MANDAR: "Mandar agora",
  OUTRO_CANAL: "Resolvido por outro canal",
  NAO_MANDAR: "Não mandar",
} as const;
export type DecisaoQueda = keyof typeof DECISOES_QUEDA;

const opcionalQueda = (min: number, max: number) =>
  z.string().max(max).nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)).pipe(z.string().min(min).nullable());

export const abrirQuedaSchema = z.object({ oQueAconteceu: opcionalQueda(3, 1000) });
export const editarQuedaSchema = z.object({ versao, canalAlternativo: opcionalQueda(5, 300), oQueAconteceu: opcionalQueda(3, 1000) });
export const conciliarQuedaSchema = z
  .object({
    envios: z.array(id).min(1).max(200).transform((l) => [...new Set(l)]),
    decisao: z.enum(chaves(DECISOES_QUEDA)),
    motivo: opcionalQueda(3, 300),
  })
  .superRefine((d, ctx) => {
    if (d.decisao === "OUTRO_CANAL" && !d.motivo) ctx.addIssue({ code: "custom", path: ["motivo"], message: "Diga por onde foi resolvido" });
  });
export const encerrarQuedaSchema = z.object({ versao, resumo: z.string().trim().min(10).max(2000) });
export const responsavelQuedasSchema = z.object({ versao, pessoaId: id.nullable() });

/** Histórico do WhatsApp: os eventos da queda. Nulo quando o evento é de outra parte. */
export function descreverEventoQueda(acao: string, d: Record<string, unknown>): string | null {
  switch (acao) {
    case "whatsapp.queda_aberta":
      return d.origem === "MANUAL" ? "Queda do WhatsApp aberta à mão" : "Queda do WhatsApp: o número desconectou";
    case "whatsapp.queda_caiu_de_novo":
      return "O número caiu de novo durante a conferência";
    case "whatsapp.queda_voltou":
      return "O número voltou; começa a conferência";
    case "whatsapp.queda_editada":
      return d.canalAlternativo ? "Canal alternativo da queda definido" : "Queda do WhatsApp editada";
    case "whatsapp.queda_conciliada": {
      const n = Number(d.mensagens);
      const decisao = DECISOES_QUEDA[d.decisao as DecisaoQueda] ?? "Decidido";
      return `${decisao}: ${n === 1 ? "1 mensagem" : `${n} mensagens`}`;
    }
    case "whatsapp.queda_encerrada":
      return `Queda do WhatsApp encerrada, ${Number(d.minutos)} min fora do ar`;
    case "whatsapp.quedas_responsavel":
      return d.pessoa ? "Escolhida a pessoa que cuida das quedas" : "As quedas voltaram a ficar com o síndico";
    default:
      return null;
  }
}
