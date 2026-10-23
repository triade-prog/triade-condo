"use client";
// Uma assembleia (design "Vida em condomínio", telas 6 e 8; DC15, telas-modelo vida-assembleia-*;
// AC-02, CD-07, AT-17): um botão principal por estado (Convocar, Começar, Encerrar), com Editar,
// Cancelar e a lista de presença em Mais ações; a presença em número grande; o item em votação em
// destaque, com o voto do salão e o encerrar ali mesmo; as unidades com busca, filtros e um menu
// por linha; e o andamento numa linha do tempo. A convocação com
// a antecedência e o peso do voto; as unidades com presença, procuração e direito a voto; cada
// item com o resultado em números pelo peso escolhido e o aviso quando o quórum não é alcançável;
// no fim, o rascunho da ata (texto editável, números não), a ata assinada de Documentos e a lista
// de presença para baixar.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  avisoQuorum, descreverEventoAssembleia, ESTADOS_ITEM, ESTADOS_PROCURACAO, formatarDataHora, PESOS_ASSEMBLEIA, porcento, QUORUNS, SITUACOES_ITEM,
} from "@triade/domain";
import {
  Aviso, AvisoErro, Botao, CampoAreaTexto, CampoSelecao, CampoTexto, Carregando, camposComErro, chamarApi, Dialogo, ErroCarregar, Icone, Selo,
  textoDoErro, type ErroApi,
} from "@triade/ui";
import { CartaoFicha, LadrilhoUnidade, MenuAcoes, type ItemMenu } from "../moradores/comum.tsx";
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { AssembleiaDetalhe, AssembleiaTela, ItemAssembleia, Recado, ResultadoItem, UnidadeAssembleia } from "../tipos.ts";
import { SeloAssembleia, tipoEForma } from "./Assembleias.tsx";
import { LinhaDoTempo, Voltar, type PassoTempo } from "./comum.tsx";

const FEITO: Record<string, string> = { rascunho: "Rascunho salvo. Confira a convocação e convoque quando estiver pronto." };

export function Assembleia() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const carga = useCarregar<AssembleiaDetalhe>(id ? `/v1/condominio/assembleias/${id}` : null);
  const [recado, setRecado] = useState<Recado>(FEITO[busca.get("feito") ?? ""] ? { tom: "ok", texto: FEITO[busca.get("feito")!]! } : null);
  const { atualizar } = usePlataforma();
  const voltar = <Voltar href="/vida?aba=assembleias" texto="Assembleias" />;

  if (!id) return <div className="grid gap-3">{voltar}<Aviso tom="atencao">Assembleia não encontrada.</Aviso></div>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando a assembleia…" />;
  if (carga.estado === "erro") return <div className="grid gap-3">{voltar}<ErroCarregar erro={carga.erro} texto={carga.texto} tentarDeNovo={carga.recarregar} /></div>;
  const mudou = (texto: string) => { setRecado({ tom: "ok", texto }); carga.recarregar(); atualizar(); };
  return <Tela d={carga.dados} voltar={voltar} recado={recado} aoMudar={mudou} />;
}

type Acao =
  | { tipo: "convocar" | "cancelar" | "iniciar" | "encerrar" | "voto" }
  | { tipo: "procuracao" | "direito"; u: UnidadeAssembleia };

function marca(acao: string): Pick<PassoTempo, "icone" | "tom"> {
  if (acao === "assembleia.convocada" || acao === "assembleia.lembrete") return { icone: "megafone", tom: "andamento" };
  if (acao === "assembleia.iniciada") return { icone: "pessoas", tom: "ok" };
  if (acao === "assembleia.item_encerrado" || acao === "assembleia.encerrada" || acao === "assembleia.procuracao_aceita") return { icone: "check", tom: "ok" };
  if (acao === "assembleia.item_aberto") return { icone: "grafico", tom: "andamento" };
  if (acao === "assembleia.cancelada") return { icone: "sair", tom: "neutro" };
  if (acao.startsWith("assembleia.procuracao")) return { icone: "documento", tom: "atencao" };
  if (acao === "assembleia.ata_ligada") return { icone: "documento", tom: "ok" };
  return { icone: "editar", tom: "neutro" };
}

function Tela({ d, voltar, recado, aoMudar }: { d: AssembleiaDetalhe; voltar: React.ReactNode; recado: Recado; aoMudar: (texto: string) => void }) {
  const a = d.assembleia;
  const [acao, setAcao] = useState<Acao | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [link, setLink] = useState<{ nome: string; url: string; copiado: boolean } | null>(null);
  const fechar = (texto?: string) => { setAcao(null); if (texto) aoMudar(texto); };
  const editar = d.pode.editar;
  const aberta = a.estado === "CONVOCADA" || a.estado === "EM_ANDAMENTO";
  const itemAberto = a.itens.find((i) => i.estado === "ABERTO");

  async function chamar(caminho: string, corpo: Record<string, unknown>, texto: string) {
    setErro(null);
    const r = await chamarApi(`/v1/condominio/assembleias/${a.id}/${caminho}`, { corpo });
    if (!r.ok) return setErro(r.erro);
    aoMudar(texto);
  }

  async function copiar(u: UnidadeAssembleia) {
    setErro(null);
    const r = await chamarApi<{ codigo: string }>(`/v1/condominio/assembleias/${a.id}/link`, { corpo: { conviteId: u.id } });
    if (!r.ok) return setErro(r.erro);
    const url = `${window.location.origin}/a/${r.dados.codigo}`;
    let copiado = false;
    try { await navigator.clipboard.writeText(url); copiado = true; } catch { copiado = false; }
    setLink({ nome: u.unidade, url, copiado });
  }

  // Um principal por estado, sempre no mesmo lugar (DC15): o resto vai para Mais ações.
  const principal = !editar ? null
    : a.estado === "RASCUNHO" ? <Botao onClick={() => setAcao({ tipo: "convocar" })}><Icone nome="megafone" />Convocar</Botao>
      : a.estado === "CONVOCADA" ? <Botao onClick={() => setAcao({ tipo: "iniciar" })}><Icone nome="pessoas" />Começar a assembleia</Botao>
        : a.estado === "EM_ANDAMENTO" ? <Botao onClick={() => setAcao({ tipo: "encerrar" })}><Icone nome="check" />Encerrar a assembleia</Botao> : null;
  const mais: ItemMenu[] = [
    ...(editar && a.estado === "RASCUNHO" ? [{ texto: "Editar", icone: "editar" as const, href: `/vida/nova-assembleia?id=${a.id}` }] : []),
    ...(a.estado === "EM_ANDAMENTO" || a.estado === "ENCERRADA" ? [{ texto: "Baixar a lista de presença", icone: "baixar" as const, acao: () => baixarPresenca(d) }] : []),
    ...(editar && (a.estado === "RASCUNHO" || a.estado === "CONVOCADA") ? [{ texto: "Cancelar a assembleia…", icone: "sair" as const, perigo: true, acao: () => setAcao({ tipo: "cancelar" }) }] : []),
  ];
  const tempo: PassoTempo[] = [...d.historico].sort((x, y) => x.em.localeCompare(y.em)).map((h) => ({
    ...marca(h.acao), titulo: descreverEventoAssembleia(h.acao, h.dados), quando: [formatarDataHora(h.em), h.autor].filter(Boolean).join(" · "),
  }));
  if (a.estado === "CONVOCADA") tempo.push({ icone: "pessoas", tom: "andamento", titulo: "1ª chamada", quando: formatarDataHora(a.primeiraChamada), futuro: true });

  return (
    <div className="grid gap-5 max-md:pb-20">
      {voltar}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="t-titulo-tela">{a.titulo}</h1>
          <p className="flex flex-wrap items-center gap-2 t-texto">
            <SeloAssembleia estado={a.estado} />
            <Selo tom="neutro">{tipoEForma(a)}</Selo>
            {a.local ? <span>{a.local}</span> : null}
            {a.linkVideo ? <a href={a.linkVideo} className="inline-flex items-center gap-1 font-medium text-violeta-600 hover:underline" target="_blank" rel="noreferrer"><Icone nome="link" className="h-4 w-4" />Videochamada</a> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MenuAcoes rotulo="Mais ações" texto="Mais ações" itens={mais} />
          {principal ? <div className="max-md:hidden">{principal}</div> : null}
        </div>
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {a.estado === "CANCELADA" ? <Aviso tom="neutro" titulo="Assembleia cancelada">{a.motivoCancelamento}</Aviso> : null}
      {link ? (
        <Aviso tom="ok" titulo={link.copiado ? `Link de ${link.nome} copiado` : `Link de ${link.nome}`}>
          <span className="break-all">{link.url}</span>. É só de {link.nome}: mande por outro meio, como um bilhete na portaria.
        </Aviso>
      ) : null}

      <dl className="grid gap-x-5 gap-y-3 rounded-[18px] border border-linha bg-superficie p-4 t-texto shadow-s1 sm:grid-cols-2 md:px-5 lg:grid-cols-4">
        <div><dt className="t-apoio">1ª chamada</dt><dd className="t-texto">{formatarDataHora(a.primeiraChamada)}</dd></div>
        <div><dt className="t-apoio">2ª chamada</dt><dd className="t-texto">{formatarDataHora(a.segundaChamada)}</dd></div>
        <div><dt className="t-apoio">Peso do voto</dt><dd className="t-texto">{PESOS_ASSEMBLEIA[a.peso]}</dd></div>
        <div><dt className="t-apoio">Quem vota</dt><dd className="t-texto">Proprietário ou procurador</dd></div>
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          {a.estado === "RASCUNHO" ? <Convocacao a={a} /> : null}
          <CartaoFicha id="pauta" titulo="Pauta" icone="lista">
            <ol className="grid gap-2.5">
              {a.itens.map((i) => (
                <Item key={i.id} i={i} a={a} podeAgir={editar && a.estado === "EM_ANDAMENTO"} outroAberto={!!itemAberto && itemAberto.id !== i.id}
                  aoVoto={() => setAcao({ tipo: "voto" })}
                  aoAgir={(qual) => void chamar(`itens/${qual}`, { itemId: i.id }, qual === "abrir" ? `Item ${i.ordem} em votação.` : `Item ${i.ordem} votado. Os números ficaram guardados.`)} />
              ))}
            </ol>
          </CartaoFicha>
          {a.estado === "ENCERRADA" ? <Ata d={d} aoMudar={aoMudar} /> : null}
          <div className="max-lg:order-last"><CartaoFicha id="andamento" titulo="Andamento" icone="relogio"><LinhaDoTempo itens={tempo} /></CartaoFicha></div>
        </div>
        {a.estado !== "RASCUNHO" && a.estado !== "CANCELADA" ? (
          <div className="grid gap-5 max-lg:order-first">
            {a.presenca ? <Presenca a={a} /> : null}
            <Unidades d={d} podeAgir={editar && aberta} aoCopiar={(u) => void copiar(u)} aoAgir={(tipo, u) => setAcao({ tipo, u })}
              aoPresenca={(u, presente) => void chamar("presenca", { conviteId: u.id, presente },
                presente ? `${u.unidade} presente no salão.` : `Presença de ${u.unidade} retirada.`)} />
          </div>
        ) : null}
      </div>

      {principal ? <div className="fixed inset-x-0 bottom-[calc(61px+env(safe-area-inset-bottom))] z-20 grid border-t border-linha bg-superficie px-4 py-3 md:hidden">{principal}</div> : null}
      {acao?.tipo === "convocar" ? <Convocar a={a} aoFechar={fechar} /> : null}
      {acao?.tipo === "iniciar" ? (
        <Confirmar titulo="Começar a assembleia?" botao="Começar" aoFechar={fechar} caminho={`${a.id}/iniciar`} corpo={{ versao: a.versao }}
          feito="A assembleia começou. Abra o primeiro item quando a mesa estiver pronta.">
          A partir de agora, abrir o link pessoal registra a presença online. Marque aqui quem está no salão.
        </Confirmar>
      ) : null}
      {acao?.tipo === "encerrar" ? (
        <Confirmar titulo="Encerrar a assembleia?" botao="Encerrar" aoFechar={fechar} caminho={`${a.id}/encerrar`} corpo={{ versao: a.versao }}
          feito="Assembleia encerrada. O rascunho da ata está pronto para editar.">
          {itemAberto ? `O item ${itemAberto.ordem}, em votação, fecha com os votos de agora. ` : ""}
          Os links param de aceitar voto e o rascunho da ata é montado com a presença e o resultado de cada item.
        </Confirmar>
      ) : null}
      {acao?.tipo === "cancelar" ? <Cancelar a={a} aoFechar={fechar} /> : null}
      {acao?.tipo === "voto" && itemAberto ? <RegistrarVoto d={d} i={itemAberto} aoFechar={fechar} /> : null}
      {acao?.tipo === "procuracao" ? <DecidirProcuracao a={a} u={acao.u} aoFechar={fechar} /> : null}
      {acao?.tipo === "direito" ? <DireitoVoto a={a} u={acao.u} aoFechar={fechar} /> : null}
    </div>
  );
}

function Convocacao({ a }: { a: AssembleiaTela }) {
  const [ano, mes, dia] = a.enviarAte.split("-");
  return (
    <CartaoFicha id="convocacao" titulo="Convocação" icone="megafone">
      <dl className="grid gap-3 t-texto sm:grid-cols-3">
        <div><dt className="t-apoio">Antecedência</dt><dd>{a.antecedencia} dias (regra da convenção)</dd></div>
        <div><dt className="t-apoio">Enviar até</dt><dd>{dia}/{mes}/{ano}</dd></div>
        <div><dt className="t-apoio">Peso do voto</dt><dd>{PESOS_ASSEMBLEIA[a.peso]}</dd></div>
      </dl>
      <p className="t-apoio">
        Ao convocar, o edital com a pauta, as chamadas, o local e como votar vai como comunicado (mural e e-mail), e cada unidade recebe pelo WhatsApp
        ou pelo e-mail dos proprietários um link só dela. O lembrete vai na véspera.
      </p>
    </CartaoFicha>
  );
}

function Presenca({ a }: { a: AssembleiaTela }) {
  const p = a.presenca!;
  return (
    <CartaoFicha id="presenca" titulo="Presença" icone="pessoas">
      <div className="grid gap-1">
        <p className="flex items-baseline gap-2.5">
          <span className="text-[40px] leading-none font-semibold tracking-tight">{p.presentes} de {p.unidades}</span>
          <span className="t-texto">unidades presentes</span>
        </p>
        <p className="t-texto">{porcento(p.porcentagem)} {a.peso === "FRACAO" ? "das frações" : "das unidades"}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t border-linha pt-3 t-texto sm:grid-cols-4">
        <div><dt className="t-apoio">Online</dt><dd className="font-semibold">{p.online}</dd></div>
        <div><dt className="t-apoio">No salão</dt><dd className="font-semibold">{p.salao}</dd></div>
        <div><dt className="t-apoio">Por procuração</dt><dd className="font-semibold">{p.porProcuracao}{p.procuracoesPendentes ? ` · ${p.procuracoesPendentes} a conferir` : ""}</dd></div>
        <div><dt className="t-apoio">Sem direito a voto</dt><dd className="font-semibold">{p.semDireito}</dd></div>
      </dl>
    </CartaoFicha>
  );
}

/** "Sim 61,4% · Não 12,1% · Abstenção 6,0% das frações presentes". */
function linhaResultado(r: ResultadoItem, fracao: boolean): string {
  return `${r.opcoes.map((o) => `${o.texto} ${porcento(o.porcentagem)}`).join(" · ")} ${fracao ? "das frações presentes" : "das unidades presentes"} · ${r.votaram === 1 ? "1 unidade votou" : `${r.votaram} unidades votaram`}`;
}

function Item({ i, a, podeAgir, outroAberto, aoAgir, aoVoto }: {
  i: ItemAssembleia; a: AssembleiaTela; podeAgir: boolean; outroAberto: boolean; aoAgir: (qual: "abrir" | "encerrar") => void; aoVoto: () => void;
}) {
  const r = i.resultado;
  // O aviso de quórum só faz sentido com a assembleia correndo: antes dela, ninguém está presente.
  const aviso = i.estado !== "ENCERRADO" && a.estado === "EM_ANDAMENTO" ? avisoQuorum(i.quorum, r.alcancavel) : null;
  const situacao = i.estado === "ENCERRADO"
    ? (r.situacao === "ESCOLHIDA" ? `Escolhida: ${r.vencedor}` : SITUACOES_ITEM[r.situacao])
    : ESTADOS_ITEM[i.estado];
  const tom = i.estado === "ABERTO" ? "andamento" : i.estado === "AGUARDANDO" ? "neutro" : r.situacao === "APROVADO" || r.situacao === "ESCOLHIDA" ? "ok" : "atencao";
  const aberto = i.estado === "ABERTO";
  return (
    <li className={`grid gap-2 rounded-2xl p-4 t-texto ${aberto ? "border-2 border-violeta-600 bg-violeta-50/40" : "border border-linha bg-superficie"}`}>
      <span className="flex flex-wrap items-center gap-2">
        <span className="numero" aria-hidden="true">{i.ordem}</span>
        <span className="t-titulo-cartao font-semibold">{i.ordem}. {i.titulo}</span>
        {a.estado !== "RASCUNHO" && a.estado !== "CANCELADA" ? <Selo tom={tom}>{situacao}</Selo> : null}
      </span>
      {i.descricao ? <span>{i.descricao}</span> : null}
      <span className="t-apoio">{QUORUNS[i.quorum]} · {i.opcoes.join(", ")}</span>
      {i.estado === "ENCERRADO" || aberto ? <span>{linhaResultado(r, a.peso === "FRACAO")}</span> : null}
      {aberto ? <span className="t-apoio">{r.votaram} de {r.presentes} unidades presentes já votaram · fecha quando o presidente encerrar o item</span> : null}
      {aviso ? <Aviso tom="atencao">{`Presentes somam ${porcento(r.porcentagemPresentes)}. ${aviso}`}</Aviso> : null}
      {podeAgir && i.estado === "AGUARDANDO" ? (
        <Botao tamanho="m" variante="contorno" className="justify-self-start" disabled={outroAberto} onClick={() => aoAgir("abrir")}
          aria-label={`Abrir a votação do item ${i.ordem}`}>Abrir a votação</Botao>
      ) : null}
      {podeAgir && aberto ? (
        <span className="flex flex-wrap gap-2">
          <Botao tamanho="m" variante="contorno" onClick={aoVoto} aria-label={`Registrar voto do salão no item ${i.ordem}`}><Icone nome="editar" className="h-4 w-4" />Registrar voto do salão</Botao>
          <Botao tamanho="m" variante="contorno" onClick={() => aoAgir("encerrar")} aria-label={`Encerrar a votação do item ${i.ordem}`}><Icone nome="check" className="h-4 w-4" />Encerrar a votação</Botao>
        </span>
      ) : null}
    </li>
  );
}

type FiltroUnidade = "" | "PRESENTES" | "FALTAM" | "PROCURACAO";

function Unidades({ d, podeAgir, aoCopiar, aoAgir, aoPresenca }: {
  d: AssembleiaDetalhe; podeAgir: boolean; aoCopiar: (u: UnidadeAssembleia) => void; aoAgir: (tipo: "procuracao" | "direito", u: UnidadeAssembleia) => void;
  aoPresenca: (u: UnidadeAssembleia, presente: boolean) => void;
}) {
  const a = d.assembleia;
  const fracao = a.peso === "FRACAO";
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroUnidade>("");
  const de: Record<Exclude<FiltroUnidade, "">, (u: UnidadeAssembleia) => boolean> = {
    PRESENTES: (u) => !!u.presenteEm, FALTAM: (u) => !u.presenteEm, PROCURACAO: (u) => u.procuracao?.estado === "PENDENTE",
  };
  const chips: [Exclude<FiltroUnidade, "">, string][] = [["PRESENTES", "Presentes"], ["FALTAM", "Faltam"], ["PROCURACAO", "Procuração a conferir"]];
  const termo = busca.trim().toLowerCase();
  const lista = d.unidades.filter((u) => (!filtro || de[filtro](u)) && (!termo || `${u.unidade} ${u.proprietarios ?? ""}`.toLowerCase().includes(termo)));

  function itens(u: UnidadeAssembleia): ItemMenu[] {
    if (!podeAgir) return [];
    return [
      ...(a.estado === "EM_ANDAMENTO" && !u.presenteEm ? [{ texto: "Presente no salão", icone: "predio" as const, rotulo: `Marcar ${u.unidade} presente no salão`, acao: () => aoPresenca(u, true) }] : []),
      ...(a.estado === "EM_ANDAMENTO" && u.presenteEm && !u.votos ? [{ texto: "Retirar a presença", icone: "sair" as const, rotulo: `Retirar a presença de ${u.unidade}`, acao: () => aoPresenca(u, false) }] : []),
      ...(u.procuracao?.estado === "PENDENTE" ? [{ texto: "Conferir a procuração", icone: "documento" as const, rotulo: `Conferir a procuração de ${u.unidade}`, acao: () => aoAgir("procuracao", u) }] : []),
      { texto: "Copiar o link", icone: "copiar" as const, rotulo: `Copiar o link de ${u.unidade}`, acao: () => aoCopiar(u) },
      u.semDireito
        ? { texto: "Devolver o direito a voto", icone: "check" as const, rotulo: `Devolver o direito a voto: ${u.unidade}`, acao: () => aoAgir("direito", u) }
        : { texto: "Marcar sem direito a voto…", icone: "cadeado" as const, perigo: true, rotulo: `Marcar sem direito a voto…: ${u.unidade}`, acao: () => aoAgir("direito", u) },
    ];
  }

  return (
    <CartaoFicha id="unidades" titulo="Unidades" icone="predio">
      <div className="grid gap-2.5">
        <div className="busca">
          <Icone nome="busca" />
          <label htmlFor="as-busca" className="sr-only">Buscar unidade ou nome</label>
          <input id="as-busca" className="campo" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar unidade ou nome" />
        </div>
        <div role="group" aria-label="Mostrar" className="flex flex-wrap gap-2">
          {chips.map(([f, texto]) => (
            <button key={f} type="button" aria-pressed={filtro === f} className="chip" onClick={() => setFiltro(filtro === f ? "" : f)}>
              {texto} <b className="font-bold">{d.unidades.filter(de[f]).length}</b>
            </button>
          ))}
        </div>
      </div>
      {lista.length === 0 ? <p className="t-apoio">Nenhuma unidade com esse filtro.</p> : (
        <ul className="grid">
          {lista.map((u) => (
            <li key={u.id} className="flex items-center gap-3 border-t border-linha py-3">
              <LadrilhoUnidade texto={u.unidade.split(" · ").at(-1) ?? u.unidade} />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="t-texto font-medium">{u.unidade}</span>
                <span className="t-apoio">
                  {[u.proprietarios ?? "Sem proprietário confirmado", fracao ? porcento(u.peso) : null, u.semContato ? "sem WhatsApp nem e-mail para receber" : null,
                    u.procuracao ? `procurador: ${u.procuracao.nome}${u.procuracao.unidade ? ` (${u.procuracao.unidade})` : ""}${u.procuracao.motivo ? ` · ${u.procuracao.motivo}` : ""}` : null,
                    u.motivoSemDireito ?? null].filter(Boolean).join(" · ")}
                </span>
                <span className="flex flex-wrap gap-1.5 pt-0.5">
                  {u.presenteEm ? <Selo tom="ok">{u.presencaForma === "SALAO" ? "No salão" : "Online"}</Selo> : a.estado === "EM_ANDAMENTO" ? <Selo tom="neutro">Faltando</Selo> : null}
                  {u.semDireito ? <Selo tom="neutro">Sem direito a voto</Selo> : null}
                  {u.procuracao ? <Selo tom={u.procuracao.estado === "PENDENTE" ? "atencao" : u.procuracao.estado === "ACEITA" ? "ok" : "neutro"}>Procuração {ESTADOS_PROCURACAO[u.procuracao.estado].toLowerCase()}</Selo> : null}
                </span>
              </span>
              <MenuAcoes rotulo={`Ações de ${u.unidade}`} itens={itens(u)} />
            </li>
          ))}
        </ul>
      )}
    </CartaoFicha>
  );
}

/** A lista de presença, para baixar e guardar com a ata. */
function baixarPresenca(d: AssembleiaDetalhe) {
  const q = (t: string) => `"${t.replaceAll('"', '""')}"`;
  const linhas = [["Unidade", "Fração ideal (%)", "Presença", "Forma", "Procurador", "Sem direito a voto"].map(q).join(";")];
  for (const u of d.unidades) {
    linhas.push([u.unidade, String(u.peso).replace(".", ","), u.presenteEm ? formatarDataHora(u.presenteEm) : "Ausente",
      u.presencaForma === "SALAO" ? "No salão" : u.presencaForma === "ONLINE" ? "Online" : "",
      u.procuracao?.estado === "ACEITA" ? u.procuracao.nome : "", u.semDireito ? (u.motivoSemDireito ?? "Sim") : ""].map(q).join(";"));
  }
  const url = URL.createObjectURL(new Blob([`\uFEFF${linhas.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
  const el = document.createElement("a");
  el.href = url;
  el.download = `presenca-${d.assembleia.titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  el.click();
  URL.revokeObjectURL(url);
}

function Ata({ d, aoMudar }: { d: AssembleiaDetalhe; aoMudar: (texto: string) => void }) {
  const a = d.assembleia;
  const [texto, setTexto] = useState(a.ataTexto ?? "");
  const [documento, setDocumento] = useState(a.ataDocumento?.id ?? "");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/assembleias/${a.id}/ata`, { metodo: "PUT", corpo: { versao: a.versao, texto, documentoId: documento || null } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoMudar(documento && documento !== a.ataDocumento?.id ? "Ata assinada ligada à assembleia. Ela aparece na linha do tempo de Documentos e memória." : "Ata salva.");
  }

  return (
    <section aria-labelledby="as-ata" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-4 t-texto shadow-s1">
      <h2 id="as-ata" className="t-titulo-secao font-medium">Ata</h2>
      <p className="text-tinta-suave">Rascunho montado sozinho com a chamada, a presença e o resultado de cada item. O texto é editável; os números dos itens não mudam.</p>
      <form onSubmit={salvar} noValidate className="grid gap-3">
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoAreaTexto id="as-ata-texto" rotulo="Texto da ata" rows={12} maxLength={20000} value={texto} onChange={(e) => setTexto(e.target.value)} disabled={!d.pode.editar} />
        <CampoSelecao id="as-ata-doc" rotulo="Ata assinada (de Documentos › Atas)" value={documento} onChange={(e) => setDocumento(e.target.value)} disabled={!d.pode.editar}
          opcoes={[{ valor: "", texto: d.documentos.length ? "Escolha a ata" : "Nenhuma ata em Documentos ainda" }, ...d.documentos.map((x) => ({ valor: x.id, texto: x.titulo }))]}
          ajuda="Guarde o PDF assinado em Comunicados › Documentos, tipo Ata, e ligue aqui" />
        <span className="flex flex-wrap gap-2">
          {d.pode.editar ? <Botao type="submit" disabled={enviando}>Salvar a ata</Botao> : null}
          <Botao variante="contorno" onClick={() => baixarPresenca(d)}><Icone nome="baixar" />Baixar a lista de presença</Botao>
          {a.ataDocumento ? <Link href={`/documentos/documento?id=${a.ataDocumento.id}`} className="inline-flex min-h-11 items-center font-medium text-violeta-600 hover:underline">Abrir a ata assinada</Link> : null}
        </span>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------------------
// Diálogos.

function Confirmar({ titulo, botao, caminho, corpo, feito, aoFechar, children }: {
  titulo: string; botao: string; caminho: string; corpo: Record<string, unknown>; feito: string; aoFechar: (texto?: string) => void; children: React.ReactNode;
}) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function confirmar() {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/assembleias/${caminho}`, { corpo });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFechar(feito);
  }
  return (
    <Dialogo aberto titulo={titulo} aoFechar={() => aoFechar()}>
      <div className="grid gap-3 t-texto">
        <p>{children}</p>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao onClick={() => void confirmar()} disabled={enviando}>{botao}</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

function Convocar({ a, aoFechar }: { a: AssembleiaTela; aoFechar: (texto?: string) => void }) {
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function convocar() {
    setErro(null);
    setEnviando(true);
    const r = await chamarApi<{ unidades: number; envios: number }>(`/v1/condominio/assembleias/${a.id}/convocar`, { corpo: { versao: a.versao } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFechar(`Assembleia convocada. O edital foi publicado e ${r.dados.unidades === 1 ? "1 unidade recebe" : `${r.dados.unidades} unidades recebem`} um link só dela.`);
  }
  return (
    <Dialogo aberto titulo="Convocar a assembleia?" aoFechar={() => aoFechar()}>
      <div className="grid gap-3 t-texto">
        <p>Depois de convocada, a assembleia não muda: para mudar, cancele e convoque outra.</p>
        <p className="text-tinta-suave">
          Vão o edital como comunicado publicado e um link pessoal para cada unidade, pelo WhatsApp (modelo aprovado) e pelo e-mail dos proprietários.
        </p>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao onClick={() => void convocar()} disabled={enviando}>Convocar</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

function ComMotivo({ titulo, botao, texto, ajuda, aoEnviar, aoFechar, obrigatorio = true }: {
  titulo: string; botao: string; texto: string; ajuda?: string; obrigatorio?: boolean;
  aoEnviar: (motivo: string) => Promise<ErroApi | null>; aoFechar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comErro = camposComErro(erro);
  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    setErro(await aoEnviar(motivo));
    setEnviando(false);
  }
  return (
    <Dialogo aberto titulo={titulo} aoFechar={aoFechar}>
      <form onSubmit={enviar} noValidate className="grid gap-3 t-texto">
        <p>{texto}</p>
        {erro && !comErro.length ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        {obrigatorio ? (
          <CampoTexto id="as-motivo" rotulo="Motivo" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} ajuda={ajuda}
            erro={comErro.includes("motivo") ? "Escreva o motivo, com pelo menos 3 letras" : null} />
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={aoFechar}>Voltar</Botao>
          <Botao type="submit" disabled={enviando}>{botao}</Botao>
        </div>
      </form>
    </Dialogo>
  );
}

const enviar = async (caminho: string, corpo: Record<string, unknown>, ok: () => void): Promise<ErroApi | null> => {
  const r = await chamarApi(`/v1/condominio/assembleias/${caminho}`, { corpo });
  if (!r.ok) return r.erro;
  ok();
  return null;
};

function Cancelar({ a, aoFechar }: { a: AssembleiaTela; aoFechar: (texto?: string) => void }) {
  return (
    <ComMotivo titulo="Cancelar a assembleia?" botao="Cancelar a assembleia" aoFechar={() => aoFechar()}
      texto={a.estado === "CONVOCADA" ? "Os links param de valer e os avisos que ainda não saíram ficam pelo caminho. Avise os moradores por um comunicado." : "O rascunho fica guardado como cancelado."}
      aoEnviar={(motivo) => enviar(`${a.id}/cancelar`, { versao: a.versao, motivo }, () => aoFechar("Assembleia cancelada."))} />
  );
}

function DireitoVoto({ a, u, aoFechar }: { a: AssembleiaTela; u: UnidadeAssembleia; aoFechar: (texto?: string) => void }) {
  return u.semDireito ? (
    <ComMotivo titulo={`Devolver o direito a voto de ${u.unidade}?`} botao="Devolver" obrigatorio={false} aoFechar={() => aoFechar()}
      texto="A unidade volta a votar nesta assembleia."
      aoEnviar={() => enviar(`${a.id}/direito`, { conviteId: u.id, semDireito: false }, () => aoFechar(`${u.unidade} voltou a ter direito a voto.`))} />
  ) : (
    <ComMotivo titulo={`${u.unidade} sem direito a voto?`} botao="Marcar sem direito" aoFechar={() => aoFechar()} ajuda="Por exemplo: em atraso com a taxa, conforme a convenção"
      texto="A unidade continua convidada e pode estar presente, mas não vota nesta assembleia. O link dela mostra o aviso."
      aoEnviar={(motivo) => enviar(`${a.id}/direito`, { conviteId: u.id, semDireito: true, motivo }, () => aoFechar(`${u.unidade} marcada sem direito a voto.`))} />
  );
}

function DecidirProcuracao({ a, u, aoFechar }: { a: AssembleiaTela; u: UnidadeAssembleia; aoFechar: (texto?: string) => void }) {
  const [recusar, setRecusar] = useState(false);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const p = u.procuracao!;
  const texto = `${u.unidade} indicou ${p.nome}${p.unidade ? `, da ${p.unidade},` : ""} para votar por ela. Confira a procuração assinada que chegou ao condomínio.`;
  if (recusar) {
    return (
      <ComMotivo titulo={`Recusar a procuração de ${u.unidade}?`} botao="Recusar" aoFechar={() => aoFechar()} texto={texto} ajuda="O motivo aparece no link da unidade"
        aoEnviar={(motivo) => enviar(`${a.id}/procuracao`, { conviteId: u.id, aceitar: false, motivo }, () => aoFechar(`Procuração de ${u.unidade} recusada.`))} />
    );
  }
  async function aceitar() {
    setEnviando(true);
    setErro(await enviar(`${a.id}/procuracao`, { conviteId: u.id, aceitar: true }, () => aoFechar(`Procuração de ${u.unidade} aceita.`)));
    setEnviando(false);
  }
  return (
    <Dialogo aberto titulo={`Procuração de ${u.unidade}`} aoFechar={() => aoFechar()}>
      <div className="grid gap-3 t-texto">
        <p>{texto}</p>
        <p className="text-tinta-suave">{p.unidade ? `Aceita, o link da ${p.unidade} passa a votar pelas duas.` : "Aceita, copie o link da unidade e mande ao procurador."}</p>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao variante="contorno" onClick={() => setRecusar(true)}>Recusar</Botao>
          <Botao onClick={() => void aceitar()} disabled={enviando}>Aceitar</Botao>
        </div>
      </div>
    </Dialogo>
  );
}

function RegistrarVoto({ d, i, aoFechar }: { d: AssembleiaDetalhe; i: ItemAssembleia; aoFechar: (texto?: string) => void }) {
  const unidades = d.unidades.filter((u) => !u.semDireito && u.procuracao?.estado !== "ACEITA");
  const [convite, setConvite] = useState(unidades[0]?.id ?? "");
  const [opcao, setOpcao] = useState(0);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [enviando, setEnviando] = useState(false);
  const nome = unidades.find((u) => u.id === convite)?.unidade ?? "";

  async function registrar(ev: FormEvent) {
    ev.preventDefault();
    if (!opcao) return;
    setErro(null);
    setEnviando(true);
    const r = await chamarApi(`/v1/condominio/assembleias/${d.assembleia.id}/voto`, { corpo: { conviteId: convite, itemId: i.id, opcao } });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro);
    aoFechar(`Voto de ${nome} no item ${i.ordem}: ${i.opcoes[opcao - 1]}.`);
  }

  return (
    <Dialogo aberto titulo={`Registrar voto no item ${i.ordem}`} aoFechar={() => aoFechar()}>
      <form onSubmit={registrar} noValidate className="grid gap-3 t-texto">
        <p>{i.titulo}. Para quem está no salão e não usa o link. A unidade fica presente no salão.</p>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoSelecao id="as-voto-unidade" rotulo="Unidade" value={convite} onChange={(e) => setConvite(e.target.value)}
          opcoes={unidades.map((u) => ({ valor: u.id, texto: u.votos?.[String(i.ordem)] ? `${u.unidade} (já votou)` : u.unidade }))} />
        <fieldset className="grid gap-2">
          <legend className="mb-1 t-apoio font-medium">Voto</legend>
          {i.opcoes.map((o, k) => (
            <label key={k} className="flex min-h-11 items-center gap-3 rounded-xl border border-linha px-3 py-2">
              <input type="radio" name="as-voto" checked={opcao === k + 1} onChange={() => setOpcao(k + 1)} />{o}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="discreto" onClick={() => aoFechar()}>Voltar</Botao>
          <Botao type="submit" disabled={enviando || !opcao || !convite}>Registrar</Botao>
        </div>
      </form>
    </Dialogo>
  );
}
