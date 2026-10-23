"use client";
// Parte Notas e histórico da ficha (PI-06, PI-12; DC15, tela-modelo console-ficha-notas-computador;
// rodada Console, decisão A.1 de 23/10/2026): as notas internas e as mudanças do cliente numa linha
// do tempo só, com o filtro Tudo, Notas e Mudanças. A nota vai em balão violeta; a mudança, em
// texto simples. Só a equipe lê; notas não se editam nem se apagam.

import { useState, type FormEvent } from "react";
import { Aviso, Botao, CampoAreaTexto, chamarApi, Icone, textoDoErro, type ErroApi } from "@triade/ui";
import { Cartao, diaHora, type PassoTempo } from "../comum.tsx";
import { CorpoHistorico, passoDoEvento, TrilhoFiltro, useHistorico } from "../ListaHistorico.tsx";
import { useCarregar } from "../sessao.tsx";
import type { PropsAba } from "./tipos.ts";

interface Nota {
  id: string;
  texto: string;
  criadoEm: string;
  autor: { id: string; nome: string | null };
}

const FILTROS = [
  { valor: "tudo", texto: "Tudo" },
  { valor: "notas", texto: "Notas" },
  { valor: "mudancas", texto: "Mudanças" },
] as const;
type Filtro = (typeof FILTROS)[number]["valor"];

export function AbaNotas({ ficha, pode }: PropsAba) {
  const id = ficha.condominio.id;
  const notas = useCarregar<{ notas: Nota[] }>(`/v1/clientes/${id}/notas`);
  const historico = useHistorico(`/v1/clientes/${id}/historico`);
  const [filtro, setFiltro] = useState<Filtro>("tudo");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/clientes/${id}/notas`, { corpo: { texto } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setTexto("");
    notas.recarregar();
  }

  // A nota escrita já aparece como nota; o evento dela no histórico ficaria repetido.
  const comData = [
    ...(filtro === "mudancas" || notas.estado !== "pronto" ? [] : notas.dados.notas.map((n) => ({
      em: n.criadoEm,
      passo: { chave: `n${n.id}`, icone: "balao", tom: "violeta", quando: diaHora(n.criadoEm), quem: n.autor.nome ?? "Equipe TRÍADE",
        selo: { texto: "Nota", tom: "andamento" }, texto: n.texto, nota: true } satisfies PassoTempo,
    }))),
    ...(filtro === "notas" ? [] : historico.eventos.filter((e) => e.acao !== "nota.escrita").map((e) => ({ em: e.ocorridoEm, passo: passoDoEvento(e) }))),
  ].sort((a, b) => b.em.localeCompare(a.em));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Cartao id="t-linha" titulo="Linha do tempo" icone="relogio"
        acao={<TrilhoFiltro rotulo="Mostrar" opcoes={[...FILTROS]} atual={filtro} aoMudar={setFiltro} />}>
        {notas.estado === "erro" ? <Aviso tom="erro">As notas não carregaram. {notas.texto}</Aviso> : null}
        <CorpoHistorico historico={historico} itens={comData.map((x) => x.passo)} rotulo="Notas e mudanças do cliente"
          vazio={filtro === "notas" ? "As notas da equipe sobre este cliente aparecem aqui." : "Cada mudança feita no Console aparece aqui, com quem fez e quando."} />
      </Cartao>
      {pode("console.notas.escrever") ? (
        <Cartao id="t-nova-nota" titulo="Nova nota" icone="balao" className="lg:sticky lg:top-24">
          <span className="selo justify-self-start" data-tom="neutro"><Icone nome="cadeado" className="h-3.5 w-3.5" />Notas internas · o cliente nunca vê</span>
          <form onSubmit={salvar} className="grid gap-3">
            {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
            <CampoAreaTexto id="n-texto" rotulo="Nova nota para a equipe" maxLength={2000} placeholder="Escreva a nota" value={texto} onChange={(e) => setTexto(e.target.value)}
              ajuda="Notas não se editam nem se apagam. Não escreva senhas." />
            <Botao type="submit" variante="contorno" tamanho="m" className="justify-self-end" disabled={enviando || !texto.trim()}>{enviando ? "Salvando…" : "Salvar nota"}</Botao>
          </form>
        </Cartao>
      ) : null}
    </div>
  );
}
