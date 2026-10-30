// Orçamentos e compras (peça R8): pedir propostas a fornecedores por link sem conta (OC-03),
// comparar escopo e não só preço (OC-02), decidir com motivo (OC-06), regras por faixa de valor (OC-05)
// e acompanhar a compra (OC-01). Os mesmos valores estão no banco (0317_orcamentos.sql); quem pode o quê,
// o mínimo de propostas e a alçada são decididos lá. A TRÍADE não escolhe fornecedor nem compra (V-17).

import { z } from "zod";
import { mostrarCusto } from "./decisoes.ts";
import { mostrarDataSemHora } from "./plataforma.ts";

const chaves = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const versao = z.number().int().min(1);
const id = z.string().uuid();
const idOpcional = id.nullable().optional().transform((v) => v ?? null);
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instante = z.string().datetime({ offset: true });
const opcional = (s: z.ZodString) => s.nullable().optional().transform((v) => (v ? v : null));
const motivo = z.string().trim().min(3).max(500);
const centavos = z.number().int().min(1);
const centavosOuZero = z.number().int().min(0);

/** Estados do orçamento (regra 1 do plano). */
export const ESTADOS_ORCAMENTO = {
  RASCUNHO: "Rascunho",
  PEDINDO: "Pedindo propostas",
  COMPARANDO: "Pronto para comparar",
  ESCOLHIDA: "Escolhida",
  COMPRANDO: "Comprando",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
} as const;
export type EstadoOrcamento = keyof typeof ESTADOS_ORCAMENTO;

/** Abas da lista (quadro 470). */
export const FILTROS_ORCAMENTO = {
  EM_ANDAMENTO: "Em andamento",
  DECIDIDOS: "Decididos",
  ENCERRADOS: "Encerrados",
  CANCELADOS: "Cancelados",
} as const;
export type FiltroOrcamento = keyof typeof FILTROS_ORCAMENTO;

/** Tipo do orçamento: só serviço nesta rodada; a lista de itens (OC-08) vem depois. */
export const TIPOS_ORCAMENTO = { SERVICO: "Serviço", ITENS: "Lista de itens" } as const;
export type TipoOrcamento = keyof typeof TIPOS_ORCAMENTO;

/** Como o convite chega ao fornecedor. */
export const CANAIS_CONVITE = { WHATSAPP: "WhatsApp", EMAIL: "E-mail" } as const;
export type CanalConvite = keyof typeof CANAIS_CONVITE;

/** Estado de cada convite (quadro 474). */
export const ESTADOS_CONVITE = {
  CONVIDADO: "Convidado",
  RESPONDEU: "Mandou a proposta",
  RECUSOU: "Recusou",
  REVOGADO: "Link revogado",
} as const;
export type EstadoConvite = keyof typeof ESTADOS_CONVITE;

/** Quem aprova a escolha (quadro 481): uma pessoa com Aprovar ou o conselho (despesa para aprovar, R5). */
export const QUEM_APROVA_ORCAMENTO = { PESSOA: "Uma pessoa", CONSELHO: "O conselho" } as const;
export type QuemAprovaOrcamento = keyof typeof QUEM_APROVA_ORCAMENTO;

/** Quem aprova por faixa de valor (quadro 484). */
export const QUEM_APROVA_FAIXA = { SINDICO: "Síndico", CONSELHO: "Conselho" } as const;
export type QuemAprovaFaixa = keyof typeof QUEM_APROVA_FAIXA;

/** Quando não chega o mínimo de propostas (quadro 484). */
export const ABAIXO_MINIMO = {
  MOTIVO: "Pode decidir com menos, escrevendo o motivo",
  BLOQUEIA: "Não deixa decidir com menos",
} as const;
export type AbaixoMinimo = keyof typeof ABAIXO_MINIMO;

/** O que a página do link do fornecedor mostra (/o/<código>, quadros 476 a 478). */
export const ESTADOS_LINK_ORCAMENTO = {
  VER: "Veja o pedido e mande sua proposta",
  RECUSOU: "Você disse que não vai participar",
  ENVIADA: "Proposta enviada",
  CONFIRMAR_PRECO: "O condomínio pede para confirmar o preço",
  ESCOLHIDA: "Sua proposta foi escolhida",
  ACEITA: "Você aceitou fazer o serviço",
  NAO_ESCOLHIDA: "O condomínio escolheu outra proposta",
  PRAZO_ACABOU: "O prazo para propostas acabou",
  CANCELADO: "O condomínio cancelou este pedido de orçamento",
  NAO_VALE: "Este link não vale mais",
} as const;
export type EstadoLinkOrcamento = keyof typeof ESTADOS_LINK_ORCAMENTO;

/** Por que o link não vale. */
export const LINK_ORCAMENTO_NAO_VALE = {
  LINK_TROCADO: "Um link novo foi mandado e este parou.",
  REVOGADO: "O condomínio cancelou este link.",
  VENCIDO: "Este link venceu.",
} as const;

/** Avisos no sino de quem cuida do orçamento. */
export const AVISOS_ORCAMENTO = {
  PROPOSTA_RECEBIDA: "Chegou uma proposta",
  RECUSOU: "Um fornecedor recusou o convite",
  PRAZO_FECHOU: "O prazo das propostas fechou",
  PRECO_CONFIRMADO: "O fornecedor confirmou o preço",
  ACEITE: "O fornecedor aceitou",
  SEM_ACEITE_5D: "Faz 5 dias que o fornecedor não confirma",
  APROVADA: "A escolha foi respondida",
} as const;

export const DIAS_SEM_ACEITE = 5;
export const ANEXOS_POR_ORCAMENTO = 10;

// ---------------------------------------------------------------------------------------
// Esquemas de entrada (rotas em api-plataforma/orcamentos.ts).

const celular = opcional(z.string().trim().max(30));
const email = opcional(z.string().trim().max(254)).refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido");

/** Um convidado: prestador cadastrado ou só nome e contato (quadro 472). */
export const conviteSchema = z
  .object({ prestadorId: idOpcional, nome: opcional(z.string().trim().max(120)), canal: z.enum(chaves(CANAIS_CONVITE)), celular, email })
  .superRefine((d, ctx) => {
    if (!d.prestadorId && (!d.nome || d.nome.length < 2)) ctx.addIssue({ code: "custom", path: ["nome"], message: "Escreva o nome (2 a 120 caracteres)" });
    if (!d.prestadorId && d.canal === "WHATSAPP" && !d.celular) ctx.addIssue({ code: "custom", path: ["celular"], message: "Informe o WhatsApp" });
    if (!d.prestadorId && d.canal === "EMAIL" && !d.email) ctx.addIssue({ code: "custom", path: ["email"], message: "Informe o e-mail" });
  });
export type Convite = z.infer<typeof conviteSchema>;

const dadosOrcamento = {
  titulo: z.string().trim().min(3).max(120),
  descricao: z.string().trim().min(3).max(2000),
  local: opcional(z.string().trim().max(120)),
  valorEstimado: centavos.nullable().optional().transform((v) => v ?? null),
};

export const criarOrcamentoSchema = z.object({
  ...dadosOrcamento,
  tipo: z.enum(chaves(TIPOS_ORCAMENTO)).default("SERVICO"),
  manutencaoId: idOpcional,
  pedidoId: idOpcional,
  prazoPropostas: instante,
  validadeMinimaDias: z.number().int().min(1).max(180),
  convites: z.array(conviteSchema).max(20),
  mandar: z.boolean().default(true),
}).superRefine((d, ctx) => {
  if (d.manutencaoId && d.pedidoId) ctx.addIssue({ code: "custom", path: ["manutencaoId"], message: "Escolha a manutenção ou o pedido, não os dois" });
  if (d.mandar && d.convites.length === 0) ctx.addIssue({ code: "custom", path: ["convites"], message: "Convide pelo menos um fornecedor, ou guarde sem mandar" });
});
export type CriarOrcamento = z.infer<typeof criarOrcamentoSchema>;

export const alterarOrcamentoSchema = z.object({ versao, ...dadosOrcamento });
export const convidarSchema = z.object({ convites: z.array(conviteSchema).min(1).max(20) });
export const revogarConviteSchema = z.object({ motivo });
export const estenderPrazoSchema = z.object({ versao, prazoPropostas: instante });
export const escolherPropostaSchema = z.object({
  versao,
  propostaId: id,
  motivo: opcional(z.string().trim().max(1000)),
  quemAprova: z.enum(chaves(QUEM_APROVA_ORCAMENTO)),
});
export type EscolherProposta = z.infer<typeof escolherPropostaSchema>;
export const aceiteForaSchema = z.object({ versao, data });
export const registrarCompraSchema = z.object({ versao, data, valorFechado: centavos });
export const registrarEntregaSchema = z.object({ versao, data, parcial: z.boolean().default(false), observacao: opcional(z.string().trim().max(500)) });
export const cancelarOrcamentoSchema = z.object({ versao, motivo });
export const filtroOrcamentosSchema = z.object({ filtro: z.enum(chaves(FILTROS_ORCAMENTO)).default("EM_ANDAMENTO") });

/** Regras (quadro 484). As faixas vêm em ordem; a última pode não ter teto (ate = null). */
export const faixaOrcamentoSchema = z.object({
  ate: centavos.nullable(),
  minimo: z.number().int().min(1).max(10),
  quemAprova: z.enum(chaves(QUEM_APROVA_FAIXA)),
});
export const regrasOrcamentoSchema = z
  .object({
    versao,
    ligada: z.boolean(),
    faixas: z.array(faixaOrcamentoSchema).max(6),
    abaixoMinimo: z.enum(chaves(ABAIXO_MINIMO)),
    prazoDias: z.number().int().min(1).max(30),
    validadeDias: z.number().int().min(1).max(180),
    linkDias: z.number().int().min(1).max(60),
    alcadaConselho: centavos.nullable(),
  })
  .superRefine((d, ctx) => {
    for (let i = 1; i < d.faixas.length; i++) {
      const a = d.faixas[i - 1]?.ate ?? null, b = d.faixas[i]?.ate ?? null;
      if (a === null) ctx.addIssue({ code: "custom", path: ["faixas", i - 1, "ate"], message: "Só a última faixa fica sem teto" });
      else if (b !== null && b <= a) ctx.addIssue({ code: "custom", path: ["faixas", i, "ate"], message: "Cada faixa começa onde a anterior termina" });
    }
    if (d.ligada && d.faixas.length === 0) ctx.addIssue({ code: "custom", path: ["faixas"], message: "Com a regra ligada, inclua pelo menos uma faixa" });
  });
export type RegrasOrcamento = z.infer<typeof regrasOrcamentoSchema>;

/** O fornecedor manda a proposta pelo link (quadro 477). */
export const propostaPublicaSchema = z
  .object({
    valor: centavos,
    freteIncluso: z.boolean(),
    frete: centavosOuZero.default(0),
    marcaModelo: opcional(z.string().trim().max(200)),
    prazoExecucao: z.string().trim().min(1).max(120),
    garantia: opcional(z.string().trim().max(120)),
    validaAte: data,
    pagamento: opcional(z.string().trim().max(200)),
    inclui: z.string().trim().min(3).max(2000),
    naoInclui: opcional(z.string().trim().max(2000)),
    pdfArquivoId: idOpcional,
  })
  .transform((d) => ({ ...d, frete: d.freteIncluso ? 0 : d.frete }));
export type PropostaPublica = z.infer<typeof propostaPublicaSchema>;
export const recusarPublicoSchema = z.object({ motivo: opcional(z.string().trim().max(500)) });
export const confirmarPrecoSchema = z.object({ validaAte: data });
export const aceitarPublicoSchema = z.object({ nome: z.string().trim().min(2).max(120) });

/** Anexos do pedido e PDF da proposta: o mesmo ciclo das despesas (iniciar, verificar, link, tirar). */
export const PARTES_ANEXO_ORCAMENTO = { PEDIDO: "Arquivo do pedido", NOTA_FISCAL: "Nota fiscal" } as const;
export type ParteAnexoOrcamento = keyof typeof PARTES_ANEXO_ORCAMENTO;
export const enviarAnexoOrcamentoSchema = z.object({
  parte: z.enum(chaves(PARTES_ANEXO_ORCAMENTO)).default("PEDIDO"),
  nome: z.string().trim().min(1).max(200),
  tipo: z.string().trim().min(3).max(100),
  tamanho: z.number().int().min(1),
});

// ---------------------------------------------------------------------------------------
// Textos e contas que as telas e a API usam.

/** Total = valor + frete (o frete incluso conta zero). */
export function totalProposta(p: { valor: number; frete?: number | null; freteIncluso?: boolean }): number {
  return p.valor + (p.freteIncluso ? 0 : (p.frete ?? 0));
}

/** "R$ 6.480" sem centavos para listas e cartões; com centavos no detalhe (mostrarCusto). */
export function mostrarTotal(centavos: number, comCentavos = true): string {
  return comCentavos ? mostrarCusto(centavos) : mostrarCusto(centavos).replace(/,\d{2}$/, "");
}

/** "3 de 3 chegaram" / "0 de 4 chegaram" (quadro 470). */
export function textoRecebidas(recebidas: number, convidados: number): string {
  return `${recebidas} de ${convidados} chegaram`;
}

/** A faixa que vale para um valor (a primeira cujo teto comporta o valor; a sem teto pega o resto). */
export function faixaDoValor<F extends { ate: number | null }>(faixas: F[], valor: number | null): F | null {
  if (valor === null) return null;
  for (const f of faixas) if (f.ate === null || valor <= f.ate) return f;
  return null;
}

/** A nota da regra (quadros 472 e 474): "A regra pede 3 propostas acima de R$ 3.000. Com 3 convidados, está dentro." */
export function textoRegraMinimo(r: { ligada: boolean; faixa: { ate: number | null; minimo: number } | null; anterior?: number | null },
                                 convidados: number): string | null {
  if (!r.ligada || !r.faixa) return null;
  const faixa = r.faixa.ate === null
    ? (r.anterior ? `acima de ${mostrarTotal(r.anterior, false)}` : "em qualquer valor")
    : `até ${mostrarTotal(r.faixa.ate, false)}`;
  const n = r.faixa.minimo;
  const dentro = convidados >= n ? `Com ${convidados} convidado${convidados === 1 ? "" : "s"}, está dentro.` : `Com ${convidados} convidado${convidados === 1 ? "" : "s"}, ainda falta${n - convidados === 1 ? "" : "m"} ${n - convidados}.`;
  return `A regra do condomínio pede pelo menos ${n} proposta${n === 1 ? "" : "s"} ${faixa}. ${dentro}`;
}

/** Aviso da escolha que não é a mais barata (quadro 481). */
export function avisoNaoMaisBarata(escolhida: number, menor: { nome: string; total: number }): string | null {
  if (escolhida <= menor.total) return null;
  return `Não é a de menor total: ${menor.nome} custa ${mostrarCusto(escolhida - menor.total)} a menos (${mostrarCusto(menor.total)}). Por isso o motivo é obrigatório e vai junto para quem aprova e para o resumo dos moradores.`;
}

/** O motivo é obrigatório quando não é a de menor total ou quando decide abaixo do mínimo. */
export function motivoObrigatorio(d: { escolhidaTotal: number; menorTotal: number; minimoAtendido: boolean }): boolean {
  return d.escolhidaTotal > d.menorTotal || !d.minimoAtendido;
}

/** A mensagem pronta do convite (quadro 475), que sai pelo WhatsApp de quem manda ou vai no e-mail. */
export function mensagemConvite(d: { quem: string; cargo: string; condominio: string; titulo: string; prazo: string; link: string }): string {
  return `Olá, aqui é ${d.quem}, ${d.cargo} do ${d.condominio}. Queremos um orçamento para ${d.titulo.charAt(0).toLowerCase()}${d.titulo.slice(1)}. ` +
    `Veja o que precisa e mande sua proposta até ${d.prazo}, por este link: ${d.link}. Se não puder participar, é só dizer no link.`;
}

/** O caminho do link do fornecedor, sem conta (quadro 476). */
export function caminhoLinkOrcamento(codigo: string): string {
  return `/o/${encodeURIComponent(codigo)}`;
}

/** O resumo para os moradores (quadro 482): nunca cita quem não foi escolhido. */
export function resumoParaMoradores(d: { titulo: string; propostas: number; fornecedor: string; total: number; motivo: string | null;
                                        aprovadoPeloConselhoEm?: string | null; previsao?: string | null }): string {
  const partes = [`Comparamos ${d.propostas} orçamento${d.propostas === 1 ? "" : "s"} e escolhemos o da ${d.fornecedor} (${mostrarCusto(d.total)})` +
    (d.motivo ? `, porque ${d.motivo.charAt(0).toLowerCase()}${d.motivo.slice(1).replace(/\.$/, "")}.` : ".")];
  if (d.aprovadoPeloConselhoEm) partes.push(`O conselho aprovou em ${mostrarDataSemHora(d.aprovadoPeloConselhoEm)}.`);
  if (d.previsao) partes.push(`A previsão é até ${mostrarDataSemHora(d.previsao)}.`);
  return partes.join(" ");
}

/** "Faz 6 dias que o fornecedor não confirma no link." */
export function textoSemAceite(dias: number): string | null {
  if (dias < DIAS_SEM_ACEITE) return null;
  return `Faz ${dias} dia${dias === 1 ? "" : "s"} que o fornecedor não confirma no link.`;
}

/** Como a lista chama a situação, a partir do estado e do que já chegou (quadro 470). */
export function situacaoOrcamento(o: { estado: EstadoOrcamento; prazoFechou?: boolean; aceiteEm?: string | null; despesaEstado?: string | null }): string {
  if (o.estado === "PEDINDO" && o.prazoFechou) return "Pronto para comparar";
  if (o.estado === "ESCOLHIDA") {
    if (o.despesaEstado === "AGUARDANDO") return "Esperando o conselho";
    return o.aceiteEm ? "Esperando a aprovação" : "Esperando o aceite do fornecedor";
  }
  return ESTADOS_ORCAMENTO[o.estado];
}

/** Letra do convite pela ordem (A, B, C…). */
export function letraDoConvite(indice: number): string {
  return String.fromCharCode(65 + (indice % 26));
}

/** Descreve um evento do histórico do orçamento (como descreverEventoAprovacao). */
export function descreverEventoOrcamento(acao: string, d: Record<string, unknown>): string | null {
  const nome = typeof d.nome === "string" ? d.nome : "O fornecedor";
  switch (acao) {
    case "CRIADO": return "Orçamento criado";
    case "CONVIDADO": return `${nome} foi convidado`;
    case "REENVIADO": return `Link mandado de novo para ${nome}`;
    case "REVOGADO": return `Link de ${nome} revogado`;
    case "RECUSOU": return `${nome} recusou o convite`;
    case "PROPOSTA": return `${nome} mandou a proposta${typeof d.numero === "number" && d.numero > 1 ? ` (versão ${d.numero})` : ""}`;
    case "CONFIRMACAO_PEDIDA": return `Pedida a confirmação do preço a ${nome}`;
    case "PRECO_CONFIRMADO": return `${nome} confirmou o preço`;
    case "PRAZO_FECHOU": return "Prazo fechou";
    case "ESTENDIDO": return "Prazo estendido";
    case "ESCOLHIDA": return `Proposta de ${nome} escolhida`;
    case "ESCOLHA_DESFEITA": return "Escolha desfeita";
    case "AO_CONSELHO": return "Mandada ao conselho como despesa para aprovar";
    case "APROVADA": return "Aprovada";
    case "RECUSADA": return "Escolha recusada por quem aprova";
    case "ACEITE": return `${nome} aceitou fazer o serviço`;
    case "ACEITE_FORA": return `Aceite registrado fora do link`;
    case "COMPRA": return "Compra registrada";
    case "ENTREGA": return d.parcial ? "Entrega parcial registrada" : "Entrega registrada";
    case "CANCELADO": return "Orçamento cancelado";
    case "EDITADO": return "O pedido foi alterado";
    default: return null;
  }
}
