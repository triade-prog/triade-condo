"use client";
// A imagem dentro da mensagem do chamado (decisão E.2 de 24/10/2026; desenhos SU-chamado-imagem-*):
// a imagem vai junto com a mensagem que a pessoa está escrevendo, até 3 por mensagem e 10 por
// chamado, e aparece dentro da própria mensagem, com "Foto conferida · abrir". O envio é depois de
// gravar a mensagem: a tela recebe o mensagemId e sobe cada imagem ligada a ela, uma a uma, com a
// verificação que tira a localização da foto. Serve à Plataforma (abrir, responder e pedir
// mudança) e ao Console (só para ver).

import { useState, type ClipboardEvent } from "react";
import { IMAGENS_CHAMADO } from "@triade/domain";
import { chamarApi, textoDoErro } from "./api.ts";
import { Icone } from "./Icone.tsx";

/** Uma imagem já guardada numa mensagem. */
export interface ImagemDaMensagem {
  id: string;
  nome: string;
  tipo?: string;
}

/** Só imagem JPG, PNG ou WEBP de até 10 MB entra. */
export function imagemAceita(f: File): boolean {
  return (IMAGENS_CHAMADO.tipos as readonly string[]).includes(f.type) && f.size <= IMAGENS_CHAMADO.tamanho;
}

/** As imagens coladas (Ctrl+V) de um evento de colar. */
export function imagensColadas(ev: ClipboardEvent): File[] {
  return Array.from(ev.clipboardData.files);
}

/**
 * Sobe as imagens ligadas à mensagem recém-enviada: pede o link com o mensagemId, sobe o arquivo e
 * pede a verificação. Devolve o que não passou, em frases para a pessoa.
 */
export async function enviarImagensDaMensagem(base: string, mensagemId: string, imagens: File[]): Promise<string[]> {
  const problemas: string[] = [];
  for (const f of imagens) {
    const nome = f.name || "imagem-colada.png";
    const inicio = await chamarApi<{ arquivoId: string; envio: { url: string; tipo: string } }>(base, {
      corpo: { mensagemId, nome, tipo: f.type, tamanho: f.size },
    });
    if (!inicio.ok) { problemas.push(`${nome}: ${textoDoErro(inicio.erro)}`); continue; }
    const subiu = await fetch(inicio.dados.envio.url, { method: "PUT", headers: { "content-type": inicio.dados.envio.tipo }, body: f })
      .then((r) => r.ok, () => false);
    if (!subiu) { problemas.push(`${nome}: a imagem não chegou. Tente de novo.`); continue; }
    const fim = await chamarApi<{ situacao: string; motivo?: string }>(`${base}/${inicio.dados.arquivoId}/verificar`, { corpo: {} });
    if (!fim.ok) problemas.push(`${nome}: ${textoDoErro(fim.erro)}`);
    else if (fim.dados.situacao !== "LIBERADO") problemas.push(`${nome}: ${fim.dados.motivo ?? "a imagem não foi liberada."}`);
  }
  return problemas;
}

/**
 * "Anexar imagem" junto da mensagem que a pessoa escreve: o elo abre a escolha do arquivo, cada
 * imagem escolhida vira um chip com Tirar e, embaixo, o aviso de que ela vai junto com a mensagem.
 * O elo fica onde a tela quiser (no rodapé, ao lado de Enviar); os chips e o aviso vêm em `lista`.
 */
export function useAnexarImagens({ id, imagens, mudar, maximo, oQue = "resposta" }: {
  id: string; imagens: File[]; mudar: (f: File[]) => void; maximo: number; oQue?: "resposta" | "mensagem" | "pedido";
}) {
  const [problema, setProblema] = useState<string | null>(null);
  const limite = Math.max(0, Math.min(IMAGENS_CHAMADO.maximo, maximo));
  const cheio = imagens.length >= limite;

  function juntar(novas: File[]) {
    const validas = novas.filter(imagemAceita);
    const cabem = [...imagens, ...validas].slice(0, limite);
    setProblema(validas.length < novas.length ? "Só imagens JPG, PNG ou WEBP de até 10 MB."
      : cabem.length < imagens.length + validas.length ? `Até ${limite} ${limite === 1 ? "imagem" : "imagens"} nesta ${oQue}.` : null);
    mudar(cabem);
  }

  function colar(ev: ClipboardEvent) {
    const arquivos = imagensColadas(ev);
    if (!arquivos.length || limite === 0) return;
    ev.preventDefault();
    juntar(arquivos);
  }

  const anexar = limite > 0 ? (
    <>
      <label htmlFor={id} className={`elo t-apoio ${cheio ? "pointer-events-none opacity-50" : ""}`}><Icone nome="clipe" className="h-4 w-4" />Anexar imagem</label>
      <input id={id} type="file" className="sr-only" accept={IMAGENS_CHAMADO.tipos.join(",")} multiple disabled={cheio}
        onChange={(e) => { juntar(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    </>
  ) : null;

  const lista = imagens.length || problema ? (
    <div className="grid gap-2">
      {imagens.length ? (
        <ul aria-label="Imagens desta mensagem" className="flex flex-wrap gap-2">
          {imagens.map((f, i) => {
            const nome = f.name || "imagem colada";
            return (
              <li key={`${nome}-${i}`} className="inline-flex items-center gap-2 rounded-[10px] border border-violeta-200 bg-violeta-50 py-1 pr-1.5 pl-1 t-apoio">
                <span className="ladrilho h-7 w-7 rounded-[8px]" aria-hidden="true"><Icone nome="camera" className="h-4 w-4" /></span>
                <span className="[overflow-wrap:anywhere]">{nome}</span>
                <button type="button" className="elo-linha relative inline-grid h-7 w-7 place-items-center rounded-[8px] text-tinta-suave" aria-label={`Tirar ${nome}`}
                  onClick={() => mudar(imagens.filter((_, j) => j !== i))}><Icone nome="fechar" className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {imagens.length ? (
        <span className="t-apoio text-tinta-suave">
          {imagens.length === 1 ? "A imagem vai" : "As imagens vão"} junto com {oQue === "pedido" ? "este pedido" : `esta ${oQue}`}. Até {IMAGENS_CHAMADO.maximo} por {oQue}.
        </span>
      ) : null}
      {problema ? <span className="t-apoio text-erro">{problema}</span> : null}
    </div>
  ) : null;

  return { anexar, lista, colar };
}

/** As imagens dentro de uma mensagem: cada uma com o nome e "Foto conferida · abrir". */
export function ImagensDaMensagem({ imagens, abrir }: { imagens: ImagemDaMensagem[] | undefined; abrir: (id: string) => void }) {
  if (!imagens?.length) return null;
  return (
    <ul aria-label="Imagens da mensagem" className="grid gap-1.5">
      {imagens.map((a) => (
        <li key={a.id}>
          <button type="button" onClick={() => abrir(a.id)}
            className="elo-linha relative flex w-full items-center gap-2.5 rounded-[12px] border border-linha bg-superficie px-2.5 py-2 hover:border-violeta-300">
            <span className="ladrilho h-11 w-11 rounded-[10px]" aria-hidden="true"><Icone nome="camera" /></span>
            <span className="grid min-w-0 flex-1 gap-px">
              <span className="t-apoio font-medium [overflow-wrap:anywhere]">{a.nome}</span>
              <span className="t-apoio text-tinta-suave">Foto conferida · abrir</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
