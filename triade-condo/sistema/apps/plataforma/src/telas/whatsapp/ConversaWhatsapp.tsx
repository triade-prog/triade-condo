"use client";
// A conversa do WhatsApp no pedido (passo 5; W-05, W-10, W-13, W-14, AT-06), no padrão novo
// (canvas do novo frontend, quadros 113 a 116): a conversa fica logo abaixo do topo da ficha
// quando o pedido tem mensagens (decisão D.1 de 22/10/2026), com as três últimas e o resto em
// "Ver a conversa inteira". Cada mensagem tem o estado dela, separado do estado do pedido.
// Responder pelo WhatsApp é dar retorno (decisão C.1): fica em "Dar retorno ao morador", como
// "Pelo WhatsApp", e conta na hora do registro; a falha de envio é tratada à parte. O pedido de
// revisão do morador sobe para uma faixa no alto e nunca reabre sozinho: reabrir é pelo caminho
// de sempre, ou o pedido segue concluído com uma resposta ao morador.

import { useState, type ReactNode } from "react";
import {
  diaDaConversa, ESTADOS_ENVIO_WHATSAPP, formatarDataHora, LIMITE_FORA_DA_JANELA, MIDIAS_WHATSAPP, type EstadoEnvioWhatsapp, type MidiaWhatsapp,
} from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, camposComErro, chamarApi, Dialogo, Icone, Selo, textoDoErro, type ErroApi, type Tom } from "@triade/ui";

interface MensagemConversa {
  id: string;
  lado: "MORADOR" | "CONDOMINIO";
  tipo: string;
  texto?: string;
  em: string;
  autor?: string;
  finalidade?: "RESPOSTA" | "RETORNO" | "CONCLUSAO";
  modelo?: boolean;
  estado?: EstadoEnvioWhatsapp;
  motivo?: string;
  resolvida?: boolean;
  midia?: { tipo: MidiaWhatsapp; situacao: string; motivo?: string; arquivoId?: string };
}

interface Revisao {
  id: string;
  texto: string;
  em: string;
  decisao?: "REABERTO" | "MANTIDO";
  decididaEm?: string;
  decididaPor?: string;
  resposta?: string;
}

/** A conversa no WhatsApp (W-20): aberta por 24 horas desde a última mensagem do morador. */
export interface JanelaWhatsapp {
  aberta: boolean;
  ate?: string;
  limite: number;
  parou: boolean;
  modelo?: { titulo: string; previa: string };
}

export interface ConversaDoPedido {
  mensagens: MensagemConversa[];
  revisoes: Revisao[];
  janela?: JanelaWhatsapp;
  pode: { responder: boolean; decidirRevisao: boolean };
}

const TOM_ESTADO: Record<EstadoEnvioWhatsapp, Tom> = {
  NA_FILA: "neutro", ENVIANDO: "andamento", ENVIADA: "andamento", ENTREGUE: "ok", LIDA: "ok", FALHOU: "erro", DESCONHECIDO: "atencao", CANCELADA: "neutro",
};

/** Quantas mensagens a ficha mostra antes de "Ver a conversa inteira". */
const NA_FICHA = 3;

/** O separador do dia na conversa. */
export function SeparadorDia({ children }: { children: ReactNode }) {
  return (
    <li aria-hidden="true" className="flex items-center gap-2.5 t-apoio font-semibold text-tinta-suave">
      <span className="h-px flex-1 bg-linha" />{children}<span className="h-px flex-1 bg-linha" />
    </li>
  );
}

/** Uma mensagem: a do morador à esquerda, a do condomínio à direita, com quem e quando embaixo. */
export function Bolha({ lado, children, rodape }: { lado: "MORADOR" | "CONDOMINIO"; children: ReactNode; rodape: ReactNode }) {
  return (
    <li className={`grid max-w-[min(560px,85%)] gap-1.5 border px-3.5 py-2.5 t-texto ${lado === "CONDOMINIO"
      ? "justify-self-end rounded-[16px_4px_16px_16px] border-violeta-200 bg-violeta-50" : "justify-self-start rounded-[4px_16px_16px_16px] border-linha bg-superficie-2"}`}>
      {children}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 t-apoio text-tinta-suave">{rodape}</span>
    </li>
  );
}

/** As mensagens com o separador do dia antes da primeira de cada dia. */
export function comDias<T>(itens: T[], em: (x: T) => string, agora: string, linha: (x: T) => ReactNode): ReactNode[] {
  const saida: ReactNode[] = [];
  let dia = "";
  itens.forEach((x, i) => {
    const d = diaDaConversa(em(x), agora);
    if (d !== dia) saida.push(<SeparadorDia key={`dia-${i}`}>{d}</SeparadorDia>);
    dia = d;
    saida.push(linha(x));
  });
  return saida;
}

const hora = (iso: string) => formatarDataHora(iso).slice(-5);

/** Os pedidos de revisão do morador ainda sem decisão, numa faixa no alto da ficha. */
export function FaixaRevisao({ conversa, aoReabrir, salvo }: {
  conversa: ConversaDoPedido | null; aoReabrir?: () => void; salvo: (texto: string) => void;
}) {
  const [manter, setManter] = useState<Revisao | null>(null);
  const [resposta, setResposta] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const pendentes = conversa?.revisoes.filter((r) => !r.decisao) ?? [];
  if (!conversa || !pendentes.length) return null;

  async function manterConcluido() {
    if (!manter) return;
    setErro(null);
    const r = await chamarApi(`/v1/condominio/whatsapp/revisoes/${manter.id}/manter`, { corpo: { resposta } });
    if (!r.ok) return setErro(r.erro);
    setManter(null);
    setResposta("");
    salvo("Resposta enviada ao morador. O pedido segue concluído.");
  }

  return (
    <>
      {pendentes.map((r) => (
        <section key={r.id} aria-label="Pedido de revisão pelo WhatsApp" data-tom="atencao" className="aviso flex-wrap items-center justify-between">
          <span className="quadro"><Icone nome="balao" /></span>
          <span className="texto">
            <strong className="block font-semibold">O morador pediu revisão pelo WhatsApp</strong>
            <span className="block">“{r.texto}” · {formatarDataHora(r.em)}. O pedido não reabre sozinho: reabra ou responda mantendo concluído.</span>
          </span>
          {conversa.pode.decidirRevisao ? (
            <span className="flex flex-wrap gap-2">
              <Botao variante="contorno" tamanho="m" onClick={() => setManter(r)}>Manter concluído e responder</Botao>
              {aoReabrir ? <Botao variante="contorno" tamanho="m" onClick={aoReabrir}><Icone nome="trocar" />Reabrir o pedido</Botao> : null}
            </span>
          ) : null}
        </section>
      ))}
      {manter ? (
        <Dialogo aberto titulo="Manter concluído e responder" aoFechar={() => setManter(null)}>
          <div className="grid gap-4">
            {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
            <p className="t-texto">O morador escreveu: “{manter.texto}”.</p>
            <CampoAreaTexto id="zap-manter" rotulo="Resposta ao morador" required maxLength={2000} value={resposta} onChange={(e) => setResposta(e.target.value)}
              erro={camposComErro(erro).includes("resposta") ? "Escreva a resposta ao morador." : null} />
            <div className="flex justify-end gap-2">
              <Botao variante="contorno" onClick={() => setManter(null)}>Voltar</Botao>
              <Botao onClick={() => void manterConcluido()}>Enviar resposta</Botao>
            </div>
          </div>
        </Dialogo>
      ) : null}
    </>
  );
}

/** A conversa do pedido, logo abaixo do topo da ficha. Só aparece quando há mensagens. */
export function ConversaWhatsapp({ pedidoId, conversa }: { pedidoId: string; conversa: ConversaDoPedido | null }) {
  const [inteira, setInteira] = useState(false);
  if (!conversa?.mensagens.length) return null;
  const todas = [...conversa.mensagens].sort((a, b) => Date.parse(a.em) - Date.parse(b.em));
  const vistas = inteira ? todas : todas.slice(-NA_FICHA);
  const j = conversa.janela;
  const agora = new Date().toISOString();

  async function abrirArquivo(arquivo: string) {
    const r = await chamarApi<{ url: string }>(`/v1/condominio/pedidos/${pedidoId}/arquivos/${arquivo}/link`);
    if (r.ok) window.open(r.dados.url, "_blank", "noopener");
  }

  const quem = (m: MensagemConversa) => (m.lado === "MORADOR" ? (m.autor ?? "Morador") : m.finalidade === "RETORNO" ? `Retorno de ${m.autor ?? ""}`
    : m.finalidade === "CONCLUSAO" ? "Conclusão do pedido" : m.autor ? `Resposta de ${m.autor}` : "Mensagem automática da Nina");

  return (
    <section aria-labelledby="t-whatsapp" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="flex items-center gap-2.5">
          <span className="ladrilho" data-tom="ok" aria-hidden="true"><Icone nome="whats" /></span>
          <h2 id="t-whatsapp" className="t-titulo-cartao whitespace-nowrap">Conversa do WhatsApp</h2>
        </span>
        {j ? <Selo tom={j.aberta ? "ok" : "neutro"}>{j.aberta && j.ate ? `Aberta até ${formatarDataHora(j.ate)}` : "Conversa fechada"}</Selo> : null}
      </div>
      <ol className="grid gap-2.5" aria-label="Mensagens">
        {comDias(vistas, (m) => m.em, agora, (m) => (
          <Bolha key={m.id} lado={m.lado} rodape={<>
            {quem(m)}{m.modelo ? " · pelo modelo aprovado" : ""} · {hora(m.em)}
            {m.estado ? <Selo tom={TOM_ESTADO[m.estado]}>{ESTADOS_ENVIO_WHATSAPP[m.estado]}</Selo> : null}
            {m.estado === "FALHOU" || m.estado === "DESCONHECIDO" ? <span>{m.motivo}{m.resolvida ? " · resolvida" : ""}</span> : null}
          </>}>
            {m.texto ? <span className="whitespace-pre-line">{m.texto}</span> : null}
            {m.midia ? (
              m.midia.situacao === "LIBERADA" && m.midia.arquivoId
                ? <Botao variante="contorno" tamanho="p" className="justify-self-start" onClick={() => void abrirArquivo(m.midia!.arquivoId!)}>Abrir {MIDIAS_WHATSAPP[m.midia.tipo]?.toLowerCase() ?? "arquivo"}</Botao>
                : <span className="t-apoio text-tinta-suave">
                    Arquivo {m.midia.situacao === "BAIXAR" ? "sendo conferido" : "não liberado"} ({(MIDIAS_WHATSAPP[m.midia.tipo] ?? "arquivo").toLowerCase()})
                    {m.midia.situacao !== "BAIXAR" && m.midia.motivo ? `: ${m.midia.motivo}` : ""}
                  </span>
            ) : null}
          </Bolha>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linha pt-3">
        {todas.length > NA_FICHA ? (
          <Botao variante="discreto" tamanho="m" className="!px-0" aria-expanded={inteira} onClick={() => setInteira(!inteira)}>
            {inteira ? "Mostrar só as últimas" : `Ver a conversa inteira · ${todas.length} mensagens`}<Icone nome={inteira ? "baixo" : "dir"} className="h-4 w-4" />
          </Botao>
        ) : <span className="t-apoio">{todas.length === 1 ? "1 mensagem" : `${todas.length} mensagens`}</span>}
        {conversa.pode.responder ? <span className="t-apoio">Responder é em Dar retorno ao morador</span> : null}
      </div>
    </section>
  );
}

/** Em "Dar retorno ao morador", pelo WhatsApp: se a conversa está aberta e o que isso muda. */
export function AvisoJanela({ janela: j }: { janela: JanelaWhatsapp }) {
  if (j.aberta) {
    return (
      <Aviso tom="ok" titulo={`Conversa aberta no WhatsApp até ${formatarDataHora(j.ate ?? "")}`}>
        A resposta vai como você escrever. Isto não é prazo de atendimento: o prazo é o próximo retorno do pedido.
      </Aviso>
    );
  }
  return (
    <Aviso tom="atencao" titulo="A conversa no WhatsApp fechou">
      A última mensagem do morador foi há mais de 24 horas.{" "}
      {j.parou ? "O morador pediu para parar de receber avisos: a mensagem não vai pelo WhatsApp. O retorno fica registrado; avise por outro meio."
        : j.modelo ? `O WhatsApp só deixa o condomínio puxar conversa com um modelo aprovado. Sua resposta vai dentro do modelo ${j.modelo.titulo}, até ${LIMITE_FORA_DA_JANELA} caracteres.`
        : "Ainda não há modelo aprovado para esta mensagem: o retorno fica registrado, mas a mensagem não sai pelo WhatsApp. Avise por outro meio."}
    </Aviso>
  );
}

/** Com a conversa fechada, como a resposta chega ao morador dentro do modelo. */
export function PreviaModelo({ janela: j, texto }: { janela: JanelaWhatsapp; texto: string }) {
  if (j.aberta || !j.modelo || j.parou) return null;
  return (
    <div className="grid gap-1.5">
      <p className="t-rotulo">Como chega ao morador</p>
      <p className="whitespace-pre-line rounded-[14px] border border-dashed border-violeta-300 bg-superficie p-3 t-texto">
        {j.modelo.previa.replace("{{texto}}", texto.trim().replace(/\s+/g, " ") || "…")}
      </p>
    </div>
  );
}
