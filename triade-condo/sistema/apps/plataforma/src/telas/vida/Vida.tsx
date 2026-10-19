"use client";
// Vida em condomínio (peça R12, design "Vida em condomínio", tela 2; AC-01, AC-06): menu novo
// com abas. Por enquanto, Reservas; enquetes, assembleias e classificados entram como abas novas.

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ABAS_VIDA } from "@triade/domain";
import { Abas, Aviso, Botao, Icone } from "@triade/ui";
import { usePlataforma } from "../sessao.tsx";
import type { Recado } from "../tipos.ts";
import { AbaReservas } from "./Reservas.tsx";
import { NovaReserva } from "./NovaReserva.tsx";

const ABAS = Object.entries(ABAS_VIDA).map(([id, texto]) => ({ id: id as keyof typeof ABAS_VIDA, texto }));
type IdAba = keyof typeof ABAS_VIDA;

export function Vida() {
  const { painel, pode, atualizar } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const [aba, setAba] = useState<IdAba>(ABAS.find((a) => a.id === busca.get("aba"))?.id ?? "reservas");
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
          <p className="mt-1 text-tinta-suave">Reservas das áreas comuns do {painel.condominio.nome}.</p>
        </div>
        {aba === "reservas" && pode("reservas.editar") ? <Botao onClick={() => setNova(true)}><Icone nome="mais" />Nova reserva</Botao> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <Abas abas={ABAS} atual={aba} aoMudar={mudarAba} rotulo="Partes da Vida em condomínio">
        <div className="pt-5">
          {aba === "reservas" ? <AbaReservas key={geracao} aoMudar={mudou} /> : null}
        </div>
      </Abas>
      {nova ? <NovaReserva aoFechar={() => setNova(false)} aoSalvar={(t) => { setNova(false); mudou(t); }} /> : null}
    </div>
  );
}
