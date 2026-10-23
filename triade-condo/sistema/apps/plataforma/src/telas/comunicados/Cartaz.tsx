"use client";
// Cartaz do mural (design "Mural online e e-mail", tela 2): folha A4 com o nome do condomínio, o
// QR e o endereço, para o elevador e o hall (CD-12). O topo de prévia e a folha A4 são os mesmos
// dos outros impressos (decisão D.1, 23/10/2026).

import Link from "next/link";
import { Aviso, Carregando, classeBotao, ErroCarregar, FolhaA4, Icone, Logo, PreviaImpressao } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { PlanoComunicacao } from "../tipos.ts";
import { enderecoMural, QrCode } from "./QrCode.tsx";

export function Cartaz() {
  const plano = useCarregar<PlanoComunicacao>("/v1/condominio/plano-comunicacao");
  const cond = useCarregar<{ nome: string }>("/v1/condominio");
  if (plano.estado === "carregando" || cond.estado === "carregando") return <main className="mx-auto max-w-3xl p-8"><Carregando rotulo="Preparando o cartaz…" /></main>;
  if (plano.estado === "erro") return <main className="mx-auto max-w-3xl p-8"><ErroCarregar erro={plano.erro} texto={plano.texto} tentarDeNovo={plano.recarregar} /></main>;
  const codigo = plano.dados.mural.codigo;
  const link = codigo ? enderecoMural(codigo) : null;
  const ligado = plano.dados.mural.ligado;
  const nome = cond.estado === "pronto" ? cond.dados.nome : "condomínio";
  return (
    <PreviaImpressao titulo="Cartaz do mural" apoio="Folha A4 em pé · cole no elevador e no hall" voltar="/configuracoes/mural" podeImprimir={Boolean(link && ligado)}
      aviso={!ligado ? (
        <Aviso tom="atencao" titulo="O mural está desligado">
          O cartaz leva os moradores ao mural. Ligue antes de imprimir.
          <span className="mt-2 block"><Link href="/configuracoes/mural" className={classeBotao("contorno", "", "m")}><Icone nome="ajuste" />Ir para Configurações › Mural e e-mail</Link></span>
        </Aviso>
      ) : !link ? <Aviso tom="info">O link aparece ao ligar o mural.</Aviso> : null}
      legenda={link && ligado ? "Como sai na impressão" : undefined}>
      {link ? (
        <FolhaA4 rotulo="Cartaz do mural" className="p-[1cm]">
          <div className="flex flex-1 flex-col items-center justify-center gap-7 rounded-[18px] border border-linha p-[1.4cm] text-center">
            <span className="h-1.5 self-stretch rounded-full bg-linear-to-r from-laranja-200 to-laranja-500" aria-hidden="true" />
            <span className="grid justify-items-center gap-1">
              <Logo className="h-12 w-auto" />
              <small className="text-[11px] font-semibold tracking-[.16em] text-tinta-suave uppercase">Mural online</small>
            </span>
            <h2 className="text-[44px] leading-[1.15] font-medium">Mural do<br />{nome}</h2>
            <QrCode texto={link} rotulo="QR do mural online" className="h-[7.8cm] w-[7.8cm]" />
            <p className="max-w-[13cm] text-[22px] leading-normal">Aponte a câmera do celular. Os avisos do condomínio, sem app e sem senha.</p>
            <span className="grid gap-0.5">
              <span className="text-base text-tinta-suave">ou digite</span>
              <EnderecoSemQuebra link={link} />
            </span>
          </div>
        </FolhaA4>
      ) : null}
    </PreviaImpressao>
  );
}

/** O endereço só quebra antes do código, nunca no meio dele. */
function EnderecoSemQuebra({ link }: { link: string }) {
  const corte = link.lastIndexOf("/") + 1;
  const sem = link.replace(/^https?:\/\//, "");
  const inicio = sem.slice(0, sem.length - (link.length - corte));
  return (
    <span className="font-mono text-xl font-semibold">
      <span className="whitespace-nowrap">{inicio}</span><wbr /><span className="whitespace-nowrap">{link.slice(corte)}</span>
    </span>
  );
}
