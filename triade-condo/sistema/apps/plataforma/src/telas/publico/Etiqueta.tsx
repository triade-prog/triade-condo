"use client";
// Etiqueta por local (design "Links e QR", tela 3; AT-30): quem aponta a câmera vê o local, o
// recado do condomínio e o botão que abre o WhatsApp do condomínio com o local já escrito. Nada
// de nomes, unidades nem pedidos; a página não guarda nada no aparelho. Na etiqueta de área comum
// que aceita reserva, o botão Reservar pelo WhatsApp já leva RESERVAR e a área (peça R12, W-22).

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { linkWhatsapp, mensagemEtiqueta } from "@triade/domain";
import { Aviso, Carregando, chamarApi, classeBotao, Icone, textoDoErro } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import type { EtiquetaPublica } from "../tipos.ts";
import { Cartao, FaixaQueda, TelaPublica } from "./comum.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: EtiquetaPublica };
const RODAPE = "Sem conta e sem senha. Esta página não mostra nomes nem unidades e não guarda nada no seu celular.";

export function Etiqueta() {
  const { codigo } = useParams<{ codigo: string }>();
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });

  useEffect(() => {
    void chamarApi<EtiquetaPublica>(`/v1/publico/etiqueta/${encodeURIComponent(codigo)}`).then((r) => {
      if (r.ok) setCarga({ estado: "pronto", dados: r.dados });
      else setCarga({ estado: "erro", texto: r.status === 404 ? "Esta etiqueta não existe. Avise o condomínio pelo WhatsApp de sempre." : textoDoErro(r.erro) });
    });
  }, [codigo]);

  if (carga.estado === "carregando") return <TelaPublica titulo="Avisar um problema" icone="pin" rodape={RODAPE}><Carregando rotulo="Abrindo…" /></TelaPublica>;
  if (carga.estado === "erro") return <TelaPublica titulo="Avisar um problema" icone="pin" rodape={RODAPE}><Aviso tom="atencao">{carga.texto}</Aviso></TelaPublica>;
  const e = carga.dados;
  if (e.foraDeUso || !e.local || !e.rotulo) {
    return (
      <TelaPublica titulo={e.condominio} subtitulo="Avisar um problema" icone="pin" rodape={RODAPE}>
        <Aviso tom="info" titulo="Esta etiqueta não está mais em uso">Para avisar um problema, fale com o condomínio pelo WhatsApp de sempre.</Aviso>
      </TelaPublica>
    );
  }
  return (
    <TelaPublica titulo={e.condominio} subtitulo="Avisar um problema" icone="pin" rodape={RODAPE}>
      <Cartao>
        <span className="justify-self-start rounded-full bg-neutro-fundo px-2.5 py-0.5 text-xs font-medium text-tinta-suave">Etiqueta {e.rotulo}</span>
        <h2 className="text-xl font-medium">{e.local}</h2>
        <p className="text-[15px]">Viu algo quebrado, vazando ou fora do lugar aqui? Avise o condomínio pelo WhatsApp. O local já vai escrito.</p>
      </Cartao>
      {e.reserva && e.whatsapp ? (
        <Cartao className="border-violeta-200 bg-violeta-50">
          <h2 className="text-lg font-medium">Reservar: {e.reserva.area}</h2>
          <p className="text-[15px]">
            {e.reserva.capacidade ? `Até ${e.reserva.capacidade} pessoas, ${e.reserva.horario}` : e.reserva.horario.replace(/^./, (x) => x.toUpperCase())}.
            {e.reserva.livres?.length ? ` Livre em ${e.reserva.livres.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join(" e ")}.` : ""}
          </p>
          <a href={linkWhatsapp(e.whatsapp, e.reserva.texto)} rel="noopener noreferrer" className={classeBotao("contorno", "justify-self-stretch sm:justify-self-start")}>
            <Icone nome="calendario" />Reservar pelo WhatsApp
          </a>
          <p className="text-[13px] text-tinta-suave">O botão abre o WhatsApp do condomínio já com a área escolhida.</p>
        </Cartao>
      ) : null}
      {e.recado ? (
        <Cartao className="border-violeta-200 bg-violeta-50">
          <p className="text-[13px] text-tinta-suave">Recado do condomínio{e.recadoEm ? ` · ${diaHora(e.recadoEm)}` : ""}</p>
          <p className="text-[15px]">{e.recado}</p>
        </Cartao>
      ) : null}
      <FaixaQueda canal={e.canalAlternativo} />
      {e.whatsapp ? (
        <a href={linkWhatsapp(e.whatsapp, mensagemEtiqueta(e.local, e.rotulo))} rel="noopener noreferrer" className={classeBotao("primario", "justify-self-stretch sm:justify-self-start")}>
          <Icone nome="whats" />Avisar pelo WhatsApp do condomínio
        </a>
      ) : <Aviso tom="info">Fale com o condomínio pelo WhatsApp de sempre e diga o local: {e.local}.</Aviso>}
      <p className="text-[13px] text-tinta-suave">
        Emergência, como fogo, gás ou alguém preso no elevador: ligue 193. O aviso pelo WhatsApp não é atendimento imediato.
      </p>
    </TelaPublica>
  );
}
