"use client";
// Versão para o mural (design "Telas dos Comunicados", tela 3): folha A4 com o nome do
// condomínio, o comunicado, a assinatura, a data e a versão. Abrir fica no histórico do
// comunicado; só o publicado vai para o mural.

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Aviso, Carregando, chamarApi, ErroCarregar, FolhaA4, Logo, PreviaImpressao } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { ComunicadoDetalhe } from "../tipos.ts";
import { nomeAssunto } from "./comum.tsx";

export function Mural() {
  const id = useSearchParams().get("id");
  const carga = useCarregar<ComunicadoDetalhe>(id ? `/v1/condominio/comunicados/${id}` : null);
  const [fotos, setFotos] = useState<{ id: string; url: string; nome: string }[]>([]);
  const registrado = useRef(false);
  const pronto = carga.estado === "pronto" ? carga.dados : null;

  useEffect(() => {
    if (!pronto || pronto.comunicado.estado !== "PUBLICADO" || registrado.current) return;
    registrado.current = true;
    void chamarApi(`/v1/condominio/comunicados/${pronto.comunicado.id}/uso`, { corpo: { uso: "MURAL" } });
    const imagens = pronto.arquivos.filter((a) => a.situacao === "LIBERADO" && a.tipo.startsWith("image/"));
    void Promise.all(imagens.map(async (a) => {
      const r = await chamarApi<{ url: string }>(`/v1/condominio/comunicados/${pronto.comunicado.id}/arquivos/${a.id}/link`);
      return r.ok ? { id: a.id, url: r.dados.url, nome: a.nome } : null;
    })).then((xs) => setFotos(xs.filter((x) => x !== null)));
  }, [pronto]);

  if (!id) return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl">Comunicado não encontrado</h1></main>;
  if (carga.estado === "carregando") return <main className="mx-auto max-w-3xl p-8"><Carregando rotulo="Preparando a folha…" /></main>;
  if (carga.estado === "erro") return <main className="mx-auto max-w-3xl p-8"><h1 className="mb-4 text-2xl">Comunicado</h1><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></main>;
  const d = carga.dados;
  const c = d.comunicado;

  const publicado = c.estado === "PUBLICADO";
  return (
    <PreviaImpressao titulo="Folha do comunicado para o mural" apoio="Confira e imprima · folha A4 em pé" voltar={`/comunicados/comunicado?id=${c.id}`} podeImprimir={publicado}
      aviso={!publicado ? <Aviso tom="atencao">Só o comunicado publicado vai para o mural. Este está {c.estado === "SUBSTITUIDO" ? "trocado por uma versão nova" : "fora de uso"}.</Aviso> : null}
      legenda={publicado ? "Como sai na impressão" : undefined}>
      <FolhaA4 rotulo="Folha do comunicado" className="gap-6 p-[1.4cm]">
        <header className="flex items-end justify-between gap-4 border-b-2 border-tinta pb-4">
          <span className="grid gap-1">
            <span className="text-sm font-bold tracking-[.14em] uppercase">{d.condominio}</span>
            <span className="text-sm text-tinta-suave">Comunicado · {nomeAssunto(c.assunto)}</span>
          </span>
          <Logo className="h-8 w-auto" />
        </header>
        <h2 className="text-[38px] leading-tight font-semibold">{c.titulo}</h2>
        <div className="text-xl leading-relaxed whitespace-pre-line">{c.texto}</div>
        {fotos.length ? (
          <div className="grid grid-cols-2 gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {fotos.map((f) => <img key={f.id} src={f.url} alt={f.nome} className="max-h-[9cm] w-full rounded-lg object-contain" />)}
          </div>
        ) : null}
        {c.assinatura ? <p className="text-xl">{c.assinatura}</p> : null}
        <footer className="mt-auto border-t border-linha pt-3 text-sm text-tinta-suave">
          Publicado em {c.publicadoEm ? diaHora(c.publicadoEm) : "—"} · versão {c.numero}
          {c.numero > 1 && c.mudanca ? ` · ${c.mudanca}` : ""}
        </footer>
      </FolhaA4>
    </PreviaImpressao>
  );
}
