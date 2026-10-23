// Manutenção e prestadores (peça R6; MP-01 a MP-05, MP-07, MP-09 em parte, MP-13). Os mesmos
// valores estão no banco (0140_manutencao.sql). Datas chegam como "AAAA-MM-DD" no fuso do
// condomínio.

import { z } from "zod";
import { normalizarTelefone } from "./console.ts";
import { TIPOS_PENDENCIA } from "./pedidos.ts";
import { mostrarDataCurta } from "./agenda.ts";
import { descreverEventoLinkPrestador } from "./links.ts";

/** Tipos (MP-03, MP-07). A preventiva nasce pela preventiva, não à mão. */
export const TIPOS_MANUTENCAO = {
  CORRETIVA: "Corretiva",
  PREVENTIVA: "Preventiva",
  VISTORIA: "Vistoria",
} as const;
export type TipoManutencao = keyof typeof TIPOS_MANUTENCAO;

/** Situações fixas (MP-02). Concluída e cancelada só voltam reabrindo. */
export const SITUACOES_MANUTENCAO = {
  PLANEJADA: "Planejada",
  EM_ANDAMENTO: "Em andamento",
  PENDENTE: "Pendente",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
} as const;
export type SituacaoManutencao = keyof typeof SITUACOES_MANUTENCAO;

/** Filtros da lista. */
export const FILTROS_MANUTENCAO = {
  ABERTAS: "Abertas",
  PLANEJADA: "Planejadas",
  EM_ANDAMENTO: "Em andamento",
  PENDENTE: "Pendentes",
  CONCLUIDA: "Concluídas",
  TODAS: "Todas",
} as const;
export type FiltroManutencao = keyof typeof FILTROS_MANUTENCAO;

export const ATALHOS_MANUTENCAO = {
  RETORNO_VENCIDO: "Retorno vencido",
  PREVENTIVAS_MES: "Preventivas do mês",
  PENDENTES_PARADAS: "Pendentes paradas",
} as const;
export type AtalhoManutencao = keyof typeof ATALHOS_MANUTENCAO;

/** Como o prestador trabalha com o condomínio (MP-05). */
export const ACORDOS_PRESTADOR = {
  CONTRATO: "Com contrato",
  CHAMADO: "Por chamado",
} as const;
export type AcordoPrestador = keyof typeof ACORDOS_PRESTADOR;

/** De quanto em quanto tempo a preventiva se repete (MP-03). */
export const UNIDADES_TEMPO = {
  SEMANA: { um: "semana", varios: "semanas", max: 52 },
  MES: { um: "mês", varios: "meses", max: 60 },
  ANO: { um: "ano", varios: "anos", max: 10 },
} as const;
export type UnidadeTempo = keyof typeof UNIDADES_TEMPO;

/** Resposta de um item da vistoria (MP-07). */
export const RESULTADOS_ITEM = {
  CERTO: "Certo",
  PROBLEMA: "Problema",
  NAO_DEU: "Não deu",
} as const;
export type ResultadoItem = keyof typeof RESULTADOS_ITEM;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const motivo = z.string().trim().min(3).max(500);
const idOpcional = id.nullable().optional().transform((v) => v ?? null);
const texto = (max: number) => z.string().max(max).nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null));
const dataOpcional = data.nullable().optional().transform((v) => v ?? null);

/** Quem executa: um prestador, alguém da equipe, um nome escrito à mão ou ninguém (MP-07). */
const executor = {
  prestadorId: idOpcional,
  executorVinculoId: idOpcional,
  executorTexto: texto(120),
};
function umExecutor(d: { prestadorId: string | null; executorVinculoId: string | null; executorTexto: string | null }, ctx: z.RefinementCtx) {
  if ([d.prestadorId, d.executorVinculoId, d.executorTexto].filter((x) => x !== null).length > 1) {
    ctx.addIssue({ code: "custom", path: ["executor"], message: "Quem executa: um prestador, alguém da equipe ou um nome" });
  }
  if (d.executorTexto !== null && d.executorTexto.length < 2) {
    ctx.addIssue({ code: "custom", path: ["executor"], message: "Nome de quem executa de 2 a 120 caracteres" });
  }
}

const camposManutencao = {
  titulo: z.string().trim().min(3).max(120),
  local: z.string().trim().min(2).max(120),
  detalhes: texto(2000),
  prioridadeId: idOpcional,
  responsavelId: id,
  pedidoId: idOpcional,
  ...executor,
};

/** Registrar (MP-01): corretiva ou vistoria, com a lista do que olhar só na vistoria. */
export const registrarManutencaoSchema = z
  .object({
    ...camposManutencao,
    tipo: z.enum(["CORRETIVA", "VISTORIA"]),
    proximoRetorno: z.string().datetime({ offset: true }).nullable().optional().transform((v) => v ?? null),
    previsao: dataOpcional,
    itens: z.array(z.string().trim().min(2).max(200)).max(60).default([]),
  })
  .superRefine((d, ctx) => {
    umExecutor(d, ctx);
    if (!d.prioridadeId) ctx.addIssue({ code: "custom", path: ["prioridadeId"], message: "Escolha a prioridade" });
    if (d.tipo !== "VISTORIA" && d.itens.length > 0) {
      ctx.addIssue({ code: "custom", path: ["itens"], message: "A lista do que olhar é só da vistoria" });
    }
  });
export type RegistrarManutencao = z.infer<typeof registrarManutencaoSchema>;

export const alterarManutencaoSchema = z
  .object({ ...camposManutencao, versao, acesso: texto(300), impedimento: texto(300) })
  .superRefine(umExecutor);

export const retornoManutencaoSchema = z.object({
  versao,
  quando: z.string().datetime({ offset: true }).nullable(),
  motivo,
});
export const previsaoManutencaoSchema = z.object({ versao, data: data.nullable(), motivo });

/** Situação (MP-02): planejada, em andamento ou pendente (com o que impede). */
export const situacaoManutencaoSchema = z
  .object({
    versao,
    estado: z.enum(["PLANEJADA", "EM_ANDAMENTO", "PENDENTE"]),
    etapaId: idOpcional,
    pendenciaTipo: z.enum(chaves(TIPOS_PENDENCIA)).nullable().optional().transform((v) => v ?? null),
    pendenciaMotivo: texto(300),
  })
  .superRefine((d, ctx) => {
    if (d.estado === "PENDENTE") {
      if (!d.pendenciaTipo) ctx.addIssue({ code: "custom", path: ["pendenciaTipo"], message: "Diga o que impede" });
      if (!d.pendenciaMotivo || d.pendenciaMotivo.length < 3) {
        ctx.addIssue({ code: "custom", path: ["pendenciaMotivo"], message: "Explique a pendência" });
      }
    }
  });

export const concluirManutencaoSchema = z.object({
  versao,
  conclusao: z.string().trim().min(10).max(2000),
  realizadaEm: data,
  fecharProvidencias: z.boolean().default(false),
  /** A foto do depois (D4.22): a conclusão já abre o envio de cada uma. */
  fotos: z.array(z.object({
    nome: z.string().trim().min(1).max(200),
    descricao: z.string().trim().max(300).nullable().optional().transform((v) => (v ? v : null)),
    tipo: z.string().max(100),
    tamanho: z.number().int().min(1),
  })).max(10).default([]),
});
export const cancelarManutencaoSchema = z.object({ versao, motivo });
export const reabrirManutencaoSchema = z.object({ versao, motivo });

export const providenciaSchema = z.object({ versao, texto: z.string().trim().min(3).max(300), ...executor }).superRefine(umExecutor);
export const fazerProvidenciaSchema = z.object({ versao, resultado: z.string().trim().min(2).max(1000) });

export const itensVistoriaSchema = z
  .object({
    versao,
    incluir: z.array(z.string().trim().min(2).max(200)).max(60).default([]),
    tirar: z.array(id).max(100).default([]),
  })
  .refine((d) => d.incluir.length + d.tirar.length > 0, { path: ["incluir"], message: "Inclua ou tire algum item" });
export const responderItemSchema = z
  .object({
    versao,
    resultado: z.enum(chaves(RESULTADOS_ITEM)).nullable(),
    observacao: texto(500),
  })
  .superRefine((d, ctx) => {
    if (d.resultado === "NAO_DEU" && !d.observacao) {
      ctx.addIssue({ code: "custom", path: ["observacao"], message: "Diga por que não deu para ver" });
    }
    if (d.observacao !== null && d.observacao.length < 2) {
      ctx.addIssue({ code: "custom", path: ["observacao"], message: "Observação de 2 a 500 caracteres" });
    }
  });
export const virarManutencaoSchema = z.object({ versao });

export const buscaManutencoesSchema = z.object({
  situacao: z.enum(chaves(FILTROS_MANUTENCAO)).optional(),
  tipo: z.enum(chaves(TIPOS_MANUTENCAO)).optional(),
  prestador: id.optional(),
  atencao: z.enum(chaves(ATALHOS_MANUTENCAO)).optional(),
  busca: z.string().trim().max(60).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});

export const enviarArquivoManutencaoSchema = z.object({
  itemId: idOpcional,
  nome: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(300).nullable().optional().transform((v) => (v ? v : null)),
  tipo: z.string().max(100),
  tamanho: z.number().int().min(1),
});

/** Prestador (MP-05): o telefone vira +55 e a vigência só vale para contrato. */
export const prestadorSchema = z
  .object({
    versao: versao.optional(),
    nome: z.string().trim().min(2).max(120),
    servico: z.string().trim().min(2).max(80),
    contato: texto(120),
    telefone: z.string().trim().max(30).nullable().optional()
      .transform((v) => (v ? normalizarTelefone(v) : null))
      .pipe(z.string().regex(/^\+[1-9]\d{9,14}$/).nullable()),
    email: z.string().trim().toLowerCase().max(254).email().or(z.literal("")).nullable().optional().transform((v) => v || null),
    documento: z.string().trim().max(18).nullable().optional().transform((v) => v || null)
      .pipe(z.string().regex(/^[0-9./-]{11,18}$/).nullable()),
    acordo: z.enum(chaves(ACORDOS_PRESTADOR)),
    contratoAte: dataOpcional,
    desde: dataOpcional,
    reservaId: idOpcional,
    observacao: texto(1000),
  })
  .superRefine((d, ctx) => {
    if (d.contratoAte && d.acordo !== "CONTRATO") ctx.addIssue({ code: "custom", path: ["contratoAte"], message: "Vigência só de contrato" });
  });
export type Prestador = z.infer<typeof prestadorSchema>;
export const arquivarPrestadorSchema = z.object({ versao, arquivar: z.boolean() });

/** Preventiva (MP-03): de quanto em quanto tempo, a próxima data e quantos dias antes abre. */
export const preventivaSchema = z
  .object({
    versao: versao.optional(),
    atividade: z.string().trim().min(3).max(120),
    local: z.string().trim().min(2).max(120),
    unidadeTempo: z.enum(chaves(UNIDADES_TEMPO)),
    intervalo: z.number().int().min(1).max(60),
    proximaData: data,
    antecedenciaDias: z.number().int().min(0).max(90).default(15),
    responsavelId: id,
    observacao: texto(1000),
    ativa: z.boolean().default(true),
    ...executor,
  })
  .superRefine((d, ctx) => {
    umExecutor(d, ctx);
    if (d.intervalo > UNIDADES_TEMPO[d.unidadeTempo].max) {
      ctx.addIssue({ code: "custom", path: ["intervalo"], message: "A cada 1 a 52 semanas, 1 a 60 meses ou 1 a 10 anos" });
    }
  });

/** Etapa da manutenção (MP-02), dentro de uma situação fixa. */
export const etapaManutencaoSchema = z.object({
  versao: versao.optional(),
  nome: z.string().trim().min(2).max(40),
  situacao: z.enum(["PLANEJADA", "EM_ANDAMENTO", "PENDENTE", "CONCLUIDA"]).optional(),
  ativa: z.boolean().optional(),
});

// ---------------------------------------------------------------------------------------
// Textos.

/** "todo mês", "a cada 6 meses", "a cada 2 semanas", "todo ano". */
export function descreverFrequencia(unidade: UnidadeTempo, intervalo: number): string {
  const u = UNIDADES_TEMPO[unidade];
  if (intervalo === 1) return unidade === "SEMANA" ? "toda semana" : `todo ${u.um}`;
  return `a cada ${intervalo} ${u.varios}`;
}

/** "Prestador", "zelador (equipe)" ou o nome escrito, para mostrar quem executa. */
export function descreverExecutor(e: { tipo: "PRESTADOR" | "EQUIPE" | "TEXTO"; nome: string } | null | undefined): string {
  if (!e) return "Sem executor";
  return e.tipo === "EQUIPE" ? `${e.nome} (equipe)` : e.nome;
}

/** Contrato que termina em até 60 dias (MP-05). */
export function contratoPertoDoFim(ate: string | null | undefined, hoje: string): boolean {
  if (!ate) return false;
  const dias = (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000;
  return dias >= 0 && dias <= 60;
}

/**
 * Sugestões para começar as preventivas (MP-13), na linha da ABNT NBR 5674. Nada entra
 * sozinho: o síndico escolhe as que valem no prédio e ajusta a frequência.
 */
export const SUGESTOES_PREVENTIVAS: readonly { atividade: string; local: string; unidadeTempo: UnidadeTempo; intervalo: number; nota: string }[] = [
  { atividade: "Limpeza dos reservatórios de água", local: "Caixas-d'água", unidadeTempo: "MES", intervalo: 6, nota: "empresa especializada" },
  { atividade: "Manutenção dos elevadores", local: "Elevadores", unidadeTempo: "MES", intervalo: 1, nota: "empresa com contrato" },
  { atividade: "Recarga dos extintores", local: "Todos os andares", unidadeTempo: "ANO", intervalo: 1, nota: "empresa certificada" },
  { atividade: "Inspeção do sistema de para-raios", local: "Cobertura", unidadeTempo: "ANO", intervalo: 1, nota: "prestador especializado" },
  { atividade: "Teste do gerador", local: "Casa de máquinas", unidadeTempo: "SEMANA", intervalo: 2, nota: "equipe do prédio" },
  { atividade: "Verificação dos portões automáticos", local: "Portões", unidadeTempo: "MES", intervalo: 3, nota: "prestador do portão" },
  { atividade: "Limpeza das calhas e ralos da cobertura", local: "Cobertura e calhas", unidadeTempo: "MES", intervalo: 3, nota: "equipe do prédio" },
  { atividade: "Revisão das bombas de recalque", local: "Casa de bombas", unidadeTempo: "MES", intervalo: 6, nota: "prestador de bombas" },
  { atividade: "Teste dos hidrantes e mangueiras", local: "Todos os andares", unidadeTempo: "ANO", intervalo: 1, nota: "empresa certificada" },
  { atividade: "Inspeção da fachada", local: "Fachada", unidadeTempo: "ANO", intervalo: 1, nota: "vistoria" },
];

/** Os eventos da manutenção no histórico. */
export function descreverEventoManutencao(acao: string, d: Record<string, unknown>): string {
  switch (acao) {
    case "manutencao.registrada":
      if (d.preventiva) return `Aberta pela preventiva, para ${mostrarDataCurta(String(d.dataPrevista))}`;
      if (d.origem) return "Aberta a partir de um item da vistoria";
      return `Registrada como ${TIPOS_MANUTENCAO[d.tipo as TipoManutencao]?.toLowerCase() ?? "manutenção"}`;
    case "manutencao.alterada":
      return "Dados alterados";
    case "manutencao.retorno_mudou":
      return d.para ? "Próximo retorno mudou" : "Próximo retorno tirado";
    case "manutencao.previsao_mudou":
      return d.para ? `Previsão para ${mostrarDataCurta(String(d.para))}` : "Previsão tirada";
    case "manutencao.situacao":
      if (d.estado === "PENDENTE") return `Pendente · ${TIPOS_PENDENCIA[d.pendenciaTipo as keyof typeof TIPOS_PENDENCIA] ?? "impedimento"}`;
      if (d.pendenciaResolvida) return "Pendência resolvida";
      return d.etapa ? `Etapa: ${String(d.etapa)}` : "Situação mudou";
    case "manutencao.concluida":
      return `Concluída, feita em ${mostrarDataCurta(String(d.realizadaEm))}`;
    case "manutencao.conclusao_anterior":
      return "Conclusão anterior guardada";
    case "manutencao.providencia":
      return `Providência: ${String(d.texto)}`;
    case "manutencao.providencia_feita":
      return `Providência feita: ${String(d.texto)}`;
    case "manutencao.lista_vistoria":
      return "Lista da vistoria mudou";
    case "manutencao.item_respondido":
      return `${String(d.texto)}: ${RESULTADOS_ITEM[d.resultado as ResultadoItem] ?? "sem resposta"}`;
    case "manutencao.item_virou_manutencao":
      return "Item com problema virou manutenção";
    case "manutencao.visita_marcada":
      return `Visita marcada para ${mostrarDataCurta(String(d.data))}${d.hora ? `, ${String(d.hora)}` : ""}`;
    case "manutencao.comunicado_ligado":
      return "Comunicado ligado à manutenção";
    case "manutencao.retorno_venceu":
      return "Retorno venceu: responsável avisado";
    case "manutencao.arquivo_enviado":
      return `Arquivo enviado: ${String(d.arquivoNome)}`;
    case "manutencao.arquivo_recusado":
      return `Arquivo não liberado: ${String(d.arquivoNome)}`;
    case "manutencao.arquivo_tirado":
      return `Arquivo tirado: ${String(d.arquivoNome)}`;
    case "estado.mudou":
      if (d.evento === "REABERTA") return "Reaberta";
      if (d.para === "CANCELADA") return "Cancelada";
      return SITUACOES_MANUTENCAO[d.para as SituacaoManutencao] ?? "Situação mudou";
    default:
      return descreverEventoLinkPrestador(acao, d) ?? "Alteração";
  }
}
