"use client";
// Acesso da TRÍADE (DC15, telas-modelo suporte-acesso-triade, suporte-inicio-agora e
// suporte-decidir-acesso; peça R4; PI-11; decisão D.1 de 23/10/2026): o síndico aprova ou recusa
// o pedido de ver dados do condomínio e encerra o que está valendo quando quiser. O pedido novo e o
// acesso valendo entram como linhas em Agora, no Início, com Decidir e Encerrar; o que a TRÍADE
// pediu nos últimos 30 dias fica aqui, com quem decidiu e quantas aberturas teve. Sem aprovação, a
// TRÍADE não vê nada fora da ficha.

import { useState } from "react";
import { descreverAcessoExcepcional, formatarDataHora, FUNCOES_CONSOLE, SITUACOES_ACESSO_EXCEPCIONAL } from "@triade/domain";
import {
  AvisoErro, Botao, CampoAreaTexto, Carregando, chamarApi, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi, type Tom,
} from "@triade/ui";
import type { LinhaInicio } from "../CartaoInicio.tsx";
import { Cartao } from "../Ficha.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import { PartesSuporte, TEXTO_SUPORTE, type PedidoAcessoExcepcional } from "./comum.tsx";

const quem = (a: PedidoAcessoExcepcional) => `${a.pedidoPor}${a.funcoes?.length ? ` (${a.funcoes.map((f) => FUNCOES_CONSOLE[f as keyof typeof FUNCOES_CONSOLE]?.toLowerCase() ?? f).join(", ")} TRÍADE)` : ""}`;
const oQue = (a: PedidoAcessoExcepcional) => descreverAcessoExcepcional(a.areas, a.horas).replace(/ por .*/, "");
const aberturas = (n: number) => (n === 0 ? "nenhuma abertura" : n === 1 ? "1 abertura registrada" : `${n} aberturas registradas`);

/** A janela de decidir: o que a TRÍADE pediu, o que a aprovação permite e o motivo para recusar. */
export function DecidirAcesso({ pedido, aoFechar, decidido }: { pedido: PedidoAcessoExcepcional; aoFechar: () => void; decidido: (aprovado: boolean) => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [semMotivo, setSemMotivo] = useState(false);

  async function decidir(aprovar: boolean) {
    setErro(null);
    if (!aprovar && motivo.trim().length < 3) return setSemMotivo(true);
    const r = await chamarApi(`/v1/condominio/acessos-excepcionais/${pedido.id}/decidir`, { corpo: { aprovar, motivo: aprovar ? null : motivo } });
    if (!r.ok) return setErro(r.erro);
    decidido(aprovar);
  }

  return (
    <Dialogo aberto fechar titulo="Acesso da TRÍADE" apoio="Pedido de ver dados do condomínio" aoFechar={aoFechar}>
      <div className="grid gap-4">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="grid gap-1 rounded-[14px] border border-linha bg-fundo px-4 py-3.5">
          <p className="font-semibold">{quem(pedido)} quer ver {descreverAcessoExcepcional(pedido.areas, pedido.horas)}</p>
          <p className="t-texto">&ldquo;{pedido.motivo}&rdquo;</p>
          <p className="t-apoio">Pedido em {formatarDataHora(pedido.criadoEm)}</p>
        </div>
        <ul className="grid list-disc gap-1 pl-5 t-texto">
          <li>Só leitura: a TRÍADE não muda nada.</li>
          <li>Vale só para quem pediu e acaba sozinho no prazo.</li>
          <li>Cada abertura fica no histórico, e dá para encerrar antes.</li>
        </ul>
        <CampoAreaTexto id="ae-motivo" rotulo="Motivo, se recusar" opcional maxLength={500} rows={2} value={motivo}
          onChange={(e) => { setMotivo(e.target.value); setSemMotivo(false); }} ajuda="A TRÍADE fica sabendo do motivo."
          erro={semMotivo ? "Para recusar, diga o motivo (3 a 500 caracteres)." : null} />
        <div className="flex flex-wrap items-center justify-between gap-2 max-md:grid">
          <Botao variante="discreto" onClick={() => void decidir(false)}><Icone nome="fechar" />Recusar</Botao>
          <span className="flex gap-2 max-md:grid">
            <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
            <Botao onClick={() => void decidir(true)}><Icone nome="check" />Aprovar por {pedido.horas} {pedido.horas === 1 ? "hora" : "horas"}</Botao>
          </span>
        </div>
      </div>
    </Dialogo>
  );
}

async function encerrar(id: string): Promise<ErroApi | null> {
  const r = await chamarApi(`/v1/condominio/acessos-excepcionais/${id}/encerrar`, { corpo: {} });
  return r.ok ? null : r.erro;
}

/** As linhas do acesso da TRÍADE em Agora, no Início: o pedido com Decidir e o que vale com Encerrar. */
export function useAcessoNoInicio(): { linhas: LinhaInicio[]; janela: React.ReactNode; erro: React.ReactNode } {
  const { painel, atualizar } = usePlataforma();
  const resumo = painel.acessosExcepcionais;
  const carga = useCarregar<{ acessos: PedidoAcessoExcepcional[] }>(resumo?.valendo ? "/v1/condominio/acessos-excepcionais" : null);
  const [decidindo, setDecidindo] = useState<PedidoAcessoExcepcional | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  if (!resumo) return { linhas: [], janela: null, erro: null };
  const valendo = carga.estado === "pronto" && resumo.valendo ? carga.dados.acessos.filter((a) => a.situacao === "APROVADO") : [];
  const linhas: LinhaInicio[] = [
    ...resumo.pedidos.map((p): LinhaInicio => ({
      chave: `ae-${p.id}`, icone: "escudo", tom: "violeta", titulo: `A TRÍADE pediu para ver ${descreverAcessoExcepcional(p.areas, p.horas)}`,
      detalhe: `${quem(p)} · “${p.motivo}”`, selo: { texto: "Para você", tom: "andamento" },
      acao: <Botao variante="contorno" tamanho="m" className="shrink-0" aria-label={`Decidir o pedido de ${p.pedidoPor}`} onClick={() => setDecidindo(p)}><Icone nome="check" />Decidir</Botao>,
    })),
    ...valendo.map((a): LinhaInicio => ({
      chave: `av-${a.id}`, icone: "escudo", tom: "ok", titulo: `${a.pedidoPor} vê ${oQue(a)} até ${formatarDataHora(a.validoAte ?? "")}`,
      detalhe: `Acesso da TRÍADE valendo · só leitura · ${aberturas(a.leituras)}`,
      acao: (
        <Botao variante="contorno" tamanho="m" className="shrink-0" aria-label={`Encerrar o acesso de ${a.pedidoPor}`}
          onClick={async () => { const e = await encerrar(a.id); setErro(e); if (!e) { carga.recarregar(); atualizar(); } }}>
          <Icone nome="fechar" />Encerrar
        </Botao>
      ),
    })),
  ];
  return {
    linhas,
    erro: erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null,
    janela: decidindo ? <DecidirAcesso pedido={decidindo} aoFechar={() => setDecidindo(null)} decidido={() => { setDecidindo(null); atualizar(); }} /> : null,
  };
}

const TOM_SITUACAO: Record<string, Tom> = { PEDIDO: "andamento", APROVADO: "ok", RECUSADO: "erro", ENCERRADO: "neutro", EXPIRADO: "neutro" };

function detalheDoHistorico(a: PedidoAcessoExcepcional): string {
  const partes = [`“${a.motivo}”`, `pedido em ${formatarDataHora(a.criadoEm)}`];
  if (a.situacao === "RECUSADO") partes.push(`recusado${a.decididoPor ? ` por ${a.decididoPor}` : ""}${a.motivoRecusa ? `: “${a.motivoRecusa}”` : ""}`);
  else if (a.decididoPor) partes.push(`aprovado por ${a.decididoPor}`);
  if (a.situacao === "ENCERRADO") partes.push(`encerrado${a.encerradoPor ? ` por ${a.encerradoPor}` : ""}${a.encerradoEm ? ` em ${formatarDataHora(a.encerradoEm)}` : ""}`);
  if (a.situacao !== "PEDIDO" && a.situacao !== "RECUSADO") partes.push(aberturas(a.leituras));
  return partes.join(" · ");
}

export function AcessoTriade() {
  const { pode, atualizar } = usePlataforma();
  const carga = useCarregar<{ acessos: PedidoAcessoExcepcional[] }>(pode("acesso_excepcional.aprovar") ? "/v1/condominio/acessos-excepcionais" : null);
  const [decidindo, setDecidindo] = useState<PedidoAcessoExcepcional | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const titulo = (
    <div>
      <h1 className="t-titulo-tela">Ajuda e suporte</h1>
      <p className="t-apoio mt-1">{TEXTO_SUPORTE}</p>
    </div>
  );
  if (!pode("acesso_excepcional.aprovar")) return <div className="grid gap-5">{titulo}<Vazio titulo="Só o síndico vê o acesso da TRÍADE">É ele quem aprova ou recusa.</Vazio></div>;
  const mudou = () => { carga.recarregar(); atualizar(); };

  return (
    <div className="grid gap-5">
      <PartesSuporte />
      {titulo}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando o acesso da TRÍADE…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? (() => {
        const pedidos = carga.dados.acessos.filter((a) => a.situacao === "PEDIDO");
        const valendo = carga.dados.acessos.filter((a) => a.situacao === "APROVADO");
        return (
          <>
            {pedidos.length ? (
              <Cartao id="t-ae-pedidos" titulo="Esperando você" icone="sino">
                <ul className="divide-y divide-linha">
                  {pedidos.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                      <span className="ladrilho" data-tom="violeta" aria-hidden="true"><Icone nome="escudo" /></span>
                      <span className="grid min-w-52 flex-1 gap-0.5"><span className="font-medium">{quem(a)} quer ver {descreverAcessoExcepcional(a.areas, a.horas)}</span><span className="t-apoio">&ldquo;{a.motivo}&rdquo;</span></span>
                      <Botao variante="contorno" tamanho="m" aria-label={`Decidir o pedido de ${a.pedidoPor}`} onClick={() => setDecidindo(a)}><Icone nome="check" />Decidir</Botao>
                    </li>
                  ))}
                </ul>
              </Cartao>
            ) : null}
            <Cartao id="t-ae-valendo" titulo="Valendo agora" icone="escudo">
              {valendo.length ? (
                <ul className="divide-y divide-linha">
                  {valendo.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                      <span className="ladrilho" data-tom="ok" aria-hidden="true"><Icone nome="escudo" /></span>
                      <span className="grid min-w-52 flex-1 gap-0.5">
                        <span className="font-medium">{a.pedidoPor} vê {oQue(a)} até {formatarDataHora(a.validoAte ?? "")}</span>
                        <span className="t-apoio">{[a.decididoPor ? `aprovado por ${a.decididoPor}` : null, aberturas(a.leituras)].filter(Boolean).join(" · ")}</span>
                      </span>
                      <Botao variante="contorno" tamanho="m" aria-label={`Encerrar agora o acesso de ${a.pedidoPor}`}
                        onClick={async () => { const e = await encerrar(a.id); setErro(e); if (!e) mudou(); }}><Icone nome="fechar" />Encerrar agora</Botao>
                    </li>
                  ))}
                </ul>
              ) : <p className="t-apoio">Nenhum acesso da TRÍADE valendo agora.</p>}
              <p className="t-apoio">Só leitura. A aprovação vale só para quem pediu e acaba sozinha no prazo.</p>
            </Cartao>
            <Cartao id="t-ae-historico" titulo="Últimos 30 dias" icone="relogio">
              {carga.dados.acessos.length ? (
                <ul className="divide-y divide-linha">
                  {carga.dados.acessos.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                      <span className="ladrilho" data-tom={a.situacao === "RECUSADO" ? "erro" : a.situacao === "APROVADO" ? "ok" : "neutro"} aria-hidden="true"><Icone nome="escudo" /></span>
                      <span className="grid min-w-52 flex-1 gap-0.5"><span className="font-medium">{a.pedidoPor} · {descreverAcessoExcepcional(a.areas, a.horas)}</span><span className="t-apoio">{detalheDoHistorico(a)}</span></span>
                      <Selo tom={TOM_SITUACAO[a.situacao] ?? "neutro"}>{SITUACOES_ACESSO_EXCEPCIONAL[a.situacao as keyof typeof SITUACOES_ACESSO_EXCEPCIONAL] ?? a.situacao}</Selo>
                    </li>
                  ))}
                </ul>
              ) : <p className="t-apoio">A TRÍADE não pediu para ver dados do condomínio nos últimos 30 dias.</p>}
            </Cartao>
          </>
        );
      })() : null}
      {decidindo ? <DecidirAcesso pedido={decidindo} aoFechar={() => setDecidindo(null)} decidido={() => { setDecidindo(null); mudou(); }} /> : null}
    </div>
  );
}
