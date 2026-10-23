"use client";
// Uma enquete (design "Vida em condomínio", tela 4; DC15, telas-modelo vida-enquete-*; AC-03): o
// resultado, quem ainda não respondeu (com o link para copiar, para quem não tem WhatsApp nem
// e-mail), quem respondeu e o andamento, com o lembrete e o fechamento que ainda vêm. Encerrar
// agora fica em Mais ações; fechada, o principal é Publicar o resultado, que vira um comunicado em
// rascunho.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CANAIS_ENQUETE, descreverEventoEnquete, formatarDataHora, porcentagem } from "@triade/domain";
import { Aviso, AvisoErro, Botao, Carregando, chamarApi, classeBotao, Dialogo, ErroCarregar, Icone, Selo, textoDoErro, Vazio, type ErroApi } from "@triade/ui";
import { CartaoFicha, MenuAcoes, type ItemMenu } from "../moradores/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { EnqueteDetalhe, Recado } from "../tipos.ts";
import { LinhaDoTempo, Voltar, type PassoTempo } from "./comum.tsx";
import { Barras, prazoCurto, SeloEnquete } from "./Enquetes.tsx";

const juntar = (xs: string[]) => xs.join(", ").replace(/, ([^,]*)$/, " e $1");

export function Enquete() {
  const id = useSearchParams().get("id");
  const carga = useCarregar<EnqueteDetalhe>(id ? `/v1/condominio/enquetes/${id}` : null);
  const [recado, setRecado] = useState<Recado>(null);
  const { atualizar } = usePlataforma();
  const voltar = <Voltar href="/vida?aba=enquetes" texto="Enquetes" />;
  if (!id) return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Enquete</h1><Vazio titulo="Enquete não encontrada" /></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando a enquete…" />;
  if (carga.estado === "erro") return <div className="grid gap-3">{voltar}<h1 className="t-titulo-tela">Enquete</h1><ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  const mudou = (texto: string) => { setRecado({ tom: "ok", texto }); carga.recarregar(); atualizar(); };
  return <Tela d={carga.dados} voltar={voltar} recado={recado} aoMudar={mudou} />;
}

function marca(acao: string): Pick<PassoTempo, "icone" | "tom"> {
  if (acao === "enquete.criada") return { icone: "enviar", tom: "andamento" };
  if (acao === "enquete.lembrete") return { icone: "sino", tom: "info" };
  if (acao === "enquete.link_gerado") return { icone: "copiar", tom: "neutro" };
  if (acao === "enquete.resultado_publicado") return { icone: "megafone", tom: "ok" };
  return { icone: "relogio", tom: "neutro" };
}

function Tela({ d, voltar, recado, aoMudar }: { d: EnqueteDetalhe; voltar: React.ReactNode; recado: Recado; aoMudar: (texto: string) => void }) {
  const e = d.enquete;
  const [encerrando, setEncerrando] = useState(false);
  const [link, setLink] = useState<{ nome: string; url: string; copiado: boolean } | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const faltam = d.convites.filter((c) => !c.respondeuEm);
  const responderam = d.convites.filter((c) => c.respondeuEm);
  const aberta = e.situacao === "ABERTA";
  const r = e.resultado;
  const quem = e.por === "UNIDADE" ? "unidades" : "pessoas";

  async function copiar(conviteId: string, nome: string) {
    setErro(null);
    const res = await chamarApi<{ codigo: string }>(`/v1/condominio/enquetes/${e.id}/link`, { corpo: { conviteId } });
    if (!res.ok) return setErro(res.erro);
    const url = `${window.location.origin}/v/${res.dados.codigo}`;
    let copiado = false;
    try { await navigator.clipboard.writeText(url); copiado = true; } catch { copiado = false; }
    setLink({ nome, url, copiado });
  }

  async function publicar() {
    setErro(null);
    setEnviando(true);
    const res = await chamarApi<{ comunicadoId: string }>(`/v1/condominio/enquetes/${e.id}/publicar`, { corpo: { versao: e.versao } });
    setEnviando(false);
    if (!res.ok) return setErro(res.erro);
    aoMudar("O resultado virou um comunicado em rascunho. Confira e publique em Comunicados.");
  }

  const tempo: PassoTempo[] = [...d.historico].sort((a, b) => a.em.localeCompare(b.em)).map((h) => ({
    ...marca(h.acao), titulo: descreverEventoEnquete(h.acao, h.dados), quando: [formatarDataHora(h.em), h.autor].filter(Boolean).join(" · "),
  }));
  if (aberta && e.lembreteEm && !e.lembreteEnviadoEm) tempo.push({ icone: "sino", tom: "info", titulo: "Lembrete para quem falta", quando: `${prazoCurto(e.lembreteEm)} · só para quem não respondeu`, futuro: true });
  if (aberta) tempo.push({ icone: "relogio", tom: "neutro", titulo: "Fecha sozinha", quando: prazoCurto(e.abertaAte), futuro: true });

  const mais: ItemMenu[] = d.pode.editar && aberta ? [{ texto: "Encerrar agora…", icone: "relogio", perigo: true, rotulo: `Encerrar agora: ${e.pergunta}`, acao: () => setEncerrando(true) }] : [];
  const principal = d.pode.editar && !aberta && !e.comunicado
    ? <Botao onClick={() => void publicar()} disabled={enviando}><Icone nome="megafone" />Publicar o resultado</Botao>
    : e.comunicado ? <Link href={`/comunicados/comunicado?id=${e.comunicado.id}`} className={classeBotao("contorno")}><Icone nome="megafone" />Abrir o comunicado</Link> : null;

  return (
    <div className="grid gap-5 max-md:pb-20">
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="t-titulo-tela">{e.pergunta}</h1>
          <p className="flex flex-wrap items-center gap-2">
            <SeloEnquete e={e} />
            <Selo tom="neutro">{e.por === "UNIDADE" ? "Uma resposta por unidade" : "Uma resposta por pessoa"}</Selo>
            <Selo tom="neutro">{e.secreta ? "Respostas secretas" : "Respostas abertas"}</Selo>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MenuAcoes rotulo="Mais ações" texto="Mais ações" itens={mais} />
          {principal ? <div className="max-md:hidden">{principal}</div> : null}
        </div>
      </div>

      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {link ? (
        <Aviso tom="ok" titulo={link.copiado ? `Link de ${link.nome} copiado` : `Link de ${link.nome}`}>
          <span className="break-all">{link.url}</span>. É só de {link.nome}: mande por outro meio, como um bilhete na portaria.
        </Aviso>
      ) : null}

      <dl className="grid gap-x-5 gap-y-3 rounded-[18px] border border-linha bg-superficie p-4 t-texto shadow-s1 sm:grid-cols-3 md:px-5">
        <div><dt className="t-apoio">Responderam</dt><dd className="t-texto">{r.responderam} de {r.total} {quem} ({porcentagem(r.responderam, r.total)}%)</dd></div>
        <div><dt className="t-apoio">Por onde chegou</dt><dd className="t-texto">{juntar(e.canais.map((c) => CANAIS_ENQUETE[c]))}</dd></div>
        <div><dt className="t-apoio">Enviada</dt><dd className="t-texto">{formatarDataHora(e.criadoEm).slice(0, 5)}{e.criadoPor ? ` por ${e.criadoPor}` : ""}</dd></div>
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          <CartaoFicha id="resultado" titulo={aberta ? "Resultado até agora" : "Resultado"} icone="grafico">
            <Barras r={r} />
            {e.secreta ? <p className="t-apoio">Respostas secretas: aparece quem respondeu, não o que respondeu.</p> : <p className="t-apoio">Respostas abertas: a gestão vê o que cada um escolheu.</p>}
          </CartaoFicha>
          <div className="max-lg:order-last"><CartaoFicha id="andamento" titulo="Andamento" icone="relogio"><LinhaDoTempo itens={tempo} /></CartaoFicha></div>
        </div>
        <div className="grid gap-5">
          {aberta ? (
            <CartaoFicha id="faltam" titulo={`Sem resposta (${faltam.length})`} icone="relogio">
              {faltam.length ? (
                <ul className="grid">
                  {faltam.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 border-t border-linha py-3 first:border-t-0 first:pt-0">
                      <span className="ladrilho h-9 w-9 rounded-[11px]" data-tom={c.semContato ? "atencao" : "neutro"} aria-hidden="true"><Icone nome="predio" className="h-4.5 w-4.5" /></span>
                      <span className="grid min-w-0 flex-1"><span className="font-medium">{c.nome}</span>{c.semContato ? <span className="t-apoio">Sem WhatsApp nem e-mail para receber</span> : null}</span>
                      {d.pode.editar ? <Botao tamanho="p" variante="discreto" onClick={() => void copiar(c.id, c.nome)} aria-label={`Copiar o link de ${c.nome}`}><Icone nome="copiar" className="h-4 w-4" />Copiar o link</Botao> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="t-apoio">Todos responderam.</p>}
            </CartaoFicha>
          ) : null}
          <CartaoFicha id="responderam" titulo={`Responderam (${responderam.length})`} icone="check">
            {responderam.length ? (
              <ul className="grid">
                {responderam.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 border-t border-linha py-3 first:border-t-0 first:pt-0">
                    <span className="ladrilho h-9 w-9 rounded-[11px]" data-tom="ok" aria-hidden="true"><Icone nome="check" className="h-4.5 w-4.5" /></span>
                    <span className="grid min-w-0"><span className="font-medium">{c.nome}</span>
                      <span className="t-apoio">respondeu em {formatarDataHora(c.respondeuEm!).replace(" ", " às ")}{c.opcao ? ` · ${e.opcoes[c.opcao - 1]}` : ""}</span></span>
                  </li>
                ))}
              </ul>
            ) : <p className="t-apoio">Ninguém respondeu ainda.</p>}
          </CartaoFicha>
        </div>
      </div>

      {principal ? <div className="fixed inset-x-0 bottom-[calc(61px+env(safe-area-inset-bottom))] z-20 grid border-t border-linha bg-superficie px-4 py-3 md:hidden">{principal}</div> : null}
      {encerrando ? <Encerrar d={d} aoFechar={(t) => { setEncerrando(false); if (t) aoMudar(t); }} /> : null}
    </div>
  );
}

function Encerrar({ d, aoFechar }: { d: EnqueteDetalhe; aoFechar: (texto?: string) => void }) {
  const e = d.enquete;
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
      <div className="grid gap-3 t-texto">
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
