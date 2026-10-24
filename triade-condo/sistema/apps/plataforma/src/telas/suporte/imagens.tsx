"use client";
// As imagens do chamado (PI-20): o modelo de anexar, com Ctrl+V na caixa ou o botão Escolher
// imagens, e o envio uma a uma, ligado à mensagem (decisão E.2), com a verificação que tira a
// localização da foto.

import { useState, type ClipboardEvent } from "react";
import { IMAGENS_CHAMADO } from "@triade/domain";
import { classeBotao, enviarImagensDaMensagem, Icone } from "@triade/ui";

/** Sobe as imagens ligadas à mensagem recém-enviada (decisão E.2): o chamado e o mensagemId. */
export function enviarImagens(chamado: string, mensagemId: string, imagens: File[]): Promise<string[]> {
  return enviarImagensDaMensagem(`/v1/condominio/chamados/${chamado}/imagens`, mensagemId, imagens);
}

/** As imagens no modelo de anexar: cola com Ctrl+V na caixa ou escolhe pelo botão. */
export function CampoImagens({ id, imagens, mudar }: { id: string; imagens: File[]; mudar: (f: File[]) => void }) {
  const [problema, setProblema] = useState<string | null>(null);
  function juntar(novas: File[]) {
    const validas = novas.filter((f) => (IMAGENS_CHAMADO.tipos as readonly string[]).includes(f.type) && f.size <= IMAGENS_CHAMADO.tamanho);
    setProblema(validas.length < novas.length ? "Só imagens JPG, PNG ou WEBP de até 10 MB." : null);
    mudar([...imagens, ...validas].slice(0, IMAGENS_CHAMADO.maximo));
  }
  function colar(ev: ClipboardEvent) {
    const arquivos = Array.from(ev.clipboardData.files);
    if (arquivos.length) {
      ev.preventDefault();
      juntar(arquivos);
    }
  }
  const cheio = imagens.length >= IMAGENS_CHAMADO.maximo;
  return (
    <div className="grid gap-2">
      <span className="t-apoio font-medium">Imagens <span className="font-normal text-tinta-suave">(opcional)</span></span>
      <div tabIndex={0} onPaste={colar} role="group" aria-label="Cole a imagem aqui com Ctrl+V"
        className="flex flex-wrap items-center gap-3 rounded-[16px] border-[1.5px] border-dashed border-violeta-300 bg-violeta-50 px-4 py-3.5 focus:outline-2 focus:outline-foco">
        <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="camera" /></span>
        <span className="grid min-w-40 flex-1 gap-0.5">
          <span className="t-texto font-medium">Cole a imagem aqui (Ctrl+V) ou escolha</span>
          <span className="t-apoio">Até {IMAGENS_CHAMADO.maximo} · JPG, PNG ou WEBP de até 10 MB · a localização sai da foto</span>
        </span>
        <label htmlFor={id} className={classeBotao("contorno", cheio ? "pointer-events-none opacity-50" : "cursor-pointer", "m")}><Icone nome="clipe" />Escolher imagens</label>
        <input id={id} type="file" className="sr-only" accept={IMAGENS_CHAMADO.tipos.join(",")} multiple disabled={cheio}
          onChange={(e) => { juntar(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </div>
      {problema ? <p className="t-apoio text-erro">{problema}</p> : null}
      {imagens.length ? (
        <ul className="flex flex-wrap gap-2">
          {imagens.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-[12px] border border-linha bg-superficie px-2.5 py-1.5 t-apoio">
              <Icone nome="camera" className="h-4 w-4" />{f.name || "imagem colada"}
              <button type="button" className="elo" onClick={() => mudar(imagens.filter((_, j) => j !== i))}>Tirar<span className="sr-only"> {f.name}</span></button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
