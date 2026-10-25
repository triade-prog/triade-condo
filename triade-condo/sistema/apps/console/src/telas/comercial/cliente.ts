// Piloto, virar cliente, troca de sistema e vários condomínios do mesmo contato (0308, R17.4;
// quadros 331, 338 e 345, aprovados; CM-08, CM-09, CM-21 e CM-29): o que a api-console devolve
// (contrato em comercial/r17-3/contrato-api.md, seção 8), as rotas e os textos montados a partir
// dos dados. As regras (quem pode, o que cada passo pede) são do banco.

import { METAS_PILOTO, mostrarDataSemHora, mostrarValor, type EtapaComercial, type MetaPiloto, type SITUACOES_PILOTO } from "@triade/domain";
import type { Ciclo, TabelaProposta, VersaoProposta } from "./propostas.ts";

export const ROTAS_CLIENTE = {
  piloto: (interessado: string) => `/v1/comercial/interessados/${interessado}/piloto`,
  encerrarPiloto: (piloto: string) => `/v1/comercial/pilotos/${piloto}/encerrar`,
  virarCliente: (interessado: string) => `/v1/comercial/interessados/${interessado}/virar-cliente`,
  troca: (interessado: string) => `/v1/comercial/interessados/${interessado}/troca`,
  cartaEnviada: (interessado: string) => `/v1/comercial/interessados/${interessado}/troca/carta-enviada`,
  oportunidades: (interessado: string) => `/v1/comercial/interessados/${interessado}/oportunidades`,
  equipe: "/v1/equipe",
};

export const TELAS_CLIENTE = {
  troca: (interessado: string) => `/comercial/${interessado}/troca`,
  cliente: (condominio: string) => `/clientes/${condominio}?aba=implantacao`,
};

// ---------------------------------------------------------------------------------------------
// O que a API devolve. Campo ausente é nulo (o banco tira os nulos).

export type SituacaoPiloto = keyof typeof SITUACOES_PILOTO;

/** A medida da meta pela Plataforma: só retornos no prazo é medido; as outras ficam em Indicadores. */
export type MedidaPiloto =
  | { medido: true; de: string; ate: string; retornos?: number; noPrazo?: number; porcentagem?: number; meta: number; atingiu?: boolean }
  | { medido: false; ondeVer?: "INDICADORES_PLATAFORMA"; motivo?: "NAO_COMECOU" };

export interface Piloto {
  id: string;
  versao?: number;
  prazoDias: 30 | 45 | 60;
  comecaEm: string;
  terminaEm: string;
  meta: MetaPiloto;
  metaPercentual: number;
  situacao: SituacaoPiloto;
  /** A medida guardada quando o piloto terminou. */
  resultado?: MedidaPiloto;
  encerradoEm?: string;
  /** Só da equipe: nunca vai para o kit. */
  combinadoCom?: string;
  motivoPerda?: string;
  detalhe?: string;
  medida?: MedidaPiloto;
}

export interface RespostaPiloto { piloto: Piloto | null; podeComecar: boolean; podeEncerrar?: boolean }

export interface ItemTroca { texto: string; recebido: boolean }
export interface PassoTroca {
  chave: "CARTA" | "PLANILHA" | "TROCA" | "PRIMEIRA_SEMANA" | "ACOMPANHAMENTO";
  quando: string;
  data: string;
  texto: string;
  situacao: "FEITO" | "FALTAM" | "PREVISTO" | "NA_IMPLANTACAO";
  faltam?: number;
}
export interface Troca {
  id: string;
  versao: number;
  empresaAnterior: string;
  dataTroca: string;
  itens: ItemTroca[];
  faltam: number;
  carta: string;
  cartaEnviadaEm?: string;
  cartaEnviadaPor?: { id: string; nome: string };
  naImplantacao?: boolean;
  linhaDoTempo: PassoTroca[];
}
/** Com restrito (virou cliente e quem lê é do Comercial, CM-11), a troca vem só com o id: seguiu para a implantação. */
export interface RespostaTroca { troca?: Troca | null; itensPadrao: ItemTroca[]; sistemaAtual?: string; administradora?: string; podeEditar: boolean; restrito?: boolean }

export interface Oportunidade { id: string; condominio: string; cidade?: string; uf?: string; unidades?: number; etapa: EtapaComercial; virouCliente?: boolean; criadoEm: string }

export interface MembroEquipe { id: string; nome: string; ativa: boolean; funcoes: string[] }

export interface ClienteCriado { condominioId: string; implantacaoId: string; pendencias: number; doPiloto: boolean; etapa: "GANHO" }

// ---------------------------------------------------------------------------------------------
// Textos.

const data = (d?: string) => (d ? mostrarDataSemHora(d.slice(0, 10)) : "");
const diaMes = (d?: string) => data(d).slice(0, 5);

/** Hoje em Brasília, AAAA-MM-DD. */
export const hojeBrasilia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** O fim do piloto: o começo mais o prazo (como o banco: termina_em = comeca_em + prazo_dias). */
export function terminaEm(comeca: string, prazo: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(comeca)) return "";
  const d = new Date(`${comeca}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + prazo);
  return d.toISOString().slice(0, 10);
}

/** "80% dos retornos no prazo" (quadro 338). */
export function textoMeta(meta: MetaPiloto, pct: number): string {
  const de: Record<MetaPiloto, string> = {
    RETORNOS_NO_PRAZO: "dos retornos no prazo",
    PEDIDOS_CONCLUIDOS_COM_EXPLICACAO: "dos pedidos concluídos com explicação",
    MORADORES_WHATSAPP: "dos moradores usando o WhatsApp",
  };
  return `${pct}% ${de[meta] ?? METAS_PILOTO[meta] ?? meta}`;
}

/** "34 de 40 retornos no prazo (85%), de 04/11 a 19/12: meta de 80% atingida". */
export function textoMedida(m: MedidaPiloto | undefined): string {
  if (!m) return "Sem medida ainda.";
  if (!m.medido) {
    return m.motivo === "NAO_COMECOU" ? "O piloto ainda não começou; a medida aparece a partir do primeiro dia."
      : "Esta meta a própria Plataforma mostra em Indicadores, no condomínio do piloto.";
  }
  if (!m.retornos) return `Nenhum retorno com prazo de ${diaMes(m.de)} a ${diaMes(m.ate)} ainda.`;
  const pct = m.porcentagem !== undefined ? ` (${m.porcentagem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)` : "";
  const fim = m.atingiu === undefined ? "" : m.atingiu ? `: meta de ${m.meta}% atingida` : `: ainda abaixo da meta de ${m.meta}%`;
  return `${m.noPrazo ?? 0} de ${m.retornos} retornos no prazo${pct}, de ${diaMes(m.de)} a ${diaMes(m.ate)}${fim}`;
}

/** "45 dias, de 04/11/2026 a 19/12/2026". */
export const textoPrazo = (p: Pick<Piloto, "prazoDias" | "comecaEm" | "terminaEm">) => `${p.prazoDias} dias, de ${data(p.comecaEm)} a ${data(p.terminaEm)}`;

export const TOM_PILOTO: Record<SituacaoPiloto, "andamento" | "ok" | "neutro" | "info"> = {
  EM_ANDAMENTO: "andamento", VIROU_PROPOSTA: "info", PERDIDO: "neutro", VIROU_CLIENTE: "ok",
};

/** O piloto no kit do conselho (CM-20): prazo, meta e, se terminou, o resultado. Nunca com quem foi combinado. */
export function linhasPilotoKit(p: Piloto): [string, string][] {
  const l: [string, string][] = [
    ["Piloto", `${textoPrazo(p)}, sem cobrança. Meta combinada antes: ${textoMeta(p.meta, p.metaPercentual)}, medida pela própria Plataforma.`],
  ];
  if (p.resultado?.medido) l.push(["Resultado do piloto", textoMedida(p.resultado)]);
  else if (p.situacao === "EM_ANDAMENTO") l.push(["Situação do piloto", "Em andamento; o resultado sai no fim do prazo."]);
  return l;
}

/** "Enviada 01/11", "Faltam 2 itens", "04/12/2026" (quadro 345). */
export function textoPassoTroca(p: PassoTroca, t: Pick<Troca, "cartaEnviadaEm" | "faltam">): { texto: string; tom: "ok" | "atencao" | "neutro" | "info" } {
  if (p.situacao === "FEITO") return { texto: p.chave === "CARTA" && t.cartaEnviadaEm ? `Enviada ${diaMes(t.cartaEnviadaEm)}` : "Feito", tom: "ok" };
  if (p.situacao === "FALTAM") {
    const n = p.faltam ?? t.faltam;
    return { texto: n === 1 ? "Falta 1 item" : `Faltam ${n} itens`, tom: "atencao" };
  }
  if (p.situacao === "NA_IMPLANTACAO") return { texto: "Na implantação", tom: "info" };
  return { texto: data(p.data), tom: "neutro" };
}

/** "2 de 4 recebidos". */
export function textoRecebidos(itens: ItemTroca[]): string {
  const r = itens.filter((i) => i.recebido).length;
  return `${r} de ${itens.length} ${itens.length === 1 ? "recebido" : "recebidos"}`;
}

/**
 * A carta guarda a lista do que falta logo depois de "…a entrega dos itens abaixo:" (a carta-modelo
 * do banco). Marcar um item como recebido troca só essa lista; o resto do texto, mesmo editado, fica.
 * Sem essa frase, a carta volta como estava.
 */
export function atualizarListaDaCarta(carta: string, itens: ItemTroca[]): string {
  const linhas = carta.split("\n");
  const i = linhas.findIndex((l) => /itens abaixo:\s*$/.test(l));
  if (i < 0) return carta;
  let fim = i + 1;
  while (fim < linhas.length && linhas[fim]!.startsWith("- ")) fim++;
  const faltam = itens.filter((x) => !x.recebido).map((x) => `- ${x.texto.trim()}`);
  linhas.splice(i + 1, fim - i - 1, ...(faltam.length ? faltam : ["- (nada pendente)"]));
  return linhas.join("\n");
}

/** Quem pode cuidar da implantação: da equipe, ativo, com a função Implantação. */
export const daImplantacao = (equipe: MembroEquipe[]) => equipe.filter((p) => p.ativa && p.funcoes.includes("IMPLANTACAO"));

const NOME_TABELA: Record<TabelaProposta, string> = { FUNDADOR: "fundador", CHEIA: "tabela cheia", MANUAL: "sob consulta" };
const NOME_CICLO: Record<Ciclo, string> = { MENSAL: "mensal", ANUAL: "anual" };

/** O que Virar cliente cria de uma vez (quadro 331, CM-08), com os dados da proposta aceita. */
export function criadoAoVirarCliente(a: {
  condominio: string; cidade?: string; uf?: string; pessoa?: string; decisor?: string; versao?: VersaoProposta; troca?: Troca | null; doPiloto: boolean;
}): [string, string][] {
  const v = a.versao;
  const onde = [a.cidade, a.uf].filter(Boolean).join(", ");
  const l: [string, string][] = [
    ["Cliente na carteira", [a.condominio, onde, a.doPiloto ? "sai do piloto para Em implantação" : "Em implantação"].filter(Boolean).join(" · ")],
    ["Ficha", `contatos de ${a.pessoa ?? "quem aceitou"}, CNPJ do cartão, contrato assinado e termo de dados`],
  ];
  if (v) {
    l.push(["Plano", `Pela tabela da proposta aceita: ${NOME_CICLO[v.ciclo]}, ${NOME_TABELA[v.tabela ?? "CHEIA"]}, ${mostrarValor(v.mensal ?? null)} por mês`]);
    if (v.tabela === "FUNDADOR") l.push(["Vaga de fundador", "Ocupa uma das vagas de fundador; sem vaga livre, nada é criado"]);
    const semCusto = v.tabela === "FUNDADOR" || v.implantacaoSemCusto || !v.implantacao;
    l.push(["Implantação", a.doPiloto ? "A do piloto continua, com as etapas que tinham ficado de fora"
      : `Roteiro de implantação aberto, ${semCusto ? "sem custo" : `implantação de ${mostrarValor(v.implantacao!)}`}`]);
  } else {
    l.push(["Plano", "Pela tabela da proposta aceita"]);
  }
  l.push(["Promessas e quem decide", `O que foi prometido como pronto e o planejado sem data, numa nota interna · ${a.decisor ? `${a.decisor} decide` : "quem decide não informado"}`]);
  l.push(["Troca de sistema", a.troca
    ? `${a.troca.cartaEnviadaEm ? "Carta já mandada" : `Carta para a ${a.troca.empresaAnterior}`} e ${a.troca.faltam === 1 ? "1 item que falta" : `${a.troca.faltam} itens que faltam`} receber viram pendências da implantação (CM-29)`
    : "Nenhuma troca de sistema registrada"]);
  l.push(["Primeira cobrança", "Sai do plano, na competência do início do contrato"]);
  l.push(["Interessado", "Vai para Ganho, com o histórico guardado"]);
  return l;
}

/** Os campos que o Ganho pede (FALTA_PARA_ETAPA), ditos para a pessoa. */
export const NOMES_FALTA: Record<string, string> = { demonstracaoEm: "a data da demonstração", faixa: "a faixa de unidades", decisor: "quem decide", decisaoEm: "a data da decisão" };
