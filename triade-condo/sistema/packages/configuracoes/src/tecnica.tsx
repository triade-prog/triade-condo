"use client";
// O que é só da TRÍADE (grupo 1; CF-09, PI-04; decisões 3, 10 e 11 do desenho "Configuração na
// implantação"): fuso, etapas dos pedidos e da manutenção, janela dos parecidos e o tempo de
// anexar o que chega pelo WhatsApp. No app aparece em leitura, com "Pedir mudança"; no Console a
// equipe muda, e com o cliente ativo diz o motivo, que vai no aviso ao síndico e no histórico.

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AvisoErro, Botao, CampoAreaTexto, camposComErro, classeBotao, Selo, textoDoErro, type ErroApi, type Resposta } from "@triade/ui";
import { useAmbiente } from "./contexto.tsx";
import { Escolha } from "./comum.tsx";
import type { Campo } from "./Janela.tsx";

/** O que o banco diz sobre os ajustes técnicos para quem está vendo. */
export interface Tecnica {
  pode: boolean;
  /** Cliente ativo: mudar pede motivo e avisa o síndico. */
  motivo: boolean;
}

export const AJUDA_MOTIVO = "Vai junto no aviso ao síndico e no histórico do condomínio.";

/** Campo de motivo para as janelas de etapa, quando o cliente já está ativo. */
export const campoMotivo: Campo = {
  id: "motivo", rotulo: "Motivo", tipo: "area", obrigatorio: true, max: 500, ajuda: AJUDA_MOTIVO, erro: "Diga o motivo (3 a 500 caracteres).",
};

export function SeloTriade() {
  return <Selo tom="neutro">Ajustado pela TRÍADE</Selo>;
}

/** No app: abre um chamado para a TRÍADE já com a parte e o valor de hoje (decisão 11). */
export function PedirMudanca({ parte, valor }: { parte: string; valor: string }) {
  const { onde } = useAmbiente();
  if (onde !== "app") return null;
  const busca = new URLSearchParams({ mudar: parte, valor });
  return <Link href={`/suporte?${busca}`} className={classeBotao("contorno", "", "m")}>Pedir mudança</Link>;
}

/** "1 etapa ativa", "3 etapas ativas": o resumo das etapas na faixa da TRÍADE. */
export function etapasAtivas(etapas: { ativa: boolean }[]): string {
  const n = etapas.filter((e) => e.ativa).length;
  return `${n} ${n === 1 ? "etapa ativa" : "etapas ativas"}`;
}

/** Faixa do app sobre uma parte que é da TRÍADE (tela 6). */
export function FaixaTriade({ parte, valor, porque }: { parte: string; valor: string; porque: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-linha bg-superficie-2 px-4 py-3 text-sm">
      <span className="grid gap-0.5">
        <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{porque}</span><SeloTriade /></span>
        <span className="text-tinta-suave">Por isso quem muda é a TRÍADE. Peça a mudança e explique o que precisa.</span>
      </span>
      <PedirMudanca parte={parte} valor={valor} />
    </div>
  );
}

/**
 * Um ajuste de escolha única (fuso, janela dos parecidos, tempo de anexar). Quem não pode vê o
 * valor com a marca e "Pedir mudança"; a equipe escolhe e salva, com motivo se o cliente está ativo.
 */
export function AjusteTecnico<T extends string>({ id, titulo, parte, ajuda, opcoes, atual, tecnica, salvar, aoSalvar, recarregar }: {
  id: string;
  titulo: string;
  parte: string;
  ajuda: string;
  opcoes: { valor: T; texto: string }[];
  atual: T;
  tecnica: Tecnica;
  salvar: (valor: T, motivo: string | undefined) => Promise<Resposta<unknown>>;
  aoSalvar: (valor: T) => void;
  recarregar?: () => void;
}) {
  const [valor, setValor] = useState<T>(atual);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const textoAtual = opcoes.find((o) => o.valor === atual)?.texto ?? atual;

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await salvar(valor, motivo.trim() || undefined);
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoSalvar(valor);
  }

  const cabeca = (
    <div className="flex flex-wrap items-center gap-2">
      <h2 id={`t-${id}`} className="text-lg font-medium">{titulo}</h2>
      <Selo tom="neutro">Só a TRÍADE</Selo>
    </div>
  );
  if (!tecnica.pode) {
    return (
      <section aria-labelledby={`t-${id}`} className="grid max-w-2xl gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
        {cabeca}
        <p className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{textoAtual}</span><SeloTriade /></p>
        <p className="text-xs text-tinta-suave">{ajuda}</p>
        <div><PedirMudanca parte={titulo} valor={textoAtual} /></div>
      </section>
    );
  }
  const campos = camposComErro(erro);
  return (
    <form onSubmit={enviar} noValidate aria-labelledby={`t-${id}`} className="grid max-w-2xl gap-3 rounded-[18px] border border-linha bg-superficie p-5 shadow-s1">
      {cabeca}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      <Escolha rotulo={parte} atual={valor} aoMudar={setValor} opcoes={opcoes} />
      <p className="text-xs text-tinta-suave">{ajuda}</p>
      {tecnica.motivo ? (
        <CampoAreaTexto id={`${id}-motivo`} rotulo="Motivo" required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)}
          ajuda={AJUDA_MOTIVO} erro={campos.includes("motivo") ? "Diga o motivo (3 a 500 caracteres)." : null} />
      ) : null}
      <div className="flex justify-end">
        <Botao type="submit" disabled={enviando || valor === atual}>{enviando ? "Salvando…" : tecnica.motivo ? "Mudar e avisar" : "Salvar"}</Botao>
      </div>
    </form>
  );
}
