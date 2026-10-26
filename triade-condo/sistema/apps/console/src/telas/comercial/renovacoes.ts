// Renovações nas telas (0311, R17.7; CM-30, CM-31 e CM-32; quadros 346, 347 e 335): os tipos do que a
// api-console devolve, as rotas, as quatro abas e os textos de cada linha. O valor com reajuste, o
// último dia e quem pode são do banco; aqui só se escreve. O Comercial vê o nome do cliente e o plano,
// nunca os dados do condomínio (CM-11).

import {
  ETAPAS_EXPANSAO, MOTIVOS_CANCELAMENTO, SITUACOES_CANCELAMENTO, TEXTO_INDICE_A_DEFINIR, TIPOS_EXPANSAO, TIPOS_RISCO, textoAvisoReajuste, valeDesde,
  type CanalAviso, type EtapaExpansao, type MotivoCancelamento, type OrigemRisco, type SituacaoCancelamento, type SituacaoClienteRenovacao,
  type SituacaoRenovacao, type TipoExpansao, type TipoRenovacao, type TipoRisco,
} from "@triade/domain";
import type { Tom } from "@triade/ui";
import { plural } from "../comum.tsx";
import { reais, somarMeses, textoMes } from "./painel.ts";
import type { Pessoa } from "./tipos.ts";

export const TELA_RENOVACOES = "/comercial/renovacoes";

export const ROTAS_RENOVACOES = {
  tela: (mes?: string | null) => (mes ? `/v1/comercial/renovacoes?mes=${mes}` : "/v1/comercial/renovacoes"),
  regra: "/v1/comercial/renovacoes/regra",
  aviso: "/v1/comercial/renovacoes/aviso",
  dispensar: "/v1/comercial/renovacoes/dispensar",
  aditivo: (renovacao: string) => `/v1/comercial/renovacoes/${renovacao}/aditivo`,
  linkAditivo: (renovacao: string) => `/v1/comercial/renovacoes/${renovacao}/aditivo/link?baixar=1`,
  modelos: "/v1/comercial/modelos/aditivo",
  modelo: (id?: string) => (id ? `/v1/comercial/modelos/aditivo/${id}` : "/v1/comercial/modelos/aditivo"),
  usarModelo: (id: string) => `/v1/comercial/modelos/aditivo/${id}/usar`,
  riscos: "/v1/comercial/riscos",
  tratarRisco: (id: string) => `/v1/comercial/riscos/${id}/tratar`,
  cancelamentos: "/v1/comercial/cancelamentos",
  retencao: (id: string) => `/v1/comercial/cancelamentos/${id}/retencao`,
  ficou: (id: string) => `/v1/comercial/cancelamentos/${id}/ficou`,
  confirmar: (id: string) => `/v1/comercial/cancelamentos/${id}/confirmar`,
  expansoes: "/v1/comercial/expansoes",
  expansao: (id: string) => `/v1/comercial/expansoes/${id}`,
  encerrarExpansao: (id: string) => `/v1/comercial/expansoes/${id}/encerrar`,
};

export interface RegraReajusteTela {
  indice?: string;
  percentual?: number;
  referencia?: string;
  prazoAvisoDias: number;
  definida: boolean;
  versao: number;
  alteradoEm?: string;
  alteradoPor?: Pessoa;
}

export interface PlanoCliente {
  nome?: string;
  valor: number;
  ciclo: "MENSAL" | "ANUAL";
  tabela: "FUNDADOR" | "CHEIA" | "MANUAL";
  unidadesDe?: number;
  unidadesAte?: number;
  inicio?: string;
  diaVencimento?: number;
}

export interface AditivoResumo {
  id: string;
  numero: number;
  situacao: "GERANDO" | "PRONTO";
  hash: string;
}

/** Uma linha da aba Reajuste e renovação: a calculada (sem id) ou a registrada. */
export interface Renovacao {
  id?: string;
  versao?: number;
  interessadoId: string;
  condominio: string;
  contrato?: number;
  aniversario: string;
  avisarAte: string;
  tipo: TipoRenovacao;
  situacao: SituacaoRenovacao;
  hoje?: { valor: number; ciclo: "MENSAL" | "ANUAL"; tabela?: string };
  novo?: { valor: number; indice?: string; percentual?: number; referencia?: string; tabela?: "CHEIA" };
  semPlano?: boolean;
  aviso?: { em: string; canal: CanalAviso; para?: string; texto?: string };
  valeDesde?: string;
  dispensaMotivo?: string;
  aplicadoEm?: string;
  registradoEm?: string;
  registradoPor?: Pessoa;
  aditivo?: AditivoResumo;
}

export interface Sinal {
  id: string;
  versao: number;
  tipo: TipoRisco;
  origem: OrigemRisco;
  data: string;
  detalhe?: string;
  criadoEm: string;
}

export interface RiscoCliente {
  interessadoId: string;
  condominio: string;
  plano?: string;
  sinais: Sinal[];
}

export interface Expansao {
  id: string;
  versao: number;
  interessadoId: string;
  nome: string;
  condominio: string;
  tipo: TipoExpansao;
  etapa: EtapaExpansao;
  motivo: string;
  responsavel: Pessoa;
  proximoPasso?: string;
  proximoPassoData?: string;
  oportunidade?: { id: string; condominio: string; etapa: string };
  resultado?: string;
  encerradaEm?: string;
  criadoEm: string;
}

export interface SugestaoExpansao {
  interessadoId: string;
  condominio: string;
  tipo: Exclude<TipoExpansao, "MAIS_UM_PREDIO">;
  motivo: string;
}

export interface Cancelamento {
  id: string;
  versao: number;
  interessadoId: string;
  condominio: string;
  plano?: { valor: number; ciclo: "MENSAL" | "ANUAL"; inicio?: string; tabela?: string };
  pedidoPor?: string;
  pedidoEm: string;
  avisoDias: number;
  ultimoDia: string;
  motivo?: MotivoCancelamento;
  motivoTexto?: string;
  retencao?: string;
  retencaoEm?: string;
  retencaoPor?: Pessoa;
  situacao: SituacaoCancelamento;
  decididoEm?: string;
  decididoPor?: Pessoa;
  decisaoNota?: string;
  lembrarEm?: string;
  exportacaoPedida?: boolean;
}

export interface ClienteRenovacao {
  id: string;
  condominio: string;
  contato?: string;
  plano?: PlanoCliente;
  situacao: SituacaoClienteRenovacao;
}

export interface TelaRenovacoes {
  mes: string;
  hoje: string;
  regra: RegraReajusteTela;
  modeloAditivo?: { id: string; numero: number; titulo: string };
  renovacoes: Renovacao[];
  riscos: RiscoCliente[];
  expansoes: Expansao[];
  sugestoes: SugestaoExpansao[];
  cancelamentos: Cancelamento[];
  clientes: ClienteRenovacao[];
  equipe: Pessoa[];
  contagens: { renovacoes: number; riscos: number; expansoes: number; cancelamentos: number };
  avisoCancelamentoDias: number;
  pode: { editar: boolean; regra: boolean; confirmar: boolean };
}

export type AbaRenovacoes = "REAJUSTE" | "RISCO" | "EXPANSAO" | "CANCELAMENTOS";
export const ABAS_RENOVACOES: Record<AbaRenovacoes, { texto: string; endereco: string }> = {
  REAJUSTE: { texto: "Reajuste e renovação", endereco: "reajuste" },
  RISCO: { texto: "Risco", endereco: "risco" },
  EXPANSAO: { texto: "Expansão", endereco: "expansao" },
  CANCELAMENTOS: { texto: "Cancelamentos", endereco: "cancelamentos" },
};

/** A aba de um endereço (?aba=risco); a primeira quando não reconhece. */
export function abaDoEndereco(aba: string | null | undefined): AbaRenovacoes {
  const achada = (Object.keys(ABAS_RENOVACOES) as AbaRenovacoes[]).find((k) => ABAS_RENOVACOES[k].endereco === aba);
  return achada ?? "REAJUSTE";
}

/** Os meses do seletor: o atual e os 11 seguintes (as renovações olham para a frente). */
export function mesesRenovacoes(atual: string): { valor: string; texto: string }[] {
  return Array.from({ length: 12 }, (_, i) => ({ valor: somarMeses(atual, i), texto: textoMes(somarMeses(atual, i), true) }));
}

const data = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const mesAno = (d: string) => `${d.slice(5, 7)}/${d.slice(0, 4)}`;
const por = (ciclo: "MENSAL" | "ANUAL") => (ciclo === "ANUAL" ? "por ano" : "por mês");
const percentualBr = (p: number) => `${String(Number(p.toFixed(2))).replace(".", ",")}%`;
function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

/** "R$ 229,00" ou "R$ 129,00 · fundador". */
export function textoValorHoje(r: Pick<Renovacao, "hoje" | "semPlano">): string {
  if (!r.hoje) return "Sem plano";
  return `${reais(r.hoje.valor)}${r.hoje.tabela === "FUNDADOR" ? " · fundador" : ""}${r.hoje.ciclo === "ANUAL" ? " por ano" : ""}`;
}

/** "R$ 239,99 · IPCA 4,8%", "R$ 199,00 · fim do fundador" ou o índice a definir. */
export function textoComReajuste(r: Pick<Renovacao, "tipo" | "novo" | "semPlano" | "situacao">): string {
  if (r.situacao === "DISPENSADO") return "Sem reajuste";
  if (r.novo) {
    if (r.tipo === "FIM_FUNDADOR") return `${reais(r.novo.valor)} · fim do fundador`;
    return `${reais(r.novo.valor)} · ${r.novo.indice ?? TEXTO_INDICE_A_DEFINIR} ${r.novo.percentual !== undefined ? percentualBr(r.novo.percentual) : ""}`.trim();
  }
  if (r.semPlano) return "Sem plano: nada a calcular";
  if (r.tipo === "FIM_FUNDADOR") return "Faixa sob consulta: valor na conversa";
  return TEXTO_INDICE_A_DEFINIR;
}

/** O selo do aviso ao síndico (quadro 346): perto do prazo em atenção; atrasado em erro. */
export function seloAviso(r: Pick<Renovacao, "situacao" | "avisarAte" | "valeDesde">, hoje: string, inicioDias = 15): { texto: string; tom: Tom } {
  if (r.situacao === "ATRASADO") return { texto: `Aviso atrasado: era até ${diaMes(r.avisarAte)}`, tom: "erro" };
  if (r.situacao === "AVISAR") return { texto: `Avisar até ${diaMes(r.avisarAte)}`, tom: diasEntre(hoje, r.avisarAte) <= inicioDias ? "atencao" : "neutro" };
  if (r.situacao === "AVISO_ENVIADO") return { texto: "Aviso enviado", tom: "ok" };
  if (r.situacao === "APLICADO") return { texto: `Valor novo desde ${r.valeDesde ? mesAno(r.valeDesde) : "a competência"}`, tom: "ok" };
  return { texto: "Renovado sem reajuste", tom: "neutro" };
}

/** O que dá para fazer na linha: registrar o aviso (só com valor calculado) ou renovar sem reajuste. */
export function podeAvisar(r: Pick<Renovacao, "id" | "novo" | "situacao">): boolean {
  return !r.id && (r.situacao === "AVISAR" || r.situacao === "ATRASADO") && r.novo !== undefined;
}

/** A linha de baixo de uma renovação registrada: quando e por onde foi o aviso e desde quando vale. */
export function detalheRenovacao(r: Renovacao): string | null {
  if (r.situacao === "DISPENSADO") return r.dispensaMotivo ? `Sem reajuste: ${r.dispensaMotivo}` : null;
  if (!r.aviso) return null;
  const partes = [`Aviso em ${data(r.aviso.em)}`];
  if (r.valeDesde) partes.push(`vale desde a competência ${mesAno(r.valeDesde)}`);
  if (r.aditivo) partes.push(r.aditivo.situacao === "PRONTO" ? `aditivo nº ${r.aditivo.numero}` : "aditivo sendo montado");
  return partes.join(" · ");
}

/** A regra em texto: "IPCA 4,8% (12 meses até outubro) · aviso 30 dias antes" ou a definir. */
export function textoRegra(r: RegraReajusteTela): string {
  const aviso = `aviso ${r.prazoAvisoDias} dias antes do aniversário`;
  if (!r.definida || r.percentual === undefined) return `Índice ${TEXTO_INDICE_A_DEFINIR} · ${aviso}`;
  return `${r.indice} ${percentualBr(r.percentual)}${r.referencia ? ` (${r.referencia})` : ""} · ${aviso}`;
}

/** O texto sugerido do aviso, com o vale-desde que o banco vai calcular se o aviso sair hoje. */
export function avisoSugerido(r: Renovacao, regra: RegraReajusteTela, cliente: ClienteRenovacao | undefined, hoje: string): string | null {
  if (!r.novo || !r.hoje) return null;
  return textoAvisoReajuste({
    contato: cliente?.contato, condominio: r.condominio, aniversario: r.aniversario, tipo: r.tipo, valorAtual: r.hoje.valor, valorNovo: r.novo.valor,
    ciclo: r.hoje.ciclo, indice: r.novo.indice, percentual: r.novo.percentual, referencia: r.novo.referencia,
    valeDesde: valeDesde(r.aniversario, hoje, regra.prazoAvisoDias, cliente?.plano?.diaVencimento),
  });
}

/** "Valor novo a partir da competência 01/2027", para a janela do aviso. */
export const textoValeDesde = (r: Renovacao, regra: RegraReajusteTela, cliente: ClienteRenovacao | undefined, avisoEm: string) =>
  `O valor novo vale a partir da competência ${mesAno(valeDesde(r.aniversario, avisoEm, regra.prazoAvisoDias, cliente?.plano?.diaVencimento))}, depois do aniversário e dos ${regra.prazoAvisoDias} dias do aviso.`;

/** Um sinal de risco em texto (quadro 346). */
export function textoSinal(s: Pick<Sinal, "tipo" | "data" | "detalhe" | "origem">): string {
  if (s.tipo === "SINDICO_NOVO") return `Síndico novo ${s.origem === "TROCA_SINDICO" ? "desde" : "eleito"} ${diaMes(s.data)}`;
  if (s.tipo === "USO_CAINDO") return s.detalhe ?? "Uso caindo";
  return `Troca de sistema na pauta de ${diaMes(s.data)}`;
}

export const nomeRisco = (t: TipoRisco) => TIPOS_RISCO[t] ?? t;
export const nomeExpansao = (t: TipoExpansao) => TIPOS_EXPANSAO[t] ?? t;
export const nomeEtapaExpansao = (e: EtapaExpansao) => ETAPAS_EXPANSAO[e] ?? e;
export const nomeMotivoCancelamento = (m: MotivoCancelamento) => MOTIVOS_CANCELAMENTO[m] ?? m;

/** A linha de uma expansão: o próximo passo e de quem é. */
export function detalheExpansao(e: Expansao): string {
  if (e.encerradaEm) return `${nomeEtapaExpansao(e.etapa)}${e.resultado ? `: ${e.resultado}` : ""}`;
  const partes = [nomeEtapaExpansao(e.etapa), e.responsavel.nome];
  if (e.proximoPasso) partes.push(`${e.proximoPasso}${e.proximoPassoData ? ` em ${diaMes(e.proximoPassoData)}` : ""}`);
  return partes.join(" · ");
}

export const TOM_CANCELAMENTO: Record<SituacaoCancelamento, Tom> = { PEDIDO: "atencao", EM_RETENCAO: "andamento", FICOU: "ok", CONFIRMADO: "erro", ENCERRADO: "neutro" };
export const nomeSituacaoCancelamento = (s: SituacaoCancelamento) => SITUACOES_CANCELAMENTO[s] ?? s;

/** "desde 12/2025 · R$ 129,00 por mês" (o cliente na janela do pedido). */
export function textoPlanoCancelamento(k: Pick<Cancelamento, "condominio" | "plano">): string {
  if (!k.plano) return `${k.condominio} · sem plano`;
  return `${k.condominio}${k.plano.inicio ? ` · desde ${mesAno(k.plano.inicio)}` : ""} · ${reais(k.plano.valor)} ${por(k.plano.ciclo)}`;
}

/** "30 dias: último dia 23/11/2026, sem multa (N.1)". */
export const textoUltimoDia = (k: Pick<Cancelamento, "avisoDias" | "ultimoDia">) => `${k.avisoDias} dias: último dia ${data(k.ultimoDia)}, sem multa (N.1)`;

/** A nota da janela 347: o que acontece se confirmar. */
export const textoSeConfirmar = (k: Pick<Cancelamento, "ultimoDia">) =>
  `Se confirmar, a exportação completa do histórico fica pronta para o síndico e o acesso continua até ${diaMes(k.ultimoDia)}. Este motivo é de cancelamento, separado do motivo de perda do funil.`;

/** A linha de um pedido na aba Cancelamentos. */
export function detalheCancelamento(k: Cancelamento): string {
  const partes = [`Pedido em ${data(k.pedidoEm.slice(0, 10))}`];
  if (k.motivo) partes.push(nomeMotivoCancelamento(k.motivo));
  if (k.situacao === "PEDIDO" || k.situacao === "EM_RETENCAO" || k.situacao === "CONFIRMADO") partes.push(`último dia ${data(k.ultimoDia)}`);
  if (k.situacao === "ENCERRADO") partes.push(`saiu em ${data(k.ultimoDia)}`);
  if (k.situacao === "CONFIRMADO" && !k.exportacaoPedida) partes.push("sem síndico ativo para a exportação");
  return partes.join(" · ");
}

/** "Pedido por Ana Ribeiro · 24/10 11:20" (Brasília). */
export function textoPedidoPor(k: Pick<Cancelamento, "pedidoPor" | "pedidoEm">): string {
  const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(new Date(k.pedidoEm)).replace(",", "");
  return `${k.pedidoPor ?? "Dado apagado (LGPD)"} · ${quando}`;
}

/** Os clientes que podem pedir cancelamento ou receber sinal: os ativos (sem pedido aberto). */
export const clientesAtivos = (lista: ClienteRenovacao[]) => lista.filter((c) => c.situacao === "ATIVO");

/** O número de cada aba, como o banco conta. */
export const contagemAba = (d: Pick<TelaRenovacoes, "contagens">, aba: AbaRenovacoes) =>
  ({ REAJUSTE: d.contagens.renovacoes, RISCO: d.contagens.riscos, EXPANSAO: d.contagens.expansoes, CANCELAMENTOS: d.contagens.cancelamentos })[aba];

/** O selo do cartão Risco: "2 clientes". */
export const textoClientesRisco = (n: number) => plural(n, "cliente", "clientes");
