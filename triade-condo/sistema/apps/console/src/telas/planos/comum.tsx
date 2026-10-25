"use client";
// Peças de Planos e pagamentos no Console (0291; quadros 241 a 255 do canvas, aprovados em
// 23/10/2026): o que a API devolve, os selos do conjunto e da cobrança, a escolha em botões e o
// valor em reais lido sem ponto flutuante.

import type { ReactNode } from "react";
import { ErroDinheiro, lerReais, mostrarDataSemHora, mostrarValor, type CicloPlano, type EstadoConjunto, type SituacaoCobranca } from "@triade/domain";
import { Aviso, Botao, Icone, Selo, textoDoErro, type ErroApi, type NomeIcone, type Tom } from "@triade/ui";

export interface ConjuntoCliente {
  codigo: string;
  nome: string;
  base: boolean;
  resumo: string;
  telas: string[];
  modo: "COMPLETO" | "CONSULTA" | "FORA";
  estado: EstadoConjunto;
  contratado: boolean;
  contratoReferencia?: string;
  contratadoEm?: string;
  liberadoEm?: string;
  liberadoPor?: string;
  liberacaoReferencia?: string;
  testeAte?: string;
  testeMotivo?: string;
  suspensoEm?: string;
  suspensaoPorque?: string;
  suspensaoMotivo?: string;
  versao?: number;
}

export interface PlanoCliente {
  nome: string;
  unidadesDe?: number;
  unidadesAte?: number;
  valor?: number;
  ciclo?: "MENSAL" | "ANUAL";
  diaVencimento?: number;
  implantacaoValor?: number;
  implantacaoSemCobranca?: boolean;
  implantacaoReferencia?: string;
  inicioCompetencia?: string;
  /** De onde veio o valor (0295): a tabela de fundador, a cheia ou nulo, quando foi à mão. */
  tabelaOrigem?: TabelaEmUso;
  /** Na tabela de fundador: a competência em que o preço de fundador acaba. */
  fundadorAte?: string;
  desde: string;
  versao?: number;
}

export interface Cobranca {
  id: string;
  condominioId: string;
  cliente: string;
  tipo: "MENSALIDADE" | "IMPLANTACAO";
  competencia?: string;
  referencia?: string;
  /** Na implantação em mais de uma parcela: qual é e de quantas (0308). */
  parcela?: number;
  parcelas?: number;
  valor?: number;
  ajustes: number;
  devido?: number;
  conferido: number;
  aConferir: number;
  falta?: number;
  venceEm: string;
  situacao: SituacaoCobranca;
  emAtraso: boolean;
  diasDeAtraso?: number;
  versao: number;
}

export interface Recebimento {
  id: string;
  cobrancaId: string;
  estado: "A_CONFERIR" | "CONFERIDO" | "DEVOLVIDO";
  valor: number;
  recebidoEm: string;
  forma: string;
  referencia: string;
  registradoPor?: string;
  registradoEm: string;
  conferidoPor?: string;
  conferidoEm?: string;
  devolvidoMotivo?: string;
  versao: number;
  condominioId?: string;
  cliente?: string;
}

export interface PlanoDaFicha {
  plano?: PlanoCliente;
  unidadesAtivas: number;
  conjuntos: ConjuntoCliente[];
  cobrancas?: Cobranca[];
  permissoes: string[];
}

export const ICONE_CONJUNTO: Record<string, NomeIcone> = {
  ATENDIMENTO: "pedido", AGENDA: "calendario", MANUTENCAO: "ferramenta", VIDA: "convivio", COMUNICACAO_AMPLIADA: "megafone",
};

/** Hoje no horário de Brasília, "aaaa-mm-dd". */
export function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Teste que passou da data: o conjunto fica só para consultar. */
export const testeAcabou = (c: ConjuntoCliente) => c.estado === "TESTE" && c.modo !== "COMPLETO";

/** Os selos do conjunto: contratado e liberado separados (CF-11). */
export function SelosConjunto({ c }: { c: ConjuntoCliente }) {
  if (c.base) return <Selo tom="ok">Base · sempre incluída</Selo>;
  const contrato = c.contratado ? <Selo tom="andamento">Contratado</Selo> : null;
  if (c.estado === "LIBERADO") return <>{contrato}<Selo tom="ok">Liberado</Selo></>;
  if (c.estado === "TESTE" && !testeAcabou(c)) return <>{contrato}<Selo tom="info">{`Em teste até ${mostrarDataSemHora(c.testeAte!)}`}</Selo></>;
  if (c.estado === "SUSPENSO" || testeAcabou(c)) return <>{contrato}<Selo tom="neutro">{testeAcabou(c) ? "Teste encerrado" : "Suspenso"}</Selo></>;
  return c.contratado ? <>{contrato}<Selo tom="atencao">Falta liberar</Selo></> : <Selo tom="neutro">Fora do plano</Selo>;
}

export const TOM_COBRANCA: Record<SituacaoCobranca, Tom> = { A_DEFINIR: "neutro", ABERTA: "info", PARCIAL: "atencao", QUITADA: "ok" };

/** Escolha em botões (o "Por quê", o "Tipo", o "Como chegou"): um grupo de rádio. */
export function EscolhaBotoes<T extends string>({ nome, legenda, opcoes, valor, aoMudar, ajuda }: {
  nome: string; legenda: string; opcoes: { valor: T; texto: string }[]; valor: T | null; aoMudar: (v: T) => void; ajuda?: ReactNode;
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 t-apoio font-medium">{legenda}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <label key={o.valor} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-linha bg-superficie px-4 hover:border-violeta-300 has-checked:border-violeta-600 has-checked:bg-violeta-50 has-checked:font-semibold has-checked:text-violeta-700">
            <input type="radio" name={nome} value={o.valor} checked={valor === o.valor} onChange={() => aoMudar(o.valor)} className="sr-only" />
            {o.texto}
          </label>
        ))}
      </div>
      {ajuda ? <span className="t-apoio text-tinta-suave">{ajuda}</span> : null}
    </fieldset>
  );
}

/** O erro de uma janela: o motivo em texto e, no conflito de versão, como recarregar. */
export function ErroJanela({ erro, recarregar }: { erro: ErroApi; recarregar?: () => void }) {
  return (
    <Aviso tom="erro" papel="alert">
      {textoDoErro(erro)}
      {erro.codigo === "VERSION_CONFLICT" && recarregar ? (
        <span className="mt-2 block"><Botao variante="contorno" onClick={recarregar}>Carregar a versão nova</Botao></span>
      ) : null}
    </Aviso>
  );
}

export function RodapeJanela({ aoFechar, enviando, texto, icone = "check", perigo }: {
  aoFechar: () => void; enviando: boolean; texto: string; icone?: NomeIcone; perigo?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2 max-md:grid">
      <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
      <Botao type="submit" variante={perigo ? "perigo" : "primario"} disabled={enviando}><Icone nome={icone} />{enviando ? "Salvando…" : texto}</Botao>
    </div>
  );
}

/** Lê o valor digitado em reais: vazio é null; o que não for valor válido volta como erro. */
export function centavosDoCampo(texto: string): { centavos: number | null } | { erro: string } {
  if (!texto.trim()) return { centavos: null };
  try {
    const c = lerReais(texto).centavos;
    return c > 0 ? { centavos: c } : { erro: "Use um valor maior que zero." };
  } catch (e) {
    if (e instanceof ErroDinheiro) return { erro: "Escreva o valor em reais, como 129,90." };
    throw e;
  }
}

/** Centavos para o campo ("12990" → "129,90"). */
export function campoDosCentavos(c: number | null | undefined): string {
  if (c === null || c === undefined) return "";
  return `${Math.trunc(c / 100)},${String(c % 100).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------------------------
// Tabela de preços (0295; quadros 268 a 274, aprovados em 24/10/2026). Os tipos da tela ficam em
// camelCase e todo o mapeamento da api-console passa pelas funções abaixo: se um nome de campo
// mudar, muda só aqui. Valores sempre em centavos; campo ausente é "Valor a definir".

export type TabelaEmUso = "FUNDADOR" | "CHEIA";
/** A origem do plano no PUT: a tabela de fundador, a cheia ou o valor posto à mão. */
export type OrigemPlano = TabelaEmUso | "MANUAL";
export type ModeloConcorrente = "FIXO" | "FAIXA" | "POR_UNIDADE";

export const NOMES_TABELA: Record<TabelaEmUso, string> = { FUNDADOR: "Fundador", CHEIA: "Tabela cheia" };

/** Quantas mudanças o Histórico pede de cada vez (como as outras listas de histórico do Console). */
export const PAGINA_HISTORICO_PRECOS = 20;

export const ROTAS_PRECOS = {
  tabela: "/v1/precos",
  faixa: (codigo: string) => `/v1/precos/faixas/${codigo}`,
  parametros: "/v1/precos/parametros",
  concorrentes: "/v1/precos/concorrentes",
  concorrente: (id: string) => `/v1/precos/concorrentes/${id}`,
  arquivar: (id: string) => `/v1/precos/concorrentes/${id}/arquivar`,
  historico: (limite: number, antes?: string) => `/v1/precos/historico?limite=${limite}${antes ? `&antes=${encodeURIComponent(antes)}` : ""}`,
  sugestao: (cliente: string, ciclo: CicloPlano, inicio?: string) =>
    `/v1/clientes/${cliente}/plano/sugestao?ciclo=${ciclo}${inicio ? `&inicio=${inicio}` : ""}`,
};

export interface FaixaPreco {
  codigo: string;
  unidadesDe: number;
  /** Vazio na última faixa (acima de 400). */
  unidadesAte?: number;
  /** A faixa sem valores: sob consulta. */
  sobConsulta: boolean;
  /** Centavos; vazio é Valor a definir, nunca zero. */
  fundador?: number;
  cheia?: number;
  implantacao?: number;
  versao: number;
}

export interface ParametrosPreco {
  mesesPagosAnual: number;
  parcelasImplantacao: number;
  vagasFundador: number;
  tabelaEmUso: TabelaEmUso;
  versao: number;
}

export interface FaixaConcorrente {
  /** Até quantas unidades; acima da última, sob consulta. */
  ate: number;
  valor: number;
}

export interface Concorrente {
  id: string;
  nome: string;
  plano?: string;
  modelo: ModeloConcorrente;
  /** FIXO: o preço por mês. */
  valor?: number;
  /** POR_UNIDADE: centavos por unidade e o mínimo do mês. */
  porUnidade?: number;
  minimo?: number;
  /** FAIXA: os degraus em ordem; acima do último, sob consulta. */
  faixas: FaixaConcorrente[];
  /** O site diz "a partir de". */
  aPartirDe: boolean;
  /** Preço visto na fonte oficial; sem conferência é de terceiros. */
  conferido: boolean;
  fonte: string;
  /** "aaaa-mm-dd" */
  lidoEm: string;
  observacao?: string;
  versao: number;
}

export interface MudancaPreco {
  id: string;
  em: string;
  quem: string;
  funcao?: string;
  /** O que mudou, em uma frase montada a partir do antes e do depois. */
  oQue: string;
  motivo: string;
}

export interface TabelaPrecos {
  faixas: FaixaPreco[];
  parametros: ParametrosPreco;
  /** Só os que estão na comparação; os arquivados ficam no histórico. */
  concorrentes: Concorrente[];
  vagas: { total: number; usadas: number; restantes: number };
  podeEditar: boolean;
}

export type AvisoSugestao = "SEM_UNIDADES" | "SOB_CONSULTA" | "FUNDADOR_SO_MENSAL" | "SEM_VAGA_FUNDADOR" | "VALOR_A_DEFINIR";

export interface SugestaoPlano {
  unidadesAtivas: number;
  /** Vazio quando o condomínio ainda não tem unidades ativas. */
  faixa?: { codigo: string; unidadesDe: number; unidadesAte?: number; sobConsulta: boolean };
  /** A tabela que a sugestão usou; vazio quando o plano fica à mão (sob consulta). */
  tabela?: TabelaEmUso;
  ciclo: CicloPlano;
  nome: string;
  unidadesDe?: number;
  unidadesAte?: number;
  valor?: number;
  /** No anual: o valor do mês e quantos meses se pagam. */
  valorMensal?: number;
  mesesPagosAnual?: number;
  implantacao?: number;
  implantacaoSemCobranca: boolean;
  sobConsulta: boolean;
  /** A tabela em uso é a de fundador, mas as vagas acabaram: a sugestão vem da cheia. */
  semVaga: boolean;
  /** Na de fundador: o número deste cliente entre as vagas e a competência em que o preço acaba. */
  fundador?: { posicao?: number; vagas: number; ate?: string; jaOcupa: boolean };
  avisos: AvisoSugestao[];
}

type Cru = Record<string, unknown>;
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const txt = (v: unknown): string => (typeof v === "string" ? v : "");
const lista = (v: unknown): Cru[] => (Array.isArray(v) ? (v as Cru[]) : []);
const obj = (v: unknown): Cru => (v && typeof v === "object" && !Array.isArray(v) ? (v as Cru) : {});
const semVazios = (o: Cru) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function lerFaixa(f: Cru): FaixaPreco {
  return {
    codigo: txt(f.codigo), unidadesDe: num(f.unidadesDe) ?? 1, unidadesAte: num(f.unidadesAte),
    sobConsulta: f.sobConsulta === true, fundador: num(f.fundador), cheia: num(f.cheia), implantacao: num(f.implantacao), versao: num(f.versao) ?? 1,
  };
}

function lerConcorrente(c: Cru): Concorrente {
  return {
    id: txt(c.id), nome: txt(c.nome), plano: txt(c.plano) || undefined, modelo: (txt(c.modelo) || "FIXO") as ModeloConcorrente,
    valor: num(c.valor), porUnidade: num(c.porUnidade), minimo: num(c.minimo),
    faixas: lista(c.faixas).map((f) => ({ ate: num(f.ate) ?? 0, valor: num(f.valor) ?? 0 })),
    aPartirDe: c.aPartirDe === true, conferido: c.conferido !== false, fonte: txt(c.fonte), lidoEm: txt(c.lidoEm).slice(0, 10),
    observacao: txt(c.observacao) || undefined, versao: num(c.versao) ?? 1,
  };
}

/** GET /v1/precos → a tela. */
export function lerTabelaPrecos(d: Cru): TabelaPrecos {
  const p = obj(d.parametros);
  const v = obj(d.vagasFundador);
  const total = num(v.total) ?? num(p.vagasFundador) ?? 0, usadas = num(v.ocupadas) ?? 0;
  return {
    faixas: lista(d.faixas).map(lerFaixa).sort((a, b) => a.unidadesDe - b.unidadesDe),
    parametros: {
      mesesPagosAnual: num(p.mesesPagosAnual) ?? 11, parcelasImplantacao: num(p.parcelasImplantacao) ?? 3, vagasFundador: num(p.vagasFundador) ?? total,
      tabelaEmUso: p.tabelaEmUso === "CHEIA" ? "CHEIA" : "FUNDADOR", versao: num(p.versao) ?? 1,
    },
    concorrentes: lista(d.concorrentes).filter((c) => c.arquivado !== true).map(lerConcorrente),
    vagas: { total, usadas, restantes: num(v.livres) ?? Math.max(total - usadas, 0) },
    podeEditar: d.podeEditar === true,
  };
}

const NOMES_FAIXA_CODIGO: Record<string, { unidadesDe: number; unidadesAte?: number }> = {
  ATE_40: { unidadesDe: 1, unidadesAte: 40 }, DE_41_A_100: { unidadesDe: 41, unidadesAte: 100 }, DE_101_A_200: { unidadesDe: 101, unidadesAte: 200 },
  DE_201_A_400: { unidadesDe: 201, unidadesAte: 400 }, ACIMA_DE_400: { unidadesDe: 401 },
};
const ROTULOS_PARAMETRO: Record<string, (v: unknown) => string> = {
  tabelaEmUso: (v) => `tabela em uso ${v === "CHEIA" ? "Tabela cheia" : "Fundador"}`,
  mesesPagosAnual: (v) => `${String(v)} meses pagos no anual`,
  parcelasImplantacao: (v) => `implantação em ${String(v)} vezes`,
  vagasFundador: (v) => `${String(v)} vagas de fundador`,
};
const dinheiroOuDefinir = (v: unknown) => (typeof v === "number" ? mostrarValor(v) : "Valor a definir");
const dataCurta = (v: unknown) => txt(v).slice(0, 10).split("-").reverse().join("/");

/** A frase "o que mudou" de um evento do histórico, a partir do antes e do depois. */
export function descreverMudanca(e: { entidade: string; entidadeId: string; acao: string; antes?: Cru; depois: Cru }): string {
  const { antes, depois } = e;
  if (e.entidade === "FAIXA") {
    const nome = nomeFaixa(NOMES_FAIXA_CODIGO[e.entidadeId] ?? { unidadesDe: num(depois.unidadesDe) ?? 1, unidadesAte: num(depois.unidadesAte) });
    const campos = [["fundador", "fundador"], ["cheia", "cheia"], ["implantacao", "implantação"]] as const;
    const partes = antes
      ? campos.filter(([k]) => antes[k] !== depois[k]).map(([k, n]) => `${n} de ${dinheiroOuDefinir(antes[k])} para ${dinheiroOuDefinir(depois[k])}`)
      : campos.map(([k, n]) => `${n} ${dinheiroOuDefinir(depois[k])}`);
    return `${nome}: ${partes.length ? partes.join(", ") : "sem mudança nos valores"}.`;
  }
  if (e.entidade === "PARAMETROS") {
    const chaves = Object.keys(ROTULOS_PARAMETRO).filter((k) => k in depois && (!antes || antes[k] !== depois[k]));
    const partes = chaves.map((k) => (antes && k in antes ? `${ROTULOS_PARAMETRO[k]!(antes[k])} para ${ROTULOS_PARAMETRO[k]!(depois[k])}` : ROTULOS_PARAMETRO[k]!(depois[k])));
    return `Parâmetros: ${partes.length ? partes.join("; ") : "sem mudança"}.`;
  }
  const nome = txt(depois.nome) || txt(antes?.nome);
  if (e.acao === "CRIADO") return `Preço de concorrente cadastrado à mão: ${nome} (fonte: ${txt(depois.fonte)}, ${dataCurta(depois.lidoEm)}).`;
  if (e.acao === "ARQUIVADO") return `Concorrente arquivado: ${nome}.`;
  return `Preço de concorrente corrigido: ${nome}.`;
}

export function lerMudanca(h: Cru): MudancaPreco {
  const autor = h.autor;
  const a = obj(autor);
  return {
    id: String(h.id ?? ""), em: txt(h.em), quem: typeof autor === "string" ? autor : txt(a.nome), funcao: txt(a.funcao) || undefined,
    oQue: descreverMudanca({ entidade: txt(h.entidade), entidadeId: txt(h.entidadeId), acao: txt(h.acao), antes: h.antes ? obj(h.antes) : undefined, depois: obj(h.depois) }),
    motivo: txt(h.motivo),
  };
}

/** GET /v1/precos/historico → as mudanças, das mais novas para as mais antigas. */
export function lerHistoricoPrecos(d: Cru): MudancaPreco[] {
  return lista(d.eventos).map(lerMudanca);
}

/** GET /v1/clientes/:id/plano/sugestao → a caixa "Pela tabela". */
export function lerSugestao(d: Cru): SugestaoPlano {
  const f = d.faixa ? obj(d.faixa) : undefined;
  const p = obj(d.plano);
  const v = obj(d.vagasFundador);
  const avisos = (Array.isArray(d.avisos) ? (d.avisos as unknown[]).map(String) : []) as AvisoSugestao[];
  const tabela = p.tabela === "FUNDADOR" || p.tabela === "CHEIA" ? p.tabela : undefined;
  return {
    unidadesAtivas: num(d.unidades) ?? 0,
    faixa: f ? { codigo: txt(f.codigo), unidadesDe: num(f.unidadesDe) ?? 1, unidadesAte: num(f.unidadesAte), sobConsulta: f.sobConsulta === true } : undefined,
    tabela, ciclo: (p.ciclo ?? d.ciclo) === "ANUAL" ? "ANUAL" : "MENSAL", nome: txt(p.nome),
    unidadesDe: num(p.unidadesDe), unidadesAte: num(p.unidadesAte), valor: num(p.valor), valorMensal: num(p.valorMensal), mesesPagosAnual: num(p.mesesPagos),
    implantacao: num(p.implantacaoValor), implantacaoSemCobranca: p.implantacaoSemCobranca === true,
    sobConsulta: avisos.includes("SOB_CONSULTA") || f?.sobConsulta === true, semVaga: avisos.includes("SEM_VAGA_FUNDADOR"),
    fundador: tabela === "FUNDADOR" ? { posicao: num(v.posicao), vagas: num(v.total) ?? 0, ate: txt(p.fundadorAte) || undefined, jaOcupa: v.esteClienteOcupa === true } : undefined,
    avisos,
  };
}

/** Corpo do PUT /v1/precos/faixas/:codigo. */
export const corpoFaixa = (f: FaixaPreco, novo: { fundador: number | null; cheia: number | null; implantacao: number | null }, motivo: string) => ({
  versao: f.versao, fundador: novo.fundador, cheia: novo.cheia, implantacao: novo.implantacao, motivo,
});

/** Corpo do PUT /v1/precos/parametros. */
export const corpoParametros = (p: Omit<ParametrosPreco, "versao">, versao: number, motivo: string) => ({
  versao, mesesPagosAnual: p.mesesPagosAnual, parcelasImplantacao: p.parcelasImplantacao, vagasFundador: p.vagasFundador, tabelaEmUso: p.tabelaEmUso, motivo,
});

/** Corpo do POST e do PUT de concorrente: só o que vale para o modelo escolhido. */
export const corpoConcorrente = (c: Omit<Concorrente, "id" | "versao">, motivo: string, versao?: number) => semVazios({
  versao, nome: c.nome, plano: c.plano, modelo: c.modelo,
  valor: c.modelo === "FIXO" ? c.valor : undefined, aPartirDe: c.modelo === "FIXO" ? c.aPartirDe : undefined,
  faixas: c.modelo === "FAIXA" ? c.faixas.map((f) => ({ ate: f.ate, valor: f.valor })) : undefined,
  porUnidade: c.modelo === "POR_UNIDADE" ? c.porUnidade : undefined, minimo: c.modelo === "POR_UNIDADE" ? c.minimo : undefined,
  fonte: c.fonte, conferido: c.conferido, lidoEm: c.lidoEm, observacao: c.observacao, motivo,
});

/** "Até 40 unidades", "41 a 100", "Acima de 400". */
export function nomeFaixa(f: { unidadesDe: number; unidadesAte?: number }): string {
  if (f.unidadesAte === undefined) return `Acima de ${f.unidadesDe - 1}`;
  return f.unidadesDe <= 1 ? `Até ${f.unidadesAte} unidades` : `${f.unidadesDe} a ${f.unidadesAte}`;
}

/** A faixa de um número de unidades. */
export function faixaDe(faixas: FaixaPreco[], unidades: number): FaixaPreco | undefined {
  return faixas.find((f) => unidades >= f.unidadesDe && (f.unidadesAte === undefined || unidades <= f.unidadesAte));
}

/** Centavos por unidade no teto da faixa, arredondado ao centavo. */
export const porUnidadeNoTeto = (centavos: number, teto: number) => Math.round(centavos / teto);
