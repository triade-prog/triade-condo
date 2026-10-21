"use client";
// Peças comuns das decisões pedidas ao síndico (F7.4; AT-23; DC15, telas-modelo decisoes-* e
// decidir): o selo do prazo ou da resposta, as alternativas numeradas com o custo estimado e as
// janelas de decidir e de retirar. Aprovar não contrata nem paga nada: a resposta só fica
// registrada.

import { useState, type FormEvent } from "react";
import { mostrarCusto, prazoDaDecisao } from "@triade/domain";
import { AvisoErro, Botao, CampoAreaTexto, camposComErro, chamarApi, Dialogo, Icone, Selo, textoDoErro, type ErroApi } from "@triade/ui";
import { Janela } from "../Janela.tsx";
import { dia, diaHora } from "../pedidos/comum.tsx";
import type { AlternativaDecisao, DecisaoPedido } from "../tipos.ts";

/** "24/10", do prazo "2026-10-24". */
export const diaDoPrazo = (prazo: string) => `${prazo.slice(8, 10)}/${prazo.slice(5, 7)}`;

/** O prazo, enquanto aguarda; depois, a resposta. */
export function SeloDecisao({ d, hoje }: { d: DecisaoPedido; hoje: string }) {
  if (d.estado === "APROVADA") return <Selo tom="ok">Aprovada a alternativa {d.alternativaAprovada}</Selo>;
  if (d.estado === "DEVOLVIDA") return <Selo tom="atencao">Devolvida</Selo>;
  if (d.estado === "RETIRADA") return <Selo tom="neutro">Retirada</Selo>;
  const p = prazoDaDecisao(d.prazo, hoje);
  return <Selo tom={p.tom}>{p.texto}</Selo>;
}

/** O que aconteceu com a decisão respondida ou retirada, em uma linha. */
export function resumoResposta(d: DecisaoPedido): string | null {
  if (!d.respondidaEm) return null;
  const quem = d.respondidaPor ? ` por ${d.respondidaPor}` : "";
  if (d.estado === "RETIRADA") return `Retirada${quem} em ${diaHora(d.respondidaEm)}${d.retiradaMotivo ? `: ${d.retiradaMotivo}` : ""}`;
  const alt = d.alternativas.find((a) => a.numero === d.alternativaAprovada);
  const o_que = d.estado === "APROVADA" ? `Aprovada a alternativa ${d.alternativaAprovada}${alt ? ` (${alt.descricao})` : ""}` : "Devolvida sem decidir";
  return `${o_que}${quem} em ${diaHora(d.respondidaEm)}${d.justificativa ? `: ${d.justificativa}` : ""}`;
}

const custo = (a: AlternativaDecisao) => (a.custo !== undefined && a.custo !== null ? mostrarCusto(a.custo) : "sem custo");

/** As alternativas só para ler: o número num círculo, o que é e o custo; a aprovada marcada. */
export function ListaAlternativas({ alternativas, aprovada }: { alternativas: AlternativaDecisao[]; aprovada?: number }) {
  return (
    <ul className="grid gap-2">
      {alternativas.map((a) => (
        <li key={a.numero} className={`flex items-center gap-3 rounded-[14px] border px-3 py-2.5 text-sm ${a.numero === aprovada ? "border-violeta-600 bg-violeta-50" : "border-linha bg-violeta-50/40"}`}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violeta-100 text-[13px] font-semibold text-violeta-700" aria-hidden="true">{a.numero}</span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span><span className="sr-only">{a.numero} · </span>{a.descricao}</span>
            {a.detalhe ? <span className="text-xs text-tinta-suave">{a.detalhe}</span> : null}
          </span>
          <span className="t-codigo shrink-0">{custo(a)}</span>
          {a.numero === aprovada ? <span className="sr-only">(aprovada)</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Decidir (decisões 6 e 7): escolher uma alternativa ou devolver, sempre com justificativa. */
function FormResponder({ d, aoFechar, salvo, recarregar }: { d: DecisaoPedido; aoFechar: () => void; salvo: (t: string) => void; recarregar: () => void }) {
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);

  async function responder(aprovar: boolean, ev?: FormEvent) {
    ev?.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/decisoes/${d.id}/responder`, {
      corpo: { versao: d.versao, aprovar, alternativa: aprovar ? escolhida : null, justificativa: justificativa.trim() },
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    salvo(aprovar ? `Alternativa ${escolhida} aprovada. Quem pediu foi avisado no sino.` : "Decisão devolvida. Quem pediu foi avisado no sino.");
  }

  return (
    <form onSubmit={(ev) => void responder(true, ev)} noValidate className="grid gap-4">
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} recarregar={() => { aoFechar(); recarregar(); }} /> : null}
      <p className="t-apoio md:hidden">{apoioDecidir(d)}</p>
      <div className="grid gap-1 rounded-[14px] border border-linha bg-violeta-50/50 p-4">
        <p className="text-sm font-semibold">{d.pergunta}</p>
        {d.porque ? <p className="text-sm">{d.porque}</p> : null}
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[13px] font-medium">Alternativas</legend>
        {d.alternativas.map((a) => {
          const marcada = escolhida === a.numero;
          return (
            <label key={a.numero}
              className={`flex cursor-pointer items-start gap-3 rounded-[14px] p-4 text-sm ${marcada ? "border-2 border-violeta-600 bg-violeta-50 p-[15px]" : "border border-linha bg-superficie hover:border-violeta-300"}`}>
              <input type="radio" name={`alt-${d.id}`} value={a.numero} checked={marcada} onChange={() => setEscolhida(a.numero)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-violeta-600" />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-medium">{a.numero} · {a.descricao}</span>
                  <span className="t-codigo">{custo(a)}</span>
                </span>
                {a.detalhe ? <span className="text-xs text-tinta-suave">{a.detalhe}</span> : null}
              </span>
            </label>
          );
        })}
        {comErro.includes("alternativa") ? <p className="text-sm text-erro">Escolha a alternativa que você aprova.</p> : null}
      </fieldset>
      <CampoAreaTexto id={`just-${d.id}`} rotulo="Justificativa" required maxLength={1000} rows={3} value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)} erro={comErro.includes("justificativa") ? "Explique a resposta (3 a 1000 caracteres)." : null} />
      <p className="flex items-start gap-2 text-xs text-tinta-suave">
        <Icone nome="info" className="mt-px h-4 w-4 shrink-0" />
        Sua resposta fica no histórico do pedido, com seu nome, e {d.pedidaPor ?? "quem pediu"} é avisado no sino. Aprovar não contrata nem paga nada.
      </p>
      <div className="-mx-6 flex flex-wrap items-center justify-between gap-2 border-t border-linha px-6 pt-4 max-md:flex-col-reverse max-md:items-stretch">
        <Botao variante="discreto" disabled={enviando} onClick={() => void responder(false)}><Icone nome="esq" />Devolver sem decidir</Botao>
        <span className="flex flex-wrap gap-2 max-md:flex-col-reverse">
          <Botao variante="contorno" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" disabled={enviando}><Icone nome="check" />{escolhida ? `Aprovar a alternativa ${escolhida}` : "Aprovar"}</Botao>
        </span>
      </div>
    </form>
  );
}

const apoioDecidir = (d: DecisaoPedido) =>
  `Pedida${d.pedidaPor ? ` por ${d.pedidaPor}` : ""} em ${dia(d.pedidaEm)} · decidir até ${diaDoPrazo(d.prazo)} · ${d.pedido.assunto}`;

export function ResponderDecisao({ d, aoFechar, salvo, recarregar }: { d: DecisaoPedido | null; aoFechar: () => void; salvo: (t: string) => void; recarregar: () => void }) {
  return (
    <Dialogo aberto={d !== null} titulo={d ? `Decidir · ${d.pedido.protocolo}` : "Decidir"} aoFechar={aoFechar} fechar
      apoio={d ? apoioDecidir(d) : undefined} media>
      {d ? <FormResponder key={d.id} d={d} aoFechar={aoFechar} salvo={salvo} recarregar={recarregar} /> : null}
    </Dialogo>
  );
}

/** Retirar o pedido de decisão (decisão 5): quem pediu ou quem atualiza o pedido, com motivo. */
export function RetirarDecisao({ d, aoFechar, salvo, recarregar }: { d: DecisaoPedido | null; aoFechar: () => void; salvo: (t: string) => void; recarregar: () => void }) {
  return (
    <Janela aberto={d !== null} titulo="Retirar o pedido de decisão" aoFechar={aoFechar} recarregar={recarregar}
      campos={[{ id: "motivo", rotulo: "Por que retirar", tipo: "area", obrigatorio: true, max: 500, erro: "Explique o motivo (3 a 500 caracteres)." }]}
      iniciais={{ motivo: "" }} textoBotao="Retirar"
      explicacao={d ? `${d.decisor.nome} deixa de ver esta decisão e a pendência do pedido fecha. Tudo fica no histórico.` : undefined}
      aoSalvar={async (v) => {
        const r = await chamarApi(`/v1/condominio/decisoes/${d?.id}/retirar`, { corpo: { versao: d?.versao, motivo: String(v.motivo ?? "").trim() } });
        if (r.ok) salvo("Pedido de decisão retirado. A pendência do pedido foi fechada.");
        return r;
      }} />
  );
}

