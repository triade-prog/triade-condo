// Renovações nas telas (0311, R17.7; CM-30, CM-31 e CM-32; quadros 346, 347 e 335): os tipos do que a
// api-console devolve, as rotas, as quatro abas e os textos de cada linha. O valor com reajuste, o
// último dia e quem pode são do banco; aqui só se escreve. O Comercial vê o nome do cliente e o plano,
// nunca os dados do condomínio (CM-11). Da R17.7c (0318; quadros 487 a 491): desfazer o cancelamento
// antes do último dia, reativar pelo aditivo de retorno depois dele e as assinaturas dos aditivos pelo
// gov.br (CM-13), com os tipos novos declarados aqui até a lista entrar em @triade/domain.

import {
  cpfValido, ETAPAS_EXPANSAO, MOTIVOS_CANCELAMENTO, SITUACOES_CANCELAMENTO, TEXTO_INDICE_A_DEFINIR, TIPOS_EXPANSAO, TIPOS_RISCO, textoAvisoReajuste, valeDesde,
  type CanalAviso, type EtapaExpansao, type MotivoCancelamento, type OrigemRisco, type SituacaoCancelamento, type SituacaoClienteRenovacao,
  type SituacaoEnvio, type SituacaoRenovacao, type TipoExpansao, type TipoRenovacao, type TipoRisco,
} from "@triade/domain";
import type { Tom } from "@triade/ui";
import { plural } from "../comum.tsx";
import { reais, somarMeses, textoMes } from "./painel.ts";
import type { Pessoa } from "./tipos.ts";

export const TELA_RENOVACOES = "/comercial/renovacoes";
/** A página Reativar (quadro 488). */
export const telaReativar = (cancelamento: string) => `/comercial/renovacoes/cancelamentos/${cancelamento}/reativar`;

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
  /** Um cancelamento sozinho, com `pode` e `hoje` (0318): a página Reativar abre um antigo que já saiu da lista. */
  cancelamento: (id: string) => `/v1/comercial/cancelamentos/${id}`,
  desfazer: (id: string) => `/v1/comercial/cancelamentos/${id}/desfazer`,
  reativar: (id: string) => `/v1/comercial/cancelamentos/${id}/reativar`,
  gerarRetorno: (id: string) => `/v1/comercial/cancelamentos/${id}/retorno/aditivo`,
  /** O PDF do aditivo (o gerado, ou o assinado mais recente) ou de um envio, para conferir no validador. */
  linkAditivoPdf: (aditivo: string, envio?: string) => `/v1/comercial/aditivos/${aditivo}/link?${envio ? `envio=${envio}&` : ""}baixar=1`,
  enviosAditivo: (aditivo: string) => `/v1/comercial/aditivos/${aditivo}/envios`,
  verificarEnvioAditivo: (id: string) => `/v1/comercial/envios-aditivo/${id}/verificar`,
  conferirEnvioAditivo: (id: string) => `/v1/comercial/envios-aditivo/${id}/conferir`,
  recusarEnvioAditivo: (id: string) => `/v1/comercial/envios-aditivo/${id}/recusar`,
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

/** As duas partes que assinam o aditivo pelo gov.br, nesta ordem. */
export type ParteAditivo = "CONDOMINIO" | "TRIADE";
export const PARTES_ADITIVO: readonly ParteAditivo[] = ["CONDOMINIO", "TRIADE"];

/** Um PDF assinado enviado pela equipe (como os do contrato, 0308). */
export interface EnvioAditivo {
  id: string;
  versao?: number;
  parte: ParteAditivo;
  situacao: SituacaoEnvio;
  enviadoEm: string;
  enviadoPor?: Pessoa;
  conferidoEm?: string;
  conferidoPor?: Pessoa;
  nome?: string;
  motivo?: string;
  motivoTexto?: string;
  automatica?: { temAssinatura: boolean; assinaturas?: number; eOGerado?: boolean; em: string };
  conferencia?: { assinanteNome?: string; cpfMascarado?: string; observacao?: string; por?: Pessoa; em: string };
  recusa?: { motivo: string; por?: Pessoa; em: string };
}

export type SituacaoAditivo = "GERANDO" | "PRONTO" | "SUBSTITUIDO";

export interface AditivoResumo {
  id: string;
  numero: number;
  /** REAJUSTE ou RETORNO (0318). */
  tipo?: "REAJUSTE" | "RETORNO";
  situacao: SituacaoAditivo;
  hash: string;
  geradoEm?: string;
  /** Os campos preenchidos («...» do modelo), já em texto; o CPF vem mascarado. */
  dados?: { campos?: Record<string, string> };
  /** Os PDFs assinados enviados pela equipe (R17.7b e R17.7c). */
  envios?: EnvioAditivo[];
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
  /** Desde quando o aviso pode ser registrado (90 dias antes do "avisar até"); só na calculada. */
  avisarDesde?: string;
  tipo: TipoRenovacao;
  situacao: SituacaoRenovacao;
  /** O plano de hoje; sem valor quando o plano está com o valor a definir. */
  hoje?: { valor?: number; ciclo: "MENSAL" | "ANUAL"; tabela?: string };
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
  situacao: SituacaoCancelamentoTela;
  decididoEm?: string;
  decididoPor?: Pessoa;
  decisaoNota?: string;
  lembrarEm?: string;
  exportacaoPedida?: boolean;
  /** Desfeito antes do último dia (quadro 487). */
  desfeitoEm?: string;
  desfeitoPor?: Pessoa;
  desfeitoNota?: string;
  /** Reativado depois do último dia, pelo aditivo de retorno (quadro 488). */
  reativadoEm?: string;
  reativadoPor?: Pessoa;
  /** O aditivo de retorno vigente (o substituído não vem). */
  retorno?: AditivoResumo;
  /**
   * A prévia do plano da volta, quando a API manda (opcional): a faixa pelas unidades ativas, o valor
   * da tabela cheia do dia e se a faixa é sob consulta (acima de 400, o valor vai no Gerar).
   */
  retornoPlano?: { unidades?: number; faixa?: string; valor?: number; sobConsulta?: boolean };
}

export interface ClienteRenovacao {
  id: string;
  condominio: string;
  contato?: string;
  plano?: PlanoCliente;
  situacao: SituacaoClienteRenovacao;
}

/** `GET /v1/comercial/cancelamentos/:id` (0318). */
export interface TelaCancelamento {
  cancelamento: Cancelamento;
  pode: TelaRenovacoes["pode"];
  hoje: string;
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
  pode: { editar: boolean; regra: boolean; confirmar: boolean; desfazer?: boolean; reativar?: boolean; assinar?: boolean };
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
/** "30/10" de um instante, no horário de Brasília. */
const quandoBr = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso));
/** "30/10/2026" de um instante, no horário de Brasília. */
const quandoAnoBr = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
/** "28/10 15:40" de um instante, no horário de Brasília. */
const quandoHoraBr = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(",", "");

/** "R$ 229,00" ou "R$ 129,00 · fundador". */
export function textoValorHoje(r: Pick<Renovacao, "hoje" | "semPlano">): string {
  if (!r.hoje) return "Sem plano";
  if (r.hoje.valor === undefined || r.hoje.valor === null) return "Valor a definir";
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
export function seloAviso(r: Pick<Renovacao, "situacao" | "avisarAte" | "avisarDesde" | "valeDesde">, hoje: string, inicioDias = 15): { texto: string; tom: Tom } {
  if (r.situacao === "ATRASADO") return { texto: `Aviso atrasado: era até ${diaMes(r.avisarAte)}`, tom: "erro" };
  if (r.situacao === "AVISAR" && cedoParaAvisar(r, hoje)) return { texto: `Aviso a partir de ${diaMes(r.avisarDesde!)}`, tom: "neutro" };
  if (r.situacao === "AVISAR") return { texto: `Avisar até ${diaMes(r.avisarAte)}`, tom: diasEntre(hoje, r.avisarAte) <= inicioDias ? "atencao" : "neutro" };
  if (r.situacao === "AVISO_ENVIADO") return { texto: "Aviso enviado", tom: "ok" };
  if (r.situacao === "APLICADO") return { texto: `Valor novo desde ${r.valeDesde ? mesAno(r.valeDesde) : "a competência"}`, tom: "ok" };
  if (r.situacao === "SUPERADO") return { texto: "Superado: o plano mudou antes", tom: "neutro" };
  return { texto: "Renovado sem reajuste", tom: "neutro" };
}

/** Antes do "avisar desde", o aviso espera: o índice é o de perto da data (r2). */
export const cedoParaAvisar = (r: Pick<Renovacao, "avisarDesde">, hoje: string) => !!r.avisarDesde && r.avisarDesde > hoje;

/** O que dá para fazer na linha: registrar o aviso (só com valor calculado e a partir do "avisar desde"). */
export function podeAvisar(r: Pick<Renovacao, "id" | "novo" | "situacao" | "avisarDesde">, hoje: string): boolean {
  return !r.id && (r.situacao === "AVISAR" || r.situacao === "ATRASADO") && r.novo !== undefined && !cedoParaAvisar(r, hoje);
}

/** Renovar sem reajuste: da Administração (r6), com o valor do plano (r9) e no mesmo prazo do aviso. */
export function podeDispensar(r: Pick<Renovacao, "id" | "hoje" | "situacao" | "avisarDesde">, hoje: string): boolean {
  return !r.id && (r.situacao === "AVISAR" || r.situacao === "ATRASADO") && typeof r.hoje?.valor === "number" && !cedoParaAvisar(r, hoje);
}

/** A linha de baixo de uma renovação registrada: quando e por onde foi o aviso e desde quando vale. */
export function detalheRenovacao(r: Renovacao): string | null {
  if (r.situacao === "DISPENSADO") return r.dispensaMotivo ? `Sem reajuste: ${r.dispensaMotivo}` : null;
  if (!r.aviso) return null;
  const partes = [`Aviso em ${data(r.aviso.em)}`];
  if (r.situacao === "SUPERADO") partes.push("o plano mudou antes de valer; o valor avisado não entrou");
  else if (r.valeDesde) partes.push(`vale desde a competência ${mesAno(r.valeDesde)}`);
  if (r.aditivo) {
    const n = assinadasAditivo(r.aditivo);
    partes.push(r.aditivo.situacao === "PRONTO" ? `aditivo nº ${r.aditivo.numero}${n === 2 ? " assinado pelos dois" : n === 1 ? ", 1 de 2 assinaturas" : ""}` : "aditivo sendo montado");
  }
  return partes.join(" · ");
}

/** A regra em texto: "IPCA 4,8% (12 meses até outubro) · aviso 30 dias antes" ou a definir. */
export function textoRegra(r: RegraReajusteTela): string {
  const aviso = `aviso ${r.prazoAvisoDias} dias antes do aniversário`;
  if (!r.definida || r.percentual === undefined) return `Índice ${TEXTO_INDICE_A_DEFINIR} · ${aviso}`;
  return `${r.indice} ${percentualBr(r.percentual)}${r.referencia ? ` (${r.referencia})` : ""} · ${aviso}`;
}

/** O texto sugerido do aviso, com o vale-desde que o banco vai calcular para o aviso nesta data. */
export function avisoSugerido(r: Renovacao, regra: RegraReajusteTela, cliente: ClienteRenovacao | undefined, avisoEm: string): string | null {
  if (!r.novo || !r.hoje || typeof r.hoje.valor !== "number") return null;
  return textoAvisoReajuste({
    contato: cliente?.contato, condominio: r.condominio, aniversario: r.aniversario, tipo: r.tipo, valorAtual: r.hoje.valor, valorNovo: r.novo.valor,
    ciclo: r.hoje.ciclo, indice: r.novo.indice, percentual: r.novo.percentual, referencia: r.novo.referencia,
    valeDesde: valeDesde(r.aniversario, avisoEm, regra.prazoAvisoDias, cliente?.plano?.diaVencimento),
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

/** As situações do pedido, com as da 0318: desfeito antes do último dia e reativado depois dele. */
export type SituacaoCancelamentoTela = SituacaoCancelamento | "DESFEITO" | "REATIVADO";
const SITUACOES_CANCELAMENTO_TELA: Record<SituacaoCancelamentoTela, string> = { ...SITUACOES_CANCELAMENTO, DESFEITO: "Desfeito", REATIVADO: "Reativado" };
export const TOM_CANCELAMENTO: Record<SituacaoCancelamentoTela, Tom> = {
  PEDIDO: "atencao", EM_RETENCAO: "andamento", FICOU: "ok", CONFIRMADO: "erro", ENCERRADO: "neutro", DESFEITO: "ok", REATIVADO: "ok",
};
export const nomeSituacaoCancelamento = (s: SituacaoCancelamentoTela) => SITUACOES_CANCELAMENTO_TELA[s] ?? s;

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

/** A linha de um pedido na aba Cancelamentos (quadro 490). Com o dia de hoje, o confirmado diz quanto falta. */
export function detalheCancelamento(k: Cancelamento, hoje?: string): string {
  const pedido = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(k.pedidoEm));
  const partes = [`Pedido em ${pedido}`];
  if (k.motivo) partes.push(nomeMotivoCancelamento(k.motivo));
  if (k.situacao === "PEDIDO" || k.situacao === "EM_RETENCAO" || k.situacao === "CONFIRMADO") partes.push(`último dia ${data(k.ultimoDia)}`);
  if (k.situacao === "CONFIRMADO" && hoje && k.ultimoDia >= hoje) partes.push(textoFaltam(k.ultimoDia, hoje));
  if (k.situacao === "ENCERRADO") partes.push(`saiu em ${data(k.ultimoDia)}`, "só consulta");
  if (k.situacao === "CONFIRMADO" && !k.exportacaoPedida) partes.push("sem síndico ativo para a exportação");
  if (k.situacao === "DESFEITO" && k.desfeitoEm) partes.push(`desfeito em ${quandoBr(k.desfeitoEm)}${k.desfeitoPor ? ` por ${k.desfeitoPor.nome}` : ""}`);
  if (k.situacao === "REATIVADO") partes.push(`saiu em ${data(k.ultimoDia)}`, k.reativadoEm ? `reativado em ${quandoAnoBr(k.reativadoEm)}${k.reativadoPor ? ` por ${k.reativadoPor.nome}` : ""}` : "reativado");
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

// ---------------------------------------------------------------------------------------------
// R17.7c (0318; quadros 487 a 491): desfazer antes do último dia, reativar depois dele pelo aditivo de
// retorno e as assinaturas dos aditivos pelo gov.br. O banco decide o que pode; a tela só escreve.

/** "faltam 24 dias", "falta 1 dia" ou "hoje é o último dia". */
export function textoFaltam(ultimoDia: string, hoje: string): string {
  const n = diasEntre(hoje, ultimoDia);
  if (n <= 0) return "hoje é o último dia";
  return n === 1 ? "falta 1 dia" : `faltam ${n} dias`;
}

/** O último dia já passou: a Plataforma é só consulta e a volta é por Reativar. */
export const passouUltimoDia = (k: Pick<Cancelamento, "situacao" | "ultimoDia">, hoje: string) =>
  k.situacao === "ENCERRADO" || (k.situacao === "CONFIRMADO" && k.ultimoDia < hoje);

/** Desfazer: só a Administração, só o confirmado e só até o último dia (quadro 487). */
export const podeDesfazer = (k: Pick<Cancelamento, "situacao" | "ultimoDia">, pode: Pick<TelaRenovacoes["pode"], "desfazer">, hoje: string) =>
  !!pode.desfazer && k.situacao === "CONFIRMADO" && k.ultimoDia >= hoje;

/** "28/10 15:40 por Carolina · motivo: síndico novo" (a linha Confirmado do quadro 487). */
export function textoConfirmado(k: Pick<Cancelamento, "decididoEm" | "decididoPor" | "motivo" | "motivoTexto">): string {
  const motivo = k.motivo === "OUTRO" && k.motivoTexto ? k.motivoTexto : k.motivo ? nomeMotivoCancelamento(k.motivo).toLowerCase() : null;
  const quando = k.decididoEm ? `${quandoHoraBr(k.decididoEm)}${k.decididoPor ? ` por ${k.decididoPor.nome}` : ""}` : "Confirmado";
  return motivo ? `${quando} · motivo: ${motivo}` : quando;
}

/** "23/11/2026 · faltam 24 dias · o acesso continua até lá"; depois do último dia, só consulta. */
export function textoUltimoDiaConfirmado(k: Pick<Cancelamento, "situacao" | "ultimoDia">, hoje: string): string {
  if (passouUltimoDia(k, hoje)) return `${data(k.ultimoDia)} · passou: desde o dia seguinte, a Plataforma é só consulta`;
  return `${data(k.ultimoDia)} · ${textoFaltam(k.ultimoDia, hoje)} · o acesso continua até lá`;
}

/** A linha Exportação do quadro 487. */
export const textoExportacao = (k: Pick<Cancelamento, "exportacaoPedida">) =>
  k.exportacaoPedida ? "Pedida para o síndico ativo na confirmação; fica com ele." : "Não foi pedida: não havia síndico ativo na confirmação.";

/** O que acontece ao desfazer (quadro 487). */
export const AO_DESFAZER = [
  "O último dia sai: o condomínio segue com tudo, sem nada para religar.",
  "O plano e a cobrança seguem como antes; nenhuma competência fica para trás.",
  "A comissão do parceiro, se houver, volta a contar como antes.",
  "A exportação já pedida continua com o síndico.",
  "O pedido fica como Desfeito, com quem desfez e a nota; o cliente pode pedir de novo depois.",
] as const;

/** O que volta ao reativar (quadro 488). */
export const AO_REATIVAR_VOLTA = [
  "Os módulos do plano, no modo completo.",
  "O mural, as etiquetas e os links que ainda estiverem na validade.",
  "O WhatsApp dos moradores, depois que a equipe conectar o número de novo.",
  "As rotinas, daqui para frente: prazos, preventivas, lembretes e comunicados programados.",
  "A cobrança, a partir da competência escolhida.",
] as const;

/** O que não volta (quadro 488). */
export const NAO_VOLTA = [
  "O que foi cancelado na fila de e-mail e WhatsApp depois do último dia.",
  "O preço de fundador.",
  "A comissão do parceiro antigo, a não ser com uma indicação nova.",
] as const;

/** No último dia, fecha sozinho à meia-noite (quadro 490). */
export const FECHA_NO_ULTIMO_DIA = [
  "A Plataforma vira só consulta para o síndico e a equipe do prédio.",
  "O WhatsApp dos moradores: a mensagem que chegar não vira pedido e não tem resposta.",
  "As filas de e-mail e WhatsApp: o que estiver para sair é cancelado com o motivo.",
  "O mural, as etiquetas e todos os links públicos, que mostram a página de fora do ar.",
  "As rotinas do condomínio: comunicado programado não publica, preventiva não abre, enquete não manda lembrete.",
  "A cobrança: nenhuma competência depois do último dia.",
] as const;

/** E fica (quadro 490). */
export const FICA_DEPOIS = [
  "A consulta e a exportação completa para o síndico.",
  "A privacidade (pedidos do titular) e o suporte.",
  "O link para parar de receber e-mail.",
  "A retenção e a anonimização no prazo de cada dado (F0.11).",
] as const;

/** 'Desfeito em 30/10 por Carolina: "Ana Ribeiro, síndica, pelo WhatsApp comercial". O contrato de hoje continua.' (quadro 491). */
export function textoDesfeito(k: Pick<Cancelamento, "desfeitoEm" | "desfeitoPor" | "desfeitoNota">): string {
  const quem = `Desfeito${k.desfeitoEm ? ` em ${quandoBr(k.desfeitoEm)}` : ""}${k.desfeitoPor ? ` por ${k.desfeitoPor.nome}` : ""}`;
  return `${quem}: ${k.desfeitoNota ? `"${k.desfeitoNota}"` : "a nota foi apagada (LGPD)"}. O contrato de hoje continua.`;
}

/** "Reativado em 05/03/2027 por Carolina pelo aditivo nº 2, com a cobrança desde a competência 03/2027." (quadro 491). */
export function textoReativado(k: Pick<Cancelamento, "reativadoEm" | "reativadoPor" | "retorno">): string {
  const vale = k.retorno?.dados?.campos?.vale_desde;
  return `Reativado${k.reativadoEm ? ` em ${quandoAnoBr(k.reativadoEm)}` : ""}${k.reativadoPor ? ` por ${k.reativadoPor.nome}` : ""}`
    + `${k.retorno ? ` pelo aditivo nº ${k.retorno.numero}` : ""}${vale ? `, com a cobrança desde a competência ${vale}` : ""}.`
    + " Se havia reconquista aberta, ela ficou Ganha.";
}

// As assinaturas pelo gov.br (como o contrato, 0308): primeiro o condomínio, depois a TRÍADE, sobre o mesmo arquivo.

const maisNovos = (envios: EnvioAditivo[] | undefined) => [...(envios ?? [])].sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
/** O envio conferido de uma parte. */
export const envioConferido = (a: Pick<AditivoResumo, "envios"> | undefined, parte: ParteAditivo) =>
  maisNovos(a?.envios).find((e) => e.parte === parte && e.situacao === "CONFERIDO");
/** O envio que a equipe pode conferir ou recusar. */
export const envioParaConferir = (a: Pick<AditivoResumo, "envios"> | undefined, parte: ParteAditivo) =>
  maisNovos(a?.envios).find((e) => e.parte === parte && (e.situacao === "A_CONFERIR" || e.situacao === "NAO_E_O_GERADO"));
/** "1 de 2". */
export const assinadasAditivo = (a: Pick<AditivoResumo, "envios"> | undefined) => PARTES_ADITIVO.filter((p) => envioConferido(a, p)).length;

/** Pode enviar o PDF assinado desta parte: o aditivo pronto, nada esperando conferência e na ordem. */
export function podeEnviarParte(a: Pick<AditivoResumo, "situacao" | "envios">, parte: ParteAditivo): boolean {
  if (a.situacao !== "PRONTO" || envioConferido(a, parte) || envioParaConferir(a, parte)) return false;
  return parte === "CONDOMINIO" || !!envioConferido(a, "CONDOMINIO");
}

export interface EstadoParte { texto: string; tom: Tom; apoio: string }

/** O selo e a linha de baixo de cada parte (quadro 488). */
export function estadoParte(a: Pick<AditivoResumo, "situacao" | "envios">, parte: ParteAditivo): EstadoParte {
  const feito = envioConferido(a, parte);
  const por = (e: EnvioAditivo) => `${e.enviadoPor ? ` por ${e.enviadoPor.nome}` : ""} em ${quandoHoraBr(e.enviadoEm)}`;
  if (feito) {
    const quem = feito.conferidoPor ?? feito.conferencia?.por;
    const quando = feito.conferidoEm ?? feito.conferencia?.em;
    return { texto: "Conferida", tom: "ok", apoio: `PDF assinado enviado aqui${por(feito)} · conferido${quem ? ` por ${quem.nome}` : ""}${quando ? ` em ${quandoHoraBr(quando)}` : ""}.` };
  }
  const ultimo = maisNovos(a.envios).find((e) => e.parte === parte && e.situacao !== "SUBSTITUIDO" && e.situacao !== "ENVIANDO");
  if (ultimo?.situacao === "A_CONFERIR") return { texto: "Falta conferir", tom: "atencao", apoio: `PDF assinado enviado${por(ultimo)}. Falta conferir no validar.iti.gov.br.` };
  if (ultimo?.situacao === "NAO_E_O_GERADO") {
    return { texto: "Não é o aditivo gerado", tom: "atencao", apoio: ultimo.motivoTexto ?? "O conteúdo assinado é diferente do PDF gerado. O envio fica guardado, mas não conta." };
  }
  if (ultimo?.situacao === "RECUSADO_NA_HORA") {
    return { texto: ultimo.motivo === "SEM_ASSINATURA" ? "Sem assinatura" : "Arquivo inválido", tom: "erro", apoio: ultimo.motivoTexto ?? "O envio não serviu; é preciso enviar de novo." };
  }
  if (ultimo?.situacao === "RECUSADO") {
    return { texto: "Recusada", tom: "erro", apoio: `Recusada${ultimo.recusa?.por ? ` por ${ultimo.recusa.por.nome}` : ""}: ${ultimo.recusa?.motivo ?? ultimo.motivoTexto ?? "sem motivo"}. Envie de novo.` };
  }
  if (parte === "CONDOMINIO") {
    return { texto: "Aguardando", tom: "neutro",
      apoio: "O síndico baixa o PDF, assina pelo gov.br e devolve pelo WhatsApp comercial ou por e-mail. A equipe envia aqui o arquivo que ele mandou." };
  }
  if (envioConferido(a, "CONDOMINIO")) {
    return { texto: "Sua vez", tom: "atencao", apoio: "Baixe o PDF já assinado pelo condomínio, assine no gov.br e envie aqui. O arquivo final leva as duas assinaturas." };
  }
  return { texto: "Espera o condomínio", tom: "neutro", apoio: "Depois da assinatura do condomínio conferida, a TRÍADE assina sobre o mesmo arquivo." };
}

/**
 * O que falta para reativar (quadro 491): o aditivo de retorno gerado e as duas assinaturas
 * conferidas. Nulo quando já dá.
 */
export function faltaParaReativar(k: Pick<Cancelamento, "situacao" | "retorno">, modeloEmUso: boolean): string | null {
  if (k.situacao === "REATIVADO") return "Este cliente já foi reativado.";
  if (k.situacao !== "ENCERRADO") return "Reativar é depois do último dia; antes dele, desfaça o cancelamento.";
  const a = k.retorno;
  if (!a || a.situacao === "SUBSTITUIDO") return modeloEmUso ? "Falta gerar o aditivo de retorno." : "Falta pôr em uso o modelo de retorno e gerar o aditivo.";
  if (a.situacao === "GERANDO") return "O PDF do aditivo não ficou pronto. Gere de novo.";
  const faltam = PARTES_ADITIVO.flatMap((p) => {
    const quem = p === "CONDOMINIO" ? "do condomínio" : "da TRÍADE";
    if (envioConferido(a, p)) return [];
    return [envioParaConferir(a, p)?.situacao === "A_CONFERIR" ? `conferir a assinatura ${quem}` : `a assinatura ${quem}`];
  });
  return faltam.length ? `Falta: ${faltam.join(" e ")}.` : null;
}

/** As competências da volta: deste mês até 6 meses depois ("2026-11-01"). */
export function competenciasRetorno(hoje: string): { valor: string; texto: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const m = somarMeses(hoje.slice(0, 7), i);
    return { valor: `${m}-01`, texto: textoMes(m, true) };
  });
}

/** As linhas do aditivo de retorno gerado (quadro 488), dos campos que o banco preencheu. */
export function linhasRetorno(campos: Record<string, string> | undefined): [string, string][] {
  if (!campos) return [];
  const c = campos;
  const linhas: [string, string | null][] = [
    ["Contrato", c.contrato ? `nº ${c.contrato}${c.data_contrato ? `, de ${c.data_contrato}` : ""}${c.ultimo_dia ? ` · encerrado em ${c.ultimo_dia}` : ""}` : null],
    ["Representante", c.representante ? `${c.representante}${c.cpf_representante ? ` · CPF ${c.cpf_representante}` : ""}` : null],
    ["Plano", c.plano ? `${c.plano}${c.valor_mensal ? ` · ${c.valor_mensal}` : ""}` : null],
    ["Volta", `Acesso a partir da reativação${c.vale_desde ? ` · cobrança desde a competência ${c.vale_desde}` : ""}`],
  ];
  return linhas.filter((l): l is [string, string] => l[1] !== null);
}

export interface DadosRetorno {
  representante: string;
  cpf: string;
  competencia: string;
  ciclo: "MENSAL" | "ANUAL" | null;
  valorCentavos: number | null;
  motivo: string;
}

/** Os campos que faltam antes de gerar o aditivo de retorno (o banco confere de novo). */
export function problemasRetorno(d: DadosRetorno, o: { deNovo: boolean; sobConsulta: boolean }): string[] {
  return [
    ...(d.representante.trim().length < 3 ? ["representante"] : []),
    ...(!cpfValido(d.cpf) ? ["cpf"] : []),
    ...(!/^\d{4}-\d{2}-01$/.test(d.competencia) ? ["competencia"] : []),
    ...(!d.ciclo ? ["ciclo"] : []),
    ...(o.sobConsulta && !(d.valorCentavos && d.valorCentavos > 0) ? ["valorCentavos"] : []),
    ...(o.deNovo && (d.motivo.trim().length < 3 || d.motivo.trim().length > 300) ? ["motivo"] : []),
  ];
}

/** O corpo de Gerar (C3 e D): o valor só na faixa sob consulta; o motivo só ao gerar de novo. */
export function corpoRetorno(d: DadosRetorno, o: { deNovo: boolean; sobConsulta: boolean }) {
  return {
    representante: d.representante.trim(), cpf: d.cpf.replace(/\D/g, ""), competencia: d.competencia, ciclo: d.ciclo,
    ...(o.sobConsulta && d.valorCentavos ? { valorCentavos: d.valorCentavos } : {}),
    ...(o.deNovo ? { motivo: d.motivo.trim() } : {}),
  };
}

// Modelos › Aditivo: as duas partes, cada uma com os seus campos (0318, C1).

export type TipoModeloAditivo = "REAJUSTE" | "RETORNO";
export const TIPOS_MODELO_ADITIVO: Record<TipoModeloAditivo, string> = { REAJUSTE: "Reajuste", RETORNO: "Retorno" };

/** Os campos do aditivo de retorno, entre « e » (0318). */
export const CAMPOS_RETORNO = {
  condominio: "Nome do condomínio",
  cnpj: "CNPJ do condomínio",
  representante: "Quem assina pelo condomínio",
  cpf_representante: "CPF de quem assina pelo condomínio",
  contrato: "Número do contrato",
  data_contrato: "Data de início do contrato",
  ultimo_dia: "Último dia antes da saída",
  plano: "Plano da volta (faixa e ciclo)",
  valor_mensal: "Valor do plano da volta",
  vale_desde: "Competência em que a cobrança volta",
} as const;

/** Os campos errados de um texto de modelo: os que não existem na lista e as aspas soltas. */
export function camposErradosModelo(textoModelo: string, campos: readonly string[]): string[] {
  const errados = new Set<string>();
  for (const m of textoModelo.matchAll(/«([^«»]*)»/g)) if (!campos.includes(m[1]!)) errados.add(`«${m[1]}»`);
  const resto = textoModelo.replace(/«[^«»]*»/g, "");
  for (const x of ["«", "»"]) if (resto.includes(x)) errados.add(x);
  return [...errados].sort();
}

/** O texto inicial de uma versão nova do aditivo de retorno, para o advogado ajustar. */
export const TEXTO_INICIAL_RETORNO =
  "Aditivo de retorno ao contrato «contrato» do «condominio», CNPJ «cnpj», assinado em «data_contrato».\n\n"
  + "O contrato terminou em «ultimo_dia», depois do cancelamento pedido pelo condomínio. As partes combinam a volta: o «condominio», "
  + "representado por «representante», CPF «cpf_representante», passa ao plano «plano», por «valor_mensal».\n\n"
  + "A cobrança volta a partir da «vale_desde». As outras cláusulas do contrato continuam como estão.";
