// Console TRÍADE (passo 1): funções internas, carteira, ficha, cenário e convites.
// Os mesmos valores estão no banco (0060_console_clientes.sql); os testes conferem os dois.

import { z } from "zod";

/** Funções internas da equipe (PI-10). */
export const FUNCOES_CONSOLE = {
  ADMINISTRACAO: "Administração",
  IMPLANTACAO: "Implantação",
  FINANCEIRO: "Financeiro",
  SUPORTE: "Suporte",
} as const;
export type FuncaoConsole = keyof typeof FUNCOES_CONSOLE;

/** Cenários do prédio (V-04, V-05, V-06): ponto de partida, não presume equipe. */
export const CENARIOS = {
  SEM_PORTARIA: "Prédio sem portaria",
  PORTARIA_REMOTA: "Portaria remota",
  PORTARIA_PRESENCIAL: "Portaria presencial",
} as const;
export type Cenario = keyof typeof CENARIOS;

/** Estágio do cliente na carteira (PI-01). */
export const ESTAGIOS = {
  IMPLANTACAO: "Em implantação",
  ATIVO: "Ativo",
} as const;
export type Estagio = keyof typeof ESTAGIOS;

/** Situações a tratar (PI-01), calculadas pelo banco a partir da ficha. */
export const SITUACOES = {
  SEM_SINDICO: "Síndico ainda não convidado",
  SEM_CENARIO: "Cenário do prédio não escolhido",
  SEM_NUMERO_WHATSAPP: "Sem número institucional de WhatsApp",
  SEM_CONTATO: "Sem contato na ficha",
  SEM_CONTRATO: "Sem referência do contrato",
  PENDENCIA_VENCIDA: "Pendência de implantação vencida",
  CONJUNTO_A_LIBERAR: "Conjunto contratado a liberar",
  TESTE_TERMINANDO: "Teste de conjunto terminando",
  PLANO_SEM_VALOR: "Plano com valor a definir",
  PAGAMENTO_EM_ATRASO: "Pagamento em atraso",
} as const;
export type Situacao = keyof typeof SITUACOES;

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

/**
 * Telefone no formato internacional (+5561999990000). Aceita espaços, traços e parênteses;
 * número brasileiro sem o 55 (10 ou 11 dígitos) ganha o código do país.
 */
export function normalizarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (!valor.trim().startsWith("+") && (digitos.length === 10 || digitos.length === 11)) return `+55${digitos}`;
  return `+${digitos}`;
}
const telefone = z.string().trim().max(30).transform(normalizarTelefone).pipe(z.string().regex(/^\+[1-9]\d{7,14}$/));
const email = z.string().trim().toLowerCase().max(254).email();
const textoOpcional = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const versao = z.number().int().min(1);

export const contatoSchema = z
  .object({
    nome: z.string().trim().min(1).max(120),
    papel: z.string().trim().min(1).max(60),
    telefone: telefone.optional(),
    email: email.optional(),
  })
  .refine((c) => c.telefone || c.email, { message: "Informe telefone ou e-mail", path: ["telefone"] });

export const criarCondominioSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  cidade: z.string().trim().min(2).max(80),
  uf: z.enum(UFS),
  cenario: z.enum(chaves(CENARIOS)).optional().nullable().transform((v) => v ?? null),
});

export const fichaSchema = z.object({
  versao,
  nome: z.string().trim().min(2).max(120),
  cidade: z.string().trim().min(2).max(80),
  uf: z.enum(UFS),
  endereco: textoOpcional(200),
  numeroWhatsapp: z.union([telefone, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
  contatos: z.array(contatoSchema).max(10),
});

export const cenarioSchema = z.object({ versao, cenario: z.enum(chaves(CENARIOS)) });

export const contratoSchema = z.object({ versao, referenciaContrato: textoOpcional(120) });

export const estagioSchema = z.object({
  versao,
  estagio: z.enum(chaves(ESTAGIOS)),
  motivo: textoOpcional(300),
});

export const convidarPessoaSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  email,
});

export const notaSchema = z.object({ texto: z.string().trim().min(1).max(2000) });

const funcoes = z.array(z.enum(chaves(FUNCOES_CONSOLE))).min(1).max(4);

export const cadastrarMembroSchema = convidarPessoaSchema.extend({ funcoes });

export const funcoesSchema = z.object({ funcoes });

export const atribuirSchema = z.object({
  pessoaId: z.string().uuid(),
  funcao: z.enum(chaves(FUNCOES_CONSOLE)),
});

export const versaoSchema = z.object({ versao });

