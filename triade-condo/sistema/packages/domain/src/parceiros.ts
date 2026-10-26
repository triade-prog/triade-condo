// Parceiros, comissão e agenda de demonstrações do Comercial (0310, R17.6; CM-22 e CM-23). As
// mesmas listas e limites estão no banco (0310_comercial_parceiros_agenda.sql); os testes conferem
// as duas. A comissão é calculada no banco; o pagamento é feito fora do sistema e só registrado.

import { z } from "zod";
import { normalizarWhatsappBr } from "./comercial.ts";

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const versaoOpcional = versao.optional().nullable().transform((v) => v ?? null);
const textoOpcional = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const dataHora = z.string().datetime({ offset: true });
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

// ---------------------------------------------------------------------------------------
// Parceiros e comissão (CM-22, quadro 339).

/** Quem indica (quadro 339). */
export const TIPOS_PARCEIRO = {
  SINDICO_PROFISSIONAL: "Síndico profissional",
  ADMINISTRADORA: "Administradora",
  CONSTRUTORA: "Construtora",
  CLIENTE: "Cliente que indica",
} as const;
export type TipoParceiro = keyof typeof TIPOS_PARCEIRO;

/** A comissão de cada prédio no mês do extrato. */
export const SITUACOES_COMISSAO = {
  AINDA_NAO: "Ainda não começou",
  ATIVA: "Ativa",
  PRAZO_ACABOU: "Prazo acabou",
  ENCERRADA: "Deixou de ser cliente",
} as const;
export type SituacaoComissao = keyof typeof SITUACOES_COMISSAO;

/** O texto fixo da tela e do extrato: o sistema calcula, a TRÍADE paga por fora. */
export const TEXTO_PAGAMENTO_FORA =
  "A comissão é calculada aqui; o pagamento é feito fora do sistema (Pix ou transferência) e registrado depois, com a data e o valor.";

export const parceiroSchema = z.object({
  versao: versaoOpcional,
  tipo: z.enum(chaves(TIPOS_PARCEIRO)),
  nome: z.string().trim().min(2).max(120),
  whatsapp,
  email,
  cnpj,
  observacao: z.string().trim().max(500).optional().nullable().transform((v) => (v ? v : null))
    .refine((v) => v === null || v.length >= 2, { message: "Observação de 2 a 500 letras" }),
  ativo: z.boolean().optional().default(true),
});
export type Parceiro = z.infer<typeof parceiroSchema>;

/** A regra da comissão (só a Administração): percentual com até duas casas e o prazo (vazio: enquanto for cliente). */
export const regraComissaoSchema = z.object({
  versao,
  percentual: z
    .number()
    .gt(0)
    .max(100)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, { message: "Até duas casas" }),
  prazoMeses: z.number().int().min(1).max(120).optional().nullable().transform((v) => v ?? null),
});

/** O pagamento feito fora do sistema, registrado pela Administração (um por parceiro e mês). */
export const pagamentoComissaoSchema = z.object({
  mes,
  valor: z.number().int().min(0).max(100_000_000_000),
  pagoEm: data,
  observacao: z.string().trim().max(300).optional().nullable().transform((v) => (v ? v : null))
    .refine((v) => v === null || v.length >= 2, { message: "Observação de 2 a 300 letras" }),
}).refine((d) => d.pagoEm >= `${d.mes}-01`, { message: "A data do pagamento vai do mês até hoje", path: ["pagoEm"] });

/** "O prédio deixou de ser cliente": sem comissão desde o mês informado. */
export const encerrarComissaoSchema = z.object({ versao, desde: mes, motivo: z.string().trim().min(3).max(300) });

/** O extrato e a tela pedem o mês ("2026-10"). */
export const mesParceirosSchema = mes;

/**
 * Comissão do mês, como o banco: percentual sobre a mensalidade contratada, arredondado ao centavo.
 * Serve para a tela conferir a prévia; o valor que vale é o do banco.
 */
export function comissaoDoMes(mensalidade: number, percentual: number): number {
  return Math.round((mensalidade * Math.round(percentual * 100)) / 10000);
}

// ---------------------------------------------------------------------------------------
// Agenda de demonstrações (CM-23, quadros 340 e 341).

/** Dias da semana como o banco guarda (1 = segunda, 7 = domingo). */
export const DIAS_SEMANA_AGENDA = { 1: "Segunda", 2: "Terça", 3: "Quarta", 4: "Quinta", 5: "Sexta", 6: "Sábado", 7: "Domingo" } as const;

export const SITUACOES_DEMONSTRACAO = {
  MARCADA: "Marcada",
  FEITA: "Feita",
  NAO_COMPARECEU: "Não compareceu",
  CANCELADA: "Cancelada",
} as const;
export type SituacaoDemonstracao = keyof typeof SITUACOES_DEMONSTRACAO;

/** Como estão a confirmação e o lembrete por e-mail. */
export const SITUACOES_EMAIL_COMERCIAL = {
  NA_FILA: "Na fila",
  ENVIANDO: "Enviando",
  ENVIADO: "Enviado",
  FALHOU: "Não saiu",
  SEM_CHAVE: "Sem e-mail configurado",
  CANCELADO: "Cancelado",
} as const;
export type SituacaoEmailComercial = keyof typeof SITUACOES_EMAIL_COMERCIAL;

/** A autorização da página pública de agendamento (quadro 340). */
export const TEXTO_AUTORIZA_AGENDA = "Usamos estes dados só para a demonstração e para falar com você sobre ela.";

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const faixaHorario = z
  .object({ dia: z.number().int().min(1).max(7), de: hora, ate: hora })
  .strict()
  .refine((f) => f.de < f.ate, { message: "O fim vem depois do começo", path: ["ate"] });

/** Os horários livres de uma pessoa da equipe (quadro 341). */
export const disponibilidadeSchema = z.object({
  versao: versaoOpcional,
  faixas: z.array(faixaHorario).max(21),
  duracaoMinutos: z.number().int().min(15).max(120).optional().default(30),
  intervaloMinutos: z.number().int().min(0).max(60).optional().default(15),
  avisoDiasUteis: z.number().int().min(0).max(10).optional().default(1),
  horizonteDias: z.number().int().min(1).max(60).optional().default(14),
  salaUrl: z
    .string()
    .trim()
    .max(300)
    .regex(/^https:\/\/[^\s<>"]{3,}$/, { message: "O link da sala começa com https://" })
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  ativa: z.boolean().optional().default(true),
});
export type Disponibilidade = z.infer<typeof disponibilidadeSchema>;

/** Folga, reunião: um bloqueio de até 60 dias que termina no futuro (o banco confere o "agora"). */
export const bloqueioAgendaSchema = z
  .object({
    pessoaId: z.string().uuid(),
    de: dataHora,
    ate: dataHora,
    motivo: z.string().trim().max(120).optional().nullable().transform((v) => (v ? v : null))
      .refine((v) => v === null || v.length >= 2, { message: "Motivo de 2 a 120 letras" }),
  })
  .refine((b) => Date.parse(b.ate) > Date.parse(b.de) && Date.parse(b.ate) - Date.parse(b.de) <= 60 * 86_400_000, {
    message: "O bloqueio vai de um horário a outro, até 60 dias",
    path: ["ate"],
  });

/** O link de agendamento: de uma pessoa ou da equipe (pessoaId vazio); trocar revoga o anterior. */
export const linkAgendaSchema = z.object({ pessoaId: uuidOpcional, trocar: z.boolean().optional().default(false) });

/** O convite do link de agendamento: 128 bits em hexadecimal (0310, A). */
export const FORMATO_CONVITE_AGENDA = /^[0-9a-f]{32}$/;

/** Agendar pela página pública (quadro 340). */
export const agendarDemonstracaoSchema = z.object({
  inicio: dataHora,
  nome: z.string().trim().min(2).max(80),
  whatsapp: z
    .string()
    .trim()
    .max(30)
    .transform((v, ctx) => {
      const d = normalizarWhatsappBr(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message: "WhatsApp com DDD, do Brasil" });
        return z.NEVER;
      }
      return d;
    }),
  email: z.string().trim().toLowerCase().max(120).email({ message: "E-mail para a confirmação" }),
  condominio: z.string().trim().min(2).max(120),
  faixa: z.enum(["ATE_40", "DE_41_A_100", "DE_101_A_200", "DE_201_A_400", "ACIMA_DE_400"]).optional().nullable().transform((v) => v ?? null),
  consentimento: z.literal(true),
  // O convite da mensagem pronta (?c= do link, 0310 A). O que não tem o formato é como se não
  // viesse: o agendamento segue pela regra do WhatsApp e do e-mail.
  convite: z.string().trim().max(64).optional().nullable()
    .transform((v) => (v && FORMATO_CONVITE_AGENDA.test(v.toLowerCase()) ? v.toLowerCase() : null)),
});
export type AgendarDemonstracao = z.infer<typeof agendarDemonstracaoSchema>;

/** O que o agendamento pelo link devolve: marcado, ou a demonstração que já existe (0310, C). */
export type RespostaAgendar =
  | { id: string; inicio: string; fim: string; quando: string; duracaoMinutos: number; jaMarcada?: undefined }
  | { jaMarcada: true; inicio: string; quando: string };

/** "Marcar à mão" pela equipe (quadro 341): pode ficar fora da grade, nunca em cima de outra. */
export const marcarDemonstracaoSchema = z.object({
  inicio: dataHora,
  pessoaId: uuidOpcional,
  duracaoMinutos: z.number().int().min(15).max(120).optional().nullable().transform((v) => v ?? null),
  avisar: z.boolean().optional().default(true),
});

export const remarcarDemonstracaoSchema = z.object({
  versao,
  inicio: dataHora,
  pessoaId: uuidOpcional,
  avisar: z.boolean().optional().default(true),
});

/** "Registrar como foi": o resumo da conversa e o próximo passo são obrigatórios. */
export const demonstracaoFeitaSchema = z.object({
  versao,
  resumo: z.string().trim().min(2).max(2000),
  proximoPasso: z.string().trim().min(2).max(200),
  proximoPassoData: data,
  proximoPassoHora: hora.optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
});

/** Não compareceu ou cancelada; cancelar pede o motivo. */
export const encerrarDemonstracaoSchema = z
  .object({
    versao,
    situacao: z.enum(["NAO_COMPARECEU", "CANCELADA"]),
    motivo: textoOpcional(300),
    avisar: z.boolean().optional().default(false),
  })
  .refine((d) => d.situacao !== "CANCELADA" || (d.motivo && d.motivo.length >= 3), { message: "Diga por que cancelou", path: ["motivo"] });

const DIAS_CURTOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "terça, 27/10, 14:00", no horário de Brasília (o mesmo texto do banco, comercial_quando). */
export function quandoDemonstracao(iso: string): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  const dia = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
  return `${DIAS_CURTOS[dia]}, ${partes.day}/${partes.month}, ${partes.hour}:${partes.minute}`;
}

/** "terça-feira, 27 de outubro", para o título do dia na página pública. */
export function diaAgendaTexto(dataIso: string): string {
  const [a, m, d] = dataIso.split("-").map(Number);
  const dt = new Date(Date.UTC(a!, m! - 1, d!, 12));
  const semana = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long" }).format(dt);
  const mesNome = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long" }).format(dt);
  return `${semana}, ${d} de ${mesNome}`;
}

// ---------------------------------------------------------------------------------------
// Calculadora do site (CM-33, quadros 348, 448 e 449).

/** O que a rota da calculadora devolve: nunca a tabela inteira, a implantação ou as vagas. */
export interface CalculadoraSite {
  unidades: number;
  faixa: { codigo: string; nome: string; sobConsulta: boolean };
  tabela?: "FUNDADOR" | "CHEIA";
  mensal?: number;
  porApartamento?: number;
  depoisFundador?: number;
  fundadorMeses?: number;
}

export const calculadoraSiteSchema = z.object({ unidades: z.coerce.number().int().min(1).max(20000) });
