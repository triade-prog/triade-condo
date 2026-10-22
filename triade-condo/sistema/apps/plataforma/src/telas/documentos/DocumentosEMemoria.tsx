"use client";
// Documentos e memória (DC15, telas-modelo documentos-memoria-*; canvas do novo frontend, quadros
// 80 a 100; MP-12, MP-14, CT-02, CT-03, CT-04, CD-07): Documentos e as partes da Memória do prédio
// numa tela só, com o trilho de ícones no topo e um endereço para cada parte (decisão A.1 de
// 22/10/2026). Uma frase diz o que é cada parte e há um só botão principal por parte (no celular,
// flutuante). Passagem e exportação é uma parte só, que aparece só para o síndico (C.1).

import Link from "next/link";
import { useState } from "react";
import { enderecoParteDocumentos, PARTES_DOCUMENTOS, type ParteDocumentos } from "@triade/domain";
import { Aviso, Botao, classeBotao, Icone, type NomeIcone } from "@triade/ui";
import { MenuAcoes, type ItemMenu } from "../moradores/comum.tsx";
import { usePlataforma } from "../sessao.tsx";
import type { Recado } from "../tipos.ts";
import { Documentos } from "../comunicados/Documentos.tsx";
import { AbaProntuario } from "../memoria/Prontuario.tsx";
import { AbaLinhaDoTempo } from "../memoria/LinhaDoTempo.tsx";
import { AbaManual } from "../memoria/Manual.tsx";
import { AbaPassagem } from "../memoria/Passagem.tsx";

const ICONE: Record<ParteDocumentos, NomeIcone> = { documentos: "documento", prontuario: "lista", linha: "relogio", manual: "casa", passagem: "trocar" };
/** No celular, o nome da parte aberta aparece mais curto. */
const CURTO: Partial<Record<ParteDocumentos, string>> = { manual: "Manual", passagem: "Passagem" };
const APOIO: Record<ParteDocumentos, string> = {
  documentos: "Convenção, regimento, atas, contratos e laudos. Cada arquivo novo vira uma versão; a anterior fica guardada.",
  prontuario: "Os documentos que todo condomínio precisa ter em dia. Avisa antes de vencer.",
  linha: "O que aconteceu no condomínio, do mais novo ao mais antigo. Corrigir uma anotação guarda a versão anterior.",
  manual: "Como as coisas funcionam no prédio. As seções marcadas vão ao mural dos moradores.",
  passagem: "Para a troca de síndico e para levar os dados do condomínio. Só o síndico vê esta parte.",
};

/** O botão principal da parte e o que fica em Mais ações; cada parte diz os seus quando carrega. */
export interface AcoesDaParte {
  principal?: { texto: string; icone: NomeIcone; aoClicar: () => void } | null;
  mais?: ItemMenu[];
  /** O botão principal não flutua no celular (a parte já tem o botão no meio da tela). */
  semFlutuante?: boolean;
}

export interface PropsAbaMemoria {
  /** Depois de mudar algo: avisa no topo e atualiza o início. */
  feito: (texto: string, tom?: "ok" | "atencao") => void;
  /** O botão principal e Mais ações da parte, no cabeçalho. */
  definir: (a: AcoesDaParte) => void;
}

/** As partes que a pessoa vê: Passagem e exportação só para quem gera o dossiê ou exporta. */
export function useParteVisivel() {
  const { pode } = usePlataforma();
  return (p: ParteDocumentos) => (p === "passagem" ? pode("memoria.dossie") || pode("memoria.exportar") : true);
}

/** O trilho das partes. Também fica no topo da ficha do documento e do dossiê. */
export function TrilhoDocumentos({ atual }: { atual: ParteDocumentos }) {
  const { painel } = usePlataforma();
  const visivel = useParteVisivel();
  const r = painel.memoria?.prontuario;
  const conta: Partial<Record<ParteDocumentos, number>> = { prontuario: r ? r.venceu + r.vence : 0 };
  return (
    <nav aria-label="Partes de Documentos e memória" className="trilho print:hidden max-md:flex max-md:flex-nowrap">
      {(Object.keys(PARTES_DOCUMENTOS) as ParteDocumentos[]).filter(visivel).map((p) => {
        const e = p === atual;
        const n = conta[p];
        return (
          <Link key={p} href={enderecoParteDocumentos(p)} className={`chip whitespace-nowrap ${e ? "max-md:flex-1" : "max-md:w-12 max-md:shrink-0"} max-md:justify-center`}
            aria-current={e ? "page" : undefined} data-escolhido={e ? "" : undefined}>
            <Icone nome={ICONE[p]} />
            <span className={e ? "" : "max-md:sr-only"}>
              {CURTO[p] && e ? <><span className="md:hidden">{CURTO[p]}</span><span className="max-md:hidden">{PARTES_DOCUMENTOS[p]}</span></> : PARTES_DOCUMENTOS[p]}
            </span>
            {n ? <><span className="sr-only"> ({n} vencendo)</span><span aria-hidden="true" className={`contagem ml-0 ${e ? "bg-superficie" : ""}`}>{n}</span></> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function DocumentosEMemoria({ parte }: { parte: ParteDocumentos }) {
  const { atualizar } = usePlataforma();
  const visivel = useParteVisivel();
  const [recado, setRecado] = useState<Recado>(null);
  const [acoes, setAcoes] = useState<AcoesDaParte>({});
  const props: PropsAbaMemoria = {
    feito: (texto, tom = "ok") => { setRecado({ tom, texto }); atualizar(); },
    definir: setAcoes,
  };
  const p = visivel(parte) ? parte : "prontuario";
  const principal = acoes.principal
    ? <Botao onClick={acoes.principal.aoClicar}><Icone nome={acoes.principal.icone} />{acoes.principal.texto}</Botao> : null;

  return (
    <div className="grid gap-5 max-md:pb-16">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid gap-3 max-md:w-full">
          <TrilhoDocumentos atual={p} />
          <div>
            <h1 className="t-titulo-tela">Documentos e memória</h1>
            <p className="t-apoio mt-1">{APOIO[p]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MenuAcoes rotulo="Mais ações" texto="Mais ações" itens={acoes.mais ?? []} />
          {principal ? <div className="max-md:hidden">{principal}</div> : null}
        </div>
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <div>
        {p === "documentos" ? <Documentos {...props} /> : null}
        {p === "prontuario" ? <AbaProntuario {...props} /> : null}
        {p === "linha" ? <AbaLinhaDoTempo {...props} /> : null}
        {p === "manual" ? <AbaManual {...props} /> : null}
        {p === "passagem" ? <AbaPassagem {...props} /> : null}
      </div>
      {principal && !acoes.semFlutuante ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{principal}</div> : null}
    </div>
  );
}

/** O link de volta, no topo da ficha do documento e do dossiê. */
export function VoltarParte({ parte }: { parte: ParteDocumentos }) {
  return (
    <Link href={enderecoParteDocumentos(parte)} className={classeBotao("discreto", "justify-self-start !px-0 print:hidden", "m")}>
      <Icone nome="esq" className="h-4 w-4" />{PARTES_DOCUMENTOS[parte]}
    </Link>
  );
}
