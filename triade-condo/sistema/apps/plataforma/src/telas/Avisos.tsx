"use client";
// Avisos dentro do painel (passo 6; F6.1, F6.2, AT-08, AT-09): o sino na barra superior com
// quantos estão sem ver e a lista dos últimos 30 dias. Cada aviso leva ao pedido. Marcar como
// visto não resolve o pedido: ele só sai dos vencidos quando o morador recebe um retorno.

import Link from "next/link";
import { useState } from "react";
import { formatarDataHora, TIPOS_AVISO } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, Dialogo, ErroCarregar, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { useCarregar, usePlataforma } from "./sessao.tsx";
import type { AvisoDoPainel, Avisos as ListaAvisos } from "./tipos.ts";

function detalhe(a: AvisoDoPainel): string {
  switch (a.tipo) {
    case "ESCALADO_SINDICO":
    case "ESCALADO_SUBSTITUTO":
      return a.responsavel ? `Retorno vencido. O responsável, ${a.responsavel}, já foi avisado.` : "Retorno vencido, sem responsável.";
    case "RETORNO_VENCIDO":
      return a.responsavel ? `Retorno vencido. Responsável: ${a.responsavel}.` : "Retorno vencido de pedido sem responsável.";
    case "SEM_RESPONSAVEL":
      return "Sem ninguém cuidando do pedido.";
    case "PENDENCIA_PARADA":
      return "Pendência aberta e parada. Confira se ainda está de pé.";
  }
}

function Lista({ aoFechar }: { aoFechar: () => void }) {
  const { atualizar } = usePlataforma();
  const avisos = useCarregar<ListaAvisos>("/v1/condominio/avisos");
  const [falha, setFalha] = useState<ErroApi | null>(null);

  async function marcar(ids: string[] | null) {
    setFalha(null);
    const r = await chamarApi("/v1/condominio/avisos/vistos", { corpo: { ids } });
    if (!r.ok) return setFalha(r.erro);
    avisos.recarregar();
    atualizar();
  }

  if (avisos.estado === "carregando") return <Carregando linhas={3} rotulo="Carregando os avisos…" />;
  if (avisos.estado === "erro") return <ErroCarregar texto={avisos.texto} tentarDeNovo={avisos.recarregar} />;
  const { itens, naoVistos } = avisos.dados;
  return (
    <div className="grid gap-3">
      {falha ? <AvisoErro erro={falha} texto={textoDoErro(falha)} /> : null}
      {naoVistos ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">{naoVistos === 1 ? "1 aviso sem ver" : `${naoVistos} avisos sem ver`}</p>
          <Botao variante="secundario" onClick={() => void marcar(null)}>Marcar todos como vistos</Botao>
        </div>
      ) : null}
      {itens.length === 0 ? (
        <Vazio titulo="Nenhum aviso">Quando um retorno vencer ou um pedido ficar sem responsável, o aviso aparece aqui.</Vazio>
      ) : (
        <ul className="grid max-h-[60vh] gap-2 overflow-y-auto">
          {itens.map((a) => {
            const escalado = a.tipo === "ESCALADO_SINDICO" || a.tipo === "ESCALADO_SUBSTITUTO";
            return (
              <li key={a.id} className={`grid gap-1 rounded-lg border p-3 text-sm ${a.vistoEm ? "border-linha" : "border-atencao-borda bg-atencao-fundo"}`}>
                <span className="flex flex-wrap items-center gap-2">
                  <Selo tom={a.tipo === "SEM_RESPONSAVEL" || a.tipo === "PENDENCIA_PARADA" ? "info" : "atencao"}>{TIPOS_AVISO[a.tipo]}</Selo>
                  {a.vistoEm ? <span className="text-xs text-tinta-suave">Visto</span> : <span className="text-xs font-semibold">Sem ver</span>}
                </span>
                <span><strong className="font-semibold">{a.protocolo}</strong> {a.assunto ?? "Pedido privado"}</span>
                <span className="text-xs text-tinta-suave">{escalado ? "Escalado a você. " : ""}{detalhe(a)} {formatarDataHora(a.criadoEm)}.</span>
                <span className="flex flex-wrap gap-2">
                  <Link href={`/pedidos/pedido?id=${a.pedidoId}`} className="font-medium text-acao hover:underline"
                    onClick={() => { if (!a.vistoEm) void marcar([a.id]); aoFechar(); }}>
                    Ver pedido {a.protocolo}
                  </Link>
                  {a.vistoEm ? null : <Botao variante="discreto" onClick={() => void marcar([a.id])} aria-label={`Marcar como visto o aviso do pedido ${a.protocolo}`}>Marcar como visto</Botao>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Aviso tom="neutro">Ver o aviso não resolve o pedido. Avisos com mais de 30 dias saem da lista; o histórico do pedido guarda tudo.</Aviso>
    </div>
  );
}

/** O sino na barra superior. */
export function SinoAvisos({ naoVistos }: { naoVistos: number }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm ${naoVistos ? "font-semibold text-tinta" : "text-tinta-suave"} hover:bg-superficie-2`}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        Avisos{naoVistos ? <> ({naoVistos})<span className="sr-only"> sem ver</span></> : null}
      </button>
      <Dialogo aberto={aberto} titulo="Avisos" aoFechar={() => setAberto(false)}>
        {aberto ? <Lista aoFechar={() => setAberto(false)} /> : null}
        <div className="flex justify-end"><Botao variante="secundario" onClick={() => setAberto(false)}>Fechar</Botao></div>
      </Dialogo>
    </>
  );
}
