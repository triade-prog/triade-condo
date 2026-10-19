"use client";
// Vida em condomínio › Classificados (design "Vida em condomínio", tela 9; AC-05, CD-12): os
// anúncios que os moradores mandam com ANUNCIAR no WhatsApp. O que espera aprovação vem primeiro;
// publicar escolhe o título e o valor que aparecem no mural, por 30 dias. Recusar pede motivo, e
// tirar do mural pode levar um. A decisão vai ao morador pelo WhatsApp.

import { useState, type FormEvent } from "react";
import { centavosDoTexto, ESTADOS_ANUNCIO, filtroDoAnuncio, FILTROS_ANUNCIO, reais, TIPOS_ANUNCIO, type EstadoAnuncio, type FiltroAnuncio } from "@triade/domain";
import {
  AvisoErro, Botao, CampoAreaTexto, CampoTexto, Carregando, camposComErro, chamarApi, Chip, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio,
  type ErroApi, type Tom,
} from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { AnuncioTela, ListaAnuncios } from "../tipos.ts";

type Acao = { tipo: "publicar" | "recusar" | "tirar"; anuncio: AnuncioTela };

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

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando os anúncios…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const l = carga.dados;
  const lista = l.classificados.filter((a) => filtroDoAnuncio(a.estado) === filtro);
  const fechar = (texto?: string) => { setAcao(null); if (texto) aoMudar(texto); };

  return (
    <div className="grid content-start gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quais anúncios">
        {(Object.keys(FILTROS_ANUNCIO) as FiltroAnuncio[]).map((f) => (
          <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>
            {FILTROS_ANUNCIO[f]}{f === "A_APROVAR" && l.aAprovar ? ` · ${l.aAprovar}` : ""}
          </Chip>
        ))}
      </div>
      {lista.length === 0 ? (
        <Vazio titulo={filtro === "A_APROVAR" ? "Nada esperando aprovação" : filtro === "NO_MURAL" ? "Nenhum anúncio no mural" : "Nenhum anúncio encerrado"}>
          Os moradores anunciam pelo WhatsApp do condomínio, mandando ANUNCIAR. Publicado, o anúncio fica 30 dias na aba Classificados do mural online.
        </Vazio>
      ) : (
        <ul className="grid gap-3">
          {lista.map((a) => <CartaoAnuncio key={a.id} a={a} podeEditar={l.pode.editar} aoAgir={(tipo) => setAcao({ tipo, anuncio: a })} />)}
        </ul>
      )}
      <p className="text-xs text-tinta-suave">No mural vão o primeiro nome e o bloco, nunca a unidade. O WhatsApp de quem anunciou só aparece se a pessoa respondeu SIM.</p>

      {acao?.tipo === "publicar" ? <Publicar a={acao.anuncio} aoFechar={fechar} /> : null}
      {acao?.tipo === "recusar" || acao?.tipo === "tirar" ? <ComMotivo tipo={acao.tipo} a={acao.anuncio} aoFechar={fechar} /> : null}
    </div>
  );
}

/** "Vendo · R$ 900,00 · Torre B · 201 · Paulo · mostrar WhatsApp: sim". */
function linhaDoAnuncio(a: AnuncioTela): string {
  const valor = a.valorCentavos ?? (a.estado === "A_APROVAR" ? a.valorSugerido : undefined);
  return [TIPOS_ANUNCIO[a.tipo], valor ? reais(valor) : null, a.unidade.nome, a.contato?.nome,
    a.mostrarTelefone ? "mostrar WhatsApp: sim" : "contato pelo condomínio"].filter(Boolean).join(" · ");
}

function CartaoAnuncio({ a, podeEditar, aoAgir }: { a: AnuncioTela; podeEditar: boolean; aoAgir: (t: Acao["tipo"]) => void }) {
  const titulo = a.titulo ?? a.tituloSugerido;
  const decisao = a.estado === "RECUSADO" ? `Recusado${a.decisao?.por ? ` por ${a.decisao.por}` : ""}: ${a.motivo ?? ""}`
    : a.estado === "RETIRADO" ? `Tirado do mural${a.retirada?.por ? ` por ${a.retirada.por}` : ""}${a.motivo ? `: ${a.motivo}` : ""}` : null;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      {a.foto ? <FotoAnuncio id={a.id} titulo={titulo} /> : <span className="grid h-[72px] w-[72px] place-items-center rounded-xl bg-superficie-2 text-tinta-suave" aria-hidden="true"><Icone nome="camera" /></span>}
      <span className="grid min-w-0 gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{titulo}</span>
          <SeloAnuncio a={a} />
        </span>
        <span className="text-sm text-tinta-suave">{linhaDoAnuncio(a)}</span>
        <span className="whitespace-pre-line text-sm">{a.texto}</span>
        {decisao ? <span className="text-[13px] text-tinta-suave">{decisao}</span> : null}
        {podeEditar && a.estado === "A_APROVAR" ? (
          <span className="flex flex-wrap gap-2">
            <Botao tamanho="m" onClick={() => aoAgir("publicar")} aria-label={`Publicar o anúncio ${titulo}`}>Publicar</Botao>
            <Botao tamanho="m" variante="contorno" onClick={() => aoAgir("recusar")} aria-label={`Recusar o anúncio ${titulo}`}>Recusar</Botao>
          </span>
        ) : null}
        {podeEditar && a.estado === "NO_MURAL" ? (
          <span><Botao tamanho="m" variante="discreto" onClick={() => aoAgir("tirar")} aria-label={`Tirar do mural o anúncio ${titulo}`}>Tirar do mural</Botao></span>
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

function Publicar({ a, aoFechar }: { a: AnuncioTela; aoFechar: (texto?: string) => void }) {
  const [titulo, setTitulo] = useState(a.tituloSugerido);
  const [valor, setValor] = useState(valorNoCampo(a.valorSugerido));
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [valorRuim, setValorRuim] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
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
  return (
    <Dialogo aberto titulo="Publicar o anúncio" aoFechar={() => aoFechar()}>
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <p className="text-sm text-tinta-suave">{linhaDoAnuncio(a)}</p>
        <blockquote className="whitespace-pre-line rounded-xl bg-superficie-2 px-3 py-2 text-sm">{a.texto}</blockquote>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoTexto id="cl-titulo" rotulo="Título no mural" maxLength={80} required value={titulo} onChange={(e) => setTitulo(e.target.value)}
          erro={comErro.includes("titulo") ? "Escreva o título, de 3 a 80 letras" : null} ajuda="Curto, como o morador escreveria. O texto vai inteiro abaixo dele." />
        <CampoTexto id="cl-valor" rotulo="Valor" opcional inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
          erro={valorRuim || comErro.includes("valorCentavos") ? "Escreva o valor como 900 ou 1.150,50" : null} ajuda="Em reais. Deixe vazio na doação ou quando o anúncio não tem preço." />
        <p className="text-sm text-tinta-suave">Fica 30 dias no mural. Quem anunciou recebe o aviso pelo WhatsApp, assinado com o seu nome.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>Publicar</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function ComMotivo({ tipo, a, aoFechar }: { tipo: "recusar" | "tirar"; a: AnuncioTela; aoFechar: (texto?: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  const titulo = a.titulo ?? a.tituloSugerido;
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const res = await chamarApi(`/v1/condominio/classificados/${a.id}/${tipo}`, { corpo: { versao: a.versao, motivo } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    aoFechar(tipo === "recusar" ? "Anúncio recusado. O motivo vai para quem anunciou pelo WhatsApp." : `"${titulo}" saiu do mural. Quem anunciou recebe o aviso pelo WhatsApp.`);
  }
  return (
    <Dialogo aberto titulo={tipo === "recusar" ? "Recusar o anúncio" : "Tirar do mural?"} aoFechar={() => aoFechar()}>
      <form onSubmit={enviar} noValidate className="grid gap-3">
        <p className="text-sm text-tinta-suave">{titulo} · {linhaDoAnuncio(a)}</p>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="cl-motivo" rotulo="Motivo" opcional={tipo === "tirar"} maxLength={500} required={tipo === "recusar"} value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          erro={comErro.includes("motivo") ? (tipo === "recusar" ? "Escreva o motivo, com pelo menos 3 letras" : "O motivo tem de 3 a 500 letras") : null}
          ajuda={tipo === "recusar" ? "Obrigatório. Vai para quem anunciou, assinado com o seu nome." : "Se escrever, vai para quem anunciou."} />
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao type="submit" variante="perigo" disabled={enviando}>{tipo === "recusar" ? "Recusar" : "Tirar do mural"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}
