// Painel comercial, janelas do condomínio e o cartão do Comercial no Início (0309, R17.5; quadros
// 334 a 336, CM-10, CM-18, CM-04): os tipos do que a api-console devolve e os textos que as telas
// mostram. As contas são do banco; aqui só se escreve.

import {
  dinheiro, ETAPAS_COMERCIAL, formatar, mostrarDataSemHora, MOTIVOS_PERDA, ORIGENS_COMERCIAL, percentual, TIPOS_JANELA,
  type EtapaComercial, type MotivoInicioComercial, type MotivoPerda, type OrigemComercial, type SituacaoJanela, type TipoJanela,
} from "@triade/domain";
import type { Tom } from "@triade/ui";
import { plural } from "../comum.tsx";
import type { Pessoa } from "./tipos.ts";

export const ROTAS_PAINEL = {
  painel: (mes?: string | null) => (mes ? `/v1/comercial/painel?mes=${mes}` : "/v1/comercial/painel"),
  meta: "/v1/comercial/painel/meta",
  inicio: "/v1/comercial/inicio",
  janelas: (id: string) => `/v1/comercial/interessados/${id}/janelas`,
  tratar: (id: string) => `/v1/comercial/interessados/${id}/janelas/tratar`,
  sindicoNovo: (id: string) => `/v1/comercial/interessados/${id}/sindico-novo`,
};

export interface MetaMes {
  mes: string;
  herdada: boolean;
  versao?: number;
  total: number;
  porPessoa: { pessoa: Pessoa; centavos: number }[];
  alteradoEm: string;
  alteradoPor?: Pessoa;
}

export interface PainelComercial {
  mes: string;
  mesAtual: boolean;
  meta?: MetaMes;
  podeMudarMeta: boolean;
  equipe: Pessoa[];
  novos: number;
  funil: { etapa: EtapaComercial; chegaram: number }[];
  porOrigem: { origem: OrigemComercial; novos: number; ganhos: number }[];
  primeiroRetorno: { total: number; noPrazo: number; foraDoPrazo: number; aguardando: number; medianaMinutosUteis?: number; site: { total: number; noPrazo: number } };
  ganhos: { quantos: number; novoMrr: number; semValor: number; cicloMedioDias?: number };
  perdas: { quantos: number; motivos: { motivo: MotivoPerda; quantos: number }[] };
  semResposta: number;
  porPessoa: { pessoa: Pessoa; atividades: number; ganhos: number; novoMrr: number; meta?: number }[];
  concorrentes: { nome: string; disputas: number; ganhamos: number; perdemosParaEle: number }[];
  agora: {
    abertos: number;
    porEtapa: { etapa: EtapaComercial; quantos: number; probabilidade: number }[];
    previsao: { centavos: number; comValor: number; semValor: number };
    parados: number;
    atrasados: number;
    propostasVencendo: { propostaId: string; interessadoId: string; condominio: string; numero: number; validoAte: string }[];
    vencendoDias: number;
    vagasFundador: { total: number; ocupadas: number; livres: number };
  };
}

export interface JanelaCondominio {
  tipo: TipoJanela;
  data: string;
  de: string;
  ate?: string;
  situacao: SituacaoJanela;
  tratada: boolean;
  tratadaEm?: string;
  tratadaPor?: Pessoa;
  pedeAtencao: boolean;
}

export interface JanelasFicha {
  id: string;
  versao: number;
  etapa: EtapaComercial;
  janelas: JanelaCondominio[];
  sindicoNovo?: { desde: string; registradoEm: string; registradoPor?: Pessoa; tratadaEm?: string };
  naoContatar: boolean;
  dias: { assembleiaDe: number; assembleiaAte: number; mandato: number; fidelidade: number };
  podeEditar: boolean;
}

export interface ItemInicioComercial {
  id: string;
  condominio: string;
  etapa: EtapaComercial;
  motivo: MotivoInicioComercial;
  responsavel?: Pessoa;
  meu: boolean;
  quando?: string;
  tarefa?: string;
  diasParado?: number;
  janela?: JanelaCondominio;
  outros: number;
}

export interface InicioComercial {
  total: number;
  contagens: { primeiroRetorno: number; atrasados: number; parados: number; janelas: number };
  itens: ItemInicioComercial[];
  max: number;
  podeEditar: boolean;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10" → "outubro de 2026"; com maiúscula para o título. */
export function textoMes(mes: string, maiuscula = false): string {
  const [a, m] = mes.split("-").map(Number);
  const t = `${MESES[(m ?? 1) - 1]} de ${a}`;
  return maiuscula ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** O mês que vem depois (ou antes, com n negativo). */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = (a ?? 0) * 12 + ((m ?? 1) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Os meses do seletor: do mês atual 11 para trás e o próximo, para pôr a meta antes de começar. */
export function mesesDoSeletor(atual: string): { valor: string; texto: string }[] {
  const lista = [{ valor: somarMeses(atual, 1), texto: `${textoMes(somarMeses(atual, 1), true)} (próximo)` }];
  for (let i = 0; i < 12; i++) lista.push({ valor: somarMeses(atual, -i), texto: textoMes(somarMeses(atual, -i), true) });
  return lista;
}

export const reais = (centavos: number) => formatar(dinheiro(centavos));
const data = (d: string) => mostrarDataSemHora(d);
const diaMes = (d: string) => mostrarDataSemHora(d).slice(0, 5);

/** O cartão Novo MRR: "meta R$ 1.000,00 · 69%" ou o que falta para ter meta. */
export function textoMeta(p: Pick<PainelComercial, "meta" | "ganhos">): string {
  if (!p.meta) return "sem meta para o mês";
  const pct = percentual(p.ganhos.novoMrr, p.meta.total);
  return `meta ${reais(p.meta.total)} · ${pct}%${p.meta.herdada ? " (a do mês anterior)" : ""}`;
}

/** "10 de 14" no primeiro retorno; sem novos, "—". */
export function textoPrimeiroRetorno(r: PainelComercial["primeiroRetorno"]): string {
  return r.total ? `${r.noPrazo} de ${r.total}` : "—";
}

export function apoioPrimeiroRetorno(r: PainelComercial["primeiroRetorno"]): string {
  const partes = ["meta interna (K.1)"];
  if (r.aguardando) partes.push(`${r.aguardando} no prazo ainda`);
  if (r.medianaMinutosUteis !== undefined) partes.push(`mediana ${duracaoUtil(r.medianaMinutosUteis)}`);
  return partes.join(" · ");
}

/** Minutos úteis em texto curto: "45 min", "3 h", "2 h 30 min". */
export function duracaoUtil(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** As barras do funil: quantos chegaram e o percentual sobre os novos. */
export function barrasFunil(p: Pick<PainelComercial, "funil" | "novos">): { etapa: EtapaComercial; texto: string; n: number; pct: number }[] {
  return p.funil.map((f) => ({ etapa: f.etapa, texto: ETAPAS_COMERCIAL[f.etapa], n: f.chegaram, pct: percentual(f.chegaram, p.novos) ?? 0 }));
}

export const nomeOrigemPainel = (o: OrigemComercial) => ORIGENS_COMERCIAL[o] ?? o;
export const nomeMotivo = (m: MotivoPerda) => MOTIVOS_PERDA[m] ?? m;

/** A nota das propostas vencendo: "Vence hoje", "Vence amanhã", "Vence 05/11". */
export function textoVence(validoAte: string, hoje: string): string {
  if (validoAte === hoje) return "Vence hoje";
  const amanha = new Date(`${hoje}T12:00:00Z`);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  return validoAte === amanha.toISOString().slice(0, 10) ? "Vence amanhã" : `Vence ${diaMes(validoAte)}`;
}

/** Uma janela em texto: "Assembleia ordinária em 28/11/2026 · aviso de 29/09 a 29/10". */
export function textoJanela(j: JanelaCondominio): string {
  if (j.tipo === "RETOMAR") return `Voltar a falar desde ${data(j.data)}`;
  if (j.tipo === "SINDICO_NOVO") return `Síndico novo desde ${data(j.data)}`;
  const quando = j.tipo === "ASSEMBLEIA" ? "em" : "até";
  const nome = TIPOS_JANELA[j.tipo];
  const aviso = j.situacao === "PASSOU" ? "a janela passou" : j.ate ? `aviso de ${diaMes(j.de)} a ${diaMes(j.ate)}` : `aviso desde ${diaMes(j.de)}`;
  return `${nome} ${quando} ${data(j.data)} · ${aviso}`;
}

export const TOM_JANELA: Record<SituacaoJanela, Tom> = { PROXIMA: "neutro", ABERTA: "atencao", PASSOU: "neutro" };

export function seloJanela(j: JanelaCondominio): { texto: string; tom: Tom } {
  if (j.situacao === "ABERTA" && j.tratada) return { texto: "Já visto", tom: "ok" };
  if (j.situacao === "ABERTA") return { texto: "Pede atenção", tom: "atencao" };
  if (j.situacao === "PROXIMA") return { texto: `Abre em ${diaMes(j.de)}`, tom: "neutro" };
  return { texto: "Passou", tom: "neutro" };
}

/** O selo de uma linha do Início (quadro 335). */
export function seloInicio(i: ItemInicioComercial): { texto: string; tom: Tom } {
  if (i.motivo === "PRIMEIRO_RETORNO") return { texto: "Primeiro retorno: meta passou", tom: "erro" };
  if (i.motivo === "ATRASADO") return { texto: "Atrasado", tom: "erro" };
  if (i.motivo === "PARADO") return { texto: `Parado · ${plural(i.diasParado ?? 0, "dia", "dias")}`, tom: "atencao" };
  if (i.janela?.tipo === "ASSEMBLEIA") return { texto: `Assembleia ${diaMes(i.janela.data)}`, tom: "atencao" };
  if (i.janela?.tipo === "MANDATO") return { texto: `Mandato acaba ${diaMes(i.janela.data)}`, tom: "atencao" };
  if (i.janela?.tipo === "FIDELIDADE") return { texto: `Fidelidade acaba ${diaMes(i.janela.data)}`, tom: "atencao" };
  if (i.janela?.tipo === "SINDICO_NOVO") return { texto: "Síndico novo", tom: "info" };
  return { texto: "Voltar a falar", tom: "info" };
}

/** A linha de baixo: a etapa e de quem é; "mais N" quando pede atenção por mais de um motivo. */
export function detalheInicio(i: ItemInicioComercial): string {
  const quem = i.meu ? "com você" : i.responsavel ? i.responsavel.nome : "sem responsável";
  const partes = [ETAPAS_COMERCIAL[i.etapa], quem];
  if (i.outros) partes.push(`mais ${plural(i.outros, "aviso", "avisos")}`);
  return partes.join(" · ");
}
