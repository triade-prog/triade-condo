"use client";
// Vida em condomínio › Classificados (design "Vida em condomínio", tela 9; DC15, telas-modelo
// vida-classificados e vida-revisar-anuncio; AC-05, CD-12): os anúncios que os moradores mandam
// com ANUNCIAR no WhatsApp, em abas, A aprovar primeiro. Revisar abre a janela com o texto como
// chegou: publicar escolhe o título e o valor que aparecem no mural, por 30 dias; recusar pede
// motivo. Tirar do mural pode levar um. A decisão vai ao morador pelo WhatsApp.

import { useState, type FormEvent } from "react";
import { centavosDoTexto, ESTADOS_ANUNCIO, filtroDoAnuncio, FILTROS_ANUNCIO, reais, TIPOS_ANUNCIO, type EstadoAnuncio, type FiltroAnuncio } from "@triade/domain";
import {
  AvisoErro, Botao, CampoAreaTexto, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio,
  type ErroApi, type Tom,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { AnuncioTela, ListaAnuncios } from "../tipos.ts";

type Acao = { tipo: "publicar" | "tirar"; anuncio: AnuncioTela };

const TOM: Record<EstadoAnuncio, Tom> = { A_APROVAR: "atencao", NO_MURAL: "ok", RECUSADO: "neutro", RETIRADO: "neutro", VENCIDO: "neutro" };

/** "18/11". */
const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** "900,00", para o campo do valor. */
const valorNoCampo = (c?: number) => (c ? reais(c).replace("R$ ", "") : "");

export function SeloAnuncio({ a }: { a: Pick<AnuncioTela, "estado" | "noMuralAte"> }) {
  const texto = a.estado === "NO_MURAL" && a.noMuralAte ? `No mural até ${diaMes(a.noMuralAte)}`
    : a.estado === "VENCIDO" && a.noMuralAte ? `Venceu em ${diaMes(a.noMuralAte)}` : ESTADOS_ANUNCIO[a.estado];
  return <Selo tom={TOM[a.estado]}>{texto}</Selo>;
}

export function AbaClassificados({ aoMudar }: { aoMudar: (texto: string) => void }) {
  const [filtro, setFiltro] = useState<FiltroAnuncio>("A_APROVAR");
  const [acao, setAcao] = useState<Acao | null>(null);
  const carga = useCarregar<ListaAnuncios>("/v1/condominio/classificados");
  const l = carga.estado === "pronto" ? carga.dados : null;
  const daAba = (f: FiltroAnuncio) => l?.classificados.filter((a) => filtroDoAnuncio(a.estado) === f) ?? [];
  const lista = daAba(filtro);
  const fechar = (texto?: string) => { setAcao(null); if (texto) aoMudar(texto); };

  return (
    <div className="grid content-start gap-5">
      <nav aria-label="Situação" className="flex gap-1 overflow-x-auto border-b border-linha">
        {(Object.keys(FILTROS_ANUNCIO) as FiltroAnuncio[]).map((f) => {
          const atual = filtro === f;
          const n = daAba(f).length;
          return (
            <button key={f} type="button" aria-pressed={atual} onClick={() => setFiltro(f)}
              className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 t-texto font-medium whitespace-nowrap ${atual ? "border-violeta-600 text-violeta-600" : "border-transparent text-tinta-suave hover:text-tinta"}`}>
              {FILTROS_ANUNCIO[f]}
              {n && f !== "ENCERRADOS" ? <><span className="sr-only"> ({n})</span><span aria-hidden="true" className={`contagem ml-0 ${atual ? "bg-violeta-600 text-superficie" : "bg-superficie-2 text-tinta-suave"}`}>{n}</span></> : null}
            </button>
          );
        })}
      </nav>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando os anúncios…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} oQue="os anúncios" /> : null}
      {l ? (
        lista.length === 0 ? (
          <Vazio titulo={filtro === "A_APROVAR" ? "Nada esperando aprovação" : filtro === "NO_MURAL" ? "Nenhum anúncio no mural" : "Nenhum anúncio encerrado"} icone="megafone">
            Os moradores anunciam pelo WhatsApp do condomínio, mandando ANUNCIAR. Publicado, o anúncio fica 30 dias na aba Classificados do mural online.
          </Vazio>
        ) : (
          <ul aria-label="Anúncios" className="grid max-w-[860px] gap-3">
            {lista.map((a) => <CartaoAnuncio key={a.id} a={a} podeEditar={l.pode.editar} aoAgir={(tipo) => setAcao({ tipo, anuncio: a })} />)}
          </ul>
        )
      ) : null}
      <p className="t-apoio">No mural vão o primeiro nome e o bloco, nunca a unidade. O WhatsApp de quem anunciou só aparece se a pessoa respondeu SIM.</p>

      {acao?.tipo === "publicar" ? <Revisar a={acao.anuncio} aoFechar={fechar} /> : null}
      {acao?.tipo === "tirar" ? <Tirar a={acao.anuncio} aoFechar={fechar} /> : null}
    </div>
  );
}

/** "Vendo · R$ 900,00 · Torre B · 201 · Paulo Mendes". */
function linhaDoAnuncio(a: AnuncioTela): string {
  const valor = a.valorCentavos ?? (a.estado === "A_APROVAR" ? a.valorSugerido : undefined);
  return [TIPOS_ANUNCIO[a.tipo], valor ? reais(valor) : null, a.unidade.nome, a.contato?.nome].filter(Boolean).join(" · ");
}

/** Como falar com quem anunciou, em palavra e com o ícone (no lugar do "mostrar WhatsApp: sim"). */
function Contato({ a }: { a: AnuncioTela }) {
  return a.mostrarTelefone
    ? <span className="inline-flex items-center gap-1 text-ok"><Icone nome="whats" className="h-3.5 w-3.5" />Mostra o WhatsApp</span>
    : <span className="inline-flex items-center gap-1"><Icone nome="predio" className="h-3.5 w-3.5" />Contato pelo condomínio</span>;
}

function CartaoAnuncio({ a, podeEditar, aoAgir }: { a: AnuncioTela; podeEditar: boolean; aoAgir: (t: Acao["tipo"]) => void }) {
  const titulo = a.titulo ?? a.tituloSugerido;
  const decisao = a.estado === "RECUSADO" ? `Recusado${a.decisao?.por ? ` por ${a.decisao.por}` : ""}: ${a.motivo ?? ""}`
    : a.estado === "RETIRADO" ? `Tirado do mural${a.retirada?.por ? ` por ${a.retirada.por}` : ""}${a.motivo ? `: ${a.motivo}` : ""}` : null;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1 max-md:p-4">
      {a.foto ? <FotoAnuncio id={a.id} titulo={titulo} /> : <span className="grid h-24 w-24 place-items-center rounded-[14px] bg-superficie-2 text-tinta-suave max-md:h-[72px] max-md:w-[72px]" aria-hidden="true"><Icone nome="camera" /></span>}
      <span className="grid min-w-0 content-start gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="t-titulo-cartao">{titulo}</span>
          <SeloAnuncio a={a} />
        </span>
        <span className="t-texto whitespace-pre-line">&ldquo;{a.texto}&rdquo;</span>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 t-apoio text-tinta-suave"><span>{linhaDoAnuncio(a)}</span><Contato a={a} /></span>
        {decisao ? <span className="t-apoio text-tinta-suave">{decisao}</span> : null}
        {podeEditar && a.estado === "A_APROVAR" ? (
          <span className="pt-1"><Botao tamanho="m" variante="contorno" onClick={() => aoAgir("publicar")} aria-label={`Revisar o anúncio ${titulo}`}><Icone nome="olho" className="h-4 w-4" />Revisar</Botao></span>
        ) : null}
        {podeEditar && a.estado === "NO_MURAL" ? (
          <span className="pt-1"><Botao tamanho="m" variante="discreto" onClick={() => aoAgir("tirar")} aria-label={`Tirar do mural o anúncio ${titulo}`}>Tirar do mural</Botao></span>
        ) : null}
      </span>
    </li>
  );
}

/** A foto vem por um link que expira em minutos (CD-04). */
function FotoAnuncio({ id, titulo }: { id: string; titulo: string }) {
  const carga = useCarregar<{ url: string }>(`/v1/condominio/classificados/${id}/foto`);
  if (carga.estado !== "pronto") return <span className="h-[72px] w-[72px] rounded-xl bg-superficie-2" aria-hidden="true" />;
  return (
    <a href={carga.dados.url} target="_blank" rel="noopener noreferrer" className="block h-[72px] w-[72px] overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element -- link assinado de 5 min do armazenamento privado: não passa pelo otimizador nem por cache */}
      <img src={carga.dados.url} alt={`Foto do anúncio ${titulo}`} className="h-full w-full object-cover" />
    </a>
  );
}

/** Revisar (DC15, tela-modelo vida-revisar-anuncio): o texto como chegou, o título e o valor do
 * mural, e as duas saídas: Publicar no mural ou Recusar, com o motivo. */
function Revisar({ a, aoFechar }: { a: AnuncioTela; aoFechar: (texto?: string) => void }) {
  const [titulo, setTitulo] = useState(a.tituloSugerido);
  const [valor, setValor] = useState(valorNoCampo(a.valorSugerido));
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [valorRuim, setValorRuim] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function publicar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    const centavos = centavosDoTexto(valor);
    setValorRuim(centavos === undefined);
    if (centavos === undefined) return;
    setEnviando(true);
    const res = await chamarApi<AnuncioTela>(`/v1/condominio/classificados/${a.id}/publicar`, { corpo: { versao: a.versao, titulo, valorCentavos: centavos } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    aoFechar(`Anúncio publicado no mural até ${res.dados.noMuralAte ? diaMes(res.dados.noMuralAte) : "daqui a 30 dias"}. Quem anunciou recebe o aviso pelo WhatsApp.`);
  }

  async function recusar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const res = await chamarApi(`/v1/condominio/classificados/${a.id}/recusar`, { corpo: { versao: a.versao, motivo } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    aoFechar("Anúncio recusado. O motivo vai para quem anunciou pelo WhatsApp.");
  }

  const nome = a.contato?.nome.split(" ")[0];
  const bloco = a.unidade.nome.split(" · ")[0];
  return (
    <Dialogo aberto media fechar titulo={recusando ? "Recusar o anúncio" : "Revisar o anúncio"} aoFechar={() => aoFechar()} apoio="Chegou pelo WhatsApp · fica 30 dias no mural">
      <div className="flex gap-3.5">
        {a.foto ? <FotoAnuncio id={a.id} titulo={a.tituloSugerido} /> : null}
        <blockquote className="flex-1 rounded-r-xl border-l-[3px] border-violeta-300 bg-violeta-50 px-4 py-3 t-texto whitespace-pre-line">
          {a.texto}
          <span className="t-apoio mt-1 block">{[a.contato?.nome, a.unidade.nome].filter(Boolean).join(" · ")} · {a.mostrarTelefone ? "aceitou mostrar o WhatsApp" : "contato pelo condomínio"}</span>
        </blockquote>
      </div>
      {recusando ? (
        <form onSubmit={recusar} noValidate className="grid gap-4">
          {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
          <CampoAreaTexto id="cl-motivo" rotulo="Motivo" maxLength={500} required value={motivo} onChange={(e) => setMotivo(e.target.value)}
            erro={comErro.includes("motivo") ? "Escreva o motivo, com pelo menos 3 letras" : null} ajuda="Obrigatório. Vai para quem anunciou, assinado com o seu nome." />
          <div className="flex flex-wrap justify-end gap-2 border-t border-linha pt-4">
            <Botao variante="contorno" onClick={() => { setRecusando(false); setErro(null); }}>Voltar</Botao>
            <Botao type="submit" variante="perigo" disabled={enviando}>Recusar</Botao>
          </div>
        </form>
      ) : (
        <form onSubmit={publicar} noValidate className="grid gap-4">
          {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
          <CampoTexto id="cl-titulo" rotulo="Título no mural" maxLength={80} required value={titulo} onChange={(e) => setTitulo(e.target.value)}
            erro={comErro.includes("titulo") ? "Escreva o título, de 3 a 80 letras" : null} ajuda="Curto, como o morador escreveria. O texto vai inteiro abaixo dele." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid content-start gap-1.5 t-texto"><span className="t-apoio font-medium">Tipo</span><span className="flex min-h-11 items-center">{TIPOS_ANUNCIO[a.tipo]}</span></div>
            <CampoTexto id="cl-valor" rotulo="Valor" opcional inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
              erro={valorRuim || comErro.includes("valorCentavos") ? "Escreva o valor como 900 ou 1.150,50" : null} ajuda="Em reais. Vazio na doação ou sem preço." />
          </div>
          <p className="t-apoio flex items-start gap-2"><Icone nome="info" className="mt-0.5 h-4 w-4 shrink-0" />
            No mural vão &ldquo;{nome ? `${nome}, ` : ""}{bloco}&rdquo;. Quem anunciou recebe o aviso pelo WhatsApp, assinado com o seu nome.</p>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-linha pt-4">
            <Botao variante="discreto" onClick={() => { setRecusando(true); setErro(null); }}>Recusar…</Botao>
            <span className="flex gap-2">
              <Botao variante="contorno" onClick={() => aoFechar()}>Cancelar</Botao>
              <Botao type="submit" disabled={enviando}><Icone nome="check" />Publicar no mural</Botao>
            </span>
          </div>
        </form>
      )}
    </Dialogo>
  );
}

export function Tirar({ a, aoFechar }: { a: AnuncioTela; aoFechar: (texto?: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const titulo = a.titulo ?? a.tituloSugerido;
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const res = await chamarApi(`/v1/condominio/classificados/${a.id}/tirar`, { corpo: { versao: a.versao, motivo } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    aoFechar(`"${titulo}" saiu do mural. Quem anunciou recebe o aviso pelo WhatsApp.`);
  }
  return (
    <Dialogo aberto titulo="Tirar do mural?" aoFechar={() => aoFechar()}>
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <p className="t-apoio">{titulo} · {linhaDoAnuncio(a)}</p>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="cl-motivo" rotulo="Motivo" opcional maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          erro={comErro.includes("motivo") ? "O motivo tem de 3 a 500 letras" : null} ajuda="Se escrever, vai para quem anunciou." />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao type="submit" variante="perigo" disabled={enviando}>Tirar do mural</Botao>
        </div>
      </form>
    </Dialogo>
  );
}
