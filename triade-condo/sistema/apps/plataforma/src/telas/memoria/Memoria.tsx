"use client";
// Memória do prédio (design "Memória do prédio", aprovado em 18/10/2026; MP-12, MP-14, CT-02,
// CT-03, CT-04): o que fica com o prédio quando o síndico muda, em abas. Ver é de quem vê os
// documentos; a passagem de bastão e a exportação aparecem só para o síndico.

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Abas, Aviso } from "@triade/ui";
import { usePlataforma } from "../sessao.tsx";
import type { Recado } from "../tipos.ts";
import { AbaProntuario } from "./Prontuario.tsx";
import { AbaLinhaDoTempo } from "./LinhaDoTempo.tsx";
import { AbaManual } from "./Manual.tsx";
import { AbaPassagem } from "./Passagem.tsx";
import { AbaExportar } from "./Exportar.tsx";

const TODAS = [
  { id: "prontuario", texto: "Prontuário", sub: "O que fica com o prédio quando o síndico muda." },
  { id: "linha", texto: "Linha do tempo", sub: "O que aconteceu com o prédio, do mais novo ao mais antigo." },
  { id: "manual", texto: "Manual do prédio", sub: "Como as coisas funcionam no prédio." },
  { id: "passagem", texto: "Passagem de bastão", sub: "Tudo o que o próximo síndico precisa receber." },
  { id: "exportar", texto: "Exportar", sub: "Levar todo o histórico do condomínio." },
] as const;
type IdAba = (typeof TODAS)[number]["id"];

export interface PropsAbaMemoria {
  /** Depois de mudar algo: avisa no topo e atualiza o início. */
  feito: (texto: string) => void;
}

export function Memoria() {
  const { pode, atualizar } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const abas = TODAS.filter((a) => (a.id === "passagem" ? pode("memoria.dossie") : a.id === "exportar" ? pode("memoria.exportar") : true));
  const inicial = abas.find((a) => a.id === busca.get("aba"))?.id ?? "prontuario";
  const [aba, setAba] = useState<IdAba>(inicial);
  const [recado, setRecado] = useState<Recado>(null);
  const atual = abas.find((a) => a.id === aba) ?? abas[0]!;

  function mudarAba(id: IdAba) {
    setAba(id);
    setRecado(null);
    router.replace(`/memoria?aba=${id}`, { scroll: false });
  }
  const props: PropsAbaMemoria = { feito: (texto) => { setRecado({ tom: "ok", texto }); atualizar(); } };

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[28px] font-normal tracking-tight">Memória do prédio</h1>
        <p className="mt-1 text-tinta-suave">{atual.sub}</p>
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <Abas abas={abas} atual={aba} aoMudar={mudarAba} rotulo="Partes da memória do prédio">
        <div className="pt-4">
          {aba === "prontuario" ? <AbaProntuario {...props} /> : null}
          {aba === "linha" ? <AbaLinhaDoTempo {...props} /> : null}
          {aba === "manual" ? <AbaManual {...props} /> : null}
          {aba === "passagem" ? <AbaPassagem {...props} /> : null}
          {aba === "exportar" ? <AbaExportar {...props} /> : null}
        </div>
      </Abas>
    </div>
  );
}
