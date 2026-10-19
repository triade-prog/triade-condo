"use client";
// Peças comuns da agenda (peça R7, design "Telas da Agenda"): a situação em selo, o tipo com
// a cor dele e sempre o nome, e o compromisso como linha da lista.

import Link from "next/link";
import type { ReactNode } from "react";
import { descreverRepeticao, mostrarDataCurta, SITUACOES_COMPROMISSO, textoVencimento, TIPOS_COMPROMISSO } from "@triade/domain";
import { Icone, Selo, type Tom } from "@triade/ui";
import type { CompromissoAgenda, ConflitoCompromisso, DataDeOutraTela, SituacaoCompromisso } from "../tipos.ts";

const TOM_SITUACAO: Record<SituacaoCompromisso, Tom> = {
  PLANEJADO: "neutro", A_CONFIRMAR: "atencao", CONFIRMADO: "ok", REALIZADO: "info", CANCELADO: "neutro",
};

export function SeloSituacao({ estado }: { estado: SituacaoCompromisso }) {
  return <Selo tom={TOM_SITUACAO[estado]}>{SITUACOES_COMPROMISSO[estado]}</Selo>;
}

/** O tipo com a cor dele; a cor nunca vai sozinha. */
export function Tipo({ tipo }: { tipo: keyof typeof TIPOS_COMPROMISSO }) {
  return <span className="tp" data-tipo={tipo}>{TIPOS_COMPROMISSO[tipo]}</span>;
}

/** "Ana, Carla e 3 conselheiros": quem participa, com quem é de fora no fim. */
export function quemParticipa(c: Pick<CompromissoAgenda, "participantes" | "deFora">): string | null {
  const nomes = c.participantes.map((p) => p.nome.split(/\s+/)[0]!);
  if (c.deFora) nomes.push(c.deFora);
  if (nomes.length === 0) return null;
  return nomes.length === 1 ? nomes[0]! : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function resumoCompromisso(c: CompromissoAgenda): string {
  return [TIPOS_COMPROMISSO[c.tipo], c.lugar, quemParticipa(c)].filter(Boolean).join(" · ");
}

/** Um compromisso na lista: horário, faixa do tipo, título, situação, pedido e repetição. */
export function LinhaCompromisso({ c, acao }: { c: CompromissoAgenda; acao?: ReactNode }) {
  const cancelado = c.estado === "CANCELADO";
  return (
    <li className="ag-ev" data-tipo={c.tipo} data-cancelado={cancelado ? "" : undefined}>
      <span className="hora">
        {c.horaInicio ?? "Dia todo"}
        {c.horaFim ? <small>{c.horaFim}</small> : null}
      </span>
      <span className="barra" aria-hidden="true" />
      <span className="titulos grid min-w-0 gap-0.5">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          <Link href={`/agenda/compromisso?id=${c.id}`} className="titulo hover:text-violeta-600 hover:underline">{c.titulo}</Link>
          <SeloSituacao estado={c.estado} />
        </span>
        <span className="text-[13px] text-tinta-suave">{resumoCompromisso(c)}</span>
        {c.pedido ? (
          <Link href={`/pedidos/pedido?id=${c.pedido.id}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-violeta-600 hover:underline">
            <Icone nome="pedido" className="h-3.5 w-3.5" />Pedido {c.pedido.protocolo} · {c.pedido.assunto}
          </Link>
        ) : null}
        {c.manutencao ? (
          <Link href={`/manutencao/manutencao?id=${c.manutencao.id}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-violeta-600 hover:underline">
            <Icone nome="ferramenta" className="h-3.5 w-3.5" />Manutenção · {c.manutencao.titulo}
          </Link>
        ) : null}
        {c.serie ? (
          <span className="inline-flex items-center gap-1 text-[12.5px] text-tinta-suave"><Icone nome="trocar" className="h-3.5 w-3.5" />{descreverRepeticao({ ...c.serie, ate: null })}</span>
        ) : null}
        {cancelado && c.cancelamento ? <span className="text-[12.5px] text-tinta-suave">Cancelado: {c.cancelamento.motivo}</span> : null}
      </span>
      {acao ?? <span />}
    </li>
  );
}

/** Uma data de outra tela: tracejada, sem edição, com a tela de onde vem. */
function LinhaDeFora({ d, hora, fim, titulo, selo, detalhe }: {
  d: DataDeOutraTela; hora: string; fim?: string | null; titulo: ReactNode; selo?: ReactNode; detalhe: ReactNode;
}) {
  return (
    <li className="ag-ev" data-tipo={d.fonte} data-fonte="">
      <span className="hora">{hora}{fim ? <small>{fim}</small> : null}</span>
      <span className="barra" aria-hidden="true" />
      <span className="grid min-w-0 gap-0.5">
        <span className="flex flex-wrap items-center gap-2 font-medium">{titulo}{selo}</span>
        <span className="text-[13px] text-tinta-suave">{detalhe}</span>
      </span>
      <span />
    </li>
  );
}

const vemDe = (href: string, tela: string) => <Link href={href} className="font-medium text-violeta-600 hover:underline">{tela}</Link>;

/**
 * Data de outra tela (AG-09): feriado, preventiva, reserva confirmada, vencimento de contrato e
 * de documento e assembleia convocada. Cada uma leva à tela de origem.
 */
export function LinhaDataDeFora({ d, hoje }: { d: DataDeOutraTela; hoje: string }) {
  switch (d.fonte) {
    case "RESERVA":
      return (
        <LinhaDeFora d={d} hora={d.horaInicio ?? "Dia todo"} fim={d.horaFim} titulo={d.titulo} selo={<Selo tom="ok">Confirmada</Selo>}
          detalhe={<><span className="tp" data-tipo="RESERVA">Reserva</span>{d.quem ? ` · ${d.quem}` : ""} · vem de {vemDe("/vida", "Vida em condomínio")}</>} />
      );
    case "CONTRATO":
      return (
        <LinhaDeFora d={d} hora="Dia todo" titulo={<Link href={`/manutencao/prestador?id=${d.id}`} className="hover:text-violeta-600 hover:underline">Vence o contrato de {d.titulo}</Link>}
          selo={<Selo tom="atencao">{textoVencimento(hoje, d.data)}</Selo>}
          detalhe={<><span className="tp" data-tipo="CONTRATO">Contrato</span> · vem de {vemDe("/manutencao/prestadores", "Manutenção › Prestadores")} · renovar ou trocar antes</>} />
      );
    case "DOCUMENTO":
      return (
        <LinhaDeFora d={d} hora="Dia todo" titulo={<Link href={`/comunicados/documento?id=${d.id}`} className="hover:text-violeta-600 hover:underline">Vence {d.titulo}</Link>}
          selo={<><Selo tom="erro">{textoVencimento(hoje, d.data)}</Selo>{d.restrito ? <Selo tom="neutro">Restrito</Selo> : null}</>}
          detalhe={<><span className="tp" data-tipo="DOCUMENTO">Documento</span> · vem de {vemDe("/comunicados/documentos", "Comunicados e documentos")}</>} />
      );
    case "ASSEMBLEIA":
      return (
        <LinhaDeFora d={d} hora={d.horaInicio ?? "Dia todo"} fim={d.segundaChamada ? `2ª ${d.segundaChamada}` : null}
          titulo={<Link href={`/vida/assembleia?id=${d.id}`} className="hover:text-violeta-600 hover:underline">{d.titulo}</Link>}
          selo={<Selo tom="andamento">{d.estado === "EM_ANDAMENTO" ? "Em andamento" : "Convocada"}</Selo>}
          detalhe={<><span className="tp" data-tipo="ASSEMBLEIA">Assembleia</span>{d.local ? ` · ${d.local}` : ""} · vem de {vemDe("/vida?aba=assembleias", "Vida em condomínio")}</>} />
      );
    case "PREVENTIVA":
      return (
        <LinhaDeFora d={d} hora="Dia todo" titulo={`Preventiva: ${d.titulo}`}
          detalhe={<>Vem de {vemDe("/manutencao/preventivas", "Manutenção › Preventivas")}</>} />
      );
    default:
      return <LinhaDeFora d={d} hora="Dia todo" titulo={d.titulo} detalhe="Feriado · vem de Configurações › Feriados · os prazos não correm" />;
  }
}

/** O texto curto de uma data de outra tela, na semana e no mês. */
export function tituloCurto(d: DataDeOutraTela): string {
  if (d.fonte === "CONTRATO") return `Vence o contrato de ${d.titulo}`;
  if (d.fonte === "DOCUMENTO") return `Vence ${d.titulo}`;
  return d.titulo;
}

/** "Bruna Souza já está em "Vistoria da bomba", das 14:30 às 15:30." */
export function textoConflito(x: ConflitoCompromisso): string {
  const quando = x.horaInicio ? (x.horaFim ? `das ${x.horaInicio} às ${x.horaFim}` : `às ${x.horaInicio}`) : "o dia todo";
  const dia = mostrarDataCurta(x.data);
  if (x.reserva) return `A área está reservada: ${x.titulo}, em ${dia}, ${quando}.`;
  if (x.motivo === "LUGAR") return `O mesmo lugar já tem "${x.titulo}" em ${dia}, ${quando}.`;
  const quem = x.pessoas?.length ? x.pessoas.join(", ") : "Uma pessoa";
  return `${quem} já ${x.pessoas && x.pessoas.length > 1 ? "estão" : "está"} em "${x.titulo}" em ${dia}, ${quando}.`;
}

export function ListaConflitos({ conflitos }: { conflitos: ConflitoCompromisso[] }) {
  return (
    <ul className="grid gap-1">
      {conflitos.slice(0, 6).map((x, i) => (
        <li key={`${x.id}-${i}`}><Link href={x.reserva ? "/vida" : `/agenda/compromisso?id=${x.id}`} className="hover:underline">{textoConflito(x)}</Link></li>
      ))}
      {conflitos.length > 6 ? <li>E mais {conflitos.length - 6}.</li> : null}
    </ul>
  );
}
