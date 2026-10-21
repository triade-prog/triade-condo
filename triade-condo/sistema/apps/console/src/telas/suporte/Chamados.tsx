"use client";
// Chamados (PI-20, PI-17): suporte técnico da plataforma, dos condomínios atribuídos a quem vê,
// com responsável e situação. Novos primeiro.

import Link from "next/link";
import { useState } from "react";
import { AREAS_CHAMADO, FILTROS_CHAMADO, formatarDataHora, SITUACOES_CHAMADO, TIPOS_CHAMADO } from "@triade/domain";
import { Carregando, ErroCarregar, Selo, Vazio, type Tom } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";

export interface ResumoChamado {
  id: string;
  condominioId: string;
  condominio?: string;
  numero: number;
  tipo: keyof typeof TIPOS_CHAMADO;
  area: keyof typeof AREAS_CHAMADO;
  titulo: string;
  situacao: keyof typeof SITUACOES_CHAMADO;
  abertoPor: string;
  responsavelId?: string;
  responsavel?: string;
  imagens: number;
  ultima?: { lado: "CLIENTE" | "TRIADE"; autor: string; em: string };
  atualizadoEm: string;
  versao: number;
}

export const TOM_CHAMADO: Record<string, Tom> = { NOVO: "atencao", ANDAMENTO: "andamento", ESPERANDO_CLIENTE: "info", RESOLVIDO: "ok" };

export function Chamados() {
  const [filtro, setFiltro] = useState<keyof typeof FILTROS_CHAMADO>("ABERTOS");
  const carga = useCarregar<{ chamados: ResumoChamado[] }>(`/v1/chamados?filtro=${filtro}`);
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[28px] font-normal tracking-tight">Chamados</h1>
        <p className="text-tinta-suave">Suporte técnico da plataforma, dos condomínios atribuídos a você.</p>
      </div>
      <div role="group" aria-label="Filtrar os chamados" className="trilho justify-self-start">
        {Object.entries(FILTROS_CHAMADO).map(([k, texto]) => (
          <button key={k} type="button" className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k as keyof typeof FILTROS_CHAMADO)}>{texto}</button>
        ))}
      </div>
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" && carga.dados.chamados.length === 0 ? <Vazio titulo="Nenhum chamado aqui">Quando um cliente abrir um chamado, ele aparece nesta fila.</Vazio> : null}
      {carga.estado === "pronto" && carga.dados.chamados.length > 0 ? (
        <ul className="grid gap-2.5">
          {carga.dados.chamados.map((c) => (
            <li key={c.id} className="grid gap-2 rounded-2xl border border-linha bg-superficie p-4 shadow-s1 sm:grid-cols-[1fr_auto] sm:items-center">
              <span className="min-w-0">
                <Link href={`/chamados/${c.condominioId}/${c.id}`} className="font-semibold text-tinta hover:underline">{c.titulo}</Link>
                <span className="block text-sm text-tinta-suave">
                  {[TIPOS_CHAMADO[c.tipo], AREAS_CHAMADO[c.area], c.imagens ? `${c.imagens} ${c.imagens === 1 ? "imagem" : "imagens"}` : null,
                    c.condominio, c.responsavel ?? "Sem responsável"].filter(Boolean).join(" · ")}
                </span>
                {c.ultima ? <span className="block text-xs text-tinta-suave">Última mensagem: {c.ultima.autor}, {formatarDataHora(c.ultima.em)}</span> : null}
              </span>
              <Selo tom={TOM_CHAMADO[c.situacao]}>{SITUACOES_CHAMADO[c.situacao]}</Selo>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
