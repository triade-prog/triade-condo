"use client";
// O mural do morador no conceito Janela acesa (D4.40; CD-12, CD-15, CD-16, CD-17, CD-18, AC-03,
// AC-05, MP-14). A mesma peça serve ao link do morador e à prévia no painel: no painel, cada
// item ganha embaixo a faixa "Só no painel", que o morador não vê. O que organiza a página é o
// tempo e o assunto: um só cartão "O que importa agora" (a assembleia convocada ou o próximo
// evento), as enquetes num cartão compacto, a linha dos avisos novos desde a última visita (só no
// aparelho, nunca no servidor), o feed em "Esta semana" e "Antes" com o assunto no lugar nobre de
// cada cartão, a vitrine dos classificados, o manual em lista e os documentos por e-mail. Nada de
// curtidas, comentários, nomes ou unidades.

import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import {
  agruparMural, AVISO_CLASSIFICADOS, contar, dataHumana, diaDaVisita, faltaParaOEvento, haQuanto, precoDoAnuncio, TIPOS_ANUNCIO,
  type TipoAnuncio,
} from "@triade/domain";
import { Abas, Botao, CampoTexto, chamarApi, Chip, classeBotao, Icone, Selo, textoDoErro } from "@triade/ui";
import { prazoCurto } from "../vida/Enquetes.tsx";
import type { AnuncioPublico, ComunicadoPublico, MuralPublico } from "../tipos.ts";
import { BlocoDeData, Cartao, ComunicadoLido, FaixaQueda, PorNaAgenda, SeloAssunto, SeloCancelada, useAbrirArquivo } from "./comum.tsx";

export type AbaMural = "avisos" | "classificados" | "manual";
export interface VistaMural { aba: AbaMural; comunicado?: string; anuncio?: string }

/** O que só o painel mostra, embaixo de cada coisa do mural. */
export interface FaixasDoPainel {
  aviso: (c: ComunicadoPublico) => ReactNode;
  enquete: (e: NonNullable<MuralPublico["enquetes"]>[number]) => ReactNode;
  anuncio: (a: AnuncioPublico) => ReactNode;
  documentos: ReactNode;
}

export interface LinksDoMural {
  /** A API que devolve o link curto de um arquivo do comunicado. */
  arquivo: (comunicado: string, arquivo: string) => string;
  /** A API que devolve o link curto da foto do anúncio. */
  fotoAnuncio: (anuncio: string) => string;
  /** O endereço do arquivo de calendário do aviso (CD-18), para o href do "Pôr na agenda". */
  agenda: (comunicado: string) => string;
  /** O endereço público de uma vista, para o href dos links. */
  publico: (v: VistaMural) => string;
}

/** A faixa tracejada "Só no painel", presa embaixo do cartão. */
export function FaixaPainel({ children }: { children: ReactNode }) {
  return (
    <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-b-2xl border border-t-0 border-dashed border-violeta-200 bg-violeta-50 px-3 py-2">
      <span className="t-apoio text-tinta-suave">Só no painel:</span>{children}
    </div>
  );
}

/** Compartilhar pelo celular; sem isso, copia o link. */
function useCompartilhar() {
  const [recado, setRecado] = useState<string | null>(null);
  async function compartilhar(titulo: string, caminho: string) {
    setRecado(null);
    const url = new URL(caminho, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title: titulo, url }); return; } catch { /* a pessoa desistiu ou o aparelho recusou: copia */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setRecado("Link copiado. Cole no WhatsApp ou onde quiser.");
    } catch {
      setRecado(`Copie o link: ${url}`);
    }
  }
  return { recado, compartilhar };
}

/** Carrega os links curtos das fotos quando o cartão chega perto da tela. */
function useFotos<T extends HTMLElement>(ids: string[], link: (id: string) => string) {
  const ref = useRef<T | null>(null);
  const [perto, setPerto] = useState(() => typeof IntersectionObserver !== "function");
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const chave = ids.join(",");
  useEffect(() => {
    const el = ref.current;
    if (!el || perto || !chave) return;
    const obs = new IntersectionObserver((xs) => { if (xs.some((x) => x.isIntersecting)) setPerto(true); }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [perto, chave]);
  useEffect(() => {
    if (!perto || !chave) return;
    let vivo = true;
    void Promise.all(chave.split(",").map(async (id) => {
      const r = await chamarApi<{ url: string }>(link(id));
      return r.ok ? ([id, r.dados.url] as const) : null;
    })).then((xs) => { if (vivo) setFotos((f) => ({ ...f, ...Object.fromEntries(xs.filter((x) => x !== null)) })); });
    return () => { vivo = false; };
    // O link muda a cada render no painel; as fotos dependem só dos ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perto, chave]);
  return { ref, fotos };
}

const CARTAO = "rounded-[18px] border border-linha bg-superficie shadow-s1";

/** O título de uma seção do feed ou da lateral, com a contagem à direita. */
function Titulo2({ id, icone, children, direita }: { id: string; icone?: "grafico" | "convivio" | "lista" | "email"; children: ReactNode; direita?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className={icone ? "flex items-center gap-2.5 t-titulo-cartao" : "t-titulo-secao font-medium tracking-[-.01em]"}>
        {icone ? <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom="violeta" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span> : null}
        {children}
      </h2>
      {direita ? <span className="t-apoio whitespace-nowrap text-tinta-suave">{direita}</span> : null}
    </div>
  );
}

function BotaoCompartilhar({ titulo, aoCompartilhar }: { titulo: string; aoCompartilhar: () => void }) {
  return (
    <Botao variante="discreto" tamanho="p" onClick={aoCompartilhar} aria-label={`Compartilhar: ${titulo}`} className="shrink-0">
      <Icone nome="compartilhar" />Compartilhar
    </Botao>
  );
}

/** A primeira foto do aviso, em 16:9; com mais fotos, o contador no canto e o resto ao abrir. */
function FotoDoAviso({ url, nome, total, lado }: { url?: string; nome: string; total: number; lado: boolean }) {
  return (
    <span className={`relative block overflow-hidden rounded-xl bg-gradient-to-br from-violeta-200 via-violeta-400 to-violeta-600 ${lado ? "aspect-video w-full lg:w-[236px] lg:shrink-0" : "aspect-video w-full"}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- link curto do armazenamento privado
        <img src={url} alt={nome} className="h-full w-full object-cover" />
      ) : <span className="grid h-full place-items-center t-apoio text-superficie">Carregando a foto…</span>}
      {total > 1 ? <span className="absolute top-2 right-2 rounded-full bg-tinta/75 px-2 py-0.5 t-apoio font-semibold text-superficie">{total} fotos</span> : null}
    </span>
  );
}

/** Clicar no cartão abre o aviso, menos quando o toque foi num link ou botão de dentro. */
function abrirPeloCartao(ev: MouseEvent<HTMLElement>, abrir: () => void) {
  const alvo = ev.target as HTMLElement;
  if (alvo.closest("a, button, input, label")) return;
  abrir();
}

function Postagem({ c, links, novo, agora, aoLer, aoCompartilhar, lado }: {
  c: ComunicadoPublico; links: LinksDoMural; novo: boolean; agora: Date; aoLer: () => void; aoCompartilhar: () => void;
  /** No computador, a foto fica à direita do texto. */
  lado: boolean;
}) {
  const imagens = c.arquivos.filter((a) => a.tipo.startsWith("image/"));
  const pdfs = c.arquivos.length - imagens.length;
  const { ref, fotos } = useFotos<HTMLElement>(imagens.slice(0, 1).map((a) => a.id), (id) => links.arquivo(c.id, id));
  const primeira = imagens[0];
  const href = links.publico({ aba: "avisos", comunicado: c.id });
  const ler = (ev: MouseEvent) => { ev.preventDefault(); aoLer(); };
  return (
    <article ref={ref} aria-labelledby={`p-${c.id}`} onClick={(ev) => abrirPeloCartao(ev, aoLer)}
      className={`grid cursor-pointer gap-2.5 p-4 ${CARTAO} hover:border-violeta-200 lg:px-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2"><SeloAssunto assunto={c.assunto} /><SeloCancelada c={c} /></span>
        <span className="flex items-center gap-2.5">
          {novo ? <span className="flex items-center gap-1.5 t-apoio font-bold text-laranja-800"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-laranja-500 ring-[3px] ring-laranja-100" />Novo</span> : null}
          <span className="font-mono t-codigo text-tinta-suave">{dataHumana(c.publicadoEm, agora)}</span>
        </span>
      </div>
      <div className={lado && primeira ? "grid gap-3 lg:grid-cols-[minmax(0,1fr)_236px]" : "grid gap-2.5"}>
        <div className="grid content-start gap-2">
          <h3 id={`p-${c.id}`} className="t-titulo-secao leading-[1.3]">
            <a href={href} onClick={ler} className="text-tinta hover:text-violeta-700">{c.titulo}</a>
          </h3>
          {primeira && !lado ? <FotoDoAviso url={fotos[primeira.id]} nome={primeira.nome} total={imagens.length} lado={false} /> : null}
          <p className="line-clamp-3 t-texto leading-normal text-tinta-suave">{c.texto}</p>
          {c.assinatura ? <p className="t-apoio text-tinta-suave">{c.assinatura}</p> : null}
          {c.numero > 1 && c.mudanca ? (
            <span className="inline-flex items-center gap-1.5 justify-self-start rounded-[10px] border border-violeta-200 bg-violeta-50 px-2.5 py-1.5 t-apoio text-violeta-700">
              <Icone nome="info" className="h-3.5 w-3.5 shrink-0" /><span><b className="font-semibold">Corrigido</b> · versão {c.numero}: {c.mudanca}</span>
            </span>
          ) : null}
          {c.evento ? <span className="justify-self-start"><BlocoDeData evento={c.evento} assembleia={c.assunto === "ASSEMBLEIA"} /></span> : null}
        </div>
        {primeira && lado ? <FotoDoAviso url={fotos[primeira.id]} nome={primeira.nome} total={imagens.length} lado /> : null}
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 border-t border-superficie-2 pt-2.5">
        <span className="flex min-w-0 items-center gap-3">
          <a href={href} onClick={ler} aria-label={`Ler o aviso: ${c.titulo}`} className="flex min-h-8 items-center gap-0.5 t-apoio font-semibold text-violeta-600 hover:underline">
            Ler o aviso<Icone nome="dir" className="h-3.5 w-3.5" />
          </a>
          {pdfs ? <span className="flex items-center gap-1 t-apoio text-tinta-suave"><Icone nome="documento" className="h-3.5 w-3.5" />{pdfs === 1 ? "1 PDF" : `${pdfs} PDFs`}</span> : null}
          <PorNaAgenda c={c} href={links.agenda(c.id)} tamanho="p" />
        </span>
        <BotaoCompartilhar titulo={c.titulo} aoCompartilhar={aoCompartilhar} />
      </div>
    </article>
  );
}

/** O que importa agora: um só, com o bloco de data em relevo (CD-17). */
function Destaque({ c, links, agora, aoLer, aoCompartilhar }: {
  c: ComunicadoPublico; links: LinksDoMural; agora: Date; aoLer: () => void; aoCompartilhar: () => void;
}) {
  const e = c.evento!;
  const b = (() => {
    const [, m, d] = e.dia.split("-");
    const semana = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][new Date(`${e.dia}T12:00:00Z`).getUTCDay()];
    const mes = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"][Number(m) - 1];
    return { dia: d ?? "", mes: mes ?? "", semana: semana ?? "" };
  })();
  const assembleia = c.assunto === "ASSEMBLEIA";
  const pdf = c.arquivos.find((a) => a.tipo === "application/pdf");
  const { falha, abrir } = useAbrirArquivo((arquivo) => links.arquivo(c.id, arquivo));
  const horas = e.inicio
    ? assembleia && e.fim
      ? <span><b className="font-semibold">{e.inicio}</b> primeira chamada · <b className="font-semibold">{e.fim}</b> segunda</span>
      : <span><b className="font-semibold">{e.inicio}</b>{e.fim ? <> às <b className="font-semibold">{e.fim}</b></> : null}</span>
    : null;
  return (
    <section aria-labelledby="t-agora" onClick={(ev) => abrirPeloCartao(ev, aoLer)}
      className="grid cursor-pointer gap-3 rounded-[20px] border border-violeta-200 bg-gradient-to-b from-superficie to-violeta-50 p-4 shadow-s2">
      <div className="flex items-center justify-between gap-3">
        <h2 id="t-agora" className="flex items-center gap-2.5 t-titulo-cartao">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-violeta-600 text-laranja-200" aria-hidden="true"><Icone nome="sino" className="h-4 w-4" /></span>
          O que importa agora
        </h2>
        <span className="t-apoio whitespace-nowrap text-tinta-suave">{faltaParaOEvento(e.dia, agora)}</span>
      </div>
      <div className="flex items-start gap-3.5">
        <span className="grid w-[72px] shrink-0 justify-items-center gap-0.5 rounded-[14px] bg-gradient-to-b from-violeta-600 to-violeta-800 py-2.5 text-white shadow-s1" aria-hidden="true">
          <span className="t-rotulo font-semibold text-violeta-200">{b.mes}</span>
          <span className="t-titulo-tela leading-[1.05] font-light tracking-[-.02em]">{b.dia}</span>
          <span className="t-apoio font-medium text-laranja-200">{b.semana}</span>
        </span>
        <div className="grid min-w-0 flex-1 gap-1.5">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <SeloAssunto assunto={c.assunto} />
            <span className="font-mono t-codigo text-tinta-suave">publicado {dataHumana(c.publicadoEm, agora).replace(/, \d\d:\d\d$/, "")}</span>
          </span>
          <h3 className="t-titulo-secao leading-[1.25]">
            <a href={links.publico({ aba: "avisos", comunicado: c.id })} onClick={(ev) => { ev.preventDefault(); aoLer(); }} className="text-tinta hover:text-violeta-700">{c.titulo}</a>
          </h3>
          <span className="sr-only">{b.semana}, {b.dia} de {b.mes.toLowerCase()}.</span>
          <span className="grid gap-0.5 t-texto">
            {horas ? <span className="flex items-center gap-1.5"><Icone nome="relogio" className="h-4 w-4 shrink-0 text-violeta-600" />{horas}</span> : null}
            {e.local ? <span className="flex items-center gap-1.5"><Icone nome="pin" className="h-4 w-4 shrink-0 text-violeta-600" />{e.local}</span> : null}
          </span>
        </div>
      </div>
      <p className="line-clamp-3 t-texto text-tinta-suave">{c.texto}</p>
      <div className="flex flex-wrap items-center gap-2">
        {pdf ? (
          <Botao variante="contorno" tamanho="m" onClick={() => void abrir(pdf.id)}><Icone nome="documento" />{assembleia ? "Ler o edital (PDF)" : "Abrir o PDF"}</Botao>
        ) : (
          <a href={links.publico({ aba: "avisos", comunicado: c.id })} onClick={(ev) => { ev.preventDefault(); aoLer(); }} aria-label={`Ler o aviso: ${c.titulo}`} className={classeBotao("contorno", "", "m")}>
            Ler o aviso
          </a>
        )}
        <PorNaAgenda c={c} href={links.agenda(c.id)} />
        <span className="ml-auto"><BotaoCompartilhar titulo={c.titulo} aoCompartilhar={aoCompartilhar} /></span>
      </div>
      {falha ? <p className="t-texto text-erro" role="alert">{falha}</p> : null}
    </section>
  );
}

/** As enquetes abertas num cartão compacto: responde-se pelo link pessoal (AC-03). */
function EnquetesAbertas({ enquetes, faixa }: { enquetes: NonNullable<MuralPublico["enquetes"]>; faixa?: FaixasDoPainel["enquete"] }) {
  return (
    <section aria-labelledby="t-enquetes" className={`grid gap-2.5 p-4 ${CARTAO}`}>
      <Titulo2 id="t-enquetes" icone="grafico" direita={contar(enquetes.length, "aberta", "abertas")}>Enquetes abertas</Titulo2>
      <ol className="grid" aria-label="Enquetes abertas">
        {enquetes.map((e, i) => (
          <li key={e.id} className={`grid gap-2 py-2.5 ${i ? "border-t border-linha" : ""}`}>
            <span className="flex items-start gap-3">
              <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-violeta-100 t-apoio font-bold text-violeta-700">{i + 1}</span>
              <span className="grid min-w-0 gap-0.5">
                <span className="t-texto font-semibold">{e.pergunta}</span>
                <span className="t-apoio text-tinta-suave">Aberta até {prazoCurto(e.abertaAte)} · {e.por === "UNIDADE" ? "uma por unidade" : "uma por pessoa"}</span>
              </span>
            </span>
            {faixa ? faixa(e) : null}
          </li>
        ))}
      </ol>
      <p className="rounded-xl bg-violeta-50 px-3 py-2.5 t-apoio leading-snug">
        Responda pelo <b className="font-semibold">link pessoal</b> que chegou pelo WhatsApp ou pelo e-mail. Não recebeu? Peça na portaria ou ao condomínio.
      </p>
    </section>
  );
}

/** A linha dos avisos novos desde a última visita (CD-16): a marca fica só no aparelho. */
function NovosDesde({ quantos, ultimaVisita }: { quantos: number; ultimaVisita: string }) {
  return (
    <p role="status" className="flex items-start gap-2.5 rounded-[14px] border border-dashed border-violeta-300 bg-superficie px-3.5 py-2.5">
      <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-laranja-500 ring-4 ring-laranja-100" />
      <span className="grid gap-0.5">
        <span className="t-texto leading-snug"><b className="font-semibold">{contar(quantos, "aviso novo", "avisos novos")}</b> desde a sua última visita, {diaDaVisita(ultimaVisita)}.</span>
        <span className="t-apoio text-tinta-suave">A marca fica só neste aparelho; ninguém sabe que você abriu.</span>
      </span>
    </p>
  );
}

/** Na vitrine, a foto fica dentro do link do anúncio, que já diz o título: ali ela não repete o nome. */
function FotoAnuncio({ a, links, classe, decorativa = false }: { a: AnuncioPublico; links: LinksDoMural; classe: string; decorativa?: boolean }) {
  const { ref, fotos } = useFotos<HTMLSpanElement>(a.foto ? [a.id] : [], () => links.fotoAnuncio(a.id));
  return (
    <span ref={ref} className={`relative block overflow-hidden bg-gradient-to-br from-violeta-50 to-violeta-100 ${classe}`}>
      {fotos[a.id] ? (
        // eslint-disable-next-line @next/next/no-img-element -- link assinado de 5 min do armazenamento privado
        <img src={fotos[a.id]} alt={decorativa ? "" : `Foto do anúncio ${a.titulo}`} className="h-full w-full object-cover" />
      ) : <span className="grid h-full place-items-center text-violeta-600" aria-hidden="true"><Icone nome={a.foto ? "camera" : "estrela"} className="h-10 w-10" /></span>}
    </span>
  );
}

const quemDoAnuncio = (a: AnuncioPublico) => [a.quem, a.bloco].filter(Boolean).join(" · ");
const ateCurto = (a: AnuncioPublico) => `${a.ate.slice(8, 10)}/${a.ate.slice(5, 7)}`;

function CartaoAnuncio({ a, links, abrir }: { a: AnuncioPublico; links: LinksDoMural; abrir: (id: string) => void }) {
  return (
    <a href={links.publico({ aba: "classificados", anuncio: a.id })} onClick={(e) => { e.preventDefault(); abrir(a.id); }}
      className="grid content-start overflow-hidden rounded-2xl border border-linha bg-superficie text-tinta hover:border-violeta-200">
      <span className="relative block">
        <FotoAnuncio a={a} links={links} classe="aspect-square" decorativa />
        {/* Sem valor, a linha grande já diz o tipo: o leitor de tela não ouve duas vezes. */}
        <span aria-hidden={precoDoAnuncio(a) === TIPOS_ANUNCIO[a.tipo] ? true : undefined}
          className="absolute top-2 left-2 rounded-full bg-superficie/90 px-2 py-0.5 t-apoio font-semibold">{TIPOS_ANUNCIO[a.tipo]}</span>
      </span>
      <span className="grid gap-0.5 px-3 pt-2.5 pb-3">
        <span className="t-titulo-cartao font-bold">{precoDoAnuncio(a)}</span>
        <span className="line-clamp-2 t-texto leading-snug">{a.titulo}</span>
        <span className="t-apoio text-tinta-suave">{[quemDoAnuncio(a), a.desde ? haQuanto(a.desde) : `até ${ateCurto(a)}`].filter(Boolean).join(" · ")}</span>
      </span>
    </a>
  );
}

function Vitrine({ anuncios, links, abrir, faixa }: {
  anuncios: AnuncioPublico[]; links: LinksDoMural; abrir: (id: string) => void; faixa?: (a: AnuncioPublico) => ReactNode;
}) {
  const [tipo, setTipo] = useState<TipoAnuncio | "">("");
  const tipos = (Object.keys(TIPOS_ANUNCIO) as TipoAnuncio[]).filter((t) => anuncios.some((a) => a.tipo === t));
  const lista = tipo ? anuncios.filter((a) => a.tipo === tipo) : anuncios;
  return (
    <div className="@container grid gap-3">
      {tipos.length > 1 ? (
        <span className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Tipo de anúncio">
          <Chip ativo={!tipo} onClick={() => setTipo("")}>Todos</Chip>
          {tipos.map((t) => <Chip key={t} ativo={tipo === t} onClick={() => setTipo(t)}>{TIPOS_ANUNCIO[t]}</Chip>)}
        </span>
      ) : null}
      <ul className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @2xl:grid-cols-4" aria-label="Classificados entre moradores">
        {lista.map((a) => (
          <li key={a.id} className="grid content-start">
            <CartaoAnuncio a={a} links={links} abrir={abrir} />
            {faixa ? <div className="mt-3">{faixa(a)}</div> : null}
          </li>
        ))}
      </ul>
      <p className="t-apoio text-tinta-suave">{AVISO_CLASSIFICADOS}</p>
    </div>
  );
}

/** Os dois anúncios mais novos, na aba Avisos, com o caminho para a vitrine inteira. */
function VitrinePrevia({ anuncios, links, abrir, verTodos }: { anuncios: AnuncioPublico[]; links: LinksDoMural; abrir: (id: string) => void; verTodos: () => void }) {
  return (
    <section aria-labelledby="t-classificados" className={`grid gap-2.5 p-4 ${CARTAO}`}>
      <Titulo2 id="t-classificados" icone="convivio" direita={contar(anuncios.length, "anúncio", "anúncios")}>Classificados entre moradores</Titulo2>
      <ul className="grid grid-cols-2 gap-2.5" aria-label="Últimos anúncios">
        {anuncios.slice(0, 2).map((a) => <li key={a.id} className="grid content-start"><CartaoAnuncio a={a} links={links} abrir={abrir} /></li>)}
      </ul>
      <Botao variante="contorno" tamanho="m" className="justify-self-start" onClick={verTodos}>Ver {anuncios.length === 1 ? "o anúncio" : `os ${anuncios.length} anúncios`}</Botao>
      <p className="t-apoio leading-snug text-tinta-suave">{AVISO_CLASSIFICADOS}</p>
    </section>
  );
}

function PaginaAnuncio({ a, links, voltar, aoCompartilhar }: { a: AnuncioPublico; links: LinksDoMural; voltar: () => void; aoCompartilhar: () => void }) {
  return (
    <article aria-labelledby={`an-${a.id}`} className={`grid overflow-hidden rounded-[20px] ${CARTAO}`}>
      <button type="button" onClick={voltar} className="elo flex gap-1.5 justify-self-start px-4 py-3 t-texto">
        <Icone nome="esq" className="h-4 w-4" />Voltar aos classificados
      </button>
      <FotoAnuncio a={a} links={links} classe="aspect-[4/3]" />
      <div className="grid gap-2 p-4">
        <span className="justify-self-start"><Selo tom="neutro">{TIPOS_ANUNCIO[a.tipo]}</Selo></span>
        <span className="t-titulo-ficha leading-tight font-bold">{precoDoAnuncio(a)}</span>
        <h2 id={`an-${a.id}`} className="t-titulo-secao font-semibold">{a.titulo}</h2>
        <p className="t-texto whitespace-pre-line">{a.texto}</p>
        <p className="border-y border-linha py-3 t-texto">
          {quemDoAnuncio(a) ? <span className="block font-medium">{quemDoAnuncio(a)}</span> : null}
          <span className="text-tinta-suave">{a.desde ? `No mural ${haQuanto(a.desde)} · ` : ""}fica até {ateCurto(a)}</span>
        </p>
        {a.whatsapp ? (
          <a href={`https://wa.me/${a.whatsapp}`} target="_blank" rel="noopener noreferrer" className={classeBotao("primario", "w-full")}>
            <Icone nome="whats" />Chamar no WhatsApp
          </a>
        ) : <p className="t-texto">Contato pelo condomínio.</p>}
        <Botao variante="contorno" className="w-full" onClick={aoCompartilhar}><Icone nome="compartilhar" />Compartilhar</Botao>
        <p className="t-apoio text-tinta-suave">{AVISO_CLASSIFICADOS} Combine direto com quem anunciou e não pague adiantado a quem você não conhece.</p>
      </div>
    </article>
  );
}

/** O manual do prédio: na aba Avisos, a lista das seções; na aba Manual, o texto de cada uma (MP-14). */
function ManualLista({ manual, href, abrir }: { manual: NonNullable<MuralPublico["manual"]>; href: string; abrir: () => void }) {
  return (
    <section aria-labelledby="t-manual" className={`grid gap-2 p-4 ${CARTAO}`}>
      <Titulo2 id="t-manual" icone="lista" direita={contar(manual.length, "seção", "seções")}>Manual do prédio</Titulo2>
      <ul className="grid" aria-label="Seções do manual">
        {manual.map((s, i) => (
          <li key={s.id} className={i ? "border-t border-superficie-2" : ""}>
            <a href={href} onClick={(e) => { e.preventDefault(); abrir(); }} className="flex min-h-11 w-full items-center gap-2.5 py-1 t-texto text-tinta hover:text-violeta-700">
              <span className="flex-1">{s.titulo}</span><Icone nome="dir" className="h-4 w-4 shrink-0 text-contorno" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Documentos({ documentos, pedir, faixa }: { documentos: NonNullable<MuralPublico["documentos"]>; pedir?: () => void; faixa?: ReactNode }) {
  return (
    <div className="grid gap-3">
      <section aria-labelledby="t-documentos" className={`grid gap-2.5 p-4 ${CARTAO}`}>
        <Titulo2 id="t-documentos" icone="email">Documentos do prédio</Titulo2>
        <p className="t-texto text-tinta-suave">Peça e receba no seu e-mail, por um link que vale 7 dias. Vai a versão em vigor.</p>
        <span className="flex flex-wrap gap-1.5">
          {documentos.map((d) => <span key={d.id} className="inline-flex min-h-[30px] items-center gap-1.5 rounded-[10px] border border-linha bg-superficie px-2.5 t-apoio"><Icone nome="documento" className="h-3.5 w-3.5 text-violeta-600" />{d.titulo}</span>)}
        </span>
        <Botao variante="contorno" tamanho="m" className="justify-self-start" disabled={!pedir} onClick={pedir}>Pedir por e-mail</Botao>
      </section>
      {faixa ?? null}
    </div>
  );
}

function PedirDocumento({ codigo, documentos }: { codigo: string; documentos: NonNullable<MuralPublico["documentos"]> }) {
  const [documentoId, setDocumentoId] = useState(documentos[0]!.id);
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"livre" | "enviando" | "feito">("livre");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEstado("enviando");
    const r = await chamarApi(`/v1/publico/mural/${encodeURIComponent(codigo)}/documentos`, { corpo: { documentoId, email } });
    if (r.ok) return setEstado("feito");
    setEstado("livre");
    setErro(r.erro.codigo === "VALIDATION_ERROR" ? "Confira o e-mail: precisa do @ e do domínio." : textoDoErro(r.erro));
  }

  if (estado === "feito") {
    return (
      <Cartao>
        <h2 className="font-medium">Pedido recebido</h2>
        <p className="t-texto">Se este e-mail estiver cadastrado no condomínio, o documento chega em instantes. Se não estiver, a síndica vai olhar o pedido. O link do documento vale 7 dias.</p>
      </Cartao>
    );
  }
  return (
    <Cartao>
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <h2 className="font-medium">Pedir documento por e-mail</h2>
        <fieldset className="grid gap-1">
          <legend className="mb-1 t-apoio font-medium">Documento</legend>
          <span className="flex flex-wrap gap-2">
            {documentos.map((d) => <Chip key={d.id} ativo={documentoId === d.id} onClick={() => setDocumentoId(d.id)}>{d.titulo}</Chip>)}
          </span>
        </fieldset>
        <CampoTexto id="pd-email" rotulo="Seu e-mail" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} erro={erro} />
        <Botao type="submit" className="justify-self-start" disabled={estado === "enviando" || !email.trim()}>{estado === "enviando" ? "Pedindo…" : "Pedir"}</Botao>
      </form>
    </Cartao>
  );
}

/** O vazio do mural, com os anéis leves da marca. */
function SemAvisos() {
  return (
    <section className={`relative grid gap-1 overflow-hidden p-5 ${CARTAO}`} aria-label="Nenhum aviso agora">
      <span aria-hidden="true" className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full border border-violeta-200" />
      <span aria-hidden="true" className="pointer-events-none absolute -top-28 -right-28 h-64 w-64 rounded-full border border-violeta-100" />
      <h2 className="t-titulo-cartao">Nenhum aviso agora</h2>
      <p className="t-apoio text-tinta-suave">Quando o condomínio publicar um aviso para todos, ele aparece aqui.</p>
    </section>
  );
}

/**
 * O conteúdo do mural, sem a faixa: as abas, o destaque, o feed, a vitrine, o manual e o pedido
 * de documento. Quem chama guarda a vista (no link, no endereço; no painel, na própria tela) e
 * diz quais avisos são novos para este aparelho (só no link).
 */
export function MuralConteudo({ m, codigo, vista, ir, links, painel, novos, ultimaVisita, agora = new Date() }: {
  m: MuralPublico; codigo: string; vista: VistaMural; ir: (v: VistaMural) => void; links: LinksDoMural; painel?: FaixasDoPainel;
  /** Os ids publicados depois da última visita guardada no aparelho (CD-16). */
  novos?: Set<string>;
  ultimaVisita?: string | null;
  agora?: Date;
}) {
  const [pedir, setPedir] = useState(false);
  const { recado, compartilhar } = useCompartilhar();
  const comunicado = vista.comunicado ? m.comunicados?.find((c) => c.id === vista.comunicado) : undefined;
  const anuncio = vista.anuncio ? m.classificados?.find((a) => a.id === vista.anuncio) : undefined;
  const temClassificados = !!m.classificados?.length;
  const temManual = !!m.manual?.length;
  const aba: AbaMural = vista.aba === "classificados" && temClassificados ? "classificados" : vista.aba === "manual" && temManual ? "manual" : "avisos";
  const avisoRecado = recado ? <p role="status" className="t-apoio text-tinta-suave">{recado}</p> : null;
  const compartilharAviso = (c: ComunicadoPublico) => void compartilhar(c.titulo, links.publico({ aba: "avisos", comunicado: c.id }));

  if (comunicado) {
    return (
      <>
        <button type="button" onClick={() => ir({ aba: "avisos" })} className="elo justify-self-start t-texto">
          <Icone nome="esq" className="h-4 w-4" />Voltar ao mural
        </button>
        <div className="mx-auto grid w-full max-w-2xl gap-3">
          <ComunicadoLido c={comunicado} linkArquivo={(arquivo) => links.arquivo(comunicado.id, arquivo)} agenda={links.agenda(comunicado.id)} />
          {painel ? painel.aviso(comunicado) : null}
        </div>
      </>
    );
  }
  if (anuncio) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-3">
        <PaginaAnuncio a={anuncio} links={links} voltar={() => ir({ aba: "classificados" })}
          aoCompartilhar={() => void compartilhar(anuncio.titulo, links.publico({ aba: "classificados", anuncio: anuncio.id }))} />
        {avisoRecado}
        {painel ? painel.anuncio(anuncio) : null}
      </div>
    );
  }
  if (pedir && m.documentos?.length && !painel) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-3">
        <button type="button" onClick={() => setPedir(false)} className="elo justify-self-start t-texto"><Icone nome="esq" className="h-4 w-4" />Voltar ao mural</button>
        <PedirDocumento codigo={codigo} documentos={m.documentos} />
      </div>
    );
  }

  const abas = [
    { id: "avisos" as const, texto: "Avisos", contagem: m.comunicados?.length ?? 0 },
    ...(temClassificados ? [{ id: "classificados" as const, texto: "Classificados", contagem: m.classificados!.length }] : []),
    ...(temManual ? [{ id: "manual" as const, texto: "Manual do prédio", contagem: m.manual!.length }] : []),
  ];
  const trilho = abas.length > 1 ? (
    <div className={`${painel ? "" : "lg:rounded-2xl lg:border lg:border-linha lg:bg-superficie lg:px-5 lg:shadow-s1"} flex flex-wrap items-center justify-between gap-x-6`}>
      <Abas abas={abas} atual={aba} aoMudar={(id) => ir({ aba: id })} rotulo="Partes do mural">{null}</Abas>
      {!painel ? <span className="hidden items-center gap-2 t-apoio text-tinta-suave lg:flex"><Icone nome="olho" className="h-4 w-4" />Página pública do condomínio · sem nomes, telefones ou unidades</span> : null}
    </div>
  ) : null;

  if (aba === "classificados") {
    return (
      <>
        {trilho}
        <FaixaQueda canal={m.canalAlternativo} />
        <Vitrine anuncios={m.classificados!} links={links} abrir={(id) => ir({ aba: "classificados", anuncio: id })} faixa={painel?.anuncio} />
        {avisoRecado}
      </>
    );
  }
  if (aba === "manual") {
    return (
      <>
        {trilho}
        <ul className="mx-auto grid w-full max-w-2xl gap-3" aria-label="Manual do prédio">
          {m.manual!.map((s) => (
            <li key={s.id}>
              <Cartao>
                <h2 className="t-texto font-medium">{s.titulo}</h2>
                <p className="t-texto whitespace-pre-line">{s.texto}</p>
              </Cartao>
            </li>
          ))}
        </ul>
      </>
    );
  }

  const grupos = agruparMural(m.comunicados ?? [], agora);
  const quantosNovos = novos?.size ?? 0;
  const lado = !painel;
  const feed = (titulo: string, id: string, lista: ComunicadoPublico[]) => lista.length ? (
    <section aria-labelledby={id} className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3 px-0.5 pt-1">
        <h2 id={id} className="t-titulo-secao font-medium tracking-[-.01em]">{titulo}</h2>
        <span className="t-apoio text-tinta-suave">{contar(lista.length, "aviso", "avisos")}</span>
      </div>
      <ul className="grid gap-3" aria-label={titulo}>
        {lista.map((c) => (
          <li key={c.id} className="grid gap-3">
            <Postagem c={c} links={links} novo={!!novos?.has(c.id)} agora={agora} lado={lado}
              aoLer={() => ir({ aba: "avisos", comunicado: c.id })} aoCompartilhar={() => compartilharAviso(c)} />
            {painel ? painel.aviso(c) : null}
          </li>
        ))}
      </ul>
    </section>
  ) : null;
  const lateral = (
    <>
      {temClassificados ? <VitrinePrevia anuncios={m.classificados!} links={links} abrir={(id) => ir({ aba: "classificados", anuncio: id })} verTodos={() => ir({ aba: "classificados" })} /> : null}
      {temManual ? <ManualLista manual={m.manual!} href={links.publico({ aba: "manual" })} abrir={() => ir({ aba: "manual" })} /> : null}
      {m.documentos?.length ? <Documentos documentos={m.documentos} pedir={painel ? undefined : () => setPedir(true)} faixa={painel?.documentos} /> : null}
    </>
  );

  return (
    <>
      {trilho}
      <FaixaQueda canal={m.canalAlternativo} />
      <div className={lado ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6" : "grid gap-4"}>
        <div className="grid min-w-0 gap-3.5">
          {grupos.destaque ? (
            <div className="grid gap-3">
              <Destaque c={grupos.destaque} links={links} agora={agora}
                aoLer={() => ir({ aba: "avisos", comunicado: grupos.destaque!.id })} aoCompartilhar={() => compartilharAviso(grupos.destaque!)} />
              {painel ? painel.aviso(grupos.destaque) : null}
            </div>
          ) : null}
          {m.enquetes?.length ? <EnquetesAbertas enquetes={m.enquetes} faixa={painel?.enquete} /> : null}
          {quantosNovos && ultimaVisita ? <NovosDesde quantos={quantosNovos} ultimaVisita={ultimaVisita} /> : null}
          {feed("Esta semana", "t-semana", grupos.estaSemana)}
          {feed("Antes", "t-antes", grupos.antes)}
          {!m.comunicados?.length ? <SemAvisos /> : null}
          {avisoRecado}
        </div>
        <div className="grid gap-3.5 lg:sticky lg:top-4">{lateral}</div>
      </div>
    </>
  );
}
