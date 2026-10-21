"use client";
// Resumo para o síndico (PI-04, PI-06, SH-01; tela 5 do desenho "Configuração na implantação"):
// para mostrar na apresentação (etapa 5), na tela ou impresso. Sai da configuração do momento, em
// linguagem simples, sem notas internas nem "de onde veio".

import Link from "next/link";
import { useParams } from "next/navigation";
import { mostrarDataSemHora, resumoConfiguracao } from "@triade/domain";
import type { AreasComuns, Configuracoes } from "@triade/configuracoes";
import { Botao, Carregando, ErroCarregar } from "@triade/ui";
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

  for (const c of [ficha, config, areas]) {
    if (c.estado === "erro") return <ErroCarregar erro={c.erro} texto={c.texto} tentarDeNovo={c.recarregar} />;
  }
  if (ficha.estado !== "pronto" || config.estado !== "pronto" || areas.estado !== "pronto") return <Carregando rotulo="Montando o resumo…" />;
  const nome = ficha.dados.condominio.nome;
  const secoes = resumoConfiguracao({ nome, ...config.dados, areas: areas.dados.areas });

  return (
    <article className="mx-auto grid max-w-3xl gap-5">
      <p className="text-sm print:hidden"><Link href={`/clientes/${id}?aba=configuracao`} className="text-violeta-600 hover:underline">Voltar à ficha</Link></p>
      <header>
        <p className="text-sm text-tinta-suave">{nome} · configuração em {mostrarDataSemHora(hojeEmBrasilia())}</p>
        <h1 className="text-[28px] font-normal tracking-tight">Como o condomínio vai funcionar na TRÍADE Condo</h1>
      </header>
      <dl className="grid gap-4 rounded-2xl border border-linha bg-superficie p-5">
        {secoes.map((s) => (
          <div key={s.titulo} className="grid gap-1">
            <dt className="font-medium">{s.titulo}</dt>
            <dd className="text-sm">{s.texto}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-end print:hidden"><Botao onClick={() => window.print()}>Imprimir</Botao></div>
    </article>
  );
}
