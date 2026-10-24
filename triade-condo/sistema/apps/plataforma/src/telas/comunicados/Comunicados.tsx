"use client";
// Comunicados (DC15, telas-modelo comunicados-lista-*; CD-01, CD-02, CD-05, CD-06): abas por
// situação, Publicados primeiro; o que pede atenção em atalhos, só quando existe; busca e o assunto
// em Filtros, numa janela. A linha inteira abre o comunicado, com um selo de situação e data. Cada
// correção é uma versão nova; arquivado vai para a sua aba e nada é apagado. Os filtros ficam no
// endereço, para o Início levar direto ao que importa. A aba "No mural" abre o mural ao vivo (CD-15).
// O período (D4.9, decisão C.1 de 24/10/2026, quadros 260 e 261) vale a data que cada aba mostra; os
// atalhos preenchem De e Até, e o período escolhido fica ao lado de Filtros, com o x para tirar.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ASSUNTOS_COMUNICADO, ATALHOS_COMUNICADO } from "@triade/domain";
import { Botao, Carregando, CampoSelecao, CampoTexto, Chip, classeBotao, Dialogo, ErroCarregar, Icone, Vazio, type NomeIcone } from "@triade/ui";
import { hojeEmBrasilia } from "../moradores/comum.tsx";
import { useCarregar, useContagens } from "../sessao.tsx";
import type { ListaComunicados } from "../tipos.ts";
import { CabecaComunicados, LinhaComunicado } from "./comum.tsx";
import { AbaNoMural } from "./NoMural.tsx";

/** As abas (decisão B.1 de 21/10/2026): "Em uso" saiu, Publicados abre primeiro. */
const ABAS = { PUBLICADO: "Publicados", PROGRAMADO: "Programados", RASCUNHO: "Rascunhos", ARQUIVADO: "Arquivados" } as const;
type Aba = keyof typeof ABAS;
/** Cada atalho leva à aba onde o que ele acha mora. */
const ABA_DO_ATALHO: Record<string, Aba> = { RASCUNHOS_PARADOS: "RASCUNHO", PROGRAMADOS_HOJE: "PROGRAMADO" };
const ICONE_ATALHO: Record<string, NomeIcone> = { RASCUNHOS_PARADOS: "editar", PROGRAMADOS_HOJE: "relogio" };
const VAZIO: Record<Aba, { titulo: string; texto: string }> = {
  PUBLICADO: { titulo: "Nenhum comunicado publicado", texto: "Escreva o primeiro aviso aos moradores. Ele sai no mural, por e-mail, copiado para o grupo do prédio ou impresso." },
  PROGRAMADO: { titulo: "Nenhum comunicado programado", texto: "Ao escrever, escolha Programar para o comunicado sair sozinho no dia e na hora marcados." },
  RASCUNHO: { titulo: "Nenhum rascunho", texto: "O que você começa a escrever e salva sem publicar fica aqui." },
  ARQUIVADO: { titulo: "Nenhum comunicado arquivado", texto: "Arquivado sai das outras abas e fica guardado aqui, com o texto e as versões." },
};

type Filtros = { aba: Aba; assunto: string; atencao: string; busca: string; de: string; ate: string; pagina: number };

const DIA = /^\d{4}-\d{2}-\d{2}$/;
/** Os atalhos do período, contados a partir de hoje em Brasília. */
export function periodosComunicado(hoje = hojeEmBrasilia()): { nome: string; de: string; ate: string }[] {
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  const fimDoMes = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const trinta = new Date(Date.parse(`${hoje}T12:00:00Z`) - 29 * 86400_000).toISOString().slice(0, 10);
  return [
    { nome: "Últimos 30 dias", de: trinta, ate: hoje },
    { nome: "Este mês", de: `${hoje.slice(0, 7)}-01`, ate: fimDoMes },
    { nome: "Este ano", de: `${a}-01-01`, ate: `${a}-12-31` },
  ];
}
const br = (d: string) => d.split("-").reverse().join("/");
/** Como o período aparece ao lado de Filtros: o nome do atalho ou as datas. */
export function nomePeriodo(de: string, ate: string, hoje = hojeEmBrasilia()): string {
  const atalho = periodosComunicado(hoje).find((p) => p.de === de && p.ate === ate);
  if (atalho) return atalho.nome;
  if (de && ate) return `${br(de)} a ${br(ate)}`;
  return de ? `Desde ${br(de)}` : `Até ${br(ate)}`;
}

function lerFiltros(b: URLSearchParams): Filtros {
  const v = (k: string) => b.get(k) ?? "";
  const atencao = v("atencao") in ATALHOS_COMUNICADO ? v("atencao") : "";
  return {
    aba: v("filtro") in ABAS ? (v("filtro") as Aba) : ABA_DO_ATALHO[atencao] ?? "PUBLICADO",
    assunto: v("assunto") in ASSUNTOS_COMUNICADO ? v("assunto") : "",
    atencao, busca: v("busca"), pagina: Math.max(1, Number(v("pagina")) || 1),
    de: DIA.test(v("de")) ? v("de") : "", ate: DIA.test(v("ate")) ? v("ate") : "",
  };
}

function consulta(f: Filtros): string {
  const q = new URLSearchParams();
  if (f.aba !== "PUBLICADO") q.set("filtro", f.aba);
  if (f.assunto) q.set("assunto", f.assunto);
  if (f.atencao) q.set("atencao", f.atencao);
  if (f.busca) q.set("busca", f.busca);
  if (f.de) q.set("de", f.de);
  if (f.ate) q.set("ate", f.ate);
  if (f.pagina > 1) q.set("pagina", String(f.pagina));
  return q.toString();
}

/** Busca por título ou texto; vale ao apertar Enter. */
function Busca({ inicial, aoBuscar }: { inicial: string; aoBuscar: (b: string) => void }) {
  const [texto, setTexto] = useState(inicial);
  return (
    <form role="search" aria-label="Buscar comunicados" className="busca min-w-0 flex-1 md:max-w-[520px]" onSubmit={(e) => { e.preventDefault(); aoBuscar(texto.trim()); }}>
      <Icone nome="busca" />
      <label htmlFor="cm-busca" className="sr-only">Buscar</label>
      <input id="cm-busca" className="campo" type="search" maxLength={60} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por título ou texto" />
    </form>
  );
}

function JanelaFiltros({ aberto, f, aoFechar, aplicar }: { aberto: boolean; f: Filtros; aoFechar: () => void; aplicar: (m: Partial<Filtros>) => void }) {
  const [assunto, setAssunto] = useState(f.assunto);
  const [de, setDe] = useState(f.de);
  const [ate, setAte] = useState(f.ate);
  const invertido = Boolean(de && ate && de > ate);
  return (
    <Dialogo aberto={aberto} titulo="Filtrar comunicados" apoio="Assunto e período valem em todas as abas. Os atalhos preenchem as datas; dá para mudar à mão." aoFechar={aoFechar}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (!invertido) aplicar({ assunto, de, ate }); }}>
        <CampoSelecao id="cm-f-assunto" rotulo="Assunto" icone="lista" value={assunto} onChange={(e) => setAssunto(e.target.value)}
          opcoes={[{ valor: "", texto: "Todos os assuntos" }, ...Object.entries(ASSUNTOS_COMUNICADO).map(([valor, texto]) => ({ valor, texto }))]} />
        <fieldset className="grid gap-2.5">
          <legend className="mb-1 t-apoio font-medium text-tinta">Período</legend>
          <div className="flex flex-wrap gap-2">
            {periodosComunicado().map((p) => {
              const escolhido = p.de === de && p.ate === ate;
              return <Chip key={p.nome} ativo={escolhido} onClick={() => { setDe(p.de); setAte(p.ate); }}>{p.nome}</Chip>;
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CampoTexto id="cm-f-de" rotulo="De" type="date" icone="calendario" value={de} onChange={(e) => setDe(e.target.value)} />
            <CampoTexto id="cm-f-ate" rotulo="Até" type="date" icone="calendario" value={ate} onChange={(e) => setAte(e.target.value)}
              erro={invertido ? "O fim do período vem depois do começo" : null} />
          </div>
          <p className="t-apoio">Vale a data que aparece na aba: publicado em, programado para, editado em ou arquivado em.</p>
        </fieldset>
        <div className="flex justify-between gap-2">
          <Botao variante="discreto" onClick={() => aplicar({ assunto: "", de: "", ate: "" })}>Tirar filtros</Botao>
          <Botao type="submit">Mostrar comunicados</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

export function Comunicados() {
  const router = useRouter();
  const busca = useSearchParams();
  const f = lerFiltros(busca);
  // A API sempre recebe a aba; o endereço da tela deixa Publicados de fora.
  const api = new URLSearchParams(consulta(f));
  api.set("filtro", f.aba);
  const lista = useCarregar<ListaComunicados>(`/v1/condominio/comunicados?${api}`);
  const contagens = useContagens("comunicados", consulta(f));
  const [filtrandoAberto, setFiltrando] = useState(false);

  const ir = (m: Partial<Filtros>) => {
    const novo = consulta({ ...f, pagina: 1, ...m });
    router.replace(novo ? `/comunicados?${novo}` : "/comunicados", { scroll: false });
  };
  const dados = lista.estado === "pronto" ? lista.dados : null;
  const podePublicar = Boolean(dados?.pode.publicar);
  const filtrando = Boolean(f.assunto || f.atencao || f.busca || f.de || f.ate);
  const emUso = (f.assunto ? 1 : 0) + (f.de || f.ate ? 1 : 0);
  const limpar = { assunto: "", atencao: "", busca: "", de: "", ate: "" };
  const escrever = <Link href="/comunicados/escrever" className={classeBotao("primario")}><Icone nome="mais" />Escrever comunicado</Link>;
  const contaAtalho: Record<string, number> = dados ? { RASCUNHOS_PARADOS: dados.atalhos.rascunhosParados, PROGRAMADOS_HOJE: dados.atalhos.programadosHoje } : {};
  const atalhos = Object.entries(ATALHOS_COMUNICADO).filter(([codigo]) => (contaAtalho[codigo] ?? 0) > 0 || f.atencao === codigo);

  return (
    <div className="grid gap-5 max-md:pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="t-titulo-tela">Comunicados</h1>
          <p className="t-apoio mt-1">O que o condomínio avisa a todos. Publicado não se edita: corrigir vira uma versão nova.</p>
        </div>
        {podePublicar ? <div className="max-md:hidden">{escrever}</div> : null}
      </div>

      <div className="flex items-center gap-3">
        <Busca key={f.busca} inicial={f.busca} aoBuscar={(b) => ir({ busca: b })} />
        <Botao variante="contorno" aria-label={emUso ? `Filtros, ${emUso} em uso` : "Filtros"} className="max-md:w-11 max-md:px-0" onClick={() => setFiltrando(true)}>
          <Icone nome="filtro" /><span className="max-md:hidden">Filtros{emUso ? ` · ${emUso}` : ""}</span>
        </Botao>
        {f.de || f.ate ? <Chip icone="calendario" className="max-md:hidden" aoTirar={() => ir({ de: "", ate: "" })} rotuloTirar="Tirar o período">{nomePeriodo(f.de, f.ate)}</Chip> : null}
        {filtrando ? <Botao variante="discreto" className="max-md:hidden" onClick={() => ir(limpar)}>Limpar filtros</Botao> : null}
      </div>

      <section aria-labelledby="t-lista" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
        <h2 id="t-lista" className="sr-only">Comunicados encontrados</h2>
        <nav aria-label="Situação" className="flex gap-1 overflow-x-auto border-b border-linha md:px-3">
          {(Object.keys(ABAS) as Aba[]).map((a) => {
            const atual = f.aba === a;
            const n = contagens.n[a];
            return (
              <button key={a} type="button" aria-pressed={atual} onClick={() => ir({ aba: a, atencao: ABA_DO_ATALHO[f.atencao] === a ? f.atencao : "" })}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 t-texto font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
                {ABAS[a]}
                {n !== undefined && (n > 0 || atual) ? <><span className="sr-only"> ({n})</span><span aria-hidden="true" className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{n}</span></> : null}
              </button>
            );
          })}
          <AbaNoMural />
        </nav>
        {atalhos.length ? (
          <div role="group" aria-label="O que pede atenção" className="flex items-center gap-2 overflow-x-auto py-3 md:border-b md:border-linha md:bg-fundo md:px-5">
            <span className="t-apoio shrink-0 max-md:hidden">Pede atenção</span>
            {atalhos.map(([codigo, nome]) => (
              <button key={codigo} type="button" aria-pressed={f.atencao === codigo} data-tom="atencao" className="chip-atencao"
                onClick={() => ir(f.atencao === codigo ? { atencao: "" } : { atencao: codigo, aba: ABA_DO_ATALHO[codigo] })}>
                <Icone nome={ICONE_ATALHO[codigo]!} className="h-4 w-4" />{nome} <b>{contaAtalho[codigo] ?? 0}</b>
              </button>
            ))}
          </div>
        ) : null}

        {lista.estado === "carregando" ? <div className="p-5"><Carregando rotulo="Carregando os comunicados…" /></div> : null}
        {lista.estado === "erro" ? <div className="p-5"><ErroCarregar erro={lista.erro} texto={lista.texto} tentarDeNovo={lista.recarregar} oQue="os comunicados" /></div> : null}
        {dados ? (
          dados.itens.length === 0 ? (
            <div className="md:p-5">
              {filtrando ? <Vazio titulo="Nenhum comunicado com estes filtros" icone="filtro"
                acao={<Botao variante="contorno" onClick={() => ir(limpar)}>Limpar filtros</Botao>} />
                : <Vazio titulo={VAZIO[f.aba].titulo} icone="megafone" acao={podePublicar && f.aba === "PUBLICADO" ? escrever : undefined}>{VAZIO[f.aba].texto}</Vazio>}
            </div>
          ) : (
            <>
              <CabecaComunicados />
              <ul aria-label="Comunicados" className="grid max-md:gap-3">{dados.itens.map((c) => <LinhaComunicado key={c.id} c={c} />)}</ul>
              <div className="flex flex-wrap items-center justify-between gap-2 py-4 md:border-t md:border-linha md:px-5">
                <span className="t-apoio">{dados.total === 1 ? "1 comunicado" : `${dados.total} comunicados`}{f.de || f.ate ? ` · ${nomePeriodo(f.de, f.ate).replace(/^./, (l) => l.toLowerCase())}` : ""}</span>
                {dados.total > 30 ? (
                  <span className="flex gap-2">
                    <Botao variante="contorno" tamanho="m" disabled={f.pagina <= 1} onClick={() => ir({ pagina: f.pagina - 1 })}><Icone nome="esq" />Anteriores</Botao>
                    <Botao variante="contorno" tamanho="m" disabled={f.pagina * 30 >= dados.total} onClick={() => ir({ pagina: f.pagina + 1 })}>Próximos<Icone nome="dir" /></Botao>
                  </span>
                ) : null}
              </div>
            </>
          )
        ) : null}
      </section>

      {podePublicar ? <div className="fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 md:hidden">{escrever}</div> : null}
      <JanelaFiltros key={`${filtrandoAberto}`} aberto={filtrandoAberto} f={f} aoFechar={() => setFiltrando(false)} aplicar={(m) => { setFiltrando(false); ir(m); }} />
    </div>
  );
}
