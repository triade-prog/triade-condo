"use client";
// Configurações do condomínio no app (CF-06, CF-08, CF-10, AT-10). As abas são as mesmas da aba
// Configuração do Console (@triade/configuracoes); aqui ficam a aba na URL e as pendências do painel.

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ABAS_CONFIGURACAO, PainelConfiguracoes, type IdAba } from "@triade/configuracoes";
import { usePlataforma } from "../sessao.tsx";

export function Configuracoes() {
  const { atualizar } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const [aba, setAba] = useState<IdAba>(ABAS_CONFIGURACAO.find((a) => a.id === busca.get("aba"))?.id ?? "horarios");

  function mudarAba(id: IdAba) {
    setAba(id);
    router.replace(`/configuracoes?aba=${id}`, { scroll: false });
  }

  return (
    <PainelConfiguracoes ambiente={{ onde: "app", base: "/v1/condominio", aoMudar: atualizar }} aba={aba} aoMudarAba={mudarAba}
      apresentacao={
        <div>
          <h1 className="text-[28px] font-normal tracking-tight">Configurações</h1>
          <p className="mt-1 text-tinta-suave">A TRÍADE montou tudo na implantação. Ajuste o que mudar no seu condomínio.</p>
        </div>
      } />
  );
}
