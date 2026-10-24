"use client";
// O áudio do WhatsApp com a transcrição ao lado (W-06; telas-modelo/ia-ficha-*, ia-estados). O
// áudio toca enquanto o texto não chega; a transcrição fica só no painel, marcada como automática,
// com o lembrete de ouvir para conferir. Sem transcrição (função desligada, sem serviço, áudio muito
// curto), aparece só o áudio. No limite do mês, diz até quando; na falha, uma nova tentativa que não
// conta duas vezes.

import { useRef, useState } from "react";
import { diaDeRenovar } from "@triade/domain";
import { Botao, chamarApi, Icone, IconeMarca, Selo } from "@triade/ui";
import { Esqueleto, LinkUsoIa, type TranscricaoAudio } from "../pedidos/SugestaoIa.tsx";

const ONDA = [5, 9, 14, 8, 12, 18, 10, 6, 13, 17, 9, 12, 7, 15, 11, 8, 16, 10, 6, 12];
const duracao = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : null);

/** O tocador: pede o link do arquivo guardado e toca ali mesmo. */
function Tocador({ pedidoId, arquivoId, segundos }: { pedidoId: string; arquivoId?: string; segundos?: number }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  async function alternar() {
    if (audio.current && !audio.current.paused) { audio.current.pause(); return; }
    if (!audio.current) {
      const r = await chamarApi<{ url: string }>(`/v1/condominio/pedidos/${pedidoId}/arquivos/${arquivoId}/link`);
      if (!r.ok) { setFalhou(true); return; }
      audio.current = new Audio(r.dados.url);
      audio.current.onplay = () => setTocando(true);
      audio.current.onpause = () => setTocando(false);
      audio.current.onended = () => setTocando(false);
    }
    void audio.current.play().catch(() => setFalhou(true));
  }
  return (
    <span className="grid gap-1">
      <span className="flex items-center gap-3">
        <Botao variante="contorno" tamanho="m" disabled={!arquivoId} onClick={() => void alternar()} aria-pressed={tocando}>
          <Icone nome={tocando ? "pausa" : "tocar"} className="h-4 w-4" />{tocando ? "Pausar" : "Ouvir"}
        </Botao>
        <span className="flex h-6 items-center gap-[3px] text-violeta-400" aria-hidden="true">
          {ONDA.map((h, i) => <span key={i} className="w-[2px] rounded-full bg-current" style={{ height: `${h}px` }} />)}
        </span>
        {duracao(segundos) ? <span className="t-codigo text-tinta-suave">{duracao(segundos)}</span> : null}
      </span>
      {falhou ? <span className="t-apoio text-erro">Não deu para abrir o áudio agora.</span> : null}
    </span>
  );
}

export function AudioTranscrito({ pedidoId, mensagemId, arquivoId, quem, transcricao, tentarDeNovo }: {
  pedidoId: string; mensagemId: string; arquivoId?: string; quem: string; transcricao?: TranscricaoAudio; tentarDeNovo?: () => void;
}) {
  const [tentando, setTentando] = useState(false);
  const t = transcricao;
  async function tentar() {
    setTentando(true);
    await chamarApi(`/v1/condominio/whatsapp/mensagens/${mensagemId}/transcrever`, { metodo: "POST" });
    setTentando(false);
    tentarDeNovo?.();
  }
  const tocador = <Tocador pedidoId={pedidoId} arquivoId={arquivoId} segundos={t?.segundos} />;
  if (!t || t.estado === "SEM_TRANSCRICAO") return tocador;
  if (t.estado === "PRONTA") {
    return (
      <span className="grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:gap-4">
        <span className="grid content-start gap-2">
          <span className="t-rotulo text-tinta-suave">Áudio de {quem}</span>
          {tocador}
          {t.segundos ? <span className="t-apoio text-tinta-suave">Guardado no pedido · {duracao(t.segundos)}</span> : null}
        </span>
        <span className="grid content-start gap-2 border-linha md:border-l md:pl-4 max-md:border-t max-md:pt-3">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 t-rotulo text-tinta-suave"><Icone nome="documento" className="h-3.5 w-3.5" />Transcrição automática</span>
            <Selo tom="neutro">Automática</Selo>
          </span>
          <span className="whitespace-pre-line">“{t.texto}”</span>
          <span className="flex items-center gap-1.5 t-apoio text-tinta-suave"><Icone nome="info" className="h-3.5 w-3.5" />Pode ter erro. Ouça o áudio para conferir.</span>
        </span>
      </span>
    );
  }
  return (
    <span className="grid gap-3">
      {tocador}
      <span className="grid gap-2 border-t border-linha pt-3">
        {t.estado === "TRANSCREVENDO" ? (
          <>
            <span className="flex items-center gap-1.5 font-medium"><Icone nome="relogio" className="h-4 w-4" />Transcrevendo o áudio</span>
            <Esqueleto />
          </>
        ) : t.estado === "LIMITE" ? (
          <>
            <span className="flex items-center gap-1.5 font-medium"><IconeMarca marca="pausa" />Transcrição parada até {diaDeRenovar(t.renovaEm)}</span>
            <span className="t-apoio text-tinta-suave">O condomínio usou os minutos do mês. Os áudios novos ficam só com o som.</span>
            <LinkUsoIa />
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 font-medium text-atencao"><Icone nome="alerta" className="h-4 w-4" />Não deu para transcrever agora</span>
            <span className="t-apoio text-tinta-suave">O áudio está guardado. Tente de novo em alguns minutos.</span>
            <Botao variante="contorno" tamanho="m" className="justify-self-start" disabled={tentando} onClick={() => void tentar()}><Icone nome="trocar" className="h-4 w-4" />Tentar de novo</Botao>
          </>
        )}
      </span>
    </span>
  );
}
