"use client";
// Configurações do condomínio (CF-06, CF-08, CF-10, AT-10, AT-14, AT-15; áreas comuns, AC-07), em abas. Quem só vê (pessoa
// autorizada sem a permissão Configurar) não encontra botão de mudar (CF-03). As mesmas abas
// servem ao app e à aba Configuração do Console (PI-04, decisão 7); quem hospeda guarda a aba.

import { useState, type ReactNode } from "react";
import { Abas, Aviso, Carregando, ErroCarregar } from "@triade/ui";
import { assinatura, ProvedorConfiguracao, useAmbiente, useCarregar, naBase, type Ambiente } from "./contexto.tsx";
import type { Tecnica } from "./tecnica.tsx";
import type { Configuracoes as Config, Recado } from "./tipos.ts";
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
import { AbaAreasComuns } from "./AbaAreasComuns.tsx";

export const ABAS_CONFIGURACAO = [
  { id: "horarios", texto: "Horários" },
  { id: "feriados", texto: "Feriados" },
  { id: "areas", texto: "Áreas comuns" },
  { id: "categorias", texto: "Categorias e prioridades" },
  { id: "etapas", texto: "Etapas e respostas" },
  { id: "prazos", texto: "Prazos e avisos" },
  { id: "regras", texto: "Regras dos pedidos" },
  { id: "manutencao", texto: "Manutenção" },
  { id: "comunicados", texto: "Comunicados" },
  { id: "links", texto: "Links e QR" },
  { id: "whatsapp", texto: "WhatsApp" },
] as const;
export type IdAba = (typeof ABAS_CONFIGURACAO)[number]["id"];

export interface PropsAba {
  config: Config;
  pode: boolean;
  recarregar: () => void;
  /** Depois de salvar: recarrega, avisa e atualiza as pendências do painel. */
  salvo: (texto: string) => void;
  /** Ajustes que são só da TRÍADE (CF-09): no app, só leitura; no Console, com motivo depois da entrega. */
  tecnica: Tecnica;
}

/** As abas das Configurações no ambiente dado; `aba` e `aoMudarAba` ficam com quem hospeda. */
export function Configuracoes({ ambiente, aba, aoMudarAba, apresentacao }: {
  ambiente: Ambiente;
  aba: IdAba;
  aoMudarAba: (id: IdAba) => void;
  /** Texto do topo, de quem hospeda. */
  apresentacao?: ReactNode;
}) {
  return (
    <ProvedorConfiguracao ambiente={ambiente}>
      <Abas_ aba={aba} aoMudarAba={aoMudarAba} apresentacao={apresentacao} />
    </ProvedorConfiguracao>
  );
}

function Abas_({ aba, aoMudarAba, apresentacao }: { aba: IdAba; aoMudarAba: (id: IdAba) => void; apresentacao?: ReactNode }) {
  const ambiente = useAmbiente();
  const config = useCarregar<Config>(naBase("/configuracoes"));
  const [recado, setRecado] = useState<Recado>(null);

  function mudarAba(id: IdAba) {
    setRecado(null);
    aoMudarAba(id);
  }

  if (config.estado === "carregando") return <Carregando rotulo="Carregando as configurações…" />;
  if (config.estado === "erro") return <ErroCarregar texto={config.texto} tentarDeNovo={config.recarregar} />;

  const c = config.dados;
  const props: PropsAba = {
    config: c,
    pode: c.podeEditar,
    recarregar: config.recarregar,
    salvo: (texto) => { setRecado({ tom: "ok", texto }); config.recarregar(); ambiente.aoMudar?.(); },
    tecnica: c.tecnica ?? { pode: false, motivo: false },
  };
  return (
    <div className="grid gap-5">
      {apresentacao}
      {!c.podeEditar && ambiente.onde === "app" ? <Aviso tom="info">Você pode ver as configurações. Para mudar, o síndico precisa dar a você a permissão Configurar.</Aviso> : null}
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      <Abas abas={ABAS_CONFIGURACAO} atual={aba} aoMudar={mudarAba} rotulo="Partes das configurações">
        <div key={`${aba}-${assinatura(c)}`} className="pt-5">
          {aba === "horarios" ? <AbaHorarios {...props} /> : null}
          {aba === "feriados" ? <AbaFeriados {...props} /> : null}
          {aba === "areas" ? <AbaAreasComuns {...props} /> : null}
          {aba === "categorias" ? <AbaCategorias {...props} /> : null}
          {aba === "etapas" ? <AbaEtapas {...props} /> : null}
          {aba === "prazos" ? <AbaPrazos {...props} /> : null}
          {aba === "regras" ? <AbaRegras {...props} /> : null}
          {aba === "manutencao" ? <AbaManutencao {...props} /> : null}
          {aba === "comunicados" ? <AbaComunicados {...props} /> : null}
          {aba === "links" ? <AbaLinksQr {...props} /> : null}
          {aba === "whatsapp" ? <AbaWhatsapp aoSalvar={props.salvo} tecnica={props.tecnica} /> : null}
        </div>
      </Abas>
    </div>
  );
}
