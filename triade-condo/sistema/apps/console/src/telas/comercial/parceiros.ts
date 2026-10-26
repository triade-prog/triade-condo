// Parceiros e o extrato da comissão nas telas (0310, R17.6; CM-22, quadro 339, O.1): os tipos que
// a api-console devolve, as rotas, as abas da lista, o texto da regra e o extrato em PDF. A conta
// da comissão é do banco; aqui só se mostra. O pagamento é feito fora do sistema e só registrado.

import { SITUACOES_COMISSAO, TEXTO_PAGAMENTO_FORA, TIPOS_PARCEIRO, type SituacaoComissao, type TipoParceiro } from "@triade/domain";
import { reais, textoMes } from "./painel.ts";
import { slug, type Documento } from "./propostas.ts";

export interface RegraComissao {
  percentual: number;
  /** Vazio: enquanto o prédio for cliente. */
  prazoMeses?: number | null;
  versao: number;
  alteradoEm?: string;
  alteradoPor?: string | null;
}

export interface ParceiroLinha {
  id: string;
  versao: number;
  tipo: TipoParceiro;
  nome: string;
  whatsapp?: string;
  email?: string;
  cnpj?: string;
  observacao?: string;
  ativo: boolean;
  inativadoEm?: string;
  anonimizado: boolean;
  criadoEm: string;
  indicacoes: number;
  indicacoesMes: number;
  ultimaIndicacaoEm?: string;
  prediosAtivos: number;
  comissaoMes: number;
  pagoMes?: { valor: number; pagoEm: string };
  semIndicacao90?: boolean;
}

export interface TelaParceiros {
  mes: string;
  regra: RegraComissao;
  parceiros: ParceiroLinha[];
  podeEditar: boolean;
  podeComissao: boolean;
  podeApagar: boolean;
}

export interface LinhaExtrato {
  comissaoId: string;
  versao: number;
  interessadoId: string;
  condominio: string;
  desde: string;
  mensalidade: number;
  /** Nulo: sem comissão no mês (ainda não começou, prazo acabou ou deixou de ser cliente). */
  comissao?: number | null;
  situacao: SituacaoComissao;
  percentual: number;
  prazoMeses?: number;
  semComissaoDesde?: string;
  motivo?: string;
}

export interface ExtratoParceiro {
  parceiro: ParceiroLinha;
  mes: string;
  mesTexto?: string;
  linhas: LinhaExtrato[];
  total: number;
  regra: RegraComissao;
  pago?: { valor: number; calculado: number; pagoEm: string; observacao?: string; registradoEm: string; registradoPor?: string };
  diferenca?: number;
  indicacoes: { id: string; condominio: string; etapa: string; criadoEm: string }[];
  podeComissao: boolean;
}

const consulta = (mes?: string | null) => (mes ? `?mes=${encodeURIComponent(mes)}` : "");

export const ROTAS_PARCEIROS = {
  lista: (mes?: string | null) => `/v1/comercial/parceiros${consulta(mes)}`,
  novo: "/v1/comercial/parceiros",
  parceiro: (id: string) => `/v1/comercial/parceiros/${id}`,
  indicar: (id: string) => `/v1/comercial/parceiros/${id}/indicar`,
  extrato: (id: string, mes?: string | null) => `/v1/comercial/parceiros/${id}/extrato${consulta(mes)}`,
  pagamentos: (id: string) => `/v1/comercial/parceiros/${id}/pagamentos`,
  apagar: (id: string) => `/v1/comercial/parceiros/${id}/apagar`,
  regra: "/v1/comercial/comissao/regra",
  encerrar: (comissaoId: string) => `/v1/comercial/comissoes/${comissaoId}/encerrar`,
};

export const TELAS_PARCEIROS = {
  lista: "/comercial/parceiros",
  parceiro: (id: string, mes?: string | null) => `/comercial/parceiros/${id}${consulta(mes)}`,
};

export type AbaParceiros = "ATIVOS" | "MES" | "SEM_INDICACAO" | "INATIVOS";

/** As abas do quadro 339: ativos, com indicação no mês, sem indicação há 90 dias e inativos. */
export function filtrarParceiros(lista: ParceiroLinha[], aba: AbaParceiros): ParceiroLinha[] {
  if (aba === "ATIVOS") return lista.filter((p) => p.ativo);
  if (aba === "MES") return lista.filter((p) => p.indicacoesMes > 0);
  if (aba === "SEM_INDICACAO") return lista.filter((p) => p.ativo && p.semIndicacao90);
  return lista.filter((p) => !p.ativo);
}

export function contarAbas(lista: ParceiroLinha[]): Record<AbaParceiros, number> {
  return {
    ATIVOS: filtrarParceiros(lista, "ATIVOS").length,
    MES: filtrarParceiros(lista, "MES").length,
    SEM_INDICACAO: filtrarParceiros(lista, "SEM_INDICACAO").length,
    INATIVOS: filtrarParceiros(lista, "INATIVOS").length,
  };
}

/** "10%" ou "12,5%". */
export function textoPercentual(p: number): string {
  return `${p.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** As linhas da regra (quadro 339). */
export function linhasRegra(r: RegraComissao): [string, string][] {
  return [
    ["Quanto", `${textoPercentual(r.percentual)} da mensalidade de cada prédio ativo`],
    ["Por quanto tempo", r.prazoMeses ? `Os primeiros ${r.prazoMeses} meses de cada prédio` : "Enquanto o prédio for cliente"],
    ["Pagamento", "Fora do sistema; marcar como pago guarda quem e quando"],
  ];
}

export const nomeTipo = (t: TipoParceiro) => TIPOS_PARCEIRO[t] ?? t;
export const nomeSituacaoComissao = (s: SituacaoComissao) => SITUACOES_COMISSAO[s] ?? s;

/** "08/2026", como o quadro mostra o "Desde". */
export function mesCurto(data: string): string {
  const [a, m] = data.slice(0, 7).split("-");
  return `${m}/${a}`;
}

/** A célula da comissão: o valor, ou o motivo de não ter (o "—" do perdido). */
export function textoComissaoLinha(l: LinhaExtrato): string {
  if (l.comissao !== undefined && l.comissao !== null) return reais(l.comissao);
  return l.situacao === "ATIVA" ? "—" : `— (${nomeSituacaoComissao(l.situacao).toLowerCase()})`;
}

/** O título da coluna do quadro: "10% no mês" (a regra de cada prédio fica congelada; varia, "Comissão"). */
export function tituloColunaComissao(e: Pick<ExtratoParceiro, "linhas">): string {
  const ps = [...new Set(e.linhas.map((l) => l.percentual))];
  return ps.length === 1 ? `${textoPercentual(ps[0]!)} no mês` : "Comissão no mês";
}

/** O que foi pago contra o calculado: "Pago R$ 45,80 em 05/11/2026" e a diferença, quando há. */
export function textoPagamento(e: Pick<ExtratoParceiro, "pago" | "diferenca">): string {
  if (!e.pago) return "Ainda não registrado como pago.";
  const quando = e.pago.pagoEm.slice(0, 10).split("-").reverse().join("/");
  const base = `Pago ${reais(e.pago.valor)} em ${quando}${e.pago.registradoPor ? `, registrado por ${e.pago.registradoPor}` : ""}.`;
  if (!e.diferenca) return base;
  return `${base} ${e.diferenca > 0 ? `Falta ${reais(e.diferenca)}` : `Pago a mais: ${reais(-e.diferenca)}`} em relação ao calculado hoje.`;
}

/** O extrato do mês em PDF (quadro 339, "Baixar o extrato"): a mesma tabela da tela. */
export function documentoExtrato(e: ExtratoParceiro): Documento {
  const mes = e.mesTexto ?? textoMes(e.mes);
  const linhas = e.linhas.map((l) => [l.condominio, mesCurto(l.desde), reais(l.mensalidade), textoComissaoLinha(l)]);
  return {
    titulo: `Extrato de ${mes} · ${e.parceiro.nome}`,
    cabecalho: `${e.parceiro.nome} · Extrato da comissão`,
    principal: `Extrato de ${mes}`,
    apoio: `${nomeTipo(e.parceiro.tipo)} · ${e.linhas.length === 1 ? "1 prédio" : `${e.linhas.length} prédios`} indicados que viraram cliente`,
    blocos: [
      { tipo: "tabela", cabecalho: ["Prédio", "Desde", "Mensalidade", tituloColunaComissao(e)], linhas: linhas.length ? linhas : [["Nenhum prédio cliente neste mês", "", "", ""]] },
      { tipo: "destaque", rotulo: "Total do mês", valor: reais(e.total) },
      { tipo: "pares", linhas: [...linhasRegra(e.regra), ["Situação", textoPagamento(e)]] },
      { tipo: "paragrafo", texto: TEXTO_PAGAMENTO_FORA, suave: true },
    ],
    nomeArquivo: `extrato-${slug(e.parceiro.nome)}-${e.mes}.pdf`,
  };
}
