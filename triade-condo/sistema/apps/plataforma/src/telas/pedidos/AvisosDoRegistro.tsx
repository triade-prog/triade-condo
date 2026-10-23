"use client";
// O que saiu no registro do pedido (F6.4, AT-26; desenho "Aviso de pedido registrado", telas 4
// e 5): a confirmação logo depois de registrar e o cartão Avisos do registro no pedido. Cada
// linha diz quem, por onde e em que pé está (W-13): no sino, na fila, entregue, lida, falhou.
// O WhatsApp de quem atende espera o horário de funcionamento; a falha vai para Falhas de envio.
// Com o link do serviço (F6.7; desenho "Link do serviço no registro", telas 4 e 5), a linha do
// prestador diz a resposta dele e leva à manutenção que nasceu no registro.

import Link from "next/link";
import type { ReactNode } from "react";
import { DESTINOS_AVISO_REGISTRO, MEIOS_AVISO_REGISTRO, SITUACOES_LINK_REGISTRO, SITUACOES_MANUTENCAO } from "@triade/domain";
import { Botao, Icone, Selo, type NomeIcone } from "@triade/ui";
import type { AvisoDoRegistro, LinkDoRegistro } from "../tipos.ts";
import { diaHora } from "./comum.tsx";

export interface Registrado { id: string; protocolo: string; linha: string; avisos: AvisoDoRegistro[]; arquivos?: number }

const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const hora = (iso: string) => HORA.format(new Date(iso));

type Tom = "ok" | "info" | "atencao" | "erro" | "neutro" | "andamento";

/** A situação de um aviso, em palavras e com tom (nunca só a cor). */
export function situacaoAviso(a: AvisoDoRegistro): { texto: string; tom: Tom } {
  if (a.meio === "SINO") return a.vistoEm ? { texto: `Visto ${hora(a.vistoEm)}`, tom: "ok" } : { texto: "No sino", tom: "info" };
  if (a.meio === "COMUNICADO") {
    const n = a.emails ?? 0;
    const w = a.whatsapps ? ` · ${a.whatsapps} pelo WhatsApp` : "";
    return a.situacao === "PUBLICADO" ? { texto: `Publicado · ${n} ${n === 1 ? "e-mail" : "e-mails"}${w}`, tom: "ok" } : { texto: "Comunicado", tom: "neutro" };
  }
  if (a.parado) return { texto: "Parado na queda do WhatsApp", tom: "atencao" };
  switch (a.situacao) {
    case "NA_FILA":
      return a.enviarApos ? { texto: `Sai ${diaHora(a.enviarApos)}`, tom: "andamento" } : { texto: "Na fila", tom: "andamento" };
    case "ENVIANDO": return { texto: "Saindo", tom: "andamento" };
    case "ENVIADA": case "ENVIADO": return { texto: "Enviada", tom: "info" };
    case "ENTREGUE": return { texto: a.entregueEm ? `Entregue ${hora(a.entregueEm)}` : "Entregue", tom: "ok" };
    case "LIDA": return { texto: a.lidoEm ? `Lida ${hora(a.lidoEm)}` : "Lida", tom: "ok" };
    case "FALHOU": case "DEVOLVIDO": case "SPAM": return { texto: "Falhou", tom: "erro" };
    case "DESCONHECIDO": return { texto: "Pode ter saído", tom: "atencao" };
    case "CANCELADA": case "CANCELADO": return { texto: "Não saiu", tom: "neutro" };
    case "NA_CONVERSA": return { texto: "Na conversa", tom: "info" };
    default: return { texto: a.situacao ?? "", tom: "neutro" };
  }
}

/** Em que pé está o link do serviço: a resposta do prestador, ou o prazo que corre. */
export function situacaoLink(l: LinkDoRegistro): { texto: string; tom: Tom } {
  switch (l.situacao) {
    case "ESPERANDO_ENVIO": return { texto: SITUACOES_LINK_REGISTRO.ESPERANDO_ENVIO, tom: "andamento" };
    case "ESPERANDO": return { texto: l.responderAte ? `Esperando resposta até ${hora(l.responderAte)}` : SITUACOES_LINK_REGISTRO.ESPERANDO, tom: "andamento" };
    case "SEM_RESPOSTA": return { texto: SITUACOES_LINK_REGISTRO.SEM_RESPOSTA, tom: "atencao" };
    case "CONFIRMOU": return { texto: l.respondidoEm ? `Confirmou às ${hora(l.respondidoEm)}` : "Confirmou", tom: "ok" };
    case "CHEGOU": return { texto: SITUACOES_LINK_REGISTRO.CHEGOU, tom: "ok" };
    case "RECUSOU": return { texto: SITUACOES_LINK_REGISTRO.RECUSOU, tom: "atencao" };
    case "PASSOU_RESERVA": return { texto: SITUACOES_LINK_REGISTRO.PASSOU_RESERVA, tom: "info" };
    default: return { texto: SITUACOES_LINK_REGISTRO[l.situacao] ?? l.situacao, tom: "neutro" };
  }
}

/** A situação da linha: a falha do envio vem antes; depois, a do link. */
function situacaoDaLinha(a: AvisoDoRegistro): { texto: string; tom: Tom } {
  const s = situacaoAviso(a);
  return a.link && s.tom !== "erro" && !a.parado ? situacaoLink(a.link) : s;
}

/** "WhatsApp", "E-mail", "E-mail e mural", "WhatsApp · link do serviço". */
function porOnde(a: AvisoDoRegistro): string {
  if (a.meio === "COMUNICADO") return a.noMural ? "E-mail e mural" : "E-mail";
  return a.link ? `${MEIOS_AVISO_REGISTRO[a.meio]} · link do serviço` : MEIOS_AVISO_REGISTRO[a.meio];
}

const abrirManutencao = (l: LinkDoRegistro) => `/manutencao/manutencao?id=${l.manutencaoId}`;

function quem(a: AvisoDoRegistro): string {
  if (a.destino === "MORADORES") return a.nome ? `Moradores · ${a.nome}` : "Moradores";
  return `${a.nome ?? ""}, ${DESTINOS_AVISO_REGISTRO[a.destino].toLowerCase()}`;
}

const ICONE_MEIO: Record<string, NomeIcone> = { SINO: "sino", WHATSAPP: "whats", EMAIL: "email", COMUNICADO: "megafone", CONVERSA: "whats" };

/** Pedido registrado (DC15, telas-modelo/pedido-registrado): o protocolo em destaque, cada aviso
 * com a situação e as duas saídas. Registrado com as mensagens do WhatsApp, `extra` diz se elas
 * foram juntadas, e sem `outro` não há Registrar outro. */
export function ConfirmacaoRegistro({ feito, outro, abrir, extra }: { feito: Registrado; outro?: () => void; abrir: () => void; extra?: ReactNode }) {
  const linhas = feito.avisos.filter((a) => a.meio !== "CONVERSA");
  const falhas = linhas.filter((a) => situacaoAviso(a).tom === "erro");
  const link = linhas.find((a) => a.link)?.link;
  const esperando = linhas.some((a) => a.enviarApos);
  return (
    <div className="grid gap-4" role="status">
      <div className="grid justify-items-center gap-2 text-center">
        <span className="ladrilho h-14 w-14 rounded-[18px]" data-tom="ok" aria-hidden="true"><Icone nome="check" className="h-7 w-7" /></span>
        <p className="t-titulo-secao">Pedido registrado</p>
        <p className="font-mono t-titulo-secao font-medium tracking-[.02em]">{feito.protocolo}</p>
        <p className="t-apoio">{feito.linha}</p>
      </div>
      {extra}
      {linhas.length === 0 ? (
        <p className="t-apoio">Ninguém foi avisado: não havia contato para o protocolo e quem cuida do pedido é você.</p>
      ) : (
        <div className="grid gap-1">
          <p className="t-rotulo">Avisos do registro</p>
          <ul aria-label="Quem foi avisado" className="divide-y divide-linha border-t border-linha">
            {linhas.map((a, i) => {
              const s = situacaoDaLinha(a);
              return (
                <li key={i} className="flex items-center gap-3 py-3">
                  <span className="ladrilho" data-tom={s.tom === "ok" ? "ok" : "violeta"} aria-hidden="true"><Icone nome={ICONE_MEIO[a.meio] ?? "sino"} /></span>
                  <span className="grid min-w-0 flex-1">
                    <span className="font-medium">{quem(a)}</span>
                    <span className="t-apoio">{porOnde(a)}{a.pelaRegra ? " · pela regra" : ""}</span>
                  </span>
                  <Selo tom={s.tom}>{s.texto}</Selo>
                </li>
              );
            })}
            {feito.arquivos ? (
              <li className="flex items-center gap-3 py-3">
                <span className="ladrilho" aria-hidden="true"><Icone nome="clipe" /></span>
                <span className="grid min-w-0 flex-1">
                  <span className="font-medium">{feito.arquivos === 1 ? "1 arquivo" : `${feito.arquivos} arquivos`}</span>
                  <span className="t-apoio">Guardado no pedido, junto com o relato</span>
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      )}
      {link ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-linha p-3">
          <span>
            <span className="block font-medium">Manutenção corretiva criada</span>
            <span className="t-apoio block">
              {link.titulo} · ligada a este pedido
              {link.reserva ? ` · se não responder, passa para ${link.reserva.nome}` : " · sem reserva no cadastro"}
            </span>
          </span>
          <Link href={abrirManutencao(link)} className="t-texto font-medium text-violeta-600 hover:underline" aria-label={`Abrir a manutenção ${link.titulo}`}>Abrir</Link>
        </div>
      ) : null}
      {link?.situacao === "ESPERANDO_ENVIO" ? <p className="t-apoio">O prazo para responder só começa quando a mensagem sai.</p> : null}
      {esperando ? <p className="t-apoio">O WhatsApp de quem atende espera o horário de funcionamento. O sino já avisou.</p> : null}
      {falhas.length ? <p className="t-apoio">O que falhou vai para Falhas de envio, com responsável. O pedido fica registrado do mesmo jeito.</p> : null}
      <div className="flex flex-wrap justify-end gap-2 max-md:grid max-md:grid-cols-1">
        {outro ? <Botao variante="contorno" onClick={outro}><Icone nome="mais" />Registrar outro</Botao> : null}
        <Botao onClick={abrir}><Icone nome="seta" />Abrir o pedido</Botao>
      </div>
    </div>
  );
}

/** Uma pessoa (ou prestador, ou público) com os meios juntos: "Ana Lima · sino e WhatsApp, lida 10:31". */
function agrupar(avisos: AvisoDoRegistro[]) {
  const grupos: { chave: string; destino: AvisoDoRegistro["destino"]; nome?: string; itens: AvisoDoRegistro[] }[] = [];
  for (const a of avisos) {
    const chave = `${a.destino}|${a.nome ?? ""}`;
    const g = grupos.find((x) => x.chave === chave);
    if (g) g.itens.push(a); else grupos.push({ chave, destino: a.destino, nome: a.nome, itens: [a] });
  }
  return grupos;
}

const MEIO_NA_FRASE: Record<string, string> = { SINO: "sino", WHATSAPP: "WhatsApp", EMAIL: "e-mail", COMUNICADO: "comunicado", CONVERSA: "conversa do WhatsApp" };

export function CartaoAvisosRegistro({ avisos }: { avisos: AvisoDoRegistro[] }) {
  if (!avisos.length) return null;
  const grupos = agrupar(avisos);
  return (
    <section aria-labelledby="t-avisos-registro" className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <h2 id="t-avisos-registro" className="t-rotulo font-medium tracking-[.1em] text-tinta-suave uppercase">Avisos do registro</h2>
      <ul className="grid gap-2">
        {grupos.map((g) => {
          const envio = g.itens.find((x) => x.meio !== "SINO") ?? g.itens[0]!;
          const s = situacaoDaLinha(envio);
          const meios = g.itens.map((x) => (x.link ? `link pelo ${MEIO_NA_FRASE[x.meio] ?? x.meio}` : MEIO_NA_FRASE[x.meio] ?? x.meio));
          const nomeMeios = meios.length > 1 ? `${meios.slice(0, -1).join(", ")} e ${meios[meios.length - 1]}` : meios[0];
          return (
            <li key={g.chave} className="grid gap-0.5 t-texto sm:grid-cols-[120px_1fr_auto] sm:items-center sm:gap-3">
              <span className="t-apoio text-tinta-suave">{DESTINOS_AVISO_REGISTRO[g.destino]}</span>
              <span>
                <span className="font-medium">{g.nome ?? ""}</span>
                <span className="text-tinta-suave"> · {nomeMeios}{g.itens.some((x) => x.pelaRegra) ? " · pela regra" : ""}{g.itens.some((x) => x.editado) ? " · texto editado" : ""}</span>
                {envio.motivo ? <span className="block t-apoio text-erro">{envio.motivo}</span> : null}
                {s.tom === "erro" && envio.meio === "WHATSAPP" ? <Link href="/whatsapp?parte=falhas" className="block t-apoio text-violeta-600 hover:underline">Resolver em WhatsApp › Falhas de envio</Link> : null}
                {envio.link ? (
                  <span className="block t-apoio text-tinta-suave">
                    Manutenção{" "}
                    <Link href={abrirManutencao(envio.link)} className="text-violeta-600 underline">{envio.link.titulo}</Link>
                    {" · "}{(SITUACOES_MANUTENCAO as Record<string, string>)[envio.link.estadoManutencao]?.toLowerCase() ?? envio.link.estadoManutencao}
                    {envio.link.situacao === "PASSOU_RESERVA" && envio.link.paraReserva ? ` · passou para ${envio.link.paraReserva}` : ""}
                  </span>
                ) : null}
              </span>
              <span><Selo tom={s.tom}>{s.texto}</Selo></span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
