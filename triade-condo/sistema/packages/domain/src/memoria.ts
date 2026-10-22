// Memória do prédio (peça R10; MP-12, MP-14, CT-02, CT-03, CT-04): prontuário, linha do tempo,
// manual do prédio, dossiê de passagem de bastão e exportação. Os mesmos valores estão no banco
// (0180_memoria.sql).

import { z } from "zod";
const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const motivo = z.string().trim().min(3).max(500);
const texto = (max: number) => z.string().max(max).nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null));

/** Grupos do prontuário, na ordem da tela. */
export const GRUPOS_PRONTUARIO = {
  CONSTITUICAO: "Constituição do condomínio",
  SEGUROS: "Seguros e garantias",
  LAUDOS: "Laudos e certificados",
  PLANTAS: "Plantas e projetos",
  OUTRO: "Outros",
} as const;
export type GrupoProntuario = keyof typeof GRUPOS_PRONTUARIO;

export const SITUACOES_PRONTUARIO = {
  EM_DIA: "Em dia",
  VENCE: "Vence logo",
  VENCEU: "Venceu",
  FALTA: "Falta",
  NAO_SE_APLICA: "Não se aplica",
} as const;
export type SituacaoProntuario = keyof typeof SITUACOES_PRONTUARIO;

/** Quantos dias antes de vencer o item avisa: padrão 60. */
export const AVISO_PRONTUARIO_DIAS = { padrao: 60, maximo: 365 } as const;

/** Mexer num item: ligar ou desligar documento, "não se aplica" e voltar a valer. */
export const itemProntuarioSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("LIGAR"), versao: versao.nullable().optional(), documentoId: id, avisarDias: z.number().int().min(0).max(365).default(60) }),
  z.object({ acao: z.literal("DESLIGAR"), versao: versao.nullable().optional() }),
  z.object({ acao: z.literal("NAO_SE_APLICA"), versao: versao.nullable().optional(), motivo }),
  z.object({ acao: z.literal("VALE"), versao: versao.nullable().optional() }),
]);
export const novoItemProntuarioSchema = z.object({
  nome: z.string().trim().min(3).max(120),
  grupo: z.enum(chaves(GRUPOS_PRONTUARIO)),
});
/** Chave do item sugerido (CONVENCAO, AVCB...). */
export const CHAVE_PRONTUARIO = /^[A-Z][A-Z_]{1,39}$/;

/** O que se anota na memória (CT-03). */
export const TIPOS_ANOTACAO = {
  DECISAO: "Decisão",
  COMBINADO: "Combinado",
  OBRA: "Obra",
  OCORRENCIA: "Ocorrência",
  OUTRO: "Outro",
} as const;
export type TipoAnotacao = keyof typeof TIPOS_ANOTACAO;

export const anotacaoSchema = z
  .object({
    versao: versao.optional(),
    tipo: z.enum(chaves(TIPOS_ANOTACAO)),
    titulo: z.string().trim().min(3).max(120),
    texto: z.string().trim().min(3).max(4000),
    aconteceuEm: data,
    documentoId: id.nullable().optional().transform((v) => v ?? null),
    pedidoId: id.nullable().optional().transform((v) => v ?? null),
    manutencaoId: id.nullable().optional().transform((v) => v ?? null),
  })
  .refine((v) => [v.documentoId, v.pedidoId, v.manutencaoId].filter(Boolean).length <= 1, {
    path: ["ligacao"],
    message: "Ligue a uma coisa só",
  });
export const retirarSchema = z.object({ versao, motivo });

/** Filtros da linha do tempo. */
export const FILTROS_LINHA_DO_TEMPO = {
  TUDO: "Tudo",
  ANOTADO: "Anotado",
  MANUTENCAO: "Manutenção",
  DOCUMENTOS: "Documentos",
  COMUNICADOS: "Comunicados",
  PESSOAS: "Pessoas",
} as const;
export type FiltroLinhaDoTempo = keyof typeof FILTROS_LINHA_DO_TEMPO;
export const buscaLinhaDoTempoSchema = z.object({
  filtro: z.enum(chaves(FILTROS_LINHA_DO_TEMPO)).default("TUDO"),
  antes: data.optional(),
});

/** Manual do prédio (MP-14). */
export const secaoManualSchema = z.object({
  versao: versao.optional(),
  titulo: z.string().trim().min(3).max(80),
  resumo: texto(160),
  texto: z.string().trim().min(3).max(8000),
  noMural: z.boolean().optional(),
});
export const ordemManualSchema = z.object({ ids: z.array(id).min(1).max(60) });

/** Seções que o manual sugere; só aparecem no mural depois de escritas. */
export const SECOES_SUGERIDAS = [
  { titulo: "Água e gás", resumo: "Onde ficam os registros e o que fazer em vazamento" },
  { titulo: "Lixo e coleta seletiva", resumo: "Horários e onde deixar" },
  { titulo: "Mudanças e obras nas unidades", resumo: "Horários, aviso prévio e elevador de serviço" },
  { titulo: "Salão de festas e áreas comuns", resumo: "Como usar e o que devolver" },
  { titulo: "Garagem", resumo: "Vagas, visitantes e portão" },
  { titulo: "Casa de máquinas e quadros elétricos", resumo: "Quem pode entrar e onde fica a chave" },
  { titulo: "Telefones úteis", resumo: "Concessionárias, bombeiros e o WhatsApp do condomínio" },
] as const;

/** Exportação (CT-04): os links valem 7 dias. */
export const EXPORTACAO_DIAS = 7;
export const SITUACOES_EXPORTACAO = {
  MONTANDO: "Montando",
  PRONTA: "Pronta",
  VENCIDA: "Vencida",
  FALHOU: "Não deu certo",
} as const;

/** "Vence em 43 dias", "Venceu em 02/10/2026"... a frase do selo do item. */
export function rotuloSituacaoProntuario(situacao: SituacaoProntuario, valeAte: string | null | undefined, hoje: string): string {
  if (situacao === "VENCE" && valeAte) {
    const dias = Math.round((Date.parse(`${valeAte}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
    return dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : `Vence em ${dias} dias`;
  }
  return SITUACOES_PRONTUARIO[situacao];
}

/** Histórico do prontuário, do manual e da memória, em uma linha. */
export function descreverEventoMemoria(acao: string, d: Record<string, unknown>): string {
  switch (acao) {
    case "prontuario.item_criado":
      return `Item criado: ${String(d.item)}`;
    case "prontuario.ligar":
      return `${String(d.item)}: documento ligado (${String(d.documentoTitulo)}), aviso ${String(d.avisarDias)} dias antes`;
    case "prontuario.desligar":
      return `${String(d.item)}: documento desligado`;
    case "prontuario.nao_se_aplica":
      return `${String(d.item)}: não se aplica. Motivo: ${String(d.motivo)}`;
    case "prontuario.vale":
      return `${String(d.item)}: voltou a valer`;
    case "memoria.anotada":
      return `Anotado: ${String(d.titulo)}`;
    case "memoria.anotacao_corrigida":
      return `Anotação corrigida: ${String(d.titulo)}`;
    case "memoria.anotacao_retirada":
      return `Anotação tirada da linha do tempo. Motivo: ${String(d.motivo)}`;
    case "manual.secao_criada":
      return `Seção escrita: ${String(d.titulo)}`;
    case "manual.secao_alterada":
      return `Seção mudou: ${String(d.titulo)}`;
    case "manual.secao_no_mural":
      return `Seção no mural: ${String(d.titulo)}`;
    case "manual.secao_fora_do_mural":
      return `Seção só para a gestão: ${String(d.titulo)}`;
    case "manual.secao_retirada":
      return `Seção tirada do manual. Motivo: ${String(d.motivo)}`;
    case "memoria.dossie_gerado":
      return "Dossiê de passagem gerado";
    case "memoria.exportacao_pedida":
      return "Exportação pedida";
    case "memoria.exportacao_pronta":
      return "Exportação pronta";
    case "memoria.exportacao_baixada":
      return `Exportação baixada (pacote ${String(d.pacote)})`;
    default:
      return "Alteração";
  }
}

/** As cinco partes de Documentos e memória, na ordem do trilho (DC15, telas-modelo documentos-memoria-*; decisão A.1 de 22/10/2026). */
export const PARTES_DOCUMENTOS = {
  documentos: "Documentos",
  prontuario: "Prontuário",
  linha: "Linha do tempo",
  manual: "Manual do prédio",
  passagem: "Passagem e exportação",
} as const;
export type ParteDocumentos = keyof typeof PARTES_DOCUMENTOS;

/** O endereço de cada parte. */
export const enderecoParteDocumentos = (p: ParteDocumentos) => (p === "documentos" ? "/documentos" : `/documentos/${p}`);

/** A parte nova de um endereço antigo da Memória do prédio (/memoria?aba=...). Passagem e Exportar viraram uma parte só (C.1). */
export function parteDaAbaAntiga(aba: string | null | undefined): ParteDocumentos {
  if (aba === "linha" || aba === "manual") return aba;
  if (aba === "passagem" || aba === "exportar") return "passagem";
  return "prontuario";
}

/**
 * O que o item sugerido do prontuário espera (B.1): o tipo do documento que o resolve, uma dica
 * de onde achar e as palavras que, no nome de um documento solto do mesmo tipo, sugerem ligar.
 */
export const ESPERADO_PRONTUARIO: Record<string, { tipo: "CONVENCAO" | "REGIMENTO" | "ATA" | "CONTRATO" | "LAUDO" | "ORCAMENTO" | "OUTRO"; dica: string; palavras: string[] }> = {
  CONVENCAO: { tipo: "CONVENCAO", dica: "Registrada em cartório; costuma ficar com a administradora", palavras: ["convenção", "convencao"] },
  REGIMENTO: { tipo: "REGIMENTO", dica: "Aprovado em assembleia; costuma ficar com a administradora", palavras: ["regimento"] },
  ATA_AGO: { tipo: "ATA", dica: "A ata registrada em cartório", palavras: ["ata", "ago"] },
  SEGURO: { tipo: "OUTRO", dica: "A apólice que a corretora manda na renovação", palavras: ["apólice", "apolice", "seguro"] },
  GARANTIA: { tipo: "OUTRO", dica: "Vem no manual do proprietário entregue pela construtora", palavras: ["garantia"] },
  AVCB: { tipo: "LAUDO", dica: "Emitido pelo Corpo de Bombeiros depois da vistoria", palavras: ["avcb", "bombeiro"] },
  ELEVADORES: { tipo: "LAUDO", dica: "Feita pela empresa dos elevadores, todo ano", palavras: ["elevador"] },
  SPDA: { tipo: "LAUDO", dica: "Laudo de empresa com engenheiro responsável, em geral todo ano", palavras: ["spda", "para-raios", "pararaios"] },
  AGUA: { tipo: "LAUDO", dica: "Laudo da limpeza e da análise da água, a cada seis meses", palavras: ["caixa d", "potabilidade", "água", "agua"] },
  EXTINTORES: { tipo: "LAUDO", dica: "O certificado da empresa que recarregou", palavras: ["extintor"] },
  INSPECAO_PREDIAL: { tipo: "LAUDO", dica: "Laudo de engenheiro ou arquiteto, com ART ou RRT", palavras: ["inspeção predial", "inspecao predial"] },
  PLANTAS: { tipo: "OUTRO", dica: "Na prefeitura ou com a construtora", palavras: ["planta"] },
  PROJETOS: { tipo: "OUTRO", dica: "Com a construtora ou com quem fez a última reforma", palavras: ["projeto"] },
  MANUAL_CONSTRUTORA: { tipo: "OUTRO", dica: "Entregue pela construtora junto com as chaves", palavras: ["manual"] },
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O documento parece ser o do item? Mesmo tipo e uma das palavras no nome. */
export function documentoPareceDoItem(chave: string | undefined, d: { titulo: string; tipo: string }): boolean {
  const e = chave ? ESPERADO_PRONTUARIO[chave] : undefined;
  if (!e || e.tipo !== d.tipo) return false;
  const t = semAcento(d.titulo);
  return e.palavras.some((p) => t.includes(semAcento(p)));
}

/** Para ligar um documento que já existe: os do tipo que o item espera vêm primeiro. */
export function ordenarParaLigar<T extends { titulo: string; tipo: string }>(chave: string | undefined, docs: T[]): { mesmoTipo: T[]; outros: T[] } {
  const tipo = chave ? ESPERADO_PRONTUARIO[chave]?.tipo : undefined;
  const porNome = (a: T, b: T) => Number(documentoPareceDoItem(chave, b)) - Number(documentoPareceDoItem(chave, a)) || a.titulo.localeCompare(b.titulo, "pt-BR");
  return { mesmoTipo: docs.filter((d) => tipo && d.tipo === tipo).sort(porNome), outros: docs.filter((d) => !tipo || d.tipo !== tipo).sort(porNome) };
}

/** "Laudo e certificado: AVCB 2025" no dossiê; quando o título é o próprio tipo ("Convenção"), o tipo não se repete. */
export function nomeNoDossie(titulo: string, nomeTipo: string): string {
  return semAcento(titulo) === semAcento(nomeTipo) ? titulo : `${nomeTipo}: ${titulo}`;
}
