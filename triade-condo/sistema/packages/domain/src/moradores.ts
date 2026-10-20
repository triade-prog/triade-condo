// Plataforma do síndico (passo 3): estrutura do prédio (torre, bloco, quadra ou prédio, com
// ou sem andar), unidades e contatos. Os mesmos valores estão no banco
// (0080_moradores_unidades.sql).

import { z } from "zod";
import { normalizarTelefone } from "./console.ts";

/** Relação do contato com a unidade (MU-08). */
export const RELACOES_UNIDADE = {
  PROPRIETARIO: "Proprietário (condômino)",
  INQUILINO: "Inquilino",
  MORADOR: "Morador",
  FAMILIAR: "Familiar ou cônjuge",
  OUTRO: "Outro autorizado",
} as const;
export type RelacaoUnidade = keyof typeof RELACOES_UNIDADE;

/** Ligação de quem não é proprietário com a unidade (MU-10). */
export const LIGACOES = {
  INQUILINO: "Inquilino",
  FAMILIAR: "Familiar",
  OUTRO: "Outro (cedido, procurador, funcionário)",
} as const;
export type Ligacao = keyof typeof LIGACOES;

/** Parentesco do familiar com o responsável pela unidade. Opcional (PT-11). */
export const PARENTESCOS = {
  CONJUGE: "Cônjuge ou companheiro(a)",
  FILHO: "Filho(a)",
  PAI_MAE: "Pai ou mãe",
  IRMAO: "Irmão ou irmã",
  OUTRO_PARENTE: "Outro parente",
} as const;
export type Parentesco = keyof typeof PARENTESCOS;

/** Ocupação da unidade, calculada das marcações de quem está nela (MU-10). */
export const OCUPACOES = {
  PROPRIETARIO_MORA: "O proprietário mora",
  ALUGADA: "Alugada",
  CEDIDA: "Cedida",
  VAZIA: "Vazia",
  SEM_CADASTRO: "Sem cadastro",
} as const;
export type Ocupacao = keyof typeof OCUPACOES;

/** Marcações do vínculo (passo 3b, MU-10). "principal" é o responsável pela unidade. */
export interface Marcas {
  proprietario: boolean;
  principal: boolean;
  mora: boolean;
  ligacao: Ligacao | null;
  parentesco: Parentesco | null;
  ocupaDesde?: string | null;
}

/** A relação de antes vira marcações (igual a marcas_da_relacao no banco). */
export function marcasDaRelacao(r: RelacaoUnidade): Omit<Marcas, "principal" | "parentesco" | "ocupaDesde"> {
  switch (r) {
    case "PROPRIETARIO": return { proprietario: true, mora: true, ligacao: null };
    case "INQUILINO": return { proprietario: false, mora: true, ligacao: "INQUILINO" };
    case "MORADOR": return { proprietario: false, mora: true, ligacao: "OUTRO" };
    case "FAMILIAR": return { proprietario: false, mora: true, ligacao: "FAMILIAR" };
    case "OUTRO": return { proprietario: false, mora: false, ligacao: "OUTRO" };
  }
}

/** A relação de antes, calculada das marcações (igual à coluna relacao do banco). */
export function relacaoDasMarcas(m: Pick<Marcas, "proprietario" | "mora" | "ligacao">): RelacaoUnidade {
  if (m.proprietario) return "PROPRIETARIO";
  if (m.ligacao === "INQUILINO" || m.ligacao === "FAMILIAR") return m.ligacao;
  return m.mora ? "MORADOR" : "OUTRO";
}

/** Como o condomínio chama a divisão maior do prédio. NENHUM: as unidades ficam direto no condomínio. */
export const AGRUPAMENTOS = {
  NENHUM: { nome: "Sem divisão", um: "", varios: "" },
  TORRE: { nome: "Torres", um: "Torre", varios: "Torres" },
  BLOCO: { nome: "Blocos", um: "Bloco", varios: "Blocos" },
  QUADRA: { nome: "Quadras", um: "Quadra", varios: "Quadras" },
  PREDIO: { nome: "Prédios", um: "Prédio", varios: "Prédios" },
} as const;
export type Agrupamento = keyof typeof AGRUPAMENTOS;

/** Só o vínculo confirmado pelo síndico vale para alguma coisa (MU-02). */
export const ESTADOS_CONTATO_UNIDADE = {
  PENDENTE: "A confirmar",
  CONFIRMADO: "Confirmado",
  ENCERRADO: "Encerrado",
} as const;
export type EstadoContatoUnidade = keyof typeof ESTADOS_CONTATO_UNIDADE;

/** Por que o vínculo acabou (MU-07). Recusado é só para o pendente. */
export const MOTIVOS_ENCERRAMENTO = {
  MUDANCA: "Mudou-se",
  CORRECAO: "Cadastro errado",
  PEDIDO: "A pedido do contato",
  RECUSADO: "Recusado pelo síndico",
} as const;
export type MotivoEncerramento = keyof typeof MOTIVOS_ENCERRAMENTO;

export const ORIGENS_CONTATO = { PAINEL: "Incluído no painel", PLANILHA: "Veio da planilha" } as const;

/** Avisos que não impedem salvar (MU-03). */
export const AVISOS_CONTATO = {
  TELEFONE_COMPARTILHADO:
    "Este telefone também está em outro contato do condomínio. Se for da mesma família, tudo certo. Se o número mudou de dono, encerre o vínculo antigo.",
} as const;

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const RE_TELEFONE = /^\+[1-9]\d{9,14}$/;

/** Telefone do contato: aceita "(61) 99999-0001" e guarda "+5561999990001". */
export const telefoneContato = z.string().trim().max(30).transform(normalizarTelefone).pipe(z.string().regex(RE_TELEFONE));
const nome = z.string().trim().min(1).max(120);
const identificacao = z.string().trim().min(1).max(20);
const relacao = z.enum(chaves(RELACOES_UNIDADE));

export const blocoSchema = z.object({
  versao: versao.optional(),
  nome: z.string().trim().min(1).max(40),
  ordem: z.number().int().min(1).max(500).optional(),
  ativo: z.boolean().optional(),
});

const andar = z.string().trim().max(20).nullable().optional().transform((v) => (v ? v : null));

export const estruturaSchema = z.object({
  versao,
  agrupamento: z.enum(chaves(AGRUPAMENTOS)),
  usaAndar: z.boolean(),
});

export const incluirUnidadesSchema = z.object({
  blocoId: id.nullable(),
  unidades: z.array(z.object({ identificacao, andar })).min(1).max(1000),
});

export const alterarUnidadeSchema = z.object({
  versao,
  identificacao,
  blocoId: id.nullable(),
  andar,
  ativa: z.boolean().optional(),
});

/** Unidade à venda e para alugar (MU-11): as duas marcas vêm sempre. */
export const marcarUnidadeSchema = z.object({ versao, aVenda: z.boolean(), paraAlugar: z.boolean() });

/** Data sem hora, conferida no calendário. */
const data = z.string().refine((t) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return a >= 2000 && a <= 2100 && mes >= 1 && mes <= 12 && d >= 1 && d <= new Date(Date.UTC(a, mes, 0)).getUTCDate();
}, { message: "Data inválida" });

const camposMarcas = {
  proprietario: z.boolean().default(false),
  principal: z.boolean().default(false),
  mora: z.boolean().default(false),
  ligacao: z.enum(chaves(LIGACOES)).nullable().default(null),
  parentesco: z.enum(chaves(PARENTESCOS)).nullable().default(null),
};

/** Proprietário não tem ligação; quem não é proprietário diz qual é; parentesco só para familiar. */
function conferirMarcas(m: { proprietario: boolean; ligacao: Ligacao | null; parentesco: Parentesco | null }, ctx: z.RefinementCtx) {
  if (m.proprietario && m.ligacao) ctx.addIssue({ code: "custom", message: "Proprietário não tem ligação", path: ["ligacao"] });
  if (!m.proprietario && !m.ligacao) ctx.addIssue({ code: "custom", message: "Diga a ligação com a unidade", path: ["ligacao"] });
  if (m.parentesco && m.ligacao !== "FAMILIAR") ctx.addIssue({ code: "custom", message: "Parentesco só para familiar", path: ["parentesco"] });
}

export const marcasSchema = z.object({ ...camposMarcas, ocupaDesde: data.nullable().default(null) }).superRefine(conferirMarcas);

/** A tela de antes mandava a relação: vira marcações. */
const comRelacaoAntiga = (v: unknown) => {
  if (!v || typeof v !== "object" || !("relacao" in v) || "marcas" in v) return v;
  const { relacao, principal, ...resto } = v as { relacao: unknown; principal?: unknown };
  const conhecida = typeof relacao === "string" && relacao in RELACOES_UNIDADE;
  return { ...resto, marcas: conhecida ? { ...marcasDaRelacao(relacao as RelacaoUnidade), principal: principal ?? false } : { ligacao: relacao } };
};

/** Contato novo (nome e telefone) ou um que já existe no condomínio (contatoId), com as marcações. */
export const incluirContatoSchema = z.preprocess(comRelacaoAntiga, z
  .object({
    contatoId: id.optional(),
    nome: nome.optional(),
    telefone: telefoneContato.optional(),
    marcas: marcasSchema,
    recebeComunicados: z.boolean().default(true),
    /** Inquilino em unidade sem proprietário no cadastro entra junto com o dono do imóvel (MU-01). */
    proprietario: z.union([z.object({ contatoId: id }), z.object({ nome, telefone: telefoneContato })]).optional(),
  })
  .refine((c) => c.contatoId || (c.nome && c.telefone), { message: "Informe nome e telefone", path: ["nome"] }));

export const alterarContatoSchema = z.object({ versao, nome, telefone: telefoneContato });

export const alterarVinculoUnidadeSchema = z.preprocess(comRelacaoAntiga, z.object({
  versao,
  marcas: marcasSchema,
  recebeComunicados: z.boolean(),
}));

const itensComVersao = (max: number) =>
  z
    .array(z.object({ id, versao }))
    .max(max)
    .refine((l) => new Set(l.map((i) => i.id)).size === l.length, { message: "Item repetido" });

export const confirmarContatosSchema = z.object({ itens: itensComVersao(2000).refine((l) => l.length > 0, { message: "Nada a confirmar" }) });

export const encerrarVinculoSchema = z.object({
  versao,
  motivo: z.enum(chaves(MOTIVOS_ENCERRAMENTO)),
  dataSaida: data.nullable().optional(),
});

/** Quem entra na mudança: entra com "ocupa desde" igual à data da mudança. */
export const novoContatoSchema = z.preprocess((v) => {
  const c = comRelacaoAntiga(v);
  return c && typeof c === "object" && "marcas" in c ? (({ marcas, ...resto }) => ({ ...resto, ...(marcas as object) }))(c as { marcas: unknown }) : c;
}, z.object({
  nome,
  telefone: telefoneContato,
  ...camposMarcas,
  recebeComunicados: z.boolean().default(true),
}).superRefine(conferirMarcas));

export const mudancaSchema = z
  .object({
    data,
    saem: itensComVersao(50),
    entram: z.array(novoContatoSchema).max(20),
  })
  .refine((m) => m.saem.length + m.entram.length > 0, { message: "Diga quem sai ou quem entra", path: ["entram"] })
  .refine((m) => m.entram.filter((e) => e.principal).length <= 1, { message: "Só um responsável", path: ["entram"] });

export const linhaImportacaoSchema = z.object({
  bloco: z.string().trim().min(1).max(40).nullable(),
  andar: z.string().trim().min(1).max(20).nullable(),
  unidade: identificacao,
  nome,
  telefone: telefoneContato,
  relacao: relacao.default("MORADOR"),
  /** Colunas opcionais do vínculo (passo 3b). Em branco, o banco decide como antes. */
  mora: z.boolean().nullable().default(null),
  responsavel: z.boolean().nullable().default(null),
  parentesco: z.enum(chaves(PARENTESCOS)).nullable().default(null),
  ocupaDesde: data.nullable().default(null),
  /** E-mail opcional (CD-13): entra esperando a própria pessoa confirmar. */
  email: z.string().trim().max(254).email().nullish(),
}).superRefine((l, ctx) => {
  if (l.parentesco && l.relacao !== "FAMILIAR") ctx.addIssue({ code: "custom", message: "Parentesco só para familiar", path: ["parentesco"] });
});
export type LinhaImportacao = z.infer<typeof linhaImportacaoSchema>;

export const importacaoSchema = z.object({
  linhas: z.array(linhaImportacaoSchema).min(1).max(2000),
  /** Nome da divisão pela coluna da planilha (torre, bloco...), para condomínio ainda sem divisão. */
  agrupamento: z.enum(["TORRE", "BLOCO", "QUADRA", "PREDIO"]).nullable().optional(),
});

export const removerDadosSchema = z.object({ versao });

export const buscaMoradoresSchema = z.object({
  busca: z.string().trim().max(60).optional(),
  estado: z.enum(["PENDENTE", "CONFIRMADO", "SEM_EMAIL"]).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});

/** Situação do e-mail do contato (CD-13). */
export const SITUACOES_EMAIL = {
  PENDENTE: "Esperando confirmação",
  CONFIRMADO: "E-mail confirmado",
  DEVOLVIDO: "E-mail voltou",
  PAROU: "Parou de receber",
} as const;
export type SituacaoEmail = keyof typeof SITUACOES_EMAIL;

/** Gravar, trocar ou tirar o e-mail do contato (vazio tira) e a preferência (CD-13). */
export const emailContatoSchema = z.object({
  versao,
  email: z.union([z.string().trim().max(254).email(), z.literal(""), z.null()]).transform((v) => v || null),
  recebe: z.boolean(),
});

export interface UnidadeNova {
  identificacao: string;
  andar: string | null;
}

/**
 * Numeração de prédio: andares de "de" até "ate", "porAndar" unidades em cada um.
 * Andar 1 com 4 por andar: 101, 102, 103, 104. Andar 0 vira térreo: 1, 2, 3, 4.
 * Com "comAndar", cada unidade já sai com o andar dela ("Térreo", "1", "2"...).
 */
export function gerarUnidades(o: { de: number; ate: number; porAndar: number; comAndar?: boolean }): UnidadeNova[] {
  if (!Number.isInteger(o.de) || !Number.isInteger(o.ate) || !Number.isInteger(o.porAndar)) return [];
  if (o.de < 0 || o.ate < o.de || o.ate > 200 || o.porAndar < 1 || o.porAndar > 99) return [];
  const lista: UnidadeNova[] = [];
  for (let a = o.de; a <= o.ate; a++) {
    for (let n = 1; n <= o.porAndar; n++) {
      lista.push({ identificacao: a === 0 ? String(n) : `${a}${String(n).padStart(2, "0")}`, andar: o.comAndar ? (a === 0 ? "Térreo" : String(a)) : null });
    }
  }
  return lista.length <= 1000 ? lista : [];
}

/** Ordem dos andares, igual à do banco: subsolo, térreo, os numerados, e o resto. */
export function chaveAndar(a: string | null | undefined): string {
  if (!a) return "";
  const s = a.trim();
  const base = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const numero = /\d{1,6}/.exec(s)?.[0];
  if (/^(s|ss|subsolo)/.test(base)) return `0${(numero ?? "0").padStart(6, "0")}`;
  if (/^(t$|terreo)/.test(base)) return "1";
  if (numero) return `2${numero.padStart(6, "0")}`;
  return `3${s.toLowerCase()}`;
}

/** "3" vira "3º andar"; "Térreo" e "Cobertura" ficam como estão. */
export function mostrarAndar(a: string | null | undefined): string {
  if (!a) return "";
  return /^\d{1,3}$/.test(a.trim()) ? `${a.trim()}º andar` : a.trim();
}

/** Ordem natural, igual à do banco: "2" antes de "10", "Casa 2" antes de "Casa 10". */
export function chaveUnidade(t: string): string {
  const s = t.trim();
  const prefixo = /^\D*/.exec(s)?.[0] ?? "";
  const numero = /\d{1,12}/.exec(s)?.[0] ?? "";
  return prefixo.toLowerCase() + numero.padStart(12, "0") + s.toLowerCase();
}

/** "Torre A · 3º andar · 302", só com as partes que existem (igual ao banco). */
export function nomeDaUnidade(bloco: string | null | undefined, andar: string | null | undefined, identificacao: string): string {
  return [bloco, mostrarAndar(andar), identificacao].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------------------
// Planilha (F3.3): CSV salvo pelo Excel ou pelo Google Planilhas. Separador ";" ou ",".

const COLUNAS: Record<string, keyof LinhaImportacao> = {
  bloco: "bloco", torre: "bloco", quadra: "bloco", predio: "bloco",
  andar: "andar", pavimento: "andar",
  unidade: "unidade", apartamento: "unidade", apto: "unidade", ap: "unidade", casa: "unidade", sala: "unidade", numero: "unidade",
  nome: "nome", morador: "nome", contato: "nome", responsavel: "nome",
  telefone: "telefone", celular: "telefone", whatsapp: "telefone", fone: "telefone",
  relacao: "relacao", tipo: "relacao", vinculo: "relacao", situacao: "relacao",
  mora: "mora", moranaunidade: "mora", reside: "mora",
  responsavelpelaunidade: "responsavel", eresponsavel: "responsavel", principal: "responsavel",
  parentesco: "parentesco", grauparentesco: "parentesco", grau: "parentesco",
  ocupadesde: "ocupaDesde", desde: "ocupaDesde", entrada: "ocupaDesde", dataentrada: "ocupaDesde", datadeentrada: "ocupaDesde",
  email: "email", correio: "email", correioeletronico: "email",
};

const PARENTESCOS_TEXTO: [RegExp, Parentesco][] = [
  [/^(conjuge|esposa|esposo|marido|mulher|companheir[oa]|parceir[oa])$/, "CONJUGE"],
  [/^(filh[oa]|enteado|enteada)$/, "FILHO"],
  [/^(pai|mae|padrasto|madrasta)$/, "PAI_MAE"],
  [/^(irma|irmao)$/, "IRMAO"],
  [/^(outro parente|parente|av[oó]|net[oa]|ti[oa]|sobrinh[oa]|prim[oa]|sogr[oa]|genro|nora|cunhad[oa])$/, "OUTRO_PARENTE"],
];

/** "sim", "x" ou "não"; em branco fica sem valor; outra coisa é erro. */
function simNao(t: string): boolean | null | "INVALIDO" {
  if (t === "") return null;
  if (/^(sim|s|x|1|verdadeiro)$/.test(t)) return true;
  if (/^(nao|n|0|falso)$/.test(t)) return false;
  return "INVALIDO";
}

/** "01/03/2025" ou "2025-03-01" viram "2025-03-01". */
function dataDaPlanilha(t: string): string {
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  return br ? `${br[3]}-${br[2]!.padStart(2, "0")}-${br[1]!.padStart(2, "0")}` : t;
}

const RELACOES_TEXTO: [RegExp, RelacaoUnidade][] = [
  [/^(proprietari[oa]|dono|dona|titular)$/, "PROPRIETARIO"],
  [/^(inquilin[oa]|locatari[oa])$/, "INQUILINO"],
  [/^(morador[a]?|residente)?$/, "MORADOR"],
  [/^(familiar|conjuge|esposa|esposo|marido|mulher|companheir[oa]|filh[oa]|pai|mae)$/, "FAMILIAR"],
  [/^(outro|outra|autorizad[oa]|procurador[a]?|representante)$/, "OUTRO"],
];

const simples = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** Quebra o CSV em linhas e campos, respeitando aspas. */
function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^\uFEFF/, "");
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i]!;
    if (aspas) {
      if (ch === '"' && limpo[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += ch;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

export interface ErroPlanilha {
  /** Número da linha na planilha (a do cabeçalho é a 1). */
  linha: number;
  campos: string[];
}

export interface LeituraPlanilha {
  linhas: LinhaImportacao[];
  /** Número da linha na planilha de cada linha boa (para traduzir o erro da API). */
  origens: number[];
  erros: ErroPlanilha[];
  /** Coluna obrigatória que não foi achada no cabeçalho. */
  faltam: string[];
  /** Nome da divisão pela coluna da planilha (torre, bloco, quadra ou prédio). */
  agrupamento: "TORRE" | "BLOCO" | "QUADRA" | "PREDIO" | null;
}

const AGRUPAMENTO_DA_COLUNA: Record<string, LeituraPlanilha["agrupamento"]> = { torre: "TORRE", bloco: "BLOCO", quadra: "QUADRA", predio: "PREDIO" };

/** Lê a planilha e devolve as linhas boas e onde estão os erros, para a prévia. */
export function lerPlanilhaMoradores(texto: string): LeituraPlanilha {
  const [cabecalho, ...corpo] = lerCsv(texto);
  const indices: Partial<Record<keyof LinhaImportacao, number>> = {};
  let agrupamento: LeituraPlanilha["agrupamento"] = null;
  (cabecalho ?? []).forEach((c, i) => {
    const chave = simples(c).replace(/[^a-z]/g, "");
    const alvo = COLUNAS[chave];
    if (alvo && indices[alvo] === undefined) {
      indices[alvo] = i;
      if (alvo === "bloco") agrupamento = AGRUPAMENTO_DA_COLUNA[chave] ?? null;
    }
  });
  const faltam = (["unidade", "nome", "telefone"] as const).filter((c) => indices[c] === undefined);
  if (faltam.length) return { linhas: [], origens: [], erros: [], faltam, agrupamento };

  const linhas: LinhaImportacao[] = [];
  const origens: number[] = [];
  const erros: ErroPlanilha[] = [];
  corpo.forEach((celulas, n) => {
    const valor = (c: keyof LinhaImportacao) => (indices[c] === undefined ? "" : (celulas[indices[c]!] ?? "").trim());
    const textoRelacao = simples(valor("relacao"));
    const relacaoAchada = RELACOES_TEXTO.find(([re]) => re.test(textoRelacao))?.[1];
    // Sem a coluna parentesco, "filho" ou "esposa" na relação já dizem o parentesco.
    const acharParentesco = (t: string) => PARENTESCOS_TEXTO.find(([re]) => re.test(t))?.[1];
    const textoParentesco = simples(valor("parentesco"));
    const parentesco = textoParentesco
      ? acharParentesco(textoParentesco) ?? "INVALIDO"
      : relacaoAchada === "FAMILIAR" ? acharParentesco(textoRelacao) ?? null : null;
    const r = linhaImportacaoSchema.safeParse({
      bloco: valor("bloco") || null,
      andar: valor("andar") || null,
      unidade: valor("unidade"),
      nome: valor("nome"),
      telefone: valor("telefone"),
      relacao: relacaoAchada ?? "INVALIDA",
      mora: simNao(simples(valor("mora"))),
      responsavel: simNao(simples(valor("responsavel"))),
      parentesco,
      ocupaDesde: valor("ocupaDesde") ? dataDaPlanilha(valor("ocupaDesde")) : null,
      email: valor("email") || undefined,
    });
    if (r.success) {
      linhas.push(r.data);
      origens.push(n + 2);
    }
    else erros.push({ linha: n + 2, campos: [...new Set(r.error.issues.map((i) => String(i.path[0])))] });
  });
  return { linhas, origens, erros, faltam: [], agrupamento };
}

/** O que corrigir em cada campo da planilha, dito para quem usa. */
export const TEXTOS_CAMPO_PLANILHA: Record<string, string> = {
  bloco: "Torre ou bloco com mais de 40 caracteres",
  andar: "Andar com mais de 20 caracteres",
  unidade: "Unidade em branco ou com mais de 20 caracteres",
  nome: "Nome em branco",
  telefone: "Telefone incompleto: precisa do DDD e do número",
  relacao: "Relação não reconhecida: use proprietário, inquilino, morador, familiar ou outro",
  mora: "Mora na unidade: use sim ou não",
  responsavel: "Responsável pela unidade: use sim ou não",
  email: "E-mail incompleto: confira o @ e o domínio",
  parentesco: "Parentesco não reconhecido (cônjuge, filho, pai ou mãe, irmão, outro parente) ou em quem não é familiar",
  ocupaDesde: "Ocupa desde: use a data no formato 01/03/2025",
};

/** Modelo de planilha para baixar (separador ";", como o Excel em português salva). */
export const MODELO_PLANILHA =
  "Torre;Andar;Unidade;Nome;Telefone;Relação;Mora na unidade;Responsável pela unidade;Parentesco;Ocupa desde;E-mail\r\n" +
  "Torre A;1;101;Maria Exemplo;(61) 99999-0000;Proprietário;sim;sim;;;maria@exemplo.com.br\r\n" +
  "Torre A;1;101;João Exemplo;(61) 99999-0001;Familiar;sim;não;Filho;01/03/2025;\r\n";

// ---------------------------------------------------------------------------------------
// Garagens e veículos (F3.8; MU-06, MU-11). Os mesmos valores estão no banco
// (0270_garagens_reserva_quedas.sql).

/** Placa Mercosul (ABC1D23) ou antiga (ABC1234), sem hífen. */
export const RE_PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/** A placa no formato do cadastro: maiúsculas, sem hífen nem espaço. Fora dos dois formatos, null. */
export function normalizarPlaca(p: string | null | undefined): string | null {
  const x = (p ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return RE_PLACA.test(x) ? x : null;
}

/** A antiga aparece com hífen ("ABC-1234"); a Mercosul fica como é ("ABC1D23"). */
export function mostrarPlaca(p: string): string {
  return /^[A-Z]{3}[0-9]{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export const TIPOS_VEICULO = { CARRO: "Carro", MOTO: "Moto", OUTRO: "Outro" } as const;
export type TipoVeiculo = keyof typeof TIPOS_VEICULO;

const opcional = (max: number, min = 1) =>
  z.string().max(max).nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null)).pipe(z.string().min(min).nullable());

export const vagaSchema = z.object({
  versao: versao.nullable().optional().transform((v) => v ?? null),
  identificacao,
  onde: opcional(60, 2),
  coberta: z.boolean().nullable().optional().transform((v) => v ?? null),
  unidadeId: id.nullable().optional().transform((v) => v ?? null),
  ativa: z.boolean().nullable().optional().transform((v) => v ?? null),
});

export const veiculoSchema = z.object({
  versao: versao.nullable().optional().transform((v) => v ?? null),
  unidadeId: id.nullable().optional().transform((v) => v ?? null),
  placa: z.string().max(10).transform((p, ctx) => {
    const n = normalizarPlaca(p);
    if (!n) ctx.addIssue({ code: "custom", message: "Placa Mercosul (ABC1D23) ou antiga (ABC-1234)" });
    return n ?? "";
  }),
  tipo: z.enum(chaves(TIPOS_VEICULO)),
  modelo: opcional(60, 2),
  contatoId: id.nullable().optional().transform((v) => v ?? null),
  vagaId: id.nullable().optional().transform((v) => v ?? null),
});

export const retirarVeiculoSchema = z.object({ versao });

/** Busca da lista de unidades: unidade, nome, telefone ou placa em uso. */
export const buscaUnidadesSchema = z.object({ busca: z.string().trim().min(2).max(60) });

/** O que a busca achou em cada unidade (MU-11). */
export const ACHADOS_BUSCA = { UNIDADE: "Unidade", PLACA: "Placa", NOME: "Nome", TELEFONE: "Telefone" } as const;

/** Histórico da unidade e da vaga: veículos e vagas. Nulo quando o evento é de outra parte. */
export function descreverEventoGaragem(acao: string, d: Record<string, unknown>): string | null {
  switch (acao) {
    case "vaga.criada":
      return d.unidade ? "Vaga criada para uma unidade" : "Vaga criada do condomínio";
    case "vaga.alterada":
      return d.unidade !== d.unidadeAntes ? "Vaga passou a outra unidade" : "Vaga alterada";
    case "vaga.fora_de_uso":
      return "Vaga fora de uso";
    case "vaga.reativada":
      return "Vaga de volta ao uso";
    case "unidade.veiculo_incluido":
      return d.vaga ? "Veículo incluído, com vaga" : "Veículo incluído, sem vaga";
    case "unidade.veiculo_alterado":
      return "Veículo alterado";
    case "unidade.veiculo_retirado":
      return d.motivo === "SAIU" ? "Veículo retirado: a pessoa saiu da unidade" : "Veículo retirado";
    default:
      return null;
  }
}
