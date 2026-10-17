"use client";
// Aba Notas internas (PI-06): só a equipe lê; notas não se editam nem se apagam.

import { useState, type FormEvent } from "react";
import { formatarDataHora } from "@triade/domain";
import { Aviso, Botao, CampoAreaTexto, Carregando, chamarApi, ErroCarregar, FaixaInterna, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { PropsAba } from "./tipos.ts";

interface Nota {
  id: string;
  texto: string;
  criadoEm: string;
  autor: { id: string; nome: string | null };
}

export function AbaNotas({ ficha, pode }: PropsAba) {
  const notas = useCarregar<{ notas: Nota[] }>(`/v1/clientes/${ficha.condominio.id}/notas`);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/clientes/${ficha.condominio.id}/notas`, { corpo: { texto } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    setTexto("");
    notas.recarregar();
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <FaixaInterna>Notas internas · o cliente nunca vê</FaixaInterna>
      {pode("console.notas.escrever") ? (
        <form onSubmit={salvar} className="grid gap-2">
          {erro ? <Aviso tom="erro">{textoDoErro(erro)}</Aviso> : null}
          <CampoAreaTexto id="n-texto" rotulo="Nova nota para a equipe" maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)}
            ajuda="Notas não se editam nem se apagam. Não escreva senhas nem dados que o cliente não autorizou." />
          <Botao type="submit" className="justify-self-end" disabled={enviando || !texto.trim()}>{enviando ? "Salvando…" : "Salvar nota"}</Botao>
        </form>
      ) : null}
      {notas.estado === "carregando" ? <Carregando linhas={2} /> : null}
      {notas.estado === "erro" ? <ErroCarregar texto={notas.texto} tentarDeNovo={notas.recarregar} /> : null}
      {notas.estado === "pronto" && notas.dados.notas.length === 0 ? <Vazio titulo="Nenhuma nota ainda">As notas da equipe sobre este cliente aparecem aqui.</Vazio> : null}
      {notas.estado === "pronto" && notas.dados.notas.length > 0 ? (
        <ul className="grid gap-2">
          {notas.dados.notas.map((n) => (
            <li key={n.id} className="rounded-2xl border border-linha bg-superficie px-4 py-3">
              <p className="text-xs text-tinta-suave">{n.autor.nome ?? "Equipe TRÍADE"} · {formatarDataHora(n.criadoEm)}</p>
              <p className="mt-1 whitespace-pre-wrap">{n.texto}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
