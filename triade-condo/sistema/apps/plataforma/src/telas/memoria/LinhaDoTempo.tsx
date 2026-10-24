"use client";
// Linha do tempo e anotar na memória (DC15, telas-modelo documentos-memoria-*; canvas do novo
// frontend, quadros 91 a 94; CT-03): a história do prédio montada sozinha com o que já acontece no
// sistema e com o que a gestão anota, agrupada por mês. A fonte escolhe-se em Filtros, uma por vez,
// e fica escrita ao lado do botão. A linha inteira abre a anotação, a manutenção ou o documento.
// Busca ao lado de Filtros e período em Filtros (D4.18, decisão D.3 de 24/10/2026; quadros 262 e
// 263): a busca olha o título e o texto, a partir de 3 letras, e marca o pedaço achado.
// Anotação não se apaga: corrigir guarda a versão anterior e tirar da linha do tempo pede motivo.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { FILTROS_LINHA_DO_TEMPO, mostrarDataCurta, TIPOS_ANOTACAO, type FiltroLinhaDoTempo, type TipoAnotacao } from "@triade/domain";
import {
  AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, Chip, Dialogo, ErroCarregar, Icone, Selo,
  textoDoErro, Vazio, type ErroApi, type NomeIcone,
} from "@triade/ui";
import type { PropsAbaMemoria } from "../documentos/DocumentosEMemoria.tsx";
import { hojeEmBrasilia } from "../moradores/comum.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { AnotacaoDetalhe, EventoMemoria, LinhaDoTempo, OpcoesMemoria } from "../tipos.ts";
import { DiaQuadro } from "../vida/comum.tsx";

/** De onde vem cada linha, no selo. */
const FONTE: Record<EventoMemoria["fonte"], string> = {
  ANOTADO: "Anotado", MANUTENCAO: "Manutenção", DOCUMENTO: "Documentos", PRONTUARIO: "Documentos", COMUNICADO: "Comunicados", PESSOA: "Pessoas", ASSEMBLEIA: "Assembleia",
};
const EXPLICA_FILTRO: Record<FiltroLinhaDoTempo, string> = {
  TUDO: "Tudo o que aconteceu",
  ANOTADO: "Decisões, combinados, obras e ocorrências anotados à mão",
  MANUTENCAO: "Manutenções concluídas",
  DOCUMENTOS: "Documentos guardados e itens do prontuário que venceram",
  COMUNICADOS: "Comunicados publicados",
  PESSOAS: "Quem entrou e quem saiu da gestão",
};
const ICONE_TIPO: Record<TipoAnotacao, NomeIcone> = { DECISAO: "decisao", COMBINADO: "convivio", OBRA: "ferramenta", OCORRENCIA: "alerta", OUTRO: "pontos" };

function ligacaoTexto(l: EventoMemoria["ligacao"]): string | null {
  if (!l) return null;
  if (l.tipo === "DOCUMENTO") return l.restrito ? "com documento restrito" : `com o documento ${l.titulo}`;
  if (l.tipo === "PEDIDO") return l.privado ? `com o pedido ${l.protocolo} (privado)` : `com o pedido ${l.protocolo}`;
  return `com a manutenção ${l.titulo}`;
}

function linkDo(e: EventoMemoria): string | null {
  if (e.fonte === "MANUTENCAO") return `/manutencao/manutencao?id=${e.manutencaoId}`;
  if (e.fonte === "DOCUMENTO") return `/documentos/documento?id=${e.documentoId}`;
  if (e.fonte === "PRONTUARIO") return `/documentos/prontuario?item=${e.id}`;
  if (e.fonte === "COMUNICADO") return `/comunicados/comunicado?id=${e.id}`;
  if (e.fonte === "ASSEMBLEIA") return `/vida/assembleia?id=${e.id}`;
  return null;
}

const mesDe = (d: string) => {
  const t = new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const DIA = /^\d{4}-\d{2}-\d{2}$/;
type FiltrosLinha = { filtro: FiltroLinhaDoTempo; busca: string; de: string; ate: string };
function lerFiltros(b: URLSearchParams): FiltrosLinha {
  const v = (k: string) => b.get(k) ?? "";
  return {
    filtro: (Object.keys(FILTROS_LINHA_DO_TEMPO) as FiltroLinhaDoTempo[]).find((f) => f === v("filtro")) ?? "TUDO",
    busca: v("busca").trim().slice(0, 60), de: DIA.test(v("de")) ? v("de") : "", ate: DIA.test(v("ate")) ? v("ate") : "",
  };
}
function consulta(f: FiltrosLinha, comTudo = false): string {
  const q = new URLSearchParams();
  if (comTudo || f.filtro !== "TUDO") q.set("filtro", f.filtro);
  if (f.busca) q.set("busca", f.busca);
  if (f.de) q.set("de", f.de);
  if (f.ate) q.set("ate", f.ate);
  return q.toString();
}

/** Os atalhos do período da linha do tempo, contados a partir de hoje em Brasília. */
export function periodosLinha(hoje = hojeEmBrasilia()): { nome: string; de: string; ate: string }[] {
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  const fimDoMes = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const umAno = new Date(Date.UTC(a - 1, m - 1, Number(hoje.slice(8)) + 1)).toISOString().slice(0, 10);
  return [
    { nome: "Este mês", de: `${hoje.slice(0, 7)}-01`, ate: fimDoMes },
    { nome: "Este ano", de: `${a}-01-01`, ate: `${a}-12-31` },
    { nome: "Últimos 12 meses", de: umAno, ate: hoje },
  ];
}
const br = (d: string) => d.split("-").reverse().join("/");
/** Como o período aparece ao lado de Filtros: o nome do atalho ou as datas. */
export function nomePeriodoLinha(de: string, ate: string, hoje = hojeEmBrasilia()): string {
  const atalho = periodosLinha(hoje).find((p) => p.de === de && p.ate === ate);
  if (atalho) return atalho.nome;
  if (de && ate) return `${br(de)} a ${br(ate)}`;
  return de ? `Desde ${br(de)}` : `Até ${br(ate)}`;
}

/** Marca, sem diferença de maiúscula, o pedaço achado pela busca. */
export function marcar(texto: string, busca: string): ReactNode {
  const b = busca.trim().toLowerCase();
  if (b.length < 1) return texto;
  const partes: ReactNode[] = [];
  let i = 0;
  for (let j = texto.toLowerCase().indexOf(b); j >= 0; j = texto.toLowerCase().indexOf(b, i)) {
    partes.push(texto.slice(i, j), <mark key={j} className="rounded-[4px] bg-laranja-100 px-0.5 text-tinta">{texto.slice(j, j + b.length)}</mark>);
    i = j + b.length;
  }
  partes.push(texto.slice(i));
  return <>{partes.map((p, k) => <Fragment key={k}>{p}</Fragment>)}</>;
}

/** A busca procura enquanto se digita, a partir de 3 letras; Enter busca na hora. */
function BuscaLinha({ inicial, aoBuscar }: { inicial: string; aoBuscar: (b: string) => void }) {
  const [texto, setTexto] = useState(inicial);
  useEffect(() => {
    const t = texto.trim();
    if (t === inicial || (t.length > 0 && t.length < 3)) return;
    const espera = setTimeout(() => aoBuscar(t), 400);
    return () => clearTimeout(espera);
  }, [texto, inicial, aoBuscar]);
  return (
    <form role="search" aria-label="Buscar na linha do tempo" className="busca min-w-0 flex-1 md:max-w-[360px]" onSubmit={(e) => { e.preventDefault(); aoBuscar(texto.trim()); }}>
      <Icone nome="busca" />
      <label htmlFor="lt-busca" className="sr-only">Buscar na linha do tempo</label>
      <input id="lt-busca" className="campo" type="search" maxLength={60} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por uma palavra" />
    </form>
  );
}

export function AbaLinhaDoTempo({ feito, definir }: PropsAbaMemoria) {
  const router = useRouter();
  const f = lerFiltros(useSearchParams());
  const filtro = f.filtro;
  const api = consulta(f, true);
  const carga = useCarregar<LinhaDoTempo>(`/v1/condominio/memoria/linha-do-tempo?${api}`);
  const [pagina, setPagina] = useState<{ de: LinhaDoTempo | null; antigos: EventoMemoria[]; proximo: string | null }>({ de: null, antigos: [], proximo: null });
  const [buscando, setBuscando] = useState(false);
  const [anotar, setAnotar] = useState(false);
  const [filtrando, setFiltrando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  const dados = carga.estado === "pronto" ? carga.dados : null;
  const podeAnotar = dados?.podeAnotar ?? false;
  useEffect(() => {
    definir({ principal: podeAnotar ? { texto: "Anotar na memória", icone: "editar", aoClicar: () => setAnotar(true) } : null });
  }, [podeAnotar, definir]);
  // Nova carga (outro filtro ou depois de anotar): recomeça do mais novo.
  const { antigos, proximo } = pagina.de === dados ? pagina : { antigos: [], proximo: dados?.maisAntigosAntes ?? null };
  const ir = (m: Partial<FiltrosLinha>) => {
    const novo = consulta({ ...f, ...m });
    router.replace(novo ? `/documentos/linha?${novo}` : "/documentos/linha", { scroll: false });
  };
  const periodo = f.de || f.ate ? nomePeriodoLinha(f.de, f.ate) : "";
  const emUso = (filtro !== "TUDO" ? 1 : 0) + (periodo ? 1 : 0);

  async function maisAntigos() {
    if (!proximo) return;
    setBuscando(true);
    const r = await chamarApi<LinhaDoTempo>(`/v1/condominio/memoria/linha-do-tempo?${api}&antes=${proximo}`);
    setBuscando(false);
    if (r.ok) setPagina({ de: dados, antigos: [...antigos, ...r.dados.eventos], proximo: r.dados.maisAntigosAntes ?? null });
  }
  const mudou = (texto: string) => { setAnotar(false); setAberta(null); carga.recarregar(); feito(texto); };
  const eventos = dados ? [...dados.eventos, ...antigos] : [];
  const meses: { mes: string; eventos: EventoMemoria[] }[] = [];
  for (const e of eventos) {
    const mes = mesDe(e.data);
    if (meses.at(-1)?.mes === mes) meses.at(-1)!.eventos.push(e);
    else meses.push({ mes, eventos: [e] });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <BuscaLinha key={f.busca} inicial={f.busca} aoBuscar={(b) => ir({ busca: b })} />
        <Botao variante="contorno" tamanho="m" aria-label={emUso ? `Filtros, ${emUso} em uso` : "Filtros"} onClick={() => setFiltrando(true)}>
          <Icone nome="filtro" />{emUso ? `Filtros · ${emUso}` : "Filtros"}
        </Botao>
        {periodo ? <Chip icone="calendario" aoTirar={() => ir({ de: "", ate: "" })} rotuloTirar="Tirar o período">{periodo}</Chip> : null}
        {filtro === "TUDO" && !f.busca && !periodo ? <span className="t-apoio">Mostrando tudo: anotado, manutenção, documentos, comunicados e pessoas</span> : null}
        {filtro !== "TUDO" ? (
          <span className="flex items-center gap-2 t-texto"><span className="t-apoio">Mostrando: {FILTROS_LINHA_DO_TEMPO[filtro]}</span>
            <Botao variante="discreto" tamanho="p" onClick={() => ir({ filtro: "TUDO" })}>Limpar</Botao></span>
        ) : null}
        {dados && (f.busca || periodo) ? (
          <span className="t-apoio" role="status">
            {eventos.length === 1 ? "1 resultado" : `${eventos.length}${proximo ? " ou mais" : ""} resultados`}{f.busca ? ` para “${f.busca}”` : ""}{periodo ? ` · ${periodo.replace(/^./, (l) => l.toLowerCase())}` : ""}
          </span>
        ) : null}
      </div>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando a linha do tempo…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} oQue="a linha do tempo" /> : null}
      {dados ? (
        <section aria-label="Linha do tempo" className="overflow-hidden md:rounded-[18px] md:border md:border-linha md:bg-superficie md:shadow-s1">
          {eventos.length === 0 ? (
            <div className="md:p-5">
              {f.busca || periodo ? (
                <Vazio titulo="Nada encontrado" icone="busca">
                  {f.busca ? `Nada com “${f.busca}”` : "Nada"}{periodo ? " neste período" : ""}. Tente outra palavra ou tire o período em Filtros.
                </Vazio>
              ) : (
                <Vazio titulo="Nada aqui ainda" icone="relogio">
                  {filtro === "ANOTADO" ? "Anote decisões, combinados, obras e ocorrências que não passaram por nenhuma tela." : "O que acontece no sistema entra aqui sozinho."}
                </Vazio>
              )}
            </div>
          ) : meses.map((m) => (
            <div key={m.mes}>
              <h2 className="t-rotulo pt-3 pb-2 md:border-t md:border-linha md:bg-fundo md:px-5 md:first:border-t-0">{m.mes}</h2>
              <ol className="grid max-md:gap-2.5">
                {m.eventos.map((e) => <LinhaEvento key={`${e.fonte}-${e.id}-${e.data}`} e={e} busca={f.busca} abrir={() => setAberta(e.id)} />)}
              </ol>
            </div>
          ))}
          {proximo ? (
            <div className="flex justify-center py-3.5 md:border-t md:border-linha">
              <Botao variante="contorno" tamanho="m" disabled={buscando} onClick={() => void maisAntigos()}><Icone nome="baixo" />{buscando ? "Buscando…" : "Ver mais antigos"}</Botao>
            </div>
          ) : null}
        </section>
      ) : null}
      <p className="t-apoio">O que tem o selo Anotado foi escrito à mão; o resto vem sozinho de outras partes. Cada um vê aqui só o que já pode ver no resto do sistema.</p>
      {filtrando ? <JanelaFiltrosLinha f={f} aoFechar={() => setFiltrando(false)} aplicar={(m) => { setFiltrando(false); ir(m); }} /> : null}
      {anotar ? <FormAnotacao aoFechar={() => setAnotar(false)} aoSalvar={mudou} /> : null}
      {aberta ? <AnotacaoAberta id={aberta} aoFechar={() => setAberta(null)} aoMudar={mudou} /> : null}
    </div>
  );
}

function LinhaEvento({ e, busca, abrir }: { e: EventoMemoria; busca: string; abrir: () => void }) {
  const anotado = e.fonte === "ANOTADO";
  const link = linkDo(e);
  const classeTitulo = "text-left font-medium text-tinta after:absolute after:inset-0 after:content-[''] hover:text-violeta-600";
  const apoio = anotado
    ? [e.texto, TIPOS_ANOTACAO[e.tipo as TipoAnotacao], e.autor, ligacaoTexto(e.ligacao), e.corrigida ? "corrigido" : null].filter(Boolean).join(" · ")
    : e.detalhe;
  return (
    <li className="relative grid grid-cols-[52px_minmax(0,1fr)_20px] items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-violeta-50/50 max-md:rounded-[18px] max-md:border max-md:border-linha max-md:bg-superficie max-md:p-4 max-md:shadow-s1 md:grid-cols-[52px_minmax(0,1fr)_150px_20px] md:border-t md:border-linha md:first:border-t-0">
      <DiaQuadro d={e.data.slice(0, 10)} tom={anotado ? "violeta" : "neutro"} />
      <span className="grid min-w-0 gap-0.5">
        {anotado ? <button type="button" className={classeTitulo} onClick={abrir}>{marcar(e.titulo, busca)}</button>
          : link ? <Link href={link} className={classeTitulo}>{marcar(e.titulo, busca)}</Link> : <span className="font-medium">{marcar(e.titulo, busca)}</span>}
        {apoio ? <span className="t-apoio line-clamp-2">{marcar(apoio, busca)}</span> : null}
        <span className="pt-1 md:hidden">{anotado ? <Selo tom="andamento">Anotado</Selo> : <Selo tom="neutro">{FONTE[e.fonte]}</Selo>}</span>
      </span>
      <span className="max-md:hidden">{anotado ? <Selo tom="andamento">Anotado</Selo> : <Selo tom="neutro">{FONTE[e.fonte]}</Selo>}</span>
      {anotado || link ? <Icone nome="dir" className="h-5 w-5 text-tinta-suave" /> : <span />}
    </li>
  );
}

function JanelaFiltrosLinha({ f, aoFechar, aplicar }: { f: FiltrosLinha; aoFechar: () => void; aplicar: (m: Partial<FiltrosLinha>) => void }) {
  const [filtro, setFiltro] = useState(f.filtro);
  const [de, setDe] = useState(f.de);
  const [ate, setAte] = useState(f.ate);
  const invertido = Boolean(de && ate && de > ate);
  return (
    <Dialogo aberto titulo="Filtros" apoio="Uma fonte por vez e, se quiser, um período. O que estiver em uso aparece ao lado do botão Filtros." fechar aoFechar={aoFechar}>
      <form onSubmit={(ev) => { ev.preventDefault(); if (!invertido) aplicar({ filtro, de, ate }); }} className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="mb-1 t-apoio font-medium text-tinta">Fonte</legend>
          {(Object.keys(FILTROS_LINHA_DO_TEMPO) as FiltroLinhaDoTempo[]).map((x) => (
            <label key={x} className="flex items-start gap-3 rounded-[14px] border border-linha px-3.5 py-3 has-[:checked]:border-violeta-600 has-[:checked]:bg-violeta-50">
              <input type="radio" name="lt-filtro" className="mt-1 h-4.5 w-4.5 accent-violeta-600" checked={filtro === x} onChange={() => setFiltro(x)} />
              <span className="grid"><span className="font-medium">{FILTROS_LINHA_DO_TEMPO[x]}</span><span className="t-apoio">{EXPLICA_FILTRO[x]}</span></span>
            </label>
          ))}
        </fieldset>
        <fieldset className="grid gap-2.5">
          <legend className="mb-1 t-apoio font-medium text-tinta">Período</legend>
          <div className="flex flex-wrap gap-2">
            {periodosLinha().map((p) => <Chip key={p.nome} ativo={p.de === de && p.ate === ate} onClick={() => { setDe(p.de); setAte(p.ate); }}>{p.nome}</Chip>)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CampoTexto id="lt-f-de" rotulo="De" type="date" icone="calendario" value={de} onChange={(e) => setDe(e.target.value)} />
            <CampoTexto id="lt-f-ate" rotulo="Até" type="date" icone="calendario" value={ate} onChange={(e) => setAte(e.target.value)}
              erro={invertido ? "O fim do período vem depois do começo" : null} />
          </div>
          <p className="t-apoio">Vale a data de cada linha.</p>
        </fieldset>
        <div className="flex flex-wrap justify-between gap-2">
          <Botao variante="discreto" onClick={() => aplicar({ filtro: "TUDO", de: "", ate: "" })}>Limpar</Botao>
          <Botao type="submit">Mostrar</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

type TipoLigacao = "" | "DOCUMENTO" | "PEDIDO" | "MANUTENCAO";

function FormAnotacao({ anotacao, aoFechar, aoSalvar }: { anotacao?: AnotacaoDetalhe["anotacao"]; aoFechar: () => void; aoSalvar: (t: string) => void }) {
  const opcoes = useCarregar<OpcoesMemoria>("/v1/condominio/memoria/opcoes");
  const [v, setV] = useState({
    tipo: (anotacao?.tipo ?? "COMBINADO") as TipoAnotacao, titulo: anotacao?.titulo ?? "", texto: anotacao?.texto ?? "",
    aconteceuEm: anotacao?.aconteceuEm ?? hojeEmBrasilia(),
  });
  const [ligacao, setLigacao] = useState<TipoLigacao>(anotacao?.ligacao?.tipo ?? "");
  const [alvo, setAlvo] = useState(anotacao?.ligacao?.id ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const corpo = {
      ...v, documentoId: ligacao === "DOCUMENTO" && alvo ? alvo : null, pedidoId: ligacao === "PEDIDO" && alvo ? alvo : null,
      manutencaoId: ligacao === "MANUTENCAO" && alvo ? alvo : null, ...(anotacao ? { versao: anotacao.versao } : {}),
    };
    const r = anotacao
      ? await chamarApi(`/v1/condominio/memoria/anotacoes/${anotacao.id}`, { metodo: "PUT", corpo })
      : await chamarApi("/v1/condominio/memoria/anotacoes", { corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoSalvar(anotacao ? "Anotação corrigida. A versão anterior ficou guardada." : "Anotado na memória do prédio.");
  }
  const o = opcoes.estado === "pronto" ? opcoes.dados : null;
  const alvos = ligacao === "DOCUMENTO" ? o?.documentos.map((d) => ({ valor: d.id, texto: d.titulo }))
    : ligacao === "PEDIDO" ? o?.pedidos.map((p) => ({ valor: p.id, texto: `${p.protocolo} · ${p.titulo}` }))
      : ligacao === "MANUTENCAO" ? o?.manutencoes.map((m) => ({ valor: m.id, texto: m.titulo })) : [];

  return (
    <Dialogo aberto media titulo={anotacao ? "Corrigir anotação" : "Anotar na memória"} apoio="O que o próximo síndico precisa saber" fechar aoFechar={aoFechar}>
      <form onSubmit={salvar} noValidate className="grid gap-3">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div role="group" aria-labelledby="an-tipo" className="grid gap-1">
          <span id="an-tipo" className="t-apoio font-medium">O que é</span>
          <span className="trilho flex-nowrap overflow-x-auto">
            {(Object.keys(TIPOS_ANOTACAO) as TipoAnotacao[]).map((t) => (
              <button key={t} type="button" className="chip shrink-0" aria-pressed={v.tipo === t} data-escolhido={v.tipo === t ? "" : undefined} onClick={() => setV({ ...v, tipo: t })}>
                <Icone nome={ICONE_TIPO[t]} />{TIPOS_ANOTACAO[t]}
              </button>
            ))}
          </span>
        </div>
        <CampoTexto id="an-titulo" rotulo="Título" required maxLength={120} value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })}
          placeholder="Vizinho do lote 12 divide a manutenção do muro" erro={comErro.includes("titulo") ? "De 3 a 120 caracteres." : null} />
        <div className="grid gap-3 md:grid-cols-2">
          <CampoTexto id="an-data" rotulo="Quando aconteceu" type="date" max={hojeEmBrasilia()} value={v.aconteceuEm}
            onChange={(e) => setV({ ...v, aconteceuEm: e.target.value })} erro={comErro.includes("aconteceuEm") ? "Escolha uma data até hoje." : null} />
          <CampoSelecao id="an-ligar" rotulo="Ligar a" opcional value={ligacao} onChange={(e) => { setLigacao(e.target.value as TipoLigacao); setAlvo(""); }}
            opcoes={[{ valor: "", texto: "Nada" }, { valor: "DOCUMENTO", texto: "Um documento" }, ...(o?.pedidos.length ? [{ valor: "PEDIDO", texto: "Um pedido" }] : []),
              ...(o?.manutencoes.length ? [{ valor: "MANUTENCAO", texto: "Uma manutenção" }] : [])]} />
        </div>
        {ligacao ? (
          <CampoSelecao id="an-alvo" rotulo={ligacao === "DOCUMENTO" ? "Documento" : ligacao === "PEDIDO" ? "Pedido" : "Manutenção"} value={alvo}
            onChange={(e) => setAlvo(e.target.value)} opcoes={[{ valor: "", texto: "Escolha" }, ...(alvos ?? [])]}
            erro={comErro.some((c) => c.endsWith("Id") || c === "ligacao") ? "Escolha uma opção da lista." : null} />
        ) : null}
        <CampoAreaTexto id="an-texto" rotulo="O que ficou registrado" rows={4} maxLength={4000} value={v.texto} onChange={(e) => setV({ ...v, texto: e.target.value })}
          placeholder="Cada lado paga metade da pintura e dos reparos do muro divisório." erro={comErro.includes("texto") ? "Conte o que aconteceu (de 3 a 4.000 caracteres)." : null} />
        <p className="t-apoio">Fica com o seu nome e a data de hoje. Corrigir depois guarda a versão anterior.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="check" />{enviando ? "Salvando…" : anotacao ? "Salvar correção" : "Anotar"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function AnotacaoAberta({ id, aoFechar, aoMudar }: { id: string; aoFechar: () => void; aoMudar: (t: string) => void }) {
  const carga = useCarregar<AnotacaoDetalhe>(`/v1/condominio/memoria/anotacoes/${id}`);
  const [modo, setModo] = useState<"ver" | "corrigir" | "tirar">("ver");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  if (carga.estado !== "pronto") {
    return <Dialogo aberto titulo="Anotação" aoFechar={aoFechar}>{carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : <Carregando />}</Dialogo>;
  }
  const { anotacao: a, versoes, podeEditar } = carga.dados;
  if (modo === "corrigir") return <FormAnotacao anotacao={a} aoFechar={() => setModo("ver")} aoSalvar={aoMudar} />;
  async function tirar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const r = await chamarApi(`/v1/condominio/memoria/anotacoes/${id}/retirar`, { corpo: { versao: a.versao, motivo } });
    if (!r.ok) return setErro(r.erro);
    aoMudar("A anotação saiu da linha do tempo. Ela continua guardada no histórico, com o motivo.");
  }
  return (
    <Dialogo aberto titulo={`${TIPOS_ANOTACAO[a.tipo as TipoAnotacao]}: ${a.titulo}`} aoFechar={aoFechar}>
      <div className="grid gap-3">
        {erro && !camposComErro(erro).length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <p className="t-texto whitespace-pre-line">{a.texto}</p>
        <p className="t-apoio text-tinta-suave">
          {[`Aconteceu em ${mostrarDataCurta(a.aconteceuEm)}`, a.autor ? `anotado por ${a.autor}` : null, ligacaoTexto(a.ligacao)].filter(Boolean).join(" · ")}
        </p>
        {modo === "tirar" ? (
          <form onSubmit={tirar} noValidate className="grid gap-3">
            <CampoAreaTexto id="an-motivo" rotulo="Por que tirar da linha do tempo" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              erro={camposComErro(erro).includes("motivo") ? "Explique o motivo (de 3 a 500 caracteres)." : null}
              ajuda="A anotação sai da linha do tempo, mas fica guardada no histórico. Nada se apaga." />
            <div className="flex flex-wrap justify-end gap-2">
              <Botao variante="contorno" onClick={() => setModo("ver")}>Voltar</Botao>
              <Botao type="submit" variante="perigo">Tirar da linha do tempo</Botao>
            </div>
          </form>
        ) : (
          <>
            {podeEditar ? (
              <span className="flex flex-wrap gap-2">
                <Botao variante="contorno" tamanho="m" onClick={() => setModo("corrigir")}><Icone nome="editar" />Corrigir</Botao>
                <Botao variante="discreto" tamanho="m" className="text-erro" onClick={() => setModo("tirar")}>Tirar da linha do tempo</Botao>
              </span>
            ) : null}
            {versoes.length ? (
              <section aria-labelledby="an-versoes" className="grid gap-2">
                <h3 id="an-versoes" className="font-medium">Versões anteriores</h3>
                <ol className="divide-y divide-linha rounded-xl border border-linha">
                  {versoes.map((x) => (
                    <li key={x.numero} className="grid gap-0.5 px-3 py-2 t-texto">
                      <span className="flex flex-wrap items-center gap-2"><Selo tom="neutro">Versão {x.numero}</Selo><span className="font-medium">{x.titulo}</span></span>
                      <span className="whitespace-pre-line">{x.texto}</span>
                      <span className="t-apoio text-tinta-suave">Escrita {x.autor ? `por ${x.autor} ` : ""}em {diaHora(x.escritaEm)} · trocada em {diaHora(x.substituidaEm)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            <div className="flex justify-end"><Botao variante="discreto" onClick={aoFechar}>Fechar</Botao></div>
          </>
        )}
      </div>
    </Dialogo>
  );
}
