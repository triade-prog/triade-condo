// Comunicados e documentos (peça R1; CD-01, CD-02, CD-04 a CD-07, CD-09, CD-11 e MP-12 em
// parte). Os mesmos valores estão no banco (0150_comunicados_documentos.sql).

import { z } from "zod";
import { mostrarDataCurta } from "./agenda.ts";

/** Assuntos (CD-11): cada condomínio escolhe os que usa. */
export const ASSUNTOS_COMUNICADO = {
  AVISO: "Aviso geral",
  OBRAS: "Obras e manutenção",
  SEGURANCA: "Segurança",
  ASSEMBLEIA: "Assembleia e convocação",
  LEMBRETE: "Lembrete",
} as const;
export type AssuntoComunicado = keyof typeof ASSUNTOS_COMUNICADO;

/** Ciclo do comunicado (CD-01). Publicado não se edita; substituído e arquivado não voltam. */
export const SITUACOES_COMUNICADO = {
  RASCUNHO: "Rascunho",
  PROGRAMADO: "Programado",
  PUBLICADO: "Publicado",
  SUBSTITUIDO: "Substituído",
  ARQUIVADO: "Arquivado",
} as const;
export type SituacaoComunicado = keyof typeof SITUACOES_COMUNICADO;

export const FILTROS_COMUNICADO = {
  EM_USO: "Em uso",
  PUBLICADO: "Publicados",
  PROGRAMADO: "Programados",
  RASCUNHO: "Rascunhos",
  ARQUIVADO: "Arquivados",
} as const;
export type FiltroComunicado = keyof typeof FILTROS_COMUNICADO;

export const ATALHOS_COMUNICADO = {
  RASCUNHOS_PARADOS: "Rascunhos parados há mais de 3 dias",
  PROGRAMADOS_HOJE: "Programados para hoje",
} as const;
export type AtalhoComunicado = keyof typeof ATALHOS_COMUNICADO;

/** Para quem (CD-02). */
export const PUBLICOS_COMUNICADO = {
  TODOS: "Todo o condomínio",
  BLOCOS: "Blocos",
  UNIDADES: "Unidades",
  CONTATOS: "Contatos",
} as const;
export type PublicoComunicado = keyof typeof PUBLICOS_COMUNICADO;

/** Tipos de documento (CD-07). */
export const TIPOS_DOCUMENTO = {
  CONVENCAO: "Convenção",
  REGIMENTO: "Regimento",
  ATA: "Ata",
  CONTRATO: "Contrato",
  LAUDO: "Laudo e certificado",
  ORCAMENTO: "Orçamento anual",
  OUTRO: "Outro",
} as const;
export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

export const FILTROS_DOCUMENTO = {
  VIGOR: "Em vigor",
  CONVENCAO_REGIMENTO: "Convenção e regimento",
  ATA: "Atas",
  CONTRATO: "Contratos",
  LAUDO: "Laudos",
  ARQUIVADOS: "Arquivados",
} as const;
export type FiltroDocumento = keyof typeof FILTROS_DOCUMENTO;

/** "Pode ir ao morador" já nasce ligado para o que é do prédio inteiro (decisão 9). */
export function aoMoradorPadrao(tipo: TipoDocumento): boolean {
  return tipo === "CONVENCAO" || tipo === "REGIMENTO" || tipo === "ATA" || tipo === "ORCAMENTO";
}

/** Tipos que costumam ter validade (MP-12). */
export function tipoComValidade(tipo: TipoDocumento): boolean {
  return tipo === "CONTRATO" || tipo === "LAUDO" || tipo === "OUTRO";
}

export const ARQUIVOS_POR_COMUNICADO = 4;
export const TAMANHO_MAXIMO_DOCUMENTO = 20 * 1024 * 1024;
/** Quantos dias antes do fim da validade o documento aparece e avisa (MP-12). */
export const DIAS_AVISO_VALIDADE = 60;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const motivo = z.string().trim().min(3).max(500);
const idOpcional = id.nullable().optional().transform((v) => v ?? null);
const texto = (max: number) => z.string().max(max).nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null));
const ids = (max: number) => z.array(id).max(max).default([]);

const camposPublico = {
  publico: z.enum(chaves(PUBLICOS_COMUNICADO)),
  blocos: ids(100),
  unidades: ids(1000),
  contatos: ids(1000),
};
function publicoCompleto(d: { publico: PublicoComunicado; blocos: string[]; unidades: string[]; contatos: string[] }, ctx: z.RefinementCtx) {
  const falta = { BLOCOS: d.blocos, UNIDADES: d.unidades, CONTATOS: d.contatos, TODOS: null }[d.publico];
  if (falta && falta.length === 0) {
    ctx.addIssue({ code: "custom", path: [d.publico.toLowerCase()], message: "Escolha para quem" });
  }
}

/** Escrever ou mudar o rascunho ou o programado, e decidir o que fazer (CD-01, CD-06). */
export const salvarComunicadoSchema = z
  .object({
    versao: versao.optional(),
    assunto: z.enum(chaves(ASSUNTOS_COMUNICADO)),
    titulo: z.string().trim().min(3).max(120),
    texto: z.string().trim().min(3).max(4000),
    ...camposPublico,
    pedidoId: idOpcional,
    manutencaoId: idOpcional,
    acao: z.enum(["RASCUNHO", "PROGRAMAR", "PUBLICAR"]),
    programadoPara: z.string().datetime({ offset: true }).nullable().optional().transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    publicoCompleto(d, ctx);
    if (d.acao === "PROGRAMAR" && !d.programadoPara) {
      ctx.addIssue({ code: "custom", path: ["programadoPara"], message: "Diga o dia e a hora" });
    }
  });
export type SalvarComunicado = z.infer<typeof salvarComunicadoSchema>;

/** Quem recebe, antes de publicar (CD-02). */
export const publicoComunicadoSchema = z.object({ assunto: z.enum(chaves(ASSUNTOS_COMUNICADO)), ...camposPublico });

/** Corrigir o publicado: vira a versão seguinte (CD-01). */
export const corrigirComunicadoSchema = z.object({
  versao,
  titulo: z.string().trim().min(3).max(120),
  texto: z.string().trim().min(3).max(4000),
  mudanca: motivo,
});
export const arquivarComunicadoSchema = z.object({ versao, motivo });
/** Copiar o texto ou imprimir para o mural (o caminho até o morador sem WhatsApp). */
export const usoComunicadoSchema = z.object({ uso: z.enum(["COPIADO", "MURAL"]) });

export const buscaComunicadosSchema = z.object({
  filtro: z.enum(chaves(FILTROS_COMUNICADO)).optional(),
  assunto: z.enum(chaves(ASSUNTOS_COMUNICADO)).optional(),
  atencao: z.enum(chaves(ATALHOS_COMUNICADO)).optional(),
  busca: z.string().trim().max(60).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});

export const enviarArquivoComunicadoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().max(100),
  tamanho: z.number().int().min(1),
});

/** Plano de comunicação (CD-11), nas Configurações. */
export const planoComunicacaoSchema = z.object({
  versao,
  assuntos: z.array(z.enum(chaves(ASSUNTOS_COMUNICADO))).min(1).max(5),
  plano: texto(2000),
  assinatura: z.string().trim().min(2).max(120),
  silencioInicio: hora,
  silencioFim: hora,
});

/** Documento (CD-07, CD-04): restrito não vai ao morador. */
export const documentoSchema = z
  .object({
    versao: versao.optional(),
    tipo: z.enum(chaves(TIPOS_DOCUMENTO)),
    titulo: z.string().trim().min(3).max(120),
    descricao: texto(500),
    restrito: z.boolean().default(false),
    aoMorador: z.boolean().default(false),
    valeAte: data.nullable().optional().transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    if (d.restrito && d.aoMorador) {
      ctx.addIssue({ code: "custom", path: ["aoMorador"], message: "Documento só da gestão não vai ao morador" });
    }
    if (d.descricao !== null && d.descricao.length < 2) {
      ctx.addIssue({ code: "custom", path: ["descricao"], message: "Descrição de 2 a 500 caracteres" });
    }
  });
export type Documento = z.infer<typeof documentoSchema>;
export const arquivarDocumentoSchema = z.object({ versao, motivo });

/** Nova versão do documento: o arquivo, o que mudou e desde quando vale. */
export const versaoDocumentoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().max(100),
  tamanho: z.number().int().min(1),
  mudanca: texto(500),
  vigenteDesde: data,
  aprovadoEm: texto(120),
});

export const buscaDocumentosSchema = z.object({
  filtro: z.enum([...chaves(FILTROS_DOCUMENTO), "VENCENDO"]).optional(),
  busca: z.string().trim().max(60).optional(),
});

// ---------------------------------------------------------------------------------------
// Textos.

/** O texto como vai para o grupo do prédio: título, texto e assinatura. */
export function textoParaCopiar(c: { titulo: string; texto: string; assinatura?: string | null }): string {
  return [`*${c.titulo}*`, c.texto, c.assinatura ?? ""].filter((x) => x.trim()).join("\n\n");
}

/** A hora local ("HH:MM") cai no horário sem envio? O horário pode atravessar a meia-noite. */
export function noHorarioSemEnvio(hora: string, inicio: string, fim: string): boolean {
  if (inicio === fim) return false;
  return inicio < fim ? hora >= inicio && hora < fim : hora >= inicio || hora < fim;
}

/** "61 contatos de 44 unidades", "1 contato de 1 unidade", "Ninguém recebe". */
export function descreverAlcance(contatos: number, unidades: number): string {
  if (contatos === 0) return "Ninguém recebe";
  const c = contatos === 1 ? "1 contato" : `${contatos} contatos`;
  if (unidades === 0) return c;
  return `${c} de ${unidades === 1 ? "1 unidade" : `${unidades} unidades`}`;
}

/** Dias até a data (negativo se já passou), contando no calendário. */
export function diasAte(dataAlvo: string, hoje: string): number {
  return Math.round((Date.parse(`${dataAlvo}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000);
}

/** "vence em 42 dias", "vence hoje", "venceu há 3 dias", "vale até 03/2027". */
export function descreverValidade(valeAte: string | null | undefined, hoje: string): string | null {
  if (!valeAte) return null;
  const d = diasAte(valeAte, hoje);
  if (d < 0) return d === -1 ? "venceu ontem" : `venceu há ${-d} dias`;
  if (d === 0) return "vence hoje";
  if (d <= DIAS_AVISO_VALIDADE) return d === 1 ? "vence amanhã" : `vence em ${d} dias`;
  const [ano, mes] = valeAte.split("-");
  return `vale até ${mes}/${ano}`;
}

/** Os eventos do comunicado no histórico. */
export function descreverEventoComunicado(acao: string, d: Record<string, unknown>): string {
  switch (acao) {
    case "comunicado.escrito":
      return "Escrito como rascunho";
    case "comunicado.alterado":
      return "Rascunho alterado";
    case "comunicado.programado":
      return "Programado";
    case "comunicado.publicado":
      return d.programado ? `Versão ${String(d.numero)} publicada na hora marcada` : `Versão ${String(d.numero)} publicada`;
    case "comunicado.corrigido":
      return `Corrigido na versão ${String(d.numero)}: ${String(d.mudanca)}`;
    case "comunicado.copiado":
      return "Texto copiado";
    case "comunicado.mural":
      return "Versão para o mural aberta";
    case "comunicado.arquivo_enviado":
      return `Arquivo enviado: ${String(d.arquivoNome)}`;
    case "comunicado.arquivo_recusado":
      return `Arquivo não liberado: ${String(d.arquivoNome)}`;
    case "comunicado.arquivo_tirado":
      return `Arquivo tirado: ${String(d.arquivoNome)}`;
    case "estado.mudou":
      if (d.para === "ARQUIVADO") return d.motivo ? `Arquivado: ${String(d.motivo)}` : "Arquivado";
      if (d.para === "RASCUNHO") return "Voltou a rascunho";
      if (d.para === "SUBSTITUIDO") return "Versão substituída";
      return SITUACOES_COMUNICADO[d.para as SituacaoComunicado] ?? "Situação mudou";
    default:
      return "Alteração";
  }
}

/** Os eventos do documento no histórico. */
export function descreverEventoDocumento(acao: string, d: Record<string, unknown>): string {
  switch (acao) {
    case "documento.criado":
      return "Documento criado";
    case "documento.alterado":
      return "Dados alterados";
    case "documento.versao_guardada":
      return `Versão ${String(d.numero)} guardada, vale desde ${mostrarDataCurta(String(d.vigenteDesde))}`;
    case "documento.versao_recusada":
      return `Arquivo não liberado: ${String(d.arquivoNome)}`;
    case "documento.aberto":
      return `Versão ${String(d.numero)} aberta`;
    case "documento.baixado":
      return `Versão ${String(d.numero)} baixada`;
    case "documento.arquivado":
      return `Arquivado: ${String(d.motivo)}`;
    default:
      return "Alteração";
  }
}
