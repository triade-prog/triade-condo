"use client";
// O que é só da TRÍADE (grupo 1; CF-09, PI-04; decisões 3, 10 e 11 do desenho "Configuração na
// implantação"): fuso, etapas dos pedidos e da manutenção, janela dos parecidos e o tempo de
// anexar o que chega pelo WhatsApp. No app aparece em leitura, com "Pedir mudança"; no Console a
// equipe muda, e com o cliente ativo diz o motivo, que vai no aviso ao síndico e no histórico.

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { PARTES_MUDANCA, rotuloSituacaoChamadoCliente, type ParteMudanca } from "@triade/domain";
import {
  AvisoErro, Botao, CampoAreaTexto, camposComErro, chamarApi, Dialogo, Icone, Selo, textoDoErro, type ErroApi, type Resposta,
} from "@triade/ui";
import { useAmbiente, useCarregar } from "./contexto.tsx";
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
          <h2 id="t-feito-triade" className="t-titulo-cartao font-semibold">Feito pela TRÍADE</h2>
          <span className="t-apoio text-tinta-suave">{onde === "app"
            ? "Só a TRÍADE muda. Peça aqui mesmo; a resposta chega no sino e em Ajuda e suporte."
            : "Só a TRÍADE muda. Com o cliente ativo, mudar pede motivo e avisa o síndico."}</span>
        </span>
        <SeloTriade />
      </div>
      <div className="grid divide-y divide-linha">{children}</div>
    </section>
  );
}

/** Uma mudança pedida e ainda aberta (0286): "ver" diz se a pessoa pode abrir o chamado. */
interface MudancaPedida { parte: string; id: string; numero: number; situacao: string; abertoPor: string; ver: boolean }

/**
 * No app, o "Pedir mudança à TRÍADE" (item 8, decisões A.1 e B.1 de 23/10/2026): abre uma janela
 * ali mesmo, com a parte e o valor de hoje, e vira um chamado de Mudança de configuração. Com um
 * pedido aberto para a parte, mostra "Mudança pedida", a situação e "Ver chamado", em vez de
 * oferecer pedir de novo.
 */
export function PedirMudanca({ parte, valor }: { parte: ParteMudanca; valor: string }) {
  const { onde } = useAmbiente();
  const pedidas = useCarregar<{ itens: MudancaPedida[] }>(onde === "app" ? "/v1/condominio/chamados/mudancas" : null);
  const [aberta, setAberta] = useState(false);
  if (onde !== "app") return null;
  const pedida = pedidas.estado === "pronto" ? pedidas.dados.itens.find((m) => m.parte === parte) : undefined;
  if (pedida) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Selo tom="andamento"><Icone nome="trocar" className="h-3.5 w-3.5" />Mudança pedida</Selo>
        <Selo tom={pedida.situacao === "ESPERANDO_CLIENTE" ? "atencao" : "info"}>{rotuloSituacaoChamadoCliente(pedida.situacao)}</Selo>
        {pedida.ver
          ? <Link href={`/suporte?id=${pedida.id}`} className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline">
              Ver chamado {pedida.numero}<Icone nome="dir" className="h-4 w-4" />
            </Link>
          : <span className="t-apoio text-tinta-suave">chamado {pedida.numero}, por {pedida.abertoPor}</span>}
      </span>
    );
  }
  return (
    <>
      <Botao variante="discreto" tamanho="m" onClick={() => setAberta(true)} disabled={pedidas.estado === "carregando"}>
        <Icone nome="trocar" />Pedir mudança
      </Botao>
      {aberta ? <JanelaPedirMudanca parte={parte} valor={valor} aoFechar={() => setAberta(false)} aoPedir={() => { setAberta(false); pedidas.recarregar(); }} /> : null}
    </>
  );
}

function JanelaPedirMudanca({ parte, valor, aoFechar, aoPedir }: { parte: ParteMudanca; valor: string; aoFechar: () => void; aoPedir: () => void }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function pedir(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi("/v1/condominio/chamados/mudanca", { corpo: { parte, hoje: valor, texto } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoPedir();
  }

  const fixo = "flex min-h-11 items-center rounded-xl border border-linha bg-fundo px-3.5 py-2.5 t-texto";
  return (
    <Dialogo aberto media fechar titulo="Pedir mudança à TRÍADE" apoio="A parte e o valor de hoje já vêm preenchidos." aoFechar={aoFechar}>
      <form onSubmit={pedir} noValidate className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1"><dt className="t-apoio font-medium">Parte</dt><dd className={fixo}>{PARTES_MUDANCA[parte].nome}</dd></div>
          <div className="grid gap-1"><dt className="t-apoio font-medium">Como está hoje</dt><dd className={fixo}>{valor}</dd></div>
        </dl>
        <CampoAreaTexto id={`mudar-${parte}`} rotulo="O que precisa e por quê" required maxLength={4000} value={texto} onChange={(e) => setTexto(e.target.value)}
          ajuda="A TRÍADE responde em dias úteis, das 9h às 18h, e pode pedir mais detalhes."
          erro={camposComErro(erro).includes("texto") ? "Diga o que precisa e por quê." : null} />
        <p className="t-apoio text-tinta-suave">Vai como chamado de Mudança de configuração. Acompanhe aqui ou em Ajuda e suporte.</p>
        <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-2 rounded-b-[24px] border-t border-linha bg-superficie px-6 py-4 max-md:grid max-md:rounded-none">
          <Botao variante="discreto" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="enviar" />{enviando ? "Enviando…" : "Pedir a mudança"}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** "1 etapa ativa", "3 etapas ativas": o resumo das etapas na faixa da TRÍADE. */
export function etapasAtivas(etapas: { ativa: boolean }[]): string {
  const n = etapas.filter((e) => e.ativa).length;
  return `${n} ${n === 1 ? "etapa ativa" : "etapas ativas"}`;
}

/** Faixa do app sobre uma parte que é da TRÍADE (tela 6). */
export function FaixaTriade({ parte, valor, porque }: { parte: ParteMudanca; valor: string; porque: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-linha bg-superficie-2 px-4 py-3 t-texto">
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
export function AjusteTecnico<T extends string>({ id, titulo, parte, mudanca, ajuda, opcoes, atual, tecnica, salvar, aoSalvar, recarregar }: {
  id: string;
  titulo: string;
  parte: string;
  /** A parte no "Pedir mudança" do app (0286). */
  mudanca: ParteMudanca;
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
          <h3 id={`t-${id}`} className="t-texto font-medium">{titulo}</h3>
          <span className="t-texto">{textoAtual}</span>
          <span className="t-apoio text-tinta-suave">{ajuda}</span>
        </span>
        <PedirMudanca parte={mudanca} valor={textoAtual} />
      </section>
    );
  }
  const campos = camposComErro(erro);
  return (
    <form onSubmit={enviar} noValidate aria-labelledby={`t-${id}`} className="grid max-w-2xl gap-3 py-4">
      <h3 id={`t-${id}`} className="font-medium">{titulo}</h3>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={recarregar} /> : null}
      <Escolha rotulo={parte} atual={valor} aoMudar={setValor} opcoes={opcoes} />
      <p className="t-apoio text-tinta-suave">{ajuda}</p>
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
