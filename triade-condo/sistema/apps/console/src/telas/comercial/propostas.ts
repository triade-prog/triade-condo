// Propostas do Comercial (0304, R17.3; quadros 325 a 329, 337 e 344, aprovados em 24/10/2026): o
// que a api-console devolve (contrato em comercial/r17-3/contrato-api.md), as rotas e os textos
// montados a partir dos dados. O preço nunca é calculado aqui: sai da Tabela de preços no banco.
// O que vai para o síndico (link, PDF e kit) passa por conteudoDaVersao ou conteudoDoLink, que só
// copiam o que pode sair: nota interna, pedido de desconto e IP do aceite nunca saem (CM-12).

import {
  CRITERIOS_SINDICO, mostrarDataSemHora, mostrarValor, OFERTA_INCLUIDO, OFERTA_PLANEJADO, SITUACOES_PROPOSTA, TEMAS_RESPOSTA, TEXTO_A_CONFIRMAR, TEXTO_COMPARATIVO,
  TEXTO_CUSTO_APARTAMENTO, TEXTO_PLANEJADO, type AbaProposta, type CriterioSindico, type EscopoReferencia, type EtapaComercial, type SituacaoDesconto,
  type SituacaoProposta, type TemaResposta,
} from "@triade/domain";

export type Ciclo = "MENSAL" | "ANUAL";
export type TabelaProposta = "FUNDADOR" | "CHEIA" | "MANUAL";
export type AvisoProposta = "SEM_UNIDADES" | "SOB_CONSULTA" | "FUNDADOR_SO_MENSAL" | "SEM_VAGA_FUNDADOR" | "VALOR_A_DEFINIR";

export interface PessoaRef { id: string; nome: string }

export const ROTAS_PROPOSTAS = {
  lista: (aba?: AbaProposta | null, interessado?: string) => {
    const q = new URLSearchParams();
    if (aba) q.set("aba", aba);
    if (interessado) q.set("interessado", interessado);
    const s = q.toString();
    return `/v1/comercial/propostas${s ? `?${s}` : ""}`;
  },
  sugestao: "/v1/comercial/propostas/sugestao",
  criar: "/v1/comercial/propostas",
  proposta: (id: string) => `/v1/comercial/propostas/${id}`,
  kit: (id: string) => `/v1/comercial/propostas/${id}/kit`,
  versoes: (id: string) => `/v1/comercial/propostas/${id}/versoes`,
  versao: (id: string, v: string) => `/v1/comercial/propostas/${id}/versoes/${v}`,
  acao: (id: string, v: string, acao: "desconto/pedir" | "desconto/aprovar" | "desconto/recusar" | "enviar" | "link" | "revogar" | "recusada") =>
    `/v1/comercial/propostas/${id}/versoes/${v}/${acao}`,
  criterios: (interessado: string) => `/v1/comercial/interessados/${interessado}/criterios`,
  fatos: (id?: string) => (id ? `/v1/comercial/fatos/${id}` : "/v1/comercial/fatos"),
  retirarFato: (id: string) => `/v1/comercial/fatos/${id}/retirar`,
  respostas: (id?: string) => (id ? `/v1/comercial/respostas/${id}` : "/v1/comercial/respostas"),
  referencias: (id?: string) => (id ? `/v1/comercial/referencias/${id}` : "/v1/comercial/referencias"),
  retirarReferencia: (id: string) => `/v1/comercial/referencias/${id}/retirar`,
  publico: (codigo: string) => `/v1/publico/propostas/${encodeURIComponent(codigo)}`,
  publicoKit: (codigo: string) => `/v1/publico/propostas/${encodeURIComponent(codigo)}/kit`,
  publicoAceite: (codigo: string) => `/v1/publico/propostas/${encodeURIComponent(codigo)}/aceite`,
};

/** Endereços das telas. */
export const TELAS_PROPOSTAS = {
  lista: (proposta?: string) => (proposta ? `/comercial/propostas?proposta=${proposta}` : "/comercial/propostas"),
  nova: (interessado: string) => `/comercial/propostas/nova?interessado=${interessado}`,
  versaoNova: (proposta: string) => `/comercial/propostas/${proposta}/versao`,
  editar: (proposta: string, versao: string) => `/comercial/propostas/${proposta}/versao?editar=${versao}`,
  kit: (proposta: string) => `/comercial/propostas/${proposta}/kit`,
};

/** O endereço do link que vai para o síndico: /o/<código>, no próprio Console. */
export const enderecoDoLink = (origem: string, codigo: string) => `${origem.replace(/\/$/, "")}/o/${codigo}`;

// ---------------------------------------------------------------------------------------------
// O que a API devolve. Campo ausente é nulo (o banco tira os nulos).

export interface Aberturas { total: number; aparelhos: number; ultima?: string }

export interface ItemListaProposta {
  id: string;
  versao: number;
  aba: AbaProposta;
  interessado: { id: string; condominio: string; etapa: EtapaComercial; responsavel?: PessoaRef };
  atual: {
    id: string; numero: number; situacao: SituacaoProposta; ciclo: Ciclo; tabela: TabelaProposta; mensal?: number; validoAte?: string; enviadaEm?: string;
    descontoSituacao?: SituacaoDesconto; desconto?: number;
  };
  aberturas: Aberturas;
  aceite?: { em: string; cargo: string };
}

export interface ListaPropostas {
  propostas: ItemListaProposta[];
  contagens: Partial<Record<AbaProposta, number>>;
  podeEditar: boolean;
  podeAprovarDesconto: boolean;
}

export interface RespostaNaVersao { id?: string; tema: TemaResposta; titulo: string; texto?: string; revisadaEm?: string }
export interface Caso { texto: string; usoDesde?: string; medidoEm?: string }
export interface ReferenciaNaVersao {
  id: string; sindico: string; condominio: string; unidades?: number; escopo?: EscopoReferencia; whatsapp?: string; email?: string; caso?: Caso;
  retirada?: boolean; temCaso?: boolean;
}

export interface Premissas { estimativa: boolean; semRoi: boolean; implantacaoAParte: boolean; mensal: number; unidades: number; porApartamento: number; texto: string }

/** Os valores e as condições: o mesmo formato na versão (3.4), no link (4.1) e na sugestão (3.2). */
export interface Condicoes {
  unidades?: number;
  ciclo: Ciclo;
  tabela?: TabelaProposta;
  mensalTabela?: number;
  mensal?: number;
  anual?: number;
  mesesPagos?: number;
  depoisFundador?: number;
  fundadorMeses?: number;
  implantacaoSemCusto?: boolean;
  implantacao?: number;
  implantacaoParcelas?: number;
  desconto?: number;
  porApartamento?: number;
}

export interface LinkVersao { ativo: boolean; criadoEm: string; expiraEm: string; revogadoEm?: string; revogadoMotivo?: string }

/** O pedido de aprovação à Administração: o desconto, o valor sob consulta (0306) ou os dois. */
export interface DescontoPedido {
  percentual?: number; motivo?: string; situacao: SituacaoDesconto; pedidoEm?: string; pedidoPor?: PessoaRef;
  sobConsulta?: boolean; valorManual?: number; implantacaoManual?: number; valorManualMotivo?: string;
  resposta?: string; respondidoEm?: string; respondidoPor?: PessoaRef;
}

export interface VersaoProposta extends Condicoes {
  id: string;
  versaoRegistro: number;
  numero: number;
  situacao: SituacaoProposta;
  condominio: string;
  cidade?: string;
  uf?: string;
  faixa?: string;
  moeda?: string;
  premissas?: Premissas;
  incluido?: string[];
  planejado?: string[];
  respostas?: RespostaNaVersao[];
  referencias?: ReferenciaNaVersao[];
  validadeDias?: number;
  validoAte?: string;
  hash?: string;
  descontoSituacao?: SituacaoDesconto;
  descontoPedido?: DescontoPedido;
  /** A versão precisa da Administração antes do envio: tem desconto ou é sob consulta. */
  pedeAprovacao?: boolean;
  notaInterna?: string;
  valorManualMotivo?: string;
  enviadaEm?: string;
  enviadaPor?: PessoaRef;
  criadoEm: string;
  criadoPor?: PessoaRef;
  alteradoEm?: string;
  link?: LinkVersao;
  aberturas?: Aberturas;
  aceite?: { nome: string; cargo: string; em: string; ip?: string; hashVersao?: string; cpfMascarado?: string; anonimizado?: boolean };
  recusa?: { em: string; motivo: string; por?: PessoaRef };
  substituidaEm?: string;
}

export interface FichaProposta {
  id: string;
  versao: number;
  criadoEm: string;
  interessado: {
    id: string; condominio: string; pessoa?: string; etapa: EtapaComercial; unidades?: number; faixa?: string; anonimizado?: boolean; naoContatar?: boolean;
  };
  versoes: VersaoProposta[];
  kitDisponivel: boolean;
  podeEditar: boolean;
  podeAprovarDesconto: boolean;
}

export interface Sugestao extends Condicoes {
  faixa?: { codigo: string; nome: string; unidadesDe: number; unidadesAte?: number };
  tabelaEmUso?: "FUNDADOR" | "CHEIA";
  validadeDias: number;
  validoAtePrevisto?: string;
  vagasFundador?: { total: number; ocupadas: number; livres: number };
  avisos: AvisoProposta[];
  interessado: { id: string; condominio: string; unidades?: number; faixa?: string; pessoa?: string; etapa: EtapaComercial };
  propostaId?: string | null;
  oferta?: { incluido: string[]; planejado: string[] };
  respostas?: { id: string; tema: TemaResposta; titulo: string }[];
  referencias?: { id: string; sindico: string; condominio: string; unidades?: number; escopo: EscopoReferencia; temCaso?: boolean }[];
}

export interface PropostaPublica extends Condicoes {
  versao: number;
  numero: number;
  situacao: SituacaoProposta;
  condominio: string;
  cidade?: string;
  uf?: string;
  faixa?: string;
  premissas?: Premissas;
  incluido?: string[];
  planejado?: string[];
  respostas?: RespostaNaVersao[];
  validadeDias?: number;
  validoAte?: string;
  hash?: string;
  enviadaEm?: string;
  aosCuidados?: string;
  referencias?: ReferenciaNaVersao[];
  podeAceitar: boolean;
  kitDisponivel?: boolean;
  aceite?: { nome: string; cargo: string; em: string; numero: number; hash: string };
}

export interface PlanoConcorrente { plano?: string; modelo?: string; preco?: number; porApartamento?: number; fonte?: string; lidoEm?: string }

/** Uma linha do comparativo pelos critérios do síndico (0307): a TRÍADE com texto fixo; o resto, o fato confirmado. */
export interface LinhaComparativo {
  criterio: CriterioSindico;
  titulo: string;
  triade: string;
  /** Uma por coluna, na ordem de colunas. */
  valores: { confirmado: boolean; texto?: string }[];
}

/** O fato por trás de uma célula, só no kit do Console: a fonte e quem registrou não vão para o link. */
export interface FatoComparativo {
  id: string; versao: number; sistema: string; criterio: CriterioSindico; texto: string; fonte: string; confirmadoEm: string; por?: PessoaRef; em?: string;
}

export interface Kit {
  propostaId?: string;
  versaoId?: string;
  proposta: PropostaPublica;
  predio: {
    condominio: string; cidade?: string; uf?: string; unidades?: number; administradora?: string; appAdministradora?: string | boolean; sistemaAtual?: string;
    fidelidadeAte?: string; assembleiaOrdinaria?: string; mandatoAte?: string; decisaoEm?: string;
    /** O problema do prédio, em texto curto (0307), para a apresentação. */
    problema?: string;
    criterios?: CriterioSindico[];
    criterioOutro?: string;
  };
  comparativo: {
    triade: { ciclo: Ciclo; mensal?: number; porApartamento?: number; implantacaoSemCusto?: boolean; estimativa?: boolean };
    sistemaAtual?: { nome?: string; fidelidadeAte?: string };
    concorrentes: { nome: string; confirmado: boolean; planos: PlanoConcorrente[] }[];
    /** As colunas: o sistema atual e os concorrentes da ficha (0307). */
    colunas?: { nome: string; tipo: "SISTEMA_ATUAL" | "CONCORRENTE" }[];
    linhas?: LinhaComparativo[];
  };
  respostas: RespostaNaVersao[];
  referencias: ReferenciaNaVersao[];
  oferta?: { incluido: string[]; planejado: string[] };
  respostasDisponiveis?: { id: string; tema: TemaResposta; titulo: string }[];
  /** Só no Console: o interessado (para o Escolher critérios) e os fatos com a fonte. */
  interessado?: { id: string; versao: number };
  fatos?: FatoComparativo[];
  podeEditar?: boolean;
}

export interface RespostaPronta {
  id: string; tema: TemaResposta; titulo: string; texto: string; ativa: boolean; revisada: boolean; revisadaEm?: string; revisadaPor?: PessoaRef; versao: number;
}
export interface Referencia {
  id: string; sindico: string; condominio: string; unidades?: number; escopo: EscopoReferencia; whatsapp?: string; email?: string; autorizadoEm: string;
  autorizacaoTexto: string; caso?: Caso; emUso?: number; versao: number; retirada?: { em: string; motivo: string; por?: PessoaRef };
}

// ---------------------------------------------------------------------------------------------
// Textos.

const dataCurta = (d?: string) => (d ? mostrarDataSemHora(d.slice(0, 10)) : "");
export const diaMes = (d?: string) => dataCurta(d).slice(0, 5);
const brl = (c?: number) => mostrarValor(c ?? null);

/** 10 → "10%"; 12.5 → "12,5%". */
export const percentual = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export const NOMES_CICLO: Record<Ciclo, string> = { MENSAL: "Mensal", ANUAL: "Anual" };
const NOMES_TABELA_CURTO: Record<TabelaProposta, string> = { FUNDADOR: "fundador", CHEIA: "cheia", MANUAL: "sob consulta" };
const NOMES_TABELA_SINDICO: Record<TabelaProposta, string> = { FUNDADOR: "preço de fundador", CHEIA: "tabela cheia", MANUAL: "sob consulta" };

/** "Anual · preço de fundador", o que fica em cima do preço no link e no PDF. */
export const tituloPreco = (c: Condicoes) => `${NOMES_CICLO[c.ciclo]} · ${NOMES_TABELA_SINDICO[c.tabela ?? "CHEIA"]}`;

/** "Mensal · fundador · R$ 229,00 · validade 05/11", a linha de cada versão (quadro 326). */
export function resumoVersao(v: Pick<VersaoProposta, "ciclo" | "tabela" | "mensal" | "implantacao" | "implantacaoSemCusto" | "validoAte">): string {
  return [
    NOMES_CICLO[v.ciclo], NOMES_TABELA_CURTO[v.tabela ?? "CHEIA"], brl(v.mensal),
    !v.implantacaoSemCusto && v.implantacao ? `implantação ${brl(v.implantacao)}` : null,
    v.validoAte ? `validade ${diaMes(v.validoAte)}` : null,
  ].filter(Boolean).join(" · ");
}

const horaCurta = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  .format(new Date(iso)).replace(",", "");

/** "Aberta 4 vezes em 3 aparelhos · última 23/10 18:05" (CM-07): quem abriu não é identificado. */
export function textoAberturas(a?: Aberturas): string {
  if (!a || !a.total) return "Ainda não aberta";
  const vezes = a.total === 1 ? "1 vez" : `${a.total} vezes`;
  const aparelhos = a.aparelhos === 1 ? "1 aparelho" : `${a.aparelhos} aparelhos`;
  return `Aberta ${vezes} em ${aparelhos}${a.ultima ? ` · última ${horaCurta(a.ultima)}` : ""}`;
}

/** O selo da situação, com o número da versão: "v2 · enviada". */
export function textoSituacao(numero: number, s: SituacaoProposta): string {
  const curto: Record<SituacaoProposta, string> = {
    RASCUNHO: "rascunho", AGUARDA_DESCONTO: "aguarda aprovação", PRONTA: "pronta para enviar", ENVIADA: "enviada", ACEITA: "aceita",
    RECUSADA: "recusada", VENCIDA: "vencida", SUBSTITUIDA: "substituída",
  };
  return `v${numero} · ${curto[s]}`;
}
export const TOM_SITUACAO_PROPOSTA: Record<SituacaoProposta, "info" | "ok" | "atencao" | "erro" | "neutro" | "andamento"> = {
  RASCUNHO: "neutro", AGUARDA_DESCONTO: "atencao", PRONTA: "info", ENVIADA: "andamento", ACEITA: "ok", RECUSADA: "neutro", VENCIDA: "neutro", SUBSTITUIDA: "neutro",
};
export const nomeSituacao = (s: SituacaoProposta) => SITUACOES_PROPOSTA[s] ?? s;

/** O que a lista mostra em "Depois do envio" (quadro 326). */
export function depoisDoEnvio(p: ItemListaProposta): string {
  const s = p.atual.situacao;
  if (s === "ACEITA") return p.aceite ? `Aceita em ${diaMes(p.aceite.em)} (${p.aceite.cargo})` : "Aceita";
  if (s === "VENCIDA") return "Refazer com a tabela do dia";
  if (s === "ENVIADA") return textoAberturas(p.aberturas);
  if (s === "AGUARDA_DESCONTO") return "Esperando a Administração";
  if (s === "RECUSADA") return "O síndico disse não";
  return "—";
}

/**
 * O que a Administração aprova (F.1; sob consulta pela 0306): o desconto, o valor digitado acima
 * de 400 unidades, ou os dois. A proposta só desconto continua com as palavras de antes.
 */
export interface Aprovacao { desconto?: number; sobConsulta: boolean; valor?: number }

export function aprovacaoDaVersao(v: VersaoProposta): Aprovacao | null {
  const sobConsulta = v.tabela === "MANUAL";
  const desconto = v.descontoPedido?.percentual ?? v.desconto
    ?? (v.mensalTabela !== undefined && v.mensal !== undefined && v.mensal < v.mensalTabela ? Math.round((1 - v.mensal / v.mensalTabela) * 10000) / 100 : undefined);
  const pede = v.pedeAprovacao ?? (sobConsulta || desconto !== undefined);
  if (!pede) return null;
  return { desconto, sobConsulta, valor: v.descontoPedido?.valorManual ?? v.mensalTabela };
}

/** "Desconto de 10%", "Valor sob consulta de R$ 1.500,00 por mês" ou "… com desconto de 10%". */
export function textoAprovacao(a: Aprovacao): string {
  if (!a.sobConsulta) return `Desconto de ${percentual(a.desconto ?? 0)}`;
  const valor = `Valor sob consulta de ${a.valor !== undefined ? brl(a.valor) : "valor a definir"} por mês`;
  return a.desconto ? `${valor} com desconto de ${percentual(a.desconto)}` : valor;
}

/** Os rótulos dos botões, da janela e dos avisos da aprovação. */
export function rotulosAprovacao(a: Aprovacao) {
  if (!a.sobConsulta) {
    return { pedir: "Pedir aprovação do desconto", responder: "Responder ao desconto", titulo: "Aprovar desconto", aprovar: "Aprovar desconto",
      pedido: "Pedido de desconto enviado à Administração. A proposta sai depois da aprovação.", recusou: "A Administração recusou o desconto",
      mudar: "Mude ou tire o desconto no rascunho e salve.", aprovado: "Desconto aprovado", recusado: "Desconto recusado" };
  }
  const oque = a.desconto ? "do valor e do desconto" : "do valor sob consulta";
  return { pedir: `Pedir aprovação ${oque}`, responder: "Responder ao pedido", titulo: a.desconto ? "Aprovar valor e desconto" : "Aprovar valor sob consulta",
    aprovar: a.desconto ? "Aprovar valor e desconto" : "Aprovar valor", pedido: `Pedido de aprovação ${oque} enviado à Administração. A proposta sai depois da aprovação.`,
    recusou: "A Administração recusou o valor", mudar: "Mude o valor ou o desconto no rascunho e salve.", aprovado: "Valor aprovado", recusado: "Valor recusado" };
}

/** A linha do quadro do desconto: "10% na mensalidade: R$ 229,00 → R$ 206,10 por mês". */
export function textoDesconto(pct: number, mensalTabela?: number, mensal?: number): string {
  const conta = mensalTabela !== undefined && mensal !== undefined ? `: ${brl(mensalTabela)} → ${brl(mensal)} por mês` : "";
  return `${percentual(pct)} na mensalidade${conta}`;
}

/** No anual: "R$ 2.519,00 → R$ 2.267,10 (12 por 11)". */
export function textoNoAno(v: Condicoes, mensalComDesconto?: number): string | null {
  if (v.ciclo !== "ANUAL") return null;
  const meses = v.mesesPagos ?? 11;
  const antes = v.mensalTabela !== undefined ? v.mensalTabela * meses : undefined;
  const depois = mensalComDesconto !== undefined ? mensalComDesconto * meses : v.anual;
  if (antes === undefined || depois === undefined) return null;
  return `${antes === depois ? brl(depois) : `${brl(antes)} → ${brl(depois)}`} (12 por ${meses})`;
}

/** A implantação, dita para o síndico. */
export function textoImplantacao(c: Condicoes): string | null {
  if (c.implantacaoSemCusto) return "sem custo";
  if (c.implantacao) return `${brl(c.implantacao)}${c.implantacaoParcelas && c.implantacaoParcelas > 1 ? `, em até ${c.implantacaoParcelas} vezes` : ""}`;
  return null;
}

/** As linhas de baixo do preço (quadro 328): por apartamento, no ano, desconto, implantação, preço garantido e validade. */
export function linhasDoPreco(c: Condicoes & { validoAte?: string }): [string, string][] {
  const l: [string, string][] = [];
  if (c.porApartamento !== undefined && c.unidades) l.push(["Por apartamento", `${brl(c.porApartamento)} por mês (estimativa, ${c.unidades} unidades)`]);
  if (c.ciclo === "ANUAL" && c.anual !== undefined) l.push(["No ano", `${brl(c.anual)} (12 por ${c.mesesPagos ?? 11})`]);
  if (c.desconto) l.push(["Desconto", `${percentual(c.desconto)}, aprovado`]);
  const impl = textoImplantacao(c);
  if (impl) l.push(["Implantação", impl]);
  if (c.tabela === "FUNDADOR" && c.fundadorMeses) {
    l.push(["Preço garantido", `${c.fundadorMeses} meses${c.depoisFundador ? `; depois, ${brl(c.depoisFundador)} por mês` : ""}`]);
  }
  if (c.validoAte) l.push(["Vale até", dataCurta(c.validoAte)]);
  return l;
}

/** O que vai junto, no resumo do gerador: respostas e referências escolhidas. */
export function textoVaiJunto(respostas: string[], referencias: number): string {
  const partes = [
    respostas.length ? `Respostas prontas: ${respostas.join(", ")} (CM-27)` : null,
    referencias ? `${referencias === 1 ? "1 referência" : `${referencias} referências`} de síndicos (CM-28)` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Nada escolhido";
}

export const AVISOS_PROPOSTA: Record<AvisoProposta, string> = {
  SEM_UNIDADES: "A ficha do prédio não tem o número de unidades. Digite as unidades ativas para ver o preço.",
  SOB_CONSULTA: "Acima de 400 unidades a tabela diz sob consulta. Digite o valor e o motivo; a proposta pede aprovação da Administração.",
  FUNDADOR_SO_MENSAL: "O preço de fundador é só no mensal. No anual, a proposta usa a tabela cheia.",
  SEM_VAGA_FUNDADOR: "As vagas de fundador estão ocupadas. A proposta usa a tabela cheia.",
  VALOR_A_DEFINIR: "Esta faixa ainda não tem valor na Tabela de preços. Dá para salvar o rascunho, mas não para pedir desconto nem enviar.",
};

// ---------------------------------------------------------------------------------------------
// O que vai para o síndico. Só o que está aqui sai no link, no PDF e no kit.

export interface ConteudoSindico extends Condicoes {
  numero: number;
  situacao: SituacaoProposta;
  condominio: string;
  cidade?: string;
  uf?: string;
  aosCuidados?: string;
  premissasTexto?: string;
  incluido: string[];
  planejado: string[];
  respostas: { tema: TemaResposta; titulo: string; texto: string }[];
  referencias: { sindico: string; condominio: string; unidades?: number; contato?: string; caso?: Caso }[];
  validoAte?: string;
  enviadaEm?: string;
  hash?: string;
  aceite?: { nome: string; cargo: string; em: string };
}

const CONDICOES: (keyof Condicoes)[] = ["unidades", "ciclo", "tabela", "mensalTabela", "mensal", "anual", "mesesPagos", "depoisFundador", "fundadorMeses",
  "implantacaoSemCusto", "implantacao", "implantacaoParcelas", "desconto", "porApartamento"];

function condicoesDe(o: Condicoes): Condicoes {
  return Object.fromEntries(CONDICOES.filter((k) => o[k] !== undefined && o[k] !== null).map((k) => [k, o[k]])) as unknown as Condicoes;
}

const contatoDe = (r: ReferenciaNaVersao) => (r.escopo === "CONTATO" ? [r.whatsapp ? formatarWhats(r.whatsapp) : null, r.email].filter(Boolean).join(" · ") || undefined : undefined);
function formatarWhats(d: string): string {
  const n = d.replace(/^55/, "");
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : d;
}
const referenciasDe = (rs?: ReferenciaNaVersao[]) => (rs ?? []).filter((r) => !r.retirada).map((r) => ({
  sindico: r.sindico, condominio: r.condominio, unidades: r.unidades, contato: contatoDe(r), caso: r.caso,
}));
const respostasDe = (rs?: RespostaNaVersao[]) => (rs ?? []).filter((r) => r.texto).map((r) => ({ tema: r.tema, titulo: r.titulo, texto: r.texto! }));

/** A versão vista pela equipe (3.4) → o que o síndico pode ver. Nada interno passa. */
export function conteudoDaVersao(v: VersaoProposta, aosCuidados?: string): ConteudoSindico {
  return {
    ...condicoesDe(v), ciclo: v.ciclo,
    numero: v.numero, situacao: v.situacao, condominio: v.condominio, cidade: v.cidade, uf: v.uf, aosCuidados,
    premissasTexto: v.premissas?.texto, incluido: [...(v.incluido ?? OFERTA_INCLUIDO)], planejado: [...(v.planejado ?? OFERTA_PLANEJADO)],
    respostas: respostasDe(v.respostas), referencias: referenciasDe(v.referencias),
    validoAte: v.validoAte, enviadaEm: v.enviadaEm, hash: v.hash,
    aceite: v.aceite ? { nome: v.aceite.nome, cargo: v.aceite.cargo, em: v.aceite.em } : undefined,
  };
}

/** A proposta do link (4.1) → o mesmo conteúdo. */
export function conteudoDoLink(p: PropostaPublica): ConteudoSindico {
  return {
    ...condicoesDe(p), ciclo: p.ciclo,
    numero: p.numero, situacao: p.situacao, condominio: p.condominio, cidade: p.cidade, uf: p.uf, aosCuidados: p.aosCuidados,
    premissasTexto: p.premissas?.texto, incluido: [...(p.incluido ?? OFERTA_INCLUIDO)], planejado: [...(p.planejado ?? OFERTA_PLANEJADO)],
    respostas: respostasDe(p.respostas), referencias: referenciasDe(p.referencias),
    validoAte: p.validoAte, enviadaEm: p.enviadaEm, hash: p.hash,
    aceite: p.aceite ? { nome: p.aceite.nome, cargo: p.aceite.cargo, em: p.aceite.em } : undefined,
  };
}

export const ondeFica = (c: { cidade?: string; uf?: string }) => [c.cidade, c.uf].filter(Boolean).join(", ");

// ---------------------------------------------------------------------------------------------
// Os documentos do PDF: blocos que a folha desenha (pdf.ts) sem saber de onde vieram.

export type Bloco =
  | { tipo: "secao"; texto: string }
  | { tipo: "paragrafo"; texto: string; suave?: boolean }
  | { tipo: "destaque"; rotulo: string; valor: string; apoio?: string }
  | { tipo: "pares"; linhas: [string, string][] }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] }
  | { tipo: "pagina" };

export interface Documento {
  /** O título do arquivo (propriedades do PDF). */
  titulo: string;
  /** A faixa pequena de cima: "Residencial Cerrado · Proposta comercial". */
  cabecalho: string;
  /** O título grande. */
  principal: string;
  apoio: string;
  blocos: Bloco[];
  /** Vai no pé de cada folha (a impressão digital). */
  pe?: string;
  nomeArquivo: string;
}

export const slug = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "proposta";

/** "Impressão digital da versão v1: 9f2c…" (CM-07): o hash do conteúdo da versão, não do arquivo. */
export const textoImpressao = (numero: number, hash?: string) =>
  hash ? `Impressão digital da versão v${numero} (SHA-256 do conteúdo): ${hash}` : `Versão v${numero}, ainda não enviada: sem impressão digital.`;

function blocosDaProposta(c: ConteudoSindico): Bloco[] {
  const b: Bloco[] = [
    { tipo: "destaque", rotulo: tituloPreco(c), valor: `${brl(c.mensal)} por mês`, apoio: c.tabela === "MANUAL" ? "Valor sob consulta, combinado com a equipe." : undefined },
    { tipo: "pares", linhas: linhasDoPreco(c) },
  ];
  if (c.porApartamento !== undefined) b.push({ tipo: "paragrafo", texto: c.premissasTexto ?? TEXTO_CUSTO_APARTAMENTO, suave: true });
  b.push({ tipo: "secao", texto: "O que já funciona" }, { tipo: "lista", itens: c.incluido });
  b.push({ tipo: "secao", texto: "O que ainda é planejado" }, { tipo: "paragrafo", texto: `${c.planejado.join(", ")}. ${TEXTO_PLANEJADO}` });
  if (c.respostas.length) {
    b.push({ tipo: "secao", texto: "Respostas para o conselho" });
    for (const r of c.respostas) b.push({ tipo: "paragrafo", texto: r.titulo, suave: false }, { tipo: "paragrafo", texto: r.texto, suave: true });
  }
  if (c.referencias.length) {
    b.push({ tipo: "secao", texto: "Síndicos que aceitaram ser referência" });
    b.push({ tipo: "lista", itens: c.referencias.map((r) => [`${r.sindico}, ${r.condominio}${r.unidades ? ` (${r.unidades} unidades)` : ""}`, r.contato].filter(Boolean).join(" · ")) });
  }
  if (c.aceite) {
    b.push({ tipo: "secao", texto: "Aceite" }, { tipo: "pares", linhas: [["Aceita por", `${c.aceite.nome} (${c.aceite.cargo})`], ["Quando", horaCompleta(c.aceite.em)]] });
    b.push({ tipo: "paragrafo", texto: "Aceitar não é contratar: a contratação é o contrato assinado.", suave: true });
  }
  return b;
}

const horaCompleta = (iso: string) => {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${dia} às ${hora}`;
};
export { horaCompleta };

/** O PDF da proposta (CM-07), igual ao link: o síndico leva ao conselho. */
export function documentoProposta(c: ConteudoSindico): Documento {
  const para = [c.condominio, ondeFica(c)].filter(Boolean).join(" · ");
  return {
    titulo: `Proposta ${c.condominio} v${c.numero}`,
    cabecalho: `${c.condominio} · Proposta comercial`,
    principal: "Proposta para organizar os pedidos do seu prédio",
    apoio: `Para ${para}${c.aosCuidados ? ` · aos cuidados de ${c.aosCuidados}` : ""} · versão v${c.numero}${c.enviadaEm ? `, enviada em ${dataCurta(c.enviadaEm)}` : ""}`,
    blocos: blocosDaProposta(c),
    pe: textoImpressao(c.numero, c.hash),
    nomeArquivo: `proposta-${slug(c.condominio)}-v${c.numero}.pdf`,
  };
}

// ---------------------------------------------------------------------------------------------
// Kit para o conselho e a assembleia (CM-20, quadro 337).

export const PECAS_KIT = {
  APRESENTACAO: { titulo: "Apresentação curta", apoio: "O problema do prédio, o que já funciona, o que é planejado, quanto custa por apartamento e como cancelar" },
  COMPARATIVO: { titulo: "Comparativo para o conselho", apoio: "TRÍADE, sistema atual e concorrentes, pelos critérios que o síndico marcou" },
  PROPOSTA: { titulo: "Proposta em PDF", apoio: "A versão enviada, com a impressão digital" },
  ATA: { titulo: "Minuta de texto para a ata", apoio: "Para a pauta: contratação da plataforma, valor e prazo" },
  PRIVACIDADE: { titulo: "Privacidade para o morador", apoio: "Que dados a plataforma guarda e para quê" },
  RESPOSTAS: { titulo: "Respostas prontas", apoio: "LGPD, segurança, suporte e devolução dos dados (CM-27)" },
  REFERENCIAS: { titulo: "Referências", apoio: "Síndicos que aceitaram ser contato (CM-28)" },
} as const;
export type PecaKit = keyof typeof PECAS_KIT;
export const ORDEM_PECAS = Object.keys(PECAS_KIT) as PecaKit[];

const respostaDoTema = (k: Kit, tema: TemaResposta) => k.respostas.find((r) => r.tema === tema && r.texto);

/** As peças que dá para montar com os dados do kit, e por que as outras não. */
export function pecasDisponiveis(k: Kit): Record<PecaKit, string | null> {
  return {
    APRESENTACAO: null, PROPOSTA: null, ATA: null,
    COMPARATIVO: k.comparativo.linhas?.length ? null : "O síndico ainda não tem critérios marcados. Use Escolher critérios.",
    PRIVACIDADE: respostaDoTema(k, "LGPD") ? null : "Precisa da resposta pronta de LGPD revisada e escolhida na proposta.",
    RESPOSTAS: k.respostas.some((r) => r.texto) ? null : "Nenhuma resposta pronta na versão enviada.",
    REFERENCIAS: k.referencias.length ? null : "Nenhuma referência autorizada na versão enviada.",
  };
}

/** O texto das peças: a mesma coisa vira tela e PDF. */
export function subtituloReferencias(n: number) {
  return n === 1 ? "1 síndico que aceitou ser contato (CM-28)" : `${n} síndicos que aceitaram ser contato (CM-28)`;
}

/** O título do critério, para a tela: o "outro" vem com o texto da ficha. */
export const nomeCriterio = (c: CriterioSindico, outro?: string) => (c === "OUTRO" && outro ? outro : CRITERIOS_SINDICO[c] ?? c);

/**
 * A tabela do comparativo (quadro 337, 0307): uma linha por critério que o síndico marcou. A coluna
 * da TRÍADE vem com o texto fixo do banco (EM-07); nas outras, o fato que a equipe confirmou, e o
 * que não se sabe fica "a confirmar com eles". Nada de retorno prometido. A mesma tabela vai para a
 * tela, para o PDF do Console e para o kit pelo link.
 */
export function tabelaComparativo(k: Kit): { cabecalho: string[]; linhas: string[][] } {
  const colunas = k.comparativo.colunas ?? [];
  const linhas = (k.comparativo.linhas ?? []).map((l) => [
    l.titulo, l.triade, ...colunas.map((_, n) => (l.valores[n]?.confirmado && l.valores[n]?.texto ? l.valores[n]!.texto! : TEXTO_A_CONFIRMAR)),
  ]);
  return { cabecalho: ["Critério do síndico", "TRÍADE", ...colunas.map((c) => c.nome)], linhas };
}

/** O fato da equipe por trás da célula, para mudar ou retirar (só no Console). */
export function fatoDaCelula(k: Kit, criterio: CriterioSindico, sistema: string): FatoComparativo | undefined {
  const chave = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return k.fatos?.find((f) => f.criterio === criterio && chave(f.sistema) === chave(sistema));
}

/** A minuta para a ata: o item da pauta e o texto sugerido, com os valores da versão enviada. */
export function textoAta(k: Kit): { pauta: string; texto: string; reuniao: string } {
  const p = k.proposta;
  const valor = p.ciclo === "ANUAL" && p.anual !== undefined
    ? `${brl(p.anual)} por ano (equivalente a ${brl(p.mensal)} por mês)` : `${brl(p.mensal)} por mês`;
  const impl = textoImplantacao(p);
  const quando = k.predio.decisaoEm ?? k.predio.assembleiaOrdinaria;
  return {
    pauta: "Contratação da plataforma TRÍADE Condo para o atendimento do condomínio: valor e prazo.",
    texto: `A assembleia aprova a contratação da plataforma TRÍADE Condo pelo ${p.condominio}, conforme a proposta v${p.numero}, `
      + `no plano ${NOMES_CICLO[p.ciclo].toLowerCase()} (${NOMES_TABELA_SINDICO[p.tabela ?? "CHEIA"]}), no valor de ${valor}${impl ? `, com a implantação ${impl}` : ""}. `
      + `A proposta vale até ${dataCurta(p.validoAte) || "[validade]"}; o prazo, o cancelamento e o tratamento de dados ficam no contrato. `
      + `A assembleia autoriza o síndico a assinar o contrato em nome do condomínio.`,
    reuniao: quando ? `Reunião prevista para ${dataCurta(quando)}.` : "Reunião: [data da reunião do conselho ou da assembleia].",
  };
}

/** O kit em PDF: as peças escolhidas, na ordem do quadro. */
export function documentoKit(k: Kit, pecas: PecaKit[]): Documento {
  const p = conteudoDoLink(k.proposta);
  const quer = (x: PecaKit) => pecas.includes(x) && pecasDisponiveis(k)[x] === null;
  const b: Bloco[] = [];
  if (quer("APRESENTACAO")) {
    const cancelar = respostaDoTema(k, "CANCELAMENTO");
    b.push({ tipo: "secao", texto: PECAS_KIT.APRESENTACAO.titulo });
    b.push({ tipo: "pares", linhas: [
      ["Para", [k.predio.condominio, ondeFica(k.predio), k.predio.unidades ? `${k.predio.unidades} unidades` : null].filter(Boolean).join(" · ")],
      ...(k.predio.problema ? [["O problema do prédio", k.predio.problema] as [string, string]] : []),
      ...(k.predio.sistemaAtual ? [["Hoje usa", k.predio.sistemaAtual] as [string, string]] : []),
      ["Quanto custa", `${brl(p.mensal)} por mês${p.porApartamento !== undefined ? `, cerca de ${brl(p.porApartamento)} por apartamento (estimativa)` : ""}`],
    ] });
    b.push({ tipo: "paragrafo", texto: "O que já funciona:" }, { tipo: "lista", itens: p.incluido });
    b.push({ tipo: "paragrafo", texto: `Ainda planejado: ${p.planejado.join(", ")}. ${TEXTO_PLANEJADO}`, suave: true });
    if (cancelar?.texto) b.push({ tipo: "paragrafo", texto: `Como cancelar: ${cancelar.texto}` });
  }
  if (quer("COMPARATIVO")) {
    const t = tabelaComparativo(k);
    b.push({ tipo: "secao", texto: "Comparativo para o conselho" }, { tipo: "tabela", ...t }, { tipo: "paragrafo", texto: TEXTO_COMPARATIVO, suave: true });
  }
  if (quer("ATA")) {
    const a = textoAta(k);
    b.push({ tipo: "secao", texto: "Minuta de texto para a ata" }, { tipo: "paragrafo", texto: `Item da pauta: ${a.pauta}` },
      { tipo: "paragrafo", texto: a.texto }, { tipo: "paragrafo", texto: a.reuniao, suave: true });
  }
  if (quer("PRIVACIDADE")) {
    const r = respostaDoTema(k, "LGPD")!;
    b.push({ tipo: "secao", texto: "Privacidade para o morador" }, { tipo: "paragrafo", texto: r.texto! });
  }
  if (quer("RESPOSTAS")) {
    b.push({ tipo: "secao", texto: "Respostas prontas" });
    for (const r of k.respostas.filter((x) => x.texto)) b.push({ tipo: "paragrafo", texto: `${TEMAS_RESPOSTA[r.tema] ?? r.titulo}: ${r.titulo}` }, { tipo: "paragrafo", texto: r.texto!, suave: true });
  }
  if (quer("REFERENCIAS")) {
    b.push({ tipo: "secao", texto: "Referências" });
    b.push({ tipo: "lista", itens: referenciasDe(k.referencias).map((r) => [`${r.sindico}, ${r.condominio}${r.unidades ? ` (${r.unidades} unidades)` : ""}`, r.contato,
      r.caso ? `Caso: ${r.caso.texto}${r.caso.medidoEm ? ` (medido em ${dataCurta(r.caso.medidoEm)})` : ""}` : null].filter(Boolean).join(" · ")) });
  }
  if (quer("PROPOSTA")) {
    b.push({ tipo: "pagina" }, { tipo: "secao", texto: `Proposta v${p.numero}` }, ...blocosDaProposta(p));
  }
  return {
    titulo: `Kit para o conselho · ${p.condominio}`,
    cabecalho: `${p.condominio} · Kit para o conselho`,
    principal: "Kit para o conselho e a assembleia",
    apoio: `Sai da proposta v${p.numero}${p.validoAte ? `, válida até ${dataCurta(p.validoAte)}` : ""}, e dos dados do prédio.`,
    blocos: b,
    pe: textoImpressao(p.numero, p.hash),
    nomeArquivo: `kit-conselho-${slug(p.condominio)}.pdf`,
  };
}

/** A mensagem do WhatsApp com o link da proposta (o envio é pela pessoa, no WhatsApp comercial). */
export function mensagemDoLink(pessoa: string | undefined, condominio: string, endereco: string, kit = false): string {
  const nome = pessoa?.trim().split(/\s+/)[0];
  return kit
    ? `Oi${nome ? `, ${nome}` : ""}! Para levar ao conselho do ${condominio}: no link da proposta tem o kit com o comparativo e o texto para a ata. ${endereco}`
    : `Oi${nome ? `, ${nome}` : ""}! Segue a proposta da TRÍADE Condo para o ${condominio}: ${endereco}`;
}
