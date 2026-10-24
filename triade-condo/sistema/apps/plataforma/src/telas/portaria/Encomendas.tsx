"use client";
// Portaria (PA-01, PA-07, V-04, W-21; telas-modelo encomendas-lista-*): o que chegou para as
// unidades, onde está guardado, quem guardou e quem retirou. Guardadas e Entregues em abas; "Pede
// atenção" em atalhos (as guardadas há mais de N dias, Aviso falhou e Sem aviso); a busca pela
// unidade. Entregar fica à vista em cada linha (exceção aprovada à regra de ação de linha); o
// resto vai no menu "Ações da encomenda de ...". No celular, cartões e o botão flutuando. Os
// filtros ficam no endereço.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ABAS_ENCOMENDAS, ATALHOS_ENCOMENDAS, AVISOS_ENCOMENDA, nomeAtalho, TOM_AVISO_ENCOMENDA, type AtalhoEncomendas } from "@triade/domain";
import { Aviso, Botao, Carregando, ErroCarregar, Icone, Selo, Vazio, type NomeIcone, type Tom } from "@triade/ui";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { Recado } from "../tipos.ts";
import {
  abrirEtiqueta, avisarDeNovo, JanelasEncomenda, MenuEncomenda, quando, quemGuardou, resumoEncomenda, SeloAviso,
  type AcaoEncomenda, type Encomenda, type OpcoesEncomenda,
} from "./comum.tsx";
import { RegistrarEncomenda } from "./Registrar.tsx";

interface ListaEncomendas {
  itens: Encomenda[];
  total: number;
  pagina: number;
  porPagina: number;
  contagens: Record<"GUARDADAS" | "ENTREGUES" | AtalhoEncomendas, number>;
  dias: number;
  soMinhas: boolean;
  pode: { cuidar: boolean };
}

type Filtros = { aba: "GUARDADAS" | "ENTREGUES"; atalho: AtalhoEncomendas | ""; busca: string; pagina: number };
const ICONE_ATALHO: Record<AtalhoEncomendas, NomeIcone> = { ANTIGAS: "relogio", AVISO_FALHOU: "alerta", SEM_AVISO: "info" };
const TOM_ATALHO: Record<AtalhoEncomendas, Tom> = { ANTIGAS: "atencao", AVISO_FALHOU: "erro", SEM_AVISO: "atencao" };

function consulta(f: Filtros): string {
  const q = new URLSearchParams();
  if (f.aba !== "GUARDADAS") q.set("aba", f.aba);
  if (f.atalho) q.set("atalho", f.atalho);
  if (f.busca) q.set("busca", f.busca);
  if (f.pagina > 1) q.set("pagina", String(f.pagina));
  return q.toString();
}

function Linha({ e, podeCuidar, abrir, avisar }: { e: Encomenda; podeCuidar: boolean; abrir: (a: AcaoEncomenda) => void; avisar: () => void }) {
  const guardada = e.estado === "GUARDADA";
  const entregar = guardada && podeCuidar ? (
    <Botao variante="contorno" tamanho="m" aria-label={`Entregar a encomenda de ${e.unidade.rotulo}`} onClick={() => abrir("entregar")}><Icone nome="check" />Entregar</Botao>
  ) : null;
  const unidade = (
    <span className="grid min-w-0">
      <Link href={`/portaria/unidade?id=${e.unidade.id}`} className="font-semibold hover:underline">{e.unidade.rotulo}</Link>
      <span className="t-apoio">{resumoEncomenda(e)}{e.observacao ? ` · ${e.observacao}` : ""}</span>
    </span>
  );
  const desde = (
    <span className="grid">
      <span>{e.guardadaPor.eu ? "Você" : e.guardadaPor.nome}</span>
      <span className="t-apoio flex items-center gap-1">
        {e.antiga ? <Icone nome="relogio" className="h-4 w-4 text-atencao" /> : null}
        {guardada && e.dias > 0 ? `há ${e.dias} ${e.dias === 1 ? "dia" : "dias"}` : quando(e.guardadaEm)}
      </span>
    </span>
  );
  const retirada = e.retirou ? (
    <span className="grid">
      <span>{e.retirou.nome}{e.retirou.ligacao ? ` · ${e.retirou.ligacao}` : ""}</span>
      <span className="t-apoio">entregue por {e.entreguePor?.eu ? "você" : e.entreguePor?.nome} · {e.entregueEm ? quando(e.entregueEm) : ""}</span>
    </span>
  ) : null;
  return (
    <li className="border-linha max-md:rounded-[18px] max-md:border max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:border-b md:last:border-b-0">
      {/* Computador: uma linha da tabela. */}
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.8fr)_auto] items-center gap-4 px-5 py-3.5 md:grid">
        {unidade}
        <span>{e.lugar?.nome}</span>
        {guardada ? desde : retirada}
        <SeloAviso e={e} />
        <span className="flex items-center justify-end gap-1">{entregar}<MenuEncomenda e={e} podeCuidar={podeCuidar} aoEscolher={abrir} aoAvisar={avisar} /></span>
      </div>
      {/* Celular: o cartão. */}
      <div className="grid gap-2 md:hidden">
        <div className="flex items-start justify-between gap-2">
          {unidade}
          <MenuEncomenda e={e} podeCuidar={podeCuidar} aoEscolher={abrir} aoAvisar={avisar} />
        </div>
        <span className="t-apoio">{e.lugar?.nome} · {guardada ? quemGuardou(e) : `retirou ${e.retirou?.nome ?? ""}`}</span>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <SeloAviso e={e} />
          {entregar}
        </div>
      </div>
    </li>
  );
}

export function Encomendas() {
  const router = useRouter();
  const endereco = useSearchParams();
  const { painel, atualizar } = usePlataforma();
  const f: Filtros = {
    aba: endereco.get("aba") === "ENTREGUES" ? "ENTREGUES" : "GUARDADAS",
    atalho: (endereco.get("atalho") ?? "") in ATALHOS_ENCOMENDAS ? (endereco.get("atalho") as AtalhoEncomendas) : "",
    busca: endereco.get("busca") ?? "",
    pagina: Math.max(1, Number(endereco.get("pagina")) || 1),
  };
  if (f.aba === "ENTREGUES") f.atalho = "";
  const q = consulta(f);
  const lista = useCarregar<ListaEncomendas>(`/v1/condominio/encomendas${q ? `?${q}` : ""}`);
  const opcoes = useCarregar<OpcoesEncomenda>("/v1/condominio/encomendas/opcoes");
  const [registrando, setRegistrando] = useState(false);
  const [aberta, setAberta] = useState<{ e: Encomenda; acao: AcaoEncomenda } | null>(null);
  const [recado, setRecado] = useState<Recado>(null);
  const [texto, setTexto] = useState(f.busca);

  const ir = (m: Partial<Filtros>) => {
    const novo = consulta({ ...f, pagina: 1, ...m });
    router.replace(novo ? `/portaria?${novo}` : "/portaria", { scroll: false });
  };
  const o = opcoes.estado === "pronto" ? opcoes.dados : null;
  const dados = lista.estado === "pronto" ? lista.dados : null;
  const podeCuidar = Boolean(dados?.pode.cuidar ?? o?.pode.cuidar);
  const dias = dados?.dias ?? painel.portaria?.dias ?? 7;
  const depois = (t: string, tom: "ok" | "atencao" = "ok") => { setAberta(null); setRecado({ tom, texto: t }); lista.recarregar(); atualizar(); };
  const limpar = () => { setTexto(""); ir({ busca: "", atalho: "" }); };
  const registrar = podeCuidar ? <Botao onClick={() => setRegistrando(true)}><Icone nome="caixa" />Registrar encomenda</Botao> : null;
  const abrir = (e: Encomenda) => (a: AcaoEncomenda) => {
    if (a === "etiqueta") void abrirEtiqueta(e).then((erro) => { if (erro) setRecado({ tom: "atencao", texto: erro }); });
    else setAberta({ e, acao: a });
  };
  const avisar = (e: Encomenda) => () => void avisarDeNovo(e).then((r) => depois(r.texto, r.tom));

  return (
    <div className="grid gap-5 max-md:pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="t-titulo-tela">Portaria</h1>
          <p className="t-apoio mt-1">O que chegou para as unidades: onde está guardado, quem guardou e quem retirou.</p>
        </div>
        {registrar ? <div className="max-md:hidden">{registrar}</div> : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {dados?.soMinhas ? <Aviso tom="info">Neste prédio sem portaria, você vê só as encomendas que você mesmo registrou.</Aviso> : null}

      <form role="search" aria-label="Buscar encomendas" className="busca min-w-0 md:max-w-[520px]" onSubmit={(x) => { x.preventDefault(); ir({ busca: texto.trim() }); }}>
        <Icone nome="busca" />
        <label htmlFor="en-busca" className="sr-only">Buscar</label>
        <input id="en-busca" className="campo" type="search" placeholder="Buscar por unidade, como 101 ou Torre B · 304" maxLength={60} value={texto} onChange={(x) => setTexto(x.target.value)} />
      </form>

      <section aria-labelledby="t-lista" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-lista" className="sr-only">Encomendas encontradas</h2>
        <nav aria-label="Situação" className="flex gap-1 overflow-x-auto border-b border-linha md:px-3">
          {(Object.keys(ABAS_ENCOMENDAS) as Filtros["aba"][]).map((valor) => {
            const atual = f.aba === valor;
            const n = dados?.contagens[valor];
            return (
              <button key={valor} type="button" aria-pressed={atual} onClick={() => ir({ aba: valor, atalho: "" })}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 t-texto font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
                {ABAS_ENCOMENDAS[valor]}
                {n !== undefined && valor === "GUARDADAS" && (n > 0 || atual) ? <span className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{n}</span> : null}
              </button>
            );
          })}
        </nav>
        {f.aba === "GUARDADAS" ? (
          <div role="group" aria-label="O que pede atenção" className="flex items-center gap-2 overflow-x-auto py-3 md:border-b md:border-linha md:bg-fundo md:px-5">
            <span className="t-apoio shrink-0 max-md:hidden">Pede atenção</span>
            {(Object.keys(ATALHOS_ENCOMENDAS) as AtalhoEncomendas[]).map((codigo) => {
              const n = dados?.contagens[codigo];
              return (
                <button key={codigo} type="button" aria-pressed={f.atalho === codigo} data-tom={TOM_ATALHO[codigo]} className="chip-atencao"
                  onClick={() => ir({ atalho: f.atalho === codigo ? "" : codigo })}>
                  {n ? <Icone nome={ICONE_ATALHO[codigo]} className="h-4 w-4" /> : null}
                  {nomeAtalho(codigo, dias)}{n !== undefined ? <> <b>{n}</b></> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {lista.estado === "carregando" ? <div className="p-5"><Carregando rotulo="Carregando as encomendas…" /></div> : null}
        {lista.estado === "erro" ? <div className="p-5"><ErroCarregar erro={lista.erro} texto={lista.texto} tentarDeNovo={lista.recarregar} /></div> : null}
        {dados ? (
          dados.itens.length === 0 ? (
            <div className="md:p-5">
              {f.busca ? (
                <Vazio titulo={`Nenhuma encomenda para “${f.busca}”`} icone="busca" acao={<Botao variante="contorno" onClick={limpar}>Limpar a busca</Botao>} />
              ) : f.atalho ? (
                <Vazio titulo={`Nada em ${nomeAtalho(f.atalho, dias)}`} icone="check" acao={<Botao variante="contorno" onClick={limpar}>Ver todas as guardadas</Botao>} />
              ) : f.aba === "ENTREGUES" ? (
                <Vazio titulo="Nenhuma encomenda entregue ainda" icone="caixa">Quando alguém retirar uma encomenda, ela aparece aqui com quem retirou.</Vazio>
              ) : (
                <Vazio titulo="Nenhuma encomenda guardada" icone="caixa" nota="As que já foram retiradas ficam na aba Entregues."
                  acao={<>{registrar}<Link href="/portaria#como-funciona" className="t-texto font-medium text-violeta-600 hover:underline">Como funciona</Link></>}>
                  Quando chegar uma, registre aqui e a unidade é avisada pelo WhatsApp.
                </Vazio>
              )}
            </div>
          ) : (
            <>
              <div aria-hidden="true" className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.8fr)_auto] gap-4 border-b border-linha bg-fundo px-5 py-2.5 md:grid">
                <span className="t-rotulo">Unidade e de quem veio</span><span className="t-rotulo">Onde está</span>
                <span className="t-rotulo">{f.aba === "GUARDADAS" ? "Quem guardou, desde" : "Quem retirou"}</span><span className="t-rotulo">Aviso à unidade</span><span className="w-36" />
              </div>
              <ul className="grid max-md:gap-3">
                {dados.itens.map((e) => <Linha key={e.id} e={e} podeCuidar={podeCuidar} abrir={abrir(e)} avisar={avisar(e)} />)}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">
                <span className="t-apoio">
                  {f.aba === "GUARDADAS" ? `${dados.total === 1 ? "1 guardada" : `${dados.total} guardadas`} · as mais antigas por último` : `${dados.total === 1 ? "1 entregue" : `${dados.total} entregues`} · a mais recente primeiro`}
                </span>
                <span className="t-apoio">Entregar registra quem retirou; sem código por mensagem.</span>
                {dados.total > dados.porPagina ? (
                  <span className="flex gap-2">
                    <Botao variante="contorno" tamanho="m" disabled={f.pagina <= 1} onClick={() => ir({ pagina: f.pagina - 1 })}><Icone nome="esq" />Anteriores</Botao>
                    <Botao variante="contorno" tamanho="m" disabled={f.pagina * dados.porPagina >= dados.total} onClick={() => ir({ pagina: f.pagina + 1 })}>Próximas<Icone nome="dir" /></Botao>
                  </span>
                ) : null}
              </div>
            </>
          )
        ) : null}
      </section>

      <section id="como-funciona" aria-labelledby="t-legenda" className="grid gap-2">
        <h2 id="t-legenda" className="t-titulo-cartao">O que diz cada selo</h2>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 t-apoio">
          <li className="flex items-center gap-2"><Selo tom={TOM_AVISO_ENCOMENDA.AVISADA}>{AVISOS_ENCOMENDA.AVISADA}</Selo>o aviso saiu pelo WhatsApp</li>
          <li className="flex items-center gap-2"><Selo tom={TOM_AVISO_ENCOMENDA.SEM_AVISO}>{AVISOS_ENCOMENDA.SEM_AVISO}</Selo>ninguém da unidade pode receber: PARAR, sem contato ou número fora do WhatsApp</li>
          <li className="flex items-center gap-2"><Selo tom={TOM_AVISO_ENCOMENDA.AVISO_FALHOU}>{AVISOS_ENCOMENDA.AVISO_FALHOU}</Selo>o envio não chegou</li>
        </ul>
      </section>

      {registrar ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{registrar}</div> : null}
      {registrando && o ? (
        <RegistrarEncomenda opcoes={o} aoFechar={() => setRegistrando(false)} registrada={() => { lista.recarregar(); atualizar(); }}
          verGuardadas={() => { setRegistrando(false); ir({ aba: "GUARDADAS", atalho: "", busca: "" }); }} />
      ) : null}
      <JanelasEncomenda aberta={aberta} opcoes={o} eu={painel.pessoa.nome} aoFechar={() => setAberta(null)} salvo={(t) => depois(t)} />
    </div>
  );
}
