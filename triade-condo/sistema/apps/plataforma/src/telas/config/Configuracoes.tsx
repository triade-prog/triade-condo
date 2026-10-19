"use client";
// Configurações do condomínio (CF-06, CF-08, CF-10, AT-10, AT-14, AT-15), em abas. Quem só vê (pessoa
// autorizada sem a permissão Configurar) não encontra botão de mudar (CF-03).

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Abas, Aviso, Carregando, ErroCarregar } from "@triade/ui";
import { assinatura, useCarregar, usePlataforma } from "../sessao.tsx";
import type { Configuracoes as Config, Recado } from "../tipos.ts";
import { AbaHorarios } from "./AbaHorarios.tsx";
import { AbaFeriados } from "./AbaFeriados.tsx";
import { AbaCategorias } from "./AbaCategorias.tsx";
import { AbaEtapas } from "./AbaEtapas.tsx";
import { AbaPrazos } from "./AbaPrazos.tsx";
import { AbaRegras } from "./AbaRegras.tsx";
import { AbaManutencao } from "./AbaManutencao.tsx";
import { AbaComunicados } from "./AbaComunicados.tsx";
import { AbaLinksQr } from "./AbaLinksQr.tsx";
import { AbaWhatsapp } from "./AbaWhatsapp.tsx";

const ABAS = [
  { id: "horarios", texto: "Horários" },
  { id: "feriados", texto: "Feriados" },
  { id: "categorias", texto: "Categorias e prioridades" },
  { id: "etapas", texto: "Etapas e respostas" },
  { id: "prazos", texto: "Prazos e avisos" },
  { id: "regras", texto: "Regras dos pedidos" },
  { id: "manutencao", texto: "Manutenção" },
  { id: "comunicados", texto: "Comunicados" },
  { id: "links", texto: "Links e QR" },
  { id: "whatsapp", texto: "WhatsApp" },
] as const;
type IdAba = (typeof ABAS)[number]["id"];

export interface PropsAba {
  config: Config;
  pode: boolean;
  recarregar: () => void;
  /** Depois de salvar: recarrega, avisa e atualiza as pendências do painel. */
  salvo: (texto: string) => void;
}

export function Configuracoes() {
  const { atualizar } = usePlataforma();
  const config = useCarregar<Config>("/v1/condominio/configuracoes");
  const busca = useSearchParams();
  const router = useRouter();
  const inicial = ABAS.find((a) => a.id === busca.get("aba"))?.id ?? "horarios";
  const [aba, setAba] = useState<IdAba>(inicial);
  const [recado, setRecado] = useState<Recado>(null);

  function mudarAba(id: IdAba) {
    setAba(id);
    setRecado(null);
    router.replace(`/configuracoes?aba=${id}`, { scroll: false });
  }

  if (config.estado === "carregando") return <Carregando rotulo="Carregando as configurações…" />;
  if (config.estado === "erro") {
    return (
      <div className="grid gap-3">
        <h1 className="text-[28px] font-normal tracking-tight">Configurações</h1>
        <ErroCarregar texto={config.texto} tentarDeNovo={config.recarregar} />
      </div>
    );
  }

  const c = config.dados;
  const props: PropsAba = {
    config: c,
    pode: c.podeEditar,
    recarregar: config.recarregar,
    salvo: (texto) => { setRecado({ tom: "ok", texto }); config.recarregar(); atualizar(); },
  };
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[28px] font-normal tracking-tight">Configurações</h1>
        <p className="mt-1 text-tinta-suave">Tudo começou pronto pelo cenário do prédio. Ajuste só o que for diferente no seu condomínio.</p>
      </div>
      {!c.podeEditar ? <Aviso tom="info">Você pode ver as configurações. Para mudar, o síndico precisa dar a você a permissão Configurar.</Aviso> : null}
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <Abas abas={ABAS} atual={aba} aoMudar={mudarAba} rotulo="Partes das configurações">
        <div key={`${aba}-${assinatura(c)}`} className="pt-5">
          {aba === "horarios" ? <AbaHorarios {...props} /> : null}
          {aba === "feriados" ? <AbaFeriados {...props} /> : null}
          {aba === "categorias" ? <AbaCategorias {...props} /> : null}
          {aba === "etapas" ? <AbaEtapas {...props} /> : null}
          {aba === "prazos" ? <AbaPrazos {...props} /> : null}
          {aba === "regras" ? <AbaRegras {...props} /> : null}
          {aba === "manutencao" ? <AbaManutencao {...props} /> : null}
          {aba === "comunicados" ? <AbaComunicados {...props} /> : null}
          {aba === "links" ? <AbaLinksQr {...props} /> : null}
          {aba === "whatsapp" ? <AbaWhatsapp aoSalvar={props.salvo} /> : null}
        </div>
      </Abas>
    </div>
  );
}
