"use client";
// A conversa do WhatsApp no pedido (passo 5; W-05, W-10, W-13, W-14, AT-06), tela 4 do desenho:
// as mensagens do morador, com fotos e documentos conferidos, as respostas e os retornos, cada um
// com o estado da mensagem, separado do estado do pedido. Responder pelo WhatsApp é dar retorno:
// conta na hora do registro; a falha de envio é tratada à parte. O pedido de revisão do morador
// nunca reabre sozinho: reabrir é pelo caminho de sempre, ou o pedido segue concluído com uma
// resposta ao morador.

import { useState, type FormEvent } from "react";
import {
  ESTADOS_ENVIO_WHATSAPP, formatarDataHora, LIMITE_FORA_DA_JANELA, MIDIAS_WHATSAPP, TEXTOS_MOTIVO, type EstadoEnvioWhatsapp, type MidiaWhatsapp,
} from "@triade/domain";
import { Aviso, AvisoErro, Botao, CampoAreaTexto, camposComErro, chamarApi, Dialogo, Icone, Selo, textoDoErro, type ErroApi, type Tom } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";

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
interface Janela {
  aberta: boolean;
  ate?: string;
  limite: number;
  parou: boolean;
  modelo?: { titulo: string; previa: string };
}

interface ConversaDoPedido {
  mensagens: MensagemConversa[];
  revisoes: Revisao[];
  janela?: Janela;
  pode: { responder: boolean; decidirRevisao: boolean };
}

const TOM_ESTADO: Record<EstadoEnvioWhatsapp, Tom> = {
  NA_FILA: "neutro", ENVIANDO: "andamento", ENVIADA: "andamento", ENTREGUE: "ok", LIDA: "ok", FALHOU: "erro", DESCONHECIDO: "atencao", CANCELADA: "neutro",
};

export function ConversaWhatsapp({ pedidoId, versao, aoResponder, aoReabrir }: {
  pedidoId: string; versao: number; aoResponder: (texto: string) => void; aoReabrir?: () => void;
}) {
  const carga = useCarregar<ConversaDoPedido>(`/v1/condominio/pedidos/${pedidoId}/whatsapp`);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [manter, setManter] = useState<Revisao | null>(null);
  const [resposta, setResposta] = useState("");
  const [semEnvio, setSemEnvio] = useState<string | null>(null);

  if (carga.estado !== "pronto") return null;
  const d = carga.dados;
  if (!d.mensagens.length && !d.pode.responder) return null;
  const pendentes = d.revisoes.filter((r) => !r.decisao);
  const j = d.janela;
  const limite = j && !j.aberta ? LIMITE_FORA_DA_JANELA : 2000;
  const longo = texto.trim().length > limite;

  async function responder(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ aviso?: string }>(`/v1/condominio/pedidos/${pedidoId}/whatsapp`, { corpo: { versao, texto } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setTexto("");
    setSemEnvio(r.dados.aviso ? (TEXTOS_MOTIVO[r.dados.aviso] ?? null) : null);
    carga.recarregar();
    aoResponder(r.dados.aviso ? "Retorno registrado. A mensagem não vai pelo WhatsApp: avise por outro meio." : "Retorno registrado e enviado pelo WhatsApp.");
  }

  async function manterConcluido() {
    if (!manter) return;
    setErro(null);
    const r = await chamarApi(`/v1/condominio/whatsapp/revisoes/${manter.id}/manter`, { corpo: { resposta } });
    if (!r.ok) return setErro(r.erro);
    setManter(null);
    setResposta("");
    carga.recarregar();
    aoResponder("Resposta enviada ao morador. O pedido segue concluído.");
  }

  async function abrirArquivo(arquivo: string) {
    const r = await chamarApi<{ url: string }>(`/v1/condominio/pedidos/${pedidoId}/arquivos/${arquivo}/link`);
    if (r.ok) window.open(r.dados.url, "_blank", "noopener");
  }

  return (
    <section aria-labelledby="t-whatsapp" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <h2 id="t-whatsapp" className="text-lg font-medium">Conversa do WhatsApp</h2>
      {pendentes.map((r) => (
        <Aviso key={r.id} tom="atencao" titulo="O morador pediu revisão pelo WhatsApp">
          <span className="grid gap-2">
            <span>“{r.texto}” · {formatarDataHora(r.em)}. O pedido não reabre sozinho: reabra ou responda mantendo concluído.</span>
            {d.pode.decidirRevisao ? (
              <span className="flex flex-wrap gap-2">
                {aoReabrir ? <Botao variante="contorno" tamanho="m" onClick={aoReabrir}>Reabrir o pedido</Botao> : null}
                <Botao variante="contorno" tamanho="m" onClick={() => setManter(r)}>Manter concluído e responder</Botao>
              </span>
            ) : null}
          </span>
        </Aviso>
      ))}
      {erro && !manter ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {d.mensagens.length ? (
        <ol className="grid gap-2.5" aria-label="Mensagens">
          {d.mensagens.map((m) => (
            <li key={m.id} className={`grid max-w-[560px] gap-1 rounded-2xl border p-3 text-sm ${m.lado === "CONDOMINIO" ? "justify-self-end border-violeta-200 bg-violeta-50" : "border-linha bg-superficie"}`}>
              {m.texto ? <span className="whitespace-pre-line">{m.texto}</span> : null}
              {m.midia ? (
                m.midia.situacao === "LIBERADA" && m.midia.arquivoId
                  ? <Botao variante="contorno" tamanho="p" className="justify-self-start" onClick={() => void abrirArquivo(m.midia!.arquivoId!)}>Abrir {MIDIAS_WHATSAPP[m.midia.tipo]?.toLowerCase() ?? "arquivo"}</Botao>
                  : <span className="text-xs text-tinta-suave">
                      Arquivo {m.midia.situacao === "BAIXAR" ? "sendo conferido" : "não liberado"} ({(MIDIAS_WHATSAPP[m.midia.tipo] ?? "arquivo").toLowerCase()})
                      {m.midia.situacao !== "BAIXAR" && m.midia.motivo ? `: ${m.midia.motivo}` : ""}
                    </span>
              ) : null}
              <span className="flex flex-wrap items-center gap-2 text-xs text-tinta-suave">
                {m.lado === "MORADOR" ? (m.autor ?? "Morador") : m.finalidade === "RETORNO" ? `Retorno de ${m.autor ?? ""}`
                  : m.finalidade === "CONCLUSAO" ? "Conclusão do pedido" : m.autor ? `Resposta de ${m.autor}` : "Mensagem automática da Nina"}
                {m.modelo ? " · pelo modelo aprovado" : ""}
                {" · "}{formatarDataHora(m.em)}
                {m.estado ? <Selo tom={TOM_ESTADO[m.estado]}>{ESTADOS_ENVIO_WHATSAPP[m.estado]}</Selo> : null}
                {m.estado === "FALHOU" || m.estado === "DESCONHECIDO" ? <span>{m.motivo}{m.resolvida ? " · resolvida" : ""}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-tinta-suave">Nenhuma mensagem pelo WhatsApp ainda.</p>}
      {semEnvio ? <Aviso tom="atencao" titulo="Não deu para enviar">{semEnvio}</Aviso> : null}
      {d.pode.responder && j ? (
        j.aberta ? (
          <p className="flex items-start gap-2 rounded-xl border border-ok-borda bg-ok-fundo px-3 py-2 text-sm">
            <Icone nome="whats" className="mt-0.5 h-5 w-5 shrink-0" />
            <span><b className="font-semibold">Conversa aberta no WhatsApp até {formatarDataHora(j.ate ?? "")}</b><br />
              A resposta vai como você escrever. Isto não é prazo de atendimento: o prazo é o próximo retorno do pedido.</span>
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-xl border border-atencao-borda bg-atencao-fundo px-3 py-2 text-sm">
            <Icone nome="relogio" className="mt-0.5 h-5 w-5 shrink-0" />
            <span><b className="font-semibold">A conversa no WhatsApp fechou (a última mensagem do morador foi há mais de 24 horas)</b><br />
              {j.parou ? "O morador pediu para parar de receber avisos: com a conversa fechada, a mensagem não vai pelo WhatsApp. O retorno fica registrado; avise por outro meio."
                : j.modelo ? `O WhatsApp só deixa o condomínio puxar conversa com um modelo aprovado. Sua resposta vai dentro do modelo ${j.modelo.titulo}, até ${LIMITE_FORA_DA_JANELA} caracteres.`
                : "Ainda não há modelo aprovado para esta mensagem: o retorno fica registrado, mas a mensagem não sai pelo WhatsApp. Avise por outro meio."}</span>
          </p>
        )
      ) : null}
      {d.pode.responder ? (
        <form onSubmit={responder} noValidate className="grid gap-2">
          <CampoAreaTexto id="zap-resposta" rotulo="Responder pelo WhatsApp" maxLength={limite} value={texto} onChange={(e) => setTexto(e.target.value)}
            ajuda={`${texto.trim().length} de ${limite} caracteres`}
            erro={camposComErro(erro).includes("texto") ? `Escreva a resposta (3 a ${limite} caracteres).` : longo ? `Com a conversa fechada, até ${LIMITE_FORA_DA_JANELA} caracteres.` : null} />
          {j && !j.aberta && j.modelo && !j.parou ? (
            <>
              <p className="text-xs text-tinta-suave">Como chega ao morador</p>
              <p className="whitespace-pre-line rounded-xl border border-dashed border-violeta-300 bg-superficie p-3 text-sm">
                {j.modelo.previa.replace("{{texto}}", texto.trim().replace(/\s+/g, " ") || "…")}
              </p>
            </>
          ) : null}
          <p className="text-xs text-tinta-suave">Conta como retorno ao morador na hora do registro. Se o envio falhar, o retorno continua registrado e a falha aparece com responsável.</p>
          <div className="flex justify-end"><Botao type="submit" disabled={enviando || longo}>{enviando ? "Enviando…" : "Enviar e registrar retorno"}</Botao></div>
        </form>
      ) : null}
      {manter ? (
        <Dialogo aberto titulo="Manter concluído e responder" aoFechar={() => setManter(null)}>
          <div className="grid gap-4">
            {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
            <p className="text-sm">O morador escreveu: “{manter.texto}”.</p>
            <CampoAreaTexto id="zap-manter" rotulo="Resposta ao morador" required maxLength={2000} value={resposta} onChange={(e) => setResposta(e.target.value)}
              erro={camposComErro(erro).includes("resposta") ? "Escreva a resposta ao morador." : null} />
            <div className="flex justify-end gap-2">
              <Botao variante="contorno" onClick={() => setManter(null)}>Voltar</Botao>
              <Botao onClick={() => void manterConcluido()}>Enviar resposta</Botao>
            </div>
          </div>
        </Dialogo>
      ) : null}
    </section>
  );
}
