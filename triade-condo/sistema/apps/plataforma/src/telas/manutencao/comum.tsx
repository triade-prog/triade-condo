"use client";
// Peças comuns da manutenção (peça R6, design "Telas da Manutenção"): a situação em selo, o
// tipo, quem executa, as partes da manutenção (manutenções, preventivas e prestadores) e a
// manutenção como linha da lista, no computador e no celular.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { descreverExecutor, mostrarDataCurta, SITUACOES_MANUTENCAO, TIPOS_MANUTENCAO, TIPOS_PENDENCIA } from "@triade/domain";
import { Icone, Selo, type Tom } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import type { Executor, ManutencaoResumo, OpcoesManutencao, SituacaoManutencao } from "../tipos.ts";

const TOM_SITUACAO: Record<SituacaoManutencao, Tom> = {
  PLANEJADA: "neutro", EM_ANDAMENTO: "andamento", PENDENTE: "erro", CONCLUIDA: "ok", CANCELADA: "neutro",
};

export function SeloManutencao({ estado }: { estado: SituacaoManutencao }) {
  return <Selo tom={TOM_SITUACAO[estado]}>{SITUACOES_MANUTENCAO[estado]}</Selo>;
}

export const nomeExecutor = (e: Executor | undefined) => descreverExecutor(e);
export const nomePendencia = (t: string) => TIPOS_PENDENCIA[t as keyof typeof TIPOS_PENDENCIA] ?? t;

/** As três partes da manutenção, juntas no topo de cada uma. */
export function PartesManutencao() {
  const caminho = usePathname();
  const partes = [
    { href: "/manutencao", texto: "Manutenções", atual: caminho === "/manutencao" || caminho.startsWith("/manutencao/manutencao") },
    { href: "/manutencao/preventivas", texto: "Preventivas", atual: caminho.startsWith("/manutencao/preventivas") },
    { href: "/manutencao/prestadores", texto: "Prestadores", atual: caminho.startsWith("/manutencao/prestador") },
  ];
  return (
    <nav aria-label="Partes da manutenção" className="trilho justify-self-start">
      {partes.map((p) => (
        <Link key={p.href} href={p.href} className="chip" aria-current={p.atual ? "page" : undefined} data-escolhido={p.atual ? "" : undefined}>
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}

/** O tipo, com a frequência quando vem de uma preventiva. */
export function textoTipo(m: Pick<ManutencaoResumo, "tipo">): string {
  return TIPOS_MANUTENCAO[m.tipo];
}

/** Próximo retorno: em vermelho quando vence. */
export function Retorno({ m }: { m: ManutencaoResumo }) {
  if (!m.proximoRetorno) return <span className="text-tinta-suave">Sem retorno</span>;
  if (m.retornoVencido) {
    return <span className="inline-flex items-center gap-1 font-medium text-erro"><Icone nome="relogio" className="h-4 w-4" />venceu {diaHora(m.proximoRetorno)}</span>;
  }
  return <span>{diaHora(m.proximoRetorno)}</span>;
}

/** Uma manutenção na lista: tabela no computador, cartão no celular. */
export function LinhaManutencao({ m }: { m: ManutencaoResumo }) {
  return (
    <li className="grid gap-1.5 border-b border-linha px-4 py-3 last:border-b-0 md:grid-cols-[8.5rem_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_8.5rem] md:items-center md:gap-4">
      <span className="flex flex-wrap items-center gap-2"><SeloManutencao estado={m.estado} />{m.atrasada ? <Selo tom="erro">Atrasada</Selo> : null}</span>
      <span className="grid min-w-0 gap-0.5">
        <Link href={`/manutencao/manutencao?id=${m.id}`} className="font-medium hover:text-violeta-600 hover:underline">{m.titulo}</Link>
        <span className="text-[13px] text-tinta-suave">{m.local}{m.etapa ? ` · ${m.etapa.nome}` : ""}</span>
        {m.pedido ? <span className="text-[12.5px] font-medium text-violeta-600">Pedido {m.pedido.protocolo}</span> : null}
        {m.visita ? <span className="text-[12.5px] font-medium text-violeta-600">Visita {mostrarDataCurta(m.visita.data).slice(0, 5)}{m.visita.horaInicio ? `, ${m.visita.horaInicio}` : ""}</span> : null}
        {m.pendencia ? <span className="text-[12.5px] text-erro">{nomePendencia(m.pendencia.tipo)}</span> : null}
      </span>
      <span className="text-sm"><span className="text-tinta-suave md:hidden">Tipo: </span>{textoTipo(m)}{m.dataPrevista ? <span className="block text-xs text-tinta-suave">para {mostrarDataCurta(m.dataPrevista)}</span> : null}</span>
      <span className="text-sm"><span className="text-tinta-suave md:hidden">Quem executa: </span>{nomeExecutor(m.executor)}</span>
      <span className="text-sm"><span className="text-tinta-suave md:hidden">Responsável: </span>{m.responsavel.nome ?? "Sem acesso agora"}</span>
      <span className="text-sm"><span className="text-tinta-suave md:hidden">Próximo retorno: </span><Retorno m={m} /></span>
    </li>
  );
}

/** Opções de quem executa, para os formulários: prestadores, equipe ou escrito à mão. */
export function opcoesExecutor(o: OpcoesManutencao, atual?: Executor) {
  const lista = [
    { valor: "", texto: "Ninguém ainda" },
    ...o.prestadores.map((p) => ({ valor: `P:${p.id}`, texto: `${p.nome} · ${p.servico}` })),
    ...o.pessoas.map((p) => ({ valor: `E:${p.vinculoId}`, texto: `${p.nome} (equipe)` })),
    { valor: "T", texto: "Outro: escrever o nome" },
  ];
  if (atual?.tipo === "PRESTADOR" && atual.id && !o.prestadores.some((p) => p.id === atual.id)) {
    lista.splice(1, 0, { valor: `P:${atual.id}`, texto: `${atual.nome} (arquivado)` });
  }
  return lista;
}

/** Valor do campo de executor a partir do executor gravado. */
export function valorExecutor(e: Executor | undefined): { escolha: string; texto: string } {
  if (!e) return { escolha: "", texto: "" };
  if (e.tipo === "PRESTADOR") return { escolha: `P:${e.id}`, texto: "" };
  if (e.tipo === "EQUIPE") return { escolha: `E:${e.id}`, texto: "" };
  return { escolha: "T", texto: e.nome };
}

/** Do campo para a API: um prestador, alguém da equipe, um nome ou ninguém. */
export function executorParaApi(escolha: string, texto: string) {
  return {
    prestadorId: escolha.startsWith("P:") ? escolha.slice(2) : null,
    executorVinculoId: escolha.startsWith("E:") ? escolha.slice(2) : null,
    executorTexto: escolha === "T" ? texto.trim() || null : null,
  };
}
