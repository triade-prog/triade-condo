"use client";
// Histórico administrativo (PI-12): mais novo primeiro, com autor e data; o que é interno
// aparece marcado. Nada se apaga.

import { useCallback, useEffect, useState } from "react";
import { descreverEvento, formatarDataHora } from "@triade/domain";
import { Botao, Carregando, chamarApi, ErroCarregar, Selo, textoDoErro, Vazio, type Resposta } from "@triade/ui";

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

export function ListaHistorico({ caminho }: { caminho: string }) {
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

  if (estado === "carregando") return <Carregando />;
  if (estado === "erro") return <ErroCarregar texto={erroTexto} tentarDeNovo={() => { setEstado("carregando"); setVez((v) => v + 1); }} />;
  if (eventos.length === 0) return <Vazio titulo="Nada registrado ainda">Cada mudança feita no Console aparece aqui, com quem fez e quando.</Vazio>;

  return (
    <div className="grid gap-3">
      <ol className="divide-y divide-linha rounded-lg border border-linha">
        {eventos.map((e) => (
          <li key={e.id} className="grid gap-1 px-4 py-3">
            <p className="flex flex-wrap items-center gap-2 text-xs text-tinta-suave">
              <time dateTime={e.ocorridoEm}>{formatarDataHora(e.ocorridoEm)}</time>
              <span aria-hidden="true">·</span>
              <span>{e.autor ? e.autor.nome ?? "Pessoa sem nome" : "Sistema"}</span>
              {e.interno ? <Selo tom="neutro">interno</Selo> : null}
            </p>
            <p>{descreverEvento(e)}</p>
          </li>
        ))}
      </ol>
      {temMais ? <Botao variante="contorno" className="justify-self-start" onClick={() => void maisAntigos()}>Carregar mais antigos</Botao> : null}
    </div>
  );
}
