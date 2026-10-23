"use client";
// A manutenção dentro do pedido (design "Telas da Manutenção", tela 7; MP-04): a manutenção
// ligada aparece no pedido, e dá para abrir uma a partir dele. Quando ela termina, o pedido
// pede o retorno ao morador; nada muda sozinho no pedido. Pedido cancelado com manutenção aberta
// ganha o aviso de que ela continua (F6.7).

import Link from "next/link";
import { useState } from "react";
import { Aviso, Botao } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { ManutencoesDoPedido, OpcoesManutencao, PedidoDetalhe } from "../tipos.ts";
import { nomeExecutor, SeloManutencao } from "./comum.tsx";
import { FormManutencao } from "./FormManutencao.tsx";

export function NaManutencao({ pedido, ativo, avisar }: { pedido: PedidoDetalhe["pedido"]; ativo: boolean; avisar: (texto: string) => void }) {
  const carga = useCarregar<ManutencoesDoPedido>(`/v1/condominio/pedidos/${pedido.id}/manutencao`);
  const podeAbrir = carga.estado === "pronto" && carga.dados.podeAbrir && ativo;
  const opcoes = useCarregar<OpcoesManutencao>(podeAbrir ? "/v1/condominio/manutencao/opcoes" : null);
  const [abrir, setAbrir] = useState(false);

  if (carga.estado !== "pronto" || !carga.dados.podeVer) return null;
  const { manutencoes } = carga.dados;
  if (manutencoes.length === 0 && !podeAbrir) return null;
  const concluida = manutencoes.some((m) => m.estado === "CONCLUIDA");
  // Cancelar o pedido não cancela a manutenção (F6.7, decisão 11): o pedido avisa, quem decide cancela.
  const abertaNoCancelado = Boolean(pedido.cancelamento) && manutencoes.some((m) => m.estado !== "CONCLUIDA" && m.estado !== "CANCELADA");

  return (
    <section aria-labelledby="t-na-manutencao" className="grid content-start gap-2 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <h2 id="t-na-manutencao" className="t-rotulo font-medium tracking-[.1em] text-tinta-suave uppercase">Manutenção ligada</h2>
      {manutencoes.length ? (
        <ul className="grid gap-1.5">
          {manutencoes.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 t-texto">
              <span className="grid gap-0.5">
                <Link href={`/manutencao/manutencao?id=${m.id}`} className="font-medium hover:text-violeta-600 hover:underline">{m.titulo}</Link>
                <span className="t-apoio text-tinta-suave">{nomeExecutor(m.executor)}{m.previsao ? ` · previsão ${m.previsao.slice(8)}/${m.previsao.slice(5, 7)}` : ""}</span>
              </span>
              <SeloManutencao estado={m.estado} />
            </li>
          ))}
        </ul>
      ) : <p className="t-apoio text-tinta-suave">Nenhuma manutenção ligada.</p>}
      {abertaNoCancelado ? <Aviso tom="atencao" papel="status">O pedido foi cancelado, mas a manutenção ligada continua aberta. Se ela também não vai mais acontecer, cancele-a na manutenção.</Aviso> : null}
      {concluida && ativo ? <Aviso tom="info" papel="status">Manutenção concluída: dê o retorno ao morador. Nada muda sozinho no pedido.</Aviso> : null}
      {podeAbrir ? (
        <div className="grid justify-items-start gap-1">
          <Botao variante="contorno" tamanho="m" disabled={opcoes.estado !== "pronto"} onClick={() => setAbrir(true)}>+ Abrir manutenção a partir deste pedido</Botao>
          <span className="t-apoio text-tinta-suave">Concluir a manutenção não encerra o pedido.</span>
        </div>
      ) : null}
      {opcoes.estado === "pronto" ? (
        <FormManutencao aberto={abrir} opcoes={opcoes.dados} aoFechar={() => setAbrir(false)}
          inicio={{ titulo: pedido.assunto, local: pedido.local ?? pedido.unidade?.nome ?? "", pedidoId: pedido.id }}
          salvo={(_, texto) => { setAbrir(false); avisar(texto); carga.recarregar(); }} />
      ) : null}
    </section>
  );
}
