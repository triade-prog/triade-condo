"use client";
// Vida em condomínio (peça R12, design "Vida em condomínio", tela 2; DC15, telas-modelo vida-*;
// AC-01, AC-06): as quatro partes num trilho com ícone no topo (decisão A.1 de 22/10/2026), cada
// uma para quem pode vê-la, com o que espera aprovação contado. Uma frase diz o que é cada parte e
// há um só botão principal por parte (no celular, flutuante). Reservas, Enquetes (AC-03),
// Assembleias (AC-02) e Classificados (AC-05).

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ABAS_VIDA } from "@triade/domain";
import { Aviso, Botao, classeBotao, Icone, type NomeIcone } from "@triade/ui";
import { MenuAcoes, type ItemMenu } from "../moradores/comum.tsx";
import { usePlataforma } from "../sessao.tsx";
import type { Recado } from "../tipos.ts";
import { AbaReservas } from "./Reservas.tsx";
import { NovaReserva } from "./NovaReserva.tsx";
import { AbaEnquetes } from "./Enquetes.tsx";
import { AbaAssembleias } from "./Assembleias.tsx";
import { AbaClassificados } from "./Classificados.tsx";

type IdAba = keyof typeof ABAS_VIDA;
const VER: Record<IdAba, string> = { reservas: "reservas.ver", enquetes: "enquetes.ver", assembleias: "assembleias.ver", classificados: "classificados.ver" };
const EDITAR: Record<IdAba, string> = { reservas: "reservas.editar", enquetes: "enquetes.editar", assembleias: "assembleias.editar", classificados: "classificados.editar" };
const ICONE: Record<IdAba, NomeIcone> = { reservas: "calendario", enquetes: "grafico", assembleias: "pessoas", classificados: "megafone" };
const APOIO: Record<IdAba, string> = {
  reservas: "Os moradores reservam pelo WhatsApp com RESERVAR. Aqui você aprova, recusa e registra o que chega por telefone.",
  enquetes: "Enquete consulta, não decide. O que precisa de votação com valor vai para Assembleias.",
  assembleias: "Pauta, convocação, presença, procurações e votos. A videochamada é de um serviço de fora.",
  classificados: "Os moradores anunciam pelo WhatsApp. No mural vão o primeiro nome e o bloco, nunca a unidade.",
};

/** O recado de quem voltou de uma página da Vida (a enquete nova manda o que aconteceu no endereço). */
function recadoDoEndereco(b: URLSearchParams): Recado {
  if (b.get("feito") !== "enquete") return null;
  const n = Number(b.get("n")) || 0;
  const quem = b.get("por") === "PESSOA" ? (n === 1 ? "1 pessoa" : `${n} pessoas`) : (n === 1 ? "1 unidade" : `${n} unidades`);
  return { tom: "ok", texto: `Enquete enviada para ${quem}. Cada uma recebe um link só dela${b.get("mural") ? ", e a pergunta aparece no mural" : ""}.` };
}

export function Vida() {
  const { painel, pode, atualizar } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const abas = (Object.keys(ABAS_VIDA) as IdAba[]).filter((id) => pode(VER[id]));
  const [aba, setAba] = useState<IdAba>(abas.find((a) => a === busca.get("aba")) ?? abas[0] ?? "reservas");
  const [nova, setNova] = useState(false);
  const [recado, setRecado] = useState<Recado>(() => recadoDoEndereco(busca));
  const [geracao, setGeracao] = useState(0);
  const [mais, setMais] = useState<ItemMenu[]>([]);
  const conta: Partial<Record<IdAba, number>> = { reservas: painel.vida?.reservasAAprovar, classificados: painel.vida?.classificadosAAprovar };

  function mudarAba(id: IdAba) {
    setAba(id);
    setRecado(null);
    setMais([]);
    router.replace(`/vida?aba=${id}`, { scroll: false });
  }
  const mudou = (texto: string) => { setRecado({ tom: "ok", texto }); setGeracao((g) => g + 1); atualizar(); };

  const editar = pode(EDITAR[aba]);
  const principal = !editar ? null
    : aba === "reservas" ? <Botao onClick={() => setNova(true)}><Icone nome="mais" />Nova reserva</Botao>
      : aba === "enquetes" ? <Link href="/vida/nova-enquete" className={classeBotao("primario")}><Icone nome="mais" />Nova enquete</Link>
        : aba === "assembleias" ? <Link href="/vida/nova-assembleia" className={classeBotao("primario")}><Icone nome="mais" />Nova assembleia</Link> : null;

  return (
    <div className="grid gap-5 max-md:pb-16">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid gap-3 max-md:w-full">
          <div role="group" aria-label="Partes da Vida em condomínio" className="trilho max-md:flex max-md:flex-nowrap">
            {abas.map((id) => {
              const atual = id === aba;
              const n = conta[id];
              return (
                <button key={id} type="button" className="chip max-md:flex-1 max-md:justify-center" aria-pressed={atual} onClick={() => mudarAba(id)}>
                  <Icone nome={ICONE[id]} />
                  <span className={atual ? "" : "max-md:sr-only"}>{ABAS_VIDA[id]}</span>
                  {n ? <><span className="sr-only"> ({n} a aprovar)</span><span aria-hidden="true" className={`contagem ml-0 ${atual ? "bg-superficie" : ""}`}>{n}</span></> : null}
                </button>
              );
            })}
          </div>
          <div>
            <h1 className="t-titulo-tela">Vida em condomínio</h1>
            <p className="t-apoio mt-1">{APOIO[aba]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MenuAcoes rotulo="Mais ações" texto="Mais ações" itens={mais} />
          {principal ? <div className="max-md:hidden">{principal}</div> : null}
        </div>
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <div>
        {aba === "reservas" ? <AbaReservas key={geracao} aoMudar={mudou} /> : null}
        {aba === "enquetes" ? <AbaEnquetes key={geracao} /> : null}
        {aba === "assembleias" ? <AbaAssembleias key={geracao} aoMudar={mudou} definirMais={setMais} /> : null}
        {aba === "classificados" ? <AbaClassificados key={geracao} aoMudar={mudou} /> : null}
      </div>
      {principal ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{principal}</div> : null}
      {nova && aba === "reservas" ? <NovaReserva aoFechar={() => setNova(false)} aoSalvar={(t) => { setNova(false); mudou(t); }} /> : null}
    </div>
  );
}
