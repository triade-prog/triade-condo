"use client";
// Peças comuns da agenda (peça R7; DC15, telas-modelo agenda-*): a situação em selo, a cor da
// origem (compromisso, preventiva, reserva, contrato, documento, assembleia, feriado) sempre com
// o nome ao lado, e o compromisso como cartão da lista.

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

/** O tipo com a cor da origem; a cor nunca vai sozinha. */
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

/** O horário em letra de código; o fim, menor, embaixo. */
function Hora({ inicio, fim }: { inicio?: string | null; fim?: string | null }) {
  return (
    <span className="hora">
      {inicio ? <code>{inicio}</code> : "Dia todo"}
      {fim ? <code className="fim">{fim}</code> : null}
    </span>
  );
}

/** A tela de onde a data vem, com o ícone de ligação. O nome para o leitor de tela começa com "Vem de". */
function Origem({ href, tela, alvo }: { href: string; tela: string; alvo?: boolean }) {
  return (
    <span className="linha">
      <Link href={href} className="ligado" data-alvo={alvo ? "" : undefined}>
        <Icone nome="link" className="h-3.5 w-3.5" /><span className="sr-only">Vem de </span>{tela}
      </Link>
    </span>
  );
}

const Seta = () => <span className="seta" aria-hidden="true"><Icone nome="dir" className="h-[18px] w-[18px]" /></span>;

/**
 * Um compromisso na lista (DC15, tela-modelo agenda-computador e agenda-celular): o cartão
 * inteiro abre o compromisso. Horário, faixa na cor da origem, título, situação, o tipo com o
 * lugar e quem participa, o pedido ou a manutenção ligada e a repetição.
 */
export function LinhaCompromisso({ c, acao }: { c: CompromissoAgenda; acao?: ReactNode }) {
  const cancelado = c.estado === "CANCELADO";
  return (
    <li className="ag-ev" data-tipo={c.tipo} data-cancelado={cancelado ? "" : undefined}>
      <Hora inicio={c.horaInicio} fim={c.horaFim} />
      <span className="barra" aria-hidden="true" />
      <span className="textos">
        <Link href={`/agenda/compromisso?id=${c.id}`} className="titulo" data-alvo="">{c.titulo}</Link>
        <span className="selos"><SeloSituacao estado={c.estado} /></span>
        <span className="detalhe">{resumoCompromisso(c)}</span>
        {c.pedido ? (
          <span className="linha">
            <Link href={`/pedidos/pedido?id=${c.pedido.id}`} className="ligado"><Icone nome="link" className="h-3.5 w-3.5" />Pedido {c.pedido.protocolo} · {c.pedido.assunto}</Link>
          </span>
        ) : null}
        {c.manutencao ? (
          <span className="linha">
            <Link href={`/manutencao/manutencao?id=${c.manutencao.id}`} className="ligado"><Icone nome="ferramenta" className="h-3.5 w-3.5" />Manutenção · {c.manutencao.titulo}</Link>
          </span>
        ) : null}
        {c.serie ? (
          <span className="linha nota"><Icone nome="trocar" className="h-3.5 w-3.5" />{descreverRepeticao({ ...c.serie, ate: null })}</span>
        ) : null}
        {cancelado && c.cancelamento ? <span className="linha nota">Cancelado: {c.cancelamento.motivo}</span> : null}
      </span>
      {acao ?? <Seta />}
    </li>
  );
}

/** Uma data de outra tela: sem edição, com a tela de onde vem. Sem página própria, o cartão leva à tela de origem. */
function LinhaDeFora({ d, hora, fim, titulo, href, selo, detalhe, origem }: {
  d: DataDeOutraTela; hora?: string | null; fim?: string | null; titulo: string; href?: string; selo?: ReactNode; detalhe: ReactNode;
  origem: { href: string; tela: string };
}) {
  return (
    <li className="ag-ev" data-tipo={d.fonte} data-fonte="">
      <Hora inicio={hora} fim={fim} />
      <span className="barra" aria-hidden="true" />
      <span className="textos">
        {href ? <Link href={href} className="titulo" data-alvo="">{titulo}</Link> : <span className="titulo">{titulo}</span>}
        {selo ? <span className="selos">{selo}</span> : null}
        <span className="detalhe">{detalhe}</span>
        <Origem {...origem} alvo={!href} />
      </span>
      <Seta />
    </li>
  );
}

/**
 * Data de outra tela (AG-09): feriado, preventiva, reserva confirmada, vencimento de contrato e
 * de documento e assembleia convocada. Cada uma leva à tela de origem.
 */
export function LinhaDataDeFora({ d, hoje }: { d: DataDeOutraTela; hoje: string }) {
  switch (d.fonte) {
    case "RESERVA":
      return (
        <LinhaDeFora d={d} hora={d.horaInicio} fim={d.horaFim} titulo={d.titulo} selo={<Selo tom="ok">Confirmada</Selo>}
          detalhe={`Reserva${d.quem ? ` · ${d.quem}` : ""}`} origem={{ href: "/vida", tela: "Vida em condomínio" }} />
      );
    case "CONTRATO":
      return (
        <LinhaDeFora d={d} titulo={`Vence o contrato de ${d.titulo}`} href={`/manutencao/prestador?id=${d.id}`}
          selo={<Selo tom="atencao">{textoVencimento(hoje, d.data)}</Selo>}
          detalhe="Contrato · renovar ou trocar antes" origem={{ href: "/manutencao/prestadores", tela: "Prestadores" }} />
      );
    case "DOCUMENTO":
      return (
        <LinhaDeFora d={d} titulo={`Vence ${d.titulo}`} href={`/comunicados/documento?id=${d.id}`}
          selo={<><Selo tom="erro">{textoVencimento(hoje, d.data)}</Selo>{d.restrito ? <Selo tom="neutro">Restrito</Selo> : null}</>}
          detalhe="Documento do prédio" origem={{ href: "/comunicados/documentos", tela: "Documentos" }} />
      );
    case "ASSEMBLEIA":
      return (
        <LinhaDeFora d={d} hora={d.horaInicio} fim={d.segundaChamada ? `2ª ${d.segundaChamada}` : null}
          titulo={d.titulo} href={`/vida/assembleia?id=${d.id}`}
          selo={<Selo tom="andamento">{d.estado === "EM_ANDAMENTO" ? "Em andamento" : "Convocada"}</Selo>}
          detalhe={`Assembleia${d.local ? ` · ${d.local}` : ""}`} origem={{ href: "/vida?aba=assembleias", tela: "Vida em condomínio" }} />
      );
    case "PREVENTIVA":
      return (
        <LinhaDeFora d={d} titulo={d.titulo} detalhe="Preventiva do plano de manutenção"
          origem={{ href: "/manutencao/preventivas", tela: "Manutenção › Preventivas" }} />
      );
    default:
      return (
        <LinhaDeFora d={d} titulo={d.titulo} detalhe="Feriado · os prazos não correm"
          origem={{ href: "/configuracoes/feriados", tela: "Configurações › Feriados" }} />
      );
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
