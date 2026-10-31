"use client";
// Mural do morador (D4.40, conceito Janela acesa; CD-12, CD-14, CD-15, CD-16): a página sem conta
// nem senha que o morador abre pelo link ou pelo QR. A faixa com a foto dos prédios ao entardecer
// abre a página; o feed fica em MuralConteudo, a mesma peça da prévia no painel. A última visita
// fica só neste aparelho (localStorage), para marcar o que é novo: nada sobe para o servidor. A
// vista fica no endereço: ?aba=, ?c= (o aviso) e ?anuncio=.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { contar, novosDesde, textoAtualizado } from "@triade/domain";
import { Aviso, Carregando, chamarApi, textoDoErro } from "@triade/ui";
import type { MuralPublico } from "../tipos.ts";
import { FaixaMural, TelaPublica, useEncerrou } from "./comum.tsx";
import { MuralConteudo, type LinksDoMural, type VistaMural } from "./MuralConteudo.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: MuralPublico; ultimaVisita: string | null };

/** O endereço de uma vista do mural, para a barra do navegador e para compartilhar. */
export function enderecoDaVista(codigo: string, v: VistaMural): string {
  const q = new URLSearchParams();
  if (v.comunicado) q.set("c", v.comunicado);
  else if (v.anuncio) q.set("anuncio", v.anuncio);
  else if (v.aba !== "avisos") q.set("aba", v.aba);
  const busca = q.toString();
  return `/m/${codigo}${busca ? `?${busca}` : ""}`;
}

const chaveVisita = (codigo: string) => `triade-mural-visita:${codigo.toUpperCase()}`;

/** A visita anterior guardada no aparelho (CD-16); a de agora fica gravada para a próxima vez. */
function registrarVisita(codigo: string, m: MuralPublico): string | null {
  if (m.trocado || m.foraDoAr) return null;
  try {
    const guardada = window.localStorage.getItem(chaveVisita(codigo));
    window.localStorage.setItem(chaveVisita(codigo), new Date().toISOString());
    return guardada && !Number.isNaN(Date.parse(guardada)) ? guardada : null;
  } catch {
    // Sem armazenamento (modo privado): a página funciona igual, sem a marca de novo.
    return null;
  }
}

/** "Atualizado hoje às 09:10 · 9 avisos, 2 enquetes e 4 anúncios". */
function linhaDaFaixa(m: MuralPublico): string | undefined {
  const partes = [
    m.comunicados?.length ? contar(m.comunicados.length, "aviso", "avisos") : "",
    m.enquetes?.length ? contar(m.enquetes.length, "enquete", "enquetes") : "",
    m.classificados?.length ? contar(m.classificados.length, "anúncio", "anúncios") : "",
  ].filter(Boolean);
  const oQue = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : partes[0] ?? "";
  if (!m.atualizadoEm) return oQue || undefined;
  return `${textoAtualizado(m.atualizadoEm)}${oQue ? ` · ${oQue}` : ""}`;
}

export function Mural() {
  const { codigo } = useParams<{ codigo: string }>();
  const busca = useSearchParams();
  const router = useRouter();
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });
  const encerrou = useEncerrou();
  const ultimaVisita = carga.estado === "pronto" ? carga.ultimaVisita : null;
  const novos = useMemo(() => novosDesde(carga.estado === "pronto" ? carga.dados.comunicados ?? [] : [], ultimaVisita), [carga, ultimaVisita]);

  useEffect(() => {
    void chamarApi<MuralPublico>(`/v1/publico/mural/${encodeURIComponent(codigo)}`).then((r) => {
      if (r.ok) setCarga({ estado: "pronto", dados: r.dados, ultimaVisita: registrarVisita(codigo, r.dados) });
      else if (!encerrou(r.erro)) setCarga({ estado: "erro", texto: r.status === 404 ? "Este mural não existe. Confira o endereço ou peça o link ao condomínio." : textoDoErro(r.erro) });
    });
  }, [codigo, encerrou]);

  if (carga.estado === "carregando") {
    return <TelaPublica titulo="Mural do condomínio" largo faixa={<FaixaMural />}><Carregando rotulo="Abrindo o mural…" /></TelaPublica>;
  }
  if (carga.estado === "erro") {
    return <TelaPublica titulo="Mural do condomínio" largo faixa={<FaixaMural />}><Aviso tom="atencao">{carga.texto}</Aviso></TelaPublica>;
  }
  const m = carga.dados;
  if (m.trocado) {
    return <TelaPublica titulo="Mural do condomínio" largo faixa={<FaixaMural />}><Aviso tom="atencao" titulo="Este endereço mudou">Peça o link novo ao condomínio.</Aviso></TelaPublica>;
  }
  if (m.foraDoAr) {
    return <TelaPublica titulo={`Mural do ${m.condominio}`} largo faixa={<FaixaMural condominio={m.condominio} />}><Aviso tom="info" titulo="Este mural está fora do ar">Os avisos continuam chegando pelo condomínio.</Aviso></TelaPublica>;
  }

  const aba = busca.get("aba");
  const vista: VistaMural = {
    aba: aba === "classificados" || busca.get("anuncio") ? "classificados" : aba === "manual" ? "manual" : "avisos",
    comunicado: busca.get("c") ?? undefined, anuncio: busca.get("anuncio") ?? undefined,
  };
  const ir = (v: VistaMural) => {
    const abrindo = !!(v.comunicado || v.anuncio);
    router[abrindo ? "push" : "replace"](enderecoDaVista(codigo, v), { scroll: abrindo });
  };
  const base = `/v1/publico/mural/${encodeURIComponent(codigo)}`;
  const links: LinksDoMural = {
    arquivo: (comunicado, arquivo) => `${base}/comunicados/${comunicado}/arquivos/${arquivo}`,
    fotoAnuncio: (id) => `${base}/classificados/${id}/foto`,
    // Endereço de verdade, pelo repasse /api: o celular abre a agenda e nada é contado (CD-18).
    agenda: (id) => `/api${base}/comunicados/${id}/agenda`,
    publico: (v) => enderecoDaVista(codigo, v),
  };
  return (
    <TelaPublica titulo={`Mural do ${m.condominio}`} largo faixa={<FaixaMural condominio={m.condominio} linha={linhaDaFaixa(m)} whatsapp={m.comunicadosWhatsapp} />}>
      <MuralConteudo m={m} codigo={codigo} vista={vista} ir={ir} links={links} novos={novos} ultimaVisita={ultimaVisita} />
    </TelaPublica>
  );
}
