// Relatório do mês para a assembleia (TR-02, TR-05, TR-08, TR-10; canvas do novo frontend,
// quadros 230 a 236, decisões A.1, B.1, C.1 e D.1 de 23/10/2026). As linhas de cada parte saem
// daqui, iguais na folha da tela, no PDF e na planilha: o que aparece num aparece nos outros.

import { z } from "zod";
import { mostrarDuracao, mostrarPorcentagem, nomeDoMes } from "./prazos.ts";

/** As partes, na ordem em que saem no relatório. */
export const PARTES_RELATORIO = {
  RESUMO: { titulo: "Resumo", apoio: "Um parágrafo pronto com os números do mês. Dá para mudar o texto." },
  ATENDIMENTO: { titulo: "Atendimento do mês", apoio: "Registrados, concluídos, reabertos, retornos no prazo e primeiro retorno, com o mês anterior ao lado." },
  CATEGORIA: { titulo: "Por categoria", apoio: "Registrados, concluídos, tempo médio de fechamento e retornos no prazo de cada categoria." },
  TORRE: { titulo: "Por bloco ou torre", apoio: "Os mesmos números por bloco, mais uma linha para áreas comuns e pedidos sem unidade." },
  DECISOES: { titulo: "Decisões do síndico", apoio: "Pedidas, decididas, tempo típico até a resposta e as que ficaram aguardando." },
  REINCIDENCIA: { titulo: "Reincidência", apoio: "Quantos pedidos voltaram e onde o problema volta." },
  PALAVRA: { titulo: "Palavra do síndico", apoio: "Texto livre, escrito por quem monta." },
} as const;
export type ParteRelatorio = keyof typeof PARTES_RELATORIO;
export const ORDEM_PARTES = Object.keys(PARTES_RELATORIO) as ParteRelatorio[];

/** Só fotos JPG e PNG e PDF entram no PDF do relatório; até 10 anexos de 10 MB. */
export const TIPOS_ANEXO_RELATORIO = ["image/jpeg", "image/png", "application/pdf"] as const;
export const ANEXOS_POR_RELATORIO = 10;

const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês como 2026-09");
const texto = (max: number) => z.string().max(max).nullable().optional().transform((v) => (v?.trim() ? v.trim() : null));

export const previaRelatorioSchema = z.object({ mes: mesSchema });

export const gerarRelatorioSchema = z.object({
  mes: mesSchema,
  partes: z.array(z.enum(ORDEM_PARTES as [ParteRelatorio, ...ParteRelatorio[]])).min(1).max(7),
  resumo: texto(2000),
  palavra: texto(3000),
  anexos: z.array(z.union([
    z.object({ arquivoId: z.string().uuid() }).strict(),
    z.object({ documentoId: z.string().uuid() }).strict(),
  ])).max(ANEXOS_POR_RELATORIO).default([]),
  guardarModelo: z.boolean().default(false),
});
export type GerarRelatorio = z.input<typeof gerarRelatorioSchema>;

export const iniciarAnexoRelatorioSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.enum(TIPOS_ANEXO_RELATORIO),
  tamanho: z.number().int().min(1).max(10 * 1024 * 1024),
});

export const relatorioBaixadoSchema = z.object({ formato: z.enum(["PDF", "CSV"]) });

/** Confere o arquivo antes de enviar; devolve o problema ou null. */
export function conferirAnexoRelatorio(a: { type: string; size: number }): string | null {
  if (!(TIPOS_ANEXO_RELATORIO as readonly string[]).includes(a.type)) return "não entra: só fotos JPG ou PNG e PDF.";
  if (a.size > 10 * 1024 * 1024) return "passa de 10 MB.";
  return null;
}

// ---------------------------------------------------------------------------------------
// O que o banco devolve.

export interface Retornos { total: number; noPrazo: number; porcentagem: number | null }
export interface NumerosAtendimento {
  registrados: number;
  concluidos: number;
  reabertos: number;
  retornos: Retornos;
  primeiroRetornoHoras: number | null;
}
export interface LinhaGrupo {
  chave: string;
  nome: string;
  registrados: number;
  concluidos: number;
  tempoMedioHoras: number | null;
  retornos: number;
  noPrazo: number;
  porcentagem: number | null;
}
export interface DecisoesMes {
  pedidas: number;
  decididas: number;
  aprovadas: number;
  devolvidas: number;
  medianaHoras: number | null;
  aguardandoNoFim: number;
}
export interface ReincidenciaMes {
  pedidos: number;
  reincidencias: number;
  porcentagem: number | null;
  ondeVolta: { onde: string; categoria: string | null; vezes: number }[];
}
/** Os números do mês: a prévia e o retrato guardado no relatório gerado. */
export interface NumerosRelatorio {
  mes: string;
  de: string;
  ate: string;
  fuso: string;
  condominio?: string;
  foraPorPermissao: ParteRelatorio[];
  atendimento?: { atual: NumerosAtendimento; anterior: NumerosAtendimento };
  categorias?: LinhaGrupo[];
  torres?: LinhaGrupo[];
  decisoes?: DecisoesMes;
  reincidencia?: ReincidenciaMes;
  autor?: { nome: string; cargo?: string; sindico: boolean };
}
export interface AnexoRelatorio {
  ordem: number;
  titulo: string;
  tipo: (typeof TIPOS_ANEXO_RELATORIO)[number];
  origem: "ENVIADO" | "DOCUMENTO";
  arquivoId?: string;
  documentoId?: string;
  tamanho?: number;
}
export interface RelatorioGerado {
  id: string;
  mes: string;
  numero: number;
  partes: ParteRelatorio[];
  resumo: string | null;
  palavra: string | null;
  conteudo: NumerosRelatorio;
  geradoEm: string;
  ultimo: boolean;
  anexos: AnexoRelatorio[];
}

// ---------------------------------------------------------------------------------------
// Textos.

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "2026-09" → "setembro de 2026". */
export function mesPorExtenso(mes: string): string {
  return `${nomeDoMes(mes)} de ${mes.slice(0, 4)}`;
}

/** "Setembro de 2026". */
export const tituloDoMes = (mes: string) => maiuscula(mesPorExtenso(mes));

/** "2026-09" → "2026-08". */
export function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
}

/** "De 1 a 30/09/2026, no fuso do condomínio". */
export function periodoDoMes(n: Pick<NumerosRelatorio, "de" | "ate">): string {
  const [a, m, d] = n.ate.split("-");
  return `De 1 a ${d}/${m}/${a}, no fuso do condomínio`;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * O resumo pronto (TR-02): uma ou duas frases com os números do mês, sem inventar causa. Sem
 * nenhum pedido, diz isso. A diferença para o mês anterior só entra quando os dois têm dados.
 */
export function resumoSugerido(n: NumerosRelatorio): string {
  const a = n.atendimento?.atual;
  const nome = nomeDoMes(n.mes);
  if (!a) return `Relatório do atendimento de ${nome}.`;
  if (a.registrados === 0 && a.concluidos === 0) return `Em ${nome}, o condomínio não registrou pedidos.`;
  const frases = [`Em ${nome}, o condomínio registrou ${plural(a.registrados, "pedido", "pedidos")} e concluiu ${a.concluidos}.`];
  const p = a.retornos.porcentagem;
  if (p !== null) {
    const antes = n.atendimento?.anterior.retornos.porcentagem ?? null;
    const dif = antes === null ? "" : p === antes ? `, igual a ${nomeDoMes(mesAnterior(n.mes))}` :
      `, ${plural(Math.abs(p - antes), "ponto", "pontos")} ${p > antes ? "acima" : "abaixo"} de ${nomeDoMes(mesAnterior(n.mes))}`;
    frases.push(`${p}% dos retornos foram dados no prazo combinado${dif}.`);
  }
  const top = [...(n.categorias ?? [])].filter((c) => c.registrados > 0).sort((x, y) => y.registrados - x.registrados)[0];
  if (top) frases.push(`${top.nome} foi a categoria com mais pedidos (${top.registrados}).`);
  return frases.join(" ");
}

// ---------------------------------------------------------------------------------------
// As linhas de cada parte: cabeçalho e células já em texto.

export interface Tabela { cabecalho: string[]; linhas: string[][] }

const semDados = (v: number | null | undefined, f: (x: number) => string) => (v === null || v === undefined ? "sem dados" : f(v));
const prazo = (r: Pick<LinhaGrupo, "retornos" | "noPrazo" | "porcentagem">) =>
  r.retornos === 0 ? "sem dados" : `${r.porcentagem}% · ${r.noPrazo} de ${r.retornos}`;
const tempo = (h: number | null | undefined) => semDados(h, (x) => mostrarDuracao(x));

export function tabelaAtendimento(n: NumerosRelatorio): Tabela | null {
  const x = n.atendimento;
  if (!x) return null;
  const col = (a: NumerosAtendimento) => [
    String(a.registrados), String(a.concluidos), String(a.reabertos),
    a.retornos.total === 0 ? "sem dados" : `${mostrarPorcentagem(a.retornos.porcentagem)} · ${a.retornos.noPrazo} de ${a.retornos.total}`,
    tempo(a.primeiroRetornoHoras),
  ];
  const atual = col(x.atual);
  const antes = col(x.anterior);
  const rotulos = ["Registrados", "Concluídos", "Reabertos", "Retornos no prazo", "Primeiro retorno, em média"];
  return {
    cabecalho: ["", maiuscula(nomeDoMes(n.mes)), maiuscula(nomeDoMes(mesAnterior(n.mes)))],
    linhas: rotulos.map((r, i) => [r, atual[i]!, antes[i]!]),
  };
}

function tabelaGrupos(primeira: string, linhas: LinhaGrupo[] | undefined): Tabela | null {
  if (!linhas) return null;
  return {
    cabecalho: [primeira, "Registrados", "Concluídos", "Tempo médio de fechamento", "Retornos no prazo"],
    linhas: linhas.map((l) => [l.nome, String(l.registrados), String(l.concluidos), tempo(l.tempoMedioHoras), prazo(l)]),
  };
}
export const tabelaCategorias = (n: NumerosRelatorio) => tabelaGrupos("Categoria", n.categorias);
export const tabelaTorres = (n: NumerosRelatorio) => tabelaGrupos("Onde", n.torres);

export function tabelaDecisoes(n: NumerosRelatorio): Tabela | null {
  const d = n.decisoes;
  if (!d) return null;
  const [a, m, dia] = n.ate.split("-");
  return {
    cabecalho: ["", maiuscula(nomeDoMes(n.mes))],
    linhas: [
      ["Pedidas", String(d.pedidas)],
      ["Decididas", d.devolvidas ? `${d.decididas} (${d.devolvidas} ${d.devolvidas === 1 ? "devolvida" : "devolvidas"})` : String(d.decididas)],
      ["Tempo típico até a resposta", tempo(d.medianaHoras)],
      [`Aguardando em ${dia}/${m}/${a}`, String(d.aguardandoNoFim)],
    ],
  };
}

export function tabelaReincidencia(n: NumerosRelatorio): Tabela | null {
  const r = n.reincidencia;
  if (!r) return null;
  const linhas = [["Pedidos que voltaram", r.pedidos === 0 ? "sem dados" : `${r.reincidencias} de ${r.pedidos} · ${mostrarPorcentagem(r.porcentagem)}`]];
  for (const o of r.ondeVolta) linhas.push([`${o.onde}${o.categoria ? ` · ${o.categoria}` : ""}`, plural(o.vezes, "vez", "vezes")]);
  return { cabecalho: ["", maiuscula(nomeDoMes(n.mes))], linhas };
}

/** A tabela de cada parte de números, na ordem do relatório. */
export function tabelasDoRelatorio(r: Pick<RelatorioGerado, "partes" | "conteudo">): { parte: ParteRelatorio; titulo: string; tabela: Tabela }[] {
  const f: Partial<Record<ParteRelatorio, (n: NumerosRelatorio) => Tabela | null>> = {
    ATENDIMENTO: tabelaAtendimento, CATEGORIA: tabelaCategorias, TORRE: tabelaTorres, DECISOES: tabelaDecisoes, REINCIDENCIA: tabelaReincidencia,
  };
  return r.partes.flatMap((p) => {
    const t = f[p]?.(r.conteudo);
    return t ? [{ parte: p, titulo: PARTES_RELATORIO[p].titulo, tabela: t }] : [];
  });
}

/** As tabelas numa planilha só (TR-08): uma linha por linha de tabela, com a parte na frente. */
export function planilhaDoRelatorio(r: Pick<RelatorioGerado, "partes" | "conteudo" | "mes" | "numero">): string {
  const celula = (t: string) => (/[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  const linhas: string[] = [[`Relatório de ${mesPorExtenso(r.mes)}`, `versão ${r.numero}`].map(celula).join(";")];
  for (const { titulo, tabela } of tabelasDoRelatorio(r)) {
    linhas.push("");
    linhas.push([titulo, ...tabela.cabecalho.slice(1)].map(celula).join(";"));
    for (const l of tabela.linhas) linhas.push(l.map(celula).join(";"));
  }
  if (r.conteudo.foraPorPermissao.length) {
    linhas.push("");
    linhas.push(celula(`Fora por permissão: ${r.conteudo.foraPorPermissao.map((p) => PARTES_RELATORIO[p].titulo).join(", ")}`));
  }
  return "﻿" + linhas.join("\r\n") + "\r\n";
}

/** Anexo A, B, C… na ordem do relatório. */
export const letraDoAnexo = (i: number) => String.fromCharCode(65 + i);

/** "relatorio-2026-09-v1.pdf". */
export const nomeDoArquivoRelatorio = (r: Pick<RelatorioGerado, "mes" | "numero">, ext: "pdf" | "csv") => `relatorio-${r.mes}-v${r.numero}.${ext}`;

/** O rodapé da folha: de quando são os números e o que ficou de fora. */
export function rodapeDoRelatorio(r: Pick<RelatorioGerado, "conteudo">, geradoEmTexto: string): string {
  const fora = r.conteudo.foraPorPermissao;
  const base = `Os números são os de ${geradoEmTexto}, quando o relatório foi gerado. Sem dados quer dizer que não houve caso no mês, e é diferente de zero. Pedido privado entra na conta, sem aparecer.`;
  return fora.length
    ? `${base} Gerado por ${r.conteudo.autor?.nome ?? "quem gerou"} com as partes que essa pessoa pode ver: ${fora.map((p) => PARTES_RELATORIO[p].titulo).join(", ")} ficou de fora.`
    : base;
}

/** Histórico (TR-08). */
export function descreverEventoRelatorio(acao: string, d: Record<string, unknown>): string | null {
  switch (acao) {
    case "relatorio.gerado":
      return `Relatório de ${mesPorExtenso(String(d.mes))} gerado (versão ${String(d.numero)})`;
    case "relatorio.modelo_guardado":
      return "Modelo do relatório do mês guardado";
    case "relatorio.baixado":
      return `Relatório de ${mesPorExtenso(String(d.mes))} baixado em ${d.formato === "CSV" ? "planilha" : "PDF"}`;
    default:
      return null;
  }
}
