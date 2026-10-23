"use client";
// Resumo para o síndico (PI-04, PI-06, SH-01; tela-modelo console-resumo-sindico, rodada Console,
// decisão D.1 de 23/10/2026): para mostrar na apresentação (etapa 5), na tela ou impresso, com o
// mesmo topo de prévia e a folha A4 dos impressos da Plataforma. Sai da configuração do momento,
// em linguagem simples, sem notas internas nem "de onde veio". Abre pelo Mais ações da ficha.

import { useParams } from "next/navigation";
import { mostrarDataSemHora, resumoConfiguracao } from "@triade/domain";
import type { AreasComuns, Configuracoes } from "@triade/configuracoes";
import { Carregando, ErroCarregar, FolhaA4, Logo, PreviaImpressao } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { Ficha } from "./tipos.ts";

function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function ResumoConfiguracao() {
  const { id } = useParams<{ id: string }>();
  const ficha = useCarregar<Ficha>(`/v1/clientes/${id}`);
  const config = useCarregar<Configuracoes>(`/v1/clientes/${id}/condominio/configuracoes`);
  const areas = useCarregar<AreasComuns>(`/v1/clientes/${id}/condominio/areas-comuns`);
  const erro = [ficha, config, areas].find((c) => c.estado === "erro");
  const pronto = ficha.estado === "pronto" && config.estado === "pronto" && areas.estado === "pronto";

  return (
    <PreviaImpressao titulo="Resumo para o síndico" apoio="Folha A4 em pé · entregue na apresentação" voltar={`/clientes/${id}?aba=configuracao`}
      podeImprimir={pronto} legenda={pronto ? "Como sai na impressão" : undefined}>
      {erro && erro.estado === "erro" ? <div className="w-full max-w-[794px]"><ErroCarregar erro={erro.erro} texto={erro.texto} tentarDeNovo={erro.recarregar} /></div> : null}
      {!erro && !pronto ? <div className="w-full max-w-[794px]"><Carregando rotulo="Montando o resumo…" /></div> : null}
      {pronto ? (
        <FolhaA4 rotulo="Resumo para o síndico" className="p-[1.6cm]">
          <header className="flex items-start justify-between gap-6 border-b-2 border-tinta pb-4">
            <span className="grid gap-1">
              <span className="text-[13px] font-semibold tracking-[.14em] uppercase">{ficha.dados.condominio.nome}</span>
              <span className="text-[13px] text-tinta-suave">Configuração em {mostrarDataSemHora(hojeEmBrasilia())}</span>
            </span>
            <Logo className="h-7 w-auto" />
          </header>
          <h2 className="mt-7 text-[30px] leading-tight font-medium">Como o condomínio vai funcionar na TRÍADE Condo</h2>
          <dl className="mt-6 grid gap-5">
            {resumoConfiguracao({ nome: ficha.dados.condominio.nome, ...config.dados, areas: areas.dados.areas }).map((s) => (
              <div key={s.titulo} className="grid gap-1.5">
                <dt className="text-[17px] font-semibold">{s.titulo}</dt>
                <dd className="text-[15px] leading-relaxed">{s.texto}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-auto border-t border-linha pt-4 text-[13px] text-tinta-suave">Preparado pela equipe TRÍADE · entregue na apresentação ao síndico e ao conselho</p>
        </FolhaA4>
      ) : null}
    </PreviaImpressao>
  );
}
