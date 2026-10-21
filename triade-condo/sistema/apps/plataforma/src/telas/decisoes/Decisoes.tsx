"use client";
// Decisões (F7.4; design "Reincidência e decisões", tela 3; AT-23, CF-03, TR-01): o que espera a
// resposta de quem pode aprovar (o síndico, ou quem ele autorizou), as já decididas e todas. Quem
// pede decisões sem poder aprovar vê as que pediu. Nada aqui contrata ou paga sozinho.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FILTROS_DECISAO, resumoAlternativas, type FiltroDecisao } from "@triade/domain";
import { Aviso, Botao, Carregando, classeBotao, ErroCarregar, Vazio } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { DecisaoPedido, ListaDecisoes, Recado } from "../tipos.ts";
import { dia } from "../pedidos/comum.tsx";
import { ResponderDecisao, resumoResposta, SeloDecisao } from "./comum.tsx";

export function Decisoes() {
  const { pode, painel, atualizar } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const aprova = pode("decisoes.aprovar");
  const filtro = (Object.keys(FILTROS_DECISAO) as FiltroDecisao[]).find((f) => f === busca.get("filtro")) ?? (aprova ? "AGUARDANDO" : "TODAS");
  const podeVer = aprova || pode("pedidos.atualizar");
  const carga = useCarregar<ListaDecisoes>(podeVer ? `/v1/condominio/decisoes?filtro=${filtro}` : null);
  const [responder, setResponder] = useState<DecisaoPedido | null>(null);
  const [recado, setRecado] = useState<Recado>(null);

  const cabecalho = (
    <div>
      <h1 className="text-[28px] font-normal tracking-tight">Decisões</h1>
      <p className="mt-1 text-tinta-suave">
        {aprova ? "O que pediram para você decidir. Nada aqui contrata ou paga sozinho." : "As decisões que você pediu ao síndico, pelo pedido."}
      </p>
    </div>
  );
  if (!podeVer) return <div className="grid gap-4">{cabecalho}<Vazio titulo="Sem acesso">As decisões aparecem para quem pode aprovar ou atualizar os pedidos.</Vazio></div>;

  const aguardandoEu = carga.estado === "pronto" ? carga.dados.aguardandoEu : painel.decisoes?.aguardando ?? 0;
  const filtros = (
    <div role="group" aria-label="Quais decisões" className="trilho justify-self-start">
      {(Object.entries(FILTROS_DECISAO) as [FiltroDecisao, string][]).filter(([f]) => aprova || f !== "AGUARDANDO").map(([f, texto]) => (
        <button key={f} type="button" className="chip" aria-pressed={f === filtro} onClick={() => router.replace(`/decisoes?filtro=${f}`, { scroll: false })}>
          {f === "AGUARDANDO" && aguardandoEu ? `${texto} · ${aguardandoEu}` : texto}
        </button>
      ))}
    </div>
  );

  if (carga.estado === "carregando") return <div className="grid gap-4">{cabecalho}{filtros}<Carregando rotulo="Carregando as decisões…" /></div>;
  if (carga.estado === "erro") return <div className="grid gap-4">{cabecalho}{filtros}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;

  const lista = carga.dados.decisoes;
  const hoje = carga.dados.hoje;
  return (
    <div className="grid gap-4">
      {cabecalho}
      {filtros}
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {lista.length === 0 ? (
        <Vazio titulo={filtro === "AGUARDANDO" ? "Nenhuma decisão esperando você" : "Nenhuma decisão aqui"}>
          {filtro === "AGUARDANDO" ? "Quando alguém pedir uma decisão pelo pedido, ela aparece aqui e no sino." : "As decisões pedidas pelos pedidos aparecem aqui."}
        </Vazio>
      ) : (
        <ul className="grid gap-3">
          {lista.map((x) => (
            <li key={x.id} className="grid gap-1.5 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 text-base font-medium">{x.pergunta}</h2>
                <SeloDecisao d={x} hoje={hoje} />
              </div>
              <p className="text-xs text-tinta-suave">
                Pedido {x.pedido.protocolo} · {resumoAlternativas(x.alternativas)} · pedida{x.pedidaPor ? ` por ${x.pedidaPor}` : ""} em {dia(x.pedidaEm)}
                {x.estado === "AGUARDANDO" && !x.decisor.eu ? ` · quem decide: ${x.decisor.nome}` : ""}
              </p>
              {resumoResposta(x) ? <p className="text-sm">{resumoResposta(x)}</p> : null}
              <span className="flex flex-wrap gap-2 pt-1">
                {x.pode.responder ? <Botao variante="secundario" tamanho="m" aria-label={`Decidir: ${x.pergunta}`} onClick={() => setResponder(x)}>Decidir</Botao> : null}
                <Link href={`/pedidos/pedido?id=${x.pedido.id}`} className={classeBotao("discreto", "", "m")} aria-label={`Abrir o pedido ${x.pedido.protocolo}`}>Abrir o pedido</Link>
              </span>
            </li>
          ))}
        </ul>
      )}
      <ResponderDecisao d={responder} aoFechar={() => setResponder(null)} recarregar={carga.recarregar}
        salvo={(t) => { setResponder(null); setRecado({ tom: "ok", texto: t }); carga.recarregar(); atualizar(); }} />
    </div>
  );
}
