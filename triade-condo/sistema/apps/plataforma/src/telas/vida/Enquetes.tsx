"use client";
// Vida em condomínio › Enquetes (design "Vida em condomínio", tela 4; AC-03): a pergunta, o
// resultado enquanto corre, quantos faltam e o lembrete. Na enquete secreta, o síndico vê quem
// respondeu, nunca o que respondeu. Ao fechar, o resultado vira comunicado em rascunho.

import Link from "next/link";
import { useState } from "react";
import { CANAIS_ENQUETE, descreverEventoEnquete, formatarDataHora, porcentagem, textoRespostas } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, Dialogo, ErroCarregar, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { useCarregar } from "../sessao.tsx";
import type { EnqueteDetalhe, EnqueteTela, ListaEnquetes, ResultadoEnquete } from "../tipos.ts";

type Acao = { tipo: "ver" | "encerrar"; enquete: EnqueteTela };

/** "31/10, 23:59". */
export function prazoCurto(iso: string): string {
  const x = formatarDataHora(iso);
  return `${x.slice(0, 5)}, ${x.slice(11)}`;
}

export function AbaEnquetes({ aoMudar }: { aoMudar: (texto: string) => void }) {
  const carga = useCarregar<ListaEnquetes>("/v1/condominio/enquetes");
  const [acao, setAcao] = useState<Acao | null>(null);

  if (carga.estado === "carregando") return <Carregando rotulo="Carregando as enquetes…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const l = carga.dados;
  const fechar = (texto?: string) => { setAcao(null); if (texto) aoMudar(texto); };

  return (
    <div className="grid gap-3">
      {l.enquetes.length === 0 ? (
        <Vazio titulo="Nenhuma enquete ainda">
          Uma pergunta, de 2 a 6 opções e um prazo. Cada unidade recebe um link só dela, pelo WhatsApp ou pelo e-mail, e responde sem conta.
        </Vazio>
      ) : (
        <ul className="grid gap-3">
          {l.enquetes.map((e) => <CartaoEnquete key={e.id} e={e} podeEditar={l.pode.editar} aoAgir={(tipo) => setAcao({ tipo, enquete: e })} aoMudar={aoMudar} />)}
        </ul>
      )}
      <p className="text-[13px] text-tinta-suave">Enquete consulta, não decide. O que precisa de votação com valor de assembleia vai para Assembleias.</p>
      {acao?.tipo === "ver" ? <DetalheEnquete id={acao.enquete.id} aoFechar={() => setAcao(null)} /> : null}
      {acao?.tipo === "encerrar" ? <Encerrar e={acao.enquete} aoFechar={fechar} /> : null}
    </div>
  );
}

export function Barras({ r, marcar }: { r: ResultadoEnquete; marcar?: number }) {
  const votos = r.opcoes.reduce((s, o) => s + o.votos, 0);
  return (
    <ul className="grid gap-2">
      {r.opcoes.map((o, i) => {
        const p = porcentagem(o.votos, votos);
        return (
          <li key={i} className="grid gap-1 text-sm">
            <span className="flex justify-between gap-2">
              <span className={marcar === i + 1 ? "font-medium" : ""}>{o.texto}{marcar === i + 1 ? " (sua resposta)" : ""}</span>
              <span className="text-tinta-suave">{o.votos} · {p}%</span>
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-superficie-2" aria-hidden="true">
              <span className="block h-full rounded-full bg-violeta-500" style={{ width: `${p}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function descricao(e: EnqueteTela): string {
  return [
    e.por === "UNIDADE" ? "Uma resposta por unidade" : "Uma resposta por pessoa",
    e.secreta ? "respostas secretas" : "respostas abertas",
    `enviada por ${e.canais.map((c) => CANAIS_ENQUETE[c]).join(", ").replace(/, ([^,]*)$/, " e $1")} em ${formatarDataHora(e.criadoEm).slice(0, 5)}`,
  ].join(" · ");
}

function CartaoEnquete({ e, podeEditar, aoAgir, aoMudar }: {
  e: EnqueteTela; podeEditar: boolean; aoAgir: (t: Acao["tipo"]) => void; aoMudar: (texto: string) => void;
}) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const r = e.resultado;
  const faltam = r.total - r.responderam;
  const unidade = e.por === "UNIDADE" ? (faltam === 1 ? "unidade" : "unidades") : (faltam === 1 ? "pessoa" : "pessoas");
  const aberta = e.situacao === "ABERTA";

  async function publicar() {
    setErro(null);
    setEnviando(true);
    const res = await chamarApi<{ comunicadoId: string }>(`/v1/condominio/enquetes/${e.id}/publicar`, { corpo: { versao: e.versao } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    aoMudar("O resultado virou um comunicado em rascunho. Confira e publique em Comunicados.");
  }

  return (
    <li className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-4 shadow-s1">
      <span className="flex flex-wrap items-center gap-2">
        <button type="button" className="min-h-6 text-left font-medium hover:text-violeta-600 hover:underline" onClick={() => aoAgir("ver")}>{e.pergunta}</button>
        {aberta ? <Selo tom="andamento">Aberta até {prazoCurto(e.abertaAte)}</Selo> : <Selo tom="neutro">Encerrada</Selo>}
      </span>
      <span className="text-sm text-tinta-suave">{descricao(e)}</span>
      <Barras r={r} />
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div><dt className="text-[13px] text-tinta-suave">Responderam</dt><dd>{r.responderam} de {r.total} {e.por === "UNIDADE" ? "unidades" : "pessoas"} ({porcentagem(r.responderam, r.total)}%)</dd></div>
        {aberta ? (
          <div><dt className="text-[13px] text-tinta-suave">Sem resposta</dt><dd>{faltam} {unidade}{faltam ? <> · <button type="button" className="min-h-6 font-medium text-violeta-600 hover:underline" onClick={() => aoAgir("ver")}>ver quais</button></> : null}</dd></div>
        ) : null}
        {aberta ? (
          <div><dt className="text-[13px] text-tinta-suave">Lembrete</dt><dd>
            {e.lembreteEnviadoEm ? `Enviado em ${prazoCurto(e.lembreteEnviadoEm)}` : e.lembreteEm ? `Vai em ${prazoCurto(e.lembreteEm).slice(0, 5)}, só para quem falta` : "Sem lembrete: o prazo é curto"}
          </dd></div>
        ) : (
          <div><dt className="text-[13px] text-tinta-suave">Fechou</dt><dd>{e.encerradaEm ? prazoCurto(e.encerradaEm) : ""}{e.encerradaPor ? `, por ${e.encerradaPor}` : ""}</dd></div>
        )}
      </dl>
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {e.comunicado ? (
        <span className="text-sm">
          Resultado em Comunicados ({e.comunicado.estado === "RASCUNHO" ? "rascunho" : "publicado"}).{" "}
          <Link href={`/comunicados/comunicado?id=${e.comunicado.id}`} className="font-medium text-violeta-600 hover:underline">Abrir o comunicado</Link>
        </span>
      ) : null}
      {podeEditar && (aberta || !e.comunicado) ? (
        <span className="flex flex-wrap gap-2">
          {aberta ? <Botao tamanho="m" variante="contorno" onClick={() => aoAgir("encerrar")} aria-label={`Encerrar agora: ${e.pergunta}`}>Encerrar agora</Botao> : null}
          {!aberta ? <Botao tamanho="m" onClick={() => void publicar()} disabled={enviando} aria-label={`Publicar o resultado: ${e.pergunta}`}>Publicar o resultado</Botao> : null}
        </span>
      ) : null}
    </li>
  );
}

function Encerrar({ e, aoFechar }: { e: EnqueteTela; aoFechar: (texto?: string) => void }) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function encerrar() {
    setErro(null);
    setEnviando(true);
    const res = await chamarApi(`/v1/condominio/enquetes/${e.id}/encerrar`, { corpo: { versao: e.versao } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    aoFechar("Enquete encerrada. Os links param de aceitar resposta e o resultado já pode virar comunicado.");
  }
  return (
    <Dialogo aberto titulo="Encerrar a enquete agora?" aoFechar={() => aoFechar()}>
      <div className="grid gap-3 text-sm">
        <p>{e.pergunta}</p>
        <p className="text-tinta-suave">
          Os links param de aceitar resposta e o lembrete não vai mais.{e.secreta ? " Na enquete secreta, a ligação entre unidade e resposta é apagada de vez." : ""}
        </p>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao variante="perigo" onClick={() => void encerrar()} disabled={enviando}>Encerrar</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

function DetalheEnquete({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const carga = useCarregar<EnqueteDetalhe>(`/v1/condominio/enquetes/${id}`);
  return (
    <Dialogo aberto titulo={carga.estado === "pronto" ? carga.dados.enquete.pergunta : "Enquete"} aoFechar={aoFechar}>
      {carga.estado === "carregando" ? <Carregando rotulo="Carregando a enquete…" /> : null}
      {carga.estado === "erro" ? <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} /> : null}
      {carga.estado === "pronto" ? <Detalhe d={carga.dados} aoFechar={aoFechar} /> : null}
    </Dialogo>
  );
}

function Detalhe({ d, aoFechar }: { d: EnqueteDetalhe; aoFechar: () => void }) {
  const e = d.enquete;
  const [link, setLink] = useState<{ nome: string; url: string; copiado: boolean } | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const faltam = d.convites.filter((c) => !c.respondeuEm);
  const responderam = d.convites.filter((c) => c.respondeuEm);
  const aberta = e.situacao === "ABERTA";

  async function copiar(conviteId: string, nome: string) {
    setErro(null);
    const r = await chamarApi<{ codigo: string }>(`/v1/condominio/enquetes/${e.id}/link`, { corpo: { conviteId } });
    if (!r.ok) return setErro(r.erro);
    const url = `${window.location.origin}/v/${r.dados.codigo}`;
    let copiado = false;
    try { await navigator.clipboard.writeText(url); copiado = true; } catch { copiado = false; }
    setLink({ nome, url, copiado });
  }

  return (
    <div className="grid gap-4 text-sm">
      <p className="text-tinta-suave">{textoRespostas(e.resultado.responderam, e.resultado.total)} · {aberta ? `aberta até ${prazoCurto(e.abertaAte)}` : "encerrada"}</p>
      <Barras r={e.resultado} />
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {link ? (
        <Aviso tom="ok" titulo={link.copiado ? `Link de ${link.nome} copiado` : `Link de ${link.nome}`}>
          <span className="break-all">{link.url}</span>. É só de {link.nome}: mande por outro meio, como um bilhete na portaria.
        </Aviso>
      ) : null}
      {aberta ? (
        <section aria-labelledby="eq-faltam" className="grid gap-2">
          <h3 id="eq-faltam" className="font-medium">Sem resposta ({faltam.length})</h3>
          {faltam.length ? (
            <ul className="grid gap-1">
              {faltam.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{c.nome}{c.semContato ? <span className="text-tinta-suave"> · sem WhatsApp nem e-mail para receber</span> : null}</span>
                  {d.pode.editar ? <Botao tamanho="p" variante="discreto" onClick={() => void copiar(c.id, c.nome)} aria-label={`Copiar o link de ${c.nome}`}>Copiar o link</Botao> : null}
                </li>
              ))}
            </ul>
          ) : <p className="text-tinta-suave">Todos responderam.</p>}
        </section>
      ) : null}
      <section aria-labelledby="eq-responderam" className="grid gap-2">
        <h3 id="eq-responderam" className="font-medium">Responderam ({responderam.length})</h3>
        {e.secreta ? <p className="text-[13px] text-tinta-suave">Respostas secretas: aparece quem respondeu, não o que respondeu.</p> : null}
        <ul className="grid gap-1">
          {responderam.map((c) => (
            <li key={c.id}>
              {c.nome}<span className="text-tinta-suave"> · {formatarDataHora(c.respondeuEm!)}{c.opcao ? ` · ${e.opcoes[c.opcao - 1]}` : ""}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="eq-historico" className="grid gap-2">
        <h3 id="eq-historico" className="font-medium">Histórico</h3>
        <ul className="grid gap-1">
          {d.historico.map((h, i) => (
            <li key={i} className="text-[13px]">
              {descreverEventoEnquete(h.acao, h.dados)}<span className="text-tinta-suave"> · {formatarDataHora(h.em)}{h.autor ? ` · ${h.autor}` : ""}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="flex justify-end"><Botao variante="discreto" onClick={aoFechar}>Fechar</Botao></div>
    </div>
  );
}
