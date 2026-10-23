"use client";
// Carteira de clientes (PI-01, V-10; DC15, telas-modelo console-carteira-*; rodada Console,
// decisão C.1 de 23/10/2026): só os condomínios atribuídos a quem está vendo (PI-10). A busca no
// alto da lista, os filtros em abas com o número, e a linha inteira abrindo a ficha. Em
// implantação mostra a barra de etapas e a próxima etapa, no lugar do antigo item Implantações do
// menu; o endereço /implantacoes leva a este filtro. As situações a tratar ficam em selos âmbar.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CENARIOS } from "@triade/domain";
import { Carregando, CampoTexto, classeBotao, ErroCarregar, Icone, Vazio } from "@triade/ui";
import { AbasLista, BarraEtapas, CabecaPagina, CaixaLista, CLASSE_LINHA, CLASSE_LINK_LINHA, plural } from "./comum.tsx";
import { SeloEstagio, SeloSituacao } from "./rotulos.tsx";
import { useCarregar, useSessao } from "./sessao.tsx";
import { atendeClientes, type ClienteCarteira, type ItemImplantacao } from "./tipos.ts";

const FILTROS = [
  { valor: "todos", texto: "Todos", aceita: () => true },
  { valor: "implantacao", texto: "Em implantação", aceita: (c: ClienteCarteira) => c.estagio === "IMPLANTACAO" },
  { valor: "ativos", texto: "Ativos", aceita: (c: ClienteCarteira) => c.estagio === "ATIVO" },
  { valor: "tratar", texto: "Com situações a tratar", aceita: (c: ClienteCarteira) => c.situacoes.length > 0 },
] as const;
type Filtro = (typeof FILTROS)[number]["valor"];

const COLUNAS = "md:grid-cols-[40px_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_20px]";

/** Sem acento e sem caixa, para a busca achar "Ipê" escrevendo "ipe". */
const simples = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function Implantacao({ c, i }: { c: ClienteCarteira; i?: ItemImplantacao }) {
  if (c.estagio !== "IMPLANTACAO") return <span className="t-apoio">Entregue ao cliente</span>;
  if (!i) return <span className="t-apoio">Em implantação</span>;
  return (
    <span className="grid gap-1.5">
      <span className="text-sm">Implantação · {i.feitas} de {i.etapas}</span>
      <BarraEtapas feitas={i.feitas} total={i.etapas} rotulo={`${i.feitas} de ${i.etapas} etapas feitas`} />
      <span className="t-apoio">{i.proxima ? `Próxima: ${i.proxima.titulo}` : "Falta a entrega"}{i.vencidas ? ` · ${plural(i.vencidas, "pendência vencida", "pendências vencidas")}` : ""}</span>
    </span>
  );
}

function Lista({ inicial, q: qInicial }: { inicial: Filtro; q: string }) {
  const sessao = useSessao();
  const carga = useCarregar<{ clientes: ClienteCarteira[] }>("/v1/clientes");
  const implantacoes = useCarregar<{ implantacoes: ItemImplantacao[] }>(atendeClientes(sessao.funcoes) ? "/v1/implantacoes" : null);
  const [filtro, setFiltro] = useState<Filtro>(inicial);
  const [q, setQ] = useState(qInicial);
  const podeCadastrar = sessao.acoes.includes("console.condominios.criar");
  const todos = carga.estado === "pronto" ? carga.dados.clientes : [];
  const achados = q.trim() ? todos.filter((c) => simples([c.nome, c.cidade, c.uf].filter(Boolean).join(" ")).includes(simples(q.trim()))) : todos;
  const visiveis = achados.filter(FILTROS.find((f) => f.valor === filtro)!.aceita);
  const deImplantacao = (id: string) => implantacoes.estado === "pronto" ? implantacoes.dados.implantacoes.find((i) => i.condominioId === id) : undefined;
  const cadastrar = podeCadastrar ? <Link href="/clientes/novo" className={classeBotao()}><Icone nome="mais" />Cadastrar condomínio</Link> : null;

  return (
    <div className="grid gap-5">
      <CabecaPagina titulo="Carteira de clientes" apoio="Os condomínios que você atende." acao={cadastrar ? <span className="max-md:hidden">{cadastrar}</span> : undefined} />
      {carga.estado === "carregando" ? <Carregando /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" && todos.length === 0 ? (
        <Vazio titulo="Nenhum cliente atribuído a você ainda" icone="predio" acao={cadastrar}>
          {podeCadastrar ? "Cadastre o primeiro condomínio. Ele aparece aqui, em implantação." : "Quando a administração atribuir um condomínio a você, ele aparece aqui."}
        </Vazio>
      ) : null}
      {carga.estado === "pronto" && todos.length > 0 ? (
        <CaixaLista titulo="Clientes da carteira" colunas={COLUNAS} cabecalho={visiveis.length ? ["", "Cliente", "Implantação", "Situações a tratar", ""] : undefined}
          abas={(
            <>
              <div role="search" className="pb-3 md:p-5 md:pb-2">
                <CampoTexto id="busca-carteira" rotulo="Buscar na carteira" className="[&_label]:sr-only" icone="busca" type="search" maxLength={60}
                  placeholder="Buscar na carteira pelo nome ou pela cidade" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <AbasLista rotulo="Filtrar a carteira" atual={filtro} aoMudar={setFiltro}
                abas={FILTROS.map((f) => ({ valor: f.valor, texto: f.texto, n: achados.filter(f.aceita).length }))} />
            </>
          )}
          rodape={visiveis.length ? (
            <>
              <span className="t-apoio">{plural(todos.length, "cliente atribuído a você", "clientes atribuídos a você")}</span>
              <span className="t-apoio">Cada pessoa vê só os clientes atribuídos a ela.</span>
            </>
          ) : undefined}>
          {visiveis.length === 0 ? (
            <div className="md:p-5">
              <Vazio titulo={q.trim() ? `Nenhum cliente com "${q.trim()}" aqui` : "Nenhum cliente neste filtro"} icone="busca">
                {q.trim() ? "Confira o nome ou a cidade, ou olhe em Todos." : undefined}
              </Vazio>
            </div>
          ) : (
            <ul className="grid max-md:gap-3 max-md:pt-3">
              {visiveis.map((c) => (
                <li key={c.id} className={`${CLASSE_LINHA} ${COLUNAS}`}>
                  <span className="ladrilho self-start md:self-center" data-tom="violeta" aria-hidden="true"><Icone nome="predio" /></span>
                  <span className="grid min-w-0 gap-1 justify-items-start">
                    <Link href={`/clientes/${c.id}`} className={CLASSE_LINK_LINHA}>{c.nome}</Link>
                    <span className="t-apoio">{[c.cidade, c.uf, c.cenario ? CENARIOS[c.cenario as keyof typeof CENARIOS] : "Sem cenário"].filter(Boolean).join(" · ")}</span>
                    <SeloEstagio estagio={c.estagio} />
                  </span>
                  <span className="min-w-0 max-md:col-span-2 max-md:col-start-2"><Implantacao c={c} i={deImplantacao(c.id)} /></span>
                  <span className="flex flex-wrap gap-1.5 max-md:col-span-2 max-md:col-start-2 md:grid md:justify-items-start">
                    {c.situacoes.length ? c.situacoes.map((s) => <SeloSituacao key={s} situacao={s} />) : <span className="t-apoio">Nada a tratar</span>}
                  </span>
                  <Icone nome="dir" className="h-5 w-5 text-tinta-suave max-md:col-start-3 max-md:row-start-1" />
                </li>
              ))}
            </ul>
          )}
        </CaixaLista>
      ) : null}
      {cadastrar ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{cadastrar}</div> : null}
    </div>
  );
}

export function Carteira() {
  const busca = useSearchParams();
  const f = busca.get("filtro");
  const inicial = FILTROS.find((x) => x.valor === f)?.valor ?? "todos";
  // A busca do alto da tela muda o endereço: a lista recomeça com o que foi escrito.
  return <Lista key={busca.toString()} inicial={inicial} q={busca.get("q") ?? ""} />;
}
