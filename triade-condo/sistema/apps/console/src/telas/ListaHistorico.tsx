"use client";
// Histórico administrativo (PI-12; DC15, telas-modelo console-historico-equipe-computador e
// console-ficha-notas-computador, rodada Console de 23/10/2026): mais novo primeiro, na linha do
// tempo da Plataforma, com quem e quando em cima e o que mudou embaixo. O que é interno aparece
// marcado. Nada se apaga. O mesmo carregamento serve à ficha, que junta as notas.

import { useCallback, useEffect, useState } from "react";
import { descreverEvento } from "@triade/domain";
import { Botao, Carregando, chamarApi, ErroCarregar, Icone, textoDoErro, Vazio, type NomeIcone, type Resposta } from "@triade/ui";
import { Cartao, diaHora, LinhaDoTempo, type PassoTempo } from "./comum.tsx";

export interface Evento {
  id: number;
  ocorridoEm: string;
  autor: { id: string; nome: string | null } | null;
  acao: string;
  entidade: string;
  dados: Record<string, unknown>;
  interno?: boolean;
}

const PAGINA = 50;

/** Os eventos de um histórico, de 50 em 50, do mais novo para o mais antigo. */
export function useHistorico(caminho: string) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [erroTexto, setErroTexto] = useState("");
  const [temMais, setTemMais] = useState(false);
  const [vez, setVez] = useState(0);

  const receber = useCallback((r: Resposta<{ eventos: Evento[] }>, juntar: boolean) => {
    if (!r.ok) {
      setErroTexto(textoDoErro(r.erro));
      return setEstado("erro");
    }
    setEventos((atual) => (juntar ? [...atual, ...r.dados.eventos] : r.dados.eventos));
    setTemMais(r.dados.eventos.length === PAGINA);
    setEstado("pronto");
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    chamarApi<{ eventos: Evento[] }>(`${caminho}?limite=${PAGINA}`, { sinal: controle.signal }).then((r) => {
      if (!controle.signal.aborted) receber(r, false);
    });
    return () => controle.abort();
  }, [caminho, vez, receber]);

  async function maisAntigos() {
    const ultimo = eventos.at(-1)?.id;
    receber(await chamarApi<{ eventos: Evento[] }>(`${caminho}?limite=${PAGINA}&antes=${ultimo}`), true);
  }

  return { eventos, estado, erroTexto, temMais, maisAntigos, tentarDeNovo: () => { setEstado("carregando"); setVez((v) => v + 1); } };
}

export type Historico = ReturnType<typeof useHistorico>;

function iconeDe(acao: string): NomeIcone {
  if (acao.startsWith("equipe.")) return "pessoas";
  if (acao.startsWith("sindico.")) return "pessoa";
  if (acao.startsWith("cenario.") || acao.startsWith("condominio.")) return "predio";
  if (acao.startsWith("contrato.")) return "cadeado";
  if (acao.startsWith("whatsapp.")) return "whats";
  return "editar";
}

/** Um evento do histórico como passo da linha do tempo. */
export function passoDoEvento(e: Evento): PassoTempo {
  return {
    chave: `e${e.id}`,
    icone: iconeDe(e.acao),
    tom: "violeta",
    quando: diaHora(e.ocorridoEm),
    quem: e.autor ? e.autor.nome ?? "Pessoa sem nome" : "Sistema",
    selo: { texto: e.interno ? "Mudança · interno" : "Mudança", tom: "neutro" },
    texto: `${descreverEvento(e)}.`,
  };
}

/** Carregando, erro, vazio ou a linha do tempo com "Carregar mais antigos". */
export function CorpoHistorico({ historico, itens, rotulo, vazio }: { historico: Historico; itens: PassoTempo[]; rotulo: string; vazio: string }) {
  if (historico.estado === "carregando") return <Carregando />;
  if (historico.estado === "erro") return <ErroCarregar texto={historico.erroTexto} tentarDeNovo={historico.tentarDeNovo} />;
  return (
    <div className="grid gap-4">
      {itens.length === 0 ? <Vazio titulo="Nada registrado aqui ainda" icone="relogio">{vazio}</Vazio> : <LinhaDoTempo itens={itens} rotulo={rotulo} />}
      {historico.temMais ? <Botao variante="contorno" tamanho="m" className="justify-self-start" onClick={() => void historico.maisAntigos()}><Icone nome="baixo" />Carregar mais antigos</Botao> : null}
    </div>
  );
}

/** Filtro em trilho (Tudo, Notas, Mudanças...), com o escolhido em violeta. */
export function TrilhoFiltro<T extends string>({ opcoes, atual, aoMudar, rotulo }: { opcoes: { valor: T; texto: string }[]; atual: T; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <span className="trilho" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" className="chip" aria-pressed={atual === o.valor} onClick={() => aoMudar(o.valor)}>{o.texto}</button>
      ))}
    </span>
  );
}

const FILTROS_EQUIPE = [
  { valor: "tudo", texto: "Tudo" },
  { valor: "entradas", texto: "Entradas e saídas" },
  { valor: "funcoes", texto: "Funções" },
] as const;
type FiltroEquipe = (typeof FILTROS_EQUIPE)[number]["valor"];

const ENTRADAS_SAIDAS = new Set(["equipe.membro_cadastrado", "equipe.membro_desativado"]);

/** O histórico da equipe TRÍADE: quem entrou, quem saiu e as funções revistas. */
export function ListaHistorico({ caminho }: { caminho: string }) {
  const historico = useHistorico(caminho);
  const [filtro, setFiltro] = useState<FiltroEquipe>("tudo");
  const aceita = (e: Evento) => filtro === "tudo" || (filtro === "entradas" ? ENTRADAS_SAIDAS.has(e.acao) : !ENTRADAS_SAIDAS.has(e.acao));
  return (
    <Cartao id="t-historico" titulo="Linha do tempo" icone="relogio"
      acao={<TrilhoFiltro rotulo="Mostrar" opcoes={[...FILTROS_EQUIPE]} atual={filtro} aoMudar={setFiltro} />}>
      <CorpoHistorico historico={historico} itens={historico.eventos.filter(aceita).map(passoDoEvento)} rotulo="Histórico da equipe"
        vazio="Cada mudança feita no Console aparece aqui, com quem fez e quando." />
    </Cartao>
  );
}
