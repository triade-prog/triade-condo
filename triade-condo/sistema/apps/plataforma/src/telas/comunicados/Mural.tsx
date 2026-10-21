"use client";
// Versão para o mural (design "Telas dos Comunicados", tela 3): folha A4 com o nome do
// condomínio, o comunicado, a assinatura, a data e a versão. Abrir fica no histórico do
// comunicado; só o publicado vai para o mural.

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Aviso, Botao, Carregando, chamarApi, ErroCarregar } from "@triade/ui";
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

  return (
    <main className="mx-auto grid max-w-[21cm] gap-6 bg-superficie p-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-tinta-suave">Confira e imprima. Para o mural, use folha A4 em pé.</p>
        <Botao onClick={() => window.print()} disabled={c.estado !== "PUBLICADO"}>Imprimir</Botao>
      </div>
      {c.estado !== "PUBLICADO" ? <Aviso tom="atencao" className="print:hidden">Só o comunicado publicado vai para o mural. Este está {c.estado === "SUBSTITUIDO" ? "trocado por uma versão nova" : "fora de uso"}.</Aviso> : null}
      <header className="grid gap-1 border-b-2 border-tinta pb-4">
        <span className="text-sm font-semibold tracking-[.12em] uppercase">{d.condominio}</span>
        <span className="text-sm text-tinta-suave">Comunicado · {nomeAssunto(c.assunto)}</span>
      </header>
      <h1 className="text-[32px] leading-tight font-semibold">{c.titulo}</h1>
      <div className="text-lg leading-relaxed whitespace-pre-line">{c.texto}</div>
      {fotos.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {fotos.map((f) => <img key={f.id} src={f.url} alt={f.nome} className="max-h-[9cm] w-full rounded-lg object-contain" />)}
        </div>
      ) : null}
      {c.assinatura ? <p className="text-lg">{c.assinatura}</p> : null}
      <footer className="border-t border-linha pt-3 text-sm text-tinta-suave">
        Publicado em {c.publicadoEm ? diaHora(c.publicadoEm) : "—"} · versão {c.numero}
        {c.numero > 1 && c.mudanca ? ` · ${c.mudanca}` : ""}
      </footer>
    </main>
  );
}
