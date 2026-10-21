"use client";
// Cartaz do mural (design "Mural online e e-mail", tela 2): folha A4 com o nome do condomínio, o
// QR e o endereço, para o elevador e o hall (CD-12).

import { Aviso, Botao, Carregando, ErroCarregar, Marca } from "@triade/ui";
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
  return (
    <main className="mx-auto grid max-w-[21cm] gap-6 bg-superficie p-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-tinta-suave">Imprima em folha A4 em pé e cole no elevador e no hall.</p>
        <Botao onClick={() => window.print()} disabled={!link || !plano.dados.mural.ligado}>Imprimir</Botao>
      </div>
      {!plano.dados.mural.ligado ? <Aviso tom="atencao" className="print:hidden">O mural está desligado. Ligue em Configurações › Comunicados antes de imprimir.</Aviso> : null}
      {link ? (
        <section className="grid justify-items-center gap-5 rounded-2xl border border-linha p-10 text-center print:border-0">
          <Marca sistema="Mural online" />
          <h1 className="text-[34px] leading-tight font-semibold">Mural do {cond.estado === "pronto" ? cond.dados.nome : "condomínio"}</h1>
          <QrCode texto={link} rotulo="QR do mural online" className="h-72 w-72" />
          <p className="max-w-md text-lg">Aponte a câmera do celular. Os avisos do condomínio, sem app e sem senha.</p>
          <p className="font-mono text-base break-all">{link}</p>
        </section>
      ) : <Aviso tom="info">O link aparece ao ligar o mural.</Aviso>}
    </main>
  );
}
