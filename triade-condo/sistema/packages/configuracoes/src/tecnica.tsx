"use client";
// O que é só da TRÍADE (grupo 1; CF-09, PI-04; decisões 3, 10 e 11 do desenho "Configuração na
// implantação"): fuso, etapas dos pedidos e da manutenção, janela dos parecidos e o tempo de
// anexar o que chega pelo WhatsApp. No app aparece em leitura, com "Pedir mudança"; no Console a
// equipe muda, e com o cliente ativo diz o motivo, que vai no aviso ao síndico e no histórico.

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
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

/** Uma marca só para o que é da TRÍADE (decisão D.1): no bloco do fim da página ou no topo da página que é toda dela. */
export function SeloTriade() {
  return <Selo tom="neutro">Feito pela TRÍADE</Selo>;
}

/** O bloco do fim da página com o que só a TRÍADE muda (decisão D.1). No Console, os ajustes vêm abertos. */
export function BlocoTriade({ children }: { children: ReactNode }) {
  const { onde } = useAmbiente();
  return (
    <section aria-labelledby="t-feito-triade" className="grid gap-2 rounded-[18px] border border-dashed border-neutro-borda bg-neutro-fundo p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="grid gap-0.5">
          <h2 id="t-feito-triade" className="text-[15px] font-semibold">Feito pela TRÍADE</h2>
          <span className="text-[13px] text-tinta-suave">{onde === "app"
            ? "Só a TRÍADE muda. Se precisar, peça e acompanhe em Ajuda e suporte."
            : "Só a TRÍADE muda. Com o cliente ativo, mudar pede motivo e avisa o síndico."}</span>
        </span>
        <SeloTriade />
      </div>
      <div className="grid divide-y divide-linha">{children}</div>
    </section>
  );
}

/** No app: abre um chamado para a TRÍADE já com a parte e o valor de hoje (decisão 11). */
export function PedirMudanca({ parte, valor }: { parte: string; valor: string }) {
  const { onde } = useAmbiente();
  if (onde !== "app") return null;
  const busca = new URLSearchParams({ mudar: parte, valor });
  return <Link href={`/suporte?${busca}`} className={classeBotao("discreto", "", "m")}>Pedir mudança</Link>;
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

  if (!tecnica.pode) {
    // No app, uma linha do bloco "Feito pela TRÍADE": o valor, para que serve e "Pedir mudança".
    return (
      <section aria-labelledby={`t-${id}`} className="flex flex-wrap items-center gap-3 py-3">
        <span className="grid min-w-0 flex-1 gap-0.5">
          <h3 id={`t-${id}`} className="text-sm font-medium">{titulo}</h3>
          <span className="text-sm">{textoAtual}</span>
          <span className="text-[13px] text-tinta-suave">{ajuda}</span>
        </span>
        <PedirMudanca parte={titulo} valor={textoAtual} />
      </section>
    );
  }
  const campos = camposComErro(erro);
  return (
    <form onSubmit={enviar} noValidate aria-labelledby={`t-${id}`} className="grid max-w-2xl gap-3 py-4">
      <h3 id={`t-${id}`} className="font-medium">{titulo}</h3>
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
