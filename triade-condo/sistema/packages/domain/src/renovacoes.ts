// Renovação e reajuste, cancelamento com retenção, sinais de risco e expansão dos clientes (0311,
// R17.7; CM-30, CM-31 e CM-32; quadros 346 e 347). As mesmas listas e limites estão no banco
// (0311_comercial_renovacao_cancelamento.sql); os testes conferem as duas. O valor com reajuste e o
// último dia são calculados no banco; as contas daqui são as mesmas, para a tela mostrar antes de
// registrar.

import { z } from "zod";
import { novaOportunidadeSchema } from "./contrato.ts";

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const versaoOpcional = versao.optional().nullable().transform((v) => v ?? null);
const texto = (min: number, max: number) => z.string().trim().min(min).max(max);
const textoOpcional = (min: number, max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || v.length >= min, { message: `De ${min} a ${max} letras` });
// A data existe de verdade (30/02 não passa): o banco recusaria com erro de conversão (r17).
const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v, { message: "Data que não existe" });
const dataOpcional = data.optional().nullable().or(z.literal("")).transform((v) => (v ? v : null));
const dataHoraOpcional = z.string().datetime({ offset: true }).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null));
const uuid = z.string().uuid();

// ---------------------------------------------------------------------------------------
// Listas (as mesmas do banco).

/** O que acontece no aniversário do contrato (decisões 1 e 3). */
export const TIPOS_RENOVACAO = {
  REAJUSTE: "Reajuste anual",
  FIM_FUNDADOR: "Fim do preço de fundador",
} as const;
export type TipoRenovacao = keyof typeof TIPOS_RENOVACAO;

/** A situação na lista: as duas primeiras são calculadas (ainda sem registro); as outras, registradas. */
export const SITUACOES_RENOVACAO = {
  ATRASADO: "Aviso atrasado",
  AVISAR: "Avisar o síndico",
  AVISO_ENVIADO: "Aviso enviado",
  APLICADO: "Valor novo aplicado",
  SUPERADO: "Superado: o plano mudou antes",
  DISPENSADO: "Renovado sem reajuste",
} as const;
export type SituacaoRenovacao = keyof typeof SITUACOES_RENOVACAO;

/** Por onde o aviso foi ao síndico. */
export const CANAIS_AVISO = {
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  CARTA: "Carta",
  PRESENCIAL: "Em mãos",
  OUTRO: "Outro",
} as const;
export type CanalAviso = keyof typeof CANAIS_AVISO;

/** Os campos que o modelo de aditivo pode usar, entre « e » (como o contrato, 0308). */
export const ADITIVO_CAMPOS = {
  condominio: "Nome do condomínio",
  contrato: "Número do contrato",
  data_contrato: "Data de início do contrato",
  aniversario: "Aniversário do contrato",
  valor_atual: "Valor de hoje, com o ciclo",
  valor_novo: "Valor com reajuste, com o ciclo",
  motivo_reajuste: "Por que muda (índice ou fim do fundador)",
  vale_desde: "Competência em que o valor novo começa",
  aviso_em: "Data do aviso ao síndico",
} as const;
export type CampoAditivo = keyof typeof ADITIVO_CAMPOS;

/** Sem índice, a tela mostra isto e não calcula valor nenhum (decisão 2). */
export const TEXTO_INDICE_A_DEFINIR = "[a definir com o advogado]";

/** Os sinais de risco (CM-31, decisão 9). */
export const TIPOS_RISCO = {
  SINDICO_NOVO: "Síndico novo",
  USO_CAINDO: "Uso caindo",
  TROCA_NA_PAUTA: "Troca de sistema na pauta",
} as const;
export type TipoRisco = keyof typeof TIPOS_RISCO;

/** De onde veio o sinal (decisão j). */
export const ORIGENS_RISCO = {
  A_MAO: "Marcado pela equipe",
  TROCA_SINDICO: "Troca de síndico no Console",
  PEDIDOS: "Pedidos dos últimos 30 dias",
} as const;
export type OrigemRisco = keyof typeof ORIGENS_RISCO;

/** Os sinais que a equipe marca à mão. */
export const TIPOS_RISCO_A_MAO = ["SINDICO_NOVO", "TROCA_NA_PAUTA"] as const satisfies readonly TipoRisco[];

/** O motivo do cancelamento (quadro 347), separado do motivo de perda do funil. */
export const MOTIVOS_CANCELAMENTO = {
  SINDICO_NOVO: "Síndico novo",
  PRECO: "Preço",
  POUCO_USO: "Pouco uso",
  OUTRO_SISTEMA: "Foi para outro sistema",
  ADMINISTRADORA: "Administradora oferece",
  FECHOU: "Fechou o condomínio",
  OUTRO: "Outro",
} as const;
export type MotivoCancelamento = keyof typeof MOTIVOS_CANCELAMENTO;

/** A situação do pedido. ENCERRADO é o confirmado depois do último dia (calculado). */
export const SITUACOES_CANCELAMENTO = {
  PEDIDO: "Pedido",
  EM_RETENCAO: "Tentativa registrada",
  FICOU: "Decidiu ficar",
  CONFIRMADO: "Confirmado",
  ENCERRADO: "Encerrado",
} as const;
export type SituacaoCancelamento = keyof typeof SITUACOES_CANCELAMENTO;

/** A situação do cliente na lista de Renovações. */
export const SITUACOES_CLIENTE_RENOVACAO = {
  ATIVO: "Cliente",
  CANCELANDO: "Pediu cancelamento",
  ENCERRADO: "Saiu",
} as const;
export type SituacaoClienteRenovacao = keyof typeof SITUACOES_CLIENTE_RENOVACAO;

/** Os tipos de expansão (CM-32, decisão 11). */
export const TIPOS_EXPANSAO = {
  MAIS_UM_PREDIO: "Mais um prédio",
  MUDAR_FAIXA: "Mudar de faixa",
  RECONQUISTA: "Reconquista",
} as const;
export type TipoExpansao = keyof typeof TIPOS_EXPANSAO;

/** O funil da expansão. As três primeiras são abertas; as duas últimas encerram. */
export const ETAPAS_EXPANSAO = {
  ABERTA: "Aberta",
  EM_CONVERSA: "Em conversa",
  PROPOSTA: "Proposta",
  GANHA: "Ganha",
  PERDIDA: "Perdida",
} as const;
export type EtapaExpansao = keyof typeof ETAPAS_EXPANSAO;
export const ETAPAS_EXPANSAO_ABERTAS = ["ABERTA", "EM_CONVERSA", "PROPOSTA"] as const satisfies readonly EtapaExpansao[];

/** Os limites do banco. */
export const LIMITES_RENOVACAO = {
  percentualMin: -20,
  percentualMax: 50,
  prazoAvisoMin: 30,
  prazoAvisoMax: 120,
  avisoCancelamentoDias: 30,
  avisoAtrasoDias: 30,
} as const;

// ---------------------------------------------------------------------------------------
// Contas (as mesmas do banco).

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * O valor com reajuste (decisão c): valor × (100 + percentual) / 100, arredondado ao centavo como o
 * banco (meio para cima). Conta em inteiros: o percentual tem até duas casas.
 */
export function valorComReajuste(valorCentavos: number, percentual: number): number {
  const centesimos = Math.round(percentual * 100);
  const n = valorCentavos * (10000 + centesimos);
  const q = Math.floor(n / 10000);
  const resto = n - q * 10000;
  return resto * 2 >= 10000 ? q + 1 : q;
}

/** "Avisar até": o aniversário menos o prazo de aviso (decisão 6). */
export const avisarAte = (aniversario: string, prazoAvisoDias: number) => somarDias(aniversario, -prazoAvisoDias);

/** A primeira competência cujo vencimento cai na data ou depois (decisão d). Devolve AAAA-MM-01. */
export function competenciaDesde(dataIso: string, diaVencimento: number | null | undefined): string {
  const mes = `${dataIso.slice(0, 7)}-01`;
  const vencimento = somarDias(mes, (diaVencimento ?? 10) - 1);
  if (vencimento >= dataIso) return mes;
  const d = new Date(`${mes}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/** Desde quando vale o valor novo: depois do aniversário e do fim do prazo do aviso. */
export function valeDesde(aniversario: string, avisoEm: string, prazoAvisoDias: number, diaVencimento: number | null | undefined): string {
  const fimDoPrazo = somarDias(avisoEm, prazoAvisoDias);
  return competenciaDesde(fimDoPrazo > aniversario ? fimDoPrazo : aniversario, diaVencimento);
}

/** O último dia do contrato: a data do pedido mais o aviso (N.1). 24/10 dá 23/11. */
export const ultimoDiaCancelamento = (pedidoEm: string, avisoDias: number = LIMITES_RENOVACAO.avisoCancelamentoDias) =>
  somarDias(pedidoEm.slice(0, 10), avisoDias);

/** Os campos errados do modelo de aditivo: os que não existem e as aspas soltas (como o banco). */
export function camposErradosAditivo(textoModelo: string): string[] {
  const errados = new Set<string>();
  for (const m of textoModelo.matchAll(/«([^«»]*)»/g)) {
    if (!(m[1]! in ADITIVO_CAMPOS)) errados.add(`«${m[1]}»`);
  }
  const resto = textoModelo.replace(/«[^«»]*»/g, "");
  for (const s of ["«", "»"]) if (resto.includes(s)) errados.add(s);
  return [...errados].sort();
}

const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const mesBr = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const reaisBr = (centavos: number) =>
  `R$ ${Math.floor(centavos / 100).toLocaleString("pt-BR")},${String(centavos % 100).padStart(2, "0")}`;
const percentualBr = (p: number) => `${String(Number(p.toFixed(2))).replace(".", ",")}%`;

export type DadosAvisoReajuste = {
  contato?: string | null;
  condominio: string;
  aniversario: string;
  tipo: TipoRenovacao;
  valorAtual: number;
  valorNovo: number;
  ciclo: "MENSAL" | "ANUAL";
  indice?: string | null;
  percentual?: number | null;
  referencia?: string | null;
  valeDesde: string;
};

/** O texto sugerido do aviso ao síndico (a equipe pode mudar antes de enviar). */
export function textoAvisoReajuste(d: DadosAvisoReajuste): string {
  const por = d.ciclo === "ANUAL" ? "por ano" : "por mês";
  const ola = d.contato ? `Olá, ${d.contato}.` : "Olá.";
  const valores = `de ${reaisBr(d.valorAtual)} para ${reaisBr(d.valorNovo)} ${por}, a partir da competência ${mesBr(d.valeDesde)}`;
  const motivo =
    d.tipo === "FIM_FUNDADOR"
      ? `Como combinado, o preço de fundador vale pelos primeiros 12 meses; a mensalidade passa para a da tabela, ${valores}.`
      : `Pelo contrato, a mensalidade é reajustada pelo ${d.indice ?? TEXTO_INDICE_A_DEFINIR}${
          d.percentual !== null && d.percentual !== undefined ? ` de ${percentualBr(d.percentual)}` : ""
        }${d.referencia ? ` (${d.referencia})` : ""}: passa ${valores}.`;
  return `${ola} O contrato do ${d.condominio} com a TRÍADE faz aniversário em ${dataBr(d.aniversario)}. ${motivo} Qualquer dúvida, estamos à disposição. Equipe TRÍADE`;
}

// ---------------------------------------------------------------------------------------
// O que a tela manda (os mesmos limites do banco).

/** A regra do reajuste (decisão b): o índice e o percentual vêm juntos; sem eles, nada é calculado. */
export const regraReajusteSchema = z
  .object({
    versao,
    indice: textoOpcional(2, 60),
    percentual: z
      .number()
      .min(LIMITES_RENOVACAO.percentualMin)
      .max(LIMITES_RENOVACAO.percentualMax)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, { message: "Até duas casas" })
      .optional()
      .nullable()
      .transform((v) => v ?? null),
    referencia: textoOpcional(3, 120),
    prazoAvisoDias: z.number().int().min(LIMITES_RENOVACAO.prazoAvisoMin).max(LIMITES_RENOVACAO.prazoAvisoMax),
  })
  .refine((d) => (d.indice === null) === (d.percentual === null), { path: ["percentual"], message: "O índice e o percentual vêm juntos" })
  .refine((d) => d.referencia === null || d.indice !== null, { path: ["referencia"], message: "A referência vem com o índice" });
export type RegraReajuste = z.infer<typeof regraReajusteSchema>;

/** O aviso enviado ao síndico (decisão 4). Sem data, é hoje. Leva o valor que a tela mostrou (r4). */
export const avisoReajusteSchema = z.object({
  interessadoId: uuid,
  aniversario: data,
  valorNovo: z.number().int().positive(),
  avisoEm: dataOpcional,
  canal: z.enum(chaves(CANAIS_AVISO)),
  para: texto(2, 120),
  texto: texto(10, 2000),
});
export type AvisoReajuste = z.infer<typeof avisoReajusteSchema>;

/** Renovar sem reajuste: o aniversário fica registrado com o motivo. */
export const dispensarRenovacaoSchema = z.object({ interessadoId: uuid, aniversario: data, motivo: texto(3, 300) });

/** O modelo de aditivo (Modelos › Contrato). */
export const modeloAditivoSchema = z
  .object({ versao: versaoOpcional, titulo: texto(3, 120), texto: texto(50, 20000) })
  .superRefine((d, ctx) => {
    const errados = camposErradosAditivo(d.texto);
    if (errados.length) ctx.addIssue({ code: "custom", path: ["texto"], message: `Campo escrito errado ou que não existe: ${errados.join(", ")}` });
  });
export const usarModeloAditivoSchema = z.object({ versao });

/** Marcar um sinal à mão: síndico novo eleito ou troca de sistema na pauta. */
export const marcarRiscoSchema = z.object({
  interessadoId: uuid,
  tipo: z.enum(TIPOS_RISCO_A_MAO),
  data,
  detalhe: textoOpcional(3, 200),
});
export type MarcarRisco = z.infer<typeof marcarRiscoSchema>;

export const tratarRiscoSchema = z.object({ versao, nota: textoOpcional(3, 300) });

/** O pedido de cancelamento: quem pediu e quando (sem data, agora). */
export const pedirCancelamentoSchema = z.object({ interessadoId: uuid, pedidoPor: texto(2, 120), pedidoEm: dataHoraOpcional });
export type PedirCancelamento = z.infer<typeof pedirCancelamentoSchema>;

const motivoCancelamento = {
  motivo: z.enum(chaves(MOTIVOS_CANCELAMENTO)),
  motivoTexto: textoOpcional(3, 300),
};
const outroComTexto = (d: { motivo: MotivoCancelamento; motivoTexto: string | null }) => d.motivo !== "OUTRO" || d.motivoTexto !== null;

/** A tentativa de retenção, uma só (quadro 347): o motivo e o que foi oferecido ou combinado. */
export const retencaoCancelamentoSchema = z
  .object({ versao, ...motivoCancelamento, retencao: texto(3, 1000) })
  .refine(outroComTexto, { path: ["motivoTexto"], message: "Diga qual é o outro motivo" });

export const clienteFicouSchema = z.object({ versao, nota: textoOpcional(3, 300) });

/** Confirmar o cancelamento (a Administração): o motivo obrigatório e, se quiser, quando lembrar de reconquistar. */
export const confirmarCancelamentoSchema = z
  .object({ versao, ...motivoCancelamento, lembrarEm: dataOpcional })
  .refine(outroComTexto, { path: ["motivoTexto"], message: "Diga qual é o outro motivo" });
export type ConfirmarCancelamento = z.infer<typeof confirmarCancelamentoSchema>;

const expansaoBase = {
  etapa: z.enum(ETAPAS_EXPANSAO_ABERTAS).optional().nullable().transform((v) => v ?? "ABERTA"),
  motivo: texto(3, 300),
  responsavelId: uuid,
  proximoPasso: texto(3, 200),
  proximoPassoData: dataOpcional,
};

/** Abrir uma expansão. O mais um prédio traz o condomínio novo (a oportunidade do mesmo contato, 0308). */
export const novaExpansaoSchema = z
  .object({
    interessadoId: uuid,
    tipo: z.enum(chaves(TIPOS_EXPANSAO)),
    ...expansaoBase,
    oportunidade: novaOportunidadeSchema.omit({ responsavelId: true }).optional().nullable().transform((v) => v ?? null),
  })
  .refine((d) => d.tipo !== "MAIS_UM_PREDIO" || d.oportunidade !== null, { path: ["oportunidade"], message: "Diga o condomínio do prédio novo" })
  .refine((d) => d.tipo === "MAIS_UM_PREDIO" || d.oportunidade === null, { path: ["oportunidade"], message: "Só o mais um prédio abre oportunidade" });
export type NovaExpansao = z.infer<typeof novaExpansaoSchema>;

/** Mudar a etapa, o motivo, quem atende e o próximo passo. */
export const editarExpansaoSchema = z.object({ versao, ...expansaoBase });

/** Ganhou ou perdeu; perdida pede o que aconteceu. */
export const encerrarExpansaoSchema = z
  .object({ versao, etapa: z.enum(["GANHA", "PERDIDA"]), resultado: textoOpcional(3, 300) })
  .refine((d) => d.etapa !== "PERDIDA" || d.resultado !== null, { path: ["resultado"], message: "Diga o que aconteceu" });
