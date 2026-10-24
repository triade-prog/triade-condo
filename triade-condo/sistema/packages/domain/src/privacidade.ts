// Inventário de dados, retenção e exclusão (F0.11; PT-11, PT-03, EM-08). Os prazos, o catálogo dos
// 32 tipos e as regras estão no banco (0301_retencao_dados.sql); aqui ficam os nomes que aparecem
// na tela e a validação do que chega pela API.

import { z } from "zod";

const versao = z.number().int().min(1);
const uuid = z.string().uuid();
const chaves = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const textoLimpo = (min: number, max: number) =>
  z.string().transform((v) => v.replace(/\s+/g, " ").trim()).pipe(z.string().min(min).max(max));

/** O modo da rotina: nasce contando; só a Administração da TRÍADE liga a exclusão. */
export const MODOS_RETENCAO = {
  CONTANDO: "Só contando",
  APAGANDO: "Apagando",
} as const;
export type ModoRetencao = keyof typeof MODOS_RETENCAO;

/** Se a rotina já aplica o prazo do tipo. */
export const SITUACOES_RETENCAO = {
  NA_ROTINA: "Na rotina",
  FICA: "Fica enquanto for cliente",
  A_FAZER: "Prazo definido, rotina a fazer",
} as const;
export type SituacaoRetencao = keyof typeof SITUACOES_RETENCAO;

/** O que pode ser guardado por obrigação legal. */
export const ENTIDADES_GUARDA = {
  PEDIDO: "Pedido",
  MANUTENCAO: "Manutenção",
  ENCOMENDA: "Encomenda",
  CONTATO: "Pessoa",
} as const;
export type EntidadeGuarda = keyof typeof ENTIDADES_GUARDA;

export const MOTIVOS_GUARDA = {
  PROCESSO: "Processo na Justiça",
  SINISTRO: "Sinistro com o seguro",
  AUTORIDADE: "Pedido de autoridade",
  OUTRO: "Outro motivo",
} as const;
export type MotivoGuarda = keyof typeof MOTIVOS_GUARDA;

/** Por que os dados de uma pessoa foram removidos. PRAZO é só da rotina. */
export const MOTIVOS_REMOCAO = {
  PEDIDO: "A pessoa pediu (LGPD)",
  OUTRO: "Outro motivo",
} as const;
export type MotivoRemocao = keyof typeof MOTIVOS_REMOCAO;

/** As partes em que a pessoa aparece, na ordem da tela. */
export const PARTES_DADOS_PESSOA = {
  UNIDADES: "Unidades",
  PEDIDOS: "Pedidos",
  MENSAGENS: "Mensagens de WhatsApp",
  ENVIOS: "Envios de WhatsApp e e-mail",
  RESERVAS: "Reservas",
  ENCOMENDAS: "Encomendas retiradas",
  ENQUETES: "Enquetes respondidas",
  CLASSIFICADOS: "Classificados",
  VEICULOS: "Veículos",
} as const;
export type ParteDadosPessoa = keyof typeof PARTES_DADOS_PESSOA;

export const guardarSchema = z.object({
  entidade: z.enum(chaves(ENTIDADES_GUARDA)),
  alvoId: uuid,
  motivo: z.enum(chaves(MOTIVOS_GUARDA)),
  detalhe: z.string().max(1000).nullable().optional().transform((v) => {
    const t = (v ?? "").replace(/\s+/g, " ").trim();
    return t ? t : null;
  }),
}).superRefine((d, ctx) => {
  if (d.motivo === "OUTRO" && !d.detalhe) ctx.addIssue({ code: "custom", path: ["detalhe"], message: "Conte o motivo" });
  if (d.detalhe && (d.detalhe.length < 3 || d.detalhe.length > 500)) {
    ctx.addIssue({ code: "custom", path: ["detalhe"], message: "De 3 a 500 caracteres" });
  }
});
export type Guardar = z.infer<typeof guardarSchema>;

export const tirarGuardaSchema = z.object({ versao, motivo: textoLimpo(3, 500) });

/** Busca pelo telefone com DDD (com ou sem o nono dígito) ou pelo e-mail. */
export const buscaDadosPessoaSchema = z.object({ busca: textoLimpo(3, 200) });

export const removerDadosPessoaSchema = z.object({ versao, motivo: z.enum(chaves(MOTIVOS_REMOCAO)) });

export const modoRetencaoSchema = z.object({ modo: z.enum(chaves(MODOS_RETENCAO)), versao });

export interface TipoRetencao {
  codigo: string;
  numero: number;
  sistema?: "PLATAFORMA" | "CONSOLE";
  grupo: string;
  nome: string;
  oQue: string;
  paraQue: string;
  base: string;
  quem?: string;
  prazo: string;
  noFim: string;
  situacao: SituacaoRetencao;
}

export interface GuardaLegal {
  id: string;
  entidade: EntidadeGuarda;
  alvoId: string;
  motivo: MotivoGuarda;
  detalhe: string | null;
  guardadaEm: string;
  guardadaPor: string | null;
  versao: number;
  titulo?: string;
  detalheAlvo?: string;
}

export interface Privacidade {
  modo: ModoRetencao;
  ultimaRodada: { em: string; modo: ModoRetencao; total: number } | null;
  vencidos: number;
  proximos30: number;
  podeCuidar: boolean;
  guardados: GuardaLegal[];
  tipos: TipoRetencao[];
}

export interface DadosPessoa {
  contato: { id: string; nome: string; telefone: string; email: string | null; aniversarioDia: number | null; aniversarioMes: number | null; versao: number };
  situacao: { mora: boolean; pedidoAberto: string | null; guarda: GuardaLegal | null; saiuEm: string | null; apagaEm: string | null };
  onde: Array<{ parte: ParteDadosPessoa; quantos: number; [k: string]: unknown }>;
}

export interface RodadaRetencao {
  id: number;
  em: string;
  modo: ModoRetencao;
  total: number;
  arquivos: number;
  erros: number;
  clientes: Array<{ condominioId: string; nome: string | null; itens: Record<string, number>; total: number; arquivos: number; erro?: string }>;
}

export interface RetencaoConsole {
  modo: ModoRetencao;
  mudadoEm: string | null;
  mudadoPor: string | null;
  versao: number;
  podeLigar: boolean;
  rodadas: RodadaRetencao[];
  arquivos: { naFila: number; comErro: number };
  tipos: TipoRetencao[];
  saidas: unknown[];
}

/** Linhas da planilha de "Baixar tudo", com o cabeçalho; o CSV é separado por ponto e vírgula. */
export function csvDadosPessoa(linhas: Array<{ parte: string; quando: string | null; o_que: string | null }>): string {
  const celula = (v: string | null) => {
    const t = (v ?? "").replace(/[\r\n\u2028\u2029]+/g, " ");
    // Fórmula vira texto na planilha (CSV injection).
    const seguro = /^[=+\-@\t]/.test(t) ? `'${t}` : t;
    return /[";]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  return ["Parte;Quando;O que", ...linhas.map((l) => [l.parte, l.quando, l.o_que].map(celula).join(";"))].join("\r\n") + "\r\n";
}
