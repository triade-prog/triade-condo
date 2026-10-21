"use client";
// Decisões (F7.4; AT-23, CF-03, TR-01; DC15, telas-modelo decisoes-computador e decisoes-celular):
// o que espera a resposta de quem pode aprovar (o síndico, ou quem ele autorizou), as respondidas
// e todas. A que espera mostra as alternativas e o "Decidir"; a respondida vira uma linha curta.
// Quem pede decisões sem poder aprovar vê as que pediu. Nada aqui contrata ou paga sozinho.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FILTROS_DECISAO, resumoAlternativas, type FiltroDecisao } from "@triade/domain";
import { Aviso, Botao, Carregando, classeBotao, ErroCarregar, Icone, Vazio } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { DecisaoPedido, ListaDecisoes, Recado } from "../tipos.ts";
import { dia } from "../pedidos/comum.tsx";
import { ListaAlternativas, ResponderDecisao, resumoResposta, SeloDecisao } from "./comum.tsx";

/** "Respondidas" diz melhor o que entra: as aprovadas, as devolvidas e as retiradas. */
const NOME_FILTRO: Record<FiltroDecisao, string> = { AGUARDANDO: "Aguardando", DECIDIDAS: "Respondidas", TODAS: "Todas" };
const AVISO = "Aprovar não contrata nem paga nada sozinho: a resposta fica no histórico do pedido.";
const TOM_RESPONDIDA = { APROVADA: { icone: "check", tom: "ok" }, DEVOLVIDA: { icone: "esq", tom: "atencao" }, RETIRADA: { icone: "fechar", tom: "neutro" } } as const;

/** A decisão que espera: a pergunta, o porquê, as alternativas e o "Decidir". */
function CartaoAguardando({ x, hoje, principal, decidir }: { x: DecisaoPedido; hoje: string; principal: boolean; decidir: () => void }) {
  return (
    <li className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4">
      <div className="flex items-start gap-3">
        <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="decisao" /></span>
        <div className="grid min-w-0 gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-medium">{x.pergunta}</h2>
            <SeloDecisao d={x} hoje={hoje} />
          </span>
          <p className="t-apoio">
            Pedido <span className="t-codigo">{x.pedido.protocolo}</span> · {x.pedido.assunto} · pedida{x.pedidaPor ? ` por ${x.pedidaPor}` : ""} em {dia(x.pedidaEm)}
            {!x.decisor.eu ? ` · quem decide: ${x.decisor.nome}` : ""}
          </p>
        </div>
      </div>
      {x.porque ? <p className="text-sm">{x.porque}</p> : null}
      <p className="t-rotulo">{resumoAlternativas(x.alternativas).replace(", ", " · ")}</p>
      <ListaAlternativas alternativas={x.alternativas} />
      <span className="flex flex-wrap items-center gap-2 pt-1 max-md:flex-col max-md:items-stretch">
        {x.pode.responder ? (
          <Botao variante={principal ? "primario" : "secundario"} aria-label={`Decidir: ${x.pergunta}`} onClick={decidir}><Icone nome="check" />Decidir</Botao>
        ) : null}
        <Link href={`/pedidos/pedido?id=${x.pedido.id}`} className={classeBotao("discreto", "max-md:justify-center")} aria-label={`Abrir o pedido ${x.pedido.protocolo}`}>
          <Icone nome="seta" />Abrir o pedido
        </Link>
      </span>
    </li>
  );
}

/** A decisão respondida ou retirada, numa linha curta. */
function LinhaRespondida({ x, hoje, nivel }: { x: DecisaoPedido; hoje: string; nivel: "h2" | "h3" }) {
  const Titulo = nivel;
  const visual = TOM_RESPONDIDA[x.estado as keyof typeof TOM_RESPONDIDA] ?? TOM_RESPONDIDA.RETIRADA;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[18px] border border-linha bg-superficie px-5 py-4 shadow-s1 max-md:p-4">
      <span className="ladrilho" data-tom={visual.tom} aria-hidden="true"><Icone nome={visual.icone} /></span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <Titulo className="font-medium">{x.pergunta}</Titulo>
        <p className="t-apoio">{resumoResposta(x) ?? "Respondida"} · pedido {x.pedido.protocolo}</p>
      </div>
      <SeloDecisao d={x} hoje={hoje} />
      <Link href={`/pedidos/pedido?id=${x.pedido.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-violeta-600 hover:underline" aria-label={`Abrir o pedido ${x.pedido.protocolo}`}>
        Abrir o pedido<Icone nome="dir" className="h-4 w-4" />
      </Link>
    </li>
  );
}

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

  const respondidas = useCarregar<ListaDecisoes>(podeVer && aprova && filtro === "AGUARDANDO" ? "/v1/condominio/decisoes?filtro=DECIDIDAS" : null);

  const cabecalho = (
    <div>
      <h1 className="t-titulo-tela">Decisões</h1>
      <p className="t-apoio mt-1 max-md:hidden">
        {aprova ? `O que pediram para você decidir. ${AVISO.replace(" sozinho", "")}` : "As decisões que você pediu ao síndico, pelo pedido."}
      </p>
    </div>
  );
  if (!podeVer) return <div className="grid gap-4">{cabecalho}<Vazio titulo="Sem acesso">As decisões aparecem para quem pode aprovar ou atualizar os pedidos.</Vazio></div>;

  const aguardandoEu = carga.estado === "pronto" ? carga.dados.aguardandoEu : painel.decisoes?.aguardando ?? 0;
  const filtros = (
    <div role="group" aria-label="Quais decisões" className="flex gap-1 overflow-x-auto border-b border-linha">
      {(Object.keys(FILTROS_DECISAO) as FiltroDecisao[]).filter((f) => aprova || f !== "AGUARDANDO").map((f) => {
        const atual = f === filtro;
        const n = f === "AGUARDANDO" ? aguardandoEu : atual && carga.estado === "pronto" && f !== "TODAS" ? carga.dados.decisoes.length : 0;
        return (
          <button key={f} type="button" aria-pressed={atual} onClick={() => router.replace(`/decisoes?filtro=${f}`, { scroll: false })}
            className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
            {NOME_FILTRO[f]}
            {n ? <span className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{n}</span> : null}
          </button>
        );
      })}
    </div>
  );

  if (carga.estado === "carregando") return <div className="grid max-w-[1040px] gap-4">{cabecalho}{filtros}<Carregando rotulo="Carregando as decisões…" /></div>;
  if (carga.estado === "erro") return <div className="grid max-w-[1040px] gap-4">{cabecalho}{filtros}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;

  const lista = carga.dados.decisoes;
  const hoje = carga.dados.hoje;
  const primeira = lista.find((x) => x.estado === "AGUARDANDO" && x.pode.responder)?.id;
  const recentes = filtro === "AGUARDANDO" && respondidas.estado === "pronto"
    ? [...respondidas.dados.decisoes].sort((a, b) => (b.respondidaEm ?? "").localeCompare(a.respondidaEm ?? "")).slice(0, 3) : [];
  return (
    <div className="grid max-w-[1040px] gap-4">
      {cabecalho}
      {filtros}
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {lista.length === 0 ? (
        <Vazio titulo={filtro === "AGUARDANDO" ? "Nenhuma decisão esperando você" : "Nenhuma decisão aqui"} icone="decisao">
          {filtro === "AGUARDANDO" ? "Quando alguém pedir uma decisão pelo pedido, ela aparece aqui e no sino." : "As decisões pedidas pelos pedidos aparecem aqui."}
        </Vazio>
      ) : (
        <ul className="grid gap-3">
          {lista.map((x) => x.estado === "AGUARDANDO"
            ? <CartaoAguardando key={x.id} x={x} hoje={hoje} principal={x.id === primeira} decidir={() => setResponder(x)} />
            : <LinhaRespondida key={x.id} x={x} hoje={hoje} nivel="h2" />)}
        </ul>
      )}
      {recentes.length ? (
        <section aria-labelledby="t-recentes" className="grid gap-3 pt-2">
          <h2 id="t-recentes" className="t-rotulo flex items-center gap-3 after:h-px after:flex-1 after:bg-linha">Respondidas há pouco</h2>
          <ul className="grid gap-3">{recentes.map((x) => <LinhaRespondida key={x.id} x={x} hoje={hoje} nivel="h3" />)}</ul>
        </section>
      ) : null}
      {aprova ? <p className="t-apoio md:hidden">{AVISO}</p> : null}
      <ResponderDecisao d={responder} aoFechar={() => setResponder(null)} recarregar={carga.recarregar}
        salvo={(t) => { setResponder(null); setRecado({ tom: "ok", texto: t }); carga.recarregar(); respondidas.recarregar(); atualizar(); }} />
    </div>
  );
}
