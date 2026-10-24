// Decisões e aprovações (peça R5): o conselho e o subsíndico (V-14) e a despesa para aprovar
// (FC-10). Os mesmos valores estão no banco (0303_decisoes_aprovacoes.sql); quem pode o quê, o
// quórum e quando a votação fecha são decididos lá.

import { z } from "zod";
import { mostrarCusto } from "./decisoes.ts";
import { mostrarDataSemHora } from "./plataforma.ts";

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const idOpcional = id.nullable().optional().transform((v) => v ?? null);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dataOpcional = data.nullable().optional().transform((v) => v ?? null);
const opcional = (s: z.ZodString) => s.nullable().optional().transform((v) => (v ? v : null));
const motivo = z.string().trim().min(3).max(500);
const justificativa = z.string().trim().min(3).max(1000);
const centavos = z.number().int().min(1);

/** Papéis do conselho (regra 1): titular é todo papel menos o suplente. */
export const PAPEIS_CONSELHO = {
  SUBSINDICO: "Subsíndico",
  CONSELHEIRO: "Conselheiro",
  CONSELHEIRO_FISCAL: "Conselheiro fiscal",
  SUPLENTE: "Suplente",
} as const;
export type PapelConselho = keyof typeof PAPEIS_CONSELHO;

/** Como o membro recebe o link para votar. */
export const CANAIS_CONSELHO = { WHATSAPP: "WhatsApp", EMAIL: "E-mail" } as const;
export type CanalConselho = keyof typeof CANAIS_CONSELHO;

/** Regras (quadro 421). */
export const QUORUNS_CONSELHO = {
  MAIORIA: "Maioria dos titulares",
  TODOS: "Todos os titulares",
  MINIMO: "Um mínimo de votos",
} as const;
export type QuorumConselho = keyof typeof QUORUNS_CONSELHO;
export const EMPATES_CONSELHO = {
  SINDICO: "Volta para o síndico decidir",
  DEVOLVIDA: "Fica devolvida",
} as const;
export const VENCIDA_AVISA = {
  NINGUEM: "Só quem decide",
  SUBSINDICO: "Também o subsíndico",
  CONSELHO: "Também o conselho",
} as const;

export const ESTADOS_DESPESA = {
  AGUARDANDO: "Aguardando",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  RETIRADA: "Retirada",
} as const;
export type EstadoDespesa = keyof typeof ESTADOS_DESPESA;

export const FILTROS_DESPESA = {
  AGUARDANDO: "Aguardando",
  APROVADAS: "Aprovadas",
  RECUSADAS: "Recusadas",
  TODAS: "Todas",
} as const;
export type FiltroDespesa = keyof typeof FILTROS_DESPESA;

/** Quem decide: uma pessoa com Aprovar ou o conselho. */
export const MODOS_DECISAO = { PESSOA: "Uma pessoa", CONSELHO: "O conselho" } as const;
export type ModoDecisao = keyof typeof MODOS_DECISAO;

/** O que a página do link do conselheiro mostra (/conselho/<código>). */
export const ESTADOS_LINK_CONSELHO = {
  VOTAR: "Vote até o prazo",
  VOTADO: "Voto registrado: dá para trocar até o prazo",
  RESPONDER: "Responda no lugar do síndico",
  AGUARDANDO: "Venceu sem resposta: só para você saber",
  FECHADA: "A votação fechou",
  PRAZO_ACABOU: "O prazo para votar acabou",
  NAO_VALE: "Este link não vale mais",
} as const;
export type EstadoLinkConselho = keyof typeof ESTADOS_LINK_CONSELHO;

/** Por que o link não vale. */
export const LINK_NAO_VALE = {
  LINK_TROCADO: "Um link novo foi mandado e este parou.",
  MANDATO_VENCIDO: "O mandato não está em dia.",
  SAIU_DO_CONSELHO: "Você não é mais do conselho.",
  AUSENCIA_ACABOU: "A ausência do síndico acabou: ele responde.",
} as const;

/** A frase fixa da tela Decisões. */
export const FRASE_ADVOGADO = "Em dúvida sobre a lei ou a convenção, consulte um advogado.";

// ---------------------------------------------------------------------------------------
// O conselho (quadros 410 e 411).

const celular = opcional(z.string().trim().max(30));
const email = opcional(z.string().trim().max(254)).refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido");

const mandato = {
  papel: z.enum(chaves(PAPEIS_CONSELHO)),
  mandatoInicio: data,
  mandatoFim: data,
  canal: z.enum(chaves(CANAIS_CONSELHO)),
  celular,
  email,
};
const conferirMandato = (d: { mandatoInicio: string; mandatoFim: string; canal: CanalConselho; celular: string | null; email: string | null },
                         ctx: z.RefinementCtx) => {
  if (d.mandatoFim < d.mandatoInicio) ctx.addIssue({ code: "custom", path: ["mandatoFim"], message: "O fim do mandato vem depois do início" });
};

/** Incluir membro: pessoa com acesso (pessoaId), morador cadastrado (contatoId) ou só o nome e o contato. */
export const incluirMembroSchema = z
  .object({ pessoaId: idOpcional, contatoId: idOpcional, nome: opcional(z.string().trim().max(120)), ...mandato })
  .superRefine((d, ctx) => {
    if (d.pessoaId && d.contatoId) ctx.addIssue({ code: "custom", path: ["pessoaId"], message: "Escolha a pessoa ou o morador, não os dois" });
    if (!d.pessoaId && !d.contatoId && (!d.nome || d.nome.length < 2)) {
      ctx.addIssue({ code: "custom", path: ["nome"], message: "Escreva o nome (2 a 120 caracteres)" });
    }
    conferirMandato(d, ctx);
  });
export type IncluirMembro = z.infer<typeof incluirMembroSchema>;

export const alterarMembroSchema = z.object({ versao, ...mandato }).superRefine(conferirMandato);
export const retirarMembroSchema = z.object({ versao, motivo });
export const buscaCandidatosSchema = z.object({ busca: z.string().trim().max(60).optional().transform((v) => (v ? v : null)) });

export const regrasDecisoesSchema = z
  .object({
    versao,
    quorum: z.enum(chaves(QUORUNS_CONSELHO)),
    minimo: z.number().int().min(1).max(50).nullable().optional().transform((v) => v ?? null),
    empate: z.enum(chaves(EMPATES_CONSELHO)),
    vencidaAvisa: z.enum(chaves(VENCIDA_AVISA)),
    /** Alçada do conselho em centavos: só avisa, nunca bloqueia. */
    alcada: centavos.nullable().optional().transform((v) => v ?? null),
  })
  .superRefine((d, ctx) => {
    if (d.quorum === "MINIMO" && d.minimo === null) ctx.addIssue({ code: "custom", path: ["minimo"], message: "Diga quantos votos" });
  });

/** O motivo é opcional (quadro 412); quando vem, de 2 a 200 caracteres, como no banco. */
export const ausenciaSchema = z
  .object({ de: data, ate: data, motivo: opcional(z.string().trim().max(200)).refine((v) => v === null || v.length >= 2, "De 2 a 200 caracteres") })
  .superRefine((d, ctx) => {
    if (d.ate < d.de) ctx.addIssue({ code: "custom", path: ["ate"], message: "O fim vem depois do começo" });
  });
export const encerrarAusenciaSchema = z.object({ versao });

// ---------------------------------------------------------------------------------------
// Votos e links.

/** O voto: o número da alternativa ou DEVOLVER (decisão); APROVAR ou RECUSAR (despesa). */
export const votoSchema = z
  .object({
    escolha: z.string().trim().toUpperCase().regex(/^([1-5]|DEVOLVER|APROVAR|RECUSAR)$/),
    justificativa: opcional(z.string().trim().max(1000)).refine((v) => v === null || v.length >= 3, "De 3 a 1000 caracteres"),
  })
  .superRefine((d, ctx) => {
    if ((d.escolha === "DEVOLVER" || d.escolha === "RECUSAR") && d.justificativa === null) {
      ctx.addIssue({ code: "custom", path: ["justificativa"], message: "Escreva o porquê" });
    }
  });
export type Voto = z.infer<typeof votoSchema>;

/** A resposta do subsíndico no lugar do síndico, pelo link: como a de uma pessoa, sem versão. */
export const respostaConselhoSchema = z
  .object({
    aprovar: z.boolean(),
    alternativa: z.number().int().min(1).max(5).nullable().optional().transform((v) => v ?? null),
    justificativa,
  });

export const reenviarLinkSchema = z.object({ membroId: id });

// ---------------------------------------------------------------------------------------
// Despesas (quadros 418 a 420 e 423).

const dadosDespesa = {
  descricao: z.string().trim().min(3).max(200),
  /** Valor em centavos (PT-09). */
  valor: centavos,
  prestadorId: idOpcional,
  fornecedor: opcional(z.string().trim().max(120)),
  vencimento: dataOpcional,
  pedidoId: idOpcional,
  manutencaoId: idOpcional,
  decisaoId: idOpcional,
};
const conferirDespesa = (d: { prestadorId: string | null; fornecedor: string | null; pedidoId: string | null; manutencaoId: string | null;
                                decisaoId: string | null }, ctx: z.RefinementCtx) => {
  if (d.prestadorId && d.fornecedor) ctx.addIssue({ code: "custom", path: ["fornecedor"], message: "Escolha o prestador ou escreva o nome, não os dois" });
  if (!d.prestadorId && (!d.fornecedor || d.fornecedor.length < 2)) {
    ctx.addIssue({ code: "custom", path: ["fornecedor"], message: "Diga o fornecedor (2 a 120 caracteres)" });
  }
  if ([d.pedidoId, d.manutencaoId, d.decisaoId].filter(Boolean).length > 1) {
    ctx.addIssue({ code: "custom", path: ["ligacao"], message: "Ligue a uma coisa só" });
  }
};

export const criarDespesaSchema = z
  .object({ ...dadosDespesa, modo: z.enum(chaves(MODOS_DECISAO)), decisorId: idOpcional, prazo: data })
  .superRefine((d, ctx) => {
    conferirDespesa(d, ctx);
    if (d.modo === "PESSOA" && !d.decisorId) ctx.addIssue({ code: "custom", path: ["decisorId"], message: "Escolha quem aprova" });
    if (d.modo === "CONSELHO" && d.decisorId) ctx.addIssue({ code: "custom", path: ["decisorId"], message: "Pedida ao conselho, não há uma pessoa que aprova" });
  });
export type CriarDespesa = z.infer<typeof criarDespesaSchema>;

export const alterarDespesaSchema = z.object({ versao, ...dadosDespesa }).superRefine(conferirDespesa);
export const responderDespesaSchema = z.object({ versao, aprovar: z.boolean(), justificativa });
export const retirarDespesaSchema = z.object({ versao, motivo });
export const pagarDespesaSchema = z.object({ versao, pagaEm: data, comprovanteId: idOpcional });
export const desfazerPagamentoSchema = z.object({ versao });
export const filtroDespesasSchema = z.object({ filtro: z.enum(chaves(FILTROS_DESPESA)).default("AGUARDANDO") });

/** Anexo da decisão ou da despesa: fatura, nota, orçamento ou, na aprovada, o comprovante. */
export const PARTES_ANEXO_APROVACAO = { DOCUMENTO: "Documento", COMPROVANTE: "Comprovante do pagamento" } as const;
export const ANEXOS_POR_APROVACAO = 10;
export const enviarAnexoAprovacaoSchema = z.object({
  parte: z.enum(chaves(PARTES_ANEXO_APROVACAO)).default("DOCUMENTO"),
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().max(100),
  tamanho: z.number().int().min(1),
});

// ---------------------------------------------------------------------------------------
// Textos.

/** O placar do cartão em votação: "2 de 3 votos" (quórum de 2). */
export function textoVotacao(v: { votaram: number; titulares: number; necessarios: number }): string {
  const votos = `${v.votaram} de ${v.titulares} ${v.titulares === 1 ? "voto" : "votos"}`;
  return `${votos} · ${v.necessarios === 1 ? "1 voto decide" : `${v.necessarios} votos decidem`}`;
}

/** Quem falta votar: "Falta Lúcia", "Faltam Lúcia e Marcos". */
export function textoFaltam(nomes: string[]): string | null {
  if (!nomes.length) return null;
  const primeiros = nomes.map((n) => n.split(" ")[0]!);
  if (primeiros.length === 1) return `Falta ${primeiros[0]}`;
  return `Faltam ${primeiros.slice(0, -1).join(", ")} e ${primeiros[primeiros.length - 1]}`;
}

/** O que o voto quer dizer, na decisão ou na despesa. */
export function textoEscolha(escolha: string, alternativas?: { numero: number; descricao: string }[]): string {
  if (escolha === "DEVOLVER") return "Devolveu sem decidir";
  if (escolha === "APROVAR") return "Aprovou";
  if (escolha === "RECUSAR") return "Recusou";
  const a = alternativas?.find((x) => String(x.numero) === escolha);
  return a ? `Alternativa ${escolha}: ${a.descricao}` : `Alternativa ${escolha}`;
}

/** O mandato como na ata: "01/01/2026 a 31/12/2027". */
export function textoMandato(inicio: string, fim: string): string {
  return `${mostrarDataSemHora(inicio)} a ${mostrarDataSemHora(fim)}`;
}

/** A linha da despesa na lista: "R$ 8.000 · HidroPress". */
export function resumoDespesa(d: { valor: number; fornecedor?: { nome?: string | null } | null }): string {
  return [mostrarCusto(d.valor), d.fornecedor?.nome].filter(Boolean).join(" · ");
}

/** O aviso da alçada na criação: só avisa, nunca bloqueia. */
export function avisoAlcada(valor: number, alcada: number | null | undefined): string | null {
  if (!alcada || valor < alcada) return null;
  return `Passa da alçada do conselho (${mostrarCusto(alcada)}), escrita nas Regras. É só um aviso: dá para pedir assim mesmo.`;
}

/** Eventos do histórico da despesa e do conselho, como frase curta. */
export function descreverEventoAprovacao(acao: string, d: Record<string, unknown>): string | null {
  switch (acao) {
    case "despesa.pedida":
      return d.modo === "CONSELHO" ? `Pedida ao conselho · ${String(d.necessarios ?? "")} de ${String(d.titulares ?? "")} votos aprovam` : "Pedida para aprovar";
    case "despesa.alterada":
      return "Despesa alterada";
    case "despesa.respondida":
      return d.semQuorum ? "Sem quórum no conselho" : d.aprovada ? "Aprovada" : "Recusada";
    case "despesa.voltou_ao_sindico":
      return "Sem quórum no conselho: passou para o síndico";
    case "despesa.retirada":
      return `Retirada${d.motivo ? `. Motivo: ${String(d.motivo)}` : ""}`;
    case "despesa.paga_fora":
      return `Paga fora do sistema${d.pagaEm ? ` em ${mostrarDataSemHora(String(d.pagaEm))}` : ""}`;
    case "despesa.pagamento_desfeito":
      return "Registro do pagamento desfeito";
    case "conselho.voto":
      return d.antes ? "Voto trocado" : "Voto registrado";
    case "conselho.link_reenviado":
      return "Link reenviado";
    case "aprovacao.anexo_enviado":
      return `Anexo enviado${d.arquivoNome ? `: ${String(d.arquivoNome)}` : ""}`;
    case "aprovacao.anexo_tirado":
      return `Anexo tirado${d.arquivoNome ? `: ${String(d.arquivoNome)}` : ""}`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------
// Frases das telas (quadros 410, 413, 414, 416 e 421).

export interface RegrasConselhoResumo {
  quorum: QuorumConselho;
  minimo?: number | null;
  empate: keyof typeof EMPATES_CONSELHO;
  titularesEmDia: number;
  necessarios?: number | null;
  podePedir: boolean;
}

const votos = (n: number) => (n === 1 ? "1 voto" : `${n} votos`);
const titulares = (n: number) => (n === 1 ? "1 titular" : `${n} titulares`);

/** Quantos votos aprovam com n titulares, pela regra (como votos_necessarios no banco); null é sem quórum possível. */
export function votosQueAprovam(quorum: QuorumConselho, n: number, minimo?: number | null): number | null {
  if (n < 1) return null;
  if (quorum === "MAIORIA") return Math.floor(n / 2) + 1;
  if (quorum === "TODOS") return n;
  return minimo && minimo <= n ? minimo : null;
}

/** "Maioria dos titulares: 3 de 4 votos aprovam. Empate ou falta de votos no prazo devolve a decisão ao síndico." */
export function textoComoDecide(r: RegrasConselhoResumo): string {
  const nome = { MAIORIA: "Maioria dos titulares", TODOS: "Todos os titulares", MINIMO: "Um número mínimo" }[r.quorum];
  const empate = r.empate === "SINDICO" ? "Empate ou falta de votos no prazo devolve a decisão ao síndico."
    : "Empate ou falta de votos no prazo deixa a decisão devolvida.";
  if (!r.titularesEmDia) return `${nome}. Ainda não há titular com mandato em dia. ${empate}`;
  if (!r.podePedir || !r.necessarios) {
    return `${nome}: a regra pede ${votos(r.minimo ?? 0)} e só há ${titulares(r.titularesEmDia)} com mandato em dia. ${empate}`;
  }
  return `${nome}: ${r.necessarios} de ${r.titularesEmDia} ${r.titularesEmDia === 1 ? "voto aprova" : "votos aprovam"}. ${empate}`;
}

/** Em Quem decide (quadro 413): "4 titulares votam; maioria: 3 votos aprovam." */
export function textoQuemVotaNoConselho(r: RegrasConselhoResumo): string {
  const regra = { MAIORIA: "maioria", TODOS: "todos", MINIMO: "mínimo" }[r.quorum];
  return `${titulares(r.titularesEmDia)} ${r.titularesEmDia === 1 ? "vota" : "votam"}; ${regra}: ${votos(r.necessarios ?? 0)} ${r.necessarios === 1 ? "aprova" : "aprovam"}.`;
}

/** O estado "Sem quórum possível" (quadro 422). */
export function textoSemQuorum(r: RegrasConselhoResumo): string {
  const pede = r.quorum === "MINIMO" ? votos(r.minimo ?? 0) : "o quórum";
  return `Só ${titulares(r.titularesEmDia)} com mandato em dia e a regra pede ${pede}. Ajuste o conselho ou a regra antes de pedir.`;
}

/** A escolha que mais tem votos e quantos (empate: a de menor número). Sem voto, null. */
export function lider(contagem: Record<string, number> | undefined): { escolha: string; votos: number } | null {
  const lista = Object.entries(contagem ?? {}).filter(([, n]) => n > 0)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, "pt-BR", { numeric: true }));
  return lista.length ? { escolha: lista[0]![0], votos: lista[0]![1] } : null;
}

/** O placar do quadro 414: "2 de 3 votos para aprovar a alternativa 2"; "1 de 2 votos para aprovar" (despesa). */
export function textoPlacar(contagem: Record<string, number> | undefined, necessarios: number): string {
  const l = lider(contagem);
  if (!l) return `0 de ${votos(necessarios)} para decidir`;
  const de = `${l.votos} de ${votos(necessarios)}`;
  if (l.escolha === "DEVOLVER") return `${de} para devolver`;
  if (l.escolha === "APROVAR") return `${de} para aprovar`;
  if (l.escolha === "RECUSAR") return `${de} para recusar`;
  return `${de} para aprovar a alternativa ${l.escolha}`;
}

/** "3 de 4 titulares votaram. Falta Lúcia. Se ninguém chegar a 3 votos até 31/10, a decisão volta para Ana Souza decidir." */
export function textoAndamentoVotacao(v: { votaram: number; titulares: number; necessarios: number; faltam?: string[] },
                                      prazo: string, empate: keyof typeof EMPATES_CONSELHO, sindico: string | null, item: "decisão" | "despesa" = "decisão"): string {
  const ddmm = `${prazo.slice(8, 10)}/${prazo.slice(5, 7)}`;
  const falta = textoFaltam(v.faltam ?? []);
  const fim = empate === "SINDICO"
    ? `a ${item} volta para ${sindico ?? "o síndico"} decidir`
    : item === "despesa" ? "a despesa fica recusada" : "a decisão fica devolvida";
  return [`${v.votaram} de ${titulares(v.titulares)} ${v.votaram === 1 ? "votou" : "votaram"}.`, falta ? `${falta}.` : null,
    `Se ninguém chegar a ${votos(v.necessarios)} até ${ddmm}, ${fim}.`].filter(Boolean).join(" ");
}

/** O link do conselheiro, para copiar quando o WhatsApp não manda (envio COPIAR). */
export const caminhoLinkConselho = (codigo: string) => `/conselho/${encodeURIComponent(codigo)}`;
