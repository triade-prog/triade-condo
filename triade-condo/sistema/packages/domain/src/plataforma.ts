// Plataforma do síndico (passo 2): configurações do condomínio, pessoas autorizadas e quem
// atende. Os mesmos valores estão no banco (0070_configuracoes_condominio.sql).

import { z } from "zod";

/** Permissões individuais (CF-03). Só aparecem na tela as que já têm recurso (CF-12). */
export const PERMISSOES = {
  ACOMPANHAR: "Acompanhar",
  RESPONDER: "Responder",
  ATUALIZAR: "Atualizar",
  CONCLUIR: "Concluir",
  PUBLICAR: "Publicar",
  CONFIGURAR: "Configurar",
  APROVAR: "Aprovar",
  CADASTRAR: "Cadastrar moradores",
  VER_AGENDA: "Ver a agenda",
  AGENDA: "Cuidar da agenda",
  VER_MANUTENCAO: "Ver a manutenção",
  MANUTENCAO: "Cuidar da manutenção",
  VER_COMUNICADOS: "Ver comunicados e documentos",
  DOCUMENTOS: "Cuidar dos documentos",
  VER_RESERVAS: "Ver as reservas",
  RESERVAS: "Cuidar das reservas",
  VER_ENQUETES: "Ver as enquetes",
  ENQUETES: "Cuidar das enquetes",
  VER_ASSEMBLEIAS: "Ver as assembleias",
  ASSEMBLEIAS: "Cuidar das assembleias",
  VER_CLASSIFICADOS: "Ver os classificados",
  CLASSIFICADOS: "Cuidar dos classificados",
} as const;
export type Permissao = keyof typeof PERMISSOES;

/** Funções da Plataforma: o cargo da pessoa autorizada é só rótulo (CF-03). */
export const FUNCOES_PLATAFORMA = {
  SINDICO: "Síndico",
  AUTORIZADO: "Pessoa autorizada",
} as const;

/** Toda etapa é ligada a uma destas situações (AT-05). */
export const SITUACOES_ETAPA = {
  ABERTO: "Aberto",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADO: "Encerrado",
} as const;
export type SituacaoEtapa = keyof typeof SITUACOES_ETAPA;

export const TIPOS_HORARIO = {
  FUNCIONAMENTO: "Funcionamento",
  ATENDIMENTO: "Atendimento",
} as const;
export type TipoHorario = keyof typeof TIPOS_HORARIO;

/** Os quatro fusos do Brasil (CF-10). */
export const FUSOS = {
  "America/Sao_Paulo": "Brasília (UTC−3)",
  "America/Manaus": "Manaus (UTC−4)",
  "America/Rio_Branco": "Rio Branco (UTC−5)",
  "America/Noronha": "Fernando de Noronha (UTC−2)",
} as const;
export type Fuso = keyof typeof FUSOS;

/** O que falta configurar; o painel só avisa, nada é obrigatório (CF-12). */
export const PENDENCIAS_CONFIG = {
  SEM_HORARIO_ATENDIMENTO: "Horário de atendimento não definido: os prazos contam em horas corridas",
  SEM_RESPONSAVEL: "Ninguém escolhido para atender os pedidos",
  SEM_RESPONSAVEL_PADRAO: "Sem responsável padrão disponível na fila",
} as const;
export type PendenciaConfig = keyof typeof PENDENCIAS_CONFIG;

/** Dia 0 é domingo, como no banco. */
export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const hora = /^([01]\d|2[0-3]):[0-5]\d$/;

export const intervaloSchema = z
  .object({
    dia: z.number().int().min(0).max(6),
    inicio: z.string().regex(hora),
    fim: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/),
  })
  .refine((i) => i.inicio < i.fim, { message: "O início vem antes do fim", path: ["fim"] });
export type Intervalo = z.infer<typeof intervaloSchema>;

/** Intervalos do mesmo dia não se sobrepõem (encostar pode: 12:00 e 12:00). */
export function intervalosSobrepostos(lista: Intervalo[]): boolean {
  const ordenados = [...lista].sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
  return ordenados.some((x, i) => i > 0 && ordenados[i - 1]!.dia === x.dia && x.inicio < ordenados[i - 1]!.fim);
}

export const horariosSchema = z.object({
  versao,
  intervalos: z.array(intervaloSchema).max(70).refine((l) => !intervalosSobrepostos(l), { message: "Intervalos sobrepostos" }),
});

export const fusoSchema = z.object({ versao, fuso: z.enum(chaves(FUSOS)) });

/** Data sem hora (CF-10): só confere que existe no calendário; nunca vira Date com fuso. */
export function dataValida(texto: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dias = new Date(Date.UTC(a, mes, 0)).getUTCDate();
  return a >= 2000 && a <= 2100 && mes >= 1 && mes <= 12 && d >= 1 && d <= dias;
}

/** 2026-11-20 → 20/11/2026, sem conversão de fuso. */
export function mostrarDataSemHora(texto: string): string {
  const [a, m, d] = texto.split("-");
  return `${d}/${m}/${a}`;
}

export const feriadoSchema = z.object({
  data: z.string().refine(dataValida, { message: "Data inválida" }),
  descricao: z.string().trim().min(2).max(80),
});

export const categoriaSchema = z.object({
  versao: versao.optional(),
  nome: z.string().trim().min(2).max(60),
  ativa: z.boolean().optional(),
});

export const prioridadeSchema = z.object({
  versao: versao.optional(),
  nome: z.string().trim().min(2).max(40),
  significado: z.string().trim().min(3).max(200),
  ativa: z.boolean().optional(),
});

export const etapaSchema = z.object({
  versao: versao.optional(),
  nome: z.string().trim().min(2).max(40),
  situacao: z.enum(chaves(SITUACOES_ETAPA)).optional(),
  categoriaId: id.nullable().optional(),
  pausaPrazo: z.boolean().optional(),
  ativa: z.boolean().optional(),
});

export const modeloRespostaSchema = z.object({
  versao: versao.optional(),
  titulo: z.string().trim().min(2).max(60),
  texto: z.string().trim().min(1).max(2000),
  categoriaId: id.nullable().optional(),
  ativo: z.boolean().optional(),
});

export const prazoSchema = z.object({
  versao: versao.optional(),
  categoriaId: id.nullable().optional(),
  prioridadeId: id.nullable().optional(),
  horas: z.number().int().min(1).max(720),
});

const permissoes = z.array(z.enum(chaves(PERMISSOES))).max(Object.keys(PERMISSOES).length);
const cargo = z.string().trim().max(60).optional().nullable().transform((v) => (v ? v : null));

export const autorizarPessoaSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().max(254).email(),
  cargo,
  permissoes,
});

export const alterarPessoaSchema = z.object({ versao, cargo, permissoes });

export const revogarPessoaSchema = z.object({
  versao,
  substitutoId: id.nullable().optional(),
  deixarPendente: z.boolean().optional(),
  // Quem assume (0297; CF-05, MP-01). Pedidos: ausente = vão para o responsável padrão, como antes;
  // null = ficam na fila sem responsável. Manutenções: obrigatório quando a pessoa tem manutenção
  // em aberto ou preventiva ativa (emAberto.manutencoes > 0).
  assumePedidosId: id.nullable().optional(),
  assumeManutencoesId: id.nullable().optional(),
});

export const atendimentoSchema = z.object({
  versao,
  responsaveis: z
    .array(z.object({ vinculoId: id, disponivel: z.boolean() }))
    .max(50)
    .refine((l) => new Set(l.map((r) => r.vinculoId)).size === l.length, { message: "Responsável repetido" }),
  padraoId: id.nullable(),
});

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), como "aaaa-mm-dd". */
function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const texto = (d: Date) => d.toISOString().slice(0, 10);
const mais = (d: Date, dias: number) => new Date(d.getTime() + dias * 86_400_000);

/**
 * Feriados nacionais do ano, para o síndico trazer com um toque (CF-10). Carnaval e Corpus
 * Christi entram como ponto facultativo comum; o síndico tira o que não vale no prédio.
 */
export function feriadosNacionais(ano: number): { data: string; descricao: string }[] {
  const p = pascoa(ano);
  const lista = [
    { data: `${ano}-01-01`, descricao: "Confraternização Universal" },
    { data: texto(mais(p, -48)), descricao: "Carnaval" },
    { data: texto(mais(p, -47)), descricao: "Carnaval" },
    { data: texto(mais(p, -2)), descricao: "Sexta-feira Santa" },
    { data: `${ano}-04-21`, descricao: "Tiradentes" },
    { data: `${ano}-05-01`, descricao: "Dia do Trabalho" },
    { data: texto(mais(p, 60)), descricao: "Corpus Christi" },
    { data: `${ano}-09-07`, descricao: "Independência do Brasil" },
    { data: `${ano}-10-12`, descricao: "Nossa Senhora Aparecida" },
    { data: `${ano}-11-02`, descricao: "Finados" },
    { data: `${ano}-11-15`, descricao: "Proclamação da República" },
    { data: `${ano}-11-20`, descricao: "Dia Nacional de Zumbi e da Consciência Negra" },
    { data: `${ano}-12-25`, descricao: "Natal" },
  ];
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}
