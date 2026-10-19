"use client";
// Uma assembleia (design "Vida em condomínio", telas 6 e 8; AC-02, CD-07, AT-17): a convocação com
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
import { useCarregar, usePlataforma } from "../sessao.tsx";
import type { AssembleiaDetalhe, AssembleiaTela, ItemAssembleia, Recado, ResultadoItem, UnidadeAssembleia } from "../tipos.ts";
import { FormAssembleia, SeloAssembleia, tipoEForma } from "./Assembleias.tsx";

export function Assembleia() {
  const busca = useSearchParams();
  const id = busca.get("id");
  const carga = useCarregar<AssembleiaDetalhe>(id ? `/v1/condominio/assembleias/${id}` : null);
  const [recado, setRecado] = useState<Recado>(null);
  const { atualizar } = usePlataforma();

  if (!id) return <Aviso tom="atencao">Assembleia não encontrada.</Aviso>;
  if (carga.estado === "carregando") return <Carregando rotulo="Carregando a assembleia…" />;
  if (carga.estado === "erro") return <ErroCarregar texto={carga.texto} tentarDeNovo={carga.recarregar} />;
  const mudou = (texto: string) => { setRecado({ tom: "ok", texto }); carga.recarregar(); atualizar(); };
  return <Tela d={carga.dados} recado={recado} aoMudar={mudou} />;
}

type Acao =
  | { tipo: "editar" | "convocar" | "cancelar" | "iniciar" | "encerrar" | "voto" }
  | { tipo: "procuracao" | "direito"; u: UnidadeAssembleia };

function Tela({ d, recado, aoMudar }: { d: AssembleiaDetalhe; recado: Recado; aoMudar: (texto: string) => void }) {
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

  return (
    <div className="grid gap-5">
      <Link href="/vida?aba=assembleias" className="inline-flex min-h-6 items-center gap-1 text-sm font-medium text-violeta-600 hover:underline">
        <Icone nome="esq" />Assembleias
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex flex-wrap items-center gap-2 text-[28px] font-normal tracking-tight">{a.titulo} <SeloAssembleia estado={a.estado} /></h1>
          <p className="text-tinta-suave">
            {tipoEForma(a)} · 1ª chamada em {formatarDataHora(a.primeiraChamada)} · 2ª em {formatarDataHora(a.segundaChamada)}
            {a.local ? ` · ${a.local}` : ""}
          </p>
          {a.linkVideo ? <p className="text-sm">Videochamada: <a href={a.linkVideo} className="break-all text-violeta-600 underline" target="_blank" rel="noreferrer">{a.linkVideo}</a></p> : null}
        </div>
        {editar ? (
          <span className="flex flex-wrap gap-2">
            {a.estado === "RASCUNHO" ? <Botao variante="contorno" onClick={() => setAcao({ tipo: "editar" })}>Editar</Botao> : null}
            {a.estado === "RASCUNHO" ? <Botao onClick={() => setAcao({ tipo: "convocar" })}>Convocar</Botao> : null}
            {a.estado === "CONVOCADA" ? <Botao onClick={() => setAcao({ tipo: "iniciar" })}>Começar a assembleia</Botao> : null}
            {a.estado === "EM_ANDAMENTO" ? <Botao variante="contorno" onClick={() => setAcao({ tipo: "voto" })} disabled={!itemAberto}>Registrar voto</Botao> : null}
            {a.estado === "EM_ANDAMENTO" ? <Botao onClick={() => setAcao({ tipo: "encerrar" })}>Encerrar a assembleia</Botao> : null}
            {a.estado === "RASCUNHO" || a.estado === "CONVOCADA" ? <Botao variante="discreto" onClick={() => setAcao({ tipo: "cancelar" })}>Cancelar</Botao> : null}
          </span>
        ) : null}
      </div>
      {recado ? <Aviso tom={recado.tom}>{recado.texto}</Aviso> : null}
      {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
      {a.estado === "CANCELADA" ? <Aviso tom="neutro" titulo="Assembleia cancelada">{a.motivoCancelamento}</Aviso> : null}
      {link ? (
        <Aviso tom="ok" titulo={link.copiado ? `Link de ${link.nome} copiado` : `Link de ${link.nome}`}>
          <span className="break-all">{link.url}</span>. É só de {link.nome}: mande por outro meio, como um bilhete na portaria.
        </Aviso>
      ) : null}

      {a.estado === "RASCUNHO" ? <Convocacao a={a} /> : null}
      {a.presenca ? <Presenca a={a} /> : null}

      <section aria-labelledby="as-pauta" className="grid gap-3">
        <h2 id="as-pauta" className="text-lg font-medium">Pauta</h2>
        <ol className="grid gap-3">
          {a.itens.map((i) => (
            <Item key={i.id} i={i} a={a} podeAgir={editar && a.estado === "EM_ANDAMENTO"} outroAberto={!!itemAberto && itemAberto.id !== i.id}
              aoAgir={(qual) => void chamar(`itens/${qual}`, { itemId: i.id }, qual === "abrir" ? `Item ${i.ordem} em votação.` : `Item ${i.ordem} votado. Os números ficaram guardados.`)} />
          ))}
        </ol>
      </section>

      {a.estado === "ENCERRADA" ? <Ata d={d} aoMudar={aoMudar} /> : null}

      {a.estado !== "RASCUNHO" && a.estado !== "CANCELADA" ? (
        <Unidades d={d} podeAgir={editar && aberta} aoCopiar={(u) => void copiar(u)} aoAgir={(tipo, u) => setAcao({ tipo, u })}
          aoPresenca={(u, presente) => void chamar("presenca", { conviteId: u.id, presente },
            presente ? `${u.unidade} presente no salão.` : `Presença de ${u.unidade} retirada.`)} />
      ) : null}

      <section aria-labelledby="as-historico" className="grid gap-2">
        <h2 id="as-historico" className="text-lg font-medium">Histórico</h2>
        <ul className="grid gap-1 text-sm">
          {d.historico.map((h, n) => (
            <li key={n}>{descreverEventoAssembleia(h.acao, h.dados)}<span className="text-tinta-suave"> · {formatarDataHora(h.em)}{h.autor ? ` · ${h.autor}` : ""}</span></li>
          ))}
        </ul>
      </section>

      {acao?.tipo === "editar" ? <FormAssembleia a={a} aoFechar={() => setAcao(null)} aoSalvar={(_id, t) => fechar(t)} /> : null}
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
    <section aria-labelledby="as-convocacao" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-4 text-sm shadow-s1">
      <h2 id="as-convocacao" className="text-lg font-medium">Convocação</h2>
      <dl className="grid gap-3 sm:grid-cols-4">
        <div><dt className="text-[13px] text-tinta-suave">Antecedência</dt><dd>{a.antecedencia} dias (regra da convenção)</dd></div>
        <div><dt className="text-[13px] text-tinta-suave">Enviar até</dt><dd>{dia}/{mes}/{ano}</dd></div>
        <div><dt className="text-[13px] text-tinta-suave">Peso do voto</dt><dd>{PESOS_ASSEMBLEIA[a.peso]}</dd></div>
        <div><dt className="text-[13px] text-tinta-suave">Quem vota</dt><dd>Proprietário ou procurador</dd></div>
      </dl>
      <p className="text-tinta-suave">
        Ao convocar, o edital com a pauta, as chamadas, o local e como votar vai como comunicado (mural e e-mail), e cada unidade recebe pelo WhatsApp
        ou pelo e-mail dos proprietários um link só dela. O lembrete vai na véspera.
      </p>
    </section>
  );
}

function Presenca({ a }: { a: AssembleiaTela }) {
  const p = a.presenca!;
  return (
    <section aria-labelledby="as-presenca" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-4 text-sm shadow-s1">
      <h2 id="as-presenca" className="text-lg font-medium">Presença</h2>
      <dl className="grid gap-3 sm:grid-cols-4">
        <div><dt className="text-[13px] text-tinta-suave">Unidades presentes</dt><dd>{p.presentes} de {p.unidades} · {porcento(p.porcentagem)} {a.peso === "FRACAO" ? "das frações" : "das unidades"}</dd></div>
        <div><dt className="text-[13px] text-tinta-suave">Online · no salão</dt><dd>{p.online} · {p.salao}</dd></div>
        <div><dt className="text-[13px] text-tinta-suave">Por procuração</dt><dd>{p.porProcuracao}{p.procuracoesPendentes ? ` · ${p.procuracoesPendentes} a conferir` : ""}</dd></div>
        <div><dt className="text-[13px] text-tinta-suave">Sem direito a voto</dt><dd>{p.semDireito}</dd></div>
      </dl>
    </section>
  );
}

/** "Sim 61,4% · Não 12,1% · Abstenção 6,0% das frações presentes". */
function linhaResultado(r: ResultadoItem, fracao: boolean): string {
  return `${r.opcoes.map((o) => `${o.texto} ${porcento(o.porcentagem)}`).join(" · ")} ${fracao ? "das frações presentes" : "das unidades presentes"} · ${r.votaram === 1 ? "1 unidade votou" : `${r.votaram} unidades votaram`}`;
}

function Item({ i, a, podeAgir, outroAberto, aoAgir }: {
  i: ItemAssembleia; a: AssembleiaTela; podeAgir: boolean; outroAberto: boolean; aoAgir: (qual: "abrir" | "encerrar") => void;
}) {
  const r = i.resultado;
  const aviso = i.estado !== "ENCERRADO" && a.estado !== "RASCUNHO" ? avisoQuorum(i.quorum, r.alcancavel) : null;
  const situacao = i.estado === "ENCERRADO"
    ? (r.situacao === "ESCOLHIDA" ? `Escolhida: ${r.vencedor}` : SITUACOES_ITEM[r.situacao])
    : ESTADOS_ITEM[i.estado];
  const tom = i.estado === "ABERTO" ? "andamento" : i.estado === "AGUARDANDO" ? "neutro" : r.situacao === "APROVADO" || r.situacao === "ESCOLHIDA" ? "ok" : "atencao";
  return (
    <li className="grid gap-2 rounded-[18px] border border-linha bg-superficie p-4 text-sm shadow-s1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{i.ordem}. {i.titulo}</span>
        {a.estado !== "RASCUNHO" && a.estado !== "CANCELADA" ? <Selo tom={tom}>{situacao}</Selo> : null}
      </span>
      {i.descricao ? <span>{i.descricao}</span> : null}
      <span className="text-tinta-suave">{QUORUNS[i.quorum]} · {i.opcoes.join(", ")}</span>
      {i.estado === "ENCERRADO" || i.estado === "ABERTO" ? <span>{linhaResultado(r, a.peso === "FRACAO")}</span> : null}
      {i.estado === "ABERTO" ? <span className="text-tinta-suave">{r.votaram} de {r.presentes} unidades presentes já votaram · fecha quando o presidente encerrar o item</span> : null}
      {aviso ? <Aviso tom="atencao">{`Presentes somam ${porcento(r.porcentagemPresentes)}. ${aviso}`}</Aviso> : null}
      {podeAgir && i.estado === "AGUARDANDO" ? (
        <Botao tamanho="m" variante="contorno" className="justify-self-start" disabled={outroAberto} onClick={() => aoAgir("abrir")}
          aria-label={`Abrir a votação do item ${i.ordem}`}>Abrir a votação</Botao>
      ) : null}
      {podeAgir && i.estado === "ABERTO" ? (
        <Botao tamanho="m" className="justify-self-start" onClick={() => aoAgir("encerrar")} aria-label={`Encerrar a votação do item ${i.ordem}`}>Encerrar a votação</Botao>
      ) : null}
    </li>
  );
}

function Unidades({ d, podeAgir, aoCopiar, aoAgir, aoPresenca }: {
  d: AssembleiaDetalhe; podeAgir: boolean; aoCopiar: (u: UnidadeAssembleia) => void; aoAgir: (tipo: "procuracao" | "direito", u: UnidadeAssembleia) => void;
  aoPresenca: (u: UnidadeAssembleia, presente: boolean) => void;
}) {
  const a = d.assembleia;
  const fracao = a.peso === "FRACAO";
  return (
    <section aria-labelledby="as-unidades" className="grid gap-2">
      <h2 id="as-unidades" className="text-lg font-medium">Unidades</h2>
      <ul className="grid gap-2">
        {d.unidades.map((u) => (
          <li key={u.id} className="grid gap-1 rounded-xl border border-linha bg-superficie px-3 py-2 text-sm">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{u.unidade}</span>
              {fracao ? <span className="text-tinta-suave">{porcento(u.peso)}</span> : null}
              {u.presenteEm ? <Selo tom="ok">{u.presencaForma === "SALAO" ? "No salão" : "Online"}</Selo> : null}
              {u.semDireito ? <Selo tom="neutro">Sem direito a voto</Selo> : null}
              {u.procuracao ? <Selo tom={u.procuracao.estado === "PENDENTE" ? "atencao" : u.procuracao.estado === "ACEITA" ? "ok" : "neutro"}>Procuração {ESTADOS_PROCURACAO[u.procuracao.estado].toLowerCase()}</Selo> : null}
            </span>
            <span className="text-tinta-suave">
              {u.proprietarios ?? "Sem proprietário confirmado"}{u.semContato ? " · sem WhatsApp nem e-mail para receber" : ""}
              {u.procuracao ? ` · procurador: ${u.procuracao.nome}${u.procuracao.unidade ? ` (${u.procuracao.unidade})` : ""}${u.procuracao.motivo ? ` · ${u.procuracao.motivo}` : ""}` : ""}
              {u.motivoSemDireito ? ` · ${u.motivoSemDireito}` : ""}
            </span>
            {podeAgir ? (
              <span className="flex flex-wrap gap-2">
                <Botao tamanho="p" variante="discreto" onClick={() => aoCopiar(u)} aria-label={`Copiar o link de ${u.unidade}`}>Copiar o link</Botao>
                {u.procuracao?.estado === "PENDENTE" ? (
                  <Botao tamanho="p" variante="contorno" onClick={() => aoAgir("procuracao", u)} aria-label={`Conferir a procuração de ${u.unidade}`}>Conferir a procuração</Botao>
                ) : null}
                <Botao tamanho="p" variante="discreto" onClick={() => aoAgir("direito", u)} aria-label={`${u.semDireito ? "Devolver o direito a voto" : "Sem direito a voto"}: ${u.unidade}`}>
                  {u.semDireito ? "Devolver o direito a voto" : "Sem direito a voto"}
                </Botao>
                {a.estado === "EM_ANDAMENTO" ? (
                  u.presenteEm
                    ? (u.votos ? null : <Botao tamanho="p" variante="discreto" onClick={() => aoPresenca(u, false)} aria-label={`Retirar a presença de ${u.unidade}`}>Retirar a presença</Botao>)
                    : <Botao tamanho="p" variante="contorno" onClick={() => aoPresenca(u, true)} aria-label={`Marcar ${u.unidade} presente no salão`}>Presente no salão</Botao>
                ) : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
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
    aoMudar(documento && documento !== a.ataDocumento?.id ? "Ata assinada ligada à assembleia. Ela aparece na Memória do prédio." : "Ata salva.");
  }

  return (
    <section aria-labelledby="as-ata" className="grid gap-3 rounded-[18px] border border-linha bg-superficie p-4 text-sm shadow-s1">
      <h2 id="as-ata" className="text-lg font-medium">Ata</h2>
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
          {a.ataDocumento ? <Link href={`/comunicados/documento?id=${a.ataDocumento.id}`} className="inline-flex min-h-11 items-center font-medium text-violeta-600 hover:underline">Abrir a ata assinada</Link> : null}
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
      <div className="grid gap-3 text-sm">
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
      <div className="grid gap-3 text-sm">
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
      <form onSubmit={enviar} noValidate className="grid gap-3 text-sm">
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
      <div className="grid gap-3 text-sm">
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
      <form onSubmit={registrar} noValidate className="grid gap-3 text-sm">
        <p>{i.titulo}. Para quem está no salão e não usa o link. A unidade fica presente no salão.</p>
        {erro ? <AvisoErro erro={erro} texto={textoDoErro(erro)} /> : null}
        <CampoSelecao id="as-voto-unidade" rotulo="Unidade" value={convite} onChange={(e) => setConvite(e.target.value)}
          opcoes={unidades.map((u) => ({ valor: u.id, texto: u.votos?.[String(i.ordem)] ? `${u.unidade} (já votou)` : u.unidade }))} />
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-medium">Voto</legend>
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
