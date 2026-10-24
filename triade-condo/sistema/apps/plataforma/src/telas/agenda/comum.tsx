"use client";
// Peças comuns da agenda (peça R7; DC15, telas-modelo agenda-*): a situação em selo, a cor da
// origem (compromisso, preventiva, reserva, contrato, documento, assembleia, enquete, feriado)
// sempre com o nome ao lado, o compromisso como cartão da lista e a faixa das enquetes abertas.

import Link from "next/link";
import type { ReactNode } from "react";
import {
  descreverRepeticao, diasEntre, mostrarDataCurta, porcentagem, SITUACOES_COMPROMISSO, textoFechamento, textoVencimento, TIPOS_COMPROMISSO,
} from "@triade/domain";
import { Icone, Selo, type Tom } from "@triade/ui";
import type { CompromissoAgenda, ConflitoCompromisso, DataDeOutraTela, EnqueteNaAgenda, SituacaoCompromisso } from "../tipos.ts";

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

/** O selo de quanto falta para a enquete fechar: hoje em vermelho, até 3 dias em âmbar (R7.2). */
function SeloFechamento({ hoje, data }: { hoje: string; data: string }) {
  const n = diasEntre(hoje, data);
  return <Selo tom={n <= 0 ? "erro" : n <= 3 ? "atencao" : "neutro"}><Icone nome="relogio" className="h-3.5 w-3.5" />{textoFechamento(hoje, data)}</Selo>;
}

/** "3 de 5 unidades responderam": só a contagem, também na secreta (R7.2). */
function quantosDeQuantos(e: { responderam?: number; total?: number; por?: "UNIDADE" | "PESSOA" }): string {
  return `${e.responderam ?? 0} de ${e.total ?? 0} ${e.por === "PESSOA" ? "pessoas" : "unidades"}`;
}

function textoResponderam(e: { responderam?: number; total?: number; por?: "UNIDADE" | "PESSOA" }): string {
  return `${quantosDeQuantos(e)} responderam`;
}

/**
 * Data de outra tela (AG-09): feriado, preventiva, reserva confirmada, vencimento de contrato e
 * de documento, assembleia convocada e enquete aberta, no dia em que fecha (R7.2). Cada uma leva
 * à tela de origem.
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
        <LinhaDeFora d={d} titulo={`Vence ${d.titulo}`} href={`/documentos/documento?id=${d.id}`}
          selo={<><Selo tom="erro">{textoVencimento(hoje, d.data)}</Selo>{d.restrito ? <Selo tom="neutro">Restrito</Selo> : null}</>}
          detalhe="Documento do prédio" origem={{ href: "/documentos", tela: "Documentos" }} />
      );
    case "ASSEMBLEIA":
      return (
        <LinhaDeFora d={d} hora={d.horaInicio} fim={d.segundaChamada ? `2ª ${d.segundaChamada}` : null}
          titulo={d.titulo} href={`/vida/assembleia?id=${d.id}`}
          selo={<Selo tom="andamento">{d.estado === "EM_ANDAMENTO" ? "Em andamento" : "Convocada"}</Selo>}
          detalhe={`Assembleia${d.local ? ` · ${d.local}` : ""}`} origem={{ href: "/vida?aba=assembleias", tela: "Vida em condomínio" }} />
      );
    case "ENQUETE":
      return (
        <LinhaDeFora d={d} hora={d.horaInicio} titulo={`Fecha a enquete: ${d.titulo}`} href={`/vida/enquete?id=${d.id}`}
          selo={<SeloFechamento hoje={hoje} data={d.data} />}
          detalhe={`Enquete · ${textoResponderam(d)}${d.secreta ? " · secreta" : ""}`}
          origem={{ href: "/vida?aba=enquetes", tela: "Vida em condomínio" }} />
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
  if (d.fonte === "ENQUETE") return `Fecha: ${d.titulo}`;
  return d.titulo;
}

/**
 * A faixa "Enquetes abertas agora", no alto da Lista (R7.2, decisão A.1): todas as abertas, mesmo
 * as que fecham depois do período, com o prazo e quantos responderam. Cada uma abre a ficha.
 */
export function EnquetesAbertas({ enquetes, hoje }: { enquetes: EnqueteNaAgenda[]; hoje: string }) {
  return (
    <section aria-labelledby="ag-enquetes" className="ag-enq">
      <div className="cab">
        <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome="grafico" className="h-[18px] w-[18px]" /></span>
        <h2 id="ag-enquetes" className="t-titulo-cartao">Enquetes abertas agora</h2>
        <span className="quantas"><span aria-hidden="true">{enquetes.length}</span><span className="sr-only">{`${enquetes.length} ${enquetes.length === 1 ? "aberta" : "abertas"}`}</span></span>
        <Link href="/vida?aba=enquetes" className="ligado ml-auto"><Icone nome="link" className="h-3.5 w-3.5" />Vida em condomínio › Enquetes</Link>
      </div>
      <ul>
        {enquetes.map((e) => (
          <li key={e.id} className="ag-ev" data-tipo="ENQUETE">
            <span className="barra" aria-hidden="true" />
            <span className="textos">
              <span className="pergunta">
                <Link href={`/vida/enquete?id=${e.id}`} className="titulo" data-alvo="">{e.titulo}</Link>
                {e.secreta ? <Selo tom="neutro"><Icone nome="cadeado" className="h-3.5 w-3.5" />Secreta</Selo> : null}
              </span>
              <span className="prazo">Fecha {mostrarDataCurta(e.data).slice(0, 5)}, às {e.horaInicio} <SeloFechamento hoje={hoje} data={e.data} /></span>
              <span className="quanto">
                <span className="trilha" aria-hidden="true"><span style={{ width: `${porcentagem(e.responderam, e.total)}%` }} /></span>
                <span><b>{quantosDeQuantos(e)}</b> responderam</span>
              </span>
            </span>
            <Seta />
          </li>
        ))}
      </ul>
    </section>
  );
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
