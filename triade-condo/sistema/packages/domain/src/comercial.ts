// Comercial no Console (0296, R17.1 e R17.2): interessados, etapas, conversas, cadências e a
// entrada do site. As mesmas listas estão no banco (0296_comercial.sql); os testes conferem as
// duas. Só a equipe com Comercial ou Administração vê; o síndico nunca.

import { z } from "zod";
import type { CodigoFaixa } from "./precos.ts";
import { taxaCondominioSchema } from "./taxa_condominio.ts";

/** Etapas fixas do funil (CM-03, J.1). As três últimas fecham o interessado. */
export const ETAPAS_COMERCIAL = {
  NOVO: "Novo",
  EM_CONTATO: "Em contato",
  DEMO_MARCADA: "Demonstração marcada",
  DEMO_FEITA: "Demonstração feita",
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIACAO: "Negociação",
  APROVACAO: "Aprovação no condomínio",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
  SEM_RESPOSTA: "Sem resposta",
} as const;
export type EtapaComercial = keyof typeof ETAPAS_COMERCIAL;
export const ETAPAS_ABERTAS: EtapaComercial[] = ["NOVO", "EM_CONTATO", "DEMO_MARCADA", "DEMO_FEITA", "PROPOSTA_ENVIADA", "NEGOCIACAO", "APROVACAO"];
export const ETAPAS_FECHADAS: EtapaComercial[] = ["GANHO", "PERDIDO", "SEM_RESPOSTA"];

/** Colunas do quadro: as duas demonstrações ficam juntas (quadro 322). */
export const COLUNAS_QUADRO: { titulo: string; etapas: EtapaComercial[] }[] = [
  { titulo: "Novo", etapas: ["NOVO"] },
  { titulo: "Em contato", etapas: ["EM_CONTATO"] },
  { titulo: "Demonstração", etapas: ["DEMO_MARCADA", "DEMO_FEITA"] },
  { titulo: "Proposta enviada", etapas: ["PROPOSTA_ENVIADA"] },
  { titulo: "Negociação", etapas: ["NEGOCIACAO"] },
  { titulo: "Aprovação no condomínio", etapas: ["APROVACAO"] },
];

/** Por onde chegou (CM-01, CM-02). Site e Importação não se escolhem à mão. */
export const ORIGENS_COMERCIAL = {
  SITE: "Site",
  WHATSAPP_COMERCIAL: "WhatsApp comercial",
  INSTAGRAM: "Instagram",
  INDICACAO: "Indicação",
  PARCEIRO: "Parceiro",
  CONSTRUTORA: "Construtora",
  COTACAO: "Cotação (oHub, CoteiBem)",
  EVENTO: "Evento",
  IMPORTACAO: "Planilha",
  OUTRO: "Outro",
} as const;
export type OrigemComercial = keyof typeof ORIGENS_COMERCIAL;
export const ORIGENS_MANUAIS = ["WHATSAPP_COMERCIAL", "INSTAGRAM", "INDICACAO", "PARCEIRO", "CONSTRUTORA", "COTACAO", "EVENTO", "OUTRO"] as const;

export const PAPEIS_CONTATO = {
  SINDICO: "Síndico",
  SUBSINDICO: "Subsíndico",
  CONSELHEIRO: "Conselheiro",
  SINDICO_PROFISSIONAL: "Síndico profissional",
  ADMINISTRADORA: "Administradora",
  MORADOR: "Morador",
  OUTRO: "Outro",
} as const;
export type PapelContato = keyof typeof PAPEIS_CONTATO;

/** Motivos de perda (quadro 326). */
export const MOTIVOS_PERDA = {
  PRECO: "Preço",
  OUTRO_SISTEMA: "Já usa outro sistema",
  ASSEMBLEIA_NAO_APROVOU: "Assembleia não aprovou",
  FICOU_PARA_DEPOIS: "Ficou para depois",
  NAO_RESPONDEU: "Não respondeu mais",
  FORA_DO_PERFIL: "Fora do perfil",
  OUTRO: "Outro",
} as const;
export type MotivoPerda = keyof typeof MOTIVOS_PERDA;

/** Canais de conversa. Entrada é só do sistema (site, planilha, registro à mão). */
export const CANAIS_CONVERSA = {
  ENTRADA: "Entrada",
  WHATSAPP: "WhatsApp",
  LIGACAO: "Ligação",
  EMAIL: "E-mail",
  REUNIAO: "Reunião",
  DEMONSTRACAO: "Demonstração",
  VISITA: "Visita",
  PROPOSTA: "Proposta",
  NOTA: "Nota interna",
  OUTRO: "Outro",
} as const;
export type CanalConversa = keyof typeof CANAIS_CONVERSA;
export const CANAIS_REGISTRAVEIS = ["WHATSAPP", "LIGACAO", "EMAIL", "REUNIAO", "DEMONSTRACAO", "VISITA", "PROPOSTA", "NOTA", "OUTRO"] as const;

/** Canais de um passo da cadência (CM-26). */
export const CANAIS_CADENCIA = { WHATSAPP: "WhatsApp", LIGACAO: "Ligação", EMAIL: "E-mail" } as const;

/** Campos que cada etapa pede (CM-25), com o nome que a tela mostra. */
export const CAMPOS_ETAPA: Record<string, string> = {
  demonstracaoEm: "Data da demonstração",
  faixa: "Faixa de unidades",
  decisor: "Quem decide",
  decisaoEm: "Data da reunião do conselho ou da assembleia",
  motivoPerda: "Por que não fechou",
};

/**
 * Critérios que o síndico marca na visita (CM-16, CM-20, quadro 337): lista fechada e curta, na
 * ordem do comparativo do kit. "Outro" pede o texto. O texto da TRÍADE em cada critério é fixo e
 * fica no banco (0307, comercial_criterios), com a oferta honesta (EM-07).
 */
export const CRITERIOS_SINDICO = {
  PEDIDO_COM_PRAZO: "Todo pedido com responsável e prazo",
  SEM_BAIXAR_APP: "Morador usa sem baixar app",
  HISTORICO_PASSA: "Histórico que passa para o próximo síndico",
  CUSTO_APARTAMENTO: "Custo por apartamento por mês",
  COMO_CANCELAR: "Como cancelar",
  DEVOLUCAO_DADOS: "Devolução dos dados na saída",
  OUTRO: "Outro",
} as const;
export type CriterioSindico = keyof typeof CRITERIOS_SINDICO;

/** Situação da tarefa da vez (CM-04), na ordem da lista. */
export const SITUACOES_TAREFA = { ATRASADO: "Atrasado", HOJE: "Hoje", SEM_PASSO: "Sem próximo passo", FUTURO: "Em dia", FECHADO: "Fechado" } as const;
export type SituacaoTarefa = keyof typeof SITUACOES_TAREFA;

/** Só dígitos, com o 55 do Brasil quando faltar; fixo ou celular com DDD. O mesmo do site. */
export function normalizarWhatsappBr(v: string): string | null {
  if (/^\s*\+/.test(v) && !/^\s*\+\s*55/.test(v)) return null;
  let d = v.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!(d.length === 12 || d.length === 13) || !d.startsWith("55")) return null;
  return d;
}

/** (61) 9 8765-0412, para mostrar o número inteiro na ficha. */
export function formatarWhatsapp(d: string): string {
  const local = d.slice(2);
  const ddd = local.slice(0, 2);
  const resto = local.slice(2);
  return resto.length === 9 ? `(${ddd}) ${resto[0]} ${resto.slice(1, 5)}-${resto.slice(5)}` : `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
}

/** Faixa a partir do texto do formulário do site ("Até 40", "41 a 100", "Mais de 400 ou vários prédios"). */
export function faixaDoSite(texto: string): CodigoFaixa | null {
  const t = texto.trim().toLowerCase();
  if (t.startsWith("até 40")) return "ATE_40";
  if (t.startsWith("41 a 100")) return "DE_41_A_100";
  if (t.startsWith("101 a 200")) return "DE_101_A_200";
  if (t.startsWith("201 a 400")) return "DE_201_A_400";
  if (t.includes("400")) return "ACIMA_DE_400";
  return null;
}

/** Troca os campos entre colchetes da mensagem pronta (CM-15). Campo sem valor fica como está. */
export function preencherMensagem(texto: string, campos: { nome?: string | null; condominio?: string | null; pessoa?: string | null }): string {
  const primeiro = (s?: string | null) => (s ? s.trim().split(/\s+/)[0] ?? s : s);
  return texto
    .replaceAll("[nome]", primeiro(campos.nome) || "[nome]")
    .replaceAll("[condominio]", campos.condominio?.trim() || "[condominio]")
    .replaceAll("[pessoa]", primeiro(campos.pessoa) || "[pessoa]");
}

/** Link do WhatsApp com o texto pronto. Nada sai sozinho: a pessoa da equipe aperta enviar. */
export function linkWhatsappComercial(whatsapp: string, texto: string): string {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}`;
}

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const textoOpcional = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dataOpcional = data.optional().nullable().or(z.literal("")).transform((v) => (v ? v : null));
const uuidOpcional = z.string().uuid().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null));
const whatsapp = z
  .string()
  .trim()
  .max(30)
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = normalizarWhatsappBr(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "WhatsApp com DDD, do Brasil" });
      return z.NEVER;
    }
    return d;
  });
const email = z.string().trim().toLowerCase().max(120).email().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null));
const cnpj = z
  .string()
  .trim()
  .max(20)
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = v.replace(/\D/g, "");
    if (d.length !== 14) {
      ctx.addIssue({ code: "custom", message: "CNPJ com 14 dígitos" });
      return z.NEVER;
    }
    return d;
  });
const uf = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null));
const faixa = z.enum(["ATE_40", "DE_41_A_100", "DE_101_A_200", "DE_201_A_400", "ACIMA_DE_400"]).optional().nullable().transform((v) => v ?? null);
const unidades = z.number().int().min(1).max(20000).optional().nullable().transform((v) => v ?? null);

/** O contato e o prédio de quem entra à mão: o novo interessado e a indicação do parceiro. */
const camposNovoInteressado = {
    pessoa: textoOpcional(80),
    papel: z.enum(chaves(PAPEIS_CONTATO)).optional().nullable().transform((v) => v ?? null),
    whatsapp,
    email,
    condominio: z.string().trim().min(2).max(120),
    cnpj,
    cidade: textoOpcional(80),
    uf,
    faixa,
    unidades,
    responsavelId: uuidOpcional,
    contatoAceito: z.literal(true),
    optinTexto: textoOpcional(500),
};

/**
 * Novo interessado à mão (quadro 325, CM-02). Com a origem Parceiro e o parceiro escolhido, vira
 * indicação (0310, CM-22): o vínculo com o parceiro nasce aqui e não muda.
 */
export const novoInteressadoSchema = z
  .object({
    ...camposNovoInteressado,
    origem: z.enum(ORIGENS_MANUAIS),
    origemDetalhe: textoOpcional(200),
    parceiroId: uuidOpcional,
  })
  .refine((d) => d.whatsapp || d.email, { message: "Informe o WhatsApp ou o e-mail", path: ["whatsapp"] })
  .refine((d) => !d.parceiroId || d.origem === "PARCEIRO", { message: "O parceiro só entra com a origem Parceiro", path: ["parceiroId"] });

/** A indicação pela tela de Parceiros (quadro 339): a origem é Parceiro, com o nome dele. */
export const indicacaoParceiroSchema = z
  .object(camposNovoInteressado)
  .refine((d) => d.whatsapp || d.email, { message: "Informe o WhatsApp ou o e-mail", path: ["whatsapp"] });

const concorrente = z
  .object({
    nome: z.string().trim().min(2).max(80),
    preco: z.number().int().positive().max(9_999_999_999).optional().nullable().transform((v) => v ?? undefined),
    venceu: z.boolean().optional(),
  })
  .strict();

/** Texto que, quando não vem, não muda o que está gravado (o banco só troca o campo enviado). */
const textoSeVier = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v === undefined ? undefined : v || null));
const criterios = z.array(z.enum(chaves(CRITERIOS_SINDICO))).max(7).transform((v) => [...new Set(v)]);

/** A ficha: contato, prédio, objeções, concorrentes e responsável (CM-16, CM-17). */
export const fichaInteressadoSchema = z.object({
  versao,
  pessoa: textoOpcional(80),
  papel: z.enum(chaves(PAPEIS_CONTATO)).optional().nullable().transform((v) => v ?? null),
  whatsapp,
  email,
  condominio: z.string().trim().min(2).max(120),
  cnpj,
  endereco: textoOpcional(200),
  cidade: textoOpcional(80),
  uf,
  faixa,
  unidades,
  responsavelId: uuidOpcional,
  administradora: textoOpcional(120),
  appAdministradora: z.boolean().optional().nullable().transform((v) => v ?? null),
  sistemaAtual: textoOpcional(120),
  fidelidadeAte: dataOpcional,
  assembleiaOrdinaria: dataOpcional,
  mandatoAte: dataOpcional,
  decisor: textoOpcional(300),
  decisaoEm: dataOpcional,
  visitaEm: dataOpcional,
  visitaNota: textoOpcional(500),
  demonstracaoEm: z.string().datetime({ offset: true }).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  objecoes: z.array(z.string().regex(/^[A-Z][A-Z_]{2,39}$/)).max(20).optional().default([]),
  concorrentes: z.array(concorrente).max(10).optional().default([]),
  observacao: textoOpcional(1000),
  optinTexto: textoOpcional(500),
  optinCanal: z.enum(["SITE", "WHATSAPP", "LIGACAO", "EMAIL", "PRESENCIAL"]).optional().nullable().transform((v) => v ?? null),
  // Critérios do síndico e o problema do prédio (0307): só mudam quando a tela manda.
  criterios: criterios.optional(),
  criterioOutro: textoSeVier(120),
  problema: textoSeVier(300),
  // A taxa média de condomínio (0310, DC17): só muda quando a tela manda; vazio tira.
  taxaCondominioMedia: taxaCondominioSchema.nullable().optional(),
});

/** "Escolher critérios" do kit (quadro 337): os critérios, o outro e o problema do prédio. */
export const criteriosInteressadoSchema = z
  .object({
    versao,
    criterios,
    criterioOutro: textoOpcional(120),
    problema: textoOpcional(300),
  })
  .refine((d) => !d.criterios.includes("OUTRO") || d.criterioOutro, { message: "Diga qual é o outro critério", path: ["criterioOutro"] });

/**
 * Onde vale o fato do comparativo (0307): por padrão, só no prédio em que foi registrado (o
 * contrato do sistema atual é de cada prédio, CM-12); todo prédio só para informação pública do
 * concorrente (site, tabela pública), nunca na coluna do sistema atual nem no critério "outro".
 */
export const ESCOPOS_FATO = {
  PREDIO: "Só deste prédio",
  PUBLICO: "Todo prédio (informação pública)",
} as const;
export type EscopoFato = keyof typeof ESCOPOS_FATO;

/** O fato que a equipe confirmou sobre o sistema atual ou um concorrente, por critério (0307). */
export const fatoComparativoSchema = z.object({
  versao: versao.optional().nullable().transform((v) => v ?? null),
  sistema: z.string().trim().min(2).max(120).optional().nullable().transform((v) => v ?? null),
  criterio: z.enum(chaves(CRITERIOS_SINDICO)).optional().nullable().transform((v) => v ?? null),
  escopo: z.enum(chaves(ESCOPOS_FATO)).optional().nullable().transform((v) => v ?? null),
  interessadoId: uuidOpcional,
  texto: z.string().trim().min(2).max(200),
  fonte: z.string().trim().min(3).max(200),
  confirmadoEm: dataOpcional,
});
export const retirarFatoSchema = z.object({ versao });

/** Mudar a etapa (CM-03); Perdido pede o motivo (quadro 326). */
export const etapaInteressadoSchema = z
  .object({
    versao,
    etapa: z.enum(chaves(ETAPAS_COMERCIAL)),
    motivoPerda: z.enum(chaves(MOTIVOS_PERDA)).optional().nullable().transform((v) => v ?? null),
    detalhe: textoOpcional(500),
    vencedor: textoOpcional(80),
    retomarEm: dataOpcional,
  })
  .refine((d) => d.etapa !== "PERDIDO" || d.motivoPerda, { message: "Diga por que não fechou", path: ["motivoPerda"] });

export const conversaComercialSchema = z.object({
  canal: z.enum(CANAIS_REGISTRAVEIS),
  resumo: z.string().trim().min(2).max(2000),
  respondeu: z.boolean().optional().default(false),
  mensagemId: uuidOpcional,
});

export const proximoPassoSchema = z
  .object({
    versao,
    texto: textoOpcional(200),
    data: dataOpcional,
    hora: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
    responsavelId: uuidOpcional,
  })
  .refine((d) => !d.texto || d.data, { message: "Escolha a data", path: ["data"] });

export const cadenciaAcaoSchema = z.object({ acao: z.enum(["FEITO", "PARAR"]), resumo: textoOpcional(2000) });

export const naoContatarSchema = z
  .object({ whatsapp, email, cnpj, observacao: textoOpcional(300) })
  .refine((d) => d.whatsapp || d.email || d.cnpj, { message: "Informe o WhatsApp, o e-mail ou o CNPJ", path: ["whatsapp"] });

const linhaPlanilha = z.object({
  linha: z.number().int().min(1).max(100000),
  condominio: z.string().trim().min(2).max(120),
  cnpj,
  endereco: textoOpcional(200),
  cidade: textoOpcional(80),
  uf,
  unidades,
  faixa,
  pessoa: textoOpcional(80),
  whatsapp,
  email,
  decisao: z.enum(["JUNTAR", "CRIAR"]).optional().nullable().transform((v) => v ?? undefined),
});

/** Importar planilha (quadro 342, CM-24). */
export const importarComercialSchema = z.object({
  arquivo: z.string().trim().min(1).max(200),
  origemTexto: z.string().trim().min(3).max(200),
  baseLegalTexto: z.string().trim().min(10).max(1000),
  confirmar: z.boolean().optional().default(false),
  linhas: z.array(linhaPlanilha).min(1).max(2000),
});

export const mensagemComercialSchema = z.object({
  versao: versao.optional().nullable().transform((v) => v ?? null),
  etapa: z.enum(chaves(ETAPAS_COMERCIAL)),
  titulo: z.string().trim().min(3).max(60),
  texto: z.string().trim().min(10).max(1000),
  ativa: z.boolean().optional().default(true),
});

export const cadenciaComercialSchema = z.object({
  versao: versao.optional().nullable().transform((v) => v ?? null),
  nome: z.string().trim().min(3).max(60),
  gatilho: z.enum(chaves(ETAPAS_COMERCIAL)),
  origem: z.enum(chaves(ORIGENS_COMERCIAL)).optional().nullable().transform((v) => v ?? null),
  passos: z
    .array(z.object({ dia: z.number().int().min(0).max(99), canal: z.enum(chaves(CANAIS_CADENCIA)), texto: z.string().trim().min(3).max(1000) }).strict())
    .min(1)
    .max(10)
    .refine((ps) => ps.every((p, i) => i === 0 || p.dia > ps[i - 1]!.dia), { message: "Os dias vão em ordem" }),
  terminaSemResposta: z.boolean().optional().default(false),
  ativa: z.boolean().optional().default(true),
});

export const etapaParametrosSchema = z.object({
  versao,
  probabilidade: z.number().int().min(0).max(100),
  limiteDias: z.number().int().min(1).max(365).optional().nullable().transform((v) => v ?? null),
});

/** O pedido do site, como a rota protegida da api-console recebe (CM-01). */
export const entradaSiteSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  whatsapp: z.string().regex(/^55\d{10,11}$/),
  email: email,
  condominio: z.string().trim().min(2).max(120),
  faixa,
  unidadesTexto: textoOpcional(60),
  // A calculadora (0310, CM-33): o pedido de proposta com as unidades e a taxa informada (DC17).
  pedido: z.enum(["DEMONSTRACAO", "PROPOSTA"]).optional().default("DEMONSTRACAO"),
  unidades,
  taxaCondominio: taxaCondominioSchema.optional().nullable().transform((v) => v ?? null),
  consentimento: z.literal(true),
  consentimentoTexto: textoOpcional(500),
  pagina: textoOpcional(200),
  utm: z
    .partialRecord(z.enum(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]), z.string().trim().max(100))
    .optional()
    .nullable()
    .transform((v) => v ?? null),
});
export type EntradaSite = z.infer<typeof entradaSiteSchema>;

// Painel comercial, janelas do condomínio e o cartão do Início (0309, R17.5; CM-10, CM-18, CM-04).

/** Mês do painel, como a rota recebe ("2026-10"). */
export const mesComercialSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** Meta mensal de novo MRR, total e por pessoa (só a Administração). Sem meta no mês, sem versão. */
export const metaComercialSchema = z
  .object({
    mes: mesComercialSchema,
    versao: versao.optional().nullable().transform((v) => v ?? null),
    total: z.number().int().min(1).max(100_000_000_000),
    porPessoa: z
      // O mesmo limite do banco (metas_por_pessoa_validas: até 11 dígitos; o id em minúsculas).
      .array(z.object({ pessoaId: z.string().uuid().transform((v) => v.toLowerCase()), centavos: z.number().int().min(1).max(99_999_999_999) }))
      .max(30)
      .default([]),
  })
  .refine((d) => new Set(d.porPessoa.map((p) => p.pessoaId)).size === d.porPessoa.length, { path: ["porPessoa"], message: "Cada pessoa uma vez" });
export type MetaComercial = z.infer<typeof metaComercialSchema>;

/** Tipos de janela (CM-18). As três primeiras saem das datas da ficha. */
export const TIPOS_JANELA = {
  ASSEMBLEIA: "Assembleia ordinária",
  MANDATO: "Fim do mandato do síndico",
  FIDELIDADE: "Fim da fidelidade do sistema atual",
  RETOMAR: "Voltar a falar",
  SINDICO_NOVO: "Síndico novo",
} as const;
export type TipoJanela = keyof typeof TIPOS_JANELA;

export const SITUACOES_JANELA = { PROXIMA: "Ainda não abriu", ABERTA: "Aberta", PASSOU: "Passou" } as const;
export type SituacaoJanela = keyof typeof SITUACOES_JANELA;

/** Por que o interessado aparece no cartão do Início, na ordem em que aparece. */
export const MOTIVOS_INICIO_COMERCIAL = {
  PRIMEIRO_RETORNO: "Primeiro retorno: meta passou",
  ATRASADO: "Atrasado",
  PARADO: "Parado",
  JANELA: "Janela",
} as const;
export type MotivoInicioComercial = keyof typeof MOTIVOS_INICIO_COMERCIAL;

export const tratarJanelaSchema = z.object({ tipo: z.enum(Object.keys(TIPOS_JANELA) as [TipoJanela, ...TipoJanela[]]), data });

export const sindicoNovoSchema = z
  .object({ versao, desde: dataOpcional, mandatoAte: dataOpcional })
  .refine((d) => !d.desde || !d.mandatoAte || d.mandatoAte > d.desde, { path: ["mandatoAte"], message: "O mandato novo acaba depois do começo" });
export type SindicoNovo = z.infer<typeof sindicoNovoSchema>;

/** Primeiro dia do mês ("2026-10" → "2026-10-01"), como o banco recebe. */
export function diaDoMes(mes: string): string {
  return `${mes}-01`;
}

/** Percentual inteiro de uma parte sobre o todo; sem todo, nulo (o painel mostra "—"). */
export function percentual(parte: number, todo: number): number | null {
  if (!todo) return null;
  return Math.round((parte / todo) * 100);
}
