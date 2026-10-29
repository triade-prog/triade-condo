"use client";
// Orçamentos (R8, OC-01; quadros 470 e 471): pedir propostas, comparar o que cada uma inclui e
// decidir com o motivo escrito. As abas Em andamento, Decididos, Encerrados e Cancelados; a linha
// de cada orçamento diz de onde nasceu, quantas propostas chegaram e o que pede atenção. A TRÍADE
// não escolhe nem compra pelo condomínio.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FILTROS_ORCAMENTO, textoRecebidas, type FiltroOrcamento } from "@triade/domain";
import { Abas, Carregando, classeBotao, ErroCarregar, Icone, Selo, Vazio } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import { ddmm, ICONE_ORIGEM, NOTA_RODAPE, seloSituacao, totalCurto } from "./comum.tsx";
import type { ListaOrcamentos, OrcamentoDaLista } from "./tipos.ts";

const ABAS = (Object.keys(FILTROS_ORCAMENTO) as FiltroOrcamento[]).map((id) => ({ id, texto: FILTROS_ORCAMENTO[id] }));

/** A segunda linha do orçamento: "Serviço · 3 convidados" ou, decidido, quem foi escolhido. */
export function linhaDoOrcamento(o: OrcamentoDaLista): string {
  if (o.estado === "CANCELADO") return `Cancelado${o.concluidoEm ? ` em ${ddmm(o.concluidoEm)}` : ""}`;
  if (o.escolhida) return `Escolhida: ${o.escolhida.nome} · ${totalCurto(o.escolhida.total)}`;
  return `${o.tipo === "ITENS" ? "Lista de itens" : "Serviço"} · ${o.convidados === 1 ? "1 convidado" : `${o.convidados} convidados`}`;
}

/** A coluna Propostas: "3 de 3 chegaram · 1 recusou" ou, decidido, quando foi. */
function textoPropostas(o: OrcamentoDaLista): string {
  if (o.estado === "ENTREGUE") return `Concluído${o.concluidoEm ? ` em ${ddmm(o.concluidoEm)}` : ""}`;
  if (o.escolhida && o.decididoEm) return `Decidido em ${ddmm(o.decididoEm)}`;
  return [textoRecebidas(o.recebidas, o.convidados), o.recusas ? `${o.recusas} ${o.recusas === 1 ? "recusou" : "recusaram"}` : null].filter(Boolean).join(" · ");
}

export function Orcamentos() {
  const busca = useSearchParams();
  const router = useRouter();
  const filtro = (Object.keys(FILTROS_ORCAMENTO) as FiltroOrcamento[]).find((f) => f === busca.get("filtro")) ?? "EM_ANDAMENTO";
  const carga = useCarregar<ListaOrcamentos>(`/v1/condominio/orcamentos?filtro=${filtro}`);
  const dados = carga.estado === "pronto" ? carga.dados : null;
  const novo = dados?.pode.criar ? <Link href="/orcamentos/novo" className={classeBotao("primario", "max-md:w-full")}><Icone nome="mais" />Novo orçamento</Link> : null;

  return (
    <div className="grid max-w-[1200px] gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="t-titulo-tela">Orçamentos</h1>
          <p className="t-apoio max-w-[640px]">Pedir propostas, comparar o que cada uma inclui e decidir com o motivo escrito. A TRÍADE não escolhe nem compra pelo condomínio.</p>
        </div>
        {novo}
      </div>
      {dados ? (
        <ul aria-label="Resumo dos orçamentos" className="flex flex-wrap gap-2">
          {[["Pedindo propostas", dados.contagens.pedindo], ["Para comparar", dados.contagens.comparar], ["Para decidir", dados.contagens.decidir], ["Comprando ou em execução", dados.contagens.comprando]].map(([t, n]) => (
            <li key={String(t)} className="chip" data-escolhido={n ? "" : undefined}>{t} · {n}</li>
          ))}
        </ul>
      ) : null}
      <Abas abas={ABAS} atual={filtro} rotulo="Quais orçamentos" aoMudar={(f) => router.replace(`/orcamentos?filtro=${f}`, { scroll: false })}>
        <div className="grid gap-4 pt-4">
        {carga.estado === "carregando" ? <Carregando rotulo="Carregando os orçamentos…" />
          : carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />
            : carga.dados.orcamentos.length === 0 ? (
              <Vazio titulo={filtro === "EM_ANDAMENTO" ? "Nenhum orçamento ainda" : "Nenhum orçamento aqui"} icone="carrinho"
                acao={filtro === "EM_ANDAMENTO" && carga.dados.pode.criar ? (
                  <span className="flex flex-wrap justify-center gap-2">
                    {novo}
                    <Link href="/manutencao" className={classeBotao("contorno")}><Icone nome="ferramenta" />Pedir a partir de uma manutenção</Link>
                  </span>
                ) : undefined}>
                {filtro === "EM_ANDAMENTO"
                  ? "Peça propostas a mais de um fornecedor e compare o que cada uma inclui. O motivo da escolha fica guardado e pode ir para os moradores."
                  : "Quando um orçamento chegar a esta parte, ele aparece aqui."}
              </Vazio>
            ) : (
              <section aria-label="Orçamentos" className="overflow-hidden rounded-[18px] border border-linha bg-superficie shadow-s1">
                <div aria-hidden="true" className="grid grid-cols-[40px_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_18px] gap-4 bg-superficie-2 px-5 py-2.5 t-rotulo max-md:hidden">
                  <span /><span>Orçamento</span><span>Nasceu de</span><span>Propostas</span><span>Situação</span><span />
                </div>
                <ul>
                  {carga.dados.orcamentos.map((o) => {
                    const s = seloSituacao(o);
                    return (
                      <li key={o.id} className="border-t border-linha first:border-t-0 md:first:border-t">
                        <Link href={`/orcamentos/${o.id}`}
                          className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-fundo max-md:px-4 md:grid-cols-[40px_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_18px]">
                          <span className="ladrilho max-md:row-span-2" data-tom={s.tom === "atencao" ? "atencao" : "violeta"} aria-hidden="true"><Icone nome="carrinho" /></span>
                          <span className="grid min-w-0 gap-0.5">
                            <span className="t-texto font-medium">{o.titulo}</span>
                            <span className="t-apoio">{linhaDoOrcamento(o)}</span>
                          </span>
                          <span className="flex min-w-0 items-center gap-2 t-apoio max-md:col-start-2">
                            {o.origem ? <><Icone nome={ICONE_ORIGEM[o.origem.tipo] ?? "editar"} className="h-4 w-4 shrink-0 text-tinta-suave" /><span className="truncate">{o.origem.texto}</span></> : <><Icone nome="editar" className="h-4 w-4 shrink-0 text-tinta-suave" />Escrito à mão</>}
                          </span>
                          <span className="t-apoio text-tinta max-md:col-start-2">{textoPropostas(o)}</span>
                          <span className="grid gap-1 max-md:col-start-2">
                            <span className="flex flex-wrap gap-1.5">
                              <Selo tom={s.tom}>{s.texto}</Selo>
                              {o.vencidas && (o.estado === "PEDINDO" || o.estado === "COMPARANDO") ? <Selo tom="atencao">{o.vencidas === 1 ? "1 proposta vencida" : `${o.vencidas} propostas vencidas`}</Selo> : null}
                              {o.pedeAtencao.some((a) => a.includes("não confirma")) ? <Selo tom="atencao">Sem aceite</Selo> : null}
                            </span>
                            <span className="t-apoio">
                              {o.estado === "PEDINDO" || o.estado === "COMPARANDO" ? (o.prazoFechou ? `Prazo era ${ddmm(o.prazoPropostas)}` : `Até ${ddmm(o.prazoPropostas)}`)
                                : o.pedeAtencao[0] ?? ""}
                            </span>
                          </span>
                          <Icone nome="dir" className="h-4 w-4 text-tinta-suave max-md:hidden" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
        </div>
      </Abas>
      <p className="t-apoio">{NOTA_RODAPE}</p>
    </div>
  );
}
