"use client";
// Vida em condomínio (peça R12, design "Vida em condomínio", tela 2; AC-01, AC-06): menu novo
// com abas, cada uma para quem pode vê-la. Reservas, Enquetes (AC-03), Assembleias (AC-02) e
// Classificados (AC-05).

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ABAS_VIDA } from "@triade/domain";
import { Abas, Aviso, Botao, Icone } from "@triade/ui";
import { usePlataforma } from "../sessao.tsx";
import type { Recado } from "../tipos.ts";
import { AbaReservas } from "./Reservas.tsx";
import { NovaReserva } from "./NovaReserva.tsx";
import { AbaEnquetes } from "./Enquetes.tsx";
import { NovaEnquete } from "./NovaEnquete.tsx";
import { AbaAssembleias, FormAssembleia } from "./Assembleias.tsx";
import { AbaClassificados } from "./Classificados.tsx";

type IdAba = keyof typeof ABAS_VIDA;
const VER: Record<IdAba, string> = { reservas: "reservas.ver", enquetes: "enquetes.ver", assembleias: "assembleias.ver", classificados: "classificados.ver" };

export function Vida() {
  const { painel, pode, atualizar } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const abas = (Object.keys(ABAS_VIDA) as IdAba[]).filter((id) => pode(VER[id])).map((id) => ({ id, texto: ABAS_VIDA[id] }));
  const [aba, setAba] = useState<IdAba>(abas.find((a) => a.id === busca.get("aba"))?.id ?? abas[0]?.id ?? "reservas");
  const [nova, setNova] = useState(false);
  const [recado, setRecado] = useState<Recado>(null);
  const [geracao, setGeracao] = useState(0);

  function mudarAba(id: IdAba) {
    setAba(id);
    setRecado(null);
    router.replace(`/vida?aba=${id}`, { scroll: false });
  }
  const mudou = (texto: string) => { setRecado({ tom: "ok", texto }); setGeracao((g) => g + 1); atualizar(); };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Vida em condomínio</h1>
          <p className="mt-1 text-tinta-suave">Reservas, enquetes, assembleias e classificados do {painel.condominio.nome}.</p>
        </div>
        {aba === "reservas" && pode("reservas.editar") ? <Botao onClick={() => setNova(true)}><Icone nome="mais" />Nova reserva</Botao> : null}
        {aba === "enquetes" && pode("enquetes.editar") ? <Botao onClick={() => setNova(true)}><Icone nome="mais" />Nova enquete</Botao> : null}
        {aba === "assembleias" && pode("assembleias.editar") ? <Botao onClick={() => setNova(true)}><Icone nome="mais" />Nova assembleia</Botao> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <Abas abas={abas} atual={aba} aoMudar={mudarAba} rotulo="Partes da Vida em condomínio">
        <div className="pt-5">
          {aba === "reservas" ? <AbaReservas key={geracao} aoMudar={mudou} /> : null}
          {aba === "enquetes" ? <AbaEnquetes key={geracao} aoMudar={mudou} /> : null}
          {aba === "assembleias" ? <AbaAssembleias key={geracao} aoMudar={mudou} /> : null}
          {aba === "classificados" ? <AbaClassificados key={geracao} aoMudar={mudou} /> : null}
        </div>
      </Abas>
      {nova && aba === "reservas" ? <NovaReserva aoFechar={() => setNova(false)} aoSalvar={(t) => { setNova(false); mudou(t); }} /> : null}
      {nova && aba === "enquetes" ? <NovaEnquete aoFechar={() => setNova(false)} aoSalvar={(t) => { setNova(false); mudou(t); }} /> : null}
      {nova && aba === "assembleias" ? <FormAssembleia aoFechar={() => setNova(false)} aoSalvar={(id) => router.push(`/vida/assembleia?id=${id}`)} /> : null}
    </div>
  );
}
