"use client";
// Busca no condomínio (barra superior da Plataforma, design "Dois sistemas, uma família"):
// pedidos por protocolo, assunto, local ou unidade, e moradores por nome, unidade ou telefone.
// Cada parte só aparece para quem pode ver aquilo.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { mostrarTelefone, nomeDaUnidade } from "@triade/domain";
import { Carregando, ErroCarregar, Vazio } from "@triade/ui";
import { useCarregar, usePlataforma } from "./sessao.tsx";
import type { FilaPedidos, ListaMoradores } from "./tipos.ts";
import { nomeRelacao, SeloEstado } from "./moradores/comum.tsx";
import { SeloEstadoPedido } from "./pedidos/comum.tsx";

const MOSTRAR = 8;

export function Busca() {
  const q = (useSearchParams().get("q") ?? "").trim().slice(0, 60);
  const { pode } = usePlataforma();
  const valida = q.length >= 2;
  const enc = encodeURIComponent(q);
  const pedidos = useCarregar<FilaPedidos>(valida && pode("pedidos.ver") ? `/v1/condominio/pedidos?situacao=TODOS&busca=${enc}` : null);
  const moradores = useCarregar<ListaMoradores>(valida && pode("moradores.ver") ? `/v1/condominio/moradores?busca=${enc}` : null);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-[28px] font-normal tracking-tight">Buscar no condomínio</h1>
        {valida ? <p className="mt-1 text-tinta-suave">Resultados para “{q}”.</p> : null}
      </div>
      {!valida ? <Vazio titulo="Digite ao menos 2 letras ou números">Use a busca no topo: protocolo, assunto, unidade, nome ou telefone.</Vazio> : null}

      {valida && pode("pedidos.ver") ? (
        <section aria-labelledby="t-b-pedidos" className="grid gap-2">
          <h2 id="t-b-pedidos" className="text-lg font-medium">Pedidos</h2>
          {pedidos.estado === "carregando" ? <Carregando linhas={2} rotulo="Buscando pedidos…" /> : null}
          {pedidos.estado === "erro" ? <ErroCarregar texto={pedidos.texto} tentarDeNovo={pedidos.recarregar} /> : null}
          {pedidos.estado === "pronto" ? (
            pedidos.dados.itens.length === 0 ? <p className="text-sm text-tinta-suave">Nenhum pedido encontrado.</p> : (
              <>
                <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
                  {pedidos.dados.itens.slice(0, MOSTRAR).map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span>
                        <Link href={`/pedidos/pedido?id=${p.id}`} className="font-medium hover:text-violeta-600 hover:underline">
                          <span className="font-mono text-xs text-tinta-suave">{p.protocolo}</span> · {p.assunto}
                        </Link>
                        <span className="block text-xs text-tinta-suave">{[p.unidade ?? p.local, p.categoria].filter(Boolean).join(" · ")}</span>
                      </span>
                      <SeloEstadoPedido estado={p.estado} />
                    </li>
                  ))}
                </ul>
                {pedidos.dados.total > MOSTRAR ? (
                  <Link href={`/pedidos?situacao=TODOS&busca=${enc}`} className="text-sm font-medium text-violeta-700 hover:underline">Ver os {pedidos.dados.total} pedidos na fila</Link>
                ) : null}
              </>
            )
          ) : null}
        </section>
      ) : null}

      {valida && pode("moradores.ver") ? (
        <section aria-labelledby="t-b-moradores" className="grid gap-2">
          <h2 id="t-b-moradores" className="text-lg font-medium">Moradores</h2>
          {moradores.estado === "carregando" ? <Carregando linhas={2} rotulo="Buscando moradores…" /> : null}
          {moradores.estado === "erro" ? <ErroCarregar texto={moradores.texto} tentarDeNovo={moradores.recarregar} /> : null}
          {moradores.estado === "pronto" ? (
            moradores.dados.itens.length === 0 ? <p className="text-sm text-tinta-suave">Nenhum morador encontrado.</p> : (
              <>
                <ul className="divide-y divide-linha rounded-2xl border border-linha bg-superficie">
                  {moradores.dados.itens.slice(0, MOSTRAR).map((m) => (
                    <li key={m.vinculoId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span>
                        <Link href={`/moradores/unidade?id=${m.unidadeId}`} className="font-medium hover:text-violeta-600 hover:underline">{m.nome}</Link>
                        <span className="block text-xs text-tinta-suave">
                          {nomeDaUnidade(m.bloco, m.andar, m.unidade)} · {nomeRelacao(m.relacao)} · {mostrarTelefone(m.telefone)}
                        </span>
                      </span>
                      <SeloEstado estado={m.estado} />
                    </li>
                  ))}
                </ul>
                {moradores.dados.total > MOSTRAR ? (
                  <Link href={`/moradores?aba=moradores&busca=${enc}`} className="text-sm font-medium text-violeta-700 hover:underline">Ver os {moradores.dados.total} moradores</Link>
                ) : null}
              </>
            )
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
