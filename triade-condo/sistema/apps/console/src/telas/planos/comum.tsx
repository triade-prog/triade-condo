"use client";
// Peças de Planos e pagamentos no Console (0291; quadros 241 a 255 do canvas, aprovados em
// 23/10/2026): o que a API devolve, os selos do conjunto e da cobrança, a escolha em botões e o
// valor em reais lido sem ponto flutuante.

import type { ReactNode } from "react";
import { ErroDinheiro, lerReais, mostrarDataSemHora, type EstadoConjunto, type SituacaoCobranca } from "@triade/domain";
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
