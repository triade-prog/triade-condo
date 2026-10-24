"use client";
// Decisões (F7.4; AT-23, CF-03, TR-01; DC15, telas-modelo decisoes-computador e decisoes-celular):
// o que espera a resposta de quem pode aprovar (o síndico, ou quem ele autorizou), as respondidas
// e todas. A que espera mostra as alternativas e o "Decidir"; a respondida vira uma linha curta.
// Quem pede decisões sem poder aprovar vê as que pediu. Nada aqui contrata ou paga sozinho.
// R5 (V-14, FC-10; quadros 414, 415 e 418): as abas Dos pedidos e Despesas; a decisão pedida ao
// conselho mostra o quórum, os votos e o Reenviar o link; a que empatou volta ao síndico com os
// votos; a ausência do síndico aparece no alto. Em dúvida sobre a lei, a frase fixa do advogado.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FILTROS_DECISAO, lider, resumoAlternativas, textoAndamentoVotacao, type FiltroDecisao } from "@triade/domain";
import { Abas, Aviso, Botao, Carregando, classeBotao, ErroCarregar, Icone, Selo, textoDoErro, Vazio } from "@triade/ui";
import { useCarregar, useContagens, usePlataforma } from "../sessao.tsx";
import type { AusenciaSindico, DecisaoPedido, FinalidadeLink, LinkMandado, ListaDecisoes, Recado, Votacao } from "../tipos.ts";
import { dia } from "../pedidos/comum.tsx";
import { diaDoPrazo, ListaAlternativas, ResponderDecisao, resumoResposta, RetirarDecisao, SeloDecisao } from "./comum.tsx";
import { AbaDespesas } from "./Despesas.tsx";
import { AlternativasComVotos, BarraQuorum, FraseAdvogado, LinksDoItem, LinksMandados, ListaVotos, Placar, recadoDoReenvio, reenviarLink, VotarNoPainel } from "./votacao.tsx";
import { ListaAnexos } from "./anexos.tsx";

/** "Respondidas" diz melhor o que entra: as aprovadas, as devolvidas e as retiradas. */
const NOME_FILTRO: Record<FiltroDecisao, string> = { AGUARDANDO: "Aguardando", DECIDIDAS: "Respondidas", TODAS: "Todas" };
const AVISO = "Aprovar não contrata nem paga nada sozinho: a resposta fica no histórico do pedido.";
const TOM_RESPONDIDA = { APROVADA: { icone: "check", tom: "ok" }, DEVOLVIDA: { icone: "esq", tom: "atencao" }, RETIRADA: { icone: "fechar", tom: "neutro" } } as const;
const AVISA = { SUBSINDICO: "o subsíndico", CONSELHO: "o conselho" } as const;

/** De onde veio a decisão que voltou ao síndico: "Empate: 2 a 2 no conselho." */
export function textoDaOrigem(v: Votacao): string {
  const n = Object.values(v.contagem ?? {}).sort((a, b) => b - a);
  if (n.length >= 2 && n[0] === n[1]) return `Empate: ${n[0]} a ${n[1]} no conselho.`;
  return `O conselho não chegou a ${v.necessarios === 1 ? "1 voto" : `${v.necessarios} votos`} iguais no prazo.`;
}

const linhaDoPedido = (x: DecisaoPedido) => (x.pedido ? <>Pedido <span className="t-codigo">{x.pedido.protocolo}</span> · {x.pedido.assunto} · </> : null);

/** A decisão que espera: a pergunta, o porquê, as alternativas e o "Decidir". */
function CartaoAguardando({ x, hoje, principal, decidir, avisa, abrirRetirar, reenviar }: {
  x: DecisaoPedido; hoje: string; principal: boolean; decidir: () => void; avisa?: string; abrirRetirar: () => void;
  reenviar: (membroId: string, finalidade: FinalidadeLink) => void;
}) {
  return (
    <li className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4">
      <div className="flex items-start gap-3">
        <span className="ladrilho" data-tom={x.origem ? "atencao" : "violeta"} aria-hidden="true"><Icone nome={x.origem ? "esq" : "decisao"} /></span>
        <div className="grid min-w-0 gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <h2 className="t-texto font-medium">{x.pergunta}</h2>
            {x.origem ? <Selo tom="atencao">Devolvida ao síndico</Selo> : null}
            <SeloDecisao d={x} hoje={hoje} />
          </span>
          <p className="t-apoio">
            {linhaDoPedido(x)}pedida{x.pedidaPor ? ` por ${x.pedidaPor}` : ""} em {dia(x.pedidaEm)}
            {x.decisor && !x.decisor.eu ? ` · quem decide: ${x.decisor.nome}` : ""}
          </p>
        </div>
      </div>
      {x.origem ? <p className="t-texto">{textoDaOrigem(x.origem.conselho)} {x.decisor?.eu ? "Agora é sua." : `Agora é de ${x.decisor?.nome ?? "quem decide"}.`}</p> : null}
      {x.substituto ? <p className="t-apoio">Síndico ausente até {diaDoPrazo(x.substituto.ate)}: {x.substituto.nome}, o subsíndico, responde no lugar.</p> : null}
      {x.vencida && avisa ? <p className="t-apoio text-erro">Vencida sem resposta. Pela regra, {avisa} também foi avisado.</p> : null}
      {x.porque ? <p className="t-texto">{x.porque}</p> : null}
      <p className="t-rotulo">{resumoAlternativas(x.alternativas).replace(", ", " · ")}</p>
      <ListaAlternativas alternativas={x.alternativas} />
      {x.origem ? (
        <details className="t-texto">
          <summary className="cursor-pointer font-medium text-violeta-600">Ver os votos do conselho</summary>
          <div className="pt-2"><ListaVotos v={x.origem.conselho} /></div>
        </details>
      ) : null}
      {x.anexos?.length ? <ListaAnexos anexos={x.anexos} /> : null}
      {x.links?.length ? <LinksDoItem links={x.links} reenviar={(l) => reenviar(l.membroId, l.finalidade)} /> : null}
      <span className="flex flex-wrap items-center gap-2 pt-1 max-md:flex-col max-md:items-stretch">
        {x.pode.responder ? (
          <Botao variante={principal ? "primario" : "secundario"} aria-label={`Decidir: ${x.pergunta}`} onClick={decidir}><Icone nome="check" />Decidir</Botao>
        ) : null}
        {x.pode.retirar && x.origem ? <Botao variante="discreto" onClick={abrirRetirar}><Icone nome="fechar" />Retirar o pedido</Botao> : null}
        {x.pedido ? (
          <Link href={`/pedidos/pedido?id=${x.pedido.id}`} className={classeBotao("discreto", "max-md:justify-center")} aria-label={`Abrir o pedido ${x.pedido.protocolo}`}>
            <Icone nome="seta" />Abrir o pedido
          </Link>
        ) : null}
      </span>
    </li>
  );
}

/** A decisão em votação no conselho (quadros 414 e 415). */
function CartaoVotacao({ x, empate, sindico, votar, reenviar, retirar }: {
  x: DecisaoPedido & { conselho: Votacao }; empate: "SINDICO" | "DEVOLVIDA"; sindico: string | null;
  votar: () => void; reenviar: (membroId: string) => void; retirar: () => void;
}) {
  const v = x.conselho;
  const gestao = v.faltam !== undefined;
  const l = lider(v.contagem);
  const semLink = v.votos.filter((y) => !y.escolha && y.emDia !== false && y.link && y.link.podeReenviar !== false);
  return (
    <li className="grid gap-4 rounded-[18px] border border-linha bg-superficie p-6 shadow-s1 max-md:p-4">
      <div className="flex items-start gap-3">
        <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="pessoas" /></span>
        <div className="grid min-w-0 flex-1 gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <h2 className="t-titulo-cartao">{x.pergunta}</h2>
            <Selo tom="andamento">Em votação</Selo>
            <Selo tom={x.vencida ? "erro" : "neutro"}>Votar até {diaDoPrazo(x.prazo)}</Selo>
          </span>
          <p className="t-apoio">{linhaDoPedido(x)}pedida{x.pedidaPor ? ` por ${x.pedidaPor}` : ""} em {dia(x.pedidaEm)}</p>
        </div>
      </div>
      {x.porque ? <p className="t-texto">{x.porque}</p> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="grid content-start gap-2">
          <h3 className="t-rotulo">Alternativas</h3>
          <AlternativasComVotos alternativas={x.alternativas} contagem={v.contagem} />
        </section>
        <section className="grid content-start gap-2.5">
          <h3 className="t-rotulo">Quórum</h3>
          {gestao || v.contagem ? <Placar contagem={v.contagem} necessarios={v.necessarios} /> : <p className="t-texto"><strong className="font-semibold">{v.necessarios === 1 ? "1 voto" : `${v.necessarios} votos`}</strong> iguais decidem</p>}
          <BarraQuorum votos={l?.votos ?? 0} titulares={v.titulares} necessarios={v.necessarios} />
          <p className="t-apoio">
            {gestao ? textoAndamentoVotacao(v, x.prazo, empate, sindico) : `${v.votaram} de ${v.titulares} titulares votaram. Os outros votos aparecem quando a decisão fechar.`}
          </p>
        </section>
      </div>
      {v.votos.length ? <ListaVotos v={v} /> : null}
      {v.eu?.escolha ? <p className="t-apoio">Seu voto fica com seu nome e a hora, e pode ser trocado até {diaDoPrazo(x.prazo)}.</p> : null}
      {x.anexos?.length ? <ListaAnexos anexos={x.anexos} /> : null}
      <span className="flex flex-wrap items-center gap-2 max-md:flex-col max-md:items-stretch">
        {x.pode.votar ? <Botao onClick={votar} aria-label={`${v.eu?.escolha ? "Trocar meu voto" : "Votar"}: ${x.pergunta}`}><Icone nome="check" />{v.eu?.escolha ? "Trocar meu voto" : "Votar"}</Botao> : null}
        {x.pode.reenviar ? semLink.map((y) => (
          <Botao key={y.membroId} variante="secundario" onClick={() => reenviar(y.membroId)}><Icone nome="enviar" />Reenviar o link para {y.nome.split(" ")[0]}</Botao>
        )) : null}
        {x.pode.retirar ? <Botao variante="discreto" onClick={retirar}><Icone nome="fechar" />Retirar o pedido</Botao> : null}
        {x.pedido ? (
          <Link href={`/pedidos/pedido?id=${x.pedido.id}`} className={classeBotao("discreto", "max-md:justify-center")} aria-label={`Abrir o pedido ${x.pedido.protocolo}`}>
            <Icone nome="seta" />Abrir o pedido
          </Link>
        ) : null}
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
      <span className="ladrilho" data-tom={visual.tom} aria-hidden="true"><Icone nome={x.modo === "CONSELHO" ? "pessoas" : visual.icone} /></span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <Titulo className="font-medium">{x.pergunta}</Titulo>
        <p className="t-apoio">{resumoResposta(x) ?? "Respondida"}{x.pedido ? ` · pedido ${x.pedido.protocolo}` : ""}</p>
      </div>
      <SeloDecisao d={x} hoje={hoje} />
      {x.pedido ? (
        <Link href={`/pedidos/pedido?id=${x.pedido.id}`} className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline" aria-label={`Abrir o pedido ${x.pedido.protocolo}`}>
          Abrir o pedido<Icone nome="dir" className="h-4 w-4" />
        </Link>
      ) : null}
    </li>
  );
}

/** A ausência do síndico, no alto (quadro 422, Síndica ausente). */
export function FaixaAusencia({ a, gerenciar }: { a: AusenciaSindico; gerenciar: boolean }) {
  return (
    <Aviso tom="info" titulo={a.ativa ? `${a.sindico ?? "O síndico"} está ausente de ${diaDoPrazo(a.de)} a ${diaDoPrazo(a.ate)}` : `Ausência marcada de ${diaDoPrazo(a.de)} a ${diaDoPrazo(a.ate)}`}>
      {a.ativa ? `Decisões e despesas pedidas ao síndico estão indo para ${a.substituto}, o subsíndico.`
        : `A partir de ${diaDoPrazo(a.de)}, decisões e despesas pedidas ao síndico vão para ${a.substituto}, o subsíndico.`}
      {gerenciar ? <> <Link href="/pessoas?aba=conselho" className="font-medium text-violeta-600 hover:underline">Encerrar a ausência</Link></> : null}
    </Aviso>
  );
}

type Aba = "pedidos" | "despesas";

export function Decisoes() {
  const { pode, painel } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const aba: Aba = busca.get("aba") === "despesas" ? "despesas" : "pedidos";
  const aprova = pode("decisoes.aprovar");
  const vota = (painel.decisoes?.votos ?? 0) > 0 || (painel.decisoes?.despesas ?? 0) > 0 || (painel.decisoes?.votando ?? 0) > 0;
  const [despesasNaApi, setDespesasNaApi] = useState(false);
  const veDespesas = pode("despesas.ver") || pode("despesas.registrar") || despesasNaApi || (painel.decisoes?.despesas ?? 0) > 0;
  const podeVer = aprova || pode("pedidos.atualizar") || veDespesas || vota;
  const [recado, setRecado] = useState<Recado>(null);
  const [n, setN] = useState<{ pedidos?: number; despesas?: number }>({});
  const contarPedidos = useCallback((x: number, despesas: boolean) => { setN((y) => (y.pedidos === x ? y : { ...y, pedidos: x })); if (despesas) setDespesasNaApi(true); }, []);
  const contarDespesas = useCallback((x: number) => setN((y) => (y.despesas === x ? y : { ...y, despesas: x })), []);

  const cabecalho = (
    <div>
      <h1 className="t-titulo-tela">Decisões</h1>
      <p className="t-apoio mt-1 max-md:hidden">
        {aba === "despesas" ? "Despesas para aprovar: a conta, a fatura ou o orçamento que precisa do sim do síndico ou do conselho. O sistema não paga nada."
          : aprova || vota ? `O que pediram para decidir, a você ou ao conselho. ${AVISO.replace(" sozinho", "")}` : "As decisões que você pediu ao síndico ou ao conselho, pelo pedido."}
      </p>
    </div>
  );
  if (!podeVer) return <div className="grid gap-4">{cabecalho}<Vazio titulo="Sem acesso">As decisões aparecem para quem pode aprovar ou atualizar os pedidos.</Vazio></div>;

  const comAbas = veDespesas || aba === "despesas";
  const corpo = aba === "despesas" && comAbas
    ? <AbaDespesas recado={setRecado} contar={contarDespesas} />
    : <DosPedidos recado={setRecado} contar={contarPedidos} />;
  const mudar = (id: Aba) => { setRecado(null); router.replace(id === "pedidos" ? "/decisoes" : "/decisoes?aba=despesas", { scroll: false }); };
  return (
    <div className="grid max-w-[1040px] gap-4">
      {cabecalho}
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {comAbas ? (
        <Abas abas={[{ id: "pedidos", texto: "Dos pedidos", contagem: n.pedidos }, { id: "despesas", texto: "Despesas", contagem: n.despesas }]}
          atual={aba} rotulo="Partes de Decisões" aoMudar={mudar}>
          <div className="grid gap-4 pt-4">{corpo}</div>
        </Abas>
      ) : <div className="grid gap-4">{corpo}</div>}
      <FraseAdvogado />
    </div>
  );
}

function DosPedidos({ recado, contar }: { recado: (r: Recado) => void; contar: (n: number, despesas: boolean) => void }) {
  const { pode, painel, atualizar } = usePlataforma();
  const busca = useSearchParams();
  const router = useRouter();
  const aprova = pode("decisoes.aprovar");
  const vota = (painel.decisoes?.votos ?? 0) > 0 || (painel.decisoes?.votando ?? 0) > 0;
  const filtro = (Object.keys(FILTROS_DECISAO) as FiltroDecisao[]).find((f) => f === busca.get("filtro")) ?? (aprova || vota ? "AGUARDANDO" : "TODAS");
  const carga = useCarregar<ListaDecisoes>(`/v1/condominio/decisoes?filtro=${filtro}`);
  const [responder, setResponder] = useState<DecisaoPedido | null>(null);
  const [retirar, setRetirar] = useState<DecisaoPedido | null>(null);
  const [votar, setVotar] = useState<DecisaoPedido | null>(null);
  const [links, setLinks] = useState<LinkMandado[] | null>(null);
  const contagens = useContagens("decisoes", "");
  const respondidas = useCarregar<ListaDecisoes>(aprova && filtro === "AGUARDANDO" ? "/v1/condominio/decisoes?filtro=DECIDIDAS" : null);

  const pronto = carga.estado === "pronto" ? carga.dados : null;
  const aguardandoEu = pronto ? pronto.aguardandoEu : Math.max(0, (painel.decisoes?.aguardando ?? 0) - (painel.decisoes?.despesas ?? 0));
  useEffect(() => { if (pronto) contar(pronto.aguardandoEu, !!pronto.pode.despesas); }, [pronto, contar]);
  const mostraAguardando = aprova || vota || aguardandoEu > 0 || filtro === "AGUARDANDO";
  const filtros = (
    <div role="group" aria-label="Quais decisões" className="flex gap-1 overflow-x-auto border-b border-linha">
      {(Object.keys(FILTROS_DECISAO) as FiltroDecisao[]).filter((f) => mostraAguardando || f !== "AGUARDANDO").map((f) => {
        const atual = f === filtro;
        const n = f === "AGUARDANDO" ? aguardandoEu : contagens.n[f] ?? 0;
        return (
          <button key={f} type="button" aria-pressed={atual} onClick={() => router.replace(`/decisoes?filtro=${f}`, { scroll: false })}
            className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 t-texto font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
            {NOME_FILTRO[f]}
            {n ? <span className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{n}</span> : null}
          </button>
        );
      })}
    </div>
  );

  if (carga.estado === "carregando") return <>{filtros}<Carregando rotulo="Carregando as decisões…" /></>;
  if (carga.estado === "erro") return <>{filtros}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></>;

  const dados = carga.dados;
  const lista = dados.decisoes;
  const hoje = dados.hoje;
  const regra = dados.conselho;
  const avisa = regra && regra.vencidaAvisa !== "NINGUEM" ? AVISA[regra.vencidaAvisa] : undefined;
  const primeira = lista.find((x) => x.estado === "AGUARDANDO" && x.pode.responder)?.id;
  const recentes = filtro === "AGUARDANDO" && respondidas.estado === "pronto"
    ? [...respondidas.dados.decisoes].sort((a, b) => (b.respondidaEm ?? "").localeCompare(a.respondidaEm ?? "")).slice(0, 3) : [];
  const depois = (t: string) => { recado({ tom: "ok", texto: t }); carga.recarregar(); respondidas.recarregar(); contagens.recarregar(); atualizar(); };
  const sindico = dados.ausencia?.sindico ?? (painel.funcoes.includes("SINDICO") ? painel.pessoa.nome : null);

  async function reenviar(x: DecisaoPedido, membroId: string, finalidade: FinalidadeLink = "VOTO") {
    const r = await reenviarLink("decisoes", x.id, membroId, finalidade);
    if (!r.ok) return recado({ tom: "atencao", texto: `Não deu para reenviar o link: ${textoDoErro(r.erro)}` });
    if (r.dados.envio === "COPIAR") setLinks([r.dados]);
    depois(recadoDoReenvio(r.dados));
  }

  return (
    <>
      {dados.ausencia ? <FaixaAusencia a={dados.ausencia} gerenciar={pode("conselho.editar")} /> : null}
      {filtros}
      {lista.length === 0 ? (
        <Vazio titulo={filtro === "AGUARDANDO" ? "Nenhuma decisão esperando você" : "Nenhuma decisão aqui"} icone="decisao">
          {filtro === "AGUARDANDO" ? "Quando alguém pedir uma decisão pelo pedido, ela aparece aqui e no sino." : "As decisões pedidas pelos pedidos aparecem aqui."}
        </Vazio>
      ) : (
        <ul className="grid gap-3">
          {lista.map((x) => x.estado === "AGUARDANDO" && x.modo === "CONSELHO" && x.conselho
            ? <CartaoVotacao key={x.id} x={x as DecisaoPedido & { conselho: Votacao }} empate={regra?.empate ?? "SINDICO"} sindico={sindico}
              votar={() => setVotar(x)} reenviar={(m) => void reenviar(x, m)} retirar={() => setRetirar(x)} />
            : x.estado === "AGUARDANDO"
              ? <CartaoAguardando key={x.id} x={x} hoje={hoje} principal={x.id === primeira} decidir={() => setResponder(x)} avisa={avisa} abrirRetirar={() => setRetirar(x)}
                reenviar={(m, f) => void reenviar(x, m, f)} />
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
        salvo={(t) => { setResponder(null); depois(t); }} />
      <RetirarDecisao d={retirar} aoFechar={() => setRetirar(null)} recarregar={carga.recarregar} salvo={(t) => { setRetirar(null); depois(t); }} />
      <VotarNoPainel alvo={votar ? { tipo: "decisoes", id: votar.id, titulo: votar.pergunta, alternativas: votar.alternativas, prazo: votar.prazo,
        meu: votar.conselho?.eu?.escolha ?? undefined, minhaJustificativa: votar.conselho?.eu?.justificativa ?? undefined } : null}
        aoFechar={() => setVotar(null)} votado={(t) => { setVotar(null); depois(t); }} />
      <LinksMandados links={links} aoFechar={() => setLinks(null)} />
    </>
  );
}
