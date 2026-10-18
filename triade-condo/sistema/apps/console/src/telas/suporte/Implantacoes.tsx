"use client";
// Implantações em andamento (PI-04, PI-05): os clientes atribuídos ainda em implantação, com
// quantas etapas faltam, a próxima e as pendências vencidas primeiro.

import Link from "next/link";
import type { SITUACOES_ETAPA_IMPLANTACAO } from "@triade/domain";
import { mostrarDataSemHora } from "@triade/domain";
import { Carregando, ErroCarregar, Selo, Vazio } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";

interface ItemImplantacao {
  condominioId: string;
  nome: string;
  iniciada: boolean;
  etapas: number;
  feitas: number;
  proxima?: { numero: number; titulo: string; situacao: keyof typeof SITUACOES_ETAPA_IMPLANTACAO; responsavel?: string };
  pendencias: number;
  vencidas: number;
  proximoRetorno?: string;
}

export function Implantacoes() {
  const carga = useCarregar<{ implantacoes: ItemImplantacao[] }>("/v1/implantacoes");
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[28px] font-normal tracking-tight">Implantações</h1>
        <p className="text-tinta-suave">Os clientes atribuídos a você que ainda estão em implantação.</p>
      </div>
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" && carga.dados.implantacoes.length === 0 ? (
        <Vazio titulo="Nenhuma implantação em andamento">Quando um cliente atribuído a você estiver em implantação, ele aparece aqui.</Vazio>
      ) : null}
      {carga.estado === "pronto" && carga.dados.implantacoes.length > 0 ? (
        <ul className="grid gap-2.5">
          {carga.dados.implantacoes.map((i) => (
            <li key={i.condominioId} className="grid gap-2 rounded-2xl border border-linha bg-superficie p-4 shadow-s1 sm:grid-cols-[1fr_auto] sm:items-center">
              <span className="min-w-0">
                <Link href={`/clientes/${i.condominioId}`} className="font-semibold text-tinta hover:underline">{i.nome}</Link>
                <span className="block text-sm text-tinta-suave">
                  {i.iniciada ? `${i.feitas} de ${i.etapas} etapas` : "Roteiro ainda não aberto"}
                  {i.proxima ? ` · próxima: ${i.proxima.numero} · ${i.proxima.titulo}${i.proxima.responsavel ? ` (${i.proxima.responsavel})` : ""}` : ""}
                </span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {i.vencidas > 0 ? <Selo tom="erro">{i.vencidas === 1 ? "1 pendência vencida" : `${i.vencidas} pendências vencidas`}</Selo> : null}
                {i.pendencias > i.vencidas ? <Selo tom="neutro">{i.pendencias - i.vencidas} em dia</Selo> : null}
                {i.proximoRetorno && i.vencidas === 0 ? <Selo tom="info">Retorno {mostrarDataSemHora(i.proximoRetorno)}</Selo> : null}
                {i.pendencias === 0 ? <Selo tom="ok">Sem pendência</Selo> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
