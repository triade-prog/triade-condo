"use client";
// A agenda dentro do pedido (design "Telas da Agenda", tela 5; AG-08, MP-04): a visita marcada
// aparece no pedido, mas os dois compromissos do pedido continuam separados. Se a visita cai
// depois da previsão de solução, um aviso; nada muda sozinho. "Marcar visita" abre o novo
// compromisso já com a unidade, o pedido e o responsável.

import Link from "next/link";
import { useState } from "react";
import { mostrarDataCurta, mostrarHorario, SITUACOES_COMPROMISSO, TIPOS_COMPROMISSO } from "@triade/domain";
import { Aviso, Botao, classeBotao } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { AgendaDoPedido, OpcoesAgenda, PedidoDetalhe } from "../tipos.ts";
import { FormCompromisso } from "./FormCompromisso.tsx";

export function NaAgenda({ pedido, ativo, avisar }: { pedido: PedidoDetalhe["pedido"]; ativo: boolean; avisar: (texto: string) => void }) {
  const carga = useCarregar<AgendaDoPedido>(`/v1/condominio/pedidos/${pedido.id}/agenda`);
  const podeMarcar = carga.estado === "pronto" && carga.dados.podeMarcar && ativo;
  const opcoes = useCarregar<OpcoesAgenda>(podeMarcar ? "/v1/condominio/agenda/opcoes" : null);
  const [marcar, setMarcar] = useState(false);

  if (carga.estado !== "pronto" || !carga.dados.podeVer) return null;
  const { compromissos, divergencia } = carga.dados;
  if (compromissos.length === 0 && !podeMarcar) return null;

  return (
    <section aria-labelledby="t-na-agenda" className="grid content-start gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <h2 id="t-na-agenda" className="t-rotulo font-medium tracking-[.1em] text-tinta-suave uppercase">Na agenda</h2>
      {compromissos.length ? (
        <ul className="grid gap-1.5">
          {compromissos.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 t-texto">
              <span>
                <span className="tp" data-tipo={c.tipo}>{TIPOS_COMPROMISSO[c.tipo]}</span>{" "}
                <span className="font-medium">{mostrarDataCurta(c.data).slice(0, 5)}, {mostrarHorario(c)}</span>
                <span className="block text-tinta-suave">{c.titulo} · {SITUACOES_COMPROMISSO[c.estado].toLowerCase()}</span>
              </span>
              <Link href={`/agenda/compromisso?id=${c.id}`} className={classeBotao("discreto", "", "m")}>Abrir na agenda</Link>
            </li>
          ))}
        </ul>
      ) : <p className="t-apoio text-tinta-suave">Nenhuma visita marcada.</p>}
      {divergencia ? (
        <Aviso tom="atencao" titulo="Datas diferentes" papel="status">
          A previsão de solução é {mostrarDataCurta(divergencia.previsao).slice(0, 5)}, mas a visita está marcada para {mostrarDataCurta(divergencia.data).slice(0, 5)}.
          Nada muda sozinho: ajuste a previsão ou a visita, se for o caso.
        </Aviso>
      ) : null}
      {podeMarcar ? (
        <div className="grid justify-items-start gap-1">
          <Botao variante="contorno" tamanho="m" disabled={opcoes.estado !== "pronto"} onClick={() => setMarcar(true)}>Marcar visita</Botao>
          <span className="t-apoio text-tinta-suave">Marcar a visita não muda o próximo retorno nem a previsão.</span>
        </div>
      ) : null}
      {opcoes.estado === "pronto" ? (
        <FormCompromisso aberto={marcar} opcoes={opcoes.dados} aoFechar={() => setMarcar(false)}
          inicio={{ tipo: "VISITA", titulo: pedido.assunto, unidadeId: pedido.unidade?.id ?? null, pedidoId: pedido.id,
            participantes: pedido.responsavel ? [pedido.responsavel.vinculoId] : [] }}
          salvo={(_, texto) => { setMarcar(false); avisar(texto); carga.recarregar(); }} />
      ) : null}
    </section>
  );
}
