"use client";
// Linha do tempo e anotar na memória (design "Memória do prédio", tela 3; CT-03): a história do
// prédio montada sozinha com o que já acontece no sistema e com o que a gestão anota. Anotação
// não se apaga: corrigir guarda a versão anterior e tirar da linha do tempo pede motivo.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FILTROS_LINHA_DO_TEMPO, mostrarDataCurta, TIPOS_ANOTACAO, type FiltroLinhaDoTempo, type TipoAnotacao } from "@triade/domain";
import {
  AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Icone, Selo,
  textoDoErro, Trilho, Vazio, type ErroApi, type NomeIcone,
} from "@triade/ui";
import { hojeEmBrasilia } from "../moradores/comum.tsx";
import { diaHora } from "../pedidos/comum.tsx";
import { useCarregar } from "../sessao.tsx";
import type { AnotacaoDetalhe, EventoMemoria, LinhaDoTempo, OpcoesMemoria } from "../tipos.ts";
import type { PropsAbaMemoria } from "./Memoria.tsx";

const ICONE: Record<EventoMemoria["fonte"], { icone: NomeIcone; tom: string }> = {
  ANOTADO: { icone: "balao", tom: "bg-violeta-100 text-violeta-700" },
  MANUTENCAO: { icone: "check", tom: "bg-ok-fundo text-ok" },
  DOCUMENTO: { icone: "documento", tom: "bg-superficie-2 text-tinta" },
  PRONTUARIO: { icone: "alerta", tom: "bg-atencao-fundo text-atencao" },
  COMUNICADO: { icone: "megafone", tom: "bg-superficie-2 text-tinta" },
  PESSOA: { icone: "pessoa", tom: "bg-violeta-50 text-violeta-700" },
};

function ligacaoTexto(l: EventoMemoria["ligacao"]): string | null {
  if (!l) return null;
  if (l.tipo === "DOCUMENTO") return l.restrito ? "com documento restrito" : `com o documento ${l.titulo}`;
  if (l.tipo === "PEDIDO") return l.privado ? `com o pedido ${l.protocolo} (privado)` : `com o pedido ${l.protocolo}`;
  return `com a manutenção ${l.titulo}`;
}

function linkDo(e: EventoMemoria): string | null {
  if (e.fonte === "MANUTENCAO") return `/manutencao/manutencao?id=${e.manutencaoId}`;
  if (e.fonte === "DOCUMENTO") return `/comunicados/documento?id=${e.documentoId}`;
  if (e.fonte === "COMUNICADO") return `/comunicados/comunicado?id=${e.id}`;
  return null;
}

export function AbaLinhaDoTempo({ feito }: PropsAbaMemoria) {
  const [filtro, setFiltro] = useState<FiltroLinhaDoTempo>("TUDO");
  const carga = useCarregar<LinhaDoTempo>(`/v1/condominio/memoria/linha-do-tempo?filtro=${filtro}`);
  const [pagina, setPagina] = useState<{ de: LinhaDoTempo | null; antigos: EventoMemoria[]; proximo: string | null }>({ de: null, antigos: [], proximo: null });
  const [buscando, setBuscando] = useState(false);
  const [anotar, setAnotar] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  const dados = carga.estado === "pronto" ? carga.dados : null;
  // Nova carga (outro filtro ou depois de anotar): recomeça do mais novo.
  const { antigos, proximo } = pagina.de === dados ? pagina : { antigos: [], proximo: dados?.maisAntigosAntes ?? null };

  async function maisAntigos() {
    if (!proximo) return;
    setBuscando(true);
    const r = await chamarApi<LinhaDoTempo>(`/v1/condominio/memoria/linha-do-tempo?filtro=${filtro}&antes=${proximo}`);
    setBuscando(false);
    if (r.ok) setPagina({ de: dados, antigos: [...antigos, ...r.dados.eventos], proximo: r.dados.maisAntigosAntes ?? null });
  }
  const mudou = (texto: string) => { setAnotar(false); setAberta(null); carga.recarregar(); feito(texto); };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Trilho rotulo="Mostrar na linha do tempo">
          {(Object.keys(FILTROS_LINHA_DO_TEMPO) as FiltroLinhaDoTempo[]).map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filtro === f} data-escolhido={filtro === f ? "" : undefined} onClick={() => setFiltro(f)}>
              {FILTROS_LINHA_DO_TEMPO[f]}
            </button>
          ))}
        </Trilho>
        {carga.estado === "pronto" && carga.dados.podeAnotar ? <Botao tamanho="m" onClick={() => setAnotar(true)}><Icone nome="mais" />Anotar na memória</Botao> : null}
      </div>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando a linha do tempo…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? (
        <section aria-label="Linha do tempo" className="grid gap-2 rounded-2xl border border-linha bg-superficie p-4 shadow-s1">
          {[...carga.dados.eventos, ...antigos].length === 0 ? (
            <Vazio titulo="Nada aqui ainda">
              {filtro === "ANOTADO" ? "Anote decisões, combinados, obras e ocorrências que não passaram por nenhuma tela." : "O que acontece no sistema entra aqui sozinho."}
            </Vazio>
          ) : (
            <ol className="grid">
              {[...carga.dados.eventos, ...antigos].map((e) => {
                const ic = ICONE[e.fonte];
                const link = linkDo(e);
                const anotado = e.fonte === "ANOTADO";
                return (
                  <li key={`${e.fonte}-${e.id}-${e.data}`} className={`grid grid-cols-[76px_32px_minmax(0,1fr)] items-start gap-3 rounded-xl px-2 py-2.5 ${anotado ? "bg-violeta-50" : ""}`}>
                    <span className="pt-1.5 text-right text-[13px] text-tinta-suave">{mostrarDataCurta(e.data)}</span>
                    <span className={`grid h-8 w-8 place-items-center rounded-[10px] ${ic.tom}`}><Icone nome={ic.icone} className="h-4 w-4" /></span>
                    <span className="grid min-w-0 gap-0.5 text-sm">
                      {anotado ? (
                        <button type="button" className="text-left font-medium hover:text-violeta-600 hover:underline" onClick={() => setAberta(e.id)}>
                          {TIPOS_ANOTACAO[e.tipo as TipoAnotacao]}: {e.titulo}
                        </button>
                      ) : link ? <Link href={link} className="font-medium hover:text-violeta-600 hover:underline">{e.titulo}</Link> : <span className="font-medium">{e.titulo}</span>}
                      <span className="text-[13px] text-tinta-suave">
                        {anotado ? [e.autor, "anotado na memória", ligacaoTexto(e.ligacao), e.corrigida ? "corrigido" : null].filter(Boolean).join(" · ") : e.detalhe}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {proximo ? (
            <div className="flex justify-center"><Botao variante="contorno" tamanho="m" disabled={buscando} onClick={() => void maisAntigos()}>{buscando ? "Buscando…" : "Mostrar mais antigos"}</Botao></div>
          ) : null}
          <p className="text-xs text-tinta-suave">Fundo violeta: anotado à mão. O resto vem sozinho do que acontece no sistema. Cada um vê aqui só o que já pode ver no resto do sistema.</p>
        </section>
      ) : null}
      {anotar ? <FormAnotacao aoFechar={() => setAnotar(false)} aoSalvar={mudou} /> : null}
      {aberta ? <AnotacaoAberta id={aberta} aoFechar={() => setAberta(null)} aoMudar={mudou} /> : null}
    </div>
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
    <Dialogo aberto titulo={anotacao ? "Corrigir anotação" : "Anotar na memória"} aoFechar={aoFechar}>
      <form onSubmit={salvar} noValidate className="grid gap-3">
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div role="group" aria-labelledby="an-tipo" className="grid gap-1">
          <span id="an-tipo" className="text-[13px] font-medium">O que é</span>
          <span className="trilho flex-wrap">
            {(Object.keys(TIPOS_ANOTACAO) as TipoAnotacao[]).map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={v.tipo === t} data-escolhido={v.tipo === t ? "" : undefined} onClick={() => setV({ ...v, tipo: t })}>
                {TIPOS_ANOTACAO[t]}
              </button>
            ))}
          </span>
        </div>
        <CampoTexto id="an-titulo" rotulo="Título" required maxLength={120} value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })}
          placeholder="Vizinho do lote 12 divide a manutenção do muro" erro={comErro.includes("titulo") ? "De 3 a 120 caracteres." : null} />
        <CampoTexto id="an-data" rotulo="Quando aconteceu" type="date" max={hojeEmBrasilia()} value={v.aconteceuEm}
          onChange={(e) => setV({ ...v, aconteceuEm: e.target.value })} erro={comErro.includes("aconteceuEm") ? "Escolha uma data até hoje." : null} />
        <CampoAreaTexto id="an-texto" rotulo="O que ficou registrado" rows={4} maxLength={4000} value={v.texto} onChange={(e) => setV({ ...v, texto: e.target.value })}
          placeholder="Cada lado paga metade da pintura e dos reparos do muro divisório." erro={comErro.includes("texto") ? "Conte o que aconteceu (de 3 a 4.000 caracteres)." : null} />
        <CampoSelecao id="an-ligar" rotulo="Ligar a" opcional value={ligacao} onChange={(e) => { setLigacao(e.target.value as TipoLigacao); setAlvo(""); }}
          opcoes={[{ valor: "", texto: "Nada" }, { valor: "DOCUMENTO", texto: "Um documento" }, ...(o?.pedidos.length ? [{ valor: "PEDIDO", texto: "Um pedido" }] : []),
            ...(o?.manutencoes.length ? [{ valor: "MANUTENCAO", texto: "Uma manutenção" }] : [])]} />
        {ligacao ? (
          <CampoSelecao id="an-alvo" rotulo={ligacao === "DOCUMENTO" ? "Documento" : ligacao === "PEDIDO" ? "Pedido" : "Manutenção"} value={alvo}
            onChange={(e) => setAlvo(e.target.value)} opcoes={[{ valor: "", texto: "Escolha" }, ...(alvos ?? [])]}
            erro={comErro.some((c) => c.endsWith("Id") || c === "ligacao") ? "Escolha uma opção da lista." : null} />
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>{enviando ? "Salvando…" : anotacao ? "Salvar correção" : "Anotar"}</Botao>
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
    return <Dialogo aberto titulo="Anotação" aoFechar={aoFechar}>{carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /> : <Carregando />}</Dialogo>;
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
        <p className="text-sm whitespace-pre-line">{a.texto}</p>
        <p className="text-[13px] text-tinta-suave">
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
                    <li key={x.numero} className="grid gap-0.5 px-3 py-2 text-sm">
                      <span className="flex flex-wrap items-center gap-2"><Selo tom="neutro">Versão {x.numero}</Selo><span className="font-medium">{x.titulo}</span></span>
                      <span className="whitespace-pre-line">{x.texto}</span>
                      <span className="text-xs text-tinta-suave">Escrita {x.autor ? `por ${x.autor} ` : ""}em {diaHora(x.escritaEm)} · trocada em {diaHora(x.substituidaEm)}</span>
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
