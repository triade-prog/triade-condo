"use client";
// Pessoas e acesso (V-09, CF-02, CF-03, CF-04, CF-05): quem entra na Plataforma deste
// condomínio, com as permissões de cada um, e quem atende os pedidos. Só o síndico mexe aqui.

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Abas, Aviso, Carregando, ErroCarregar } from "@triade/ui";
import { assinatura, useCarregar, usePlataforma } from "../sessao.tsx";
import type { Pessoas as DadosPessoas, Recado } from "../tipos.ts";
import { AbaPessoas } from "./AbaPessoas.tsx";
import { AbaAtendimento } from "./AbaAtendimento.tsx";

export interface PropsPessoas {
  dados: DadosPessoas;
  pode: (acao: string) => boolean;
  recarregar: () => void;
  salvo: (r: Recado) => void;
}

export function Pessoas() {
  const { pode, atualizar } = usePlataforma();
  const carga = useCarregar<DadosPessoas>("/v1/condominio/pessoas");
  const busca = useSearchParams();
  const router = useRouter();
  const abas = [
    { id: "pessoas" as const, texto: "Pessoas" },
    ...(pode("atendimento.responsaveis") ? [{ id: "atendimento" as const, texto: "Quem atende" }] : []),
  ];
  const [aba, setAba] = useState<"pessoas" | "atendimento">(abas.find((a) => a.id === busca.get("aba"))?.id ?? "pessoas");
  const [recado, setRecado] = useState<Recado>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as pessoas…" />;
  if (carga.estado === "erro") {
    return (
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Pessoas e acesso</h1>
        <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />
      </div>
    );
  }

  const props: PropsPessoas = {
    dados: carga.dados,
    pode,
    recarregar: carga.recarregar,
    salvo: (r) => { setRecado(r); carga.recarregar(); atualizar(); },
  };
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pessoas e acesso</h1>
        <p className="mt-1 text-tinta-suave">Quem entra na Plataforma deste condomínio. Cada pessoa tem o seu acesso; nada de conta compartilhada.</p>
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <Abas abas={abas} atual={aba} rotulo="Partes de pessoas e acesso"
        aoMudar={(id) => { setAba(id); setRecado(null); router.replace(`/pessoas?aba=${id}`, { scroll: false }); }}>
        <div key={`${aba}-${assinatura(carga.dados)}`} className="pt-5">
          {aba === "pessoas" ? <AbaPessoas {...props} /> : <AbaAtendimento {...props} />}
        </div>
      </Abas>
    </div>
  );
}
