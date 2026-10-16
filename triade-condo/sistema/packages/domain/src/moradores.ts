// Plataforma do síndico (passo 3): blocos, unidades e contatos. Os mesmos valores estão no
// banco (0080_moradores_unidades.sql).

import { z } from "zod";
import { normalizarTelefone } from "./console.ts";

/** Relação do contato com a unidade (MU-08). */
export const RELACOES_UNIDADE = {
  PROPRIETARIO: "Proprietário",
  INQUILINO: "Inquilino",
  MORADOR: "Morador",
  FAMILIAR: "Familiar ou cônjuge",
  OUTRO: "Outro autorizado",
} as const;
export type RelacaoUnidade = keyof typeof RELACOES_UNIDADE;

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

export const incluirUnidadesSchema = z.object({
  blocoId: id.nullable(),
  identificacoes: z.array(identificacao).min(1).max(1000),
});

export const alterarUnidadeSchema = z.object({
  versao,
  identificacao,
  blocoId: id.nullable(),
  ativa: z.boolean().optional(),
});

/** Contato novo (nome e telefone) ou um que já existe no condomínio (contatoId). */
export const incluirContatoSchema = z
  .object({
    contatoId: id.optional(),
    nome: nome.optional(),
    telefone: telefoneContato.optional(),
    relacao,
    principal: z.boolean().default(false),
    recebeComunicados: z.boolean().default(true),
  })
  .refine((c) => c.contatoId || (c.nome && c.telefone), { message: "Informe nome e telefone", path: ["nome"] });

export const alterarContatoSchema = z.object({ versao, nome, telefone: telefoneContato });

export const alterarVinculoUnidadeSchema = z.object({
  versao,
  relacao,
  principal: z.boolean(),
  recebeComunicados: z.boolean(),
});

const itensComVersao = (max: number) =>
  z
    .array(z.object({ id, versao }))
    .max(max)
    .refine((l) => new Set(l.map((i) => i.id)).size === l.length, { message: "Item repetido" });

export const confirmarContatosSchema = z.object({ itens: itensComVersao(2000).refine((l) => l.length > 0, { message: "Nada a confirmar" }) });

/** Data sem hora, conferida no calendário. */
const data = z.string().refine((t) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return a >= 2000 && a <= 2100 && mes >= 1 && mes <= 12 && d >= 1 && d <= new Date(Date.UTC(a, mes, 0)).getUTCDate();
}, { message: "Data inválida" });

export const encerrarVinculoSchema = z.object({
  versao,
  motivo: z.enum(chaves(MOTIVOS_ENCERRAMENTO)),
  dataSaida: data.nullable().optional(),
});

export const novoContatoSchema = z.object({
  nome,
  telefone: telefoneContato,
  relacao,
  principal: z.boolean().default(false),
  recebeComunicados: z.boolean().default(true),
});

export const mudancaSchema = z
  .object({
    data,
    saem: itensComVersao(50),
    entram: z.array(novoContatoSchema).max(20),
  })
  .refine((m) => m.saem.length + m.entram.length > 0, { message: "Diga quem sai ou quem entra", path: ["entram"] })
  .refine((m) => m.entram.filter((e) => e.principal).length <= 1, { message: "Só um contato principal", path: ["entram"] });

export const linhaImportacaoSchema = z.object({
  bloco: z.string().trim().min(1).max(40).nullable(),
  unidade: identificacao,
  nome,
  telefone: telefoneContato,
  relacao: relacao.default("MORADOR"),
});
export type LinhaImportacao = z.infer<typeof linhaImportacaoSchema>;

export const importacaoSchema = z.object({ linhas: z.array(linhaImportacaoSchema).min(1).max(2000) });

export const removerDadosSchema = z.object({ versao });

export const buscaMoradoresSchema = z.object({
  busca: z.string().trim().max(60).optional(),
  estado: z.enum(["PENDENTE", "CONFIRMADO"]).optional(),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});

/**
 * Numeração de prédio: andares de "de" até "ate", "porAndar" unidades em cada um.
 * Andar 1 com 4 por andar: 101, 102, 103, 104. Andar 0 vira térreo: 1, 2, 3, 4.
 */
export function gerarUnidades(o: { de: number; ate: number; porAndar: number }): string[] {
  if (!Number.isInteger(o.de) || !Number.isInteger(o.ate) || !Number.isInteger(o.porAndar)) return [];
  if (o.de < 0 || o.ate < o.de || o.ate > 200 || o.porAndar < 1 || o.porAndar > 99) return [];
  const lista: string[] = [];
  for (let andar = o.de; andar <= o.ate; andar++) {
    for (let n = 1; n <= o.porAndar; n++) lista.push(andar === 0 ? String(n) : `${andar}${String(n).padStart(2, "0")}`);
  }
  return lista.length <= 1000 ? lista : [];
}

/** Ordem natural, igual à do banco: "2" antes de "10", "Casa 2" antes de "Casa 10". */
export function chaveUnidade(t: string): string {
  const s = t.trim();
  const prefixo = /^\D*/.exec(s)?.[0] ?? "";
  const numero = /\d{1,12}/.exec(s)?.[0] ?? "";
  return prefixo.toLowerCase() + numero.padStart(12, "0") + s.toLowerCase();
}

/** "Torre A · 101" ou só "101". */
export function nomeDaUnidade(bloco: string | null | undefined, identificacao: string): string {
  return bloco ? `${bloco} · ${identificacao}` : identificacao;
}

// ---------------------------------------------------------------------------------------
// Planilha (F3.3): CSV salvo pelo Excel ou pelo Google Planilhas. Separador ";" ou ",".

const COLUNAS: Record<string, keyof LinhaImportacao> = {
  bloco: "bloco", torre: "bloco", quadra: "bloco", predio: "bloco",
  unidade: "unidade", apartamento: "unidade", apto: "unidade", ap: "unidade", casa: "unidade", sala: "unidade", numero: "unidade",
  nome: "nome", morador: "nome", contato: "nome", responsavel: "nome",
  telefone: "telefone", celular: "telefone", whatsapp: "telefone", fone: "telefone",
  relacao: "relacao", tipo: "relacao", vinculo: "relacao", situacao: "relacao",
};

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
}

/** Lê a planilha e devolve as linhas boas e onde estão os erros, para a prévia. */
export function lerPlanilhaMoradores(texto: string): LeituraPlanilha {
  const [cabecalho, ...corpo] = lerCsv(texto);
  const indices: Partial<Record<keyof LinhaImportacao, number>> = {};
  (cabecalho ?? []).forEach((c, i) => {
    const alvo = COLUNAS[simples(c).replace(/[^a-z]/g, "")];
    if (alvo && indices[alvo] === undefined) indices[alvo] = i;
  });
  const faltam = (["unidade", "nome", "telefone"] as const).filter((c) => indices[c] === undefined);
  if (faltam.length) return { linhas: [], origens: [], erros: [], faltam };

  const linhas: LinhaImportacao[] = [];
  const origens: number[] = [];
  const erros: ErroPlanilha[] = [];
  corpo.forEach((celulas, n) => {
    const valor = (c: keyof LinhaImportacao) => (indices[c] === undefined ? "" : (celulas[indices[c]!] ?? "").trim());
    const textoRelacao = simples(valor("relacao"));
    const relacaoAchada = RELACOES_TEXTO.find(([re]) => re.test(textoRelacao))?.[1];
    const r = linhaImportacaoSchema.safeParse({
      bloco: valor("bloco") || null,
      unidade: valor("unidade"),
      nome: valor("nome"),
      telefone: valor("telefone"),
      relacao: relacaoAchada ?? "INVALIDA",
    });
    if (r.success) {
      linhas.push(r.data);
      origens.push(n + 2);
    }
    else erros.push({ linha: n + 2, campos: [...new Set(r.error.issues.map((i) => String(i.path[0])))] });
  });
  return { linhas, origens, erros, faltam: [] };
}

/** O que corrigir em cada campo da planilha, dito para quem usa. */
export const TEXTOS_CAMPO_PLANILHA: Record<string, string> = {
  bloco: "Bloco com mais de 40 caracteres",
  unidade: "Unidade em branco ou com mais de 20 caracteres",
  nome: "Nome em branco",
  telefone: "Telefone incompleto: precisa do DDD e do número",
  relacao: "Relação não reconhecida: use proprietário, inquilino, morador, familiar ou outro",
};

/** Modelo de planilha para baixar (separador ";", como o Excel em português salva). */
export const MODELO_PLANILHA = "Bloco;Unidade;Nome;Telefone;Relação\r\nTorre A;101;Maria Exemplo;(61) 99999-0000;Proprietário\r\n";
