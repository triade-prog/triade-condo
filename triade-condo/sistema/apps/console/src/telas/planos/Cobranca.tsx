"use client";
// Uma cobrança (quadro 251; PI-07, PI-08): os valores, os recebimentos, os ajustes com motivo e o
// histórico. Corrigir é sempre por ajuste; falta conta só o conferido; o atraso só avisa.

import { useParams } from "next/navigation";
import { useState } from "react";
import { formatarDataHora, FORMAS_RECEBIMENTO, mostrarDataSemHora, mostrarValor, ESTADOS_RECEBIMENTO, TIPOS_AJUSTE, type FormaRecebimento, type TipoAjuste } from "@triade/domain";
import { Aviso, Botao, Carregando, ErroCarregar, Icone, Selo, type NomeIcone, type Tom } from "@triade/ui";
import { Cartao, Voltar } from "../comum.tsx";
import { nomeCobranca, SeloCobranca } from "../ficha/AbaPlano.tsx";
import { useCarregar } from "../sessao.tsx";
import type { Cobranca as TipoCobranca, Recebimento } from "./comum.tsx";
import { JanelaAjuste, JanelaConferir, JanelaRecebimento, JanelaValor } from "./janelas.tsx";

interface Detalhe extends TipoCobranca {
  plano?: string;
  listaAjustes: { id: string; tipo: TipoAjuste; valor: number; motivo: string; autor?: string; em: string }[];
  recebimentos: Recebimento[];
  historico: { acao: string; em: string; autor?: string; dados: Record<string, unknown> }[];
  permissoes: { registrar: boolean; conferir: boolean; ajustar: boolean };
}

const ACOES: Record<string, { texto: string; icone: NomeIcone; tom: Tom | "violeta" }> = {
  "cobranca.aberta": { texto: "Cobrança aberta", icone: "calendario", tom: "neutro" },
  "cobranca.ajustada": { texto: "Ajuste", icone: "editar", tom: "andamento" },
  "cobranca.valor_definido": { texto: "Valor definido", icone: "editar", tom: "andamento" },
  "recebimento.registrado": { texto: "Recebimento registrado · a conferir", icone: "dinheiro", tom: "info" },
  "recebimento.identificado": { texto: "Recebimento sem cliente identificado · a conferir", icone: "dinheiro", tom: "info" },
  "recebimento.conferido": { texto: "Recebimento confirmado", icone: "check", tom: "ok" },
  "recebimento.devolvido": { texto: "Recebimento devolvido", icone: "retorno", tom: "neutro" },
};

const TOM_RECEBIMENTO: Record<Recebimento["estado"], Tom> = { A_CONFERIR: "info", CONFERIDO: "ok", DEVOLVIDO: "neutro" };

type Janela = "registrar" | "ajuste" | "valor" | { conferir: Recebimento } | null;

export function Cobranca() {
  const { condominio, cobranca } = useParams<{ condominio: string; cobranca: string }>();
  const carga = useCarregar<Detalhe>(`/v1/clientes/${condominio}/cobrancas/${cobranca}`);
  const [janela, setJanela] = useState<Janela>(null);
  const [recado, setRecado] = useState<string | null>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Abrindo a cobrança…" />;
  if (carga.estado === "erro") {
    return (
      <div className="grid gap-4">
        <Voltar href="/pagamentos" texto="Voltar a Pagamentos" />
        <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} />
      </div>
    );
  }
  const c = carga.dados;
  const fechar = () => setJanela(null);
  const feito = (texto: string) => { fechar(); setRecado(texto); carga.recarregar(); };
  const linha = (a: string, b: string, forte?: boolean) => (
    <div className={`flex justify-between gap-3 border-t border-linha py-2.5 t-texto ${forte ? "font-semibold" : ""}`}><span>{a}</span><span>{b}</span></div>
  );

  return (
    <div className="grid gap-5">
      <div className="grid gap-3">
        <Voltar href="/pagamentos" texto="Voltar a Pagamentos" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="t-titulo-tela">{c.cliente} · {nomeCobranca(c)}</h1>
            <p className="t-apoio">{c.tipo === "IMPLANTACAO" ? `Implantação · ${c.referencia}` : "Mensalidade"} · {c.emAtraso ? "venceu" : "vence"} em {mostrarDataSemHora(c.venceEm)}</p>
          </div>
          <span className="flex flex-wrap gap-2">
            {c.permissoes.ajustar && c.situacao === "A_DEFINIR" ? <Botao variante="contorno" onClick={() => setJanela("valor")}><Icone nome="editar" />Definir valor</Botao> : null}
            {c.permissoes.ajustar && c.situacao !== "A_DEFINIR" ? <Botao variante="contorno" onClick={() => setJanela("ajuste")}><Icone nome="editar" />Ajustar</Botao> : null}
            {c.permissoes.registrar ? <Botao onClick={() => setJanela("registrar")}><Icone nome="mais" />Registrar recebimento</Botao> : null}
          </span>
        </div>
        <span className="flex flex-wrap gap-2">
          {c.emAtraso ? <Selo tom="atencao">{`Em atraso há ${c.diasDeAtraso} ${c.diasDeAtraso === 1 ? "dia" : "dias"}`}</Selo> : null}
          <SeloCobranca c={{ ...c, emAtraso: false }} />
        </span>
      </div>
      {recado ? <Aviso tom="ok" papel="status">{recado}</Aviso> : null}
      {c.emAtraso ? (
        <Aviso tom="neutro" titulo="O atraso não bloqueia o condomínio">
          A síndica e os moradores continuam usando tudo. Combine com o cliente fora do sistema; nada é enviado a ele por aqui.
        </Aviso>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="grid gap-6">
          <Cartao id="t-valores" titulo="Valores" icone="dinheiro">
            <div>
              {linha(c.tipo === "IMPLANTACAO" ? "Implantação" : `Mensalidade${c.plano ? ` do plano ${c.plano}` : ""}`, mostrarValor(c.valor))}
              {c.listaAjustes.map((a) => linha(`Ajuste: ${TIPOS_AJUSTE[a.tipo].toLowerCase()}`, `${a.valor < 0 ? "− " : "+ "}${mostrarValor(Math.abs(a.valor))}`))}
              {linha("Devido", mostrarValor(c.devido), true)}
              {linha("Recebido e conferido", mostrarValor(c.conferido))}
              {linha("A conferir", mostrarValor(c.aConferir))}
              {linha("Falta", c.falta === undefined ? "Valor a definir" : mostrarValor(c.falta), true)}
            </div>
          </Cartao>
          <Cartao id="t-recebimentos" titulo="Recebimentos" icone="lista">
            {c.recebimentos.length ? (
              <ul className="grid">
                {c.recebimentos.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 border-t border-linha py-2.5 first:border-t-0">
                    <span className="grid flex-1">
                      <span className="t-texto font-medium">{mostrarValor(r.valor)} · {FORMAS_RECEBIMENTO[r.forma as FormaRecebimento] ?? r.forma} · {mostrarDataSemHora(r.recebidoEm)}</span>
                      <span className="t-apoio font-mono [overflow-wrap:anywhere]">{r.referencia}</span>
                      {r.devolvidoMotivo ? <span className="t-apoio">Devolvido: {r.devolvidoMotivo}</span> : null}
                    </span>
                    <Selo tom={TOM_RECEBIMENTO[r.estado]}>{ESTADOS_RECEBIMENTO[r.estado]}</Selo>
                    {r.estado === "A_CONFERIR" && c.permissoes.conferir ? <Botao variante="contorno" tamanho="m" onClick={() => setJanela({ conferir: r })}>Conferir</Botao> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="t-apoio">Nada registrado ainda.</p>}
          </Cartao>
        </div>
        <Cartao id="t-historico" titulo="Histórico" icone="relogio">
          <ul className="grid">
            {c.historico.map((h, i) => {
              const a = ACOES[h.acao] ?? { texto: h.acao, icone: "relogio" as const, tom: "neutro" as const };
              const ajuste = h.acao === "cobranca.ajustada" ? c.listaAjustes.find((x) => x.em.slice(0, 19) === h.em.slice(0, 19)) : undefined;
              return (
                <li key={i} className="flex gap-3 border-t border-linha py-2.5 first:border-t-0">
                  <span className="ladrilho h-8 w-8 rounded-[10px]" data-tom={a.tom} aria-hidden="true"><Icone nome={a.icone} className="h-4 w-4" /></span>
                  <span className="grid gap-0.5">
                    <span className="t-texto">{a.texto}{ajuste ? ` ${ajuste.valor < 0 ? "−" : "+"} ${mostrarValor(Math.abs(ajuste.valor))} · motivo: ${ajuste.motivo}` : ""}</span>
                    <span className="t-apoio text-tinta-suave">{formatarDataHora(h.em)}{h.autor ? ` · ${h.autor}` : ""}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Cartao>
      </div>

      {janela === "registrar" ? <JanelaRecebimento clientes={[{ id: c.condominioId, nome: c.cliente }]} cobrancas={[c]} inicial={{ cliente: c.condominioId, cobranca: c.id }} aoFechar={fechar} feito={feito} /> : null}
      {janela === "ajuste" ? <JanelaAjuste c={c} aoFechar={fechar} feito={feito} /> : null}
      {janela === "valor" ? <JanelaValor c={c} aoFechar={fechar} feito={feito} /> : null}
      {janela && typeof janela === "object" ? <JanelaConferir r={{ ...janela.conferir, condominioId: c.condominioId, cliente: c.cliente }} cobranca={c} aoFechar={fechar} feito={feito} /> : null}
    </div>
  );
}
