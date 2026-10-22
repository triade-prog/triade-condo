"use client";
// O mural em feed e os classificados em vitrine (CD-15; CD-12, AC-05; canvas do novo frontend,
// quadros 72 a 79). A mesma peça serve ao link do morador e à prévia no painel: no painel, cada
// aviso ganha embaixo a faixa "Só no painel", que o morador não vê. Um cartão por aviso, com a
// foto grande e as outras para passar com o dedo; a enquete aberta fica fixada no alto; nada de
// curtidas, comentários nem nomes. Os anúncios ficam numa grade com foto, preço e há quanto
// tempo estão no mural, e cada um abre a sua página com o botão do WhatsApp.

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ASSUNTOS_COMUNICADO, AVISO_CLASSIFICADOS, haQuanto, precoDoAnuncio, TIPOS_ANUNCIO, type AssuntoComunicado, type TipoAnuncio } from "@triade/domain";
import { Botao, CampoTexto, chamarApi, Chip, classeBotao, Icone, Selo, textoDoErro } from "@triade/ui";
import { diaHora } from "../pedidos/comum.tsx";
import { prazoCurto } from "../vida/Enquetes.tsx";
import type { AnuncioPublico, ComunicadoPublico, MuralPublico } from "../tipos.ts";
import { Cartao, ComunicadoLido, FaixaQueda, ReceberPeloWhatsapp } from "./comum.tsx";

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
  /** O caminho público (o do link do mural, com o aviso ou o anúncio), para abrir e compartilhar. */
  publico: (vista: VistaMural) => string;
}

/** A faixa "Só no painel": tracejada, colada embaixo do que ela comenta. */
export function FaixaPainel({ children }: { children: ReactNode }) {
  return (
    <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-b-2xl border border-t-0 border-dashed border-violeta-200 bg-violeta-50 px-3 py-2">
      <span className="text-xs text-tinta-suave">Só no painel:</span>{children}
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

function Remetente({ nome, sub, direita }: { nome: string; sub: string; direita?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-3 pb-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violeta-700 text-laranja-200" aria-hidden="true"><Icone nome="megafone" className="h-[18px] w-[18px]" /></span>
      <span className="grid min-w-0 flex-1">
        <span className="text-sm font-semibold">{nome}</span>
        <span className="text-xs text-tinta-suave">{sub}</span>
      </span>
      {direita}
    </div>
  );
}

function BotaoCompartilhar({ titulo, aoCompartilhar }: { titulo: string; aoCompartilhar: () => void }) {
  return (
    <button type="button" onClick={aoCompartilhar} aria-label={`Compartilhar: ${titulo}`}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-tinta hover:bg-violeta-50">
      <Icone nome="compartilhar" />
    </button>
  );
}

/** As fotos do aviso, uma por vez, passando com o dedo; "1/2" no canto quando há mais de uma. */
function Fotos({ fotos, nomes, titulo }: { fotos: (string | undefined)[]; nomes: string[]; titulo: string }) {
  const [atual, setAtual] = useState(0);
  const total = fotos.length;
  return (
    <div className="relative">
      <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]" aria-label={total > 1 ? `Fotos de ${titulo}` : undefined} role={total > 1 ? "group" : undefined}
        onScroll={(e) => { const el = e.currentTarget; setAtual(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}>
        {fotos.map((url, i) => (
          <div key={i} className="aspect-[4/3] w-full shrink-0 snap-center bg-violeta-50">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- link curto do armazenamento privado
              <img src={url} alt={nomes[i] ?? `Foto ${i + 1}`} className="h-full w-full object-cover" />
            ) : <span className="grid h-full place-items-center text-[13px] text-tinta-suave">Carregando a foto…</span>}
          </div>
        ))}
      </div>
      {total > 1 ? (
        <>
          <span className="absolute top-3 right-3 rounded-full bg-tinta/75 px-2.5 py-0.5 text-xs font-semibold text-superficie" aria-hidden="true">{atual + 1}/{total}</span>
          <span className="flex justify-center gap-1.5 pt-2.5" aria-hidden="true">
            {fotos.map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === atual ? "bg-violeta-600" : "bg-linha"}`} />)}
          </span>
        </>
      ) : null}
    </div>
  );
}

function Postagem({ c, condominio, links, aoLer, aoCompartilhar }: {
  c: ComunicadoPublico; condominio: string; links: LinksDoMural; aoLer: () => void; aoCompartilhar: () => void;
}) {
  const imagens = c.arquivos.filter((a) => a.tipo.startsWith("image/"));
  const outros = c.arquivos.length - imagens.length;
  const { ref, fotos } = useFotos<HTMLElement>(imagens.map((a) => a.id), (id) => links.arquivo(c.id, id));
  const assunto = ASSUNTOS_COMUNICADO[c.assunto as AssuntoComunicado] ?? "Comunicado";
  return (
    <article ref={ref} aria-labelledby={`p-${c.id}`} className="grid overflow-hidden rounded-[20px] border border-linha bg-superficie shadow-s1">
      <Remetente nome={condominio} sub={`${assunto} · ${diaHora(c.publicadoEm)}`}
        direita={<>{c.numero > 1 ? <Selo tom="andamento">Corrigido</Selo> : null}<BotaoCompartilhar titulo={c.titulo} aoCompartilhar={aoCompartilhar} /></>} />
      {imagens.length ? <Fotos fotos={imagens.map((a) => fotos[a.id])} nomes={imagens.map((a) => a.nome)} titulo={c.titulo} /> : null}
      <div className="grid gap-1.5 px-4 pt-2 pb-4">
        <h2 id={`p-${c.id}`} className="text-[17px] font-semibold">{c.titulo}</h2>
        <p className="line-clamp-3 text-sm text-tinta-suave">{c.texto}</p>
        <p className="text-[13px] text-tinta-suave">
          {outros ? `${outros === 1 ? "1 arquivo" : `${outros} arquivos`} · ` : ""}
          <a href={links.publico({ aba: "avisos", comunicado: c.id })} onClick={(e) => { e.preventDefault(); aoLer(); }}
            className="font-medium text-violeta-600 hover:underline">Ler tudo<span className="sr-only">: {c.titulo}</span></a>
        </p>
      </div>
    </article>
  );
}

function EnqueteFixada({ e, condominio }: { e: NonNullable<MuralPublico["enquetes"]>[number]; condominio: string }) {
  return (
    <article aria-labelledby={`e-${e.id}`} className="grid overflow-hidden rounded-[20px] border border-violeta-200 bg-gradient-to-b from-superficie to-violeta-50">
      <Remetente nome={condominio} sub={`Enquete · aberta até ${prazoCurto(e.abertaAte)}`}
        direita={<span className="flex items-center gap-1 text-xs font-semibold text-violeta-600"><Icone nome="pin" className="h-3.5 w-3.5" />Fixada</span>} />
      <div className="grid gap-2 px-4 pb-4">
        <h2 id={`e-${e.id}`} className="text-[17px] font-semibold">{e.pergunta}</h2>
        <ul className="list-disc pl-5 text-sm" aria-label="Opções">{e.opcoes.map((o) => <li key={o}>{o}</li>)}</ul>
        <p className="text-[13px] text-tinta-suave">
          Responda pelo link pessoal que chegou pelo WhatsApp ou pelo e-mail, {e.por === "UNIDADE" ? "um por unidade" : "um por pessoa"}. Não recebeu? Peça ao condomínio.
        </p>
      </div>
    </article>
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
            <a href={links.publico({ aba: "classificados", anuncio: a.id })} onClick={(e) => { e.preventDefault(); abrir(a.id); }}
              className="grid content-start overflow-hidden rounded-2xl border border-linha bg-superficie text-tinta hover:border-violeta-200">
              <span className="relative block">
                <FotoAnuncio a={a} links={links} classe="aspect-square" decorativa />
                {/* Sem valor, a linha grande já diz o tipo: o leitor de tela não ouve duas vezes. */}
                <span aria-hidden={precoDoAnuncio(a) === TIPOS_ANUNCIO[a.tipo] ? true : undefined}
                  className="absolute top-2 left-2 rounded-full bg-superficie/90 px-2 py-0.5 text-[11px] font-semibold">{TIPOS_ANUNCIO[a.tipo]}</span>
              </span>
              <span className="grid gap-0.5 px-3 pt-2.5 pb-3">
                <span className="text-base font-bold">{precoDoAnuncio(a)}</span>
                <span className="line-clamp-2 text-sm leading-snug">{a.titulo}</span>
                <span className="text-xs text-tinta-suave">{[quemDoAnuncio(a), a.desde ? haQuanto(a.desde) : `até ${ateCurto(a)}`].filter(Boolean).join(" · ")}</span>
              </span>
            </a>
            {faixa ? <div className="mt-3">{faixa(a)}</div> : null}
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-tinta-suave">{AVISO_CLASSIFICADOS}</p>
    </div>
  );
}

function PaginaAnuncio({ a, links, voltar, aoCompartilhar }: { a: AnuncioPublico; links: LinksDoMural; voltar: () => void; aoCompartilhar: () => void }) {
  return (
    <article aria-labelledby={`an-${a.id}`} className="grid overflow-hidden rounded-[20px] border border-linha bg-superficie shadow-s1">
      <button type="button" onClick={voltar} className="flex items-center gap-1.5 justify-self-start px-4 py-3 text-sm font-medium text-violeta-600 hover:underline">
        <Icone nome="esq" className="h-4 w-4" />Voltar aos classificados
      </button>
      <FotoAnuncio a={a} links={links} classe="aspect-[4/3]" />
      <div className="grid gap-2 p-4">
        <span className="justify-self-start"><Selo tom="neutro">{TIPOS_ANUNCIO[a.tipo]}</Selo></span>
        <span className="text-[26px] leading-tight font-bold">{precoDoAnuncio(a)}</span>
        <h2 id={`an-${a.id}`} className="text-xl font-semibold">{a.titulo}</h2>
        <p className="text-[15px] whitespace-pre-line">{a.texto}</p>
        <p className="border-y border-linha py-3 text-sm">
          {quemDoAnuncio(a) ? <span className="block font-medium">{quemDoAnuncio(a)}</span> : null}
          <span className="text-tinta-suave">{a.desde ? `No mural ${haQuanto(a.desde)} · ` : ""}fica até {ateCurto(a)}</span>
        </p>
        {a.whatsapp ? (
          <a href={`https://wa.me/${a.whatsapp}`} target="_blank" rel="noopener noreferrer" className={classeBotao("primario", "w-full")}>
            <Icone nome="whats" />Chamar no WhatsApp
          </a>
        ) : <p className="text-sm">Contato pelo condomínio.</p>}
        <Botao variante="contorno" className="w-full" onClick={aoCompartilhar}><Icone nome="compartilhar" />Compartilhar</Botao>
        <p className="text-[13px] text-tinta-suave">{AVISO_CLASSIFICADOS} Combine direto com quem anunciou e não pague adiantado a quem você não conhece.</p>
      </div>
    </article>
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
        <p className="text-sm">Se este e-mail estiver cadastrado no condomínio, o documento chega em instantes. Se não estiver, a síndica vai olhar o pedido. O link do documento vale 7 dias.</p>
      </Cartao>
    );
  }
  return (
    <Cartao>
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <h2 className="font-medium">Pedir documento por e-mail</h2>
        <fieldset className="grid gap-1">
          <legend className="mb-1 text-[13px] font-medium">Documento</legend>
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

/**
 * O conteúdo do mural, sem a moldura: as abas, o feed, a vitrine, o manual e o pedido de
 * documento. Quem chama guarda a vista (no link, no endereço; no painel, na própria tela).
 */
export function MuralConteudo({ m, codigo, vista, ir, links, painel }: {
  m: MuralPublico; codigo: string; vista: VistaMural; ir: (v: VistaMural) => void; links: LinksDoMural; painel?: FaixasDoPainel;
}) {
  const [pedir, setPedir] = useState(false);
  const { recado, compartilhar } = useCompartilhar();
  const comunicado = vista.comunicado ? m.comunicados?.find((c) => c.id === vista.comunicado) : undefined;
  const anuncio = vista.anuncio ? m.classificados?.find((a) => a.id === vista.anuncio) : undefined;
  const temClassificados = !!m.classificados?.length;
  const temManual = !!m.manual?.length;
  const aba: AbaMural = vista.aba === "classificados" && temClassificados ? "classificados" : vista.aba === "manual" && temManual ? "manual" : "avisos";
  const avisoRecado = recado ? <p role="status" className="text-[13px] text-tinta-suave">{recado}</p> : null;

  if (comunicado) {
    return (
      <>
        <button type="button" onClick={() => ir({ aba: "avisos" })} className="justify-self-start text-sm font-medium text-violeta-600 hover:underline">Voltar ao mural</button>
        <ComunicadoLido c={comunicado} linkArquivo={(arquivo) => links.arquivo(comunicado.id, arquivo)} />
        {painel ? painel.aviso(comunicado) : null}
      </>
    );
  }
  if (anuncio) {
    return (
      <>
        <PaginaAnuncio a={anuncio} links={links} voltar={() => ir({ aba: "classificados" })}
          aoCompartilhar={() => void compartilhar(anuncio.titulo, links.publico({ aba: "classificados", anuncio: anuncio.id }))} />
        {avisoRecado}
        {painel ? painel.anuncio(anuncio) : null}
      </>
    );
  }
  if (pedir && m.documentos?.length && !painel) {
    return (
      <>
        <button type="button" onClick={() => setPedir(false)} className="justify-self-start text-sm font-medium text-violeta-600 hover:underline">Voltar ao mural</button>
        <PedirDocumento codigo={codigo} documentos={m.documentos} />
      </>
    );
  }

  const abas = temClassificados || temManual ? (
    <span className="trilho" role="group" aria-label="Mostrar">
      <button type="button" className="chip" aria-pressed={aba === "avisos"} data-escolhido={aba === "avisos" ? "" : undefined} onClick={() => ir({ aba: "avisos" })}>Avisos</button>
      {temClassificados ? (
        <button type="button" className="chip" aria-pressed={aba === "classificados"} data-escolhido={aba === "classificados" ? "" : undefined}
          onClick={() => ir({ aba: "classificados" })}>Classificados</button>
      ) : null}
      {temManual ? (
        <button type="button" className="chip" aria-pressed={aba === "manual"} data-escolhido={aba === "manual" ? "" : undefined} onClick={() => ir({ aba: "manual" })}>Manual do prédio</button>
      ) : null}
    </span>
  ) : null;

  if (aba === "classificados") {
    return (
      <>
        {abas}
        <FaixaQueda canal={m.canalAlternativo} />
        <Vitrine anuncios={m.classificados!} links={links} abrir={(id) => ir({ aba: "classificados", anuncio: id })} faixa={painel?.anuncio} />
      </>
    );
  }
  if (aba === "manual") {
    return (
      <>
        {abas}
        <ul className="grid gap-3" aria-label="Manual do prédio">
          {m.manual!.map((s) => (
            <li key={s.id}>
              <Cartao>
                <h2 className="text-base font-medium">{s.titulo}</h2>
                <p className="text-sm whitespace-pre-line">{s.texto}</p>
              </Cartao>
            </li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <>
      {abas}
      <FaixaQueda canal={m.canalAlternativo} />
      <ReceberPeloWhatsapp numero={m.comunicadosWhatsapp} />
      {m.enquetes?.length ? (
        <ul className="grid gap-3" aria-label="Enquetes abertas">
          {m.enquetes.map((e) => <li key={e.id} className="grid gap-3"><EnqueteFixada e={e} condominio={m.condominio} />{painel ? painel.enquete(e) : null}</li>)}
        </ul>
      ) : null}
      {m.comunicados?.length ? (
        <ul className="grid gap-3" aria-label="Comunicados">
          {m.comunicados.map((c) => (
            <li key={c.id} className="grid gap-3">
              <Postagem c={c} condominio={m.condominio} links={links} aoLer={() => ir({ aba: "avisos", comunicado: c.id })}
                aoCompartilhar={() => void compartilhar(c.titulo, links.publico({ aba: "avisos", comunicado: c.id }))} />
              {painel ? painel.aviso(c) : null}
            </li>
          ))}
        </ul>
      ) : <Cartao><h2 className="font-medium">Nenhum aviso agora</h2><p className="text-sm text-tinta-suave">Quando o condomínio publicar um aviso para todos, ele aparece aqui.</p></Cartao>}
      {avisoRecado}
      {m.documentos?.length ? (
        <div className="grid gap-3">
          <Cartao>
            <h2 className="font-medium">Documentos do prédio</h2>
            <p className="text-sm text-tinta-suave">{m.documentos.map((d) => d.titulo).join(", ")}. Peça e receba no seu e-mail.</p>
            <Botao variante="contorno" className="justify-self-start" disabled={!!painel} onClick={() => setPedir(true)}>Pedir por e-mail</Botao>
          </Cartao>
          {painel?.documentos ?? null}
        </div>
      ) : null}
    </>
  );
}
