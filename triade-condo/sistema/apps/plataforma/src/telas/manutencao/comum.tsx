"use client";
// Peças comuns da manutenção (peça R6; DC15, telas-modelo manutencao-computador e
// manutencao-celular): a situação em selo, o tipo, quem executa, as partes da manutenção
// (manutenções, preventivas e prestadores) num trilho e a manutenção como linha da lista,
// tabela no computador e cartão no celular.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { descreverExecutor, mostrarDataCurta, SITUACOES_MANUTENCAO, TIPOS_MANUTENCAO, TIPOS_PENDENCIA } from "@triade/domain";
import { Icone, Selo, type NomeIcone, type Tom } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import type { Executor, ManutencaoResumo, OpcoesManutencao, SituacaoManutencao } from "../tipos.ts";

const TOM_SITUACAO: Record<SituacaoManutencao, Tom> = {
  PLANEJADA: "info", EM_ANDAMENTO: "andamento", PENDENTE: "atencao", CONCLUIDA: "ok", CANCELADA: "neutro",
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
    { href: "/manutencao", texto: "Manutenções", icone: "ferramenta", atual: caminho === "/manutencao" || caminho.startsWith("/manutencao/manutencao") },
    { href: "/manutencao/preventivas", texto: "Preventivas", icone: "calendario", atual: caminho.startsWith("/manutencao/preventivas") },
    { href: "/manutencao/prestadores", texto: "Prestadores", icone: "pessoas", atual: caminho.startsWith("/manutencao/prestador") },
  ] as const;
  return (
    <nav aria-label="Partes da manutenção" className="trilho justify-self-start max-md:flex max-md:w-full max-md:justify-self-stretch">
      {partes.map((p) => (
        <Link key={p.href} href={p.href} className="chip max-md:flex-1 max-md:justify-center" aria-current={p.atual ? "page" : undefined} data-escolhido={p.atual ? "" : undefined}>
          <Icone nome={p.icone} className="max-md:hidden" />{p.texto}
        </Link>
      ))}
    </nav>
  );
}

/** O tipo, com a frequência quando vem de uma preventiva. */
export function textoTipo(m: Pick<ManutencaoResumo, "tipo">): string {
  return TIPOS_MANUTENCAO[m.tipo];
}

const DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Próximo retorno: em vermelho quando vence, em âmbar quando é hoje. */
export function Retorno({ m }: { m: ManutencaoResumo }) {
  if (!m.proximoRetorno) return null;
  if (m.retornoVencido) {
    return <span className="inline-flex items-center gap-1 t-apoio font-medium text-erro"><Icone nome="relogio" className="h-4 w-4" />Retorno venceu {diaHora(m.proximoRetorno)}</span>;
  }
  const quando = new Date(m.proximoRetorno);
  if (DIA.format(quando) === DIA.format(new Date())) {
    return <span className="inline-flex items-center gap-1 t-apoio font-medium text-atencao"><Icone nome="relogio" className="h-4 w-4" />Retorno hoje {HORA.format(quando)}</span>;
  }
  return <span className="t-apoio text-tinta-suave">Retorno {diaHora(m.proximoRetorno)}</span>;
}

/** O ícone de cada tipo; a preventiva é o calendário (DC15, rodada Manutenção). */
export const ICONE_TIPO: Record<ManutencaoResumo["tipo"], NomeIcone> = { CORRETIVA: "ferramenta", PREVENTIVA: "calendario", VISTORIA: "olho" };

/** A situação num selo só: "Pendente · Aguardando peça", "Planejada · para 25/10", "Atrasada · era em 11/10". */
function SeloDaLinha({ m }: { m: ManutencaoResumo }) {
  const dia = m.dataPrevista ? mostrarDataCurta(m.dataPrevista).slice(0, 5) : null;
  if (m.atrasada) return <Selo tom="erro">{dia ? `Atrasada · era em ${dia}` : "Atrasada"}</Selo>;
  const extra = m.pendencia ? nomePendencia(m.pendencia.tipo) : m.estado === "PLANEJADA" && dia ? `para ${dia}` : null;
  return <Selo tom={TOM_SITUACAO[m.estado]}>{SITUACOES_MANUTENCAO[m.estado]}{extra ? ` · ${extra}` : ""}</Selo>;
}

/** Uma manutenção na lista: tabela no computador, cartão no celular. A linha inteira abre a manutenção. */
export function LinhaManutencao({ m }: { m: ManutencaoResumo }) {
  const quem = nomeExecutor(m.executor);
  const responsavel = m.responsavel.nome ?? "Sem acesso agora";
  return (
    <li className="relative grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:grid-cols-[36px_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)_20px] md:border-t md:border-linha md:first:border-t-0">
      <span className="ladrilho self-start md:self-center" aria-hidden="true"><Icone nome={ICONE_TIPO[m.tipo]} /></span>
      <div className="grid min-w-0 gap-0.5">
        <span className="t-apoio md:hidden">{textoTipo(m)} · {quem}</span>
        <Link href={`/manutencao/manutencao?id=${m.id}`} className="font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600">{m.titulo}</Link>
        <span className="t-apoio flex flex-wrap items-center gap-x-2">
          <span>{m.local}{m.etapa ? ` · ${m.etapa.nome}` : ""}</span>
          {m.pedido ? (
            <Link href={`/pedidos/pedido?id=${m.pedido.id}`} className="relative z-[1] inline-flex items-center gap-1 font-medium text-violeta-600 hover:underline">
              <Icone nome="link" className="h-3.5 w-3.5" />Pedido {m.pedido.protocolo}
            </Link>
          ) : null}
        </span>
        {m.visita ? <span className="t-apoio font-medium text-violeta-600">Visita {mostrarDataCurta(m.visita.data).slice(0, 5)}{m.visita.horaInicio ? `, ${m.visita.horaInicio}` : ""}</span> : null}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 md:hidden"><SeloDaLinha m={m} /><Retorno m={m} /></span>
      </div>
      <span className="grid min-w-0 t-texto max-md:hidden">
        <span className="truncate">{quem}</span>
        <span className="t-apoio truncate">{textoTipo(m)} · {responsavel}</span>
      </span>
      <span className="max-md:hidden"><SeloDaLinha m={m} /></span>
      <span className="max-md:hidden"><Retorno m={m} /></span>
      <Icone nome="dir" className="h-5 w-5 text-tinta-suave" />
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
