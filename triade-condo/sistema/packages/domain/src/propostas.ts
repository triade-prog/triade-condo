// Propostas do Comercial (0304, R17.3): a proposta pela Tabela de preços, as versões, o
// desconto que só a Administração aprova, o link sem conta com aceite, o kit para o conselho,
// as respostas prontas e as referências. As mesmas listas e textos estão no banco
// (0304_comercial_propostas.sql); os testes conferem as duas. O preço sai sempre do banco: aqui
// só há o que a tela precisa para mostrar e conferir a entrada.

import { z } from "zod";

/** Situações da versão (quadro 326). */
export const SITUACOES_PROPOSTA = {
  RASCUNHO: "Rascunho",
  AGUARDA_DESCONTO: "Aguarda aprovação da Administração",
  PRONTA: "Pronta para enviar",
  ENVIADA: "Enviada",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  VENCIDA: "Vencida",
  SUBSTITUIDA: "Substituída",
} as const;
export type SituacaoProposta = keyof typeof SITUACOES_PROPOSTA;

/** Situação do desconto. SEM: sem desconto ou ainda não pedido. */
export const SITUACOES_DESCONTO = { SEM: "Sem pedido", PEDIDO: "Pedido", APROVADO: "Aprovado", RECUSADO: "Recusado" } as const;
export type SituacaoDesconto = keyof typeof SITUACOES_DESCONTO;

/** Abas da lista (quadro 326), na ordem. */
export const ABAS_PROPOSTAS = {
  EM_ABERTO: "Em aberto",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  ACEITAS: "Aceitas",
  VENCIDAS: "Vencidas",
  RECUSADAS: "Recusadas",
} as const;
export type AbaProposta = keyof typeof ABAS_PROPOSTAS;

/** A aba de cada situação da versão em vigor (a substituída nunca é a em vigor). */
export function abaDaSituacao(s: SituacaoProposta): AbaProposta | null {
  if (s === "RASCUNHO" || s === "PRONTA" || s === "ENVIADA") return "EM_ABERTO";
  if (s === "AGUARDA_DESCONTO") return "AGUARDANDO_APROVACAO";
  if (s === "ACEITA") return "ACEITAS";
  if (s === "VENCIDA") return "VENCIDAS";
  if (s === "RECUSADA") return "RECUSADAS";
  return null;
}

/** Temas das respostas prontas (CM-27, quadro 344). */
export const TEMAS_RESPOSTA = {
  LGPD: "LGPD",
  SEGURANCA: "Segurança",
  SUPORTE: "Suporte",
  IMPLANTACAO: "Prazo de implantação",
  CANCELAMENTO: "Como cancelar",
  DEVOLUCAO: "Devolução dos dados",
  OUTRO: "Outro",
} as const;
export type TemaResposta = keyof typeof TEMAS_RESPOSTA;

/** O que a referência autorizou (CM-28). */
export const ESCOPOS_REFERENCIA = { CONTATO: "Pode passar o contato", SO_NOME: "Só o nome e o prédio" } as const;
export type EscopoReferencia = keyof typeof ESCOPOS_REFERENCIA;

/** O que está incluído e o que é planejado (EM-07): texto pronto, igual ao do banco, não se edita. */
export const OFERTA_INCLUIDO = [
  "Todo pedido com responsável, prazo e conclusão explicada",
  "Comunicados, documentos e mural do prédio por link",
  "Agenda, manutenção e prestadores",
] as const;
export const OFERTA_PLANEJADO = ["WhatsApp oficial", "Inteligência artificial"] as const;
export const TEXTO_PLANEJADO = "Ainda planejado, sem data prometida.";

/** Textos fixos do link e do aceite (quadros 328 e 329). */
export const TEXTO_CUSTO_APARTAMENTO = "Estimativa: a mensalidade dividida pelas unidades. A implantação é à parte.";
export const TEXTO_ACEITE =
  "Ao aceitar, guardamos nome, CPF, cargo, data, o endereço de internet e esta versão, com a impressão digital dela. Aceitar não é contratar: a contratação é o contrato assinado.";
export const TEXTO_CONCORDO = "Li a proposta e quero seguir. Depois vem o contrato para assinar.";
export const TEXTO_COMPARATIVO = "Só fatos que a equipe confirmou. O que não se sabe do concorrente fica para confirmar com eles; nada de retorno prometido.";
export const TEXTO_LINK_UMA_VEZ =
  "Copie o link agora: ele só aparece uma vez. Para ver de novo, gere um link novo; o anterior para de abrir.";

/** CPF com os dois dígitos verificadores; aceita com ou sem pontuação. */
export function cpfValido(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

/** 529.982.247-25 */
export function formatarCpf(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : v;
}

/** A mensalidade com o desconto (em centavos), arredondada como o banco. */
export function mensalComDesconto(mensal: number, percentual: number | null | undefined): number {
  if (!percentual) return mensal;
  return Math.round((mensal * Math.round((100 - percentual) * 100)) / 10000);
}

/** Custo por apartamento por mês (CM-19, L.1): estimativa, sem ROI; nunca zero. */
export function custoPorApartamento(mensal: number, unidades: number): number | null {
  if (!Number.isInteger(unidades) || unidades < 1 || !Number.isFinite(mensal)) return null;
  return Math.max(Math.round(mensal / unidades), 1);
}

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const texto = (min: number, max: number) => z.string().trim().min(min).max(max);
const textoOpcional = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const centavosOpcional = z.number().int().positive().max(100_000_000_00).optional().nullable().transform((v) => v ?? null);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dataOpcional = data.optional().nullable().or(z.literal("")).transform((v) => (v ? v : null));
const uuid = z.string().uuid();

/** Desconto em %, com até duas casas (0,01 a 99,99). */
const desconto = z
  .number()
  .gt(0)
  .lt(100)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, { message: "Até duas casas" })
  .optional()
  .nullable()
  .transform((v) => v ?? null);

/**
 * O que a tela manda para montar a versão (quadro 325). O preço nunca vem da tela: sai da
 * Tabela de preços no banco; só o valor sob consulta (acima de 400) é digitado, com motivo.
 */
const camposVersao = {
  unidades: z.number().int().min(1).max(20000).optional().nullable().transform((v) => v ?? null),
  ciclo: z.enum(["MENSAL", "ANUAL"]).optional().default("MENSAL"),
  tabela: z.enum(["FUNDADOR", "CHEIA"]).optional().nullable().transform((v) => v ?? null),
  valorManual: centavosOpcional,
  valorManualMotivo: textoOpcional(500),
  implantacaoManual: centavosOpcional,
  desconto,
  descontoMotivo: textoOpcional(500),
  respostas: z.array(uuid).max(20).optional().default([]),
  referencias: z.array(uuid).max(10).optional().default([]),
  notaInterna: textoOpcional(1000),
  validadeDias: z.number().int().min(1).max(60).optional().nullable().transform((v) => v ?? null),
};
const regrasVersao = (d: { desconto: number | null; descontoMotivo: string | null; valorManual: number | null; valorManualMotivo: string | null },
                      ctx: z.RefinementCtx) => {
  if (d.desconto && !d.descontoMotivo) ctx.addIssue({ code: "custom", message: "Diga por que o desconto", path: ["descontoMotivo"] });
  if (d.valorManual && !d.valorManualMotivo) ctx.addIssue({ code: "custom", message: "Diga de onde veio o valor", path: ["valorManualMotivo"] });
};
export const dadosVersaoSchema = z.object(camposVersao).superRefine(regrasVersao);
export type DadosVersao = z.infer<typeof dadosVersaoSchema>;

/** Nova proposta: o interessado e a primeira versão. */
export const novaPropostaSchema = z.object({ interessadoId: uuid, ...camposVersao }).superRefine(regrasVersao);

/** Salvar o rascunho (versão da linha) ou fazer versão nova (versão da proposta). */
export const salvarVersaoSchema = z.object({ versao, ...camposVersao }).superRefine(regrasVersao);

/** Sugestão pela tabela, sem gravar (quadro 325). */
export const sugestaoPropostaSchema = z.object({
  interessadoId: uuid,
  unidades: camposVersao.unidades,
  ciclo: camposVersao.ciclo,
  tabela: camposVersao.tabela,
  valorManual: centavosOpcional,
  implantacaoManual: centavosOpcional,
  desconto,
});

export const acaoVersaoSchema = z.object({ versao });

/** A resposta da Administração ao desconto (quadro 327). Recusar pede a resposta. */
export const responderDescontoSchema = z.object({ versao, resposta: textoOpcional(500) });
export const recusarDescontoSchema = z.object({ versao, resposta: texto(2, 500) });

export const revogarLinkSchema = z.object({ motivo: texto(3, 300) });
export const recusarPropostaSchema = z.object({ versao, motivo: texto(3, 500) });

/** Aceite pelo link (quadro 328). */
export const aceitePropostaSchema = z.object({
  nome: texto(2, 80),
  cpf: z
    .string()
    .trim()
    .max(20)
    .refine(cpfValido, { message: "CPF inválido" })
    .transform((v) => v.replace(/\D/g, "")),
  cargo: texto(2, 60),
  concordo: z.literal(true),
});

/** Resposta pronta (CM-27). Sem marcar revisada, fica a revisar e fora das propostas novas. */
export const respostaComercialSchema = z.object({
  versao: versao.optional().nullable().transform((v) => v ?? null),
  tema: z.enum(chaves(TEMAS_RESPOSTA)),
  titulo: texto(3, 60),
  texto: texto(10, 3000),
  revisada: z.boolean().optional().default(false),
  ativa: z.boolean().optional().default(true),
});

const whatsapp = z
  .string()
  .trim()
  .max(30)
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v) return null;
    let d = v.replace(/\D/g, "");
    if (d.length === 10 || d.length === 11) d = "55" + d;
    if (!/^55\d{10,11}$/.test(d)) {
      ctx.addIssue({ code: "custom", message: "WhatsApp com DDD, do Brasil" });
      return z.NEVER;
    }
    return d;
  });
const email = z.string().trim().toLowerCase().max(120).email().optional().nullable().or(z.literal("")).transform((v) => (v ? v : null));

/** Referência (CM-28): só com a autorização registrada; caso só com número medido depois de 3 meses. */
export const referenciaComercialSchema = z
  .object({
    versao: versao.optional().nullable().transform((v) => v ?? null),
    sindico: texto(2, 80),
    condominio: texto(2, 120),
    unidades: z.number().int().min(1).max(20000).optional().nullable().transform((v) => v ?? null),
    escopo: z.enum(chaves(ESCOPOS_REFERENCIA)),
    whatsapp,
    email,
    autorizadoEm: data,
    autorizacaoTexto: texto(10, 500),
    casoTexto: textoOpcional(600),
    casoUsoDesde: dataOpcional,
    casoMedidoEm: dataOpcional,
  })
  .refine((d) => d.escopo !== "CONTATO" || d.whatsapp || d.email, { message: "Informe o WhatsApp ou o e-mail", path: ["whatsapp"] })
  .refine((d) => !d.casoTexto || (d.casoUsoDesde && d.casoMedidoEm), { message: "Diga desde quando usa e quando mediu", path: ["casoMedidoEm"] });

export const retirarReferenciaSchema = z.object({ versao, motivo: texto(3, 300) });
