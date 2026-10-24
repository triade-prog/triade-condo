"use client";
// Sugestão automática na ficha do pedido (IA-17, IA-15, IA-11 triagem; telas-modelo/ia-ficha-*,
// ia-estados). A IA só sugere: o cartão tracejado espera quem atende confirmar, e usar a sugestão
// preenche categoria, prioridade e local pelo caminho de sempre, com o nome de quem usou no
// histórico. Escolher outra deixa no histórico o que a IA tinha sugerido. Sem confiança, desligada
// ou sem provedor, não há cartão: o pedido segue como sempre. O morador não vê nada disso.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { diaDeRenovar } from "@triade/domain";
import { Botao, chamarApi, Icone, IconeMarca, Selo, textoDoErro } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { useCarregar } from "../sessao.tsx";
import type { OpcoesPedidos, PedidoDetalhe } from "../tipos.ts";
import { SeloPrioridade } from "./comum.tsx";

export interface SugestaoDoPedido {
  id: string;
  estado: "PREPARANDO" | "PRONTA" | "SEM_SUGESTAO" | "FALHA" | "LIMITE" | "USADA" | "RECUSADA";
  categoria?: { id: string; nome: string };
  prioridade?: { id: string; nome: string; significado?: string };
  local?: string;
  porque?: string;
  renovaEm?: string;
  versao: number;
}

export type EstadoTranscricao = "TRANSCREVENDO" | "PRONTA" | "SEM_TRANSCRICAO" | "FALHA" | "LIMITE";
export interface TranscricaoAudio { estado: EstadoTranscricao; texto?: string; segundos?: number; renovaEm?: string }

export interface IaDoPedido {
  sugestao?: SugestaoDoPedido;
  transcricoes: Record<string, TranscricaoAudio>;
  sugerir: string;
  transcrever: string;
  pode: { decidir: boolean; pedir: boolean };
}

/** O que a IA tem para o pedido. Pede a sugestão uma vez quando cabe, e volta a olhar enquanto
 * a sugestão prepara ou um áudio transcreve. */
export function useIaDoPedido(pedidoId: string | null) {
  const carga = useCarregar<IaDoPedido>(pedidoId ? `/v1/condominio/pedidos/${pedidoId}/ia` : null);
  const [preparando, setPreparando] = useState(false);
  const pedido = useRef<string | null>(null);
  const dados = carga.estado === "pronto" ? carga.dados : null;
  const { recarregar } = carga;

  async function pedir() {
    if (!pedidoId) return;
    setPreparando(true);
    await chamarApi(`/v1/condominio/pedidos/${pedidoId}/sugestao`, { metodo: "POST" });
    setPreparando(false);
    recarregar();
  }

  useEffect(() => {
    if (!dados || !pedidoId || pedido.current === pedidoId) return;
    if (dados.pode.pedir && !dados.sugestao) {
      pedido.current = pedidoId;
      // Fora do corpo do efeito; sem limpar, para o pedido sair uma vez só mesmo se o efeito repetir.
      setTimeout(() => void pedir(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, pedidoId]);

  const esperando = Object.values(dados?.transcricoes ?? {}).some((t) => t.estado === "TRANSCREVENDO") || dados?.sugestao?.estado === "PREPARANDO";
  useEffect(() => {
    if (!esperando) return;
    const t = setTimeout(recarregar, 4000);
    return () => clearTimeout(t);
  }, [esperando, dados, recarregar]);

  return { dados, preparando, recarregar, tentarDeNovo: () => void pedir() };
}

function Linha({ icone, nome, children }: { icone: "ferramenta" | "alerta" | "pin"; nome: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_120px_minmax(0,1fr)] items-center gap-3 border-t border-linha py-3 max-md:grid-cols-[28px_minmax(0,1fr)]">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-superficie-2 text-tinta-suave" aria-hidden="true"><Icone nome={icone} className="h-4 w-4" /></span>
      <span className="t-texto text-tinta-suave">{nome}</span>
      <span className="t-texto max-md:col-start-2">{children}</span>
    </div>
  );
}

function Moldura({ selo, children }: { selo?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby="t-sugestao" className="grid gap-3 rounded-[18px] border border-dashed border-violeta-300 bg-superficie p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          <span className="text-violeta-600" aria-hidden="true"><Icone nome="etiqueta" /></span>
          <h2 id="t-sugestao" className="t-titulo-cartao">Sugestão automática</h2>
        </span>
        {selo}
      </div>
      {children}
    </section>
  );
}

/** Linhas cinzas no lugar do texto que ainda vem. */
export function Esqueleto({ linhas = 3 }: { linhas?: number }) {
  return (
    <span className="grid gap-2" aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => <span key={i} className="h-2.5 rounded-full bg-superficie-2 motion-safe:animate-pulse" style={{ width: `${[100, 85, 60][i % 3]}%` }} />)}
    </span>
  );
}

export function LinkUsoIa() {
  return (
    <Link href="/configuracoes/ia" className="inline-flex items-center gap-1 t-texto font-medium text-violeta-600 hover:underline">
      Ver o uso em Configurações<Icone nome="dir" className="h-4 w-4" />
    </Link>
  );
}

/** O cartão na ficha. Some quando não há o que confirmar. */
export function CartaoSugestao({ d, opcoes, ia, preparando, tentarDeNovo, salvo, falhou }: {
  d: PedidoDetalhe; opcoes: OpcoesPedidos; ia: IaDoPedido | null; preparando: boolean; tentarDeNovo: () => void;
  salvo: (texto: string) => void; falhou: (texto: string) => void;
}) {
  const [escolher, setEscolher] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const p = d.pedido;
  const s = ia?.sugestao;
  if (preparando || s?.estado === "PREPARANDO") {
    return (
      <Moldura selo={<Selo tom="neutro"><Icone nome="relogio" className="h-3.5 w-3.5" />Preparando</Selo>}>
        <Esqueleto />
        <p className="t-apoio">Os campos do pedido seguem livres enquanto isso.</p>
      </Moldura>
    );
  }
  if (!s || !ia) return null;
  if (s.estado === "LIMITE") {
    return (
      <Moldura selo={<Selo tom="neutro"><IconeMarca marca="pausa" />Parada até {diaDeRenovar(s.renovaEm)}</Selo>}>
        <p className="t-texto text-tinta-suave">O condomínio usou as sugestões do mês. Escolha categoria, prioridade e local nos dados do pedido.</p>
        <LinkUsoIa />
      </Moldura>
    );
  }
  if (s.estado === "FALHA") {
    return (
      <Moldura selo={<Selo tom="atencao">Não saiu</Selo>}>
        <p className="t-texto text-tinta-suave">Não deu para sugerir agora. Escolha nos dados do pedido ou tente de novo.</p>
        {ia.pode.pedir ? <Botao variante="contorno" className="justify-self-start" onClick={tentarDeNovo}><Icone nome="trocar" />Tentar de novo</Botao> : null}
      </Moldura>
    );
  }
  if (s.estado !== "PRONTA" || !s.categoria || !s.prioridade) return null;

  async function decidir(rota: "usar" | "recusar", corpo: Record<string, unknown>) {
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/pedidos/${p.id}/sugestao/${rota}`, { corpo: { versao: p.versao, ...corpo } });
    setEnviando(false);
    if (!r.ok) {
      // Na janela de escolher, o erro aparece nela; o toque direto avisa na ficha.
      if (rota === "usar") falhou(textoDoErro(r.erro));
      return r;
    }
    setEscolher(false);
    salvo(rota === "usar" ? "Sugestão usada: categoria, prioridade e local preenchidos." : "Escolha salva. O histórico guarda o que a IA tinha sugerido.");
    return r;
  }

  const onde = [p.unidade?.nome, s.local].filter(Boolean).join(" · ");
  return (
    <Moldura selo={<Selo tom="neutro"><Icone nome="relogio" className="h-3.5 w-3.5" />Espera você confirmar</Selo>}>
      <p className="t-apoio">A IA leu o relato{Object.keys(ia.transcricoes).length ? " e o áudio" : ""} e sugere como tratar. Nada muda no pedido até quem atende confirmar.</p>
      <div>
        <Linha icone="ferramenta" nome="Categoria">{s.categoria.nome}</Linha>
        <Linha icone="alerta" nome="Prioridade">
          <span className="flex flex-wrap items-center gap-2">
            {/^(alta|urgente)/i.test(s.prioridade.nome) ? <SeloPrioridade nome={s.prioridade.nome} /> : <span>{s.prioridade.nome}</span>}
            {s.prioridade.significado ? <span className="t-apoio">{s.prioridade.significado}</span> : null}
          </span>
        </Linha>
        <Linha icone="pin" nome="Local">{onde || <span className="t-apoio">O relato não diz</span>}</Linha>
      </div>
      {s.porque ? <p className="rounded-[14px] border border-linha bg-fundo px-3 py-2.5 t-texto"><strong className="font-semibold">Por quê:</strong> {s.porque}</p> : null}
      {ia.pode.decidir ? (
        <div className="flex flex-wrap items-center gap-2">
          <Botao variante="contorno" disabled={enviando} onClick={() => void decidir("usar", {})}><Icone nome="check" />Usar a sugestão</Botao>
          <Botao variante="discreto" disabled={enviando} onClick={() => setEscolher(true)}><Icone nome="editar" />Escolher outra</Botao>
        </div>
      ) : null}
      <p className="t-apoio flex gap-1.5"><Icone nome="info" className="mt-0.5 h-3.5 w-3.5" />
        Quem atende confirma. Usar a sugestão preenche categoria, prioridade e local e fica no histórico com o seu nome. O morador não vê a sugestão.</p>
      <Janela aberto={escolher} titulo="Escolher outra" textoBotao="Salvar a escolha" aoFechar={() => setEscolher(false)} recarregar={() => {}}
        explicacao="Comece pelo que a IA sugeriu e troque o que precisar. O histórico guarda a sugestão e a sua escolha."
        campos={[
          { id: "categoriaId", rotulo: "Categoria", tipo: "selecao", opcoes: opcoes.categorias.filter((c) => c.ativa).map((c) => ({ valor: c.id, texto: c.nome })) },
          { id: "prioridadeId", rotulo: "Prioridade", tipo: "selecao", opcoes: opcoes.prioridades.filter((x) => x.ativa).map((x) => ({ valor: x.id, texto: x.nome })) },
          { id: "local", rotulo: p.unidade ? "Onde, na unidade (opcional)" : "Local", tipo: "texto", max: 120, erro: "Informe a unidade ou o local (2 a 120 caracteres)." },
        ]}
        iniciais={{ categoriaId: s.categoria.id, prioridadeId: s.prioridade.id, local: s.local ?? p.local ?? "" }}
        aoSalvar={(v) => decidir("recusar", { categoriaId: v.categoriaId, prioridadeId: v.prioridadeId, local: String(v.local ?? "").trim() || null })} />
    </Moldura>
  );
}
