"use client";
// Mural online do prédio (design "Mural online e e-mail", tela 1; CD-12, CD-14), em feed desde
// a CD-15 (canvas do novo frontend, quadros 72 a 79): os comunicados para todo o condomínio, do
// mais novo ao mais antigo, sem conta nem senha, e o pedido de documento por e-mail, com resposta
// sempre neutra. Nada de nomes, telefones ou unidades. As seções do manual do prédio marcadas "no
// mural" ficam numa aba ao lado (peça R10, MP-14). As enquetes abertas ficam fixadas no alto;
// responde-se pelo link pessoal (peça R12, AC-03). Os anúncios dos moradores ficam na vitrine dos
// Classificados, com o aviso de que o condomínio não vende nem garante nada (peça R12, AC-05). Com
// os comunicados pelo WhatsApp ligados, o botão "Receber pelo WhatsApp" abre a conversa com
// COMUNICADOS (F6.6, W-20). A vista fica no endereço: ?aba=, ?c= (o aviso) e ?anuncio=.

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Aviso, Carregando, chamarApi, textoDoErro } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import type { MuralPublico } from "../tipos.ts";
import { TelaPublica } from "./comum.tsx";
import { MuralConteudo, type LinksDoMural, type VistaMural } from "./MuralConteudo.tsx";

type Carga = { estado: "carregando" } | { estado: "erro"; texto: string } | { estado: "pronto"; dados: MuralPublico };

/** O endereço de uma vista do mural, para a barra do navegador e para compartilhar. */
export function enderecoDaVista(codigo: string, v: VistaMural): string {
  const q = new URLSearchParams();
  if (v.comunicado) q.set("c", v.comunicado);
  else if (v.anuncio) q.set("anuncio", v.anuncio);
  else if (v.aba !== "avisos") q.set("aba", v.aba);
  const busca = q.toString();
  return `/m/${codigo}${busca ? `?${busca}` : ""}`;
}

export function Mural() {
  const { codigo } = useParams<{ codigo: string }>();
  const busca = useSearchParams();
  const router = useRouter();
  const [carga, setCarga] = useState<Carga>({ estado: "carregando" });

  useEffect(() => {
    void chamarApi<MuralPublico>(`/v1/publico/mural/${encodeURIComponent(codigo)}`).then((r) => {
      if (r.ok) setCarga({ estado: "pronto", dados: r.dados });
      else setCarga({ estado: "erro", texto: r.status === 404 ? "Este mural não existe. Confira o endereço ou peça o link ao condomínio." : textoDoErro(r.erro) });
    });
  }, [codigo]);

  if (carga.estado === "carregando") return <TelaPublica titulo="Mural do condomínio"><Carregando rotulo="Abrindo o mural…" /></TelaPublica>;
  if (carga.estado === "erro") return <TelaPublica titulo="Mural do condomínio"><Aviso tom="atencao">{carga.texto}</Aviso></TelaPublica>;
  const m = carga.dados;
  const titulo = `Mural do ${m.condominio}`;
  if (m.trocado) return <TelaPublica titulo={titulo}><Aviso tom="atencao" titulo="Este endereço mudou">Peça o link novo ao condomínio.</Aviso></TelaPublica>;
  if (m.foraDoAr) return <TelaPublica titulo={titulo}><Aviso tom="info" titulo="Este mural está fora do ar">Os avisos continuam chegando pelo condomínio.</Aviso></TelaPublica>;

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
    publico: (v) => enderecoDaVista(codigo, v),
  };
  const subtitulo = vista.aba === "classificados" ? "Classificados entre moradores" : vista.aba === "manual" ? "Manual do prédio"
    : `Avisos para todo o condomínio${m.atualizadoEm ? ` · atualizado ${diaHora(m.atualizadoEm)}` : ""}`;
  return (
    <TelaPublica titulo={titulo} subtitulo={subtitulo}>
      <MuralConteudo m={m} codigo={codigo} vista={vista} ir={ir} links={links} />
    </TelaPublica>
  );
}
